#!/usr/bin/env npx tsx
/**
 * Apply scheduled legacy → modular migrations when renewal date has passed.
 *   npx tsx scripts/processRenewalMigrations.ts           # dry-run
 *   npx tsx scripts/processRenewalMigrations.ts --write # staging only
 */

import admin from 'firebase-admin';
import { applyRenewalMigration } from '../src/lib/legacyPlanMapping';

const dryRun = !process.argv.includes('--write');

async function main() {
  if (!admin.apps.length) admin.initializeApp();
  const db = admin.firestore();
  const now = new Date();
  const snap = await db.collection('storeProfiles').get();

  let eligible = 0;
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (data.pricingVersion === 'modular-v2') continue;
    if (!data.scheduledPlanMigrationAt) continue;

    const migrationAt = new Date(String(data.scheduledPlanMigrationAt));
    if (migrationAt > now) continue;

    eligible += 1;
    const patch = applyRenewalMigration(data);
    console.log(JSON.stringify({ storeId: docSnap.id, patch }));
    if (!dryRun) {
      await docSnap.ref.set(patch, { merge: true });
    }
  }

  console.log(`Done. Eligible for migration: ${eligible} (${dryRun ? 'dry-run' : 'written'})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
