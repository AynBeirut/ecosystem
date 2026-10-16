#!/usr/bin/env node
/**
 * Jun–Sep Class 7 from /d.p Edited workbooks:
 *   Income (sales) = column C + column F (month summary row)
 *   Expenses (report only) = column D + column E (same row)
 *
 *   node scripts/alignLittleHandsDpEditedSalesToGl.cjs
 *   node scripts/alignLittleHandsDpEditedSalesToGl.cjs --write
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const STORE_ID = '8WgfKtgaE8aAXdqFhIfweEo5WFq2';
const DP_DIR = process.env.LITTLE_HANDS_DP_EDITED_DIR || '/media/anwar/12AD-9999/d.p Edited';
const write = process.argv.includes('--write');
const ALIGN_REVISION = '2026-09-19-dp-edited-c-plus-f';

const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
const nowIso = () => new Date().toISOString();
const money = (v) => round2(String(v ?? '').replace(/[^0-9.-]/g, '') || 0);

function monthEndYmd(ym) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function atNoonUtc(ymd) {
  return `${ymd}T12:00:00.000Z`;
}

function sourceMonth(filePath) {
  const name = path.basename(filePath).toLowerCase();
  if (name.includes('june')) return '2026-06';
  if (name.includes('july')) return '2026-07';
  if (name.includes('august')) return '2026-08';
  if (name.includes('september')) return '2026-09';
  return null;
}

function dpEditedFiles() {
  if (!fs.existsSync(DP_DIR)) throw new Error(`d.p Edited folder not found: ${DP_DIR}`);
  return fs
    .readdirSync(DP_DIR)
    .filter((n) => /\.xls$/i.test(n))
    .map((n) => path.join(DP_DIR, n));
}

function totalSheetName(workbook) {
  return workbook.SheetNames.find((s) => /total/i.test(s)) || workbook.SheetNames[workbook.SheetNames.length - 1];
}

/** Month truth: blank summary row where col C matches "Total Sum per Month" col C. */
function parseDpEditedMonth(filePath) {
  const ym = sourceMonth(filePath);
  if (!ym) return null;
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const sheet = totalSheetName(wb);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: '' });
  let totalSumC = null;
  let totalSumRow = null;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const desc = String(row[1] || '');
    if (/total sum per month/i.test(desc)) {
      totalSumC = money(row[2]);
      totalSumRow = i + 1;
    }
  }
  if (totalSumC == null || totalSumC <= 0) {
    throw new Error(`Missing Total Sum per Month row in ${filePath}`);
  }
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[1] || '').trim()) continue;
    const c = money(row[2]);
    if (Math.abs(c - totalSumC) > 0.02) continue;
    const colF = money(row[5]);
    const colD = money(row[3]);
    const colE = money(row[4]);
    return {
      ym,
      sourceFile: filePath,
      sourceSheet: sheet,
      totalSumRow,
      summaryExcelRow: i + 1,
      colC: c,
      colF,
      colD,
      colE,
      incomeCF: round2(c + colF),
      expenseDE: round2(colD + colE),
    };
  }
  throw new Error(`No summary row matching Total Sum C=${totalSumC} in ${filePath}`);
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

async function postAlignment(db, month, delta, cashAcct, revenueAcct, existingKeys, dryRunCounter) {
  const sourceKey = `dp_edited_sales:${month.ym}:class7-align:${ALIGN_REVISION}`;
  if (existingKeys.has(sourceKey)) return { skipped: 'existing-key', sourceKey };
  const entryId = `JE-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const ymd = monthEndYmd(month.ym);
  const year = Number(month.ym.slice(0, 4));
  const voucherNumber = await nextVoucher(db, 'RV', year, dryRunCounter);
  const amount = round2(Math.abs(delta));
  const memo = `d.p Edited sales (C+F) — ${month.ym}`;
  const ts = nowIso();
  const batch = db.batch();
  const root = db.collection('stores').doc(STORE_ID);
  batch.set(root.collection('journalEntryKeys').doc(sourceKey), {
    storeId: STORE_ID,
    sourceKey,
    entryId,
    createdAt: ts,
    updatedAt: ts,
  });
  batch.set(root.collection('journalEntries').doc(entryId), {
    id: entryId,
    storeId: STORE_ID,
    date: atNoonUtc(ymd),
    memo,
    status: 'posted',
    sourceType: 'dp_edited_sales',
    sourceId: month.ym,
    sourceKey,
    event: 'class7-align',
    currency: 'USD',
    voucherType: 'RV',
    voucherNumber,
    isSystemGenerated: true,
    sourceFile: path.basename(month.sourceFile),
    postedAt: ts,
    createdAt: ts,
    updatedAt: ts,
  });
  const increaseRevenue = delta > 0;
  const lines = increaseRevenue
    ? [
        { account: cashAcct, debit: amount, credit: 0, description: memo },
        { account: revenueAcct, debit: 0, credit: amount, description: 'Sales (C+F) — d.p Edited' },
      ]
    : [
        { account: revenueAcct, debit: amount, credit: 0, description: memo },
        { account: cashAcct, debit: 0, credit: amount, description: 'Sales align — d.p Edited' },
      ];
  lines.forEach((line, idx) => {
    const lineId = `${entryId}-L${idx + 1}`;
    batch.set(root.collection('journalLines').doc(lineId), {
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
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
  }
  const db = admin.firestore();
  const accountsSnap = await db.collection('stores').doc(STORE_ID).collection('ledgerAccounts').get();
  const accounts = accountsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const accountsById = new Map(accounts.map((a) => [a.id, a]));
  const cashAcct = accountByCode(accounts, '102');
  const revenueAcct = accountByCode(accounts, '401');
  const keysSnap = await db.collection('stores').doc(STORE_ID).collection('journalEntryKeys').get();
  const existingKeys = new Set(keysSnap.docs.map((d) => d.id));
  const dryRunCounter = {};

  const parsed = dpEditedFiles().map(parseDpEditedMonth).filter(Boolean);
  const report = {
    mode: write ? 'write' : 'dry-run',
    storeId: STORE_ID,
    dpEditedDir: DP_DIR,
    rule: { incomeSales: 'column C + column F', expenses: 'column D + column E (report only)' },
    alignRevision: ALIGN_REVISION,
    months: [],
    aligned: [],
    skipped: [],
    generatedAt: nowIso(),
  };

  for (const month of parsed.sort((a, b) => a.ym.localeCompare(b.ym))) {
    const glClass7 = await class7NetForMonth(db, accountsById, month.ym);
    const delta = round2(month.incomeCF - glClass7);
    const row = { ...month, glClass7, delta };
    report.months.push(row);
    if (Math.abs(delta) <= 0.5) {
      report.skipped.push({ ym: month.ym, reason: 'already_aligned', incomeCF: month.incomeCF, glClass7 });
      continue;
    }
    const result = await postAlignment(db, month, delta, cashAcct, revenueAcct, existingKeys, dryRunCounter);
    report.aligned.push({ ym: month.ym, incomeCF: month.incomeCF, glClass7, delta, expenseDE: month.expenseDE, ...result });
  }

  const outPath = path.join(__dirname, '../reporting/data/littlehands-dp-edited-sales-gl-align-2026-09-19.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(`Report: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
