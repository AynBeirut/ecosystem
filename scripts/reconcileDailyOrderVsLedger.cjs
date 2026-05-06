const admin = require('firebase-admin');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const COUNTED_STATUSES = new Set(['delivered', 'paid', 'completed']);

function parseArgs(argv) {
  const args = {
    store: '',
    date: '',
    details: false,
    json: false,
    strict: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--store=')) args.store = arg.split('=')[1] || '';
    else if (arg.startsWith('--date=')) args.date = arg.split('=')[1] || '';
    else if (arg === '--details') args.details = true;
    else if (arg === '--json') args.json = true;
    else if (arg === '--strict') args.strict = true;
  }

  return args;
}

function toUtcRange(dateStr) {
  const base = dateStr || new Date().toISOString().slice(0, 10);
  const start = `${base}T00:00:00.000Z`;
  const end = `${base}T23:59:59.999Z`;
  return { base, start, end };
}

function normalizeProductKey(item) {
  return item?.productId || item?.composedProductId || item?.id || '';
}

function isCounted(status) {
  return COUNTED_STATUSES.has(String(status || '').toLowerCase());
}

function transitionSign(oldStatus, newStatus) {
  const oldCounted = isCounted(oldStatus);
  const newCounted = isCounted(newStatus);

  if (!oldCounted && newCounted) return -1; // consume stock
  if (oldCounted && !newCounted) return 1;  // restore stock
  return 0;
}

function addMovement(map, key, storeId, productName, value, source) {
  if (!key || !storeId || !Number.isFinite(value) || value === 0) return;
  const bucketKey = `${storeId}::${key}`;
  const current = map.get(bucketKey) || {
    storeId,
    productKey: key,
    productName: productName || '',
    net: 0,
    consume: 0,
    restore: 0,
    samples: [],
  };

  current.net += value;
  if (value < 0) current.consume += value;
  if (value > 0) current.restore += value;
  if (!current.productName && productName) current.productName = productName;
  if (source && current.samples.length < 10) current.samples.push(source);

  map.set(bucketKey, current);
}

