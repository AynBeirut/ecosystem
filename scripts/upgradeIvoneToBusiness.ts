/**
 * Upgrade yvonne.daher@gmail.com to Business tier
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
    console.log('\n🔧 Upgrading yvonne.daher@gmail.com to Business tier...\n');

    // Get user ID
    const userRecord = await admin.auth().getUserByEmail('yvonne.daher@gmail.com');
    const userId = userRecord.uid;
    console.log(`📧 Email: yvonne.daher@gmail.com`);
    console.log(`🆔 User ID: ${userId}`);

    // Update storeProfile
    const storeProfileRef = db.collection('storeProfiles').doc(userId);
    const storeDoc = await storeProfileRef.get();

    if (!storeDoc.exists) {
      console.log('⚠️  No storeProfile found - creating one...');
      
      // Create new store profile with Business tier
      await storeProfileRef.set({
        subscriptionTier: 'business',
        subscriptionStatus: 'active',
        subscriptionStartDate: admin.firestore.Timestamp.now(),
        subscriptionEndDate: admin.firestore.Timestamp.fromDate(new Date('2027-02-28T23:59:59.000Z')),
        isLegacyUser: true,
        hasUsedTrial: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      
      console.log(`✅ Created storeProfile with Business tier!`);
      
      const newDoc = await storeProfileRef.get();
      const newData = newDoc.data();
      console.log(`\n📊 New Store Status:`);
      console.log(`   Tier: ${newData?.subscriptionTier}`);
      console.log(`   Status: ${newData?.subscriptionStatus}`);
      console.log(`   Valid Until: Feb 28, 2027`);
      console.log('\n🎉 Account now has Business tier access with white-label header!');
      
      process.exit(0);
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
    console.log(`   Store Name: ${updatedData?.name || 'Not set'}`);
    console.log(`   Subscription Ends: ${updatedData?.subscriptionEndDate?.toDate?.() || 'N/A'}`);
    
    console.log('\n🎉 Upgrade complete! Account now has Business tier access.');
    console.log('White-label header will be enabled for this store.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

upgradeToBusinessTier();
