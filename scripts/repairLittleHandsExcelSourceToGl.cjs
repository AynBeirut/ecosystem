#!/usr/bin/env node
/**
 * Little Hands production repair:
 * make Excel/imported financeExpenses behave like live app entries in GL/P&L.
 *
 * Dry run:
 *   node scripts/repairLittleHandsExcelSourceToGl.cjs
 * Apply:
 *   node scripts/repairLittleHandsExcelSourceToGl.cjs --write
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const STORE_ID = '8WgfKtgaE8aAXdqFhIfweEo5WFq2';
const START = '2025-12-01';
const END = '2026-09-30';
const write = process.argv.includes('--write');

function nowIso() {
  return new Date().toISOString();
}

function round2(n) {
  return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
}

function dateOnly(value) {
  if (!value) return '';
  if (value.toDate) return value.toDate().toISOString().slice(0, 10);
  if (value.seconds) return new Date(value.seconds * 1000).toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function atNoonUtc(ymd) {
  return `${ymd}T12:00:00.000Z`;
}

function inRange(ymd) {
  return ymd >= START && ymd <= END;
}

function sourceDate(row) {
  return dateOnly(row.startDate || row.expenseDate || row.date || row.createdAt);
}

function sourceMemo(row) {
  return String(row.name || row.description || 'Excel expense').trim();
}

function routeFor(row) {
  const surface = String(row.expenseUiSurface || '').toLowerCase();
  const category = String(row.organizedCategory || row.category || '').toLowerCase();
  if (surface === 'supplier_purchase' || category === 'production_input') return 'supplier_purchase';
  if (surface === 'payroll' || category === 'payroll' || category === 'wages') return 'payroll';
  if (surface === 'asset' || category === 'fixed_asset') return 'asset';
  if (surface === 'treasury' || category.startsWith('owner_bank')) return 'treasury';
  return 'operating';
}

function debitCredit(accountId, debit, credit, description) {
  return {
    accountId,
    debit: round2(debit),
    credit: round2(credit),
    description,
  };
}

function accountByCode(accounts, code) {
  const account = accounts.find((a) => String(a.code) === String(code) && a.isActive !== false);
  if (!account) throw new Error(`Missing active ledger account ${code}`);
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
    tx.set(ref, {
      storeId,
      counters: { ...counters, [key]: next },
      updatedAt: nowIso(),
      ...(snap.exists ? {} : { createdAt: nowIso() }),
    }, { merge: true });
    return `${type}-${year}-${String(next).padStart(5, '0')}`;
  });
}

async function postEntry(db, storeId, input, accountsById, stats, dryRunCounter, existingKeys, existingEntries) {
  const keyRef = db.collection('stores').doc(storeId).collection('journalEntryKeys').doc(input.sourceKey);
  if (existingKeys.has(input.sourceKey)) {
    stats.skippedExistingKeys += 1;
    return null;
  }
  const entryKey = `${input.sourceType}|${input.sourceId}|${input.event}`;
  if (existingEntries.has(entryKey)) {
    stats.skippedExistingEntries += 1;
    return null;
  }

  const entryDate = atNoonUtc(input.date);
  const year = Number(input.date.slice(0, 4));
  const entryId = `JE-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const voucherNumber = await nextVoucher(db, storeId, input.voucherType, year, dryRunCounter);
  const ts = nowIso();
  const batch = db.batch();
  batch.set(keyRef, {
    storeId,
    sourceKey: input.sourceKey,
    entryId,
    createdAt: ts,
    updatedAt: ts,
  });
  batch.set(db.collection('stores').doc(storeId).collection('journalEntries').doc(entryId), {
    id: entryId,
    storeId,
    date: entryDate,
    memo: input.memo,
    status: 'posted',
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    sourceKey: input.sourceKey,
    event: input.event,
    currency: 'USD',
    voucherType: input.voucherType,
    voucherNumber,
    isSystemGenerated: true,
    postedAt: ts,
    createdAt: ts,
    updatedAt: ts,
  });
  input.lines.forEach((line, idx) => {
    const account = accountsById.get(line.accountId);
    const lineId = `${entryId}-L${idx + 1}`;
    batch.set(db.collection('stores').doc(storeId).collection('journalLines').doc(lineId), {
      id: lineId,
      storeId,
      entryId,
      accountId: account.id,
      accountCode: account.code,
      accountName: account.name,
      currency: 'USD',
      debit: round2(line.debit),
      credit: round2(line.credit),
      description: line.description,
      lineOrder: idx,
    });
  });
  if (write) await batch.commit();
  existingKeys.add(input.sourceKey);
  existingEntries.add(entryKey);
  stats.entries += 1;
  stats.amount = round2(stats.amount + input.amount);
  return { entryId, voucherNumber };
}

async function main() {
  const sa = require(path.join(__dirname, '../serviceAccountKey.json'));
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
  }
  const db = admin.firestore();
  const root = db.collection('stores').doc(STORE_ID);
  const [accountsSnap, expensesSnap, keysSnap, entriesSnap] = await Promise.all([
    root.collection('ledgerAccounts').get(),
    root.collection('financeExpenses').get(),
    root.collection('journalEntryKeys').get(),
    root.collection('journalEntries').get(),
  ]);
  const accounts = accountsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const accountsById = new Map(accounts.map((a) => [a.id, a]));
  const A = {
    cash: accountByCode(accounts, '102'),
    bank: accountByCode(accounts, '106'),
    inventory: accountByCode(accounts, '120'),
    ap: accountByCode(accounts, '201'),
    payroll: accountByCode(accounts, '601'),
    operating: accountByCode(accounts, '799'),
    fixedAsset: accountByCode(accounts, '2280'),
    ownerCurrent: accountByCode(accounts, '1090'),
  };

  const existingKeys = new Set(keysSnap.docs.map((d) => d.id));
  const existingEntries = new Set(
    entriesSnap.docs.map((d) => {
      const data = d.data() || {};
      return `${data.sourceType || ''}|${data.sourceId || ''}|${data.event || ''}`;
    }),
  );

  const rows = expensesSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((row) => {
      const d = sourceDate(row);
      return d && inRange(d) && Number(row.amount || 0) > 0 && row.isSourceOfTruth !== false;
    });

  const stats = {
    mode: write ? 'write' : 'dry-run',
    storeId: STORE_ID,
    range: { start: START, end: END },
    sourceRows: rows.length,
    entries: 0,
    amount: 0,
    skippedExistingKeys: 0,
    skippedExistingEntries: 0,
    byRoute: {},
    errors: [],
    generatedAt: nowIso(),
  };
  const dryRunCounter = {};

  for (const row of rows) {
    const route = routeFor(row);
    const amount = round2(row.amount);
    const d = sourceDate(row);
    const memo = sourceMemo(row);
    stats.byRoute[route] = stats.byRoute[route] || { rows: 0, amount: 0, entries: 0 };
    stats.byRoute[route].rows += 1;
    stats.byRoute[route].amount = round2(stats.byRoute[route].amount + amount);

    try {
      if (route === 'supplier_purchase') {
        const before = stats.entries;
        await postEntry(db, STORE_ID, {
          date: d,
          memo: `Purchase received — ${memo}`,
          sourceType: 'purchase',
          sourceId: row.id,
          sourceKey: `purchase:${row.id}:received`,
          event: 'received',
          voucherType: 'JV',
          amount,
          lines: [
            debitCredit(A.inventory.id, amount, 0, 'Inventory received from Excel cash book'),
            debitCredit(A.ap.id, 0, amount, 'Accounts payable from Excel cash book'),
          ],
        }, accountsById, stats, dryRunCounter, existingKeys, existingEntries);
        await postEntry(db, STORE_ID, {
          date: d,
          memo: `Purchase paid — ${memo}`,
          sourceType: 'purchase_payment',
          sourceId: row.id,
          sourceKey: `purchase_payment:${row.id}:paid`,
          event: 'paid',
          voucherType: 'PV',
          amount,
          lines: [
            debitCredit(A.ap.id, amount, 0, 'Accounts payable paid from cash book'),
            debitCredit(A.cash.id, 0, amount, 'Cash payment'),
          ],
        }, accountsById, stats, dryRunCounter, existingKeys, existingEntries);
        stats.byRoute[route].entries += stats.entries - before;
      } else {
        const debitAccount =
          route === 'payroll' ? A.payroll
          : route === 'asset' ? A.fixedAsset
          : route === 'treasury' ? A.ownerCurrent
          : A.operating;
        const sourceType = route === 'payroll' ? 'payroll' : route === 'asset' ? 'fixed_asset' : route === 'treasury' ? 'owner_transfer' : 'expense';
        const before = stats.entries;
        await postEntry(db, STORE_ID, {
          date: d,
          memo: `${route === 'payroll' ? 'Payroll' : route === 'asset' ? 'Fixed asset' : route === 'treasury' ? 'Owner treasury' : 'Expense'} — ${memo}`,
          sourceType,
          sourceId: row.id,
          sourceKey: `${sourceType}:${row.id}:excel-cashbook-paid`,
          event: 'excel-cashbook-paid',
          voucherType: 'PV',
          amount,
          lines: [
            debitCredit(debitAccount.id, amount, 0, memo),
            debitCredit(A.cash.id, 0, amount, 'Cash payment'),
          ],
        }, accountsById, stats, dryRunCounter, existingKeys, existingEntries);
        stats.byRoute[route].entries += stats.entries - before;
      }
    } catch (err) {
      stats.errors.push({ id: row.id, route, name: memo, amount, message: err.message });
    }
  }

  const out = path.join(__dirname, '../reporting/data/littlehands-excel-source-to-gl-repair-2026-09-18.json');
  fs.writeFileSync(out, JSON.stringify(stats, null, 2));
  console.log(JSON.stringify(stats, null, 2));
  console.log(`Report: ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
