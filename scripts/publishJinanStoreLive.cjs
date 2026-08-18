#!/usr/bin/env node
/**
 * Publish Jinan owner-approved prices + fix recipe → material links for live stock.
 *
 *   node scripts/publishJinanStoreLive.cjs           # dry-run
 *   node scripts/publishJinanStoreLive.cjs --write
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const STORE_ID = 'ujff7blWYvUvlekQOrybvNCnn9V2';
const DATA_DIR = path.join(process.cwd(), 'jinan');
const write = process.argv.includes('--write');

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).filter(Boolean).map((line) => {
    const values = line.split(',');
    const row = {};
    headers.forEach((h, i) => { row[h] = (values[i] ?? '').trim(); });
    return row;
  });
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function outputMassKg(outputQuantity, outputUnit) {
  const q = num(outputQuantity, 1);
  const u = String(outputUnit || 'piece').toLowerCase();
  if (u === 'kg') return q;
  if (u === 'gram' || u === 'g') return q / 1000;
  return null;
}

function lineCost(ingredientType, quantity, materialBySku, productMetaBySku, ingredientSku) {
  if (ingredientType === 'material') {
    const mat = materialBySku[ingredientSku];
    return mat ? mat.costPerUnit * quantity : 0;
  }
  const prod = productMetaBySku[ingredientSku];
  if (!prod || !prod.outputMassKg) return 0;
  return (prod.costPrice / prod.outputMassKg) * quantity;
}

async function main() {
  const saPath = path.join(process.cwd(), 'serviceAccountKey.json');
  if (!fs.existsSync(saPath)) throw new Error('Missing serviceAccountKey.json');
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(require(saPath)) });
  }
  const db = admin.firestore();
  const now = new Date().toISOString();

  const productRows = parseCsv(fs.readFileSync(path.join(DATA_DIR, 'products.csv'), 'utf8'))
    .filter((r) => r.name);
  const recipeRows = parseCsv(fs.readFileSync(path.join(DATA_DIR, 'recipe_ingredients.csv'), 'utf8'));
  const rawRows = parseCsv(fs.readFileSync(path.join(DATA_DIR, 'raw_materials.csv'), 'utf8'));

  const materialBySku = Object.fromEntries(
    rawRows.filter((r) => r.name).map((r) => [r.sku, { ...r, costPerUnit: num(r.costPerUnit) }]),
  );

  const [matSnap, prodSnap, recipeSnap, composedSnap] = await Promise.all([
    db.collection('rawMaterials').where('storeId', '==', STORE_ID).get(),
    db.collection('products').where('storeId', '==', STORE_ID).get(),
    db.collection('recipes').where('storeId', '==', STORE_ID).get(),
    db.collection('composedProducts').where('storeId', '==', STORE_ID).get(),
  ]);

  const materialIdBySku = {};
  matSnap.docs.forEach((d) => {
    const sku = d.data().sku;
    if (sku) materialIdBySku[sku] = d.id;
  });

  const productDocBySku = {};
  const productIdBySku = {};
  prodSnap.docs.forEach((d) => {
    const sku = d.data().sku;
    if (sku) {
      productDocBySku[sku] = d;
      productIdBySku[sku] = d.id;
    }
  });

  const recipeByProductSku = {};
  prodSnap.docs.forEach((d) => {
    const sku = d.data().sku;
    const recipeId = d.data().recipeId;
    if (sku && recipeId) recipeByProductSku[sku] = recipeSnap.docs.find((r) => r.id === recipeId);
  });

  const recipesByProduct = recipeRows.reduce((acc, row) => {
    if (!acc[row.productSku]) acc[row.productSku] = [];
    acc[row.productSku].push(row);
    return acc;
  }, {});

  const productMetaBySku = {};
  for (const row of productRows) {
    const lines = recipesByProduct[row.sku] || [];
    const batchMassKg = outputMassKg(lines[0]?.outputQuantity, lines[0]?.outputUnit);
    const totalCost = lines.reduce(
      (sum, line) => sum + lineCost(line.ingredientType, num(line.quantity), materialBySku, productMetaBySku, line.ingredientSku),
      0,
    );
    productMetaBySku[row.sku] = {
      name: row.name,
      costPrice: totalCost,
      outputMassKg: batchMassKg || num(lines[0]?.outputQuantity, 1),
      outputUnit: lines[0]?.outputUnit || 'piece',
    };
  }

  let relinked = 0;
  let priced = 0;
  const missingLinks = [];

  for (const row of productRows) {
    const lines = recipesByProduct[row.sku];
    const recipeDoc = recipeByProductSku[row.sku];
    const productDoc = productDocBySku[row.sku];
    if (!lines?.length || !recipeDoc || !productDoc) continue;

    const ingredients = [];
    const materials = [];
    for (const line of lines) {
      const quantity = num(line.quantity);
      if (line.ingredientType === 'material') {
        const rawMaterialId = materialIdBySku[line.ingredientSku];
        const raw = materialBySku[line.ingredientSku];
        if (!rawMaterialId || !raw) {
          missingLinks.push(`${row.sku} missing material ${line.ingredientSku}`);
          continue;
        }
        materials.push({ rawMaterialId, quantity });
        ingredients.push({
          rawMaterialId,
          materialName: raw.name,
          quantity,
          unit: raw.unit,
          cost: raw.costPerUnit * quantity,
        });
      } else if (line.ingredientType === 'product') {
        const sourceProductId = productIdBySku[line.ingredientSku];
        const source = productMetaBySku[line.ingredientSku];
        if (!sourceProductId || !source) {
          missingLinks.push(`${row.sku} missing sub-product ${line.ingredientSku}`);
          continue;
        }
        materials.push({ productId: sourceProductId, quantity });
        ingredients.push({
          productId: sourceProductId,
          sourceProductSku: line.ingredientSku,
          materialName: source.name,
          quantity,
          unit: source.outputUnit,
          cost: lineCost('product', quantity, materialBySku, productMetaBySku, line.ingredientSku),
          isSemiFinished: true,
        });
      }
    }

    const ownerPrice = num(row.price);
    const meta = productMetaBySku[row.sku];
    const recipeUpdate = {
      ingredients,
      materials,
      totalCost: meta.costPrice,
      costPerUnit: meta.outputMassKg ? meta.costPrice / meta.outputMassKg : meta.costPrice,
      updatedAt: now,
      recipeLinksSyncedAt: now,
    };

    console.log(`${row.sku} ${row.name}: price $${ownerPrice} | ingredients ${ingredients.length}/${lines.length}`);

    if (write) {
      await recipeDoc.ref.update(recipeUpdate);
      relinked += 1;

      await productDoc.ref.update({
        price: ownerPrice,
        ownerReferencePrice: ownerPrice,
        updatedAt: now,
        catalogPricePublishedAt: now,
      });
      priced += 1;

      const composed = composedSnap.docs.find((d) => d.data().productId === productDoc.id);
      if (composed) {
        await composed.ref.update({
          sellingPrice: ownerPrice,
          ownerReferencePrice: ownerPrice,
          updatedAt: now,
        });
      }
    }
  }

  if (write) {
    await db.doc(`storeProfiles/${STORE_ID}`).set(
      {
        catalogPricingReady: true,
        catalogPricingPublishedAt: now,
        updatedAt: now,
      },
      { merge: true },
    );
  }

  console.log('\nSummary');
  console.log('  recipes relinked:', relinked);
  console.log('  products priced:', priced);
  console.log('  catalogPricingReady:', write ? true : '(dry-run)');
  if (missingLinks.length) {
    console.log('  warnings:', missingLinks.length);
    missingLinks.slice(0, 10).forEach((m) => console.log('   -', m));
  }
  if (!write) console.log('\nDry-run. Re-run with --write to apply.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
