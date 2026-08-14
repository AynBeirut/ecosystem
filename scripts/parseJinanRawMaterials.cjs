#!/usr/bin/env node
/**
 * Parse Jinan's Kitchen raw materials from Grabio Numbers / xlsx export.
 * Owner format: col B = pack size (e.g. "25 kg"), col C = pack price (e.g. "45$").
 *
 * Usage:
 *   node scripts/parseJinanRawMaterials.cjs [path/to/file.numbers]
 *   node scripts/parseJinanRawMaterials.cjs --write-csv
 *   node scripts/parseJinanRawMaterials.cjs --write-csv --import
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DEFAULT_NUMBERS = path.join(
  process.cwd(),
  'jinan/image data/raw matirial /Grabio-RawMaterials-Template.numbers',
);
const OUT_CSV = path.join(process.cwd(), 'jinan/raw_materials.csv');
const RECIPE_CSV = path.join(process.cwd(), 'jinan/recipe_ingredients.csv');
const STORE_ID = 'ujff7blWYvUvlekQOrybvNCnn9V2';

const writeCsv = process.argv.includes('--write-csv');
const doImport = process.argv.includes('--import');
const inputPath = process.argv.find((a) => !a.startsWith('-') && a.endsWith('.numbers')) || DEFAULT_NUMBERS;

const OLD_SKU_NAMES = {
  'JNK-MAT-00001': 'Cashew',
  'JNK-MAT-00002': 'Agar',
  'JNK-MAT-00003': 'Water',
  'JNK-MAT-00004': 'Salt',
  'JNK-MAT-00005': 'Almond',
  'JNK-MAT-00006': 'Lemon',
  'JNK-MAT-00007': 'Apple Molasses',
  'JNK-MAT-00008': 'Vanilla',
  'JNK-MAT-00009': 'Cacao',
  'JNK-MAT-00010': 'Whole Wheat Flour',
  'JNK-MAT-00011': 'Olive Oil',
  'JNK-MAT-00012': 'Tahini',
  'JNK-MAT-00013': 'Yeast',
  'JNK-MAT-00014': 'Starter',
  'JNK-MAT-00015': 'Barley Flour',
  'JNK-MAT-00016': 'Frozen Strawberry',
  'JNK-MAT-00017': 'Frozen Banana',
  'JNK-MAT-00018': 'Frozen Mixed Berries',
  'JNK-MAT-00019': 'Coconut Oil',
  'JNK-MAT-00020': 'Nutritional Yeast',
  'JNK-MAT-00021': 'Fresh Tomatoes',
  'JNK-MAT-00022': 'Pomegranate Sauce',
  'JNK-MAT-00023': 'Bicarbonate',
  'JNK-MAT-00024': 'Lemon Zest',
  'JNK-MAT-00025': 'Lemon Juice',
  'JNK-MAT-00026': 'Boiled Fava Beans',
  'JNK-MAT-00027': 'Boiled Chickpeas',
  'JNK-MAT-00028': 'Garlic',
  'JNK-MAT-00029': 'Chili Pepper',
  'JNK-MAT-00030': 'Tahini Dates Ball',
};

/** Recipe-only materials not yet on owner sheet — keep until confirmed. */
const SUPPLEMENTAL = [
  { name: 'Water', unit: 'liter', costPerUnit: 0.2, storageLocation: 'Pantry' },
  { name: 'Vanilla', unit: 'kg', costPerUnit: 50, storageLocation: 'Spice Rack' },
  { name: 'Yeast', unit: 'kg', costPerUnit: 8, storageLocation: 'Dry Storage' },
  { name: 'Starter', unit: 'kg', costPerUnit: 3, storageLocation: 'Fridge' },
  { name: 'Frozen Strawberry', unit: 'kg', costPerUnit: 7, storageLocation: 'Freezer' },
  { name: 'Frozen Banana', unit: 'kg', costPerUnit: 2.5, storageLocation: 'Freezer' },
  { name: 'Frozen Mixed Berries', unit: 'kg', costPerUnit: 10, storageLocation: 'Freezer' },
  { name: 'Pomegranate Sauce', unit: 'kg', costPerUnit: 8, storageLocation: 'Fridge' },
  { name: 'Bicarbonate', unit: 'kg', costPerUnit: 5, storageLocation: 'Dry Storage' },
  { name: 'Lemon Zest', unit: 'kg', costPerUnit: 20, storageLocation: 'Fridge' },
  { name: 'Lemon Juice', unit: 'liter', costPerUnit: 6, storageLocation: 'Fridge' },
  { name: 'Boiled Fava Beans', unit: 'kg', costPerUnit: 4, storageLocation: 'Fridge' },
  { name: 'Boiled Chickpeas', unit: 'kg', costPerUnit: 3, storageLocation: 'Fridge' },
  { name: 'Garlic', unit: 'kg', costPerUnit: 5, storageLocation: 'Veg Cooler' },
  { name: 'Chili Pepper', unit: 'kg', costPerUnit: 15, storageLocation: 'Veg Cooler' },
  { name: 'Tahini Dates Ball', unit: 'piece', costPerUnit: 0.2, storageLocation: 'Fridge' },
];