function parseIso(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function inRange(iso, startIso, endIso) {
  const d = parseIso(iso);
  if (!d) return false;
  return d.toISOString() >= startIso && d.toISOString() <= endIso;
}

async function main() {
  const args = parseArgs(process.argv);
  const { base: targetDate, start, end } = toUtcRange(args.date);

  const serviceAccountPath = join(process.cwd(), 'serviceAccountKey.json');
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  const db = admin.firestore();

  console.log(`\nDaily Reconciliation`);
  console.log(`Date (UTC): ${targetDate}`);
  console.log(`Store scope: ${args.store || 'ALL'}`);

  const auditSnap = await db
    .collection('auditLogs')
    .where('timestamp', '>=', start)
    .where('timestamp', '<=', end)
    .get();

  const orderDocsCache = new Map();
  const orderDerived = new Map();

  for (const logDoc of auditSnap.docs) {
    const log = logDoc.data() || {};
    if (log.entityType !== 'order') continue;

    const storeId = String(log.storeId || '');
    if (!storeId) continue;
    if (args.store && storeId !== args.store) continue;

    const action = String(log.action || '').toLowerCase();
    const oldStatus = log?.oldValue?.status;
    const newStatus = log?.newValue?.status;

    let sign = 0;
    if (action === 'create') sign = transitionSign(undefined, newStatus);
    else if (action === 'update') sign = transitionSign(oldStatus, newStatus);
    else if (action === 'delete') sign = transitionSign(oldStatus, undefined);

    if (sign === 0) continue;

    const orderId = String(log.entityId || '');
    let items = Array.isArray(log?.newValue?.items) ? log.newValue.items : null;
    if (!items || items.length === 0) {
      items = Array.isArray(log?.oldValue?.items) ? log.oldValue.items : null;
    }

    if ((!items || items.length === 0) && orderId) {
      if (!orderDocsCache.has(orderId)) {
        const orderSnap = await db.collection('orders').doc(orderId).get();
        orderDocsCache.set(orderId, orderSnap.exists ? orderSnap.data() : null);
      }
      const cached = orderDocsCache.get(orderId);
      items = Array.isArray(cached?.items) ? cached.items : [];
    }

    for (const item of items || []) {
      const key = normalizeProductKey(item);
      const qty = Number(item?.quantity || 0);
      if (!key || !Number.isFinite(qty) || qty <= 0) continue;

      addMovement(
        orderDerived,
        key,
        storeId,
        item?.productName || item?.name || '',
        sign * qty,
        `${action}:${oldStatus || '-'}->${newStatus || '-'}:${orderId}`,
      );
    }
  }

  const fgQuery = args.store
    ? db.collection('finishedGoodsInventory').where('storeId', '==', args.store)
    : db.collection('finishedGoodsInventory');
  const fgSnap = await fgQuery.get();

  const ledgerDerived = new Map();

  for (const fgDoc of fgSnap.docs) {
    const fg = fgDoc.data() || {};
    const storeId = String(fg.storeId || '');
    if (!storeId) continue;

    const productKey = fg.productId || fg.composedProductId;
    if (!productKey) continue;

    const txs = Array.isArray(fg.transactions) ? fg.transactions : [];
    for (const tx of txs) {
      if (!inRange(tx?.date, start, end)) continue;

      const idempotencyKey = String(tx?.idempotencyKey || '');
      const reason = String(tx?.reason || '');
      const actionType = String(tx?.actionType || '').toLowerCase();
      const qty = Number(tx?.quantity || 0);
      if (!Number.isFinite(qty) || qty === 0) continue;

      const orderRelated =
        idempotencyKey.startsWith('status-delivered:') ||
        idempotencyKey.startsWith('status-rollback:') ||
        idempotencyKey.startsWith('order-delete:') ||
        reason.includes('Sale from order') ||
        reason.includes('Status rollback: Order') ||
        reason.includes('Reversal: Order');

      if (!orderRelated) continue;
      if (actionType !== 'sold' && actionType !== 'return') continue;

      addMovement(
        ledgerDerived,
        productKey,
        storeId,
        fg.productName || fg.name || '',
        qty,
        `${actionType}:${tx?.referenceNumber || tx?.referenceId || 'n/a'}`,
      );
    }
  }

  const allKeys = new Set([...orderDerived.keys(), ...ledgerDerived.keys()]);
  const mismatches = [];

  for (const key of allKeys) {
    const ord = orderDerived.get(key) || { storeId: key.split('::')[0], productKey: key.split('::')[1], productName: '', net: 0, consume: 0, restore: 0, samples: [] };
    const led = ledgerDerived.get(key) || { storeId: key.split('::')[0], productKey: key.split('::')[1], productName: '', net: 0, consume: 0, restore: 0, samples: [] };

    const delta = Number((ord.net - led.net).toFixed(3));
    if (Math.abs(delta) <= 0.0001) continue;

    mismatches.push({
      storeId: ord.storeId,
      productKey: ord.productKey,
      productName: ord.productName || led.productName || '',
      orderNet: Number(ord.net.toFixed(3)),
      ledgerNet: Number(led.net.toFixed(3)),
      delta,
      orderConsume: Number(ord.consume.toFixed(3)),
      orderRestore: Number(ord.restore.toFixed(3)),
      ledgerConsume: Number(led.consume.toFixed(3)),
      ledgerRestore: Number(led.restore.toFixed(3)),
      orderSamples: ord.samples,
      ledgerSamples: led.samples,
    });
  }

  mismatches.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const summary = {
    date: targetDate,
    storeScope: args.store || 'ALL',
    comparedProducts: allKeys.size,
    mismatches: mismatches.length,
  };

  if (args.json) {
    console.log(JSON.stringify({ summary, mismatches }, null, 2));
  } else {
    console.log(`\nCompared products: ${summary.comparedProducts}`);
    console.log(`Mismatches: ${summary.mismatches}`);

    if (mismatches.length > 0) {
      console.log('\nTop mismatches:');
      for (const row of mismatches.slice(0, 30)) {
        console.log(
          `- ${row.storeId} | ${row.productName || row.productKey} | orderNet=${row.orderNet} ledgerNet=${row.ledgerNet} delta=${row.delta}`
        );
        if (args.details) {
          console.log(`  order consume/restore: ${row.orderConsume}/${row.orderRestore}`);
          console.log(`  ledger consume/restore: ${row.ledgerConsume}/${row.ledgerRestore}`);
          console.log(`  order samples: ${row.orderSamples.join(' | ') || 'n/a'}`);
          console.log(`  ledger samples: ${row.ledgerSamples.join(' | ') || 'n/a'}`);
        }
      }
    }
  }

  if (args.strict && mismatches.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\nReconciliation failed:', error?.message || error);
  process.exit(1);
});
