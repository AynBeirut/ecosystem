#!/usr/bin/env npx tsx
/**
 * Map legacy tiers → modular next* fields for renewal migration.
 *   npx tsx scripts/mapLegacyToModular.ts           # dry-run CSV to stdout
 *   npx tsx scripts/mapLegacyToModular.ts --write   # staging only
 */

import admin from 'firebase-admin';
import { mapLegacyTierToModular } from '../src/lib/legacyPlanMapping';

const dryRun = !process.argv.includes('--write');

async function main() {
  if (!admin.apps.length) admin.initializeApp();
  const db = admin.firestore();
  const snap = await db.collection('storeProfiles').get();

  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'WRITE'} | Stores: ${snap.size}`);
  console.log('storeId,tier,nextPreset,nextSeats,manualReview,notes');

  for (const docSnap of snap.docs) {
    const data = docSnap.data() as Record<string, unknown>;
    if (data.pricingVersion === 'modular-v2') continue;

    const plan = mapLegacyTierToModular(data);
    const tier = data.subscriptionTier ?? 'starter';
    const notes = plan.notes.join('; ');

    console.log(
      [docSnap.id, tier, plan.nextPlanPreset, plan.nextSeatCount, plan.manualReview, `"${notes}"`].join(','),
    );

    if (!dryRun) {
      const renewalAt = data.subscriptionEndsAt
        ? new Date(String(data.subscriptionEndsAt)).toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      await docSnap.ref.set(
        {
          nextPlanPreset: plan.nextPlanPreset,
          nextEnabledModules: plan.nextEnabledModules,
          nextSeatCount: plan.nextSeatCount,
          nextPosLocationCount: plan.nextPosLocationCount,
          legacyPlanSnapshot: plan.legacyPlanSnapshot,
          scheduledPlanMigrationAt: renewalAt,
        },
        { merge: true },
      );
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
