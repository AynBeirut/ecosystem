/**
 * Quick daily activity check for y.malek (NIPCO) — 2026-04-01
 * Reads purchases, production batches, and orders from 2026-03-31 onwards
 * and validates against current Firestore stock values.
 */

const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('../serviceAccountKey.json')) });
const db = admin.firestore();

const STORE_ID    = 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';
const BASELINE_DT = new Date('2026-03-31T23:59:59.000Z');
const r3 = n => Math.round(Number(n) * 1000) / 1000;

function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object' && typeof v.toDate === 'function') return v.toDate();
  if (typeof v === 'object' && typeof v.seconds === 'number') return new Date(v.seconds * 1000);
  const d = new Date(v); return isNaN(d) ? null : d;
}
function after(v) { const d = toDate(v); return d && d > BASELINE_DT; }
function evtDate(data) {
  return toDate(data.completionDate) || toDate(data.receivedDate) ||
         toDate(data.deliveredAt) || toDate(data.updatedAt) || toDate(data.createdAt);
}

// Baseline values (as corrected 2026-03-31)
const rmBaseline = {
  'kPWepQNvyHlOZS03ZdSx': { name: '14 GSM 2PLY 80CM',              kg: 785   },
  'CPDd3KJjKm8dwVDyQQ9o': { name: '20 GSM 2PLY 80CM',              kg: 2029  },
  'omNntXGXd0CYgW59GKyg': { name: 'External Bag w/ Hand 40x90',    kg: 126.1 },
  'sreO1wan2vR8ftKszz5I': { name: 'External Bag w/ Hand 95x35',    kg: 75    },
  'NitmTPMiv0RUb0hxqXf9': { name: 'External Bag w/ Hand 40x110',   kg: 66.4  },
  'KMtX4iO3PtDJMDcNBO5z': { name: 'INTERFOLD 200G Internal Bag',   kg: 114   },
  'QUCkefY9LkkrfwOrihyr': { name: '300G Facial Internal Bag',      kg: 127   },
  'oUR9XVleCl8d2qQEjaNA': { name: '500g Facial Internal Bag',      kg: 138.6 },
  '21GG41A8bc4JWQybwYkk': { name: '200g Facial Internal Bag',      kg: 83.6  },
  'b44OHlJIIjrmvZ98zSzt': { name: 'External Bag 35x80',            kg: 53.1  },
  'EhdSZHptBnc8zCCyJ6P0': { name: 'INTERFOLD 300g Internal Bag',   kg: 158   },
};
const fgBaseline = {
  'QDqWbvWzmnpcnMeoptcJ': { name: 'INTERFOLD All Care 2Kg',        units: 197   },
  'TAIADVDOGW9qc3nqBfw7': { name: 'INTERFOLD All Care 3Kg',        units: 143   },
  'oH1xI5su9rKsX7YvumJn': { name: 'All Care Facial 2Kg',           units: 928.5 },
  'AUMG5bjCZJ5FUxQhhpEt': { name: 'All Care Facial 3Kg',           units: 288   },
  '7cboXdQaLnZR5hbXYQPV': { name: 'All Care Facial 5Kg',           units: 265   },
};

