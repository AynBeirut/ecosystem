const admin = require('firebase-admin');
const sa = require('../serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const FG = [
  { id: 'QDqWbvWzmnpcnMeoptcJ', expect: 197,   label: 'INTERFOLD 2Kg' },
  { id: 'TAIADVDOGW9qc3nqBfw7', expect: 143,   label: 'INTERFOLD 3Kg' },
  { id: 'oH1xI5su9rKsX7YvumJn', expect: 928.5, label: 'Facial 2Kg' },
  { id: 'AUMG5bjCZJ5FUxQhhpEt', expect: 288,   label: 'Facial 3Kg' },
  { id: '7cboXdQaLnZR5hbXYQPV', expect: 265,   label: 'Facial 5Kg' },
];
const RM = [
  { id: 'omNntXGXd0CYgW59GKyg', expect: 126.1,  label: 'External 40x90' },
  { id: 'sreO1wan2vR8ftKszz5I', expect: 0.75,   label: 'External 95*35' },
  { id: 'NitmTPMiv0RUb0hxqXf9', expect: 66.4,   label: 'External 40*110' },
  { id: 'KMtX4iO3PtDJMDcNBO5z', expect: 114,    label: 'INTERFOLD 200G bag' },
  { id: 'QUCkefY9LkkrfwOrihyr', expect: 127,    label: '300G Facial bag' },
  { id: 'oUR9XVleCl8d2qQEjaNA', expect: 138.6,  label: '500g Facial bag' },
  { id: 'kPWepQNvyHlOZS03ZdSx', expect: 2141,   label: '14 GSM' },
  { id: 'CPDd3KJjKm8dwVDyQQ9o', expect: 5535,   label: '20 GSM' },
  { id: '21GG41A8bc4JWQybwYkk', expect: 83.6,   label: '200g Facial bag' },
];

async function go() {
  console.log('\n  VERIFICATION — post-correction 2026-03-31\n');
  let allOk = true;
  for (const r of FG) {
    const d = (await db.collection('finishedGoodsInventory').doc(r.id).get()).data();
    const val = Math.round(Number(d.currentBalance) * 1000) / 1000;
    const ok = Math.abs(val - r.expect) < 0.01;
    if (!ok) allOk = false;
    console.log('  ' + (ok ? '✅' : '❌') + ' FG  ' + r.label.padEnd(25) + ' = ' + val + (ok ? '' : '  ← expected ' + r.expect));
  }
  for (const r of RM) {
    const d = (await db.collection('rawMaterials').doc(r.id).get()).data();
    const val = Math.round(Number(d.currentStock) * 1000) / 1000;
    const ok = Math.abs(val - r.expect) < 0.01;
    if (!ok) allOk = false;
    console.log('  ' + (ok ? '✅' : '❌') + ' RM  ' + r.label.padEnd(25) + ' = ' + val + (ok ? '' : '  ← expected ' + r.expect));
  }
  console.log('\n  ' + (allOk ? '✅ ALL VALUES MATCH PHYSICAL COUNT' : '❌ SOME VALUES DID NOT MATCH') + '\n');
  process.exit(0);
}
go().catch(e => { console.error(e.message); process.exit(1); });
