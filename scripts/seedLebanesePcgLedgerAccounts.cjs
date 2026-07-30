#!/usr/bin/env node
/**
 * Backfill full Lebanese PCG chart into store ledgerAccounts (522 rows + operational).
 *
 *   node scripts/seedLebanesePcgLedgerAccounts.cjs STORE_ID
 *   node scripts/seedLebanesePcgLedgerAccounts.cjs STORE_ID --write
 *   node scripts/seedLebanesePcgLedgerAccounts.cjs --all-lebanese --write
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const admin = require(path.join(repoRoot, 'functions', 'node_modules', 'firebase-admin'));
const {
  buildDefaultLedgerAccounts,
  coaModeVersion,
  ledgerAccountDocId,
} = require(path.join(repoRoot, 'functions', 'lib', 'lib', 'ledger', 'defaultChartOfAccounts.js'));
const { buildLebanesePcgCoaSeedRows } = require(path.join(
  repoRoot,
  'functions',
  'lib',
  'lib',
  'ledger',
  'lebanesePcgLedgerSeed.js',
));

const serviceAccountPath = path.join(repoRoot, 'serviceAccountKey.json');
if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ serviceAccountKey.json not found');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))),
    projectId: 'market-flow-7b074',
  });
}

const db = admin.firestore();
const BATCH_LIMIT = 400;
const args = process.argv.slice(2);
const write = args.includes('--write');
const allLebanese = args.includes('--all-lebanese');
const storeIds = args.filter((a) => !a.startsWith('--'));

async function loadStoreIds() {
  if (storeIds.length) return storeIds;
  if (!allLebanese) {
    console.error('Usage: node scripts/seedLebanesePcgLedgerAccounts.cjs STORE_ID [--write]');
    console.error('   or: node scripts/seedLebanesePcgLedgerAccounts.cjs --all-lebanese --write');
    process.exit(1);
  }
  const snap = await db.collection('storeProfiles').where('accountingMode', '==', 'lebanese').get();
  return snap.docs.map((d) => d.id);
}

async function seedStore(storeId) {
  const profile = await db.collection('storeProfiles').doc(storeId).get();
  const mode = profile.exists && profile.data()?.accountingMode === 'lebanese' ? 'lebanese' : 'international';
  if (mode !== 'lebanese') {
    console.log(`⏭  ${storeId}: not lebanese — skipped`);
    return { storeId, skipped: true };
  }

  const col = db.collection('stores').doc(storeId).collection('ledgerAccounts');
  const existingSnap = await col.get();
  const existingCodes = new Set(existingSnap.docs.map((d) => String(d.data().code)));
  const seeds = buildDefaultLedgerAccounts(storeId, 'lebanese');
  const missing = seeds.filter((s) => !existingCodes.has(s.code));
  const pcgCount = buildLebanesePcgCoaSeedRows().length;

  console.log(
    `${write ? '✍' : '👀'} ${storeId}: existing ${existingSnap.size}, target ${seeds.length} (${pcgCount} PCG), missing ${missing.length}`,
  );

  if (!write || missing.length === 0) {
    return { storeId, existing: existingSnap.size, missing: missing.length, created: 0 };
  }

  for (let i = 0; i < missing.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const seed of missing.slice(i, i + BATCH_LIMIT)) {
      batch.set(col.doc(ledgerAccountDocId(seed.code)), seed);
    }
    await batch.commit();
  }

  await db.collection('stores').doc(storeId).collection('ledgerMeta').doc('coa').set(
    {
      storeId,
      initialized: true,
      coaMode: 'lebanese',
      coaVersion: coaModeVersion('lebanese'),
      accountCount: existingSnap.size + missing.length,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );

  return { storeId, existing: existingSnap.size, missing: missing.length, created: missing.length };
}

(async () => {
  const ids = await loadStoreIds();
  const results = [];
  for (const storeId of ids) {
    results.push(await seedStore(storeId));
  }
  console.log(JSON.stringify({ write, results }, null, 2));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
