#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));
const {
  classifyLittleHandsSupplierName,
} = require(path.join(__dirname, 'lib', 'littleHandsSupplierRouting.cjs'));

const STORE_ID = '8WgfKtgaE8aAXdqFhIfweEo5WFq2';
const WRITE = process.argv.includes('--write');
const CREATED_BY = 'repair-lh-divers-ghaz-thaer-2026-09-20';
const DIVERS_ID = 'lh-sup-divers';
const DIVERS_NAME = 'Divers';
const TARGET_IDS = {
  divers: [
    'lh-sup-a5b9dd3479b85c3c',
    'lh-sup-970814730c24b0d8',
    'lh-sup-576fe106797ef34c',
    'lh-sup-42ecb7b9fef11932',
  ],
  thaer_gas: ['lh-sup-d05b481877236f59'],
};

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

async function commitBatches(db, writes) {
  for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch();
    for (const fn of writes.slice(i, i + 400)) fn(batch);
    await batch.commit();
  }
}

async function archiveParty(db, ts, writes, supplierId, reason) {
  writes.push((batch) =>
    batch.set(
      db.collection('suppliers').doc(supplierId),
      {
        status: 'inactive',
        archivedForPurchasesUi: true,
        miscodedRoute: reason,
        archivedBy: CREATED_BY,
        updatedAt: ts,
      },
      { merge: true },
    ),
  );
  const pcg = await db
    .collection('stores')
    .doc(STORE_ID)
    .collection('pcgClientAccounts')
    .where('partyId', '==', supplierId)
    .get();
  pcg.docs.forEach((doc) => {
    writes.push((batch) =>
      batch.set(doc.ref, { archived: true, isActive: false, archivedBy: CREATED_BY, updatedAt: ts }, { merge: true }),
    );
  });
}

async function main() {
  const db = initDb();
  const ts = new Date().toISOString();
  const report = { generatedAt: ts, mode: WRITE ? 'write' : 'dry-run', rows: [] };
  const writes = [];

  writes.push((batch) =>
    batch.set(
      db.collection('suppliers').doc(DIVERS_ID),
      {
        storeId: STORE_ID,
        name: DIVERS_NAME,
        status: 'active',
        archivedForPurchasesUi: false,
        isSourceOfTruth: true,
        updatedAt: ts,
      },
      { merge: true },
    ),
  );

  const purSnap = await db.collection('purchases').where('storeId', '==', STORE_ID).get();

  for (const sid of TARGET_IDS.divers) {
    const sup = await db.collection('suppliers').doc(sid).get();
    const label = sup.data()?.name || sid;
    report.rows.push({ id: sid, name: label, route: 'divers_misc' });
    if (!WRITE) continue;
    await archiveParty(db, ts, writes, sid, 'divers_misc_item');
    purSnap.docs
      .filter((p) => p.data().supplierId === sid)
      .forEach((p) => {
        writes.push((batch) =>
          batch.set(
            p.ref,
            {
              supplierId: DIVERS_ID,
              supplierName: DIVERS_NAME,
              miscItemLabel: label,
              organizedCategory: 'misc_expense',
              expenseUiSurface: 'misc_divers',
              updatedAt: ts,
            },
            { merge: true },
          ),
        );
      });
  }

  for (const sid of TARGET_IDS.thaer_gas) {
    const sup = await db.collection('suppliers').doc(sid).get();
    const label = sup.data()?.name || sid;
    report.rows.push({ id: sid, name: label, route: 'fuel' });
    if (!WRITE) continue;
    await archiveParty(db, ts, writes, sid, 'delivery_fuel');
    purSnap.docs
      .filter((p) => p.data().supplierId === sid)
      .forEach((p) => {
        writes.push((batch) =>
          batch.set(
            p.ref,
            {
              archivedForPurchasesUi: true,
              purchasesPageEligible: false,
              organizedCategory: 'operating_expense',
              expenseUiSurface: 'fuel',
              expenseCategory: 'fuel',
              payrollStaffId: admin.firestore.FieldValue.delete(),
              miscItemLabel: label,
              reclassNote: 'Delivery fuel (Thaer) — not payroll',
              updatedAt: ts,
            },
            { merge: true },
          ),
        );
      });
  }

  // Auto-scan any other active lh-sup still classified divers/payroll by name
  const supSnap = await db.collection('suppliers').where('storeId', '==', STORE_ID).get();
  for (const doc of supSnap.docs) {
    if (doc.data().archivedForPurchasesUi || doc.data().status === 'inactive') continue;
    const route = classifyLittleHandsSupplierName(doc.data().name || '');
    if (route !== 'divers_misc' && route !== 'fuel') continue;
    if (TARGET_IDS.divers.includes(doc.id) || TARGET_IDS.thaer_gas.includes(doc.id)) continue;
    report.rows.push({ id: doc.id, name: doc.data().name, route, auto: true });
  }

  const out = path.join(
    __dirname,
    '..',
    'reporting',
    'data',
    `littlehands-divers-ghaz-thaer-repair-2026-09-20${WRITE ? '' : '-dry-run'}.json`,
  );
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (WRITE && writes.length) {
    await commitBatches(db, writes);
    console.log(`✅ ${writes.length} writes`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
