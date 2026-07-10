#!/usr/bin/env node
/**
 * GL Period Lock E2E — close period, block post/edit, reopen with audit.
 *
 * Usage:
 *   node scripts/verifyGlPeriodLockE2E.cjs
 *   node scripts/verifyGlPeriodLockE2E.cjs --keep
 */
const admin = require('firebase-admin');
const path = require('path');

const KEEP = process.argv.includes('--keep');

const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'market-flow-7b074' });
}

const functionsAdmin = require('../functions/node_modules/firebase-admin');
if (!functionsAdmin.apps.length) {
  functionsAdmin.initializeApp({
    credential: functionsAdmin.credential.cert(serviceAccount),
    projectId: 'market-flow-7b074',
  });
}

const db = admin.firestore();
const testRunId = `gl-period-lock-e2e-${Date.now()}`;
const storeId = `test-${testRunId}`;

const {
  ensureDefaultChartOfAccounts,
  postJournalEntry,
  accountsMap,
  accountByCode,
} = require('../functions/lib/lib/ledger/postingService');
const {
  closeLedgerPeriod,
  reopenLedgerPeriod,
  updateJournalEntryMemo,
  deleteJournalEntry,
  loadPeriodClosures,
} = require('../functions/lib/lib/ledger/periodLock');
const { PeriodLockedError } = require('../functions/lib/lib/ledger/periodLockCore');

const ACTOR = { userId: 'e2e-admin', userEmail: 'e2e@test.local', userName: 'E2E Admin' };
const LOCKED_DATE = '2026-07-15T12:00:00.000Z';
const OPEN_DATE = '2026-08-01T12:00:00.000Z';

function assert(c, m) { if (!c) throw new Error(m); }
function failIfResolved(label) { throw new Error(`Expected failure: ${label}`); }

async function expectPeriodLockError(fn, label) {
  try {
    await fn();
    failIfResolved(label);
  } catch (err) {
    const code = err && (err.code === 'PERIOD_LOCKED' || err.name === 'PeriodLockedError');
    assert(code || /closed/i.test(String(err.message)), `${label}: expected period lock error, got: ${err.message}`);
    return err;
  }
}

async function cleanup() {
  const collections = ['ledgerAccounts', 'journalEntries', 'journalLines', 'ledgerMeta', 'ledgerPeriodClosures'];
  for (const col of collections) {
    const snap = await db.collection('stores').doc(storeId).collection(col).get();
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    if (!snap.empty) await batch.commit();
  }
}

async function postTestEntry(accounts, dateIso, memo, eventSuffix) {
  const cash = accountByCode(accounts, '1000');
  const revenue = accountByCode(accounts, '4000');
  return postJournalEntry(
    {
      storeId,
      date: dateIso,
      memo,
      sourceType: 'manual',
      sourceId: `manual-${eventSuffix}`,
      event: 'post',
      createdBy: ACTOR.userId,
      lines: [
        { accountId: cash.id, debit: 10, credit: 0 },
        { accountId: revenue.id, debit: 0, credit: 10 },
      ],
    },
    accountsMap(accounts),
  );
}

async function main() {
  console.log(`\n=== GL Period Lock E2E — ${storeId} ===\n`);

  const accounts = await ensureDefaultChartOfAccounts(storeId);
  const map = accountsMap(accounts);

  // 1) Post entry in July (open period)
  const first = await postTestEntry(accounts, LOCKED_DATE, 'July sale before close', 'july-1');
  console.log('✓ Posted entry before close:', first.entryId);

  // 2) Close July 2026
  const closed = await closeLedgerPeriod(storeId, 'month', 2026, 7, ACTOR, 'E2E month-end close');
  assert(closed.isClosed === true, 'close should set isClosed');
  assert(closed.id === '2026-07', 'period id should be 2026-07');
  console.log('✓ Closed period:', closed.label);

  // 3) Attempt post in closed period — should fail
  await expectPeriodLockError(
    () => postTestEntry(accounts, LOCKED_DATE, 'Should fail', 'july-blocked'),
    'post in closed period',
  );
  console.log('✓ Blocked new post in closed period');

  // 4) Attempt edit existing entry in closed period — should fail
  await expectPeriodLockError(
    () => updateJournalEntryMemo(storeId, first.entryId, 'Tampered memo'),
    'edit entry in closed period',
  );
  console.log('✓ Blocked edit of entry in closed period');

  // 5) Attempt delete existing entry in closed period — should fail
  await expectPeriodLockError(
    () => deleteJournalEntry(storeId, first.entryId),
    'delete entry in closed period',
  );
  console.log('✓ Blocked delete of entry in closed period');

  // 6) Post in open period (August) — should succeed
  const august = await postTestEntry(accounts, OPEN_DATE, 'August after close', 'aug-1');
  console.log('✓ Posted entry in open period:', august.entryId);

  // 7) Reopen July with audit reason
  const reopened = await reopenLedgerPeriod(storeId, '2026-07', ACTOR, 'E2E correction — adjust accrual');
  assert(reopened.isClosed === false, 'reopen should clear isClosed');
  const history = reopened.history || [];
  assert(history.length >= 2, 'history should include close + reopen');
  const reopenEvent = history[history.length - 1];
  assert(reopenEvent.action === 'reopen', 'last event should be reopen');
  assert(reopenEvent.userId === ACTOR.userId, 'reopen should log userId');
  assert(reopenEvent.reason === 'E2E correction — adjust accrual', 'reopen should log reason');
  console.log('✓ Reopened period with audit trail:', reopenEvent.at);

  // 8) Post in reopened period — should succeed
  const afterReopen = await postTestEntry(accounts, LOCKED_DATE, 'July after reopen', 'july-2');
  console.log('✓ Posted entry after reopen:', afterReopen.entryId);

  // 9) Verify closure doc persisted
  const closures = await loadPeriodClosures(storeId);
  const july = closures.find((c) => c.id === '2026-07');
  assert(july && july.isClosed === false, 'July should be open after reopen');
  assert(july.history.filter((e) => e.action === 'reopen').length === 1, 'one reopen in history');

  console.log('\n=== PASSED — GL period lock E2E ===\n');
  console.log(JSON.stringify({
    storeId,
    closedPeriod: closed.id,
    entries: [first.entryId, august.entryId, afterReopen.entryId],
    reopenAudit: reopenEvent,
  }, null, 2));
}

main()
  .catch((err) => {
    console.error('\n=== FAILED ===\n', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (!KEEP) {
      try { await cleanup(); } catch (e) { console.warn('cleanup warning', e.message); }
    } else {
      console.log(`\n--keep: left test data at stores/${storeId}`);
    }
  });
