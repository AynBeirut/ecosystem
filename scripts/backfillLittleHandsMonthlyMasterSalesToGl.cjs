#!/usr/bin/env node
/**
 * Post missing Class 7 revenue from Monthly Sales & Expenses .xls col B (month truth).
 * Only when GL Class 7 net for the month is below master (never reduces over-posted months).
 *
 *   node scripts/backfillLittleHandsMonthlyMasterSalesToGl.cjs
 *   node scripts/backfillLittleHandsMonthlyMasterSalesToGl.cjs --write
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const STORE_ID = '8WgfKtgaE8aAXdqFhIfweEo5WFq2';
const MASTER_PATH =
  process.env.LITTLE_HANDS_MONTHLY_MASTER ||
  '/home/anwar/Downloads/Monthly Sales & Expenses .xls';
const write = process.argv.includes('--write');
const alignOver = process.argv.includes('--align-over');

function round2(n) {
  return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
}

function nowIso() {
  return new Date().toISOString();
}

function atNoonUtc(ymd) {
  return `${ymd}T12:00:00.000Z`;
}

/** Last calendar day of month in local time (avoid UTC slice shifting month-end JEs out of range). */
function monthEndYmd(ym) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m, 0);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function parseMasterMonths() {
  if (!fs.existsSync(MASTER_PATH)) {
    throw new Error(`Master not found: ${MASTER_PATH}`);
  }
  const wb = XLSX.readFile(MASTER_PATH, { cellDates: true });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
  const out = [];
  for (let i = 3; i < rows.length; i++) {
    const raw = rows[i][0];
    const sales = round2(rows[i][1]);
    if (!raw || !Number.isFinite(sales) || sales <= 0) continue;
    let ymd;
    if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
      ymd = raw.toISOString().slice(0, 10);
    } else {
      const m = String(raw).trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
      if (!m) continue;
      ymd = `${m[3]}-${String(+m[2]).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`;
    }
    out.push({ ym: ymd.slice(0, 7), monthEnd: ymd, masterSales: sales });
  }
  return out;
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

async function class7NetForMonth(db, storeId, ym) {
  const start = `${ym}-01`;
  const end = monthEndYmd(ym);
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

function accountByCode(accounts, code) {
  const account = accounts.find((a) => String(a.code) === String(code) && a.isActive !== false);
  if (!account) throw new Error(`Missing ledger account ${code}`);
  return account;
}

async function nextVoucher(db, storeId, type, year, dryRunCounter) {
  if (!write) {
    dryRunCounter[type] = (dryRunCounter[type] || 0) + 1;
    return `${type}-${year}-DRY${String(dryRunCounter[type]).padStart(5, '0')}`;
  }
  const ref = db.collection('stores').doc(storeId).collection('ledgerMeta').doc('voucherSerials');
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() || {} : {};
    const counters = data.counters || {};
    const key = `${type}-${year}`;
    const next = Number(counters[key] || 0) + 1;
    tx.set(
      ref,
      {
        storeId,
        counters: { ...counters, [key]: next },
        updatedAt: nowIso(),
        ...(snap.exists ? {} : { createdAt: nowIso() }),
      },
      { merge: true },
    );
    return `${type}-${year}-${String(next).padStart(5, '0')}`;
  });
}

