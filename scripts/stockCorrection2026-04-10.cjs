/**
 * Stock Correction — 2026-04-10
 * Manual stock adjustments for two raw materials.
 *
 * Usage:
 *   node scripts/stockCorrection2026-04-10.cjs          ← dry-run (no writes)
 *   node scripts/stockCorrection2026-04-10.cjs --apply  ← apply corrections
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const CORRECTION_DATE = '2026-04-10';
const CORRECTED_BY = 'admin-script';

const round3 = (n) => Math.round(Number(n) * 1000) / 1000;

const RM_CORRECTIONS = [
  { docId: 'KMtX4iO3PtDJMDcNBO5z', name: 'INTERFOLD 200G INTERNAL bag', physicalCount: 25 },
  { docId: 'omNntXGXd0CYgW59GKyg', name: 'External Bag with Hand 40x90', physicalCount: 75 },
];

async function run() {
  console.log('\n' + '='.repeat(70));
  console.log('  Stock Correction — ' + CORRECTION_DATE);
  console.log('  Mode: ' + (APPLY ? '⚠️  APPLY (writing to Firestore)' : '🔍 DRY-RUN (no writes)'));
  console.log('='.repeat(70) + '\n');

  // Validate docs and fetch live stock
  for (const r of RM_CORRECTIONS) {
    const snap = await db.collection('rawMaterials').doc(r.docId).get();
    if (!snap.exists) {
      console.error(`  ❌ Doc NOT FOUND: ${r.docId} (${r.name})`);
      process.exit(1);
    }
    r.liveStock = round3(Number(snap.data().currentStock ?? 0));
  }

  console.log('  RAW MATERIAL CORRECTIONS:');
  console.log('  ' + '-'.repeat(66));
  for (const r of RM_CORRECTIONS) {
    const delta = round3(r.physicalCount - r.liveStock);
    const sign  = delta >= 0 ? '+' : '';
    console.log(`  🧪 ${r.name.padEnd(40)} ${String(r.liveStock).padStart(9)} → ${String(r.physicalCount).padStart(9)} kg  (Δ ${sign}${delta})`);
  }

  if (!APPLY) {
    console.log('\n' + '─'.repeat(70));
    console.log('  DRY-RUN complete. Run with --apply to write changes.');
    console.log('='.repeat(70) + '\n');
    process.exit(0);
  }

  console.log('\n' + '─'.repeat(70));
  console.log('  Applying corrections...\n');

  const nowIso = new Date().toISOString();
  let successCount = 0;

  for (const r of RM_CORRECTIONS) {
    try {
      const rmRef = db.collection('rawMaterials').doc(r.docId);
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(rmRef);
        if (!snap.exists) throw new Error(`Doc ${r.docId} not found`);
        tx.update(rmRef, {
          currentStock: r.physicalCount,
          stockCorrectionDate: CORRECTION_DATE,
          stockCorrectionAppliedAt: nowIso,
          updatedAt: nowIso,
        });
      });
      console.log(`  ✅ RM: ${r.name.padEnd(40)}  ${r.liveStock} → ${r.physicalCount} kg`);
      successCount++;
    } catch (err) {
      console.error(`  ❌ FAILED: ${r.name}: ${err.message}`);
    }
  }

  // Audit log
  await db.collection('auditLogs').add({
    action: 'stock_correction',
    correctionDate: CORRECTION_DATE,
    appliedAt: nowIso,
    appliedBy: CORRECTED_BY,
    rmCorrections: RM_CORRECTIONS.map(r => ({
      docId: r.docId,
      name: r.name,
      before: r.liveStock,
      after: r.physicalCount,
      delta: round3(r.physicalCount - r.liveStock),
    })),
  });

  console.log('\n' + '='.repeat(70));
  console.log(`  Done. ${successCount}/${RM_CORRECTIONS.length} documents corrected.`);
  console.log('  Audit log entry written to Firestore.');
  console.log('='.repeat(70) + '\n');
  process.exit(0);
}

run().catch(err => {
  console.error('\n❌ Script error:', err.message);
  process.exit(1);
});
