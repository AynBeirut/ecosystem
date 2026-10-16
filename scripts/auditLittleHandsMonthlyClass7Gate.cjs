#!/usr/bin/env node
/**
 * Gate: master col B vs posted GL Class 7 per month (+ September cash-book reference).
 *   node scripts/auditLittleHandsMonthlyClass7Gate.cjs
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const STORE_ID = '8WgfKtgaE8aAXdqFhIfweEo5WFq2';
const MASTER_PATH =
  process.env.LITTLE_HANDS_MONTHLY_MASTER ||
  '/home/anwar/Downloads/Monthly Sales & Expenses .xls';
const SEP_CASH_EXCEL =
  '/media/anwar/12AD-9999/Cash/september/Copy of September edited.xlsx';

function round2(n) {
  return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
}

function monthEndYmd(ym) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isClass7Account(account) {
  const code = String(account.code || '').trim();
  if (['450', '704'].includes(code)) return false;
  if (account.type === 'revenue') return true;
  const head = parseInt(String(code).split('.')[0], 10);
  const n = parseInt(code, 10);
  if (Number.isFinite(head) && head >= 7000 && head < 8000) return true;
  return Number.isFinite(n) && n >= 400 && n < 460;
}

function parseMasterMonths() {
  const wb = XLSX.readFile(MASTER_PATH, { cellDates: true });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
  const out = [];
  for (let i = 3; i < rows.length; i++) {
    const raw = rows[i][0];
    const sales = round2(rows[i][1]);
    if (!raw || !Number.isFinite(sales) || sales <= 0) continue;
    let ymd;
    if (raw instanceof Date && !Number.isNaN(raw.getTime())) ymd = raw.toISOString().slice(0, 10);
    else {
      const m = String(raw).trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
      if (!m) continue;
      ymd = `${m[3]}-${String(+m[2]).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`;
    }
    out.push({ ym: ymd.slice(0, 7), masterSales: sales });
  }
  return out;
}

function septemberCashBookSalesRef() {
  if (!fs.existsSync(SEP_CASH_EXCEL)) return null;
  const wb = XLSX.readFile(SEP_CASH_EXCEL, { cellDates: true });
  const sh = wb.Sheets['Total Cash '];
  if (!sh) return null;
  const rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: '' });
  let sum = 0;
  for (let i = 2; i < rows.length; i++) {
    const desc = String(rows[i][1] || '').toLowerCase();
    const c = round2(String(rows[i][2]).replace(/[^0-9.-]/g, '') || 0);
    if (c <= 0) continue;
    if (/august|cash flow sanaa|total sum per month|net in cash/.test(desc)) continue;
    if (/walk-in|birthday|gaelle|myraim|makhlouf/.test(desc)) sum += c;
  }
  return round2(sum);
}

async function class7NetForRange(db, storeId, start, end) {
  const [entriesSnap, linesSnap, accountsSnap] = await Promise.all([
    db.collection('stores').doc(storeId).collection('journalEntries').get(),
    db.collection('stores').doc(storeId).collection('journalLines').get(),
    db.collection('stores').doc(storeId).collection('ledgerAccounts').get(),
  ]);
  const acctById = new Map(accountsSnap.docs.map((d) => [d.id, d.data()]));
  const posted = new Set(
    entriesSnap.docs
      .filter((d) => {
        const e = d.data();
        const x = String(e.date || '').slice(0, 10);
        return e.status === 'posted' && x >= start && x <= end;
      })
      .map((d) => d.id),
  );
  let net = 0;
  for (const doc of linesSnap.docs) {
    const l = doc.data();
    if (!posted.has(l.entryId)) continue;
    const a = acctById.get(l.accountId);
    if (!a || !isClass7Account(a)) continue;
    net += (l.credit || 0) - (l.debit || 0);
  }
  return round2(net);
}

async function main() {
  const sa = require(path.join(__dirname, '../serviceAccountKey.json'));
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
  }
  const db = admin.firestore();
  const keysSnap = await db.collection('stores').doc(STORE_ID).collection('journalEntryKeys').get();
  const masterKeys = new Set(keysSnap.docs.map((d) => d.id).filter((id) => id.startsWith('monthly_sales_master:')));

  const months = [];
  for (const m of parseMasterMonths()) {
    const start = `${m.ym}-01`;
    const end = monthEndYmd(m.ym);
    const gl = await class7NetForRange(db, STORE_ID, start, end);
    const delta = round2(m.masterSales - gl);
    let status = 'ok';
    if (delta > 0.5) status = 'under_master';
    else if (delta < -0.5) status = 'over_master';
    months.push({
      ym: m.ym,
      masterSales: m.masterSales,
      glClass7: gl,
      delta,
      status,
      masterTrueUpKey: `monthly_sales_master:${m.ym}:revenue-trueup`,
      hasMasterTrueUp: masterKeys.has(`monthly_sales_master:${m.ym}:revenue-trueup`),
    });
  }

  const sepRef = septemberCashBookSalesRef();
  const sepGl = await class7NetForRange(db, STORE_ID, '2026-09-01', '2026-09-30');
  const sepRow = {
    ym: '2026-09',
    masterSales: null,
    cashBookSalesRef: sepRef,
    glClass7: sepGl,
    status:
      sepRef == null
        ? 'no_sep_excel'
        : Math.abs(sepGl - sepRef) <= 500
          ? 'ok_vs_cashbook'
          : sepGl < sepRef - 0.5
            ? 'under_cashbook'
            : 'over_cashbook',
  };

  const report = {
    storeId: STORE_ID,
    masterPath: MASTER_PATH,
    generatedAt: new Date().toISOString(),
    months,
    september: sepRow,
    needsBackfill: months.filter((r) => r.status === 'under_master'),
    overMaster: months.filter((r) => r.status === 'over_master'),
  };

  const outPath = path.join(
    __dirname,
    '../reporting/data/littlehands-monthly-class7-gate-2026-09-18.json',
  );
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
