/**
 * Audit Purchase Order costs vs current raw material costPerUnit
 * Shows every purchased material, its PO unit cost, VAT fields, and
 * how it compares to what is stored in rawMaterials.costPerUnit
 */
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();
const STORE_ID = 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';

async function run() {
  // Fetch purchases
  const posSnap = await db.collection('purchases').where('storeId', '==', STORE_ID).get();

  // Fetch current raw material costPerUnit keyed by id and name
  const rmSnap = await db.collection('rawMaterials').where('storeId', '==', STORE_ID).get();
  const rmById = {};
  const rmByName = {};
  rmSnap.docs.forEach(d => {
    rmById[d.id] = d.data();
    rmByName[(d.data().name || '').toLowerCase().trim()] = { id: d.id, ...d.data() };
  });

  // Group PO line items by raw material
  const byMaterial = {}; // key = rawMaterialId or name

  posSnap.docs.forEach(d => {
    const po = d.data();
    const items = Array.isArray(po.items) ? po.items : [];
    items.forEach(item => {
      const rmId = item.rawMaterialId || item.materialId || '';
      const rmName = item.materialName || item.rawMaterialName || item.name || rmById[rmId]?.name || rmId || '?';
      const key = rmId || rmName;

      if (!byMaterial[key]) {
        byMaterial[key] = { name: rmName, id: rmId, entries: [] };
      }

      byMaterial[key].entries.push({
        poNumber: po.poNumber || po.invoiceNumber || d.id.slice(-8),
        date: (po.createdAt || po.date || '').toString().slice(0, 10),
        status: po.status || '?',
        unitCost: item.unitCost || item.unitPrice || 0,
        vatRate: item.vatRate !== undefined ? item.vatRate
                  : (item.vat !== undefined ? item.vat
                  : (po.vatRate !== undefined ? po.vatRate : null)),
        qty: item.quantity || item.receivedQuantity || 0,
        unit: item.unit || '',
        totalCost: item.totalCost || 0,
      });
    });
  });

  console.log('\n' + '='.repeat(80));
  console.log('  PURCHASE COST AUDIT vs STORED RAW MATERIAL COST — NIPCO');
  console.log('='.repeat(80) + '\n');

  const sorted = Object.values(byMaterial).sort((a, b) => a.name.localeCompare(b.name));

  for (const mat of sorted) {
    const stored = rmById[mat.id] || rmByName[(mat.name || '').toLowerCase().trim()];
    const storedCost = stored?.costPerUnit;

    console.log(`  📦 ${mat.name}`);
    if (storedCost !== undefined) {
      console.log(`     Current stored costPerUnit : $${storedCost}`);
    } else {
      console.log(`     Current stored costPerUnit : ⚠️  NOT FOUND in rawMaterials`);
    }

    mat.entries.sort((a, b) => a.date.localeCompare(b.date)).forEach(e => {
      const vatStr = e.vatRate !== null ? `VAT:${e.vatRate}%` : 'VAT:not stored';
      const vatIncl = e.vatRate ? `  → with VAT: $${(e.unitCost * (1 + e.vatRate / 100)).toFixed(4)}` : '';
      const match = storedCost !== undefined
        ? (Math.abs(e.unitCost - storedCost) < 0.001 ? '✅ matches stored'
            : e.vatRate && Math.abs(e.unitCost * (1 + e.vatRate / 100) - storedCost) < 0.001 ? '✅ stored=+VAT'
            : `⚠️  stored=$${storedCost}`)
        : '';
      console.log(`     PO:${e.poNumber.padEnd(14)} ${e.date}  unitCost:$${e.unitCost}  ${vatStr}${vatIncl}  qty:${e.qty}${e.unit}  ${match}`);
    });
    console.log();
  }

  process.exit(0);
}

run().catch(e => { console.error(e.message); process.exit(1); });
