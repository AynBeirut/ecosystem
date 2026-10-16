#!/usr/bin/env node
/**
 * Import Little Hands — September cash book (Total Cash sheet, Exp $ column)
 * into stores/{storeId}/financeExpenses so Invoice Manager "This month" shows rows.
 *
 *   node scripts/importLittleHandsSeptemberCashBookExpenses.cjs --dry-run
 *   node scripts/importLittleHandsSeptemberCashBookExpenses.cjs --write
 */
const admin = require('firebase-admin');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const STORE_ID = '8WgfKtgaE8aAXdqFhIfweEo5WFq2';
const EXCEL_PATH =
  '/media/anwar/12AD-9999/Cash/september/Copy of September edited.xlsx';
const SHEET = 'Total Cash ';
const SOURCE_TAG = 'littlehands-cash-book-2026-09-18';
const SEP_START = '2026-09-01';
const SEP_END = '2026-09-30';

const write = process.argv.includes('--write');
const reclassify = process.argv.includes('--reclassify');
const dryRun = !write && !reclassify;

function dmY(value) {
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const m = String(value || '').trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${String(+m[2]).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`;
}

function dateAtNoonUtc(ymd) {
  return `${ymd}T12:00:00.000Z`;
}

function money(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/** Summary / treasury rows — never import as expense lines. */
const SKIP_EXCEL_ROWS = new Set([61, 66, 67, 82, 85]);

function importKey(dateYmd, desc, amount, excelRow) {
  const label = String(desc || '').trim() || `row-${excelRow}`;
  const h = crypto
    .createHash('sha256')
    .update(`${STORE_ID}|${dateYmd}|${label}|${amount.toFixed(2)}`)
    .digest('hex')
    .slice(0, 16);
  return `lh-cashbook-${h}`;
}

function skipExpenseDesc(desc) {
  const d = String(desc || '').toLowerCase();
  return (
    /^expenses \$ =/i.test(d)
    || /remainig cash flow/i.test(d)
    || /remainig d\.p/i.test(d)
    || /^net in cash/i.test(d)
    || /^total sum per month/i.test(d)
  );
}

function classifyCashBookExpense(desc, paidFromColumn) {
  const d = String(desc || '').toLowerCase();
  if (/nour haybe|payroll|salary|wage/.test(d)) {
    return {
      category: 'Payroll',
      organizedCategory: 'payroll',
      expenseUiSurface: 'payroll',
      ledgerRole: 'expense',
    };
  }
  if (paidFromColumn === 'E') {
    return {
      category: 'Supplier purchase',
      organizedCategory: 'production_input',
      expenseUiSurface: 'supplier_purchase',
      ledgerRole: 'purchase',
    };
  }
  return {
    category: 'Operating expense',
    organizedCategory: 'operating_expense',
    expenseUiSurface: 'cash_expense',
    ledgerRole: 'expense',
  };
}

function parseSeptemberCashExpenses() {
  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error(`Excel not found: ${EXCEL_PATH}`);
  }
  const wb = XLSX.readFile(EXCEL_PATH, { cellDates: true });
  const sh = wb.Sheets[SHEET];
  if (!sh) throw new Error(`Sheet not found: ${SHEET}`);
  const rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: '' });
  let curDate = null;
  const out = [];
  for (let i = 2; i < rows.length; i++) {
    const excelRow = i + 1;
    if (SKIP_EXCEL_ROWS.has(excelRow)) continue;
    const r = rows[i];
    const y = dmY(r[0]);
    // September workbook: ignore stray Excel date cells that jump to Dec (e.g. 9/12 mis-read).
    if (y && y >= SEP_START && y <= SEP_END) curDate = y;
    const rawDesc = String(r[1] || '').trim();
    const desc = rawDesc || `Petty cash (row ${excelRow})`;
    const expColD = money(String(r[3]).replace(/[^0-9.-]/g, '') || 0);
    const expColE = money(String(r[4]).replace(/[^0-9.-]/g, '') || 0);
    if (skipExpenseDesc(rawDesc)) continue;
    if (!curDate || curDate < SEP_START || curDate > SEP_END) continue;

    const pushLine = (amount, paidFromColumn) => {
      if (amount <= 0) return;
      out.push({
        excelRow,
        dateYmd: curDate,
        desc,
        amount,
        paidFromColumn,
        id: importKey(curDate, desc, amount, excelRow),
        ...classifyCashBookExpense(rawDesc || desc, paidFromColumn),
      });
    };
    pushLine(expColD, 'D');
    if (expColE > 0 && expColD <= 0) pushLine(expColE, 'E');
    else if (expColE > 0 && expColD > 0) pushLine(expColE, 'E');
  }
  return out;
}

async function main() {
  const saPath = path.join(__dirname, '../serviceAccountKey.json');
  const sa = require(saPath);
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
  }
  const db = admin.firestore();
  const col = db.collection('stores').doc(STORE_ID).collection('financeExpenses');

  const rows = parseSeptemberCashExpenses();
  const now = new Date().toISOString();
  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    const ref = col.doc(row.id);
    const existing = await ref.get();
    const iso = dateAtNoonUtc(row.dateYmd);
    const payload = {
      storeId: STORE_ID,
      name: row.desc,
      description: row.desc,
      cashBookOriginalDescription: row.desc,
      category: row.category,
      organizedCategory: row.organizedCategory,
      expenseUiSurface: row.expenseUiSurface,
      cashBookPaidFromColumn: row.paidFromColumn,
      type: 'one-time',
      amount: row.amount,
      startDate: iso,
      expenseDate: iso,
      date: iso,
      paymentMethod: 'cash',
      status: 'paid',
      paidAmount: row.amount,
      isSourceOfTruth: true,
      accountingActive: true,
      source: SOURCE_TAG,
      importKey: row.id,
      cashBookSourceFile: 'Copy of September edited.xlsx',
      isOwnerTreasury: false,
      excludeFromPnlExpense: false,
      paidViaOwnerNote: false,
      ledgerRole: row.ledgerRole,
      glPostingStatus: 'pending',
      notes: `Total Cash row ${row.excelRow} col ${row.paidFromColumn}`,
      updatedAt: now,
    };
    if (existing.exists) {
      if (reclassify || write) {
        await ref.set(payload, { merge: true });
        created++;
      } else {
        skipped++;
      }
      continue;
    }
    payload.createdAt = now;
    if (write) {
      await ref.set(payload, { merge: true });
    }
    created++;
  }

  const report = {
    storeId: STORE_ID,
    sourceExcel: EXCEL_PATH,
    sheet: SHEET,
    period: `${SEP_START}..${SEP_END}`,
    parsedRows: rows.length,
    totalUsd: money(rows.reduce((s, r) => s + r.amount, 0)),
    created,
    skippedExisting: skipped,
    mode: write ? 'write' : 'dry-run',
    rows,
    at: now,
  };

  const outPath = path.join(
    __dirname,
    '../reporting/data/littlehands-september-cashbook-expenses-import-2026-09-18.json',
  );
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log(JSON.stringify({ ...report, rows: report.rows.length }, null, 2));
  console.log(`Report: ${outPath}`);
  if (dryRun) console.log('Dry run — pass --write to apply.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
