/**
 * Physical Count Correction — 2026-03-31
 * Corrects finishedGoodsInventory and rawMaterials for NIPCO
 * based on physical count provided by client on 2026-03-31.
 *
 * Usage:
 *   node scripts/applyPhysicalCount2026-03-31.cjs          ← dry-run (no writes)
 *   node scripts/applyPhysicalCount2026-03-31.cjs --apply  ← apply corrections
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const STORE_ID = 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';
const CORRECTION_DATE = '2026-03-31';
const CORRECTED_BY = 'admin-script';

const round3 = (n) => Math.round(Number(n) * 1000) / 1000;

// ─── Finished Goods corrections ────────────────────────────────────────────────
// Exact doc IDs from audit run 2026-03-31
const FG_CORRECTIONS = [
  { docId: 'QDqWbvWzmnpcnMeoptcJ', productName: 'INTERFOLD All Care 2Kg',      physicalCount: 197   },
  { docId: 'TAIADVDOGW9qc3nqBfw7', productName: 'INTERFOLD All Care 3Kg',      physicalCount: 143   },
  { docId: 'oH1xI5su9rKsX7YvumJn', productName: 'All Care 2 Ply Facial 2Kg',   physicalCount: 928.5 },
  { docId: 'AUMG5bjCZJ5FUxQhhpEt', productName: 'All Care 2 Ply Facial 3Kg',   physicalCount: 288   },
  { docId: '7cboXdQaLnZR5hbXYQPV', productName: 'All Care 2 Ply Facial 5Kg',   physicalCount: 265   },
];

// ─── Raw Material corrections ───────────────────────────────────────────────────
// Exact doc IDs from audit run 2026-03-31
// Skipping items where delta < 0.01 (External 35*80 is exact match)
const RM_CORRECTIONS = [
  { docId: 'omNntXGXd0CYgW59GKyg', name: 'External Bag with Hand 40x90',      physicalCount: 126.1,  sysStock: 122.759 },
  { docId: 'sreO1wan2vR8ftKszz5I', name: 'External Bag with Hand 95*35',       physicalCount: 0.75,   sysStock: 79.1    },
  { docId: 'NitmTPMiv0RUb0hxqXf9', name: 'External Bag with Hand 40*110',      physicalCount: 66.4,   sysStock: 67.22   },
  { docId: 'KMtX4iO3PtDJMDcNBO5z', name: 'INTERFOLD 200G INTERNAL bag',        physicalCount: 114,    sysStock: 111.75  },
  { docId: 'QUCkefY9LkkrfwOrihyr', name: '300G Facial INTERNAL Bag',           physicalCount: 127,    sysStock: 125.515 },
  { docId: 'oUR9XVleCl8d2qQEjaNA', name: '500g Facial INTERNAL Bag',           physicalCount: 138.6,  sysStock: 110.76  },
  { docId: 'kPWepQNvyHlOZS03ZdSx', name: '14 GSM 2PLY 80CM',                   physicalCount: 2141,   sysStock: 819.6   },
  { docId: 'CPDd3KJjKm8dwVDyQQ9o', name: '20 GSM 2PLY 80CM',                   physicalCount: 5535,   sysStock: 1998.5  },
  // Small delta items included for completeness:
  { docId: '21GG41A8bc4JWQybwYkk', name: '200g Facial INTERNAL Bag',           physicalCount: 83.6,   sysStock: 84      },
];

// ─── Items already matching (no correction needed) ─────────────────────────────
// [EhdSZHptBnc8zCCyJ6P0] INTERFOLD 300g INTERNAL Bag → system=158, physical=158 ✅
// [b44OHlJIIjrmvZ98zSzt] External Bag with Hand 35*80 → system=53.1, physical=53.1 ✅
// External Bag 42x112 → not found in system (may never have been entered)

async function run() {
  console.log('\n' + '='.repeat(80));
  console.log('  Physical Stock Count Correction — ' + CORRECTION_DATE);
  console.log('  Store: ' + STORE_ID);
  console.log('  Mode: ' + (APPLY ? '⚠️  APPLY (writing to Firestore)' : '🔍 DRY-RUN (no writes)'));
  console.log('='.repeat(80) + '\n');

  // ── Validate docs exist first ─────────────────────────────────────────────
  console.log('  Validating document IDs...\n');

  for (const c of FG_CORRECTIONS) {
    const snap = await db.collection('finishedGoodsInventory').doc(c.docId).get();
    if (!snap.exists) {
      console.error(`  ❌ FG doc NOT FOUND: ${c.docId} (${c.productName})`);
      process.exit(1);
    }
    const data = snap.data();
    c.currentBalance = round3(Number(data.currentBalance ?? 0));
    c.quantitySold   = round3(Number(data.quantitySold ?? 0));
    c.costPrice      = Number(data.costPrice ?? 0);
  }

  for (const r of RM_CORRECTIONS) {
    const snap = await db.collection('rawMaterials').doc(r.docId).get();
    if (!snap.exists) {
      console.error(`  ❌ RM doc NOT FOUND: ${r.docId} (${r.name})`);
      process.exit(1);
    }
    const data = snap.data();
    r.liveStock = round3(Number(data.currentStock ?? 0));
  }

  console.log('  ✅ All docs validated.\n');

  // ── Print FG changes ──────────────────────────────────────────────────────
  console.log('  FINISHED GOODS CORRECTIONS:');
  console.log('  ' + '-'.repeat(76));
  for (const c of FG_CORRECTIONS) {
    const delta = round3(c.physicalCount - c.currentBalance);
    const sign  = delta >= 0 ? '+' : '';
    console.log(`  📦 ${c.productName.padEnd(40)} ${String(c.currentBalance).padStart(7)} → ${String(c.physicalCount).padStart(7)}  (Δ ${sign}${delta})`);
  }

  console.log('\n  RAW MATERIAL CORRECTIONS:');
  console.log('  ' + '-'.repeat(76));
  for (const r of RM_CORRECTIONS) {
    const delta = round3(r.physicalCount - r.liveStock);
    const sign  = delta >= 0 ? '+' : '';
    const flag  = Math.abs(delta) > 100 ? '  ⚠️  LARGE CHANGE' : '';
    console.log(`  🧪 ${r.name.padEnd(40)} ${String(r.liveStock).padStart(9)} → ${String(r.physicalCount).padStart(9)} kg  (Δ ${sign}${delta})${flag}`);
  }

  if (!APPLY) {
    console.log('\n' + '─'.repeat(80));
    console.log('  DRY-RUN complete. Run with --apply to write changes.');
    console.log('='.repeat(80) + '\n');
    process.exit(0);
  }

  // ── Apply FG corrections ──────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(80));
  console.log('  Applying corrections...\n');

  let successCount = 0;
  const nowIso = new Date().toISOString();

  for (const c of FG_CORRECTIONS) {
    try {
      const fgRef = db.collection('finishedGoodsInventory').doc(c.docId);
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(fgRef);
        if (!snap.exists) throw new Error(`Doc ${c.docId} not found`);
        const data = snap.data();

        const newBalance   = c.physicalCount;
        const newTotalValue = round3(newBalance * (data.costPrice ?? 0));

        const adjTxn = {
          id: `TXN-PHYSICAL-COUNT-${CORRECTION_DATE}-${c.docId}`,
          date: nowIso,
          actionType: 'adjustment',
          quantity: round3(newBalance - (data.currentBalance ?? 0)),
          unitCost: data.costPrice ?? 0,
          totalCost: round3(Math.abs(newBalance - (data.currentBalance ?? 0)) * (data.costPrice ?? 0)),
          reason: `Physical count correction ${CORRECTION_DATE}`,
          referenceId: `physical-count-${CORRECTION_DATE}`,
          referenceNumber: `PHYS-COUNT-${CORRECTION_DATE}`,
          userId: CORRECTED_BY,
          userName: 'Admin Script',
        };

        const existingTxns = Array.isArray(data.transactions) ? data.transactions : [];

        tx.update(fgRef, {
          currentBalance: newBalance,
          totalValue: newTotalValue,
          transactions: [...existingTxns, adjTxn],
          physicalCountDate: CORRECTION_DATE,
          physicalCountAppliedAt: nowIso,
          updatedAt: nowIso,
        });
      });
      console.log(`  ✅ FG: ${c.productName}  ${c.currentBalance} → ${c.physicalCount}`);
      successCount++;
    } catch (err) {
      console.error(`  ❌ FG FAILED: ${c.productName}: ${err.message}`);
    }
  }

  // ── Apply RM corrections ───────────────────────────────────────────────────
  for (const r of RM_CORRECTIONS) {
    try {
      const rmRef = db.collection('rawMaterials').doc(r.docId);
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(rmRef);
        if (!snap.exists) throw new Error(`Doc ${r.docId} not found`);

        tx.update(rmRef, {
          currentStock: r.physicalCount,
          physicalCountDate: CORRECTION_DATE,
          physicalCountAppliedAt: nowIso,
          updatedAt: nowIso,
        });
      });
      console.log(`  ✅ RM: ${r.name.padEnd(40)}  ${r.liveStock} → ${r.physicalCount} kg`);
      successCount++;
    } catch (err) {
      console.error(`  ❌ RM FAILED: ${r.name}: ${err.message}`);
    }
  }

  // ── Audit log ─────────────────────────────────────────────────────────────
  await db.collection('auditLogs').add({
    action: 'physical_count_correction',
    storeId: STORE_ID,
    correctionDate: CORRECTION_DATE,
    appliedAt: nowIso,
    appliedBy: CORRECTED_BY,
    fgCorrections: FG_CORRECTIONS.map(c => ({
      docId: c.docId,
      productName: c.productName,
      before: c.currentBalance,
      after: c.physicalCount,
      delta: round3(c.physicalCount - c.currentBalance),
    })),
    rmCorrections: RM_CORRECTIONS.map(r => ({
      docId: r.docId,
      name: r.name,
      before: r.liveStock,
      after: r.physicalCount,
      delta: round3(r.physicalCount - r.liveStock),
    })),
  });

  console.log('\n' + '='.repeat(80));
  console.log(`  Done. ${successCount}/${FG_CORRECTIONS.length + RM_CORRECTIONS.length} documents corrected.`);
  console.log('  Audit log entry written to Firestore.');
  console.log('='.repeat(80) + '\n');
  process.exit(0);
}

run().catch(err => {
  console.error('\n❌ Script error:', err.message);
  process.exit(1);
});
