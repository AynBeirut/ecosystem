/**
 * Physical Count Audit — 2026-03-31
 * Compares system values vs physical count for NIPCO (y.malek@nip-lb.com / DfIhBAEZ5NR7yNX0HboZvv58Nf82)
 *
 * Physical counts provided:
 *   Finished Goods (units):
 *     Interfold 200 → 197
 *     Interfold 300 → 143
 *     Facial 200    → 928.5
 *     Facial 300    → 288
 *     Facial 500    → 265
 *
 *   Raw Materials (kg):
 *     External Bag 40x90    → 126.1
 *     External Bag 35x95    → 0.75
 *     External Bag 35x80    → 53.1
 *     External Bag 42x112   → 10
 *     External Bag 40x110   → 66.4
 *     Internal Bag 200 Interfold  → 114
 *     Internal Bag 300 Interfold  → 158
 *     Internal Bag 200 Facial     → 83.6
 *     Internal Bag 300 Facial     → 127
 *     Internal Bag 500 Facial     → 138.6
 *     14 GSM paper rolls    → 2141
 *     20 GSM paper rolls    → 5535
 *
 * Usage:
 *   node scripts/auditPhysicalCount2026-03-31.cjs
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();
const STORE_ID = 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';

// Physical counts — ground truth from client message (2026-03-31)
// Finished goods: units
const PHYSICAL_FG = [
  { label: 'Interfold 200',  physicalCount: 197,   keywords: ['interfold', '200', '2kg', '2 ply'] },
  { label: 'Interfold 300',  physicalCount: 143,   keywords: ['interfold', '300', '3kg'] },
  { label: 'Facial 200',     physicalCount: 928.5, keywords: ['facial', '200', '2kg'] },
  { label: 'Facial 300',     physicalCount: 288,   keywords: ['facial', '300', '3kg'] },
  { label: 'Facial 500',     physicalCount: 265,   keywords: ['facial', '500', '5kg'] },
];

// Raw materials: kg
const PHYSICAL_RM = [
  { label: 'External Bag 40x90',         physicalCount: 126.1,  keywords: ['40x90', '40*90', '40 x 90', '40×90'] },
  { label: 'External Bag 35x95',         physicalCount: 0.75,   keywords: ['35x95', '35*95', '35 x 95', '35×95'] },
  { label: 'External Bag 35x80',         physicalCount: 53.1,   keywords: ['35x80', '35*80', '35 x 80', '35×80'] },
  { label: 'External Bag 42x112',        physicalCount: 10,     keywords: ['42x112', '42*112', '42 x 112', '42×112'] },
  { label: 'External Bag 40x110',        physicalCount: 66.4,   keywords: ['40x110', '40*110', '40 x 110', '40×110'] },
  { label: 'Internal Bag Interfold 200', physicalCount: 114,    keywords: ['200', 'interfold', 'internal', 'تنشيف'] },
  { label: 'Internal Bag Interfold 300', physicalCount: 158,    keywords: ['300', 'interfold', 'internal', 'تنشيف'] },
  { label: 'Internal Bag Facial 200',    physicalCount: 83.6,   keywords: ['200', 'facial', 'internal', 'ناعم'] },
  { label: 'Internal Bag Facial 300',    physicalCount: 127,    keywords: ['300', 'facial', 'internal', 'ناعم'] },
  { label: 'Internal Bag Facial 500',    physicalCount: 138.6,  keywords: ['500', 'facial', 'internal', 'ناعم'] },
  { label: '14 GSM paper',               physicalCount: 2141,   keywords: ['14 gsm', '14gsm', '14 gm', '14gm', '14 g'] },
  { label: '20 GSM paper',               physicalCount: 5535,   keywords: ['20 gsm', '20gsm', '20 gm', '20gm', '20 g'] },
];

function round3(n) { return Math.round(n * 1000) / 1000; }

function nameMatch(name, keywords) {
  const lower = (name || '').toLowerCase();
  return keywords.some(k => lower.includes(k.toLowerCase()));
}

function printRow(label, systemVal, physicalVal, unit) {
  const delta = round3(physicalVal - systemVal);
  const pct = systemVal !== 0 ? ((delta / systemVal) * 100).toFixed(1) + '%' : 'N/A';
  const status = Math.abs(delta) < 0.01 ? '✅ OK' : delta > 0 ? '⬆️  UNDER (system low)' : '⬇️  OVER (system high)';
  console.log(
    `  ${label.padEnd(35)} | sys: ${String(round3(systemVal)).padStart(8)} ${unit.padEnd(5)} | phys: ${String(physicalVal).padStart(8)} ${unit.padEnd(5)} | Δ ${String(delta > 0 ? '+' : '') + delta}  (${pct})  ${status}`
  );
}

async function run() {
  console.log('\n' + '='.repeat(100));
  console.log('  NIPCO Physical Count Audit — 2026-03-31');
  console.log('  Store: ' + STORE_ID);
  console.log('='.repeat(100) + '\n');

  // ── Finished Goods ──────────────────────────────────────────────────────────
  const fgSnap = await db.collection('finishedGoodsInventory')
    .where('storeId', '==', STORE_ID)
    .get();

  const fgDocs = fgSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  console.log('  FINISHED GOODS INVENTORY (currentBalance in units)\n');
  console.log('  ' + '-'.repeat(96));

  const fgResults = [];
  for (const target of PHYSICAL_FG) {
    // Try to find by name keywords
    const matches = fgDocs.filter(d => nameMatch(d.productName || d.description || d.name || '', target.keywords));

    if (matches.length === 0) {
      console.log(`  ⚠️  NOT FOUND: "${target.label}" — searched keywords: ${target.keywords.join(', ')}`);
      fgResults.push({ ...target, systemVal: null, docId: null, found: false });
      continue;
    }

    // If multiple matches, pick the one whose name is most specific (shortest or best match)
    const best = matches.sort((a, b) => (a.productName || '').length - (b.productName || '').length)[0];
    const systemVal = round3(Number(best.currentBalance ?? 0));
    printRow(target.label + ' [' + best.productName + ']', systemVal, target.physicalCount, 'units');
    fgResults.push({ ...target, systemVal, docId: best.id, productName: best.productName, found: true });
  }

  // Also list ALL FG docs so we can spot unknowns
  console.log('\n  All FG docs in system:\n');
  fgDocs.forEach(d => {
    const name = d.productName || d.description || d.name || '(unnamed)';
    const bal = round3(Number(d.currentBalance ?? 0));
    const sold = round3(Number(d.quantitySold ?? 0));
    const manuf = round3(Number(d.quantityManufactured ?? 0));
    console.log(`    [${d.id}] ${name.padEnd(50)} balance:${String(bal).padStart(8)}  sold:${String(sold).padStart(8)}  manuf:${String(manuf).padStart(8)}`);
  });

  // ── Raw Materials ────────────────────────────────────────────────────────────
  const rmSnap = await db.collection('rawMaterials')
    .where('storeId', '==', STORE_ID)
    .get();

  const rmDocs = rmSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  console.log('\n\n  RAW MATERIALS (currentStock in kg)\n');
  console.log('  ' + '-'.repeat(96));

  const rmResults = [];
  for (const target of PHYSICAL_RM) {
    const matches = rmDocs.filter(d => nameMatch(d.name || '', target.keywords));

    if (matches.length === 0) {
      console.log(`  ⚠️  NOT FOUND: "${target.label}" — searched keywords: ${target.keywords.join(', ')}`);
      rmResults.push({ ...target, systemVal: null, docId: null, found: false });
      continue;
    }

    const best = matches.sort((a, b) => (a.name || '').length - (b.name || '').length)[0];
    const systemVal = round3(Number(best.currentStock ?? 0));
    printRow(target.label + ' [' + best.name + ']', systemVal, target.physicalCount, 'kg');
    rmResults.push({ ...target, systemVal, docId: best.id, rmName: best.name, found: true });
  }

  // Also list ALL RM docs
  console.log('\n  All raw material docs in system:\n');
  rmDocs.forEach(d => {
    const stock = round3(Number(d.currentStock ?? 0));
    console.log(`    [${d.id}] ${(d.name || '(unnamed)').padEnd(50)} stock:${String(stock).padStart(10)} ${d.unit || ''}`);
  });

  // ── Summary ──────────────────────────────────────────────────────────────────
  const fgMismatches = fgResults.filter(r => r.found && Math.abs(r.physicalCount - r.systemVal) >= 0.01);
  const rmMismatches = rmResults.filter(r => r.found && Math.abs(r.physicalCount - r.systemVal) >= 0.01);

  console.log('\n\n' + '='.repeat(100));
  console.log('  SUMMARY\n');
  console.log(`  Finished Goods mismatches: ${fgMismatches.length} / ${PHYSICAL_FG.length}`);
  fgMismatches.forEach(r => {
    const delta = round3(r.physicalCount - r.systemVal);
    console.log(`    • ${r.label}: system=${r.systemVal}, physical=${r.physicalCount}, Δ=${delta > 0 ? '+' : ''}${delta}`);
  });
  console.log(`\n  Raw Material mismatches: ${rmMismatches.length} / ${PHYSICAL_RM.length}`);
  rmMismatches.forEach(r => {
    const delta = round3(r.physicalCount - r.systemVal);
    console.log(`    • ${r.label}: system=${r.systemVal}, physical=${r.physicalCount}, Δ=${delta > 0 ? '+' : ''}${delta}`);
  });

  const totalMismatches = fgMismatches.length + rmMismatches.length;
  console.log(`\n  Total mismatches requiring correction: ${totalMismatches}`);
  if (totalMismatches > 0) {
    console.log('  ➜  Run scripts/applyPhysicalCount2026-03-31.cjs --apply to fix.\n');
  } else {
    console.log('  ✅ All values match physical count.\n');
  }
  console.log('='.repeat(100) + '\n');
}

run().catch(err => {
  console.error('❌ Audit failed:', err.message);
  process.exit(1);
});
