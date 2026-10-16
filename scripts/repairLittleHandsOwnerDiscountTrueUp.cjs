#!/usr/bin/env node
/**
 * Owner-sheet discounts (Sanaa/Sara) → GL (idempotent delta only).
 * - Sum# row with "unpaid" and no product line = 100% discount (full Sum# amount), not AR skip.
 * - Month for those summary rows = sheet month (e.g. Dyafe January 2026 → 2026-01).
 *
 *   node scripts/repairLittleHandsOwnerDiscountTrueUp.cjs
 *   node scripts/repairLittleHandsOwnerDiscountTrueUp.cjs --write
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const STORE_ID = '8WgfKtgaE8aAXdqFhIfweEo5WFq2';
const OWNER_FILES = [
  '/media/anwar/12AD-9999/Sanaa .xlsx',
  '/media/anwar/12AD-9999/Sara.xlsx',
];
const write = process.argv.includes('--write');

const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
const nowIso = () => new Date().toISOString();

function localYmd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthEndYmd(ym) {
  const [y, m] = ym.split('-').map(Number);
  return localYmd(new Date(y, m, 0));
}

function parseExpectedYm(sheetName) {
  const s = String(sheetName || '').toLowerCase();
  if (s.includes('dec')) return '2025-12';
  if (s.includes('january')) return '2026-01';
  if (s.includes('feb')) return '2026-02';
  if (s.includes('marsh') || s.includes('march')) return '2026-03';
  if (s.includes('april')) return '2026-04';
  if (s.includes('may')) return '2026-05';
  if (s.includes('june')) return '2026-06';
  if (s.includes('july')) return '2026-07';
  if (s.includes('august')) return '2026-08';
  if (s.includes('september')) return '2026-09';
  return null;
}

function parseDateForExpected(value, expectedYm) {
  if (!expectedYm) return null;
  const expYear = Number(expectedYm.slice(0, 4));
  const expMonth = Number(expectedYm.slice(5, 7));
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const ymd = localYmd(value);
    return ymd.startsWith(expectedYm) ? ymd : null;
  }
  const m = String(value || '').trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (!m) return null;
  const a = +m[1];
  const b = +m[2];
  const y = +m[3];
  if (y !== expYear) return null;
  let month = b;
  let day = a;
  if (a === expMonth && b !== expMonth) {
    month = a;
    day = b;
  }
  if (month !== expMonth || day < 1 || day > 31) return null;
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function paymentStatus(row) {
  for (let c = 6; c <= 7; c++) {
    const v = String(row[c] || '').trim().toLowerCase();
    if (v === 'unpaid' || v === 'paid') return v;
  }
  return '';
}

/** Sum# only + "unpaid" = 100% discounted (not collectible AR). */
function parseFullDiscountSummary(row, expectedYm, ctx) {
  if (paymentStatus(row) !== 'unpaid') return null;
  const sumHash = round2(Number(row[5]) || 0);
  const qty = Number(row[2]) || 0;
  const price = Number(row[3]) || 0;
  const desc = String(row[1] || '').trim();
  if (sumHash <= 0 || qty > 0 || price > 0 || desc) return null;
  return {
    ym: expectedYm,
    discount: sumHash,
    ...ctx,
    kind: 'full_discount_summary',
  };
}

function skipDescription(desc) {
  const d = String(desc || '').trim().toLowerCase();
  if (!d) return true;
  return /total after discount|discount|paid|unpaid|stl by|sum#/.test(d);
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pushDiscount(monthMap, row) {
  const cur = monthMap.get(row.ym) || { discount: 0, rows: [] };
  cur.discount = round2(cur.discount + row.discount);
  cur.rows.push(row);
  monthMap.set(row.ym, cur);
}

function parseOwnerDiscountByMonth() {
  const monthMap = new Map();
  for (const filePath of OWNER_FILES) {
    if (!fs.existsSync(filePath)) continue;
    const wb = XLSX.readFile(filePath, { cellDates: true });
    for (const sheetName of wb.SheetNames) {
      const expectedYm = parseExpectedYm(sheetName);
      if (!expectedYm) continue;
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
      let currentDate = null;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const excelRow = i + 1;
        const ctxBase = { file: filePath, sheet: sheetName, excelRow };

        const fullSummary = parseFullDiscountSummary(row, expectedYm, ctxBase);
        if (fullSummary) {
          pushDiscount(monthMap, fullSummary);
          continue;
        }

        const parsedDate = parseDateForExpected(row[0], expectedYm);
        if (parsedDate) currentDate = parsedDate;
        if (!currentDate) continue;

        if (paymentStatus(row) === 'unpaid') continue;

        const desc = String(row[1] || '').trim();
        if (skipDescription(desc)) continue;
        const qty = toNum(row[2]);
        const price = toNum(row[3]);
        const lineTotal = toNum(row[5]);
        if (qty <= 0 || price <= 0 || lineTotal < 0) continue;

        const gross = round2(qty * price);
        const discount = round2(gross - lineTotal);
        if (discount <= 0) continue;

        const ym = currentDate.slice(0, 7);
        pushDiscount(monthMap, {
          ym,
          discount,
          ...ctxBase,
          date: currentDate,
          desc,
          qty,
          price,
          total: lineTotal,
          kind: 'line_discount',
        });
      }
    }
  }
  return monthMap;
}

