/**
 * Upgrade anwar.abouhassan@gmail.com to Business tier
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

async function upgradeToBusinessTier() {
  try {
    console.log('\n🔧 Upgrading anwar.abouhassan@gmail.com to Business tier...\n');

    // Get user ID
    const userRecord = await admin.auth().getUserByEmail('anwar.abouhassan@gmail.com');
    const userId = userRecord.uid;
    console.log(`📧 Email: anwar.abouhassan@gmail.com`);
    console.log(`🆔 User ID: ${userId}`);

    // Update storeProfile
    const storeProfileRef = db.collection('storeProfiles').doc(userId);
    const storeDoc = await storeProfileRef.get();

    if (!storeDoc.exists) {
      console.log('❌ No storeProfile found!');
      return;
    }

    const currentData = storeDoc.data();
    console.log(`\n📊 Current Status:`);
    console.log(`   Tier: ${currentData?.subscriptionTier || 'none'}`);
    console.log(`   Status: ${currentData?.subscriptionStatus || 'none'}`);

    // Update to Business tier
    await storeProfileRef.update({
      subscriptionTier: 'business',
      subscriptionStatus: 'active',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`\n✅ Successfully upgraded to Business tier!`);
    
    // Verify the update
    const updatedDoc = await storeProfileRef.get();
    const updatedData = updatedDoc.data();
    console.log(`\n📊 New Status:`);
    console.log(`   Tier: ${updatedData?.subscriptionTier}`);
    console.log(`   Status: ${updatedData?.subscriptionStatus}`);
    console.log(`   Subscription Ends: ${updatedData?.subscriptionEndDate?.toDate?.() || 'N/A'}`);
    
    console.log('\n🎉 Upgrade complete! Account now has Business tier access.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

upgradeToBusinessTier();
