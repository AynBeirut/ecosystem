/**
 * Stock Correction — 2026-06-04
 * 20 GSM 2PLY 80CM (y.malek / NIPCO): align currentStock to physical count 481.65 kg.
 *
 * Context: ledger showed 207.75 kg after BATCH-591132; physical today = 481.65 kg (−273.9 drift).
 *
 * Usage:
 *   node scripts/stockCorrection2026-06-04-20gsm.cjs          ← dry-run
 *   node scripts/stockCorrection2026-06-04-20gsm.cjs --apply  ← apply
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const STORE_ID = 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';
const DOC_ID = 'CPDd3KJjKm8dwVDyQQ9o';
const MATERIAL_NAME = '20 GSM 2PLY 80CM';
const PHYSICAL_KG = 481.65;
const CORRECTION_DATE = '2026-06-04';
const CORRECTED_BY = 'admin-script-stockCorrection2026-06-04-20gsm';

const round3 = (n) => Math.round(Number(n) * 1000) / 1000;

async function run() {
  const snap = await db.collection('rawMaterials').doc(DOC_ID).get();
  if (!snap.exists) {
    console.error('❌ Raw material doc not found:', DOC_ID);
    process.exit(1);
  }

  const data = snap.data();
  if (data.storeId !== STORE_ID) {
    console.error('❌ storeId mismatch:', data.storeId, 'expected', STORE_ID);
    process.exit(1);
  }

  const before = round3(Number(data.currentStock ?? 0));
  const after = round3(PHYSICAL_KG);
  const delta = round3(after - before);

  console.log('\n' + '='.repeat(70));
  console.log('  Stock Correction — ' + CORRECTION_DATE);
  console.log('  ' + MATERIAL_NAME);
  console.log('  Mode: ' + (APPLY ? '⚠️  APPLY' : '🔍 DRY-RUN'));
  console.log('='.repeat(70));
  console.log(`  currentStock: ${before} → ${after} kg  (Δ ${delta >= 0 ? '+' : ''}${delta})`);
  console.log(`  quantity field (unchanged ref): ${data.quantity}`);
  console.log('='.repeat(70));

  if (!APPLY) {
    console.log('\n  DRY-RUN complete. Run with --apply to write.\n');
    process.exit(0);
  }

  const nowIso = new Date().toISOString();
  const backup = {
    currentStock: data.currentStock,
    quantity: data.quantity,
    lastPhysicalCount: data.lastPhysicalCount,
    lastPhysicalCountDate: data.lastPhysicalCountDate,
    lastPhysicalCountNote: data.lastPhysicalCountNote,
    updatedAt: data.updatedAt,
  };

  await db.runTransaction(async (tx) => {
    const fresh = await tx.get(db.collection('rawMaterials').doc(DOC_ID));
    if (!fresh.exists) throw new Error('Doc missing in transaction');
    tx.update(db.collection('rawMaterials').doc(DOC_ID), {
      currentStock: after,
      lastPhysicalCount: after,
      lastPhysicalCountDate: CORRECTION_DATE,
      lastPhysicalCountNote:
        'Physical count 481.65 kg (2026-06-04). Corrected −273.9 kg ledger drift after BATCH-591132; batch deduction kept.',
      stockCorrectionDate: CORRECTION_DATE,
      stockCorrectionAppliedAt: nowIso,
      lastCorrectedDate: CORRECTION_DATE,
      lastCorrectedNote: `Drift fix: ${before} → ${after} kg (Δ +${delta})`,
      updatedAt: nowIso,
    });
  });

  const auditRef = await db.collection('auditLogs').add({
    action: 'stock_correction',
    storeId: STORE_ID,
    entityType: 'rawMaterial',
    entityId: DOC_ID,
    correctionDate: CORRECTION_DATE,
    appliedAt: nowIso,
    appliedBy: CORRECTED_BY,
    oldValue: backup,
    newValue: {
      currentStock: after,
      lastPhysicalCount: after,
      lastPhysicalCountDate: CORRECTION_DATE,
      delta,
    },
    note: 'NIPCO 20 GSM: physical 481.65 kg today; system was 207.75 after BATCH-591132',
  });

  const verify = await db.collection('rawMaterials').doc(DOC_ID).get();
  const verified = round3(Number(verify.data().currentStock ?? 0));

  console.log('\n  ✅ Updated currentStock →', verified, 'kg');
  console.log('  ✅ Audit log:', auditRef.id);
  console.log('='.repeat(70) + '\n');

  if (verified !== after) {
    console.error('❌ Verification failed: expected', after, 'got', verified);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('\n❌', err.message);
  process.exit(1);
});