function accountByCode(accounts, code) {
  const acct = accounts.find((a) => String(a.code) === String(code) && a.isActive !== false);
  if (!acct) throw new Error(`Missing active account ${code}`);
  return acct;
}

function firstActiveByCodes(accounts, codes) {
  for (const code of codes) {
    const acct = accounts.find((a) => String(a.code) === String(code) && a.isActive !== false);
    if (acct) return acct;
  }
  throw new Error(`Missing active account in [${codes.join(', ')}]`);
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
    tx.set(ref, { storeId, counters: { ...counters, [key]: next }, updatedAt: nowIso() }, { merge: true });
    return `${type}-${year}-${String(next).padStart(5, '0')}`;
  });
}

async function main() {
  const sa = require(path.join(__dirname, '../serviceAccountKey.json'));
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
  }
  const db = admin.firestore();
  const root = db.collection('stores').doc(STORE_ID);
  const [accountsSnap, entriesSnap, linesSnap, keysSnap] = await Promise.all([
    root.collection('ledgerAccounts').get(),
    root.collection('journalEntries').get(),
    root.collection('journalLines').get(),
    root.collection('journalEntryKeys').get(),
  ]);

  const accounts = accountsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const salesAcct = accountByCode(accounts, '401');
  const discountAcct = firstActiveByCodes(accounts, ['410', '7090', '7191', '7190']);

  const ownerEntries = entriesSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((e) => e.sourceType === 'owner_discount_backup' && e.event === 'discount-trueup' && e.status === 'posted');
  const ownerEntryIds = new Set(ownerEntries.map((e) => e.id));
  const postedByMonth = new Map();
  const countByMonth = new Map();
  for (const lineDoc of linesSnap.docs) {
    const line = lineDoc.data();
    if (!ownerEntryIds.has(line.entryId)) continue;
    if (line.accountId !== discountAcct.id) continue;
    const entry = ownerEntries.find((e) => e.id === line.entryId);
    if (!entry) continue;
    const ym = String(entry.sourceId || '');
    postedByMonth.set(ym, round2((postedByMonth.get(ym) || 0) + (line.debit || 0)));
    countByMonth.set(ym, Number(countByMonth.get(ym) || 0) + 1);
  }

  const parsed = parseOwnerDiscountByMonth();
  const dryRunCounter = {};
  const report = {
    mode: write ? 'write' : 'dry-run',
    storeId: STORE_ID,
    sourceFiles: OWNER_FILES,
    discountAccount: { id: discountAcct.id, code: discountAcct.code },
    months: [],
    posted: [],
    skipped: [],
    generatedAt: nowIso(),
  };

  for (const ym of [...parsed.keys()].sort()) {
    const target = round2(parsed.get(ym).discount);
    const already = round2(postedByMonth.get(ym) || 0);
    const delta = round2(target - already);
    const monthRow = {
      ym,
      targetDiscount: target,
      alreadyPostedDiscount: already,
      missingDiscount: delta > 0 ? delta : 0,
      overPosted: delta < 0 ? Math.abs(delta) : 0,
      sourceRows: parsed.get(ym).rows.length,
      fullDiscountSummaries: parsed.get(ym).rows.filter((r) => r.kind === 'full_discount_summary'),
    };
    report.months.push(monthRow);
    if (delta <= 0.01) {
      report.skipped.push({ ym, reason: delta < 0 ? 'already_over_posted' : 'already_aligned' });
      continue;
    }

    const seq = String((countByMonth.get(ym) || 0) + 1).padStart(2, '0');
    const sourceKey = `owner_discount_backup:${ym}:discount-trueup:${seq}`;
    if (keysSnap.docs.some((d) => d.id === sourceKey)) {
      report.skipped.push({ ym, reason: 'source_key_exists', sourceKey });
      continue;
    }

    const entryId = `JE-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const year = Number(ym.slice(0, 4));
    const voucherNumber = await nextVoucher(db, STORE_ID, 'RV', year, dryRunCounter);
    const ts = nowIso();
    const batch = db.batch();
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
      date: `${monthEndYmd(ym)}T12:00:00.000Z`,
      memo: `Owner discount true-up (${ym}) — includes 100% discounted Sum# rows`,
      status: 'posted',
      sourceType: 'owner_discount_backup',
      sourceId: ym,
      sourceKey,
      event: 'discount-trueup',
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
        id: `${entryId}-L1`,
        storeId: STORE_ID,
        entryId,
        accountId: discountAcct.id,
        accountCode: discountAcct.code,
        accountName: discountAcct.name,
        currency: 'USD',
        debit: round2(delta),
        credit: 0,
        description: 'Owner discount true-up',
        lineOrder: 0,
      },
      {
        id: `${entryId}-L2`,
        storeId: STORE_ID,
        entryId,
        accountId: salesAcct.id,
        accountCode: salesAcct.code,
        accountName: salesAcct.name,
        currency: 'USD',
        debit: 0,
        credit: round2(delta),
        description: 'Owner discount true-up',
        lineOrder: 1,
      },
    ];
    for (const line of lines) batch.set(root.collection('journalLines').doc(line.id), line);
    if (write) await batch.commit();
    countByMonth.set(ym, Number(countByMonth.get(ym) || 0) + 1);
    postedByMonth.set(ym, round2(already + delta));
    report.posted.push({ ym, sourceKey, entryId, voucherNumber, amount: round2(delta) });
  }

  const outPath = path.join(__dirname, '../reporting/data/littlehands-owner-discount-trueup-2026-09-18.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(`Report: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