const NAME_ALIASES = {
  'whole wheat flour': 'Whole Wheat Flour',
  'olive oil': 'Olive Oil',
  'apple molasses': 'Apple Molasses',
  'organic coconut oil': 'Coconut Oil',
  'nutritional yeast': 'Nutritional Yeast',
  'tomato': 'Fresh Tomatoes',
  'almond  slices': 'Almond Slices',
  'almond slices': 'Almond Slices',
  'barley flour': 'Barley Flour',
  'fava beans': 'Fava Beans',
  'chickpeas': 'Chickpeas',
};

function normName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function titleName(name) {
  const n = normName(name);
  if (NAME_ALIASES[n]) return NAME_ALIASES[n];
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bKg\b/g, 'kg')
    .replace(/\bGr\b/g, 'gr');
}

function parseMoney(raw) {
  const n = Number(String(raw || '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function parsePack(raw) {
  const original = String(raw || '').trim();
  const s = original.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!s) return null;

  let m = s.match(/^([\d.]+)\s+sheets?\s*(?:\/\s*[\d.]+\s*(?:gr|g))?$/);
  if (m) return { qty: Number(m[1]), unit: 'piece', packLabel: original };

  m = s.match(/^([\d.]+)\s*(kg|kilos?|kgs)$/);
  if (m) return { qty: Number(m[1]), unit: 'kg', packLabel: original };

  m = s.match(/^([\d.]+)\s*(lit|liter|litre|l)$/);
  if (m) return { qty: Number(m[1]), unit: 'liter', packLabel: original };

  m = s.match(/^([\d.]+)\s*(gr|g|gram|grams)$/);
  if (m) return { qty: Number(m[1]), unit: 'gram', packLabel: original };

  m = s.match(/^([\d.]+)\s*(ml)$/);
  if (m) return { qty: Number(m[1]), unit: 'ml', packLabel: original };

  m = s.match(/^([\d.]+)\s*(pc|pcs|piece|pieces)$/);
  if (m) return { qty: Number(m[1]), unit: 'piece', packLabel: original };

  m = s.match(/^([\d.]+)(gr|g)$/);
  if (m) return { qty: Number(m[1]), unit: 'gram', packLabel: original };

  return null;
}

function readNumbersRows(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing ${filePath}`);
  const py = `
from numbers_parser import Document
import json, sys
doc = Document(sys.argv[1])
rows = []
for sheet in doc.sheets:
    if sheet.name.strip().lower() != 'raw materials':
        continue
    table = sheet.tables[0]
    for r in range(table.num_rows):
        row = [table.cell(r,c).value if table.cell(r,c).value is not None else '' for c in range(table.num_cols)]
        rows.append(row)
print(json.dumps(rows))
`;
  const venvPy = '/tmp/npvenv/bin/python3';
  const python = fs.existsSync(venvPy) ? venvPy : 'python3';
  const res = spawnSync(python, ['-c', py, filePath], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  if (res.status !== 0) {
    throw new Error(`numbers-parser failed: ${res.stderr || res.stdout}`);
  }
  return JSON.parse(res.stdout.trim());
}

function parseOwnerMaterials(rows) {
  const byName = new Map();
  for (const row of rows) {
    const name = String(row[0] || '').trim();
    const packRaw = row[1];
    const costRaw = row[2];
    const storage = String(row[6] || '').trim();
    if (!name || name.startsWith('GRABIO') || name.startsWith('Fill one') || name === 'Name' || name.startsWith('REQUIRED')) continue;
    const packCost = parseMoney(costRaw);
    const pack = parsePack(packRaw);
    if (!pack || !packCost) {
      console.warn('  skip (unparsed):', name, '|', packRaw, '|', costRaw);
      continue;
    }
    const costPerUnit = Number((packCost / pack.qty).toFixed(4));
    const entry = {
      name: titleName(name),
      unit: pack.unit,
      costPerUnit,
      ownerPackLabel: pack.packLabel,
      ownerPackCost: packCost,
      currentStock: 0,
      minimumThreshold: pack.unit === 'piece' ? 5 : pack.unit === 'gram' ? 100 : 1,
      reorderPoint: pack.unit === 'piece' ? 10 : pack.unit === 'gram' ? 200 : 3,
      storageLocation: storage || 'Pantry',
    };
    byName.set(normName(entry.name), entry);
  }
  return [...byName.values()];
}

function assignSkus(materials) {
  return materials.map((m, i) => ({
    ...m,
    sku: `JNK-MAT-${String(i + 1).padStart(5, '0')}`,
  }));
}

function mergeSupplemental(materials) {
  const have = new Set(materials.map((m) => normName(m.name)));
  const merged = [...materials];
  for (const s of SUPPLEMENTAL) {
    if (!have.has(normName(s.name))) {
      merged.push({
        currentStock: 0,
        minimumThreshold: 1,
        reorderPoint: 3,
        ownerPackLabel: '',
        ownerPackCost: '',
        ...s,
      });
    }
  }
  return merged;
}

function buildSkuByCanonicalName(materials) {
  const map = new Map();
  for (const m of materials) map.set(normName(m.name), m.sku);
  map.set(normName('Fresh Tomatoes'), map.get(normName('Tomato')) || map.get(normName('Fresh Tomatoes')));
  map.set(normName('Coconut Oil'), map.get(normName('Organic Coconut Oil')) || map.get(normName('Coconut Oil')));
  return map;
}

function remapRecipeSkus(materials) {
  if (!fs.existsSync(RECIPE_CSV)) return;
  const skuByName = buildSkuByCanonicalName(materials);
  const lines = fs.readFileSync(RECIPE_CSV, 'utf8').trim().split(/\r?\n/);
  const header = lines[0];
  const out = [header];
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cols = line.split(',');
    const oldSku = cols[5];
    const matName = OLD_SKU_NAMES[oldSku];
    if (matName && cols[4] === 'material') {
      const newSku = skuByName.get(normName(matName));
      if (newSku) cols[5] = newSku;
      else console.warn('  recipe mapping missing for', matName, oldSku);
    }
    out.push(cols.join(','));
  }
  fs.writeFileSync(RECIPE_CSV, `${out.join('\n')}\n`);
}

function toCsv(materials) {
  const header = 'sku,name,packSize,packPriceUSD,unit,costPerUnit,currentStock,minimumThreshold,reorderPoint,storageLocation';
  const body = materials.map((m) =>
    [
      m.sku,
      m.name.includes(',') ? `"${m.name}"` : m.name,
      m.ownerPackLabel ? `"${m.ownerPackLabel}"` : '',
      m.ownerPackCost || '',
      m.unit,
      String(m.costPerUnit),
      m.currentStock,
      m.minimumThreshold,
      m.reorderPoint,
      m.storageLocation.includes(',') ? `"${m.storageLocation}"` : m.storageLocation,
    ].join(','),
  );
  return `${header}\n${body.join('\n')}\n`;
}

async function importMaterials(materials) {
  const admin = require('firebase-admin');
  const saPath = path.join(process.cwd(), 'serviceAccountKey.json');
  const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
  }
  const db = admin.firestore();
  const snap = await db.collection('rawMaterials').where('storeId', '==', STORE_ID).get();
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = db.batch();
    snap.docs.slice(i, i + 400).forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
  const createdAt = new Date().toISOString();
  let n = 0;
  for (const m of materials) {
    await db.collection('rawMaterials').doc().set({
      name: m.name,
      sku: m.sku,
      unit: m.unit,
      costPerUnit: m.costPerUnit,
      ownerPackLabel: m.ownerPackLabel || null,
      ownerPackCost: m.ownerPackCost || null,
      currentStock: m.currentStock,
      minimumThreshold: m.minimumThreshold,
      reorderPoint: m.reorderPoint,
      storageLocation: m.storageLocation,
      expiryTracking: false,
      storeId: STORE_ID,
      createdAt,
      updatedAt: createdAt,
    });
    n += 1;
  }
  console.log(`Imported ${n} raw materials to Firestore (replaced ${snap.size} old).`);
}

function main() {
  console.log('Reading:', inputPath);
  const rows = readNumbersRows(inputPath);
  let materials = parseOwnerMaterials(rows);
  console.log(`Parsed ${materials.length} materials from Numbers sheet.`);
  materials = mergeSupplemental(materials);
  materials = assignSkus(materials);
  console.log(`Total with recipe supplements: ${materials.length}`);

  if (writeCsv || doImport) {
    fs.writeFileSync(OUT_CSV, toCsv(materials));
    remapRecipeSkus(materials);
    console.log('Wrote', OUT_CSV);
    console.log('Updated', RECIPE_CSV, 'SKUs');
  }

  console.log('\nSample:');
  materials.slice(0, 8).forEach((m) => {
    console.log(`  ${m.sku} ${m.name} | ${m.unit} @ ${m.costPerUnit} | pack ${m.ownerPackLabel} ${m.ownerPackCost || ''}`);
  });

  if (doImport) {
    return importMaterials(materials);
  }
  if (!writeCsv) {
    console.log('\nRun with --write-csv and/or --import');
  }
}

main().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
