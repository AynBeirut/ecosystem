/**
 * Backfill storeProfiles that have legacy `storeName` but no `name`.
 * Usage: npx tsx scripts/backfillStoreProfileName.ts
 *        npx tsx scripts/backfillStoreProfileName.ts --dry-run
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';

const dryRun = process.argv.includes('--dry-run');

try {
  const serviceAccount = JSON.parse(
    readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8'),
  );
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'market-flow-7b074',
  });
} catch {
  console.error('❌ Failed to initialize Firebase Admin (serviceAccountKey.json)');
  process.exit(1);
}

const db = admin.firestore();

async function main() {
  const snap = await db.collection('storeProfiles').get();
  let updated = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const storeName = typeof data.storeName === 'string' ? data.storeName.trim() : '';
    const name = typeof data.name === 'string' ? data.name.trim() : '';

    if (!storeName || name) continue;

    const patch = {
      name: storeName,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    console.log(`${dryRun ? '[dry-run] ' : ''}storeProfiles/${docSnap.id}: storeName → name "${storeName}"`);

    if (!dryRun) {
      await docSnap.ref.update(patch);
    }
    updated += 1;
  }

  console.log(`\nDone. ${updated} document(s) ${dryRun ? 'would be' : ''} updated.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
