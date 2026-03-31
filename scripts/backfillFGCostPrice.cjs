/**
 * backfillFGCostPrice.cjs
 * Recalculates costPrice on all finishedGoodsInventory documents
 * using current rawMaterial prices, without any UI button.
 *
 * Run with: node scripts/backfillFGCostPrice.cjs [--apply]
 */
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '../serviceAccountKey.json'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const DRY_RUN = !process.argv.includes('--apply');

async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (pass --apply to write)' : 'LIVE WRITE'}\n`);

  const [fgSnap, matsSnap, recipesSnap] = await Promise.all([
    db.collection('finishedGoodsInventory').get(),
    db.collection('rawMaterials').get(),
    db.collection('recipes').get(),
  ]);

  const matMap = {};
  for (const d of matsSnap.docs) matMap[d.id] = d.data();

  const recipeMap = {};
  for (const d of recipesSnap.docs) recipeMap[d.id] = { id: d.id, ...d.data() };

  let updated = 0, skipped = 0, noRecipe = 0;

  for (const d of fgSnap.docs) {
    const fg = d.data();
    const name = fg.productName || fg.name || d.id;

    if (!fg.recipeId || !recipeMap[fg.recipeId]) {
      console.log(`  NO RECIPE  "${name}" — skipping`);
      noRecipe++;
      continue;
    }

    const recipe = recipeMap[fg.recipeId];
    const outputQty = recipe.outputQuantity || 1;
    let totalCost = 0;

    for (const ing of recipe.ingredients || []) {
      const mat = matMap[ing.rawMaterialId];
      if (!mat) continue;
      totalCost += (ing.quantity || 0) * (mat.costPerUnit || 0);
    }

    const newCostPerUnit = +(totalCost / outputQty).toFixed(4);
    const oldCost = fg.costPrice || 0;

    if (Math.abs(newCostPerUnit - oldCost) < 0.0001) {
      console.log(`  SKIP  "${name}" — already correct ($${oldCost})`);
      skipped++;
      continue;
    }

    const newTotalValue = +(fg.currentBalance * newCostPerUnit).toFixed(4);
    console.log(`  UPDATE "${name}"`);
    console.log(`    costPrice  : $${oldCost.toFixed(4)} → $${newCostPerUnit.toFixed(4)}`);
    console.log(`    totalValue : $${(fg.totalValue || 0).toFixed(2)} → $${newTotalValue.toFixed(2)}`);

    if (!DRY_RUN) {
      await d.ref.update({
        costPrice: newCostPerUnit,
        totalValue: newTotalValue,
        updatedAt: new Date().toISOString(),
        _costBackfillNote: `Updated from recipe on ${new Date().toISOString()}`,
      });
    }
    updated++;
  }

  console.log(`\n--- Done: ${updated} updated, ${skipped} already correct, ${noRecipe} without recipe ---`);
  if (DRY_RUN && updated > 0) console.log('Run with --apply to write changes.');
}

main().catch(err => { console.error(err); process.exit(1); });
