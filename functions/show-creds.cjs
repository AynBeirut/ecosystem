const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function showCreds() {
  const storeId = 'Av22LKyet8QmVcu9b8Njz1HVfoy1';
  const storeRef = db.collection('storeProfiles').doc(storeId);
  const storeSnap = await storeRef.get();
  
  if (storeSnap.exists) {
    const data = storeSnap.data();
    console.log('\n🏪 Store Payment Credentials:');
    console.log('   Channel ID:', data.whishChannel);
    console.log('   Secret (first 10 chars):', data.whishSecret?.substring(0, 10) + '...');
    console.log('   Website URL:', data.websiteUrl);
    console.log('\n⚠️  Platform credentials (DO NOT USE for stores):');
    console.log('   Platform Channel: 10198838');
    console.log('   Platform Secret: 009ca52d70... (for subscriptions only)\n');
    
    if (data.whishChannel === '10198838') {
      console.log('❌ PROBLEM: Store is using PLATFORM credentials!');
      console.log('   The store owner must get their OWN Whish Money merchant account.');
      console.log('   They cannot use the platform\'s credentials.\n');
    }
  } else {
    console.log('❌ Store not found');
  }
  
  process.exit(0);
}

showCreds().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