async function postTrueUp(db, storeId, month, amount, cashAcct, revenueAcct, existingKeys) {
  const sourceKey = `monthly_sales_master:${month.ym}:revenue-trueup`;
  if (existingKeys.has(sourceKey)) {
    return { skipped: 'existing-key', sourceKey };
  }
  const entryId = `JE-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const year = Number(month.monthEnd.slice(0, 4));
  const dryRunCounter = {};
  const voucherNumber = await nextVoucher(db, storeId, 'RV', year, dryRunCounter);
  const ts = nowIso();
  const memo = `Monthly sales (master col B) — ${month.ym}`;
  const batch = db.batch();
  const keyRef = db.collection('stores').doc(storeId).collection('journalEntryKeys').doc(sourceKey);
  batch.set(keyRef, { storeId, sourceKey, entryId, createdAt: ts, updatedAt: ts });
  batch.set(db.collection('stores').doc(storeId).collection('journalEntries').doc(entryId), {
    id: entryId,
    storeId,
    date: atNoonUtc(month.monthEnd),
    memo,
    status: 'posted',
    sourceType: 'monthly_sales_master',
    sourceId: month.ym,
    sourceKey,
    event: 'revenue-trueup',
    currency: 'USD',
    voucherType: 'RV',
    voucherNumber,
    isSystemGenerated: true,
    postedAt: ts,
    createdAt: ts,
    updatedAt: ts,
  });
  const lines = [
    {
      accountId: cashAcct.id,
      accountCode: cashAcct.code,
      accountName: cashAcct.name,
      debit: amount,
      credit: 0,
      description: memo,
    },
    {
      accountId: revenueAcct.id,
      accountCode: revenueAcct.code,
      accountName: revenueAcct.name,
      debit: 0,
      credit: amount,
      description: 'Sales revenue — monthly master',
    },
  ];
  lines.forEach((line, idx) => {
    const lineId = `${entryId}-L${idx + 1}`;
    batch.set(db.collection('stores').doc(storeId).collection('journalLines').doc(lineId), {
      id: lineId,
      storeId,
      entryId,
      accountId: line.accountId,
      accountCode: line.accountCode,
      accountName: line.accountName,
      currency: 'USD',
      debit: round2(line.debit),
      credit: round2(line.credit),
      description: line.description,
      lineOrder: idx,
    });
  });
  if (write) await batch.commit();
  existingKeys.add(sourceKey);
  return { posted: true, sourceKey, entryId, voucherNumber, amount };
}

/** Reduce Class 7 when POS duplicated above master col B (Dr revenue, Cr cash). */
async function postAlignDown(db, storeId, month, amount, cashAcct, revenueAcct, existingKeys) {
  const sourceKey = `monthly_sales_master:${month.ym}:revenue-align-master`;
  if (existingKeys.has(sourceKey)) {
    return { skipped: 'existing-key', sourceKey };
  }
  const entryId = `JE-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const year = Number(month.monthEnd.slice(0, 4));
  const dryRunCounter = {};
  const voucherNumber = await nextVoucher(db, storeId, 'RV', year, dryRunCounter);
  const ts = nowIso();
  const memo = `Align sales to master col B — ${month.ym}`;
  const batch = db.batch();
  const keyRef = db.collection('stores').doc(storeId).collection('journalEntryKeys').doc(sourceKey);
  batch.set(keyRef, { storeId, sourceKey, entryId, createdAt: ts, updatedAt: ts });
  batch.set(db.collection('stores').doc(storeId).collection('journalEntries').doc(entryId), {
    id: entryId,
    storeId,
    date: atNoonUtc(month.monthEnd),
    memo,
    status: 'posted',
    sourceType: 'monthly_sales_master',
    sourceId: month.ym,
    sourceKey,
    event: 'revenue-align-master',
    currency: 'USD',
    voucherType: 'RV',
    voucherNumber,
    isSystemGenerated: true,
    postedAt: ts,
    createdAt: ts,
    updatedAt: ts,
  });
  const lines = [
    {
      accountId: revenueAcct.id,
      accountCode: revenueAcct.code,
      accountName: revenueAcct.name,
      debit: amount,
      credit: 0,
      description: memo,
    },
    {
      accountId: cashAcct.id,
      accountCode: cashAcct.code,
      accountName: cashAcct.name,
      debit: 0,
      credit: amount,
      description: 'Sales align — monthly master',
    },
  ];
  lines.forEach((line, idx) => {
    const lineId = `${entryId}-L${idx + 1}`;
    batch.set(db.collection('stores').doc(storeId).collection('journalLines').doc(lineId), {
      id: lineId,
      storeId,
      entryId,
      accountId: line.accountId,
      accountCode: line.accountCode,
      accountName: line.accountName,
      currency: 'USD',
      debit: round2(line.debit),
      credit: round2(line.credit),
      description: line.description,
      lineOrder: idx,
    });
  });
  if (write) await batch.commit();
  existingKeys.add(sourceKey);
  return { posted: true, sourceKey, entryId, voucherNumber, amount };
}

async function main() {
  const sa = require(path.join(__dirname, '../serviceAccountKey.json'));
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
  }
  const db = admin.firestore();
  const months = parseMasterMonths();
  const accountsSnap = await db.collection('stores').doc(STORE_ID).collection('ledgerAccounts').get();
  const accounts = accountsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const cashAcct = accountByCode(accounts, '102');
  const revenueAcct = accountByCode(accounts, '401');
  const keysSnap = await db.collection('stores').doc(STORE_ID).collection('journalEntryKeys').get();
  const existingKeys = new Set(keysSnap.docs.map((d) => d.id));

  const report = {
    mode: write ? 'write' : 'dry-run',
    storeId: STORE_ID,
    masterPath: MASTER_PATH,
    months: [],
    posted: [],
    alignedDown: [],
    skipped: [],
    alignOver,
    at: nowIso(),
  };

  for (const month of months) {
    const glNet = await class7NetForMonth(db, STORE_ID, month.ym);
    const delta = round2(month.masterSales - glNet);
    const row = {
      ym: month.ym,
      masterSales: month.masterSales,
      glClass7Net: glNet,
      trueUpAmount: delta > 0.01 ? delta : 0,
      alignDownAmount: delta < -0.01 ? round2(-delta) : 0,
    };
    report.months.push(row);
    if (delta > 0.01) {
      const result = await postTrueUp(db, STORE_ID, month, delta, cashAcct, revenueAcct, existingKeys);
      report.posted.push({ ...row, ...result });
      continue;
    }
    if (delta < -0.01 && alignOver) {
      const result = await postAlignDown(
        db,
        STORE_ID,
        month,
        round2(-delta),
        cashAcct,
        revenueAcct,
        existingKeys,
      );
      report.alignedDown.push({ ...row, ...result });
      continue;
    }
    report.skipped.push({
      ym: month.ym,
      reason: delta < -0.01 ? 'over_master_needs_align_over_flag' : 'ok',
    });
  }

  const outPath = path.join(
    __dirname,
    '../reporting/data/littlehands-monthly-master-sales-gl-backfill-2026-09-18.json',
  );
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, months: report.months.length, posted: report.posted.length }, null, 2));
  console.log(`Report: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
