#!/usr/bin/env node
/**
 * Align Little Hands Class 7 revenue to /Cash workbooks.
 *
 * Source map:
 *   B = name/description
 *   C = sales
 *   D/E = expenses / birthday DP expenses
 *   F/G = treasury / incoming DP
 *   H = running total
 *
 * Dry run:
 *   node scripts/alignLittleHandsCashBookSalesToGl.cjs
 * Apply:
 *   node scripts/alignLittleHandsCashBookSalesToGl.cjs --write
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const STORE_ID = '8WgfKtgaE8aAXdqFhIfweEo5WFq2';
const CASH_DIR = process.env.LITTLE_HANDS_CASH_DIR || '/media/anwar/12AD-9999/Cash';
const write = process.argv.includes('--write');
const onlyMonthsArg = process.argv.find((a) => a.startsWith('--only='));
const onlyMonths = onlyMonthsArg
  ? new Set(onlyMonthsArg.slice('--only='.length).split(',').map((s) => s.trim()).filter(Boolean))
  : null;

const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

function nowIso() {
  return new Date().toISOString();
}

function atNoonUtc(ymd) {
  return `${ymd}T12:00:00.000Z`;
}

function localYmd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthEndYmd(ym) {
  const [y, m] = ym.split('-').map(Number);
  return localYmd(new Date(y, m, 0));
}

function money(value) {
  return round2(String(value ?? '').replace(/[^0-9.-]/g, '') || 0);
}

function dmY(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return localYmd(value);
  const m = String(value || '').trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!m) return null;
  const day = +m[1];
  const month = +m[2];
  const year = +m[3];
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function sourceMonth(filePath) {
  const name = path.basename(filePath).toLowerCase();
  if (name.includes('december')) return '2025-12';
  if (name.includes('january')) return '2026-01';
  if (name.includes('february')) return '2026-02';
  if (name.includes('marsh') || name.includes('march')) return '2026-03';
  if (name.includes('april')) return '2026-04';
  if (name.includes('may')) return '2026-05';
  if (name.includes('june')) return '2026-06';
  if (name.includes('july')) return '2026-07';
  if (name.includes('august')) return '2026-08';
  if (name.includes('september')) return '2026-09';
  return null;
}

function workbookDate(value, expectedYm) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const ymd = localYmd(value);
    return ymd.startsWith(expectedYm) ? ymd : null;
  }
  const m = String(value || '').trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!m) return null;
  const a = +m[1];
  const b = +m[2];
  const year = +m[3];
  const expectedMonth = Number(expectedYm.slice(5, 7));
  let day = a;
  let month = b;
  // Some older files use M-D-Y while later files use D-M-Y.
  if (a === expectedMonth && b !== expectedMonth) {
    month = a;
    day = b;
  }
  if (month !== expectedMonth || day < 1 || day > 31) return null;
  const ymd = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return ymd.startsWith(expectedYm) ? ymd : null;
}

/** Month-end rollup in col C only — exact label, no date (daily lines are "Net in Cash DD-MM-YYYY"). */
function isMonthlyNetInCashRollup(desc) {
  const d = String(desc || '').trim();
  return /^net in cash$/i.test(d);
}

function skipRevenueDescription(desc) {
  const d = String(desc || '').toLowerCase();
  return (
    !d.trim() ||
    isMonthlyNetInCashRollup(desc) ||
    /remaining|remainig|cash flow|sanaa|total sum|total revenue|cash remaining|expenses \$|petit cash|opening/.test(d)
  );
}

function sourceFiles() {
  const files = [];
  for (const name of fs.readdirSync(CASH_DIR)) {
    if (/\.xls$/i.test(name)) files.push(path.join(CASH_DIR, name));
  }
  const editedSep = [
    path.join(CASH_DIR, 'september', 'Copy of September edited.xlsx'),
    path.join(CASH_DIR, 'Copy of September edited.xlsx'),
  ].find((p) => fs.existsSync(p));
  if (editedSep) {
    return files.filter((p) => !/September\.xls$/i.test(path.basename(p))).concat(editedSep);
  }
  return files;
}

function totalSheetName(workbook) {
  return workbook.SheetNames.find((s) => /total/i.test(s)) || workbook.SheetNames[workbook.SheetNames.length - 1];
}

