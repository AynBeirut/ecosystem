const admin = require('firebase-admin');
const { readFileSync } = require('fs');
const { join } = require('path');

function parseArgs(argv) {
  const args = {
    storeId: '',
    before: '',
    after: '',
    materials: '',
    force: false,
    apply: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--storeId') {
      args.storeId = String(argv[i + 1] || '').trim();
      i += 1;
    } else if (token === '--before') {
      args.before = String(argv[i + 1] || '').trim();
      i += 1;
    } else if (token === '--after') {
      args.after = String(argv[i + 1] || '').trim();
      i += 1;
    } else if (token === '--materials') {
      args.materials = String(argv[i + 1] || '').trim();
      i += 1;
    } else if (token === '--force') {
      args.force = true;
    } else if (token === '--apply') {
      args.apply = true;
    }
  }

  return args;
}

function toDate(input) {
  if (!input) return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  if (typeof input === 'string') {
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof input === 'object' && typeof input.toDate === 'function') {
    const d = input.toDate();
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof input === 'object' && typeof input.seconds === 'number') {
    const d = new Date(input.seconds * 1000);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(String(input));
  return Number.isNaN(d.getTime()) ? null : d;
}

function getItemProductKey(item) {
  return item?.productId || item?.composedProductId || item?.id || '';
}

function parseMaterialIds(input) {
  if (!input) return [];
  return Array.from(new Set(
    String(input)
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean),
  ));
}

