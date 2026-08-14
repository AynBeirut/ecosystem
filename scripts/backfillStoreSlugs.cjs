#!/usr/bin/env node
/**
 * Backfill missing store slugs from store name.
 * Usage: node scripts/backfillStoreSlugs.cjs [--write]
 */
const admin = require('firebase-admin');
const path = require('path');

const WRITE = process.argv.includes('--write');

function generateSlug(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'market-flow-7b074' });
}
const db = admin.firestore();

(async () => {
  const snap = await db.collection('storeProfiles').get();
  const used = new Set();
  snap.docs.forEach((d) => {
    const slug = d.data().slug?.trim()?.toLowerCase();
    if (slug) used.add(slug);
  });

  const planned = [];
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const existing = data.slug?.trim();
    if (existing) continue;
    const base = generateSlug(data.name || data.storeName || docSnap.id);
    let candidate = base || `store-${docSnap.id.slice(0, 6).toLowerCase()}`;
    let n = 2;
    while (used.has(candidate)) {
      candidate = `${base}-${n}`;
      n += 1;
    }
    used.add(candidate);
    planned.push({ id: docSnap.id, name: data.name || data.storeName, slug: candidate });
  }

  console.log(`Stores missing slug: ${planned.length}`);
  planned.forEach((p) => console.log(`  ${p.name} → ${p.slug}.grabio.space (${p.id})`));

  if (!WRITE) {
    console.log('\nDry run. Pass --write to apply.');
    return;
  }

  for (const p of planned) {
    await db.collection('storeProfiles').doc(p.id).update({
      slug: p.slug,
      updatedAt: new Date().toISOString(),
    });
    console.log(`Updated ${p.id} → slug=${p.slug}`);
  }
  console.log('Done.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
