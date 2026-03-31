const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();
const STORE_ID = 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';

const round4 = (value) => Math.round((value + Number.EPSILON) * 10000) / 10000;

function getEffectiveUnitCost(po, item) {
  const taxType = po.taxType || 'none';
  const subtotal = Number(po.subtotal || 0);
  const taxAmount = Number(po.taxAmount || po.vat || 0);
  const derivedTaxRate = Number(po.taxRate || (subtotal > 0 ? (taxAmount / subtotal) * 100 : 0));
  const taxRate = Number.isFinite(derivedTaxRate) && derivedTaxRate > 0 ? derivedTaxRate : 0;

  const base = Number(item.unitCost || item.unitPrice || 0);
  if (!Number.isFinite(base) || base <= 0) return 0;

  if (taxType === 'VAT' && taxRate > 0) {
    return round4(base * (1 + taxRate / 100));
  }

  return round4(base);
}

async function run() {
  const [poSnap, rmSnap] = await Promise.all([
    db.collection('purchases').where('storeId', '==', STORE_ID).where('status', '==', 'received').get(),
    db.collection('rawMaterials').where('storeId', '==', STORE_ID).get(),
  ]);

  const rawById = {};
  rmSnap.docs.forEach(d => {
    rawById[d.id] = { id: d.id, ...d.data() };
  });

  const aggregate = {}; // rawMaterialId -> { qty, value, vatQty, noVatQty, ttcQty, names:Set }

  poSnap.docs.forEach(doc => {
    const po = doc.data();
    const items = Array.isArray(po.items) ? po.items : [];

    items.forEach(item => {
      const materialId = item.rawMaterialId;
      if (!materialId) return;

      const qty = Number(item.receivedQuantity || item.quantity || 0);
      if (!Number.isFinite(qty) || qty <= 0) return;

      const effUnitCost = getEffectiveUnitCost(po, item);
      if (!Number.isFinite(effUnitCost) || effUnitCost <= 0) return;

      if (!aggregate[materialId]) {
        aggregate[materialId] = {
          qty: 0,
          value: 0,
          vatQty: 0,
          noVatQty: 0,
          ttcQty: 0,
          names: new Set(),
        };
      }

      aggregate[materialId].qty += qty;
      aggregate[materialId].value += qty * effUnitCost;
      aggregate[materialId].names.add(item.materialName || rawById[materialId]?.name || materialId);

      const taxType = po.taxType || 'none';
      if (taxType === 'VAT') aggregate[materialId].vatQty += qty;
      else if (taxType === 'TTC') aggregate[materialId].ttcQty += qty;
      else aggregate[materialId].noVatQty += qty;
    });
  });

  console.log('\n' + '='.repeat(90));
  console.log(' RECEIVED PURCHASE COST MODE AUDIT (NIPCO)');
  console.log(' Rule: VAT => add tax to cost, TTC/none => keep entered cost');
  console.log('='.repeat(90));

  const ids = Object.keys(aggregate).sort((a, b) => {
    const na = rawById[a]?.name || '';
    const nb = rawById[b]?.name || '';
    return na.localeCompare(nb);
  });

  ids.forEach(id => {
    const agg = aggregate[id];
    const expectedCost = agg.qty > 0 ? round4(agg.value / agg.qty) : 0;
    const storedCost = round4(Number(rawById[id]?.costPerUnit || 0));
    const diff = round4(expectedCost - storedCost);
    const mode = agg.vatQty > 0 && agg.noVatQty === 0 && agg.ttcQty === 0
      ? 'VAT-only'
      : agg.noVatQty > 0 && agg.vatQty === 0 && agg.ttcQty === 0
      ? 'NoVAT-only'
      : agg.ttcQty > 0 && agg.vatQty === 0 && agg.noVatQty === 0
      ? 'TTC-only'
      : 'Mixed';

    const name = rawById[id]?.name || Array.from(agg.names)[0] || id;
    const status = Math.abs(diff) <= 0.0001 ? 'OK' : 'MISMATCH';

    console.log(`\n- ${name}`);
    console.log(`  mode=${mode} | qty=${round4(agg.qty)} (VAT:${round4(agg.vatQty)}, noVAT:${round4(agg.noVatQty)}, TTC:${round4(agg.ttcQty)})`);
    console.log(`  stored=${storedCost} | expectedByReceivedPO=${expectedCost} | diff=${diff >= 0 ? '+' : ''}${diff}  [${status}]`);
  });

  console.log('\n' + '='.repeat(90) + '\n');
}

run().catch(err => {
  console.error(err.message);
  process.exit(1);
});
