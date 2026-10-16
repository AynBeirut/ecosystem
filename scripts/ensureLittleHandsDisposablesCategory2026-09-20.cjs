#!/usr/bin/env node
/**
 * Little Hands: DISPOSBLES misc category shell + route disposable supplier cards to Divers items.
 */
const fs = require('fs');
const path = require('path');
const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));
const {
  classifyLittleHandsSupplierName,
} = require(path.join(__dirname, 'lib', 'littleHandsSupplierRouting.cjs'));
const {
  LITTLE_HANDS_MISC_CATEGORIES,
  littleHandsMiscCategoryIdForName,
} = require(path.join(__dirname, 'lib', 'littleHandsMiscCategories.cjs'));

const STORE_ID = '8WgfKtgaE8aAXdqFhIfweEo5WFq2';
const WRITE = process.argv.includes('--write');
const CREATED_BY = 'ensure-lh-disposables-category-2026-09-20';
const DIVERS_ID = 'lh-sup-divers';
const DIVERS_NAME = 'Divers';
const CAT = LITTLE_HANDS_MISC_CATEGORIES.DISPOSBLES;

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

async function main() {
  const db = initDb();
  const ts = new Date().toISOString();
  const report = { generatedAt: ts, mode: WRITE ? 'write' : 'dry-run', suppliers: [], category: CAT };
  const writes = [];

  writes.push((batch) =>
    batch.set(
      db.collection('stores').doc(STORE_ID).collection('littleHandsMiscCategories').doc(CAT.id),
      {
        id: CAT.id,
        label: CAT.label,
        categorySupplierId: CAT.categorySupplierId,
        storeId: STORE_ID,
        isItemCategory: true,
        updatedAt: ts,
        updatedBy: CREATED_BY,
      },
      { merge: true },
    ),
  );

  writes.push((batch) =>
    batch.set(
      db.collection('suppliers').doc(CAT.categorySupplierId),
      {
        storeId: STORE_ID,
        name: CAT.label,
        status: 'active',
        isMiscItemCategory: true,
        miscItemCategory: CAT.id,
        archivedForPurchasesUi: true,
        purchasesPageEligible: false,
        isSourceOfTruth: true,
        updatedAt: ts,
        updatedBy: CREATED_BY,
      },
      { merge: true },
    ),
  );

  const [supSnap, purSnap] = await Promise.all([
    db.collection('suppliers').where('storeId', '==', STORE_ID).get(),
    db.collection('purchases').where('storeId', '==', STORE_ID).get(),
  ]);

  for (const doc of supSnap.docs) {
    if (doc.id === CAT.categorySupplierId || doc.id === DIVERS_ID) continue;
    const name = String(doc.data().name || '').trim();
    if (!littleHandsMiscCategoryIdForName(name)) continue;
    if (classifyLittleHandsSupplierName(name) !== 'divers_misc') continue;
    report.suppliers.push({ id: doc.id, name });

    if (!WRITE) continue;

    if (doc.id !== CAT.categorySupplierId) {
      writes.push((batch) =>
        batch.set(
          doc.ref,
          {
            status: 'inactive',
            archivedForPurchasesUi: true,
            miscodedRoute: 'divers_misc',
            miscItemCategory: CAT.id,
            archivedBy: CREATED_BY,
            updatedAt: ts,
          },
          { merge: true },
        ),
      );
    }

    purSnap.docs
      .filter((p) => p.data().supplierId === doc.id)
      .forEach((p) => {
        writes.push((batch) =>
          batch.set(
            p.ref,
            {
              supplierId: DIVERS_ID,
              supplierName: DIVERS_NAME,
              organizedCategory: 'misc_expense',
              expenseUiSurface: 'misc_divers',
              miscItemCategory: CAT.id,
              miscItemLabel: name,
              updatedAt: ts,
            },
            { merge: true },
          ),
        );
      });
  }

  const out = path.join(
    __dirname,
    '..',
    'reporting',
    'data',
    `littlehands-disposables-category-2026-09-20${WRITE ? '' : '-dry-run'}.json`,
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