function parseCashBookSales(filePath) {
  const expectedYm = sourceMonth(filePath);
  if (!expectedYm) return [];
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const sheet = totalSheetName(wb);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: '' });
  const byMonth = new Map();
  let currentDate = null;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const ymd = workbookDate(row[0], expectedYm);
    if (ymd) currentDate = ymd;
    if (!currentDate) continue;
    const desc = String(row[1] || '').trim();
    const sales = money(row[2]);
    if (sales <= 0 || skipRevenueDescription(desc)) continue;
    const ym = currentDate.slice(0, 7);
    if (ym !== expectedYm) continue;
    const cur = byMonth.get(ym) || { sales: 0, rows: [] };
    cur.sales = round2(cur.sales + sales);
    cur.rows.push({ row: i + 1, date: currentDate, desc, sales });
    byMonth.set(ym, cur);
  }
  return [...byMonth.entries()].map(([ym, data]) => ({
    ym,
    sourceFile: filePath,
    sourceSheet: sheet,
    cashBookSalesC: data.sales,
    rows: data.rows,
  }));
}

function isClass7Account(account) {
  const code = String(account.code || '').trim();
  if (['450', '704'].includes(code)) return false;
  if (account.type === 'revenue') return true;
  const head = parseInt(code.split('.')[0], 10);
  const n = parseInt(code, 10);
  return (Number.isFinite(head) && head >= 7000 && head < 8000) || (Number.isFinite(n) && n >= 400 && n < 460);
}

function accountByCode(accounts, code) {
  const account = accounts.find((a) => String(a.code) === String(code) && a.isActive !== false);
  if (!account) throw new Error(`Missing ledger account ${code}`);
  return account;
}

async function nextVoucher(db, type, year, dryRunCounter) {
  if (!write) {
    dryRunCounter[type] = (dryRunCounter[type] || 0) + 1;
    return `${type}-${year}-DRY${String(dryRunCounter[type]).padStart(5, '0')}`;
  }
  const ref = db.collection('stores').doc(STORE_ID).collection('ledgerMeta').doc('voucherSerials');
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() || {} : {};
    const counters = data.counters || {};
    const key = `${type}-${year}`;
    const next = Number(counters[key] || 0) + 1;
    tx.set(ref, { storeId: STORE_ID, counters: { ...counters, [key]: next }, updatedAt: nowIso() }, { merge: true });
    return `${type}-${year}-${String(next).padStart(5, '0')}`;
  });
}

async function class7NetForMonth(db, accountsById, ym) {
  const start = `${ym}-01`;
  const end = monthEndYmd(ym);
  const [entriesSnap, linesSnap] = await Promise.all([
    db.collection('stores').doc(STORE_ID).collection('journalEntries').get(),
    db.collection('stores').doc(STORE_ID).collection('journalLines').get(),
  ]);
  const posted = new Set(
    entriesSnap.docs
      .filter((d) => {
        const e = d.data();
        const date = String(e.date || '').slice(0, 10);
        return e.status === 'posted' && date >= start && date <= end;
      })
      .map((d) => d.id),
  );
  let net = 0;
  for (const doc of linesSnap.docs) {
    const line = doc.data();
    if (!posted.has(line.entryId)) continue;
    const account = accountsById.get(line.accountId);
    if (!account || !isClass7Account(account)) continue;
    net += (line.credit || 0) - (line.debit || 0);
  }
  return round2(net);
}

/** Bump when col C parsing rules change (new idempotent align key). */
const CASHBOOK_ALIGN_REVISION = '2026-09-19-no-monthly-net-in-cash-rollup';

