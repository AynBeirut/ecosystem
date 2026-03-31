/**
 * NIPCO Shadow Ledger — Baseline Writer
 * Run ONCE to snapshot today verified values as day-zero.
 * Usage: node scripts/nipcoShadowBaseline.cjs
 */
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const STORE_ID = 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';
const BASELINE_DATE = '2026-03-31';
const FG_BASELINE = [
  { docId: 'QDqWbvWzmnpcnMeoptcJ', productName: 'INTERFOLD All Care 2Kg',      balance: 197   },
  { docId: 'TAIADVDOGW9qc3nqBfw7', productName: 'INTERFOLD All Care 3Kg',      balance: 143   },
  { docId: 'oH1xI5su9rKsX7YvumJn', productName: 'All Care 2 Ply Facial 2Kg',   balance: 928.5 },
  { docId: 'AUMG5bjCZJ5FUxQhhpEt', productName: 'All Care 2 Ply Facial 3Kg',   balance: 288   },
  { docId: '7cboXdQaLnZR5hbXYQPV', productName: 'All Care 2 Ply Facial 5Kg',   balance: 265   },
];
const RM_BASELINE = [
  { docId: 'kPWepQNvyHlOZS03ZdSx', name: '14 GSM 2PLY 80CM',                  stock: 2141   },
  { docId: 'CPDd3KJjKm8dwVDyQQ9o', name: '20 GSM 2PLY 80CM',                  stock: 5535   },
  { docId: 'omNntXGXd0CYgW59GKyg', name: 'External Bag with Hand 40x90',      stock: 126.1  },
  { docId: 'sreO1wan2vR8ftKszz5I', name: 'External Bag with Hand 95x35',      stock: 0.75   },
  { docId: 'b44OHlJIIjrmvZ98zSzt', name: 'External Bag with Hand 35x80',      stock: 53.1   },
  { docId: 'NitmTPMiv0RUb0hxqXf9', name: 'External Bag with Hand 40x110',     stock: 66.4   },
  { docId: 'KMtX4iO3PtDJMDcNBO5z', name: 'INTERFOLD 200G INTERNAL bag',       stock: 114    },
  { docId: 'EhdSZHptBnc8zCCyJ6P0', name: 'INTERFOLD 300g INTERNAL Bag',       stock: 158    },
  { docId: '21GG41A8bc4JWQybwYkk', name: '200g Facial INTERNAL Bag',          stock: 83.6   },
  { docId: 'QUCkefY9LkkrfwOrihyr', name: '300G Facial INTERNAL Bag',          stock: 127    },
  { docId: 'oUR9XVleCl8d2qQEjaNA', name: '500g Facial INTERNAL Bag',          stock: 138.6  },
];
async function run() {
  const fgEnriched = [];
  for (const fg of FG_BASELINE) {
    const snap = await db.collection('finishedGoodsInventory').doc(fg.docId).get();
    const data = snap.data() || {};
    fgEnriched.push({ ...fg, productId: data.productId || data.composedProductId || '' });
  }
  const baseline = { storeId: STORE_ID, baselineDate: BASELINE_DATE, baselineSource: 'physical-count-2026-03-31', createdAt: new Date().toISOString(), finishedGoods: fgEnriched, rawMaterials: RM_BASELINE };
  await db.collection('nipcoShadowLedger').doc('baseline').set(baseline);
  console.log('baseline saved');
  fgEnriched.forEach(fg => console.log('  FG  ' + fg.productName.padEnd(40) + ' ' + fg.balance + ' units  productId=' + fg.productId));
  RM_BASELINE.forEach(rm => console.log('  RM  ' + rm.name.padEnd(40) + ' ' + rm.stock + ' kg'));
  process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
