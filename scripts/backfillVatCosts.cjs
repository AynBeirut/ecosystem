/**
 * backfillVatCosts.cjs
 * Updates raw material costPerUnit for materials purchased with 11% VAT
 * that still have the pre-VAT price stored in Firestore.
 * 
 * Run with: node scripts/backfillVatCosts.cjs [--apply]
 */
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '../serviceAccountKey.json'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const DRY_RUN = !process.argv.includes('--apply');
// Only update the production NIPCO store unless --all-stores is passed
const PRODUCTION_STORE_ID = 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';
const TARGET_STORE = process.argv.includes('--all-stores') ? null : PRODUCTION_STORE_ID;

// Materials purchased with VAT 11% (confirmed from PO data)
// Stored at $2.600, corrected cost = $2.600 * 1.11 = $2.886
const VAT_RATE = 0.11;
const VAT_CORRECTIONS = [
  { nameContains: '300G FACIAL INTERNAL', expectedOld: 2.6, corrected: +(2.6 * 1.11).toFixed(4) },
  { nameContains: '500G FACIAL INTERNAL', expectedOld: 2.6, corrected: +(2.6 * 1.11).toFixed(4) },
  { nameContains: 'INTERFOLD 200G', expectedOld: 2.6, corrected: +(2.6 * 1.11).toFixed(4) },
  { nameContains: 'INTERFOLD 300G', expectedOld: 2.6, corrected: +(2.6 * 1.11).toFixed(4) },
];

async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (pass --apply to write)' : 'LIVE WRITE'}`);
  console.log('');

  const snap = await db.collection('rawMaterials').get();
  console.log(`Fetched ${snap.docs.length} raw material documents`);

  let matchCount = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const name = (data.name || '').toUpperCase();
    const currentCost = data.costPerUnit;

    // Skip non-target stores
    if (TARGET_STORE && data.storeId !== TARGET_STORE) continue;

    for (const rule of VAT_CORRECTIONS) {
      if (name.includes(rule.nameContains)) {
        console.log(`\nMATCH: "${data.name}" (id=${doc.id})`);
        console.log(`  storeId      : ${data.storeId}`);
        console.log(`  costPerUnit  : ${currentCost}`);
        console.log(`  expected old : ${rule.expectedOld}`);
        console.log(`  corrected    : ${rule.corrected}`);

        if (Math.abs(currentCost - rule.corrected) < 0.0001) {
          console.log(`  STATUS: already correct, skipping`);
          break;
        }

        if (!DRY_RUN) {
          await doc.ref.update({
            costPerUnit: rule.corrected,
            updatedAt: new Date().toISOString(),
            _vatBackfillNote: `Cost corrected from ${currentCost} to ${rule.corrected} (11% VAT backfill, ${new Date().toISOString()})`,
          });
          console.log(`  STATUS: UPDATED ✓`);
        } else {
          console.log(`  STATUS: would update (dry run)`);
        }
        matchCount++;
        break;
      }
    }
  }

  console.log(`\n--- Done. ${matchCount} material(s) matched ---`);
  if (DRY_RUN && matchCount > 0) {
    console.log('Run with --apply to write changes.');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
