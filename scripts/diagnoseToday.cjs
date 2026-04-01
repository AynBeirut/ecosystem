const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('../serviceAccountKey.json')) });
const db = admin.firestore();
const STORE_ID = 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';

async function check() {
  // INTERFOLD 2Kg FG doc
  const fg = await db.collection('finishedGoodsInventory').doc('QDqWbvWzmnpcnMeoptcJ').get();
  const fgd = fg.data();
  console.log('\n--- INTERFOLD 2Kg FG doc ---');
  console.log('currentBalance:', fgd.currentBalance, '| quantity:', fgd.quantity, '| quantitySold:', fgd.quantitySold, '| productId:', fgd.productId);

  // Production batch
  console.log('\n--- Production Batch BATCH-154748 ---');
  const bs = await db.collection('productionBatches').where('storeId','==',STORE_ID).where('batchNumber','==','BATCH-154748').get();
  if (!bs.empty) {
    const bd = bs.docs[0].data();
    console.log('productId:', bd.productId, '| actualQty:', bd.actualQuantity || bd.quantity);
    console.log('materialsUsed:', JSON.stringify(bd.materialsUsed, null, 2));
  } else { console.log('not found'); }

  // Orders INV-141 and INV-143
  for (const inv of ['INV-141', 'INV-143']) {
    const snap = await db.collection('orders').where('storeId','==',STORE_ID).where('invoiceNumber','==',inv).get();
    if (!snap.empty) {
      const od = snap.docs[0].data();
      console.log('\n--- Order', inv, '---');
      console.log('status:', od.status);
      (od.items||[]).forEach(i => console.log('  item:', i.productId || i.composedProductId, '|', i.productName || i.name, '| qty:', i.quantity));
    } else { console.log('\nOrder', inv, ': not found'); }
  }

  process.exit(0);
}
check().catch(e => { console.error(e); process.exit(1); });