async function run() {
  console.log('\n' + '='.repeat(72));
  console.log('  NIPCO Daily Activity Check — 2026-04-01');
  console.log('  Baseline: 2026-03-31 (events after ' + BASELINE_DT.toISOString() + ')');
  console.log('='.repeat(72));

  // Copy baselines into working maps
  const rmExp = {};
  const fgExp = {};
  for (const [id, v] of Object.entries(rmBaseline)) rmExp[id] = { ...v, expected: v.kg };
  for (const [id, v] of Object.entries(fgBaseline)) fgExp[id] = { ...v, expected: v.units };

  // productId → fgDocId
  const pidToFgDoc = {};
  const fgLive = await db.collection('finishedGoodsInventory').where('storeId','==',STORE_ID).get();
  fgLive.docs.forEach(d => {
    const pid = d.data().productId || d.data().composedProductId;
    if (pid) pidToFgDoc[pid] = d.id;
  });

  // ── PURCHASES ─────────────────────────────────────────────────────────────
  const pSnap = await db.collection('purchases')
    .where('storeId','==',STORE_ID)
    .where('status','==','received')
    .get();

  const purchaseLogs = [];
  pSnap.docs.forEach(d => {
    const p = d.data();
    if (!after(evtDate(p))) return;
    (Array.isArray(p.items) ? p.items : []).forEach(item => {
      const rmId = item.rawMaterialId || item.materialId || '';
      const qty  = Number(item.receivedQuantity || item.quantity || 0);
      if (!rmId || qty <= 0 || !rmExp[rmId]) return;
      rmExp[rmId].expected = r3(rmExp[rmId].expected + qty);
      purchaseLogs.push({ date: (toDate(evtDate(p))||new Date()).toISOString().slice(0,10), material: rmExp[rmId].name, qty: '+'+qty });
    });
  });

  // ── PRODUCTION ────────────────────────────────────────────────────────────
  const bSnap = await db.collection('productionBatches')
    .where('storeId','==',STORE_ID)
    .where('status','==','completed')
    .get();

  const productionLogs = [];
  bSnap.docs.forEach(d => {
    const b = d.data();
    if (!after(evtDate(b))) return;
    const actualQty = Number(b.actualQuantity || b.quantity || 0);
    if (actualQty <= 0) return;

    (Array.isArray(b.materialsUsed) ? b.materialsUsed : []).forEach(m => {
      const rmId     = m.rawMaterialId || m.materialId || '';
      const consumed = Number(m.quantityUsed || 0);
      if (!rmId || consumed <= 0 || !rmExp[rmId]) return;
      rmExp[rmId].expected = r3(rmExp[rmId].expected - consumed);
    });

    const fgDocId = pidToFgDoc[b.productId || b.composedProductId || ''];
    if (fgDocId && fgExp[fgDocId]) fgExp[fgDocId].expected = r3(fgExp[fgDocId].expected + actualQty);

    productionLogs.push({
      date: (toDate(evtDate(b))||new Date()).toISOString().slice(0,10),
      product: b.productName || b.productId || '?',
      qty: actualQty,
      batch: b.batchNumber || d.id.slice(-6),
    });
  });

  // ── ORDERS (delivered/paid/completed, with date filter using updatedAt) ───
  const SALE_STATUSES = new Set(['delivered','paid','completed']);
  const oSnap = await db.collection('orders')
    .where('storeId','==',STORE_ID)
    .where('status','in',['delivered','paid','completed'])
    .get();

  const salesLogs = [];
  oSnap.docs.forEach(d => {
    const o = d.data();
    if (!after(evtDate(o))) return;
    (Array.isArray(o.items) ? o.items : []).forEach(item => {
      const productId = item.productId || item.composedProductId || item.id || '';
      const qty = Number(item.quantity || 0);
      if (!productId || qty <= 0) return;
      const fgDocId = pidToFgDoc[productId];
      if (!fgDocId || !fgExp[fgDocId]) return;
      fgExp[fgDocId].expected = r3(fgExp[fgDocId].expected - qty);
    });
    salesLogs.push({
      date: (toDate(evtDate(o))||new Date()).toISOString().slice(0,10),
      invoice: o.invoiceNumber || o.orderNumber || d.id.slice(-6),
      customer: o.customerName || o.deliveryAddress?.name || '?',
    });
  });

  // ── PRINT ACTIVITY ────────────────────────────────────────────────────────
  console.log('\n  📦 PURCHASES after baseline: ' + purchaseLogs.length + ' line(s)');
  if (purchaseLogs.length) {
    purchaseLogs.forEach(l => console.log('    ' + l.date + '  ' + l.material + '  ' + l.qty + ' kg'));
  } else { console.log('    — none'); }

  console.log('\n  🏭 PRODUCTION BATCHES after baseline: ' + productionLogs.length + ' batch(es)');
  if (productionLogs.length) {
    productionLogs.forEach(l => console.log('    ' + l.date + '  ' + l.product + '  qty=' + l.qty + '  batch=' + l.batch));
  } else { console.log('    — none'); }

  console.log('\n  🚚 ORDERS (delivered/paid/completed) after baseline: ' + salesLogs.length + ' order(s)');
  if (salesLogs.length) {
    salesLogs.forEach(l => console.log('    ' + l.date + '  #' + l.invoice + '  ' + l.customer));
  } else { console.log('    — none'); }

  // ── COMPARE EXPECTED vs ACTUAL ────────────────────────────────────────────
  const TOLERANCE = 0.05;
  const issues = [];

  console.log('\n  ' + '─'.repeat(68));
  console.log('  📊 FINISHED GOODS — Expected vs Actual\n');

  for (const [docId, s] of Object.entries(fgExp)) {
    const snap = await db.collection('finishedGoodsInventory').doc(docId).get();
    const actual = r3(Number(snap.data()?.currentBalance ?? snap.data()?.quantity ?? 0));
    const diff   = r3(actual - s.expected);
    const ok     = Math.abs(diff) <= TOLERANCE;
    const flag   = ok ? '✅' : '❌';
    console.log('    ' + flag + ' ' + s.name);
    console.log('       baseline=' + s.units + '  expected=' + s.expected + '  actual=' + actual + '  diff=' + (diff >= 0 ? '+' : '') + diff);
    if (!ok) issues.push({ type: 'FG', name: s.name, expected: s.expected, actual, diff });
  }

  console.log('\n  ' + '─'.repeat(68));
  console.log('  📊 RAW MATERIALS — Expected vs Actual\n');

  for (const [docId, s] of Object.entries(rmExp)) {
    const snap = await db.collection('rawMaterials').doc(docId).get();
    const actual = r3(Number(snap.data()?.currentStock ?? snap.data()?.quantity ?? 0));
    const diff   = r3(actual - s.expected);
    const ok     = Math.abs(diff) <= TOLERANCE;
    const flag   = ok ? '✅' : '❌';
    console.log('    ' + flag + ' ' + s.name);
    console.log('       baseline=' + s.kg + '  expected=' + s.expected + '  actual=' + actual + '  diff=' + (diff >= 0 ? '+' : '') + diff);
    if (!ok) issues.push({ type: 'RM', name: s.name, expected: s.expected, actual, diff });
  }

  // ── SUMMARY ───────────────────────────────────────────────────────────────
  console.log('\n  ' + '='.repeat(72));
  if (issues.length === 0) {
    console.log('  ✅  ALL CLEAR — Math checks out. No discrepancies found.');
  } else {
    console.log('  ❌  ' + issues.length + ' ISSUE(S) FOUND:\n');
    issues.forEach(i => {
      console.log('    ' + i.type + ' — ' + i.name);
      console.log('       expected=' + i.expected + '  actual=' + i.actual + '  diff=' + i.diff);
    });
  }
  console.log('  ' + '='.repeat(72) + '\n');

  process.exit(issues.length > 0 ? 2 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
