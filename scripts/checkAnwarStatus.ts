/**
 * Check current subscription status of anwar.abouhassan@gmail.com
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

async function checkAnwarAccount() {
  console.log('\n🔍 Checking anwar.abouhassan@gmail.com status...\n');
  
  try {
    // Get user from Firebase Auth
    const userRecord = await admin.auth().getUserByEmail('anwar.abouhassan@gmail.com');
    console.log('📧 Email:', userRecord.email);
    console.log('🆔 User ID:', userRecord.uid);
    
    // Check storeProfile
    const storeRef = db.collection('storeProfiles').doc(userRecord.uid);
    const storeSnap = await storeRef.get();
    
    if (!storeSnap.exists) {
      console.log('\n⚠️  No storeProfile found');
      console.log('   User needs to upgrade to admin first');
      console.log('   Go to: https://grabio.space/upgrade-to-admin');
    } else {
      const data = storeSnap.data();
      console.log('\n✅ StoreProfile exists:');
      console.log('   Store Name:', data?.storeName || 'Not set');
      console.log('   Subscription Status:', data?.subscriptionStatus || 'none');
      console.log('   Subscription Tier:', data?.subscriptionTier || 'none');
      console.log('   Has Used Trial:', data?.hasUsedTrial || false);
      console.log('   Is Legacy User:', data?.isLegacyUser || false);
      console.log('   Subscription Ends:', data?.subscriptionEndsAt || 'N/A');
      
      if (data?.isLegacyUser) {
        console.log('\n🎁 LEGACY USER:');
        console.log('   Free Pro access until:', data?.legacyExpiresAt);
        console.log('   ✅ Can use all Pro features without payment');
      } else if (!data?.hasUsedTrial) {
        console.log('\n💡 ELIGIBLE FOR:');
        console.log('   ✅ $1 Trial (1 month Pro access)');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAnwarAccount()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
