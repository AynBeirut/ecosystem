#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));

const STORE_ID = '8WgfKtgaE8aAXdqFhIfweEo5WFq2';
const PURCHASE_ID = 'lh-cashbook-519ad04b8de73c27';
const SUPPLIER_ID = 'lh-sup-a6d9bd33dee1c8fd';
const CREATED_BY = 'remove-lh-be2yin-12-2026-09-20';
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
  const report = { generatedAt: ts, mode: WRITE ? 'write' : 'dry-run', purchaseId: PURCHASE_ID, actions: [] };

  const pRef = db.collection('purchases').doc(PURCHASE_ID);
  const pSnap = await pRef.get();
  if (!pSnap.exists || pSnap.data().storeId !== STORE_ID) {
    throw new Error('purchase missing or wrong store');
  }
  report.purchase = { total: pSnap.data().total, supplierName: pSnap.data().supplierName };

  const jeSnap = await db.collection('stores').doc(STORE_ID).collection('journalEntries').get();
  const relatedJe = jeSnap.docs.filter((d) => d.data().sourceId === PURCHASE_ID);
  report.journalEntries = relatedJe.map((d) => ({ id: d.id, status: d.data().status, memo: d.data().memo }));

  if (!WRITE) {
    const out = path.join(__dirname, '..', 'reporting', 'data', 'littlehands-be2yin-12-remove-2026-09-20-dry-run.json');
    fs.writeFileSync(out, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const batch = db.batch();
  batch.set(
    pRef,
    {
      status: 'cancelled',
      paymentStatus: 'voided',
      accountingActive: false,
      archivedForPurchasesUi: true,
      purchasesPageEligible: false,
      excludeFromPartyStatement: true,
      voidedAt: ts,
      voidedBy: CREATED_BY,
      voidReason: 'Prior-invoice balance line removed — not a real purchase',
      updatedAt: ts,
    },
    { merge: true },
  );
  report.actions.push('purchase_voided');

  for (const doc of relatedJe) {
    batch.set(
      doc.ref,
      {
        status: 'voided',
        voidedAt: ts,
        voidedBy: CREATED_BY,
        voidReason: 'Be2yin settlement USD 12 removed',
        updatedAt: ts,
      },
      { merge: true },
    );
    report.actions.push(`je_voided:${doc.id}`);
  }

  batch.set(
    db.collection('suppliers').doc(SUPPLIER_ID),
    { status: 'inactive', archivedForPurchasesUi: true, archivedBy: CREATED_BY, updatedAt: ts },
    { merge: true },
  );
  report.actions.push('supplier_archived');

  await batch.commit();

  const out = path.join(__dirname, '..', 'reporting', 'data', 'littlehands-be2yin-12-remove-2026-09-20.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log('✅ removed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
