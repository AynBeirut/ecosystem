#!/usr/bin/env node
/**
 * Backup → migrate store to Lebanese accounting (v1: same codes + nameAr) → verify.
 *
 *   node scripts/migrateStoreLebaneseAccounting.cjs EZfuoNQFTJVU4cubNuckpp4K7zw2 --write
 *   node scripts/migrateStoreLebaneseAccounting.cjs EZfuoNQFTJVU4cubNuckpp4K7zw2 --verify-only <backupDir>
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const admin = require(path.join(repoRoot, 'functions', 'node_modules', 'firebase-admin'));
const { resolveChartOfAccounts, coaModeVersion } = require(path.join(
  repoRoot,
  'functions',
  'lib',
  'lib',
  'ledger',
  'coaTemplates.js',
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

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

async function loadSubcollection(storeId, name) {
  const snap = await db.collection('stores').doc(storeId).collection(name).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function aggregateLinesByCode(lines) {
  const map = new Map();
  for (const line of lines) {
    const code = String(line.accountCode || '');
    if (!code) continue;
    const prev = map.get(code) || { debit: 0, credit: 0, lineCount: 0 };
    prev.debit = round2(prev.debit + Number(line.debit || 0));
    prev.credit = round2(prev.credit + Number(line.credit || 0));
    prev.lineCount += 1;
    map.set(code, prev);
  }
  return Object.fromEntries([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function accountFingerprint(accounts) {
  return accounts
    .map((a) => ({
      id: a.id,
      code: String(a.code),
      name: String(a.name || ''),
      nameAr: a.nameAr ? String(a.nameAr) : undefined,
      type: a.type,
      normalBalance: a.normalBalance,
      isActive: a.isActive !== false,
      isSystem: a.isSystem === true,
      openingBalance: round2(Number(a.openingBalance) || 0),
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

function jeFingerprint(entries) {
  return entries
    .map((e) => ({
      id: e.id,
      date: e.date,
      status: e.status,
      sourceKey: e.sourceKey,
      event: e.event,
      currency: e.currency,
      memo: e.memo,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

async function createBackup(storeId) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(repoRoot, 'backups', `emoove-lebanese-pre-${storeId}-${ts}`);
  fs.mkdirSync(backupDir, { recursive: true });

  const profileSnap = await db.collection('storeProfiles').doc(storeId).get();
  const coaMetaSnap = await db.collection('stores').doc(storeId).collection('ledgerMeta').doc('coa').get();
  const [ledgerAccounts, journalEntries, journalLines] = await Promise.all([
    loadSubcollection(storeId, 'ledgerAccounts'),
    loadSubcollection(storeId, 'journalEntries'),
    loadSubcollection(storeId, 'journalLines'),
  ]);

  const postedEntries = journalEntries.filter((e) => e.status === 'posted');
  const snapshot = {
    storeId,
    backedUpAt: new Date().toISOString(),
    storeProfile: profileSnap.exists ? { id: profileSnap.id, ...profileSnap.data() } : null,
    ledgerMetaCoa: coaMetaSnap.exists ? coaMetaSnap.data() : null,
    ledgerAccounts,
    journalEntries,
    journalLines,
    fingerprints: {
      accountCodes: ledgerAccounts.map((a) => String(a.code)).sort(),
      accounts: accountFingerprint(ledgerAccounts),
      postedJournalEntryIds: postedEntries.map((e) => e.id).sort(),
      journalEntryCount: journalEntries.length,
      postedJournalEntryCount: postedEntries.length,
      journalLineCount: journalLines.length,
      lineTotalsByAccountCode: aggregateLinesByCode(journalLines),
      totalDebits: round2(journalLines.reduce((s, l) => s + Number(l.debit || 0), 0)),
      totalCredits: round2(journalLines.reduce((s, l) => s + Number(l.credit || 0), 0)),
    },
  };

  fs.writeFileSync(path.join(backupDir, 'accounting-snapshot.json'), JSON.stringify(snapshot, null, 2));
  fs.writeFileSync(
    path.join(backupDir, 'README.md'),
    `# E-Moove Lebanese accounting pre-migration backup\n\nStore: ${storeId}\nDate: ${snapshot.backedUpAt}\n\nRestore reference only — journal/GL integrity fingerprints in accounting-snapshot.json\n`,
  );

  console.log(`✅ Backup written: ${backupDir}`);
  console.log(`   accounts: ${ledgerAccounts.length}, JEs: ${journalEntries.length} (${postedEntries.length} posted), lines: ${journalLines.length}`);
  return { backupDir, snapshot };
}

async function migrateToLebanese(storeId, snapshot) {
  const lbTemplate = resolveChartOfAccounts('lebanese');
  const arByCode = new Map(lbTemplate.filter((r) => r.nameAr).map((r) => [r.code, r.nameAr]));

  const profileRef = db.collection('storeProfiles').doc(storeId);
  const profile = snapshot.storeProfile || {};
  const profilePatch = {
    accountingMode: 'lebanese',
    accountingLanguage: profile.accountingLanguage || 'bilingual',
    updatedAt: new Date().toISOString(),
  };
  if (!profile.secondaryCurrency) {
    profilePatch.secondaryCurrency = 'LBP';
  }

  const batch = db.batch();
  let nameArUpdates = 0;
  for (const acct of snapshot.ledgerAccounts) {
    const nameAr = arByCode.get(String(acct.code));
    if (!nameAr) continue;
    if (acct.nameAr === nameAr) continue;
    const ref = db.collection('stores').doc(storeId).collection('ledgerAccounts').doc(acct.id);
    batch.set(ref, { nameAr, updatedAt: new Date().toISOString() }, { merge: true });
    nameArUpdates += 1;
  }

  batch.set(profileRef, profilePatch, { merge: true });
  batch.set(db.collection('stores').doc(storeId).collection('ledgerMeta').doc('coa'), {
    storeId,
    initialized: true,
    coaMode: 'lebanese',
    coaVersion: coaModeVersion('lebanese'),
    migratedToLebaneseAt: new Date().toISOString(),
    previousCoaVersion: snapshot.ledgerMetaCoa?.coaVersion || snapshot.ledgerMetaCoa?.coaMode || 'international',
    updatedAt: new Date().toISOString(),
  }, { merge: true });

  await batch.commit();

  console.log('✅ Migration applied');
  console.log(`   profile: accountingMode=lebanese, language=${profilePatch.accountingLanguage}, secondary=${profilePatch.secondaryCurrency || profile.secondaryCurrency || '(unchanged)'}`);
  console.log(`   nameAr merged on ${nameArUpdates} accounts`);
}

async function loadCurrentSnapshot(storeId) {
  const profileSnap = await db.collection('storeProfiles').doc(storeId).get();
  const coaMetaSnap = await db.collection('stores').doc(storeId).collection('ledgerMeta').doc('coa').get();
  const [ledgerAccounts, journalEntries, journalLines] = await Promise.all([
    loadSubcollection(storeId, 'ledgerAccounts'),
    loadSubcollection(storeId, 'journalEntries'),
    loadSubcollection(storeId, 'journalLines'),
  ]);
  const postedEntries = journalEntries.filter((e) => e.status === 'posted');
  return {
    storeProfile: profileSnap.exists ? { id: profileSnap.id, ...profileSnap.data() } : null,
    ledgerMetaCoa: coaMetaSnap.exists ? coaMetaSnap.data() : null,
    ledgerAccounts,
    journalEntries,
    journalLines,
    fingerprints: {
      accountCodes: ledgerAccounts.map((a) => String(a.code)).sort(),
      accounts: accountFingerprint(ledgerAccounts),
      postedJournalEntryIds: postedEntries.map((e) => e.id).sort(),
      journalEntryCount: journalEntries.length,
      postedJournalEntryCount: postedEntries.length,
      journalLineCount: journalLines.length,
      lineTotalsByAccountCode: aggregateLinesByCode(journalLines),
      totalDebits: round2(journalLines.reduce((s, l) => s + Number(l.debit || 0), 0)),
      totalCredits: round2(journalLines.reduce((s, l) => s + Number(l.credit || 0), 0)),
    },
  };
}

function compareSnapshots(before, after, storeId) {
  const issues = [];
  const b = before.fingerprints;
  const a = after.fingerprints;

  const eqJson = (x, y, label) => {
    const xs = JSON.stringify(x);
    const ys = JSON.stringify(y);
    if (xs !== ys) issues.push(label);
  };

  eqJson(b.accountCodes, a.accountCodes, 'Account code set changed');
  eqJson(b.postedJournalEntryIds, a.postedJournalEntryIds, 'Posted journal entry IDs changed');
  if (b.journalEntryCount !== a.journalEntryCount) issues.push('Journal entry count changed');
  if (b.postedJournalEntryCount !== a.postedJournalEntryCount) issues.push('Posted JE count changed');
  if (b.journalLineCount !== a.journalLineCount) issues.push('Journal line count changed');
  eqJson(b.lineTotalsByAccountCode, a.lineTotalsByAccountCode, 'Per-account GL line totals changed');
  if (b.totalDebits !== a.totalDebits) issues.push(`Total debits changed (${b.totalDebits} → ${a.totalDebits})`);
  if (b.totalCredits !== a.totalCredits) issues.push(`Total credits changed (${b.totalCredits} → ${a.totalCredits})`);

  for (const acct of b.accounts) {
    const live = a.accounts.find((x) => x.code === acct.code);
    if (!live) {
      issues.push(`Missing account code ${acct.code}`);
      continue;
    }
    if (acct.name !== live.name) issues.push(`Account ${acct.code} English name changed`);
    if (acct.openingBalance !== live.openingBalance) issues.push(`Account ${acct.code} opening balance changed`);
    if (acct.isActive !== live.isActive) issues.push(`Account ${acct.code} isActive changed`);
  }

  const profileBefore = before.storeProfile || {};
  const profileAfter = after.storeProfile || {};
  if (profileBefore.subscriptionTier !== profileAfter.subscriptionTier) {
    issues.push('subscriptionTier changed');
  }
  if (profileBefore.subscriptionStatus !== profileAfter.subscriptionStatus) {
    issues.push('subscriptionStatus changed');
  }
  if (profileAfter.accountingMode !== 'lebanese') {
    issues.push(`accountingMode not lebanese (got ${profileAfter.accountingMode})`);
  }
  if (!profileAfter.accountingLanguage) {
    issues.push('accountingLanguage missing after migration');
  }

  const arCount = after.ledgerAccounts.filter((x) => x.nameAr).length;
  const arBefore = before.ledgerAccounts.filter((x) => x.nameAr).length;

  console.log('\n=== Migration verification ===');
  console.log(`Store: ${storeId}`);
  console.log(`Accounts: ${a.accounts.length} (nameAr before ${arBefore} → after ${arCount})`);
  console.log(`Posted JEs: ${a.postedJournalEntryCount} (unchanged expected)`);
  console.log(`GL line totals by code: ${issues.some((i) => i.includes('totals')) ? 'MISMATCH' : 'MATCH'}`);
  console.log(`coaMode: ${after.ledgerMetaCoa?.coaMode || 'unset'} / ${after.ledgerMetaCoa?.coaVersion || ''}`);

  if (issues.length === 0) {
    console.log('\n✅ PASS — GL data intact; Lebanese profile/labels applied.');
    return 0;
  }

  console.log('\n❌ FAIL — issues:');
  for (const issue of issues) console.log(`   - ${issue}`);
  return 1;
}

async function main() {
  const storeId = process.argv[2];
  if (!storeId) {
    console.error('Usage: node scripts/migrateStoreLebaneseAccounting.cjs <storeId> [--write] [--verify-only <backupDir>]');
    process.exit(1);
  }

  const write = process.argv.includes('--write');
  const verifyOnlyIdx = process.argv.indexOf('--verify-only');
  const verifyOnlyDir = verifyOnlyIdx >= 0 ? process.argv[verifyOnlyIdx + 1] : null;

  if (verifyOnlyDir) {
    const before = JSON.parse(fs.readFileSync(path.join(verifyOnlyDir, 'accounting-snapshot.json'), 'utf8'));
    const after = await loadCurrentSnapshot(storeId);
    process.exit(compareSnapshots(before, after, storeId));
  }

  const { backupDir, snapshot } = await createBackup(storeId);

  if (!write) {
    console.log('\nDry run only. Re-run with --write to apply Lebanese migration.');
    process.exit(0);
  }

  await migrateToLebanese(storeId, snapshot);
  const after = await loadCurrentSnapshot(storeId);
  const reportPath = path.join(backupDir, 'post-migration-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ backupDir, after }, null, 2));

  const code = compareSnapshots(snapshot, after, storeId);
  console.log(`\nBackup folder: ${backupDir}`);
  console.log(`Report: ${reportPath}`);
  process.exit(code);
}

main().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
