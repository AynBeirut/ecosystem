const admin = require('firebase-admin');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

function parseArgs(argv) {
  const flags = { apply: false, store: '', products: '', statuses: 'delivered,paid,completed' };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') {
      flags.apply = true;
      continue;
    }
    if (arg.startsWith('--store=')) {
      flags.store = arg.split('=')[1] || '';
      continue;
    }
    if (arg.startsWith('--products=')) {
      flags.products = arg.split('=')[1] || '';
      continue;
    }
    if (arg.startsWith('--statuses=')) {
      flags.statuses = arg.split('=')[1] || flags.statuses;
    }
  }
  return flags;
}

function normalizeProductKey(item) {
  return item?.productId || item?.composedProductId || item?.id || '';
}

async function main() {
  const args = parseArgs(process.argv);
  const apply = args.apply;
  const productNames = (args.products || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  const countedStatuses = new Set((args.statuses || 'delivered,paid,completed').split(',').map((s) => s.trim()).filter(Boolean));

  const serviceAccountPath = join(process.cwd(), 'serviceAccountKey.json');
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  const db = admin.firestore();

  let targetStoreId = args.store;
  if (!targetStoreId) {
    if (productNames.length === 0) {
      throw new Error('Provide --store=<storeId> or --products="Name1,Name2"');
    }

    const matchedStores = new Set();
    for (const productName of productNames) {
      const snap = await db.collection('finishedGoodsInventory').where('productName', '==', productName).get();
      snap.forEach((doc) => {
        const data = doc.data() || {};
        if (typeof data.storeId === 'string' && data.storeId) matchedStores.add(data.storeId);
      });
    }

    if (matchedStores.size === 0) {
      throw new Error(`No finished goods found for products: ${productNames.join(', ')}`);
    }
    if (matchedStores.size > 1) {
      throw new Error(`Products span multiple stores: ${Array.from(matchedStores).join(', ')}. Pass --store explicitly.`);
    }

    targetStoreId = Array.from(matchedStores)[0];
  }

  console.log(`\nStore: ${targetStoreId}`);
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Statuses counted: ${Array.from(countedStatuses).join(', ')}`);
  if (productNames.length > 0) {
    console.log(`Scoped products: ${productNames.join(' | ')}`);
  }

  const [ordersSnap, fgSnap] = await Promise.all([
    db.collection('orders').where('storeId', '==', targetStoreId).get(),
    db.collection('finishedGoodsInventory').where('storeId', '==', targetStoreId).get(),
  ]);

  const actualSold = new Map();
  const productNameMap = new Map();

  ordersSnap.forEach((orderDoc) => {
    const order = orderDoc.data() || {};
    if (!countedStatuses.has(order.status)) return;

    const items = Array.isArray(order.items) ? order.items : [];
    for (const item of items) {
      const key = normalizeProductKey(item);
      if (!key) continue;
      const qty = Number(item.quantity || 0);
      if (!Number.isFinite(qty) || qty <= 0) continue;
      actualSold.set(key, (actualSold.get(key) || 0) + qty);
      if (item.productName && !productNameMap.has(key)) productNameMap.set(key, item.productName);
    }
  });

  const changes = [];

  fgSnap.forEach((fgDoc) => {
    const fg = fgDoc.data() || {};
    const productName = fg.productName || fg.name || 'Unknown';
    if (productNames.length > 0 && !productNames.includes(productName)) return;

    const key = fg.productId || fg.composedProductId;
    if (!key) return;

    const oldSold = Number(fg.quantitySold || 0);
    const newSold = Number(actualSold.get(key) || 0);
    const diff = oldSold - newSold;

    if (Math.abs(diff) <= 0.0001) return;

    const oldBalance = Number(fg.currentBalance || 0);
    const newBalance = oldBalance + diff;
    const costPrice = Number(fg.costPrice || 0);

    changes.push({
      fgDocId: fgDoc.id,
      productName,
      key,
      oldSold,
      newSold,
      diff,
      oldBalance,
      newBalance,
      newTotalValue: newBalance * costPrice,
    });
  });

  if (changes.length === 0) {
    console.log('\n✅ No mismatches found for this scope.');
    return;
  }

  console.log(`\nFound ${changes.length} mismatch(es):`);
  console.log('Product\tRecorded\tActual\tDifference');
  for (const c of changes) {
    const sign = c.diff > 0 ? '+' : '';
    console.log(`${c.productName}\t${c.oldSold.toFixed(2)}\t${c.newSold.toFixed(2)}\t${sign}${c.diff.toFixed(2)}`);
  }

  if (!apply) {
    console.log('\nDry-run only. Re-run with --apply to write changes.');
    return;
  }

  const nowIso = new Date().toISOString();

  const backupRef = await db.collection('auditLogs').add({
    storeId: targetStoreId,
    action: 'backup',
    entityType: 'finished_goods_sync',
    entityId: `fg-sync-${nowIso}`,
    reason: 'Manual reconcile finished goods sold quantities from counted orders',
    createdAt: nowIso,
    totalChanges: changes.length,
    snapshot: changes.map((c) => ({
      fgDocId: c.fgDocId,
      productName: c.productName,
      oldQuantitySold: c.oldSold,
      oldCurrentBalance: c.oldBalance,
    })),
  });

  const batch = db.batch();
  for (const c of changes) {
    const ref = db.collection('finishedGoodsInventory').doc(c.fgDocId);
    batch.update(ref, {
      quantitySold: c.newSold,
      currentBalance: c.newBalance,
      totalValue: c.newTotalValue,
      lastSyncDate: nowIso,
      updatedAt: nowIso,
      syncMetadata: {
        previousQuantitySold: c.oldSold,
        syncedQuantitySold: c.newSold,
        syncedAt: nowIso,
        syncedBy: 'script',
        syncedByName: 'reconcileFinishedGoodsSold.cjs',
      },
    });
  }

  await batch.commit();

  console.log('\n✅ Applied successfully.');
  console.log(`Backup auditLog id: ${backupRef.id}`);
}

main().catch((error) => {
  console.error('\n❌ Reconcile failed:', error?.message || error);
  process.exit(1);
});
