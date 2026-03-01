/**
 * Check y.malek@nip-lb.com current status
 * IMPORTANT: Real paying client - do NOT overwrite their subscription
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

async function checkYMalek() {
  console.log('\n🔍 Checking y.malek@nip-lb.com status...\n');
  
  try {
    // Get user from Firebase Auth
    const userRecord = await admin.auth().getUserByEmail('y.malek@nip-lb.com');
    console.log('📧 Email:', userRecord.email);
    console.log('🆔 User ID:', userRecord.uid);
    console.log('📅 Created:', new Date(userRecord.metadata.creationTime).toLocaleDateString());
    
    // Check storeProfile
    const storeRef = db.collection('storeProfiles').doc(userRecord.uid);
    const storeSnap = await storeRef.get();
    
    if (!storeSnap.exists) {
      console.log('\n⚠️  No storeProfile found for this UID');
      console.log('   Checking all storeProfiles for this email...\n');
      
      // Search all storeProfiles for this email
      const allStores = await db.collection('storeProfiles').get();
      let found = false;
      
      allStores.forEach(doc => {
        const data = doc.data();
        if (data.email === 'y.malek@nip-lb.com' || data.ownerEmail === 'y.malek@nip-lb.com') {
          found = true;
          console.log('✅ Found storeProfile under different UID:');
          console.log('   Document ID:', doc.id);
          console.log('   Store Name:', data.storeName);
          console.log('   Email:', data.email);
          console.log('   Owner Email:', data.ownerEmail);
          console.log('   Subscription Status:', data.subscriptionStatus);
          console.log('   Subscription Tier:', data.subscriptionTier);
          console.log('   Subscription Ends:', data.subscriptionEndsAt);
          console.log('   Is Legacy:', data.isLegacyUser);
          console.log('   Created:', data.createdAt);
        }
      });
      
      if (!found) {
        console.log('❌ No storeProfile found for y.malek@nip-lb.com anywhere');
      }
    } else {
      const data = storeSnap.data();
      console.log('\n✅ StoreProfile found:');
      console.log('   Store Name:', data?.storeName);
      console.log('   Email:', data?.email);
      console.log('   Owner Email:', data?.ownerEmail);
      console.log('   Subscription Status:', data?.subscriptionStatus);
      console.log('   Subscription Tier:', data?.subscriptionTier);
      console.log('   Subscription Started:', data?.subscriptionStartedAt);
      console.log('   Subscription Ends:', data?.subscriptionEndsAt);
      console.log('   Is Legacy:', data?.isLegacyUser);
      console.log('   Created:', data?.createdAt);
      console.log('\n💰 PAYMENT INFO:');
      console.log('   This is a REAL PAYING CLIENT');
      console.log('   Do NOT overwrite their subscription');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkYMalek()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
