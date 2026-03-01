const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkStoreCreds() {
  const storeId = 'Av22LKyet8QmVcu9b8Njz1HVfoy1';
  const storeRef = db.collection('storeProfiles').doc(storeId);
  const storeSnap = await storeRef.get();
  
  if (storeSnap.exists) {
    const data = storeSnap.data();
    console.log('\n🏪 Store:', data.storeName || 'Unknown');
    console.log('📧 Owner:', data.email || storeId);
    console.log('\n💳 Payment Credentials:');
    console.log('   Whish Channel:', data.whishChannel ? '✅ Set' : '❌ NOT SET');
    console.log('   Whish Secret:', data.whishSecret ? '✅ Set' : '❌ NOT SET');
    console.log('   Website URL:', data.websiteUrl ? `✅ ${data.websiteUrl}` : '❌ NOT SET');
    
    if (!data.whishChannel || !data.whishSecret || !data.websiteUrl) {
      console.log('\n⚠️  PROBLEM FOUND: Store missing Whish Money credentials!');
      console.log('   → Go to Admin > Payments and add your Whish credentials\n');
    } else {
      console.log('\n✅ Store has all required payment credentials!\n');
    }
  } else {
    console.log('❌ Store not found');
  }
  
  process.exit(0);
}

checkStoreCreds().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
