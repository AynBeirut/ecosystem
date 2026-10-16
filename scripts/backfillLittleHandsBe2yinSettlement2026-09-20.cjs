#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));

const STORE_ID = '8WgfKtgaE8aAXdqFhIfweEo5WFq2';
const PURCHASE_ID = 'lh-cashbook-519ad04b8de73c27';
const SUPPLIER_ID = 'lh-sup-a6d9bd33dee1c8fd';
const DIVERS_ID = 'lh-sup-divers';
const WRITE = process.argv.includes('--write');

function initDb() {
  const saPath = path.join(__dirname, '..', 'serviceAccountKey.json');
  if (!fs.existsSync(saPath)) throw new Error('missing SA');
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(fs.readFileSync(saPath, 'utf8'))),
      projectId: 'market-flow-7b074',
    });
  }
  return admin.firestore();
}

async function main() {
  const db = initDb();
  const ts = new Date().toISOString();
  const patch = {
    cashBookLineText: 'Be2yin Men Fetoura abel',
    cashBookExcelSheet: '22-2-2026',
    cashBookExcelRow: 41,
    cashBookExpenseNeighbors: [
      { row: 42, label: 'Le Charcutier', amount: 62 },
      { row: 43, label: 'Flower Mothers Day', amount: 33 },
      { row: 44, label: 'Event MegaStore', amount: 46 },
    ],
    settlementMemoType: 'prior_invoice_balance',
    settlementReferenceName: 'abel',
    organizedCategory: 'misc_expense',
    expenseUiSurface: 'misc_divers',
    miscItemLabel: 'Be2yin Men Fetoura abel',
    supplierId: DIVERS_ID,
    supplierName: 'Divers',
    miscodedSupplierId: SUPPLIER_ID,
    notes:
      'Cash-book: balance from prior invoice (Abel). Source Marsh2026.xls sheet 22-2-2026 row 41. Not a vendor card.',
    updatedAt: ts,
  };

  const out = path.join(__dirname, '..', 'reporting', 'data', 'littlehands-be2yin-settlement-backfill-2026-09-20.json');
  fs.writeFileSync(out, JSON.stringify({ generatedAt: ts, mode: WRITE ? 'write' : 'dry-run', patch }, null, 2));
  console.log(JSON.stringify(patch, null, 2));

  if (!WRITE) return;

  const batch = db.batch();
  batch.set(db.collection('purchases').doc(PURCHASE_ID), patch, { merge: true });
  batch.set(
    db.collection('suppliers').doc(SUPPLIER_ID),
    {
      status: 'inactive',
      archivedForPurchasesUi: true,
      miscodedRoute: 'prior_invoice_settlement',
      updatedAt: ts,
    },
    { merge: true },
  );
  await batch.commit();
  console.log('✅ backfill written');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
