/**
 * April 1 corrections — fix GSM currentStock reset by production batch
 * and INTERFOLD 2Kg FG deduction missing from order deliveries.
 */
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('../serviceAccountKey.json')) });
const db = admin.firestore();

async function run() {
  console.log('\n=== April 1 Correction Run ===\n');

  // 1. Fix 14 GSM — still shows 2141 after production batch reset it
  const gsm14 = await db.collection('rawMaterials').doc('kPWepQNvyHlOZS03ZdSx').get();
  console.log('14 GSM before:', gsm14.data().currentStock);
  await db.collection('rawMaterials').doc('kPWepQNvyHlOZS03ZdSx').update({
    currentStock: 785, quantity: 785,
    lastCorrectedDate: '2026-04-01', lastCorrectedNote: 'Production batch reset fix — no 14GSM used in BATCH-154748'
  });
  console.log('14 GSM ✅ → 785 kg');

  // 2. Fix 20 GSM — production consumed 269.1 kg from wrong base (5535), correct is 2029-269.1=1759.9
  const gsm20 = await db.collection('rawMaterials').doc('CPDd3KJjKm8dwVDyQQ9o').get();
  console.log('20 GSM before:', gsm20.data().currentStock);
  await db.collection('rawMaterials').doc('CPDd3KJjKm8dwVDyQQ9o').update({
    currentStock: 1759.9, quantity: 1759.9,
    lastCorrectedDate: '2026-04-01', lastCorrectedNote: 'Production batch BATCH-154748 consumed 269.1 kg from corrected base 2029'
  });
  console.log('20 GSM ✅ → 1759.9 kg (2029 baseline - 269.1 used in BATCH-154748)');

  // 3. Fix INTERFOLD 2Kg FG — orders INV-141 sold 23 units but FG stock wasn't deducted
  // INV-141: 20+3=23 units of hUTwqNgRzIgBDqLBI5bP (INTERFOLD All Care 2Kg)
  const fgRef = db.collection('finishedGoodsInventory').doc('QDqWbvWzmnpcnMeoptcJ');
  const fg = await fgRef.get();
  const fgd = fg.data();
  console.log('\nINTERFOLD 2Kg FG before:', fgd.currentBalance);
  const newBalance = Math.round((fgd.currentBalance - 23) * 1000) / 1000;
  const newQtySold = Math.round(((fgd.quantitySold || 0) + 23) * 1000) / 1000;
  const costPrice = Number(fgd.costPrice || 0);
  await fgRef.update({
    currentBalance: newBalance,
    quantitySold: newQtySold,
    totalValue: Math.round(newBalance * costPrice * 1000) / 1000,
    lastCorrectedDate: '2026-04-01',
    lastCorrectedNote: 'Manual deduction: INV-141 delivered 23 units — FG deduction did not fire on direct-delivered order',
  });
  console.log('INTERFOLD 2Kg FG ✅ → ' + newBalance + ' units (deducted 23 from INV-141)');

  console.log('\n=== All corrections applied ===\n');
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
