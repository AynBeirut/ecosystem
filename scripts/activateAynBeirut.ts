/**
 * Activate legacy user: info@aynbeirut.com
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

// Dates
const LEGACY_EXPIRY_DATE = new Date('2027-02-28T23:59:59Z');
const TODAY = new Date('2026-02-28T00:00:00Z');

async function activateAynBeirut() {
  const userId = 'Av22LKyet8QmVcu9b8Njz1HVfoy1';
  const email = 'info@aynbeirut.com';
  const tier = 'pro';
  
  console.log(`\n🚀 Activating legacy user: ${email}`);
  console.log(`   User ID: ${userId}`);
  console.log(`   Tier: ${tier.toUpperCase()}`);
  console.log(`   Free until: ${LEGACY_EXPIRY_DATE.toLocaleDateString()}\n`);
  
  try {
    const storeRef = db.collection('storeProfiles').doc(userId);
    const storeSnap = await storeRef.get();
    
    if (!storeSnap.exists) {
      console.error('❌ Store not found!');
      return;
    }
    
    console.log('✅ Store found');
    
    const updateData = {
      // Legacy user flags
      isLegacyUser: true,
      legacyActivatedAt: TODAY.toISOString(),
      legacyExpiresAt: LEGACY_EXPIRY_DATE.toISOString(),
      
      // Subscription status
      subscriptionStatus: 'active',
      subscriptionTier: tier,
      
      // Dates
      subscriptionStartedAt: TODAY.toISOString(),
      subscriptionEndsAt: LEGACY_EXPIRY_DATE.toISOString(),
      nextBillingDate: LEGACY_EXPIRY_DATE.toISOString(),
      
      // Mark as not trial user
      isTrialUser: false,
      hasUsedTrial: false,
      
      // Update timestamp
      updatedAt: new Date().toISOString(),
      
      // Add note about migration
      migrationNotes: 'Legacy user - 1 year free Pro access granted on Feb 28, 2026'
    };
    
    await storeRef.update(updateData);
    
    console.log('\n✅ Successfully activated!');
    console.log(`   Status: active`);
    console.log(`   Tier: ${tier}`);
    console.log(`   Expires: ${LEGACY_EXPIRY_DATE.toLocaleDateString()}\n`);
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  }
}

activateAynBeirut()
  .then(() => {
    console.log('✨ Done!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
