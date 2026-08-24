#!/usr/bin/env node
/**
 * Mark inventory/accounting seo_content rows published after live blog deploy.
 *   node scripts/publishSeoClusterContent.cjs --write
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const admin = require(path.join(repoRoot, 'functions', 'node_modules', 'firebase-admin'));
const serviceAccountPath = path.join(repoRoot, 'serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))),
    projectId: 'market-flow-7b074',
  });
}

const WRITE = process.argv.includes('--write');
const TODAY = '2026-08-21';

async function main() {
  const db = admin.firestore();
  const snap = await db.collection('seo_content').get();
  const rows = snap.docs.filter((d) => {
    const p = d.data().pillarSlug;
    return p === 'inventory' || p === 'accounting';
  });

  console.log(`Found ${rows.length} inventory/accounting content rows.`);
  if (!WRITE) {
    rows.forEach((d) => console.log(`  ${d.data().status}  ${d.data().assignedUrl}  ${d.data().title}`));
    console.log('\nDry run — pass --write to set status=published.');
    return;
  }

  const batch = db.batch();
  const now = admin.firestore.FieldValue.serverTimestamp();
  for (const d of rows) {
    batch.update(d.ref, {
      status: 'published',
      publishDate: TODAY,
      updatedAt: now,
    });
  }
  await batch.commit();
  console.log(`✅ Marked ${rows.length} rows published.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