async function postAlignment(db, month, delta, cashAcct, revenueAcct, existingKeys, dryRunCounter) {
  const sourceKey = `cashbook_sales:${month.ym}:class7-align:${CASHBOOK_ALIGN_REVISION}`;
  if (existingKeys.has(sourceKey)) return { skipped: 'existing-key', sourceKey };
  const entryId = `JE-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const ymd = monthEndYmd(month.ym);
  const year = Number(month.ym.slice(0, 4));
  const voucherNumber = await nextVoucher(db, 'RV', year, dryRunCounter);
  const amount = round2(Math.abs(delta));
  const memo = `Align Class 7 to cash book column C - ${month.ym}`;
  const ts = nowIso();
  const batch = db.batch();
  batch.set(db.collection('stores').doc(STORE_ID).collection('journalEntryKeys').doc(sourceKey), {
    storeId: STORE_ID,
    sourceKey,
    entryId,
    createdAt: ts,
    updatedAt: ts,
  });
  batch.set(db.collection('stores').doc(STORE_ID).collection('journalEntries').doc(entryId), {
    id: entryId,
    storeId: STORE_ID,
    date: atNoonUtc(ymd),
    memo,
    status: 'posted',
    sourceType: 'cashbook_sales',
    sourceId: month.ym,
    sourceKey,
    event: 'class7-align',
    currency: 'USD',
    voucherType: 'RV',
    voucherNumber,
    isSystemGenerated: true,
    sourceFiles: month.sources.map((s) => s.file),
    postedAt: ts,
    createdAt: ts,
    updatedAt: ts,
  });
  const increaseRevenue = delta > 0;
  const lines = increaseRevenue
    ? [
        { account: cashAcct, debit: amount, credit: 0, description: memo },
        { account: revenueAcct, debit: 0, credit: amount, description: 'Sales revenue - cash book column C' },
      ]
    : [
        { account: revenueAcct, debit: amount, credit: 0, description: memo },
        { account: cashAcct, debit: 0, credit: amount, description: 'Sales align down - cash book column C' },
      ];
  lines.forEach((line, idx) => {
    const lineId = `${entryId}-L${idx + 1}`;
    batch.set(db.collection('stores').doc(STORE_ID).collection('journalLines').doc(lineId), {
      id: lineId,
      storeId: STORE_ID,
      entryId,
      accountId: line.account.id,
      accountCode: line.account.code,
      accountName: line.account.name,
      currency: 'USD',
      debit: round2(line.debit),
      credit: round2(line.credit),
      description: line.description,
      lineOrder: idx,
    });
  });
  if (write) await batch.commit();
  existingKeys.add(sourceKey);
  return { posted: true, sourceKey, entryId, voucherNumber, amount, direction: increaseRevenue ? 'increase' : 'decrease' };
}

async function main() {
  const sa = require(path.join(__dirname, '../serviceAccountKey.json'));
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
  const db = admin.firestore();
  const accountsSnap = await db.collection('stores').doc(STORE_ID).collection('ledgerAccounts').get();
  const accounts = accountsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const accountsById = new Map(accounts.map((a) => [a.id, a]));
  const cashAcct = accountByCode(accounts, '102');
  const revenueAcct = accountByCode(accounts, '401');
  const keysSnap = await db.collection('stores').doc(STORE_ID).collection('journalEntryKeys').get();
  const existingKeys = new Set(keysSnap.docs.map((d) => d.id));
  const dryRunCounter = {};

  const parsed = sourceFiles().flatMap(parseCashBookSales);
  const byMonth = new Map();
  for (const item of parsed) {
    const cur = byMonth.get(item.ym) || { ym: item.ym, cashBookSalesC: 0, sources: [], rows: [] };
    cur.cashBookSalesC = round2(cur.cashBookSalesC + item.cashBookSalesC);
    cur.sources.push({ file: item.sourceFile, sheet: item.sourceSheet, sales: item.cashBookSalesC, rows: item.rows.length });
    cur.rows.push(...item.rows.map((r) => ({ ...r, sourceFile: item.sourceFile })));
    byMonth.set(item.ym, cur);
  }

  const report = {
    mode: write ? 'write' : 'dry-run',
    sourceRoot: CASH_DIR,
    storeId: STORE_ID,
    months: [],
    aligned: [],
    skipped: [],
    generatedAt: nowIso(),
  };

  for (const month of [...byMonth.values()].sort((a, b) => a.ym.localeCompare(b.ym))) {
    if (onlyMonths && !onlyMonths.has(month.ym)) continue;
    const glClass7 = await class7NetForMonth(db, accountsById, month.ym);
    const delta = round2(month.cashBookSalesC - glClass7);
    const row = { ...month, glClass7, delta };
    report.months.push({ ...row, rows: row.rows.length });
    if (Math.abs(delta) <= 0.5) {
      report.skipped.push({ ym: month.ym, reason: 'already_aligned', cashBookSalesC: month.cashBookSalesC, glClass7 });
      continue;
    }
    const result = await postAlignment(db, month, delta, cashAcct, revenueAcct, existingKeys, dryRunCounter);
    report.aligned.push({ ym: month.ym, cashBookSalesC: month.cashBookSalesC, glClass7, delta, ...result });
  }

  const outPath = path.join(__dirname, '../reporting/data/littlehands-cashbook-sales-class7-align-2026-09-18.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, months: report.months.length }, null, 2));
  console.log(`Report: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
