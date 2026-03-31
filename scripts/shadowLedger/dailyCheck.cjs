/**
 * Shadow Ledger — Daily Check
 * ────────────────────────────
 * Every day, this script:
 *   1. Loads the baseline (physical count from 2026-03-31)
 *   2. Reads every NIPCO purchase / production / sale that happened AFTER the baseline
 *   3. Computes expected stock INDEPENDENTLY (pure math, outside the app system)
 *   4. Reads the actual values the app currently stores
 *   5. Compares expected vs actual — any gap = bug caught before the client reports it
 *   6. Writes a report to Firestore → shadowLedger/dailyChecks/{YYYY-MM-DD}
 *
 * Usage:
 *   node scripts/shadowLedger/dailyCheck.cjs            ← print report, no write
 *   node scripts/shadowLedger/dailyCheck.cjs --save     ← also save to Firestore
 *   node scripts/shadowLedger/dailyCheck.cjs --save --quiet  ← only print issues
 */

const admin = require('firebase-admin');
const path  = require('path');

admin.initializeApp({ credential: admin.credential.cert(require('../../serviceAccountKey.json')) });
const db = admin.firestore();

const STORE_ID   = 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';
const SAVE       = process.argv.includes('--save');
const QUIET      = process.argv.includes('--quiet');
const TODAY      = new Date().toISOString().slice(0, 10);
// Tolerance: differences smaller than this are treated as rounding noise
const TOLERANCE  = 0.05;

const r3 = n => Math.round(Number(n) * 1000) / 1000;

// ─── helpers ─────────────────────────────────────────────────────────────────

function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object' && typeof v.toDate === 'function') return v.toDate();
  if (typeof v === 'object' && typeof v.seconds === 'number') return new Date(v.seconds * 1000);
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function isAfter(value, cutoff) {
  const d = toDate(value);
  if (!d) return false;
  return d > cutoff;
}

// Picks the most reliable "event occurred at" timestamp from a doc
function eventDate(data) {
  return toDate(data.completionDate)
      || toDate(data.receivedDate)
      || toDate(data.deliveredAt)
      || toDate(data.updatedAt)
      || toDate(data.createdAt);
}

// ─── main ────────────────────────────────────────────────────────────────────