function getEarliestDateFromOrders(ordersSnap) {
  let earliest = null;
  ordersSnap.forEach((orderDoc) => {
    const order = orderDoc.data() || {};
    const createdAt = toDate(order.createdAt);
    if (!createdAt) return;
    if (!earliest || createdAt < earliest) {
      earliest = createdAt;
    }
  });
  return earliest;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.storeId) {
    console.error('❌ Missing --storeId');
    console.error('Usage: node scripts/reconcileRawMaterialStock.cjs --storeId <STORE_ID> --before <ISO_DATE> [--after <ISO_DATE|first-production>] [--materials <ID1,ID2>] [--force] [--apply]');
    process.exit(1);
  }

  if (!args.before) {
    console.error('❌ Missing --before cutoff date');
    console.error('Usage: node scripts/reconcileRawMaterialStock.cjs --storeId <STORE_ID> --before <ISO_DATE> [--after <ISO_DATE|first-production>] [--materials <ID1,ID2>] [--force] [--apply]');
    process.exit(1);
  }

  const cutoffDate = toDate(args.before);
  if (!cutoffDate) {
    console.error('❌ Invalid --before date. Example: 2026-03-11T00:00:00.000Z');
    process.exit(1);
  }

  const requestedAfterIsFirstProduction = String(args.after).toLowerCase() === 'first-production';
  const requestedAfterDate = requestedAfterIsFirstProduction ? null : toDate(args.after);
  if (args.after && !requestedAfterIsFirstProduction && !requestedAfterDate) {
    console.error('❌ Invalid --after date. Use ISO date or "first-production".');
    process.exit(1);
  }

  const selectedMaterialIds = parseMaterialIds(args.materials);
  const selectedMaterialSet = new Set(selectedMaterialIds);

  if (requestedAfterDate && requestedAfterDate > cutoffDate) {
    console.error('❌ --after must be earlier than or equal to --before');
    process.exit(1);
  }

  const modeLabel = args.apply ? 'APPLY' : 'DRY-RUN';
  console.log(`\n=== RAW MATERIAL RECONCILIATION (${modeLabel}) ===`);
  console.log(`Store: ${args.storeId}`);
  console.log(`Before: ${cutoffDate.toISOString()} (orders at/before)`);
  if (args.after) {
    console.log(`After: ${args.after === 'first-production' ? 'first-production (auto)' : args.after} (orders at/after)`);
  }
  if (selectedMaterialIds.length > 0) {
    console.log(`Materials filter (${selectedMaterialIds.length}): ${selectedMaterialIds.join(', ')}`);
  }
  console.log(`Force rerun already reconciled orders: ${args.force ? 'YES' : 'NO'}`);

  const serviceAccountPath = join(process.cwd(), 'serviceAccountKey.json');
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'market-flow-7b074',
  });

  const db = admin.firestore();

  const [productsSnap, recipesSnap, ordersSnap, materialsSnap] = await Promise.all([
    db.collection('products').where('storeId', '==', args.storeId).get(),
    db.collection('recipes').where('storeId', '==', args.storeId).get(),
    db.collection('orders').where('storeId', '==', args.storeId).where('status', '==', 'delivered').get(),
    db.collection('rawMaterials').where('storeId', '==', args.storeId).get(),
  ]);

  const productRecipeMap = new Map();
  productsSnap.forEach((doc) => {
    const data = doc.data() || {};
    const recipeId = typeof data.recipeId === 'string' ? data.recipeId : '';
    if (recipeId) productRecipeMap.set(doc.id, recipeId);
  });

  const recipeMap = new Map();
  recipesSnap.forEach((doc) => {
    recipeMap.set(doc.id, doc.data() || {});
  });

  const materialMap = new Map();
  materialsSnap.forEach((doc) => {
    const data = doc.data() || {};
    materialMap.set(doc.id, {
      id: doc.id,
      name: data.name || 'Unknown Material',
      currentStock: Number(data.currentStock || 0),
      ref: doc.ref,
    });
  });

  let effectiveAfterDate = requestedAfterDate;
  let afterSource = requestedAfterDate ? 'explicit' : 'none';
  if (requestedAfterIsFirstProduction) {
    const firstProductionDate = getEarliestDateFromOrders(ordersSnap);
    if (!firstProductionDate) {
      console.log('\n✅ No delivered orders found for first-production derivation. Nothing to reconcile.');
      return;
    }
    effectiveAfterDate = firstProductionDate;
    afterSource = 'first-production';
    if (effectiveAfterDate > cutoffDate) {
      console.log('\n✅ Derived first-production date is after --before cutoff. Nothing to reconcile.');
      return;
    }
  }

  if (effectiveAfterDate) {
    console.log(`Effective after: ${effectiveAfterDate.toISOString()} (${afterSource})`);
  }

  const usageByMaterial = new Map();
  const processedOrders = [];
  let skippedByMissingCreatedAt = 0;
  let skippedByAfter = 0;
  let skippedByBefore = 0;
  let skippedAlreadyReconciled = 0;
  let forceIncludedReconciled = 0;
  let skippedByMaterialFilter = 0;

  ordersSnap.forEach((orderDoc) => {
    const order = orderDoc.data() || {};
    const createdAt = toDate(order.createdAt);

    if (!createdAt) {
      skippedByMissingCreatedAt += 1;
      return;
    }

    if (effectiveAfterDate && createdAt < effectiveAfterDate) {
      skippedByAfter += 1;
      return;
    }

    if (createdAt > cutoffDate) {
      skippedByBefore += 1;
      return;
    }

    const wasAlreadyReconciled = Boolean(order.rawMaterialReconciledAt);
    if (wasAlreadyReconciled && !args.force) {
      skippedAlreadyReconciled += 1;
      return;
    }
    if (wasAlreadyReconciled && args.force) {
      forceIncludedReconciled += 1;
    }

    const items = Array.isArray(order.items) ? order.items : [];
    let orderTouched = false;

    for (const item of items) {
      const productId = getItemProductKey(item);
      const qty = Number(item?.quantity || 0);
      if (!productId || !Number.isFinite(qty) || qty <= 0) continue;

      const recipeId = productRecipeMap.get(productId);
      if (!recipeId) continue;

      const recipe = recipeMap.get(recipeId);
      const ingredients = Array.isArray(recipe?.ingredients) ? recipe.ingredients : [];
      if (ingredients.length === 0) continue;

      for (const ingredient of ingredients) {
        const rawMaterialId = typeof ingredient?.rawMaterialId === 'string' ? ingredient.rawMaterialId : '';
        const ingredientQty = Number(ingredient?.quantity || 0);
        if (!rawMaterialId || !Number.isFinite(ingredientQty) || ingredientQty <= 0) continue;
        if (selectedMaterialSet.size > 0 && !selectedMaterialSet.has(rawMaterialId)) continue;

        const consumeQty = ingredientQty * qty;
        usageByMaterial.set(rawMaterialId, (usageByMaterial.get(rawMaterialId) || 0) + consumeQty);
        orderTouched = true;
      }
    }

    if (orderTouched) {
      processedOrders.push(orderDoc.id);
    } else if (selectedMaterialSet.size > 0) {
      skippedByMaterialFilter += 1;
    }
  });

  const materialChanges = [];
  usageByMaterial.forEach((usedQty, rawMaterialId) => {
    const material = materialMap.get(rawMaterialId);
    if (!material) {
      materialChanges.push({
        id: rawMaterialId,
        name: 'MISSING_MATERIAL_DOC',
        oldStock: 0,
        usedQty,
        newStock: 0,
        missing: true,
      });
      return;
    }

    const oldStock = Number(material.currentStock || 0);
    const newStock = Math.max(0, oldStock - usedQty);
    const delta = newStock - oldStock;

    materialChanges.push({
      id: rawMaterialId,
      name: material.name,
      oldStock,
      usedQty,
      newStock,
      delta,
      ref: material.ref,
      missing: false,
    });
  });

  const actionableChanges = materialChanges.filter((m) => !m.missing && Math.abs(m.oldStock - m.newStock) > 0.000001);

  console.log('\n--- Analysis ---');
  console.log(`Delivered orders found: ${ordersSnap.size}`);
  console.log(`Eligible orders to reconcile: ${processedOrders.length}`);
  console.log(`Skipped by missing createdAt: ${skippedByMissingCreatedAt}`);
  console.log(`Skipped by --after: ${skippedByAfter}`);
  console.log(`Skipped by --before: ${skippedByBefore}`);
  console.log(`Skipped already reconciled: ${skippedAlreadyReconciled}`);
  console.log(`Force-included already reconciled: ${forceIncludedReconciled}`);
  if (selectedMaterialSet.size > 0) {
    console.log(`Skipped by materials filter: ${skippedByMaterialFilter}`);
  }
  console.log(`Materials with usage impact: ${materialChanges.length}`);
  console.log(`Materials that will change: ${actionableChanges.length}`);

  if (actionableChanges.length > 0) {
    console.log('\nTop material changes:');
    actionableChanges
      .sort((a, b) => (b.oldStock - b.newStock) - (a.oldStock - a.newStock))
      .slice(0, 20)
      .forEach((change) => {
        console.log(`- ${change.name} (${change.id}): ${change.oldStock.toFixed(4)} -> ${change.newStock.toFixed(4)} (consume ${change.usedQty.toFixed(4)})`);
      });
  }

  if (!args.apply) {
    console.log('\n✅ Dry-run complete. No writes performed.');
    return;
  }

  if (processedOrders.length === 0 || actionableChanges.length === 0) {
    console.log('\n✅ Nothing to apply.');
    return;
  }

  const nowIso = new Date().toISOString();
  const backupDoc = {
    action: 'raw_material_reconciliation_backup',
    storeId: args.storeId,
    createdAt: nowIso,
    before: cutoffDate.toISOString(),
    after: effectiveAfterDate ? effectiveAfterDate.toISOString() : null,
    afterSource,
    materials: selectedMaterialIds,
    force: args.force,
    processedOrdersCount: processedOrders.length,
    processedOrders,
    materialSnapshot: actionableChanges.map((m) => ({
      id: m.id,
      name: m.name,
      oldStock: m.oldStock,
      plannedUsedQty: m.usedQty,
      plannedNewStock: m.newStock,
    })),
  };

  const backupRef = await db.collection('auditLogs').add(backupDoc);
  console.log(`\n💾 Backup created: ${backupRef.id}`);

  let batch = db.batch();
  let opCount = 0;

  const flush = async () => {
    if (opCount === 0) return;
    await batch.commit();
    batch = db.batch();
    opCount = 0;
  };

  for (const material of actionableChanges) {
    batch.update(material.ref, {
      currentStock: material.newStock,
      updatedAt: nowIso,
    });
    opCount += 1;
    if (opCount >= 450) await flush();
  }

  for (const orderId of processedOrders) {
    const orderRef = db.collection('orders').doc(orderId);
    batch.update(orderRef, {
      rawMaterialReconciledAt: nowIso,
      rawMaterialReconciliationVersion: 2,
      rawMaterialReconciledBy: 'scripts/reconcileRawMaterialStock.cjs',
      rawMaterialReconciliationCutoff: cutoffDate.toISOString(),
      rawMaterialReconciliationAfter: effectiveAfterDate ? effectiveAfterDate.toISOString() : null,
      rawMaterialReconciliationMaterials: selectedMaterialIds,
      rawMaterialReconciliationForce: args.force,
    });
    opCount += 1;
    if (opCount >= 450) await flush();
  }

  await flush();

  await db.collection('auditLogs').add({
    action: 'raw_material_reconciliation_apply',
    storeId: args.storeId,
    createdAt: nowIso,
    before: cutoffDate.toISOString(),
    after: effectiveAfterDate ? effectiveAfterDate.toISOString() : null,
    afterSource,
    materials: selectedMaterialIds,
    force: args.force,
    processedOrdersCount: processedOrders.length,
    changedMaterialsCount: actionableChanges.length,
    backupId: backupRef.id,
  });

  console.log('\n✅ Reconciliation applied successfully.');
  console.log(`Orders marked reconciled: ${processedOrders.length}`);
  console.log(`Materials updated: ${actionableChanges.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Reconciliation failed:', error);
    process.exit(1);
  });
