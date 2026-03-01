/**
 * Migration Script: Activate Legacy Users with 1 Year Free Access
 * 
 * This script grants 1 year free subscription to selected legacy users
 * created before February 28, 2026.
 * 
 * Usage:
 * npx tsx scripts/activateLegacyUsers.ts
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';

// Initialize Firebase Admin with service account
try {
  const serviceAccount = JSON.parse(
    readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8')
  );
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'market-flow-7b074',
  });
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin:');
  console.error('   Make sure serviceAccountKey.json exists in project root');
  console.error('   Download it from Firebase Console → Project Settings → Service Accounts');
  process.exit(1);
}

const db = admin.firestore();

// Legacy users to activate (1 year free until Feb 28, 2027)
// NOTE: info@emoove.co and info@aynbeirut.com removed - will be added as sub-users
// NOTE: h.akalfouni@nip-lb.com is already added as sub-account under y.malek@nip-lb.com
// NOTE: anwar.ah7@gmail.com removed - keeping as normal user per client request
const LEGACY_USERS = [
  {
    email: 'y.malek@nip-lb.com',
    userId: 'DfIhBAEZ5NR7yNX0HboZvv58Nf82',
    tier: 'pro' as const,
    note: '✅ ALREADY ACTIVE - Real paying client with Pro until Feb 2027. Store: info@nip-lb.com. Sub-account: h.akalfouni@nip-lb.com'
  },
  {
    email: 'anwar.abouhassan@gmail.com',
    userId: 'Av22LKyet8QmVcu9b8Njz1HVfoy1',
    tier: 'pro' as const,
    note: '✅ ALREADY ACTIVE - AYN BEIRUT store owner'
  },
  {
    email: 'mooveelectro@gmail.com',
    userId: '1HfsBr45XYM5SkaaazWegmyqGpA3',
    tier: 'pro' as const,
    note: 'Has store (info@emoove.co) - needs activation'
  },
  {
    email: 'janarawwas317@gmail.com',
    userId: 'yQV05BQkvMSxbCaBNUDxaUjjXxF3',
    tier: 'premium' as const,
    note: 'Waiting for client to upgrade to admin - PREMIUM tier'
  },
  {
    email: 'sawtonaorganization@gmail.com',
    userId: '8CnhkG94gTgWLDykXmLQIvn4B12',
    tier: 'premium' as const,
    note: 'Waiting for client to upgrade to admin - PREMIUM tier'
  }
];

// 1 year from today (Feb 28, 2026 → Feb 28, 2027)
const LEGACY_EXPIRY_DATE = new Date('2027-02-28T23:59:59Z');
const TODAY = new Date('2026-02-28T00:00:00Z');

async function activateLegacyUser(userId: string, email: string, tier: 'premium' | 'pro' = 'pro') {
  try {
    console.log(`\n📝 Processing: ${email} (${userId}) - Tier: ${tier.toUpperCase()}`);
    
    // Check if storeProfile exists
    const storeRef = db.collection('storeProfiles').doc(userId);
    const storeSnap = await storeRef.get();
    
    if (!storeSnap.exists) {
      console.log(`   ⚠️  No storeProfile found - user may not have upgraded to admin yet`);
      return { success: false, reason: 'No storeProfile' };
    }
    
    // Update storeProfile with legacy subscription
    const updateData = {
      // Legacy user flags
      isLegacyUser: true,
      legacyActivatedAt: TODAY.toISOString(),
      legacyExpiresAt: LEGACY_EXPIRY_DATE.toISOString(),
      
      // Subscription status
      subscriptionStatus: 'active',
      subscriptionTier: tier, // Use specified tier
      
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
      migrationNotes: 'Legacy user - 1 year free access granted on Feb 28, 2026'
    };
    
    await storeRef.update(updateData);
    console.log(`   ✅ Successfully activated - Free until ${LEGACY_EXPIRY_DATE.toLocaleDateString()}`);
    
    return { success: true };
  } catch (error: unknown) {
    console.error(`   ❌ Error:`, error);
    return { success: false, reason: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function main() {
  console.log('\n🚀 Starting Legacy User Migration');
  console.log(`📅 Migration Date: ${TODAY.toLocaleDateString()}`);
  console.log(`⏰ Free Access Until: ${LEGACY_EXPIRY_DATE.toLocaleDateString()}`);
  console.log(`👥 Total Users to Process: ${LEGACY_USERS.length}\n`);
  console.log('='.repeat(60));
  
  const results = {
    total: LEGACY_USERS.length,
    successful: 0,
    failed: 0,
    errors: [] as Array<{ email: string; userId: string; reason: string }>
  };
  
  for (const user of LEGACY_USERS) {
    const result = await activateLegacyUser(user.userId, user.email, user.tier);
    
    if (result.success) {
      results.successful++;
    } else {
      results.failed++;
      results.errors.push({
        email: user.email,
        userId: user.userId,
        reason: result.reason || 'Unknown error'
      });
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Migration Summary:');
  console.log(`   Total Users: ${results.total}`);
  console.log(`   ✅ Successful: ${results.successful}`);
  console.log(`   ❌ Failed: ${results.failed}`);
  
  if (results.errors.length > 0) {
    console.log('\n⚠️  Errors:');
    results.errors.forEach(err => {
      console.log(`   - ${err.email}: ${err.reason}`);
    });
  }
  
  console.log('\n✨ Migration complete!\n');
  console.log('📧 Next Steps:');
  console.log('   1. Send email notifications to activated users');
  console.log('   2. Verify users can access admin dashboard');
  console.log('   3. Set up reminder emails for February 2027');
  console.log('');
}

// Run migration
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
