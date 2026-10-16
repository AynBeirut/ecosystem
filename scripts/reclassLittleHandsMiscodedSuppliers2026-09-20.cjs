#!/usr/bin/env node
/**
 * Route miscoded Little Hands supplier cards → social media (6269.3) or payroll.
 *
 *   node scripts/reclassLittleHandsMiscodedSuppliers2026-09-20.cjs
 *   node scripts/reclassLittleHandsMiscodedSuppliers2026-09-20.cjs --write
 */
const fs = require('fs');
const path = require('path');
const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));
const {
  classifyLittleHandsSupplierName,
} = require(path.join(__dirname, 'lib', 'littleHandsSupplierRouting.cjs'));
const {
  littleHandsMiscCategoryIdForName,
} = require(path.join(__dirname, 'lib', 'littleHandsMiscCategories.cjs'));

const STORE_ID = '8WgfKtgaE8aAXdqFhIfweEo5WFq2';
const WRITE = process.argv.includes('--write');
const CREATED_BY = 'reclass-lh-miscoded-suppliers-2026-09-20';
const ACCT_SOCIAL = 'acct-6269.3';
const ACCT_CASH = 'acct-1000';

function nowIso() {
  return new Date().toISOString();
}

function initDb() {
  const saPath = path.join(__dirname, '..', 'serviceAccountKey.json');
  if (!fs.existsSync(saPath)) throw new Error('serviceAccountKey.json not found');
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

async function archiveSupplier(db, ts, writes, supplierId, reason) {
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
  const pcgSnap = await db
    .collection('stores')
    .doc(STORE_ID)
    .collection('pcgClientAccounts')
    .where('partyId', '==', supplierId)
    .get();
  for (const doc of pcgSnap.docs) {
    writes.push((batch) =>
      batch.set(doc.ref, { archived: true, isActive: false, archivedBy: CREATED_BY, updatedAt: ts }, { merge: true }),
    );
  }
  const laSnap = await db.collection('stores').doc(STORE_ID).collection('ledgerAccounts').get();
  laSnap.docs
    .filter((d) => d.data().partyId === supplierId)
    .forEach((d) => {
      writes.push((batch) =>
        batch.set(d.ref, { isActive: false, archived: true, archivedBy: CREATED_BY, updatedAt: ts }, { merge: true }),
      );
    });
}

async function ensureSocialJe(db, ts, writes, purchaseId, amount, label, report) {
  const sourceKey = `lh-reclass:social:${purchaseId}`;
  const keyRef = db.collection('stores').doc(STORE_ID).collection('journalEntryKeys').doc(sourceKey);
  const keySnap = await keyRef.get();
  if (keySnap.exists) return;

  const entryId = `JE-lh-social-${purchaseId}`;
  report.socialJePosted.push({ purchaseId, amount, entryId });
  if (!WRITE) return;

  writes.push((batch) => batch.set(keyRef, { storeId: STORE_ID, journalEntryId: entryId, createdAt: ts, createdBy: CREATED_BY }));
  writes.push((batch) =>
    batch.set(db.collection('stores').doc(STORE_ID).collection('journalEntries').doc(entryId), {
      id: entryId,
      storeId: STORE_ID,
      date: `${ts.slice(0, 10)}T12:00:00.000Z`,
      memo: `Social media — ${label}`,
      status: 'posted',
      sourceType: 'expense',
      sourceId: purchaseId,
      sourceKey,
      event: 'lh-social-media-route',
      currency: 'USD',
      voucherType: 'PV',
      voucherNumber: `PV-LH-SOC-${purchaseId.slice(-8)}`,
      isSystemGenerated: true,
      createdBy: CREATED_BY,
      postedAt: ts,
      createdAt: ts,
      updatedAt: ts,
    }),
  );
  writes.push((batch) =>
    batch.set(db.collection('stores').doc(STORE_ID).collection('journalLines').doc(`${entryId}-L1`), {
      id: `${entryId}-L1`,
      storeId: STORE_ID,
      entryId,
      accountId: ACCT_SOCIAL,
      accountCode: '6269.3',
      accountName: 'Advertising & Publicity',
      currency: 'USD',
      debit: amount,
      credit: 0,
      description: label,
      lineOrder: 0,
      createdAt: ts,
      updatedAt: ts,
    }),
  );
  writes.push((batch) =>
    batch.set(db.collection('stores').doc(STORE_ID).collection('journalLines').doc(`${entryId}-L2`), {
      id: `${entryId}-L2`,
      storeId: STORE_ID,
      entryId,
      accountId: ACCT_CASH,
      accountCode: '102',
      accountName: 'POS Cash Drawer',
      currency: 'USD',
      debit: 0,
      credit: amount,
      description: 'Cash payment',
      lineOrder: 1,
      createdAt: ts,
      updatedAt: ts,
    }),
  );
}

async function main() {
  const db = initDb();
  const ts = nowIso();
  const DIVERS_ID = 'lh-sup-divers';
  const DIVERS_NAME = 'Divers';
  const report = {
    generatedAt: ts,
    mode: WRITE ? 'write' : 'dry-run',
    social: [],
    payroll: [],
    treasury: [],
    divers_misc: [],
    fuel: [],
    socialJePosted: [],
    purchaseJesVoided: [],
  };
  const writes = [];

  const [supSnap, purSnap, jeSnap] = await Promise.all([
    db.collection('suppliers').where('storeId', '==', STORE_ID).get(),
    db.collection('purchases').where('storeId', '==', STORE_ID).get(),
    db.collection('stores').doc(STORE_ID).collection('journalEntries').get(),
  ]);

  const entries = jeSnap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));

  for (const doc of supSnap.docs) {
    const name = String(doc.data().name || '').trim();
    const route = classifyLittleHandsSupplierName(name);
    if (route === 'vendor') continue;
    if (doc.data().archivedForPurchasesUi && doc.data().status === 'inactive') continue;

    const row = { id: doc.id, name, route };
    const bucket =
      route === 'social_media' ? 'social' : route === 'divers_misc' ? 'divers_misc' : route;
    if (report[bucket]) report[bucket].push(row);
    else report.payroll.push(row);

    if (!WRITE) continue;

    await archiveSupplier(db, ts, writes, doc.id, route);

    const purchases = purSnap.docs.filter((p) => p.data().supplierId === doc.id);
    for (const p of purchases) {
      const amount = Number(p.data().total) || 0;
      const patch = {
        archivedForPurchasesUi: true,
        purchasesPageEligible: false,
        miscodedSupplierId: doc.id,
        reclassBy: CREATED_BY,
        updatedAt: ts,
      };
      if (route === 'social_media') {
        patch.supplierId = null;
        patch.supplierName = 'Advertising & Publicity';
        patch.organizedCategory = 'marketing';
        patch.expenseUiSurface = 'operating';
      } else if (route === 'payroll') {
        patch.organizedCategory = 'payroll';
        patch.expenseUiSurface = 'payroll';
      } else if (route === 'divers_misc') {
        patch.supplierId = DIVERS_ID;
        patch.supplierName = DIVERS_NAME;
        patch.organizedCategory = 'misc_expense';
        patch.expenseUiSurface = 'misc_divers';
        patch.miscItemLabel = name;
        const miscCat = littleHandsMiscCategoryIdForName(name);
        if (miscCat) patch.miscItemCategory = miscCat;
      } else if (route === 'fuel') {
        patch.organizedCategory = 'operating_expense';
        patch.expenseUiSurface = 'fuel';
        patch.expenseCategory = 'fuel';
        patch.miscItemLabel = name;
      } else {
        patch.organizedCategory = 'treasury';
        patch.expenseUiSurface = 'treasury';
      }
      writes.push((batch) => batch.set(p.ref, patch, { merge: true }));

      const related = entries.filter((e) => e.sourceId === p.id && e.status === 'posted');
      for (const e of related) {
        const memo = String(e.memo || '').toLowerCase();
        const isPayrollJe = memo.includes('payroll') || e.sourceType === 'payroll';
        const isPurchaseJe = memo.includes('purchase') || e.sourceType === 'purchase';
        if (route === 'social_media' && !memo.includes('6269.3')) {
          report.purchaseJesVoided.push(e.id);
          writes.push((batch) =>
            batch.set(e.ref, {
              status: 'voided',
              voidedAt: ts,
              voidedBy: CREATED_BY,
              voidReason: 'Reclass to social media 6269.3',
              updatedAt: ts,
            }, { merge: true }),
          );
        }
        if (route === 'payroll' && isPurchaseJe && !isPayrollJe) {
          const hasPayroll = related.some((x) => String(x.memo || '').toLowerCase().includes('payroll'));
          if (hasPayroll) {
            report.purchaseJesVoided.push(e.id);
            writes.push((batch) =>
              batch.set(e.ref, {
                status: 'voided',
                voidedAt: ts,
                voidedBy: CREATED_BY,
                voidReason: 'Miscoded supplier AP — payroll only',
                updatedAt: ts,
              }, { merge: true }),
            );
          }
        }
      }

      if (route === 'social_media' && amount > 0) {
        await ensureSocialJe(db, ts, writes, p.id, amount, name, report);
      }
    }
  }

  const out = path.join(
    __dirname,
    '..',
    'reporting',
    'data',
    `littlehands-miscoded-suppliers-bulk-reclass-2026-09-20${WRITE ? '' : '-dry-run'}.json`,
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
