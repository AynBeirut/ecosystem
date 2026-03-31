/**
 * backfillRecipeCosts.cjs
 * Recalculates and updates totalCost + costPerUnit on all recipe documents
 * based on current rawMaterial.costPerUnit values in Firestore.
 * 
 * Run with: node scripts/backfillRecipeCosts.cjs [--apply]
 */
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '../serviceAccountKey.json'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const DRY_RUN = !process.argv.includes('--apply');

async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (pass --apply to write)' : 'LIVE WRITE'}`);
  console.log('');

  // Load all raw materials into a map
  const matsSnap = await db.collection('rawMaterials').get();
  const matMap = {};
  for (const d of matsSnap.docs) {
    matMap[d.id] = { id: d.id, ...d.data() };
  }
  console.log(`Loaded ${matsSnap.docs.length} raw materials`);

  const recipesSnap = await db.collection('recipes').get();
  console.log(`Loaded ${recipesSnap.docs.length} recipe documents`);
  console.log('');

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const recipeDoc of recipesSnap.docs) {
    const recipe = recipeDoc.data();
    const ingredients = recipe.ingredients || [];
    const outputQty = recipe.outputQuantity || 1;

    // Calculate totalCost from current material prices
    let totalCost = 0;
    let hasUnknownMaterial = false;

    for (const ing of ingredients) {
      const mat = matMap[ing.rawMaterialId];
      if (!mat) {
        hasUnknownMaterial = true;
        continue;
      }
      totalCost += (ing.quantity || 0) * (mat.costPerUnit || 0);
    }

    const newCostPerUnit = totalCost / outputQty;
    const oldTotal = recipe.totalCost || 0;
    const oldCpu = recipe.costPerUnit || 0;

    const totalDiff = Math.abs(totalCost - oldTotal);
    const cpuDiff = Math.abs(newCostPerUnit - oldCpu);

    if (totalDiff < 0.0001 && cpuDiff < 0.0001) {
      console.log(`  SKIP "${recipe.name}" — already correct (totalCost=${oldTotal.toFixed(4)}, cpu=${oldCpu.toFixed(4)})`);
      skipped++;
      continue;
    }

    if (hasUnknownMaterial) {
      console.log(`  WARN "${recipe.name}" — skipping; has unknown material(s)`);
      errors++;
      continue;
    }

    console.log(`  UPDATE "${recipe.name}"`);
    console.log(`    totalCost  : ${oldTotal.toFixed(4)} → ${totalCost.toFixed(4)}`);
    console.log(`    costPerUnit: ${oldCpu.toFixed(4)} → ${newCostPerUnit.toFixed(4)}`);

    if (!DRY_RUN) {
      await recipeDoc.ref.update({
        totalCost: +totalCost.toFixed(4),
        costPerUnit: +newCostPerUnit.toFixed(4),
        updatedAt: new Date().toISOString(),
        _costBackfillNote: `Costs recalculated from live material prices on ${new Date().toISOString()}`,
      });
    }
    updated++;
  }

  console.log('');
  console.log(`--- Done: ${updated} updated, ${skipped} already correct, ${errors} with errors ---`);
  if (DRY_RUN && updated > 0) console.log('Run with --apply to write changes.');
}

main().catch(err => { console.error(err); process.exit(1); });
