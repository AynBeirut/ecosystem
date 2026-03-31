/**
 * GSM Physical Count Correction — 2026-03-31 (client-side error fix)
 *
 * The initial physical count figures for 14 GSM and 20 GSM were wrong.
 * Correct values provided by client:
 *   14 GSM 2PLY 80CM  → 1,356 kg  (was incorrectly entered as 2,141)
 *   20 GSM 2PLY 80CM  → 3,506 kg  (was incorrectly entered as 5,535)
 *
 * Usage:
 *   node scripts/correctGSMPhysicalCount2026-03-31.cjs          ← dry-run
 *   node scripts/correctGSMPhysicalCount2026-03-31.cjs --apply  ← apply
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const STORE_ID = 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';

const CORRECTIONS = [
  {
    docId: 'kPWepQNvyHlOZS03ZdSx',
    name: '14 GSM 2PLY 80CM',
    wrongValue: 2141,
    correctValue: 1356,
    originalSysValue: 819.6,
  },
  {
    docId: 'CPDd3KJjKm8dwVDyQQ9o',
    name: '20 GSM 2PLY 80CM',
    wrongValue: 5535,
    correctValue: 3506,
    originalSysValue: 1998.5,
  },
];

async function run() {
  console.log('\n' + '='.repeat(70));
  console.log('  GSM Physical Count Correction (client error fix) — 2026-03-31');
  console.log('  Mode: ' + (APPLY ? '⚠️  APPLY (writing to Firestore)' : '🔍 DRY-RUN'));
  console.log('='.repeat(70) + '\n');

  for (const c of CORRECTIONS) {
    const ref = db.collection('rawMaterials').doc(c.docId);
    const snap = await ref.get();

    if (!snap.exists) {
      console.error(`  ❌ Doc NOT FOUND: ${c.docId}`);
      process.exit(1);
    }

    const current = Number(snap.data().currentStock ?? snap.data().quantity ?? 0);

    console.log(`  ${c.name}`);
    console.log(`    Doc ID         : ${c.docId}`);
    console.log(`    Original system: ${c.originalSysValue} kg`);
    console.log(`    Wrong physical : ${c.wrongValue} kg  (what we set earlier)`);
    console.log(`    Correct physical: ${c.correctValue} kg  ← applying now`);
    console.log(`    Current DB value: ${current} kg`);
    console.log(`    Delta from correct: ${(c.correctValue - c.originalSysValue).toFixed(2)} kg missing from system (double-deduction)`);
    console.log('');

    if (APPLY) {
      await ref.update({
        currentStock: c.correctValue,
        quantity: c.correctValue,
        lastPhysicalCount: c.correctValue,
        lastPhysicalCountDate: '2026-03-31',
        lastPhysicalCountCorrectedBy: 'admin-script-correction',
        lastPhysicalCountNote: 'Client error corrected: initial value was wrong',
      });
      console.log(`    ✅ Updated to ${c.correctValue} kg\n`);
    }
  }

  // ── Update shadow ledger baseline to match corrected values ──────────────
  if (APPLY) {
    console.log('  Updating shadow ledger baseline...');
    const baselineRef = db.collection('shadowLedger').doc('nipco-active-baseline');
    const baseSnap = await baselineRef.get();

    if (baseSnap.exists) {
      const data = baseSnap.data();
      const rawMaterials = data.rawMaterials || {};

      // Update the two GSM entries
      if (rawMaterials['kPWepQNvyHlOZS03ZdSx']) {
        rawMaterials['kPWepQNvyHlOZS03ZdSx'].baselineStock = 1356;
      }
      if (rawMaterials['CPDd3KJjKm8dwVDyQQ9o']) {
        rawMaterials['CPDd3KJjKm8dwVDyQQ9o'].baselineStock = 3506;
      }

      await baselineRef.update({
        rawMaterials,
        lastAmended: '2026-03-31',
        amendNote: 'GSM physical count corrected — client had input error',
      });

      // Also update the dated baseline
      const datedRef = db.collection('shadowLedger').doc('nipco-baseline-2026-03-31');
      const datedSnap = await datedRef.get();
      if (datedSnap.exists) {
        const dData = datedSnap.data();
        const dRM = dData.rawMaterials || {};
        if (dRM['kPWepQNvyHlOZS03ZdSx']) dRM['kPWepQNvyHlOZS03ZdSx'].baselineStock = 1356;
        if (dRM['CPDd3KJjKm8dwVDyQQ9o']) dRM['CPDd3KJjKm8dwVDyQQ9o'].baselineStock = 3506;
        await datedRef.update({ rawMaterials: dRM, lastAmended: '2026-03-31' });
      }

      console.log('  ✅ Shadow ledger baseline updated\n');
    } else {
      console.log('  ⚠️  Shadow ledger baseline not found - skipping\n');
    }
  }

  if (!APPLY) {
    console.log('\n  Run with --apply to commit these changes to Firestore.');
  }

  console.log('='.repeat(70));
  console.log('\n  Bug analysis impact:');
  console.log('  ─────────────────────────────────────────────────────────────');
  console.log('  14 GSM: system had 819.6 kg, physical=1,356 → 536.4 kg missing');
  console.log('  20 GSM: system had 1,998.5 kg, physical=3,506 → 1,507.5 kg missing');
  console.log('');
  console.log('  Previous (wrong) figures showed: 1,321 kg and 3,536 kg missing.');
  console.log('  Corrected figures show:            536 kg and 1,508 kg missing.');
  console.log('');
  console.log('  ✅ ROOT CAUSE (double-deduction) is UNCHANGED.');
  console.log('     Both GSM rolls still show system < physical by hundreds of kg.');
  console.log('     The double-deduction bug was still real — just smaller magnitude.');
  console.log('');
  console.log('  ✅ CODE FIX (ENABLE_ORDER_RAW_MATERIAL_DEDUCTION=false) still valid.');
  console.log('  ✅ All other 12 corrections (bags, facial tissue, interfold) unaffected.');

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
