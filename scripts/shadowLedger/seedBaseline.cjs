/**
 * Shadow Ledger — Seed Baseline
 * ─────────────────────────────
 * Records today's physical count (2026-03-31) as the Day-Zero starting point.
 * After this runs, dailyCheck.cjs uses these values as the reference and
 * tracks every purchase / production / sale to independently compute what
 * the stock *should* be, then compares it to what the system actually stores.
 *
 * Run once:
 *   node scripts/shadowLedger/seedBaseline.cjs
 */

const admin = require('firebase-admin');
const path = require('path');
admin.initializeApp({ credential: admin.credential.cert(require('../../serviceAccountKey.json')) });
const db = admin.firestore();

const STORE_ID    = 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';
const BASELINE_ID = 'nipco-baseline-2026-03-31';
const DATE        = '2026-03-31';

// ── Finished Goods ────────────────────────────────────────────────────────────
// These are the physically counted and system-corrected values from 2026-03-31.
// They are the ground truth starting point for all future shadow math.
const FG_BASELINE = [
  { docId: 'QDqWbvWzmnpcnMeoptcJ', name: 'INTERFOLD All Care 2Kg',    units: 197   },
  { docId: 'TAIADVDOGW9qc3nqBfw7', name: 'INTERFOLD All Care 3Kg',    units: 143   },
  { docId: 'oH1xI5su9rKsX7YvumJn', name: 'All Care 2 Ply Facial 2Kg', units: 928.5 },
  { docId: 'AUMG5bjCZJ5FUxQhhpEt', name: 'All Care 2 Ply Facial 3Kg', units: 288   },
  { docId: '7cboXdQaLnZR5hbXYQPV', name: 'All Care 2 Ply Facial 5Kg', units: 265   },
];

// ── Raw Materials ─────────────────────────────────────────────────────────────
const RM_BASELINE = [
  { docId: 'omNntXGXd0CYgW59GKyg', name: 'External Bag with Hand 40x90',     kg: 126.1  },
  { docId: 'sreO1wan2vR8ftKszz5I', name: 'External Bag with Hand 95*35',      kg: 0.75   },
  { docId: 'b44OHlJIIjrmvZ98zSzt', name: 'External Bag with Hand 35*80',      kg: 53.1   },
  { docId: 'NitmTPMiv0RUb0hxqXf9', name: 'External Bag with Hand 40*110',     kg: 66.4   },
  { docId: 'KMtX4iO3PtDJMDcNBO5z', name: 'INTERFOLD 200G INTERNAL bag',       kg: 114    },
  { docId: 'EhdSZHptBnc8zCCyJ6P0', name: 'INTERFOLD 300g INTERNAL Bag',       kg: 158    },
  { docId: '21GG41A8bc4JWQybwYkk', name: '200g Facial INTERNAL Bag',          kg: 83.6   },
  { docId: 'QUCkefY9LkkrfwOrihyr', name: '300G Facial INTERNAL Bag',          kg: 127    },
  { docId: 'oUR9XVleCl8d2qQEjaNA', name: '500g Facial INTERNAL Bag',          kg: 138.6  },
  { docId: 'kPWepQNvyHlOZS03ZdSx', name: '14 GSM 2PLY 80CM',                  kg: 2141   },
  { docId: 'CPDd3KJjKm8dwVDyQQ9o', name: '20 GSM 2PLY 80CM',                  kg: 5535   },
];

async function run() {
  console.log('\n' + '='.repeat(70));
  console.log('  Shadow Ledger — Seed Baseline');
  console.log('  Date: ' + DATE);
  console.log('  Store: ' + STORE_ID);
  console.log('='.repeat(70) + '\n');

  // Check if already exists
  const existing = await db.collection('shadowLedger').doc(BASELINE_ID).get();
  if (existing.exists) {
    console.log('  ⚠️  Baseline already exists. To re-seed, delete the doc first:');
    console.log('       shadowLedger/' + BASELINE_ID);
    console.log('  Current data:\n');
    const d = existing.data();
    console.log('  Date: ' + d.date + '   FG items: ' + d.finishedGoods.length + '   RM items: ' + d.rawMaterials.length);
    process.exit(0);
  }

  const doc = {
    storeId:       STORE_ID,
    date:          DATE,
    seedTimestamp: new Date().toISOString(),
    source:        'physical-count-2026-03-31',
    finishedGoods: FG_BASELINE,
    rawMaterials:  RM_BASELINE,
    note: 'Ground-truth baseline from physical count + system correction on 2026-03-31. ' +
          'Used by dailyCheck.cjs to independently compute expected stock from transactions.',
  };

  await db.collection('shadowLedger').doc(BASELINE_ID).set(doc);

  // Also write as the "active" pointer so dailyCheck.cjs always finds the latest
  await db.collection('shadowLedger').doc('nipco-active-baseline').set({
    ...doc,
    baselineId: BASELINE_ID,
  });

  console.log('  ✅ Baseline written: shadowLedger/' + BASELINE_ID);
  console.log('  ✅ Active pointer:   shadowLedger/nipco-active-baseline\n');

  console.log('  Finished Goods (units):');
  FG_BASELINE.forEach(r => console.log(`    ${r.name.padEnd(35)} = ${r.units}`));

  console.log('\n  Raw Materials (kg):');
  RM_BASELINE.forEach(r => console.log(`    ${r.name.padEnd(35)} = ${r.kg} kg`));

  console.log('\n' + '='.repeat(70));
  console.log('  Run scripts/shadowLedger/dailyCheck.cjs to start monitoring.');
  console.log('='.repeat(70) + '\n');

  process.exit(0);
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
