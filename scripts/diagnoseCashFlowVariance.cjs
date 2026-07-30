/**
 * Diagnose cash-flow reconciliation variance for a store/period.
 */
const admin = require('firebase-admin');
const { readFileSync } = require('fs');
const { join } = require('path');

const STORE = '8WgfKtgaE8aAXdqFhIfweEo5WFq2';
const START = '2026-07-01';
const END = '2026-07-31';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const WC = ['110', '120', '121', '140', '201'];
const CASH = ['101', '102', '103', '105', '106', '108'];

try {
  const sa = JSON.parse(readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
} catch {
  console.error('❌ serviceAccountKey.json required');
  process.exit(1);
}

const db = admin.firestore();

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

function periodLineSums(account, entries, lines, start, end) {
  let debit = 0;
  let credit = 0;
  for (const line of lines) {
    const entry = entries.find((e) => e.id === line.entryId);
    if (!entry || entry.status !== 'posted') continue;
    if (!inRange(entry.date, start, end)) continue;
    if (line.accountId !== account.id) continue;
    debit = round2(debit + (Number(line.debit) || 0));
    credit = round2(credit + (Number(line.credit) || 0));
  }
  return { debit, credit, netDebit: round2(debit - credit), netCredit: round2(credit - debit) };
}

(async () => {
  const startBalDate = priorDay(START);
  const [acctSnap, entrySnap, lineSnap] = await Promise.all([
    db.collection(`stores/${STORE}/ledgerAccounts`).get(),
    db.collection(`stores/${STORE}/journalEntries`).get(),
    db.collection(`stores/${STORE}/journalLines`).get(),
  ]);

  const accounts = acctSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const entries = entrySnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const lines = lineSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const acctById = new Map(accounts.map((a) => [a.id, a]));

  // Cash period activity from lines (direct)
  let cashPeriodNet = 0;
  for (const code of CASH) {
    const acct = accounts.find((a) => a.isActive && String(a.code) === code);
    if (!acct) continue;
    const { debit, credit } = periodLineSums(acct, entries, lines, START, END);
    const delta = round2(debit - credit); // asset normal
    cashPeriodNet = round2(cashPeriodNet + delta);
    console.log(`Period activity ${code}: Dr ${debit} Cr ${credit} → asset Δ ${delta}`);
  }
  console.log('Sum period cash line activity (Dr−Cr):', cashPeriodNet);

  const cashStart = closingBalance(
    accounts.find((a) => a.code === '102'),
    entries,
    lines,
    startBalDate,
  );
  const cashEnd = closingBalance(
    accounts.find((a) => a.code === '102'),
    entries,
    lines,
    END,
  );
  console.log('102 balance Δ (end−start):', round2(cashEnd - cashStart));

  // Every JE in period: must balance; flag if cash side != sum of non-cash
  const postedInPeriod = entries.filter((e) => e.status === 'posted' && inRange(e.date, START, END));
  console.log('\nPosted JEs in period:', postedInPeriod.length);

  let unbalanced = [];
  for (const entry of postedInPeriod) {
    const elines = lines.filter((l) => l.entryId === entry.id);
    let dr = 0;
    let cr = 0;
    for (const l of elines) {
      dr = round2(dr + (Number(l.debit) || 0));
      cr = round2(cr + (Number(l.credit) || 0));
    }
    if (dr !== cr) unbalanced.push({ id: entry.id, date: entry.date, dr, cr, diff: round2(dr - cr) });
  }
  console.log('Unbalanced JEs:', unbalanced.length);
  unbalanced.slice(0, 5).forEach((u) => console.log(u));

  // Entries touching 102 in period
  const acct102 = accounts.find((a) => String(a.code) === '102');
  const cashEntries = postedInPeriod.filter((e) =>
    lines.some((l) => l.entryId === e.id && l.accountId === acct102.id),
  );
  console.log('\nJEs touching 102 in period:', cashEntries.length);

  // Classify period P&L + WC + other for each entry with 102
  function entryIndirectContribution(entryId) {
    const elines = lines.filter((l) => l.entryId === entryId);
    let rev = 0;
    let exp = 0;
    let wc = 0;
    let cash = 0;
    let other = 0;
    for (const l of elines) {
      const acct = acctById.get(l.accountId);
      if (!acct) continue;
      const d = Number(l.debit) || 0;
      const c = Number(l.credit) || 0;
      if (CASH.includes(String(acct.code))) {
        cash = round2(cash + (d - c));
        continue;
      }
      if (acct.type === 'revenue') rev = round2(rev + (c - d));
      else if (acct.type === 'expense') exp = round2(exp + (d - c));
      else if (WC.includes(String(acct.code))) {
        if (acct.type === 'asset') wc = round2(wc - (d - c));
        else wc = round2(wc + (c - d));
      } else other = round2(other + (d - c)); // rough
    }
    const pnl = round2(rev - exp);
    const impliedCash = round2(-(pnl + wc)); // simplified
    return { rev, exp, pnl, wc, cash, other, impliedCash, gap: round2(cash - impliedCash) };
  }

  // Sum contributions
  let totalCash102 = 0;
  let totalPnl = 0;
  let totalWcEffect = 0;
  let totalOther = 0;
  const suspicious = [];

  for (const e of cashEntries) {
    const c = entryIndirectContribution(e.id);
    totalCash102 = round2(totalCash102 + c.cash);
    totalPnl = round2(totalPnl + c.pnl);
    totalWcEffect = round2(totalWcEffect + c.wc);
    totalOther = round2(totalOther + c.other);
    if (Math.abs(c.other) > 0.001) {
      suspicious.push({
        id: e.id,
        date: e.date.slice(0, 10),
        sourceType: e.sourceType,
        memo: (e.memo || '').slice(0, 60),
        cash: c.cash,
        pnl: c.pnl,
        wc: c.wc,
        other: c.other,
      });
    }
  }

  console.log('\nFrom 102-touching entries (period):');
  console.log('  Sum cash (102 net Dr−Cr):', totalCash102);
  console.log('  Sum entry-level P&L proxy:', totalPnl);
  console.log('  Sum entry-level WC proxy:', totalWcEffect);
  console.log('  Sum "other" lines (not cash/rev/exp/WC):', totalOther);

  console.log('\nEntries with non-WC/non-P&L lines alongside 102 (' + suspicious.length + '):');
  suspicious.forEach((s) => console.log(s));

  // Full-store period: net change all balance sheet except cash should explain -cash change
  let bsChangeExCash = 0;
  for (const acct of accounts.filter((a) => a.isActive)) {
    if (CASH.includes(String(acct.code))) continue;
    const s = closingBalance(acct, entries, lines, startBalDate);
    const e = closingBalance(acct, entries, lines, END);
    const ch = round2(e - s);
    if (ch === 0) continue;
    // assets increase uses cash; liabilities increase sources cash
    if (acct.type === 'asset') bsChangeExCash = round2(bsChangeExCash + ch);
    else if (acct.type === 'liability' || acct.type === 'equity')
      bsChangeExCash = round2(bsChangeExCash - ch);
    else if (acct.type === 'revenue') bsChangeExCash = round2(bsChangeExCash - ch);
    else if (acct.type === 'expense') bsChangeExCash = round2(bsChangeExCash + ch);
  }
  console.log('\nBalance-sheet identity check (non-cash Δ vs cash, rough):', bsChangeExCash);

  // List accounts with period balance change NOT in our CF buckets
  console.log('\nAccounts with balance change Jul 1–25 NOT in WC/15x/financing/rev/exp:');
  for (const acct of accounts.filter((a) => a.isActive).sort((a, b) => a.code.localeCompare(b.code))) {
    if (CASH.includes(String(acct.code))) continue;
    const s = closingBalance(acct, entries, lines, startBalDate);
    const e = closingBalance(acct, entries, lines, END);
    const ch = round2(e - s);
    if (ch === 0) continue;
    const code = String(acct.code);
    const inWc = WC.includes(code);
    const inFa = /^15\d/.test(code);
    const isFin =
      acct.type === 'equity' ||
      (acct.type === 'liability' && !WC.includes(code) && code !== '220' && code !== '222');
    const isPnl = acct.type === 'revenue' || acct.type === 'expense';
    if (!inWc && !inFa && !isFin && !isPnl) {
      console.log(`  ${code} ${acct.name} (${acct.type}): Δ ${ch}`);
    }
  }

  // Boundary: entries on 2026-06-30 and 2026-07-01
  for (const d of ['2026-06-30', '2026-07-01']) {
    const dayEntries = entries.filter((e) => e.status === 'posted' && e.date.slice(0, 10) === d);
    const touch102 = dayEntries.filter((e) =>
      lines.some((l) => l.entryId === e.id && l.accountId === acct102.id),
    );
    console.log(`\nBoundary ${d}: ${dayEntries.length} posted JEs, ${touch102.length} touch 102`);
  }
})();
