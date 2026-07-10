#!/usr/bin/env node
/**
 * WIP production GL E2E — start, complete (match + variance), legacy, full reversal.
 *
 * Usage:
 *   node scripts/verifyGlWipE2E.cjs
 *   node scripts/verifyGlWipE2E.cjs --keep
 *
 * Note: AdminProduction UI complete is lockdown-blocked; this script tests GL directly.
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
const testRunId = `gl-wip-e2e-${Date.now()}`;
const storeId = `test-${testRunId}`;

const {
  ensureDefaultChartOfAccounts,
} = require('../functions/lib/lib/ledger/postingService');
const {
  autoPostProductionStart,
  autoPostProductionWipCompleteFlow,
  autoPostProductionComplete,
  autoPostProductionReversal,
} = require('../functions/lib/lib/ledger/platformAutoPosting');
const { GL_ACCOUNT_CODES } = require('../functions/lib/lib/ledger/defaultChartOfAccounts');

function nowIso() { return new Date().toISOString(); }
function round2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }
function assert(c, m) { if (!c) throw new Error(m); }

async function sumAccountBalance(code) {
  const lines = await db.collection('stores').doc(storeId).collection('journalLines')
    .where('accountCode', '==', code).get();
  let net = 0;
  lines.forEach((d) => {
    const row = d.data();
    net += round2(row.debit || 0) - round2(row.credit || 0);
  });
  return round2(net);
}

async function countEntries(batchId, eventSuffix) {
  const snap = await db.collection('stores').doc(storeId).collection('journalEntries')
    .where('sourceType', '==', 'production')
    .where('sourceId', '==', batchId)
    .get();
  return snap.docs.filter((d) => String(d.data().sourceKey || '').endsWith(`:${eventSuffix}`)).length;
}

async function cleanup() {
  for (const col of ['ledgerAccounts', 'journalEntries', 'journalLines', 'ledgerMeta']) {
    const snap = await db.collection('stores').doc(storeId).collection(col).get();
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    if (!snap.empty) await batch.commit();
  }
}

async function main() {
  console.log(`\n=== WIP Production GL E2E — ${storeId} ===\n`);

  const accounts = await ensureDefaultChartOfAccounts(storeId);
  assert(accounts.some((a) => a.code === GL_ACCOUNT_CODES.WIP_INVENTORY), '1150 WIP account should exist');

  const batchMatchId = `batch-match-${testRunId}`;
  const batchVarianceId = `batch-variance-${testRunId}`;
  const batchLegacyId = `batch-legacy-${testRunId}`;
  const batchDeleteId = `batch-delete-${testRunId}`;

  const costStart = 100;
  const costActualMatch = 100;
  const costActualHigh = 130;
  const legacyCost = 80;
  const deleteCostStart = 60;
  const deleteCostComplete = 72;
  const deleteVariance = 12;

  const startResult = await autoPostProductionStart(storeId, batchMatchId, costStart, nowIso(), accounts);
  assert(startResult && !startResult.idempotentReplay, 'Start GL should post');
  const wipAfterStart = await sumAccountBalance(GL_ACCOUNT_CODES.WIP_INVENTORY);
  const rawAfterStart = await sumAccountBalance(GL_ACCOUNT_CODES.INVENTORY);
  assert(wipAfterStart === costStart, `WIP after start ${wipAfterStart} !== ${costStart}`);
  assert(rawAfterStart === -costStart, `Raw after start ${rawAfterStart} !== ${-costStart}`);
  console.log('✓ Start → Dr WIP / Cr Raw');

  await autoPostProductionWipCompleteFlow(storeId, batchMatchId, costStart, costActualMatch, nowIso(), accounts);
  const wipAfterComplete = await sumAccountBalance(GL_ACCOUNT_CODES.WIP_INVENTORY);
  const fgAfterComplete = await sumAccountBalance(GL_ACCOUNT_CODES.FG_INVENTORY);
  assert(wipAfterComplete === 0, `WIP should clear, got ${wipAfterComplete}`);
  assert(fgAfterComplete === costActualMatch, `FG should be ${costActualMatch}, got ${fgAfterComplete}`);
  assert(await countEntries(batchMatchId, 'variance') === 0, 'No variance entry when qty/cost match');
  console.log('✓ Complete (match) → Dr FG / Cr WIP, WIP net zero');

  await autoPostProductionStart(storeId, batchVarianceId, costStart, nowIso(), accounts);
  await autoPostProductionWipCompleteFlow(storeId, batchVarianceId, costStart, costActualHigh, nowIso(), accounts);
  assert(await countEntries(batchVarianceId, 'variance') === 1, 'Variance entry expected');
  const wipVarianceNet = await sumAccountBalance(GL_ACCOUNT_CODES.WIP_INVENTORY);
  const fgVarianceNet = await sumAccountBalance(GL_ACCOUNT_CODES.FG_INVENTORY);
  assert(wipVarianceNet === 0, `WIP net after variance complete should be 0, got ${wipVarianceNet}`);
  assert(fgVarianceNet === round2(costActualMatch + costActualHigh), `FG cumulative mismatch: ${fgVarianceNet}`);
  console.log('✓ Complete (variance) → true-up Dr WIP/Cr Raw + Dr FG/Cr WIP');

  await autoPostProductionComplete(storeId, batchLegacyId, legacyCost, nowIso(), accounts);
  const legacyWip = await sumAccountBalance(GL_ACCOUNT_CODES.WIP_INVENTORY);
  assert(legacyWip === 0, 'Legacy path should not leave WIP');
  assert(await countEntries(batchLegacyId, 'started') === 0, 'Legacy batch should not have start entry');
  assert(await countEntries(batchLegacyId, 'complete-legacy') === 1, 'Legacy complete entry expected');
  console.log('✓ Legacy complete → Dr FG / Cr Raw (no WIP)');

  const rawBeforeDeleteTest = await sumAccountBalance(GL_ACCOUNT_CODES.INVENTORY);
  const fgBeforeDeleteTest = await sumAccountBalance(GL_ACCOUNT_CODES.FG_INVENTORY);
  const wipBeforeDeleteTest = await sumAccountBalance(GL_ACCOUNT_CODES.WIP_INVENTORY);

  await autoPostProductionStart(storeId, batchDeleteId, deleteCostStart, nowIso(), accounts);
  await autoPostProductionWipCompleteFlow(storeId, batchDeleteId, deleteCostStart, deleteCostComplete, nowIso(), accounts);
  await autoPostProductionReversal(storeId, batchDeleteId, `rev-${testRunId}`, {
    wipEnabled: true,
    materialsCostAtStart: deleteCostStart,
    materialsCostAtComplete: deleteCostComplete,
    varianceCost: deleteVariance,
  }, nowIso(), accounts);
  const wipAfterDelete = await sumAccountBalance(GL_ACCOUNT_CODES.WIP_INVENTORY);
  const fgAfterDelete = await sumAccountBalance(GL_ACCOUNT_CODES.FG_INVENTORY);
  const rawAfterDelete = await sumAccountBalance(GL_ACCOUNT_CODES.INVENTORY);
  assert(wipAfterDelete === wipBeforeDeleteTest, `WIP after reversal should restore to ${wipBeforeDeleteTest}, got ${wipAfterDelete}`);
  assert(fgAfterDelete === fgBeforeDeleteTest, `FG after reversal should restore to ${fgBeforeDeleteTest}, got ${fgAfterDelete}`);
  assert(rawAfterDelete === rawBeforeDeleteTest, `Raw after reversal should restore to ${rawBeforeDeleteTest}, got ${rawAfterDelete}`);
  console.log('✓ Delete reversal → reverses start + variance + complete GL');

  console.log('\n=== ALL WIP E2E CHECKS PASSED ===\n');
}

main()
  .catch((err) => {
    console.error('\n❌ WIP E2E FAILED:', err.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (!KEEP) {
      try { await cleanup(); } catch (e) { console.warn('cleanup warning', e.message); }
    } else {
      console.log(`Kept test store: ${storeId}`);
    }
  });
