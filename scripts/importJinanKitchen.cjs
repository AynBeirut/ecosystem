#!/usr/bin/env node
/**
 * Import Jinan's Kitchen composed catalog from jinan/*.csv
 *
 * Supports nested recipes:
 *   ingredientType=material  -> rawMaterials SKU
 *   ingredientType=product   -> another composed product SKU (dough -> pizza, empty croissant -> almond croissant)
 *
 * Products CSV columns:
 *   sku, name, category, description (public), productionNotes (batch/recipe — internal only), price
 *   node scripts/importJinanKitchen.cjs              # dry-run
 *   node scripts/importJinanKitchen.cjs --write      # apply
 *   node scripts/importJinanKitchen.cjs --write --purge
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const STORE_ID = 'ujff7blWYvUvlekQOrybvNCnn9V2';
const STORE_EMAIL = 'jinandaw86@gmail.com';
const DATA_DIR = path.join(process.cwd(), 'jinan');
const write = process.argv.includes('--write');
const purge = process.argv.includes('--purge');

function nowIso() {
  return new Date().toISOString();
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).filter(Boolean).map((line) => {
    const values = line.split(',');
    const row = {};
    headers.forEach((h, i) => {
      row[h] = (values[i] ?? '').trim();
    });
    return row;
  });
}

function readCsv(filename) {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) throw new Error(`Missing ${filePath}`);
  return parseCsv(fs.readFileSync(filePath, 'utf8'));
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function generateBarcode(prefix = '200') {
  const randomPart = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
  const barcode12 = prefix + randomPart;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(barcode12[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return barcode12 + checkDigit;
}

async function purgeStoreCatalog(db) {
  const collections = ['products', 'recipes', 'rawMaterials', 'composedProducts'];
  let total = 0;
  for (const name of collections) {
    const snap = await db.collection(name).where('storeId', '==', STORE_ID).get();
    if (!snap.size) continue;
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = db.batch();
      snap.docs.slice(i, i + 400).forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
    total += snap.size;
    console.log(`  purged ${name}: ${snap.size}`);
  }
  return total;
}

function lineCost(ingredientType, quantity, materialBySku, productMetaBySku, ingredientSku) {
  if (ingredientType === 'material') {
    const mat = materialBySku[ingredientSku];
    if (!mat) return 0;
    return mat.costPerUnit * quantity;
  }
  const prod = productMetaBySku[ingredientSku];
  if (!prod || !prod.outputQuantity) return 0;
  return (prod.costPrice / prod.outputQuantity) * quantity;
}

async function main() {
  const saPath = path.join(process.cwd(), 'serviceAccountKey.json');
  if (!fs.existsSync(saPath)) throw new Error('serviceAccountKey.json not found');
  const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
  }
  const db = admin.firestore();

  const rawRows = readCsv('raw_materials.csv');
  const productRows = readCsv('products.csv').filter((row) => String(row.name || '').trim());
  const recipeRows = readCsv('recipe_ingredients.csv');

  const recipesByProduct = recipeRows.reduce((acc, row) => {
    if (!acc[row.productSku]) acc[row.productSku] = [];
    acc[row.productSku].push(row);
    return acc;
  }, {});

  for (const product of productRows) {
    if (!recipesByProduct[product.sku]?.length) {
      throw new Error(`Missing recipe ingredients for ${product.sku}`);
    }
  }

  const productIngredientLinks = recipeRows.filter((r) => r.ingredientType === 'product');
  const nestedSummary = [...new Set(productIngredientLinks.map((r) => `${r.ingredientSku} -> ${r.productSku}`))];

  const preview = {
    storeId: STORE_ID,
    email: STORE_EMAIL,
    write,
    purge,
    rawMaterials: rawRows.length,
    products: productRows.length,
    recipeLines: recipeRows.length,
    nestedProductLinks: nestedSummary,
  };
  console.log(JSON.stringify(preview, null, 2));

  if (!write) {
    console.log('\nPass --write to import. Add --purge to delete existing store catalog first.');
    return;
  }

  if (purge) {
    console.log('\nPurging existing catalog...');
    await purgeStoreCatalog(db);
  }

  const createdAt = nowIso();
  const materialIdBySku = {};
  const materialBySku = {};

  for (const row of rawRows) {
    const packCost = num(row.packPriceUSD || row.ownerPackCost);
    const packLabel = row.packSize || row.ownerPackLabel || '';
    let costPerUnit = num(row.costPerUnit);
    if (!costPerUnit && packCost && packLabel) {
      const qtyMatch = String(packLabel).match(/([\d.]+)/);
      const qty = qtyMatch ? num(qtyMatch[1]) : 0;
      if (qty > 0) costPerUnit = Number((packCost / qty).toFixed(4));
    }
    const ref = db.collection('rawMaterials').doc();
    const data = {
      name: row.name,
      sku: row.sku,
      barcode: generateBarcode(),
      unit: row.unit,
      currentStock: num(row.currentStock),
      minimumThreshold: num(row.minimumThreshold),
      reorderPoint: num(row.reorderPoint),
      costPerUnit,
      ownerPackLabel: packLabel || undefined,
      ownerPackCost: packCost || undefined,
      preferredSupplierId: '',
      storageLocation: row.storageLocation || '',
      expiryTracking: false,
      storeId: STORE_ID,
      createdAt,
      updatedAt: createdAt,
      warrantyStartDate: createdAt,
    };
    materialIdBySku[row.sku] = ref.id;
    materialBySku[row.sku] = data;
    await ref.set(data);
  }

  const productIdBySku = {};
  const productMetaBySku = {};

  // Pass 1: compute costs in CSV order (products must be listed base-before-dependent).
  for (const row of productRows) {
    const lines = recipesByProduct[row.sku];
    const outputQuantity = num(lines[0].outputQuantity, 1);
    const totalCost = lines.reduce(
      (sum, line) => sum + lineCost(line.ingredientType, num(line.quantity), materialBySku, productMetaBySku, line.ingredientSku),
      0,
    );
    productMetaBySku[row.sku] = {
      name: row.name,
      costPrice: totalCost,
      outputQuantity,
      outputUnit: lines[0].outputUnit || 'piece',
    };
  }

  // Pass 2: write Firestore docs.
  let productsCreated = 0;
  for (const row of productRows) {
    const lines = recipesByProduct[row.sku];
    const meta = productMetaBySku[row.sku];
    const outputQuantity = meta.outputQuantity;
    const outputUnit = meta.outputUnit;
    const totalCost = meta.costPrice;

    const normalizedMaterials = [];
    const ingredients = [];

    for (const line of lines) {
      const quantity = num(line.quantity);
      if (line.ingredientType === 'material') {
        const rawMaterialId = materialIdBySku[line.ingredientSku];
        const raw = materialBySku[line.ingredientSku];
        if (!rawMaterialId || !raw) throw new Error(`Unknown material ${line.ingredientSku} for ${row.sku}`);
        normalizedMaterials.push({ rawMaterialId, quantity });
        ingredients.push({
          rawMaterialId,
          materialName: raw.name,
          quantity,
          unit: raw.unit,
          cost: raw.costPerUnit * quantity,
        });
      } else if (line.ingredientType === 'product') {
        const source = productMetaBySku[line.ingredientSku];
        const sourceProductId = productIdBySku[line.ingredientSku];
        if (!source || !sourceProductId) {
          throw new Error(`Unknown or out-of-order product ingredient ${line.ingredientSku} for ${row.sku}`);
        }
        const cost = lineCost('product', quantity, materialBySku, productMetaBySku, line.ingredientSku);
        normalizedMaterials.push({ productId: sourceProductId, quantity });
        ingredients.push({
          productId: sourceProductId,
          sourceProductSku: line.ingredientSku,
          materialName: source.name,
          quantity,
          unit: source.outputUnit,
          cost,
          isSemiFinished: true,
        });
      } else {
        throw new Error(`Invalid ingredientType "${line.ingredientType}" on ${row.sku}`);
      }
    }

    const recipeRef = db.collection('recipes').doc();
    const productRef = db.collection('products').doc();
    const composedRef = db.collection('composedProducts').doc();

    const recipeData = {
      name: lines[0].recipeName || row.name,
      sku: row.sku.replace('PROD', 'REC'),
      description: `Recipe for ${row.name}`,
      ingredients,
      materials: normalizedMaterials,
      outputQuantity,
      outputYield: outputQuantity,
      yieldQuantity: outputQuantity,
      outputUnit,
      yieldUnit: outputUnit,
      totalCost,
      costPerUnit: totalCost / (outputQuantity || 1),
      storeId: STORE_ID,
      createdAt,
      updatedAt: createdAt,
    };

    const ownerReferencePrice = num(row.ownerReferencePrice || row.price);
    const productData = {
      name: row.name,
      sku: row.sku,
      description: row.description || `${row.icon || '🍽️'} ${row.category}`,
      productionNotes: row.productionNotes || undefined,
      category: row.category,
      icon: row.icon || '🍽️',
      price: 0,
      ownerReferencePrice: ownerReferencePrice || undefined,
      costPrice: totalCost,
      serviceCost: 0,
      productType: 'composed',
      inStock: String(row.inStock).toLowerCase() !== 'false',
      stock: 0,
      deliveryTime: row.deliveryTime || '20-30 min',
      recipeId: recipeRef.id,
      storeId: STORE_ID,
      createdAt,
      updatedAt: createdAt,
    };

    const composedData = {
      productId: productRef.id,
      recipeId: recipeRef.id,
      sellingPrice: 0,
      ownerReferencePrice: ownerReferencePrice || undefined,
      costPrice: totalCost,
      serviceCost: 0,
      category: row.category,
      icon: row.icon || '🍽️',
      storeId: STORE_ID,
      createdAt,
      updatedAt: createdAt,
    };

    const batch = db.batch();
    batch.set(recipeRef, recipeData);
    batch.set(productRef, productData);
    batch.set(composedRef, composedData);
    await batch.commit();

    productIdBySku[row.sku] = productRef.id;
    productsCreated += 1;
  }

  const [p, r, m, c] = await Promise.all([
    db.collection('products').where('storeId', '==', STORE_ID).get(),
    db.collection('recipes').where('storeId', '==', STORE_ID).get(),
    db.collection('rawMaterials').where('storeId', '==', STORE_ID).get(),
    db.collection('composedProducts').where('storeId', '==', STORE_ID).get(),
  ]);

  console.log(`\n✅ Imported Jinan's Kitchen catalog for ${STORE_EMAIL}`);
  console.log(`   rawMaterials: ${m.size}, recipes: ${r.size}, products: ${p.size}, composedProducts: ${c.size}`);
  console.log(`   composed products created: ${productsCreated}`);
  console.log('   nested links: dough->pizza, empty croissant->almond/date croissants, cashew cream->sauces');
}

main().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
