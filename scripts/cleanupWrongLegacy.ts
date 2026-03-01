/**
 * Clean up incorrect legacy activations
 * Remove info@emoove.co and info@aynbeirut.com from legacy (they will be sub-users)
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

async function cleanupWrongLegacyUsers() {
  console.log('\n🧹 Cleaning up incorrect legacy activations...\n');
  console.log('='.repeat(80));
  
  // Users to remove legacy status from (will be added as sub-users instead)
  const usersToClean = [
    { email: 'info@emoove.co', userId: '1HfsBr45XYM5SkaaazWegmyqGpA3' },
    { email: 'info@aynbeirut.com', userId: 'Av22LKyet8QmVcu9b8Njz1HVfoy1' }
  ];
  
  for (const user of usersToClean) {
    console.log(`\n📝 Processing: ${user.email} (${user.userId})`);
    
    try {
      const storeRef = db.collection('storeProfiles').doc(user.userId);
      const storeSnap = await storeRef.get();
      
      if (!storeSnap.exists) {
        console.log(`   ⚠️  No store found - skipping`);
        continue;
      }
      
      // Remove all legacy and subscription fields
      await storeRef.update({
        isLegacyUser: admin.firestore.FieldValue.delete(),
        legacyActivatedAt: admin.firestore.FieldValue.delete(),
        legacyExpiresAt: admin.firestore.FieldValue.delete(),
        subscriptionStatus: admin.firestore.FieldValue.delete(),
        subscriptionTier: admin.firestore.FieldValue.delete(),
        subscriptionStartedAt: admin.firestore.FieldValue.delete(),
        subscriptionEndsAt: admin.firestore.FieldValue.delete(),
        nextBillingDate: admin.firestore.FieldValue.delete(),
        migrationNotes: admin.firestore.FieldValue.delete(),
        updatedAt: new Date().toISOString()
      });
      
      console.log(`   ✅ Removed legacy status`);
      console.log(`   → This user will be added as sub-user to another store`);
      
    } catch (error) {
      console.error(`   ❌ Error:`, error);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('\n✨ Cleanup complete!');
  console.log('\n📝 Next steps:'); 
  console.log('   1. Add info@emoove.co as sub-user to a main store');
  console.log('   2. Add info@aynbeirut.com as sub-user to a main store');
  console.log('   3. Run the updated legacy migration for real legacy users\n');
}

cleanupWrongLegacyUsers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
