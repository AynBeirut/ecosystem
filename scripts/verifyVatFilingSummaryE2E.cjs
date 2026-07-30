/**
 * Proof VAT filing summary math against live Firestore (E-Service test store).
 *
 * Usage: node scripts/verifyVatFilingSummaryE2E.cjs [--store-id=Av22...]
 */

const admin = require('firebase-admin');
const { readFileSync } = require('fs');
const { join } = require('path');

const storeArg = process.argv.find((a) => a.startsWith('--store-id='));
const STORE = storeArg ? storeArg.split('=')[1] : 'Av22LKyet8QmVcu9b8Njz1HVfoy1';

const VAT_OUTPUT = '220';
const VAT_INPUT = '140';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

try {
  const sa = JSON.parse(readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
} catch {
  console.error('❌ serviceAccountKey.json required');
  process.exit(1);
}

const db = admin.firestore();

function inRange(d, start, end) {
  const day = String(d).slice(0, 10);
  return day >= start && day <= end;
}

function buildReport(accounts, entries, lines, startDate, endDate) {
  const output = accounts.find((a) => a.code === VAT_OUTPUT && a.isActive !== false);
  const input = accounts.find((a) => a.code === VAT_INPUT && a.isActive !== false);
  const posted = new Set(
    entries.filter((e) => e.status === 'posted' && inRange(e.date, startDate, endDate)).map((e) => e.id),
  );
  const entryById = new Map(entries.map((e) => [e.id, e]));

  let outCr = 0;
  let outDr = 0;
  let inDr = 0;
  let inCr = 0;
  const bySource = new Map();

  for (const line of lines) {
    if (!posted.has(line.entryId)) continue;
    const entry = entryById.get(line.entryId);
    const st = entry?.sourceType || 'unknown';
    const bump = (o, i) => {
      const c = bySource.get(st) || { o: 0, i: 0 };
      c.o = round2(c.o + o);
      c.i = round2(c.i + i);
      bySource.set(st, c);
    };
    if (output && line.accountId === output.id) {
      outCr += Number(line.credit) || 0;
      outDr += Number(line.debit) || 0;
      bump(round2((Number(line.credit) || 0) - (Number(line.debit) || 0)), 0);
    }
    if (input && line.accountId === input.id) {
      inDr += Number(line.debit) || 0;
      inCr += Number(line.credit) || 0;
      bump(0, round2((Number(line.debit) || 0) - (Number(line.credit) || 0)));
    }
  }

  outCr = round2(outCr);
  outDr = round2(outDr);
  inDr = round2(inDr);
  inCr = round2(inCr);

  return {
    startDate,
    endDate,
    outputNet: round2(outCr - outDr),
    inputNet: round2(inDr - inCr),
    netDue: round2(outCr - outDr - (inDr - inCr)),
    outCr,
    outDr,
    bySource: [...bySource.entries()].sort((a, b) => a[0].localeCompare(b[0])),
  };
}

(async () => {
  console.log('\nVAT filing summary proof — store', STORE, '\n');

  const [acctSnap, entrySnap, lineSnap] = await Promise.all([
    db.collection(`stores/${STORE}/ledgerAccounts`).get(),
    db.collection(`stores/${STORE}/journalEntries`).get(),
    db.collection(`stores/${STORE}/journalLines`).get(),
  ]);

  const accounts = acctSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const entries = entrySnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const lines = lineSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const allStart = '2000-01-01';
  const allEnd = '2099-12-31';
  const all = buildReport(accounts, entries, lines, allStart, allEnd);

  const july = buildReport(accounts, entries, lines, '2026-07-01', '2026-07-31');

  // Cross-check: all-time net output should match 220 TB credit balance (no opening on 220)
  const output = accounts.find((a) => a.code === VAT_OUTPUT);
  let dr = Number(output?.openingBalance) || 0;
  let cr = 0;
  if (output?.normalBalance === 'credit') {
    cr = dr;
    dr = 0;
  }
  for (const line of lines) {
    const entry = entries.find((e) => e.id === line.entryId);
    if (!entry || entry.status !== 'posted') continue;
    if (line.accountId !== output?.id) continue;
    dr = round2(dr + (Number(line.debit) || 0));
    cr = round2(cr + (Number(line.credit) || 0));
  }
  const tb220 = round2(cr - dr);

  console.log('ALL-TIME VAT ACTIVITY');
  console.log(JSON.stringify(all, null, 2));
  console.log('\nJULY 2026 VAT ACTIVITY');
  console.log(JSON.stringify(july, null, 2));
  console.log('\nCROSS-CHECK account 220 liability balance (all posted lines):', tb220);
  console.log('Matches all-time outputNet:', tb220 === all.outputNet ? 'YES ✅' : `NO (diff ${round2(tb220 - all.outputNet)})`);

  process.exit(tb220 === all.outputNet ? 0 : 1);
})();
