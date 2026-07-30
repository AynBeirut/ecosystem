/**
 * Full indirect cash flow reconciliation vs GL cash (102/106/103…) — live Firestore.
 * Mirrors vendor/.../cashFlowStatement.ts logic.
 */
const admin = require('firebase-admin');
const { readFileSync } = require('fs');
const { join } = require('path');

const storeArg = process.argv.find((a) => a.startsWith('--store-id='));
const STORE = storeArg ? storeArg.split('=')[1] : '8WgfKtgaE8aAXdqFhIfweEo5WFq2';
const monthArg = process.argv.find((a) => a.startsWith('--month='));
const yearArg = process.argv.find((a) => a.startsWith('--year='));
const YEAR = yearArg ? Number(yearArg.split('=')[1]) : 2026;
const MONTH = monthArg ? Number(monthArg.split('=')[1]) : 7;

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const CASH = ['101', '102', '103', '105', '106', '108'];
const WC = ['110', '120', '121', '140', '201', '220', '222'];

try {
  const sa = JSON.parse(readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
} catch {
  console.error('❌ serviceAccountKey.json required');
  process.exit(1);
}

const db = admin.firestore();

function monthBounds(year, month) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

function priorDay(iso) {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function inRange(d, start, end) {
  const x = d.slice(0, 10);
  return x >= start && x <= end;
}

function trialBalanceForAccount(account, debitSum, creditSum) {
  const opening = round2(Number(account.openingBalance) || 0);
  let d = debitSum;
  let c = creditSum;
  if (opening !== 0) {
    if (account.normalBalance === 'debit') d += opening;
    else c += opening;
  }
  if (account.normalBalance === 'debit') {
    const balance = round2(d - c);
    return balance >= 0 ? { debit: balance, credit: 0 } : { debit: 0, credit: -balance };
  }
  const balance = round2(c - d);
  return balance >= 0 ? { debit: 0, credit: balance } : { debit: -balance, credit: 0 };
}

function closingBalance(account, entries, lines, endDate) {
  const sums = { debit: 0, credit: 0 };
  for (const line of lines) {
    const entry = entries.find((e) => e.id === line.entryId);
    if (!entry || entry.status !== 'posted') continue;
    if (entry.date.slice(0, 10) > endDate) continue;
    if (line.accountId !== account.id) continue;
    sums.debit = round2(sums.debit + (Number(line.debit) || 0));
    sums.credit = round2(sums.credit + (Number(line.credit) || 0));
  }
  const tb = trialBalanceForAccount(account, sums.debit, sums.credit);
  if (account.type === 'asset') return round2(tb.debit - tb.credit);
  if (account.type === 'liability' || account.type === 'equity') return round2(tb.credit - tb.debit);
  if (account.type === 'revenue') return round2(tb.credit - tb.debit);
  return round2(tb.debit - tb.credit);
}

function wcCashEffect(account, startBal, endBal) {
  const change = round2(endBal - startBal);
  if (account.type === 'asset') return round2(-change);
  if (account.type === 'liability') return round2(change);
  return 0;
}

function isFixedAssetAccount(code) {
  return /^15\d/.test(String(code));
}

function isFinancingAccount(account) {
  if (account.type === 'equity') return account.code !== '3999';
  if (account.type === 'liability') {
    const code = account.code;
    if (WC.includes(code)) return false;
    return String(code).startsWith('2');
  }
  return false;
}

function buildReport(accounts, entries, lines, startDate, endDate) {
  const balanceAsOfStart = priorDay(startDate);
  const postedPeriod = new Set(
    entries.filter((e) => e.status === 'posted' && inRange(e.date, startDate, endDate)).map((e) => e.id),
  );
  const acctById = new Map(accounts.map((a) => [a.id, a]));
  let revenue = 0;
  let expense = 0;
  for (const line of lines) {
    if (!postedPeriod.has(line.entryId)) continue;
    const acct = acctById.get(line.accountId);
    if (!acct || !acct.isActive) continue;
    if (acct.type === 'revenue') revenue = round2(revenue + (line.credit || 0) - (line.debit || 0));
    if (acct.type === 'expense') expense = round2(expense + (line.debit || 0) - (line.credit || 0));
  }
  const netIncome = round2(revenue - expense);

  let wcTotal = 0;
  for (const code of WC) {
    const acct = accounts.find((a) => a.isActive && String(a.code) === code);
    if (!acct) continue;
    wcTotal = round2(wcTotal + wcCashEffect(acct, closingBalance(acct, entries, lines, balanceAsOfStart), closingBalance(acct, entries, lines, endDate)));
  }
  const netCashOperating = round2(netIncome + wcTotal);

  let investingTotal = 0;
  for (const acct of accounts.filter((a) => a.isActive && isFixedAssetAccount(a.code))) {
    const change = round2(
      closingBalance(acct, entries, lines, endDate) - closingBalance(acct, entries, lines, balanceAsOfStart),
    );
    if (change === 0) continue;
    investingTotal = round2(investingTotal - change);
  }

  let financingTotal = 0;
  for (const acct of accounts.filter((a) => a.isActive && isFinancingAccount(a))) {
    const effect = round2(
      closingBalance(acct, entries, lines, endDate) - closingBalance(acct, entries, lines, balanceAsOfStart),
    );
    if (effect === 0) continue;
    financingTotal = round2(financingTotal + effect);
  }

  const netChangeInCash = round2(netCashOperating + investingTotal + financingTotal);

  let cashStart = 0;
  let cashEnd = 0;
  const cashDeltas = [];
  for (const code of CASH) {
    const acct = accounts.find((a) => a.isActive && String(a.code) === code);
    if (!acct) continue;
    const s = closingBalance(acct, entries, lines, balanceAsOfStart);
    const e = closingBalance(acct, entries, lines, endDate);
    cashStart = round2(cashStart + s);
    cashEnd = round2(cashEnd + e);
    const delta = round2(e - s);
    if (s !== 0 || e !== 0 || delta !== 0) cashDeltas.push({ code, name: acct.name, start: s, end: e, delta });
  }
  const cashDeltaFromAccounts = round2(cashEnd - cashStart);
  const reconciliationVariance = round2(netChangeInCash - cashDeltaFromAccounts);

  return {
    netIncome,
    wcTotal,
    netCashOperating,
    investingTotal,
    financingTotal,
    netChangeInCash,
    cashStart,
    cashEnd,
    cashDeltaFromAccounts,
    reconciliationVariance,
    reconciled: reconciliationVariance === 0,
    cashDeltas,
    periodEntryCount: postedPeriod.size,
  };
}

(async () => {
  const { start, end } = monthBounds(YEAR, MONTH);
  console.log('\nCash flow reconciliation — store', STORE, start, '→', end, '\n');

  const [acctSnap, entrySnap, lineSnap] = await Promise.all([
    db.collection(`stores/${STORE}/ledgerAccounts`).get(),
    db.collection(`stores/${STORE}/journalEntries`).get(),
    db.collection(`stores/${STORE}/journalLines`).get(),
  ]);

  const accounts = acctSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const entries = entrySnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const lines = lineSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const r = buildReport(accounts, entries, lines, start, end);
  console.log('Posted JEs in period:', r.periodEntryCount);
  console.log('Net income:', r.netIncome);
  console.log('WC adjustments:', r.wcTotal);
  console.log('Net cash operating:', r.netCashOperating);
  console.log('Net cash investing:', r.investingTotal);
  console.log('Net cash financing:', r.financingTotal);
  console.log('---');
  console.log('Net change in cash (computed):', r.netChangeInCash);
  console.log('Cash GL beginning:', r.cashStart);
  console.log('Cash GL ending:', r.cashEnd);
  console.log('Cash change (102/106/103…):', r.cashDeltaFromAccounts);
  console.log('Reconciliation variance:', r.reconciliationVariance);
  console.log('Reconciled:', r.reconciled ? 'YES' : 'NO');
  if (r.cashDeltas.length) {
    console.log('Cash account deltas:');
    r.cashDeltas.forEach((c) => console.log(`  ${c.code} ${c.name}: ${c.start} → ${c.end} (Δ ${c.delta})`));
  }
})();
