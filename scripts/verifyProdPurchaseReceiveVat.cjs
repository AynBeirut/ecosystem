#!/usr/bin/env node
/**
 * Prod proof: post one VAT purchase receive via deployed logic (functions lib).
 *   node scripts/verifyProdPurchaseReceiveVat.cjs
 */
const admin = require('firebase-admin');
const path = require('path');

const STORE = process.argv.find((a) => a.startsWith('--store='))?.split('=')[1]
  || 'Av22LKyet8QmVcu9b8Njz1HVfoy1';
const PURCHASE_ID = `vat-forward-proof-${Date.now()}`;

const sa = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
}
const functionsAdmin = require('../functions/node_modules/firebase-admin');
if (!functionsAdmin.apps.length) {
  functionsAdmin.initializeApp({
    credential: functionsAdmin.credential.cert(sa),
    projectId: 'market-flow-7b074',
  });
}

const { glPostPurchaseReceived } = require('../functions/lib/lib/ledger/platformGlBridge');

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

(async () => {
  const db = admin.firestore();
  const purchase = {
    storeId: STORE,
    id: PURCHASE_ID,
    invoiceNumber: 'VAT-PROOF-1',
    supplierName: 'VAT Forward Proof Supplier',
    status: 'received',
    taxType: 'VAT',
    taxRate: 11,
    subtotal: 100,
    totalCost: 111,
    totalAmount: 111,
    items: [{ quantity: 10, unitCost: 10 }],
    source: 'vat-forward-proof-script',
    createdAt: new Date().toISOString(),
  };

  await db.collection('purchases').doc(PURCHASE_ID).set(purchase);
  await glPostPurchaseReceived(STORE, {
    id: PURCHASE_ID,
    date: new Date().toISOString(),
    supplierName: purchase.supplierName,
    status: 'received',
    taxType: 'VAT',
    taxRate: 11,
    subtotal: 100,
    totalCost: 111,
    total: 111,
    totalAmount: 111,
    items: purchase.items,
  });

  const sk = `purchase:${PURCHASE_ID}:received`;
  const jeSnap = await db
    .collection(`stores/${STORE}/journalEntries`)
    .where('sourceKey', '==', sk)
    .limit(1)
    .get();
  if (jeSnap.empty) throw new Error('No JE posted');
  const entryId = jeSnap.docs[0].id;
  const lines = await db.collection(`stores/${STORE}/journalLines`).where('entryId', '==', entryId).get();
  const byCode = {};
  for (const d of lines.docs) {
    const l = d.data();
    const code = l.accountCode || l.accountId;
    byCode[code] = byCode[code] || { dr: 0, cr: 0, code: l.accountCode };
    byCode[code].dr = round2(byCode[code].dr + (Number(l.debit) || 0));
    byCode[code].cr = round2(byCode[code].cr + (Number(l.credit) || 0));
  }

  const inv = byCode['120'] || { dr: 0 };
  const vat = byCode['140'] || { dr: 0 };
  const ap = byCode['201'] || { cr: 0 };

  const ok =
    inv.dr === 100 &&
    vat.dr === 11 &&
    ap.cr === 111;

  console.log(JSON.stringify({ ok, storeId: STORE, purchaseId: PURCHASE_ID, entryId, lines: byCode }, null, 2));
  if (!ok) process.exit(1);
  console.log('Prod forward-fix receive proof PASSED.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
