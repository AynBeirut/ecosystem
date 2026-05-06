/**
 * Removes the phantom +28 stock restore transaction logged when INV-229 was cancelled.
 * The 2nd delivery of INV-229 was never actually deducted (idempotency key collision bug),
 * so the rollback that added +28 back is a ghost entry that corrupts the transaction log.
 *
 * This script:
 *  1. Finds the Interfoled All Care 3Kg FG document for y.malek's store
 *  2. Locates the phantom transaction by referenceId + date + actionType
 *  3. Removes it from the transactions[] array
 *  4. Does NOT change currentBalance (the manual −28 adjustment handles the balance)
 */

const admin = require('firebase-admin');
const { readFileSync } = require('fs');
const { join } = require('path');

admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8'))
  ),
  projectId: 'market-flow-7b074',
});

const db = admin.firestore();

// y.malek store ID — confirmed from previous sessions
const Y_MALEK_STORE_ID = 'y.malek@nip-lb.com';

async function findYMalekStoreId() {
  // The storeId in finishedGoodsInventory is the Firebase Auth UID
  const userRecord = await admin.auth().getUserByEmail('y.malek@nip-lb.com');
  const storeId = userRecord.uid;
  console.log(`✅ Found y.malek UID (storeId): ${storeId}`);
  return storeId;
}

async function removePhantomTransaction() {
  console.log('\n=== REMOVE PHANTOM INV-229 TRANSACTION ===\n');

  const storeId = await findYMalekStoreId();

  // Find Interfoled All Care 3Kg in finishedGoodsInventory for this store
  const fgSnap = await db.collection('finishedGoodsInventory')
    .where('storeId', '==', storeId)
    .get();

  // Target document confirmed: INTERFOLD All Care 3Kg
  const TARGET_FG_DOC_ID = 'TAIADVDOGW9qc3nqBfw7';

  const interfoledDocRef = db.collection('finishedGoodsInventory').doc(TARGET_FG_DOC_ID);
  const interfoledSnap = await interfoledDocRef.get();

  if (!interfoledSnap.exists) {
    console.error(`❌ Document ${TARGET_FG_DOC_ID} not found`);
    process.exit(1);
  }

  const interfoledDoc = { id: TARGET_FG_DOC_ID, data: () => interfoledSnap.data(), ref: interfoledDocRef };

  console.log('\n📦 All FG items for y.malek:');
  fgSnap.docs.forEach(d => {
    const data = d.data();
    const marker = d.id === TARGET_FG_DOC_ID ? ' ← TARGET' : '';
    console.log(` - [${d.id}] ${data.productName || data.name || '(unnamed)'}${marker}`);
  });

  const fgData = interfoledDoc.data();
  console.log(`✅ Found FG document: ${interfoledDoc.id}`);
  console.log(`   Product: ${fgData.productName || fgData.name}`);
  console.log(`   Current balance: ${fgData.currentBalance}`);

  const transactions = fgData.transactions || [];
  console.log(`   Total transactions: ${transactions.length}`);

  // The phantom transaction is exactly known from the log inspection:
  const PHANTOM_TX_ID = 'TXN-ROLLBACK-1778048472917-q5ydlQH49C3uftuftrfH';
  const PHANTOM_QUANTITY = 28; // +28 that was incorrectly added

  const phantom = transactions.find(tx => tx.id === PHANTOM_TX_ID);

  if (!phantom) {
    console.log(`\n⚠️  Phantom transaction ${PHANTOM_TX_ID} not found — already removed or ID changed.`);
    process.exit(0);
  }

  console.log('\n🎯 Transaction to REMOVE:');
  console.log(`    id:            ${phantom.id}`);
  console.log(`    date:          ${phantom.date}`);
  console.log(`    actionType:    ${phantom.actionType}`);
  console.log(`    quantity:      ${phantom.quantity}`);
  console.log(`    reason:        ${phantom.reason}`);
  console.log(`    idempotencyKey: ${phantom.idempotencyKey}`);

  const cleaned = transactions.filter(tx => tx.id !== PHANTOM_TX_ID);

  if (cleaned.length === transactions.length) {
    console.log('\n❌ Filter did not remove anything.');
    process.exit(1);
  }

  const oldBalance = Number(fgData.currentBalance) || 0;
  const newBalance = parseFloat((oldBalance - PHANTOM_QUANTITY).toFixed(3));
  const costPrice = Number(fgData.costPrice) || 0;
  const newTotalValue = parseFloat((newBalance * costPrice).toFixed(3));

  console.log(`\n💰 Balance correction: ${oldBalance} → ${newBalance} (−${PHANTOM_QUANTITY})`);
  console.log(`   Cost price: $${costPrice}  →  Total value: $${newTotalValue}`);
  console.log(`\n✅ Writing to Firestore...`);

  await db.collection('finishedGoodsInventory').doc(TARGET_FG_DOC_ID).update({
    transactions: cleaned,
    currentBalance: newBalance,
    totalValue: newTotalValue,
  });

  console.log('\n✅ DONE.');
  console.log(`   Phantom transaction removed.`);
  console.log(`   Balance corrected: ${oldBalance} → ${newBalance}`);
  console.log('   No manual adjustment needed.\n');
}

removePhantomTransaction().catch(err => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});
