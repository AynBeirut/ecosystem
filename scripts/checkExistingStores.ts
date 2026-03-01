/**
 * Check which legacy users already have storeProfiles
 * This helps verify correct user IDs before migration
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

const LEGACY_EMAILS = [
  'info@emoove.co',
  'y.malek@nip-lb.com',
  'janarawwas317@gmail.com',
  'info@aynbeirut.com',
  'anwar.ah7@gmail.com',
  'mooveelectro@gmail.com',
  'anwar.abouhassan@gmail.com',
  'sawtonaorganization@gmail.com'
];

async function checkStores() {
  console.log('\n🔍 Checking existing stores for legacy users...\n');
  
  const storesCollection = db.collection('storeProfiles');
  const snapshot = await storesCollection.get();
  
  console.log(`📊 Total storeProfiles in database: ${snapshot.size}\n`);
  console.log('=' .repeat(80));
  
  const foundStores: any[] = [];
  const missingUsers: string[] = [...LEGACY_EMAILS];
  
  snapshot.forEach(doc => {
    const data = doc.data();
    const email = data.email || data.ownerEmail;
    
    if (email && LEGACY_EMAILS.includes(email.toLowerCase())) {
      foundStores.push({
        email,
        userId: doc.id,
        storeName: data.storeName || 'N/A',
        subscriptionStatus: data.subscriptionStatus || 'none',
        subscriptionTier: data.subscriptionTier || 'none',
        isLegacyUser: data.isLegacyUser || false,
        hasUsedTrial: data.hasUsedTrial || false
      });
      
      // Remove from missing
      const index = missingUsers.indexOf(email.toLowerCase());
      if (index > -1) {
        missingUsers.splice(index, 1);
      }
    }
  });
  
  // Print found stores
  console.log('\n✅ FOUND STORES:\n');
  foundStores.forEach(store => {
    console.log(`📧 ${store.email}`);
    console.log(`   User ID: ${store.userId}`);
    console.log(`   Store: ${store.storeName}`);
    console.log(`   Subscription: ${store.subscriptionStatus} (${store.subscriptionTier})`);
    console.log(`   Legacy: ${store.isLegacyUser ? 'YES ✓' : 'NO'}`);
    console.log(`   Trial Used: ${store.hasUsedTrial ? 'YES' : 'NO'}`);
    console.log('');
  });
  
  // Print missing users
  if (missingUsers.length > 0) {
    console.log('\n⚠️  NO STORE FOUND:\n');
    missingUsers.forEach(email => {
      console.log(`   ❌ ${email}`);
    });
    console.log('\n   These users need to upgrade to admin first.\n');
  }
  
  console.log('=' .repeat(80));
  console.log(`\n📊 Summary:`);
  console.log(`   Total legacy users: ${LEGACY_EMAILS.length}`);
  console.log(`   Found with stores: ${foundStores.length}`);
  console.log(`   Missing stores: ${missingUsers.length}`);
  console.log('');
  
  // Generate updated LEGACY_USERS array
  if (foundStores.length > 0) {
    console.log('\n📝 Use this updated LEGACY_USERS array:\n');
    console.log('const LEGACY_USERS = [');
    foundStores.forEach(store => {
      const tier = store.email === 'sawtonaorganization@gmail.com' ? 'premium' : 'pro';
      console.log(`  {`);
      console.log(`    email: '${store.email}',`);
      console.log(`    userId: '${store.userId}',`);
      console.log(`    tier: '${tier}' as const,`);
      console.log(`    note: 'Store: ${store.storeName}'`);
      console.log(`  },`);
    });
    console.log('];\n');
  }
}

checkStores()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n💥 Error:', error);
    process.exit(1);
  });