async function run() {
  const startMs = Date.now();
  const checkTimestamp = new Date().toISOString();

  console.log('\n' + '='.repeat(76));
  console.log('  Shadow Ledger — Daily Check    ' + TODAY);
  console.log('  Store: ' + STORE_ID);
  console.log('='.repeat(76));

  // ── 1. Load baseline ───────────────────────────────────────────────────────
  const baselineSnap = await db.collection('shadowLedger').doc('nipco-active-baseline').get();
  if (!baselineSnap.exists) {
    console.error('\n❌ No baseline found. Run seedBaseline.cjs first.');
    process.exit(1);
  }
  const baseline = baselineSnap.data();
  const baselineDate = new Date(baseline.date + 'T23:59:59.000Z'); // end of that day

  console.log('\n  Baseline: ' + baseline.date + '  (checking events after ' + baselineDate.toISOString() + ')');

  // Build maps: docId → expected value (start from baseline)
  const fgExpected   = new Map(); // docId → { name, expected (units) }
  const rmExpected   = new Map(); // docId → { name, expected (kg) }

  // Also need productId → FG docId mapping (built below from live FG docs)
  const productIdToFgDocId = new Map();
  // And rmDocId → name map
  const rmDocIdToName = new Map();

  baseline.finishedGoods.forEach(r => {
    fgExpected.set(r.docId, { name: r.name, expected: r.units, docId: r.docId });
  });
  baseline.rawMaterials.forEach(r => {
    rmExpected.set(r.docId, { name: r.name, expected: r.kg, docId: r.docId });
    rmDocIdToName.set(r.docId, r.name);
  });

  // ── 2. Load live FG docs to build productId → fgDocId map ─────────────────
  const fgSnap = await db.collection('finishedGoodsInventory')
    .where('storeId', '==', STORE_ID).get();

  fgSnap.docs.forEach(d => {
    const data = d.data();
    const pid = data.productId || data.composedProductId;
    if (pid) productIdToFgDocId.set(pid, d.id);
  });

  // ── 3. Load recipes (for production math) ─────────────────────────────────
  const recipesSnap = await db.collection('recipes')
    .where('storeId', '==', STORE_ID).get();
  const recipeMap = new Map(); // recipeId → { outputQuantity, ingredients: [{rawMaterialId, quantity}] }
  recipesSnap.docs.forEach(d => recipeMap.set(d.id, d.data()));

  // ── 4. Load all purchases ─────────────────────────────────────────────────
  const purchasesSnap = await db.collection('purchases')
    .where('storeId', '==', STORE_ID)
    .where('status', '==', 'received')
    .get();

  let purchasesProcessed = 0;
  const purchaseLog = [];

  purchasesSnap.docs.forEach(d => {
    const p       = d.data();
    const evtDate = eventDate(p);
    if (!isAfter(evtDate, baselineDate)) return;

    const items = Array.isArray(p.items) ? p.items : [];
    items.forEach(item => {
      const rmId  = item.rawMaterialId || item.materialId || '';
      const qty   = Number(item.receivedQuantity || item.quantity || 0);
      if (!rmId || qty <= 0) return;
      if (!rmExpected.has(rmId)) return; // not a tracked material

      const s = rmExpected.get(rmId);
      s.expected = r3(s.expected + qty);
      purchasesProcessed++;
      purchaseLog.push({
        po: p.poNumber || p.invoiceNumber || d.id.slice(-8),
        date: (evtDate || new Date()).toISOString().slice(0, 10),
        material: s.name,
        qty: '+' + qty,
      });
    });
  });

  // ── 5. Load all production batches ────────────────────────────────────────
  const batchesSnap = await db.collection('productionBatches')
    .where('storeId', '==', STORE_ID)
    .where('status', '==', 'completed')
    .get();

  let batchesProcessed = 0;
  const productionLog = [];

  batchesSnap.docs.forEach(d => {
    const b       = d.data();
    const evtDate = eventDate(b);
    if (!isAfter(evtDate, baselineDate)) return;

    const actualQty = Number(b.actualQuantity || b.quantity || 0);
    if (actualQty <= 0) return;

    // Raw materials consumed
    const materialsList = Array.isArray(b.materialsUsed) && b.materialsUsed.length > 0
      ? b.materialsUsed            // preferred: stored on the batch
      : computeIngredientsFromRecipe(b.recipeId, actualQty); // fallback

    materialsList.forEach(m => {
      const rmId     = m.rawMaterialId || m.materialId || '';
      const consumed = Number(m.quantityUsed || 0);
      if (!rmId || consumed <= 0) return;
      if (!rmExpected.has(rmId)) return;

      const s = rmExpected.get(rmId);
      s.expected = r3(s.expected - consumed);
    });

    // Finished goods produced
    const productId = b.productId || b.composedProductId || '';
    const fgDocId   = productId ? productIdToFgDocId.get(productId) : null;
    if (fgDocId && fgExpected.has(fgDocId)) {
      const s = fgExpected.get(fgDocId);
      s.expected = r3(s.expected + actualQty);
    }

    batchesProcessed++;
    productionLog.push({
      batch: b.batchNumber || d.id.slice(-8),
      date: (evtDate || new Date()).toISOString().slice(0, 10),
      product: b.productName || productId || '?',
      qty: actualQty,
    });
  });

  // helper: compute expected consumption from recipe when materialsUsed is missing
  function computeIngredientsFromRecipe(recipeId, actualQty) {
    if (!recipeId) return [];
    const recipe = recipeMap.get(recipeId);
    if (!recipe) return [];
    const outputQty = Number(recipe.outputQuantity || 1);
    const safe      = outputQty > 0 ? outputQty : 1;
    return (recipe.ingredients || []).map(ing => ({
      rawMaterialId: ing.rawMaterialId,
      quantityUsed: r3((Number(ing.quantity || 0) * actualQty) / safe),
    }));
  }

  // ── 6. Load all sales (delivered + paid orders) ───────────────────────────
  const ordersSnap = await db.collection('orders')
    .where('storeId', '==', STORE_ID)
    .get();

  const SALE_STATUSES = new Set(['delivered', 'paid', 'completed']);
  let salesProcessed = 0;
  const salesLog = [];

  ordersSnap.docs.forEach(d => {
    const o       = d.data();
    const evtDate = eventDate(o);
    if (!SALE_STATUSES.has(o.status)) return;
    if (!isAfter(evtDate, baselineDate)) return;

    const items = Array.isArray(o.items) ? o.items : [];
    items.forEach(item => {
      const productId = item.productId || item.composedProductId || item.id || '';
      const qty       = Number(item.quantity || 0);
      if (!productId || qty <= 0) return;

      const fgDocId = productIdToFgDocId.get(productId);
      if (!fgDocId || !fgExpected.has(fgDocId)) return;

      const s = fgExpected.get(fgDocId);
      s.expected = r3(s.expected - qty);
      salesProcessed++;
    });

    salesLog.push({
      invoice: o.invoiceNumber || d.id.slice(-8),
      date: (evtDate || new Date()).toISOString().slice(0, 10),
      status: o.status,
      items: (Array.isArray(o.items) ? o.items : []).length,
    });
  });

  // ── 7. Read actual system values ──────────────────────────────────────────
  const actualFg = new Map();
  fgSnap.docs.forEach(d => {
    if (fgExpected.has(d.id)) {
      actualFg.set(d.id, r3(Number(d.data().currentBalance ?? 0)));
    }
  });

  const rmSnap = await db.collection('rawMaterials')
    .where('storeId', '==', STORE_ID).get();
  const actualRm = new Map();
  rmSnap.docs.forEach(d => {
    if (rmExpected.has(d.id)) {
      actualRm.set(d.id, r3(Number(d.data().currentStock ?? 0)));
    }
  });

  // ── 8. Compare & build report ─────────────────────────────────────────────
  const fgIssues   = [];
  const fgOk       = [];
  const rmIssues   = [];
  const rmOk       = [];

  fgExpected.forEach((s, docId) => {
    const actual  = actualFg.get(docId) ?? null;
    const delta   = actual !== null ? r3(actual - s.expected) : null;
    const row     = { docId, name: s.name, expected: s.expected, actual, delta };
    if (delta === null || Math.abs(delta) > TOLERANCE) fgIssues.push(row);
    else fgOk.push(row);
  });

  rmExpected.forEach((s, docId) => {
    const actual  = actualRm.get(docId) ?? null;
    const delta   = actual !== null ? r3(actual - s.expected) : null;
    const row     = { docId, name: s.name, expected: r3(s.expected), actual, delta };
    if (delta === null || Math.abs(delta) > TOLERANCE) rmIssues.push(row);
    else rmOk.push(row);
  });

  const allClear = fgIssues.length === 0 && rmIssues.length === 0;

  // ── 9. Print report ───────────────────────────────────────────────────────
  if (!QUIET || !allClear) {

    if (!QUIET) {
      console.log('\n  ─── Events since baseline (' + baseline.date + ') ─────────────────────────');
      console.log('  Purchases received : ' + purchasesProcessed + ' line items across ' + purchasesSnap.docs.length + ' POs checked');
      console.log('  Production batches : ' + batchesProcessed + ' completed');
      console.log('  Sales/deliveries   : ' + salesLog.length + ' orders | ' + salesProcessed + ' FG line items');
    }

    const printRow = (label, expected, actual, delta, unit) => {
      const sign   = delta > 0 ? '+' : '';
      const status = delta === null ? '⚠️  ACTUAL MISSING'
                   : Math.abs(delta) <= TOLERANCE ? '✅ OK'
                   : delta > 0 ? '⬆️  system HIGH by ' + sign + delta + ' ' + unit
                   : '⬇️  system LOW by '  + delta + ' ' + unit;
      console.log(`  ${label.padEnd(38)} exp:${String(expected).padStart(8)} ${unit.padEnd(5)} act:${String(actual ?? '?').padStart(8)} ${unit.padEnd(5)}  ${status}`);
    };

    console.log('\n  ─── Finished Goods (units) ──────────────────────────────────────────');
    [...fgIssues, ...fgOk].forEach(r => printRow(r.name, r.expected, r.actual, r.delta, 'unit'));

    console.log('\n  ─── Raw Materials (kg) ──────────────────────────────────────────────');
    [...rmIssues, ...rmOk].forEach(r => printRow(r.name, r.expected, r.actual, r.delta, 'kg'));

    console.log('\n' + '='.repeat(76));
    if (allClear) {
      console.log('  ✅  ALL VALUES MATCH  — No issues found.');
    } else {
      console.log('  ❌  ISSUES FOUND:');
      fgIssues.forEach(r => {
        const d = r.delta;
        const dir = d === null ? 'MISSING' : d > 0 ? 'system is HIGH by +' + d : 'system is LOW by '  + d;
        console.log(`      FG  ${r.name}: ${dir} unit`);
      });
      rmIssues.forEach(r => {
        const d = r.delta;
        const dir = d === null ? 'MISSING' : d > 0 ? 'system is HIGH by +' + d : 'system is LOW by '  + d;
        console.log(`      RM  ${r.name}: ${dir} kg`);
      });
    }
    console.log('='.repeat(76));
  }

  // ── 10. Save to Firestore ─────────────────────────────────────────────────
  if (SAVE) {
    const report = {
      storeId:        STORE_ID,
      checkDate:      TODAY,
      checkTimestamp,
      baselineDate:   baseline.date,
      eventsWindow:   { from: baselineDate.toISOString(), to: checkTimestamp },
      eventsSummary: {
        purchaseLineItems:   purchasesProcessed,
        productionBatches:   batchesProcessed,
        saleOrders:          salesLog.length,
        saleFgLineItems:     salesProcessed,
      },
      status:         allClear ? 'PASS' : 'FAIL',
      totalIssues:    fgIssues.length + rmIssues.length,
      finishedGoods: {
        issues: fgIssues,
        ok:     fgOk,
      },
      rawMaterials: {
        issues: rmIssues,
        ok:     rmOk,
      },
      logs: {
        purchases:  purchaseLog,
        production: productionLog,
        sales:      salesLog.slice(0, 100), // cap to avoid huge docs
      },
      durationMs: Date.now() - startMs,
    };

    await db.collection('shadowLedger')
      .doc('nipco-daily-checks')
      .collection('checks')
      .doc(TODAY)
      .set(report);

    // Also overwrite the "latest" shortcut
    await db.collection('shadowLedger').doc('nipco-latest-check').set(report);

    console.log('\n  💾 Saved → shadowLedger/nipco-daily-checks/checks/' + TODAY);
    console.log('  💾 Saved → shadowLedger/nipco-latest-check\n');
  }

  if (!allClear) process.exit(2); // non-zero exit so cron jobs can detect failure
  process.exit(0);
}

run().catch(e => { console.error('❌ dailyCheck failed:', e.message); process.exit(1); });
