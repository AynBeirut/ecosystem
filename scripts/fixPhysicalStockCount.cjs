/**
 * Physical Count Correction — 2026-03-23
 *
 * Corrects finishedGoodsInventory currentBalance for 4 NIPCO products
 * based on physical count taken on 2026-03-23.
 *
 * Physical counts:
 *   INTERFOLD All Care 2Kg  → 860   (system: ~924)
 *   All Care 2 Ply Facial 2Kg → 1090.5  (system: ~1062.5)
 *   All Care 2 Ply Facial 3Kg → 234   (system: ~254)
 *   All Care 2 Ply Facial 5Kg → 247   (system: ~268.5)
 *
 * Usage:
 *   node scripts/fixPhysicalStockCount.cjs          ← dry-run (no writes)
 *   node scripts/fixPhysicalStockCount.cjs --apply  ← apply corrections
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const STORE_ID = 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';
const CORRECTION_DATE = '2026-03-23';
const CORRECTED_BY = 'admin-script';

// Physical count targets: partial product name match → corrected balance
const PHYSICAL_COUNTS = [
  { nameContains: 'INTERFOLD All Care 2Kg',       physicalCount: 860 },
  { nameContains: 'All Care 2 Ply Facial 2Kg',    physicalCount: 1090.5 },
  { nameContains: 'All Care 2 Ply Facial 3Kg',    physicalCount: 234 },
  { nameContains: 'All Care 2 Ply Facial 5Kg',    physicalCount: 247 },
];

const round3 = (n) => Math.round(n * 1000) / 1000;

async function run() {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  Physical Stock Count Correction — ${CORRECTION_DATE}`);
  console.log(`  Mode: ${APPLY ? '⚠️  APPLY (writing to Firestore)' : '🔍 DRY-RUN (no writes)'}`);
  console.log(`${'='.repeat(70)}\n`);

  const snapshot = await db.collection('finishedGoodsInventory')
    .where('storeId', '==', STORE_ID)
    .get();

  if (snapshot.empty) {
    console.error('❌ No finishedGoodsInventory documents found for this store.');
    process.exit(1);
  }

  const fgDocs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`Found ${fgDocs.length} FG documents for store ${STORE_ID}\n`);

  const corrections = [];

  for (const target of PHYSICAL_COUNTS) {
    const match = fgDocs.find(d =>
      (d.productName || '').includes(target.nameContains)
    );

    if (!match) {
      console.warn(`  ⚠️  NOT FOUND: "${target.nameContains}"`);
      continue;
    }

    const currentBalance = match.currentBalance ?? 0;
    const currentSold = match.quantitySold ?? 0;
    const costPrice = match.costPrice ?? 0;
    const delta = round3(target.physicalCount - currentBalance);

    console.log(`  📦 ${match.productName}`);
    console.log(`     Doc ID      : ${match.id}`);
    console.log(`     System stock: ${currentBalance}`);
    console.log(`     Physical    : ${target.physicalCount}`);
    console.log(`     Delta       : ${delta > 0 ? '+' : ''}${delta}`);
    console.log(`     Cost price  : $${costPrice}`);
    console.log(`     New total $ : $${round3(target.physicalCount * costPrice)}`);
    console.log();

    corrections.push({
      docId: match.id,
      currentBalance,
      currentSold,
      costPrice,
      physicalCount: target.physicalCount,
      delta,
      productName: match.productName,
    });
  }

  if (!APPLY) {
    console.log('─'.repeat(70));
    console.log('  DRY-RUN complete. Run with --apply to write changes.\n');
    process.exit(0);
  }

  // Apply corrections using runTransaction for each doc
  console.log('─'.repeat(70));
  console.log('  Applying corrections...\n');

  let successCount = 0;

  for (const c of corrections) {
    try {
      const fgRef = db.collection('finishedGoodsInventory').doc(c.docId);
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(fgRef);
        if (!snap.exists) throw new Error(`Doc ${c.docId} not found during transaction`);
        const data = snap.data();

        const newBalance = c.physicalCount;
        // Also round quantitySold to eliminate float artifacts
        const roundedSold = round3(data.quantitySold ?? 0);
        const newTotalValue = round3(newBalance * (data.costPrice ?? 0));

        const adjustmentTxn = {
          id: `TXN-PHYSICAL-COUNT-${Date.now()}-${c.docId}`,
          date: new Date().toISOString(),
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

        const existingTransactions = Array.isArray(data.transactions) ? data.transactions : [];

        tx.update(fgRef, {
          currentBalance: newBalance,
          quantitySold: roundedSold,
          totalValue: newTotalValue,
          transactions: [...existingTransactions, adjustmentTxn],
          updatedAt: new Date().toISOString(),
        });
      });

      console.log(`  ✅ ${c.productName}`);
      console.log(`     ${c.currentBalance} → ${c.physicalCount}  (Δ ${c.delta > 0 ? '+' : ''}${c.delta})`);
      successCount++;
    } catch (err) {
      console.error(`  ❌ Failed to update ${c.productName}: ${err.message}`);
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`  Done. ${successCount}/${corrections.length} documents corrected.`);
  console.log(`${'='.repeat(70)}\n`);
  process.exit(0);
}

run().catch(err => {
  console.error('\n❌ Script error:', err.message);
  process.exit(1);
});
