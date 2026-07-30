#!/usr/bin/env node
/**
 * Verifies per-store accounting mode COA resolver + seed shape (no Firestore writes).
 * Run: node scripts/verifyAccountingModeE2E.cjs
 * Optional live check: node scripts/verifyAccountingModeE2E.cjs --store <storeId>
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function loadCompiledCoa() {
  const compiled = path.join(repoRoot, 'functions', 'lib', 'lib', 'ledger', 'coaTemplates.js');
  if (!fs.existsSync(compiled)) {
    throw new Error(`Missing compiled module ${compiled} — run npm run build in functions/ first`);
  }
  return require(compiled);
}

function loadCompiledDefaultCoa() {
  const compiled = path.join(repoRoot, 'functions', 'lib', 'lib', 'ledger', 'defaultChartOfAccounts.js');
  if (!fs.existsSync(compiled)) {
    throw new Error(`Missing compiled module ${compiled} — run npm run build in functions/ first`);
  }
  return require(compiled);
}

async function verifyResolver() {
  const {
    resolveChartOfAccounts,
    coaModeVersion,
    INTERNATIONAL_CHART_OF_ACCOUNTS,
    LEBANESE_CHART_OF_ACCOUNTS,
  } = loadCompiledCoa();
  const { buildDefaultLedgerAccounts, GL_ACCOUNT_CODES } = loadCompiledDefaultCoa();

  const intl = resolveChartOfAccounts('international');
  const lb = resolveChartOfAccounts('lebanese');

  assert(intl.length === 66, `international COA expected 66 accounts, got ${intl.length}`);
  assert(lb.length === 66, `lebanese COA expected 66 accounts, got ${lb.length}`);
  assert(intl === INTERNATIONAL_CHART_OF_ACCOUNTS, 'international resolver mismatch');
  assert(lb === LEBANESE_CHART_OF_ACCOUNTS, 'lebanese resolver mismatch');
  assert(coaModeVersion('international') === 'international-3digit-66', 'intl version tag');
  assert(coaModeVersion('lebanese') === 'lebanese-bilingual-v1', 'lb version tag');

  const postingCodes = Object.values(GL_ACCOUNT_CODES);
  for (const code of postingCodes) {
    assert(intl.some((r) => r.code === code), `missing posting code ${code} in intl`);
    assert(lb.some((r) => r.code === code), `missing posting code ${code} in lb`);
  }

  const lbSeeds = buildDefaultLedgerAccounts('test-store', 'lebanese');
  const arTagged = lbSeeds.filter((a) => a.nameAr);
  assert(arTagged.length >= 10, `expected Arabic labels on lebanese seeds, got ${arTagged.length}`);
  assert(lbSeeds.find((a) => a.code === GL_ACCOUNT_CODES.AP)?.nameAr, 'AP should have nameAr');

  const intlSeeds = buildDefaultLedgerAccounts('test-store', 'international');
  assert(!intlSeeds.some((a) => a.nameAr), 'international seeds should not carry nameAr by default');

  console.log('✅ COA resolver + seed shape checks passed');
  console.log(`   international: ${intl.length} accounts, version ${coaModeVersion('international')}`);
  console.log(`   lebanese: ${lb.length} accounts, ${arTagged.length} with nameAr, version ${coaModeVersion('lebanese')}`);
}

async function verifyLiveStore(storeId) {
  const serviceAccountPath = path.join(repoRoot, 'serviceAccountKey.json');
  if (!fs.existsSync(serviceAccountPath)) {
    console.log('⏭️  Skipping live store check (no serviceAccountKey.json)');
    return;
  }
  const admin = require(path.join(repoRoot, 'functions', 'node_modules', 'firebase-admin'));
  if (!admin.apps.length) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'market-flow-7b074',
    });
  }
  const db = admin.firestore();
  const profileSnap = await db.collection('storeProfiles').doc(storeId).get();
  assert(profileSnap.exists, `storeProfiles/${storeId} not found`);
  const profile = profileSnap.data() || {};
  const mode = String(profile.accountingMode || 'international').toLowerCase();
  const coaMeta = await db.collection('stores').doc(storeId).collection('ledgerMeta').doc('coa').get();
  const coa = coaMeta.exists ? coaMeta.data() || {} : {};
  console.log(`✅ Live store ${storeId}: accountingMode=${mode}, coaMode=${coa.coaMode || 'unset'}, locked=${profile.accountingModeLocked === true}`);
}

async function main() {
  await verifyResolver();
  const storeArg = process.argv.indexOf('--store');
  if (storeArg >= 0 && process.argv[storeArg + 1]) {
    await verifyLiveStore(process.argv[storeArg + 1]);
  }
}

main().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
