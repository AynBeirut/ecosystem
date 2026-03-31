const admin = require('firebase-admin');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

function parseArgs(argv) {
  const args = {
    storeId: '',
    before: '',
    after: '',
    materials: '',
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
    } else if (token === '--apply') {
      args.apply = true;
    }
  }

  return args;
}

function parseDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') {
    const d = value.toDate();
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toIso(d) {
  return d instanceof Date ? d.toISOString() : '';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.storeId) {
    console.error('❌ Missing --storeId');
    console.error('Usage: node scripts/reconcileRawMaterialStockProduction.cjs --storeId <STORE_ID> --before <ISO_DATE> [--after <ISO_DATE>] [--materials <ID1,ID2>] [--apply]');
    process.exit(1);
  }
  if (!args.before) {
    console.error('❌ Missing --before');
    console.error('Usage: node scripts/reconcileRawMaterialStockProduction.cjs --storeId <STORE_ID> --before <ISO_DATE> [--after <ISO_DATE>] [--materials <ID1,ID2>] [--apply]');
    process.exit(1);
  }

  const beforeDate = parseDate(args.before);
  if (!beforeDate) {
    console.error('❌ Invalid --before date. Use ISO format.');
    process.exit(1);
  }

  const afterDate = args.after ? parseDate(args.after) : null;
  if (args.after && !afterDate) {
    console.error('❌ Invalid --after date. Use ISO format.');
    process.exit(1);
  }

  const materialFilter = new Set(
    args.materials
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
  );

  const serviceAccountPath = join(process.cwd(), 'serviceAccountKey.json');
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  const db = admin.firestore();
  const dryRun = !args.apply;

  console.log(`\n=== RAW MATERIAL PRODUCTION RECONCILIATION (${dryRun ? 'DRY-RUN' : 'APPLY'}) ===`);
  console.log(`Store: ${args.storeId}`);
  console.log(`Before: ${beforeDate.toISOString()} (completed batches at/before)`);
  if (afterDate) {
    console.log(`After: ${afterDate.toISOString()} (completed batches at/after)`);
  }
  if (materialFilter.size > 0) {
    console.log(`Materials filter (${materialFilter.size}): ${Array.from(materialFilter).join(', ')}`);
  }

  const [productsSnap, recipesSnap, batchesSnap, rawMaterialsSnap] = await Promise.all([
    db.collection('products').where('storeId', '==', args.storeId).get(),
    db.collection('recipes').where('storeId', '==', args.storeId).get(),
    db.collection('productionBatches').where('storeId', '==', args.storeId).get(),
    db.collection('rawMaterials').where('storeId', '==', args.storeId).get(),
  ]);

  const products = new Map();
  productsSnap.forEach((doc) => products.set(doc.id, doc.data() || {}));

  const recipes = new Map();
  recipesSnap.forEach((doc) => recipes.set(doc.id, doc.data() || {}));

  const rawMaterials = new Map();
  rawMaterialsSnap.forEach((doc) => {
    const data = doc.data() || {};
    rawMaterials.set(doc.id, {
      id: doc.id,
      name: data.name || doc.id,
      currentStock: Number(data.currentStock || 0),
      updatedAt: data.updatedAt || null,
    });
  });

  const expectedConsumption = new Map();
  let skippedByStatus = 0;
  let skippedByDate = 0;
  let skippedByMissingRecipe = 0;
  let processedBatches = 0;

  for (const batchDoc of batchesSnap.docs) {
    const batch = batchDoc.data() || {};
    if (batch.status !== 'completed') {
      skippedByStatus += 1;
      continue;
    }

    const completionDate = parseDate(batch.completionDate || batch.updatedAt || batch.scheduledDate);
    if (!completionDate) {
      skippedByDate += 1;
      continue;
    }

    if (completionDate > beforeDate || (afterDate && completionDate < afterDate)) {
      skippedByDate += 1;
      continue;
    }

    const actualQty = Number(batch.actualQuantity || batch.quantity || 0);
    if (!Number.isFinite(actualQty) || actualQty <= 0) continue;

    const productId = batch.composedProductId || batch.productId || '';
    const product = products.get(productId) || {};
    const recipeId = (typeof batch.recipeId === 'string' && batch.recipeId) || (typeof product.recipeId === 'string' ? product.recipeId : '');
    const recipe = recipeId ? recipes.get(recipeId) : null;

    if (!recipeId || !recipe) {
      skippedByMissingRecipe += 1;
      continue;
    }

    const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
    const outputQty = Number(recipe.outputQuantity || recipe.yieldQuantity || 1);
    const safeOutputQty = outputQty > 0 ? outputQty : 1;

    for (const ingredient of ingredients) {
      const rawMaterialId = ingredient.rawMaterialId;
      if (!rawMaterialId) continue;
      if (materialFilter.size > 0 && !materialFilter.has(rawMaterialId)) continue;

      const ingredientQty = Number(ingredient.quantity || 0);
      if (!Number.isFinite(ingredientQty) || ingredientQty <= 0) continue;

      const consumeQty = (ingredientQty * actualQty) / safeOutputQty;
      expectedConsumption.set(rawMaterialId, (expectedConsumption.get(rawMaterialId) || 0) + consumeQty);
    }

    processedBatches += 1;
  }

  const changes = [];
  for (const [rawMaterialId, consumeQtyRaw] of expectedConsumption.entries()) {
    const consumeQty = Number(consumeQtyRaw.toFixed(4));
    const rawMaterial = rawMaterials.get(rawMaterialId);
    if (!rawMaterial) continue;

    const newStock = Number((rawMaterial.currentStock - consumeQty).toFixed(4));
    if (Math.abs(consumeQty) < 0.0001) continue;

    changes.push({
      rawMaterialId,
      name: rawMaterial.name,
      from: rawMaterial.currentStock,
      to: newStock,
      consume: consumeQty,
    });
  }

  changes.sort((a, b) => b.consume - a.consume);

  console.log('\n--- Analysis ---');
  console.log(`Completed batches processed: ${processedBatches}`);
  console.log(`Skipped by non-completed status: ${skippedByStatus}`);
  console.log(`Skipped by date window/invalid date: ${skippedByDate}`);
  console.log(`Skipped by missing recipe: ${skippedByMissingRecipe}`);
  console.log(`Materials with usage impact: ${expectedConsumption.size}`);
  console.log(`Materials that will change: ${changes.length}`);

  if (changes.length > 0) {
    console.log('\nTop material changes:');
    for (const row of changes.slice(0, 20)) {
      console.log(`- ${row.name} (${row.rawMaterialId}): ${row.from.toFixed(4)} -> ${row.to.toFixed(4)} (consume ${row.consume.toFixed(4)})`);
    }
  }

  if (dryRun) {
    console.log('\n✅ Dry-run complete. No writes performed.');
    return;
  }

  const nowIso = new Date().toISOString();

  const backupRef = await db.collection('auditLogs').add({
    storeId: args.storeId,
    action: 'backup',
    entityType: 'raw_material_production_reconcile',
    entityId: `raw-production-${nowIso}`,
    reason: 'Production-only raw material reconciliation apply',
    createdAt: nowIso,
    totalChanges: changes.length,
    window: {
      before: beforeDate.toISOString(),
      after: afterDate ? afterDate.toISOString() : null,
    },
    snapshot: changes.map((c) => ({
      rawMaterialId: c.rawMaterialId,
      name: c.name,
      oldStock: c.from,
      newStock: c.to,
      consumed: c.consume,
    })),
  });

  const batch = db.batch();
  for (const c of changes) {
    const ref = db.collection('rawMaterials').doc(c.rawMaterialId);
    batch.update(ref, {
      currentStock: c.to,
      updatedAt: nowIso,
      productionReconcileMetadata: {
        consumedQty: c.consume,
        reconciledAt: nowIso,
      },
    });
  }

  await batch.commit();

  console.log('\n✅ Apply complete.');
  console.log(`Backup auditLog id: ${backupRef.id}`);
}

main().catch((error) => {
  console.error('\n❌ Reconcile failed:', error?.message || error);
  process.exit(1);
});
