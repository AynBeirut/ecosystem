/**
 * Check all storeProfiles to find correct owner of "AYN BEIRUT" store
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

async function checkAllStores() {
  console.log('\n🔍 Checking all stores in database...\n');
  console.log('='.repeat(80));
  
  const storesCollection = db.collection('storeProfiles');
  const snapshot = await storesCollection.get();
  
  console.log(`\n📊 Total storeProfiles: ${snapshot.size}\n`);
  
  const stores: any[] = [];
  
  snapshot.forEach(doc => {
    const data = doc.data();
    stores.push({
      userId: doc.id,
      email: data.email || data.ownerEmail || 'N/A',
      storeName: data.storeName || 'N/A',
      storeSlug: data.storeSlug || 'N/A',
      subscriptionStatus: data.subscriptionStatus || 'none',
      subscriptionTier: data.subscriptionTier || 'none',
      isLegacyUser: data.isLegacyUser || false
    });
  });
  
  // Print all stores
  stores.forEach((store, index) => {
    console.log(`${index + 1}. Store: ${store.storeName}`);
    console.log(`   User ID: ${store.userId}`);
    console.log(`   Email: ${store.email}`);
    console.log(`   Slug: ${store.storeSlug}`);
    console.log(`   Subscription: ${store.subscriptionStatus} (${store.subscriptionTier})`);
    console.log(`   Legacy User: ${store.isLegacyUser ? 'YES ✓' : 'NO'}`);
    console.log('');
  });
  
  console.log('='.repeat(80));
  
  // Find specific emails
  console.log('\n🔎 Looking for specific emails:\n');
  
  const targetEmails = [
    'anwar.abouhassan@gmail.com',
    'info@aynbeirut.com',
    'info@emoove.co'
  ];
  
  targetEmails.forEach(targetEmail => {
    const found = stores.find(s => s.email.toLowerCase() === targetEmail.toLowerCase());
    if (found) {
      console.log(`✅ ${targetEmail}`);
      console.log(`   User ID: ${found.userId}`);
      console.log(`   Store: ${found.storeName}`);
      console.log(`   Status: ${found.subscriptionStatus}/${found.subscriptionTier}`);
    } else {
      console.log(`❌ ${targetEmail} - NO STORE FOUND`);
    }
    console.log('');
  });
  
  return stores;
}

checkAllStores()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n💥 Error:', error);
    process.exit(1);
  });
