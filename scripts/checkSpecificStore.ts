/**
 * Check specific storeProfile document
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';

// Initialize Firebase Admin
try {
  const serviceAccount = JSON.parse(
    readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8')
  );
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'market-flow-7b074',
  });
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin');
  process.exit(1);
}

const db = admin.firestore();

async function checkStore() {
  const userId = 'Av22LKyet8QmVcu9b8Njz1HVfoy1';
  
  console.log(`\n🔍 Checking storeProfile: ${userId}\n`);
  console.log('='.repeat(80));
  
  const storeRef = db.collection('storeProfiles').doc(userId);
  const storeSnap = await storeRef.get();
  
  if (!storeSnap.exists) {
    console.log('❌ Store not found!');
    return;
  }
  
  const data = storeSnap.data()!;
  
  console.log('\n📄 Store Data:\n');
  console.log(JSON.stringify(data, null, 2));
  
  console.log('\n' + '='.repeat(80));
  
  console.log('\n📧 Owner Information:');
  console.log(`   Auth Email (from Firebase Auth lookup): anwar.abouhassan@gmail.com`);
  console.log(`   Store email field: ${data.email || 'N/A'}`);
  console.log(`   Store ownerEmail field: ${data.ownerEmail || 'N/A'}`);
  console.log(`   Store Name: ${data.storeName || 'N/A'}`);
  console.log(`   Store Slug: ${data.storeSlug || 'N/A'}`);
  
  console.log('\n💡 Action Needed:');
  console.log('   1. Delete the incorrect legacy activation (set for info@aynbeirut.com)');
  console.log('   2. This store actually belongs to anwar.abouhassan@gmail.com');
  console.log('   3. Re-activate with correct legacy user settings');
  console.log('');
}

checkStore()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n💥 Error:', error);
    process.exit(1);
  });
