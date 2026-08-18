#!/usr/bin/env node
/**
 * Apply Jinan opening stock from jinan/opening_stock.csv
 * Updates jinan/raw_materials.csv, jinan/stock_count.csv, and optionally Firestore.
 *
 *   node scripts/importJinanOpeningStock.cjs           # dry-run
 *   node scripts/importJinanOpeningStock.cjs --write   # apply CSV + Firestore
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
    const values = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === ',' && !inQuotes) {
        values.push(cur);
        cur = '';
        continue;
      }
      cur += ch;
    }
    values.push(cur);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = (values[i] ?? '').trim();
    });
    return row;
  });
}

function readCsv(filename) {
  return parseCsv(fs.readFileSync(path.join(DATA_DIR, filename), 'utf8'));
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function escapeCsv(value) {
  const s = String(value ?? '');
  return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
}

function main() {
  const opening = readCsv('opening_stock.csv');
  const materials = readCsv('raw_materials.csv');
  const bySku = new Map(materials.map((m) => [m.sku, { ...m }]));

  const pending = [];
  const mismatches = [];
  let updated = 0;

  for (const row of opening) {
    const material = bySku.get(row.sku);
    if (!material) {
      mismatches.push(`${row.sku}: not in raw_materials.csv`);
      continue;
    }
    if (row.status === 'pending') {
      pending.push(`${row.line}. ${row.sku} ${row.name}`);
      continue;
    }
    if (material.unit !== row.unit) {
      mismatches.push(`${row.sku}: unit mismatch csv=${material.unit} opening=${row.unit}`);
    }
    const stock = num(row.currentStock, 0);
    if (num(material.currentStock, 0) !== stock) {
      material.currentStock = String(stock);
      updated += 1;
    }
    bySku.set(row.sku, material);
  }

  const nextMaterials = materials.map((m) => bySku.get(m.sku) || m);
  const stockCount = nextMaterials.map((m) => ({
    sku: m.sku,
    name: m.name,
    unit: m.unit,
    currentStock: m.currentStock,
  }));

  console.log(`Opening stock rows: ${opening.length}`);
  console.log(`Materials to update: ${updated}`);
  if (pending.length) {
    console.log('\nPending (left at 0 until owner confirms):');
    pending.forEach((p) => console.log(`  - ${p}`));
  }
  if (mismatches.length) {
    console.log('\nWarnings:');
    mismatches.forEach((m) => console.log(`  - ${m}`));
  }

  console.log('\nSample updates:');
  opening
    .filter((r) => r.status === 'confirmed' && num(r.currentStock) > 0)
    .slice(0, 8)
    .forEach((r) => console.log(`  ${r.sku} ${r.name}: ${r.currentStock} ${r.unit} (${r.rawReading})`));

  if (!write) {
    console.log('\nDry-run only. Re-run with --write to apply CSV + Firestore.');
    return { nextMaterials, stockCount, opening };
  }

  const matHeader =
    'sku,name,packSize,packPriceUSD,unit,costPerUnit,currentStock,minimumThreshold,reorderPoint,storageLocation';
  const matBody = nextMaterials
    .map((m) =>
      [
        m.sku,
        escapeCsv(m.name),
        escapeCsv(m.packSize),
        m.packPriceUSD,
        m.unit,
        m.costPerUnit,
        m.currentStock,
        m.minimumThreshold,
        m.reorderPoint,
        m.storageLocation,
      ].join(','),
    )
    .join('\n');
  fs.writeFileSync(path.join(DATA_DIR, 'raw_materials.csv'), `${matHeader}\n${matBody}\n`);

  const scHeader = 'sku,name,unit,currentStock';
  const scBody = stockCount
    .map((r) => [r.sku, escapeCsv(r.name), r.unit, r.currentStock].join(','))
    .join('\n');
  fs.writeFileSync(path.join(DATA_DIR, 'stock_count.csv'), `${scHeader}\n${scBody}\n`);

  console.log('\nWrote jinan/raw_materials.csv and jinan/stock_count.csv');
  return { nextMaterials, stockCount, opening };
}

async function writeFirestore(openingRows) {
  const saPath = path.join(process.cwd(), 'serviceAccountKey.json');
  if (!fs.existsSync(saPath)) throw new Error('Missing serviceAccountKey.json');
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(require(saPath)) });
  }
  const db = admin.firestore();
  const snap = await db.collection('rawMaterials').where('storeId', '==', STORE_ID).get();
  const bySku = new Map();
  snap.docs.forEach((doc) => {
    const sku = doc.data().sku;
    if (sku) bySku.set(sku, doc);
  });

  const confirmed = openingRows.filter((r) => r.status === 'confirmed');
  let batch = db.batch();
  let ops = 0;
  let applied = 0;
  const now = new Date().toISOString();

  for (const row of confirmed) {
    const doc = bySku.get(row.sku);
    if (!doc) {
      console.warn(`  Firestore missing: ${row.sku}`);
      continue;
    }
    batch.update(doc.ref, {
      currentStock: num(row.currentStock, 0),
      openingStockAppliedAt: now,
      openingStockNote: row.rawReading || null,
      updatedAt: now,
    });
    applied += 1;
    ops += 1;
    if (ops >= 400) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }
  if (ops) await batch.commit();
  console.log(`Firestore currentStock updated for ${applied} materials (store ${STORE_ID})`);
}

(async () => {
  const result = main();
  if (write && result) {
    await writeFirestore(result.opening);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
