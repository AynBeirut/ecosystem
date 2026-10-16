#!/usr/bin/env node
/**
 * Little Hands — payroll/exchange rows miscoded as suppliers (Mariam, Cynthia Helo, Sara exchange).
 */
const fs = require('fs');
const path = require('path');
const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));

const STORE_ID = '8WgfKtgaE8aAXdqFhIfweEo5WFq2';
const WRITE = process.argv.includes('--write');
const CREATED_BY = 'repair-lh-misnamed-suppliers-2026-09-20';
const CYNTHIA_STAFF_ID = 'usb-8WgfKtgaE8aAXdqFhIfweEo5WFq2-cynthia-hello';

const FIXES = [
  {
    supplierId: 'lh-sup-01a0eedaf62153cf',
    label: 'Mariam',
    kind: 'payroll_ambiguous',
    purchaseIds: ['lh-cashbook-aaf056056b461841'],
    voidPurchaseEntryIds: ['JE-1789733368027'],
    keepPayrollEntryIds: ['JE-1789734284629-aea279'],
  },
  {
    supplierId: 'lh-sup-023ebfd43f456e78',
    label: 'Cynthia Helo',
    kind: 'employee_payroll',
    staffId: CYNTHIA_STAFF_ID,
    purchaseIds: ['lh-cashbook-5c9154ec054c7609', 'lh-cashbook-ff360c0b7f93888b'],
    voidPurchaseEntryIds: ['JE-1789733182163', 'JE-1789733568570'],
    keepPayrollEntryIds: ['JE-1789734102202-2729bd', 'JE-1789734463020-aa69ec'],
  },
  {
    supplierId: 'lh-sup-024e1db53cd013f2',
    label: 'Returne To Sara Exchange',
    kind: 'treasury_exchange_remove',
    purchaseIds: [],
    voidPurchaseEntryIds: [],
    keepPayrollEntryIds: [],
  },
];

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

async function main() {
  const db = initDb();
  const ts = new Date().toISOString();
  const report = { generatedAt: ts, storeId: STORE_ID, mode: WRITE ? 'write' : 'dry-run', fixes: [] };
  const writes = [];

  for (const fix of FIXES) {
    const entry = { ...fix, actions: [] };
    const supRef = db.collection('suppliers').doc(fix.supplierId);
    const supSnap = await supRef.get();
    if (!supSnap.exists || supSnap.data().storeId !== STORE_ID) {
      entry.actions.push('supplier_missing');
      report.fixes.push(entry);
      continue;
    }

    entry.actions.push('archive_supplier');
    if (WRITE) {
      writes.push((batch) =>
        batch.set(
          supRef,
          {
            status: 'inactive',
            archivedForPurchasesUi: true,
            miscodedAs: fix.kind,
            payrollStaffId: fix.staffId || null,
            archivedBy: CREATED_BY,
            archivedReason: fix.kind,
            updatedAt: ts,
          },
          { merge: true },
        ),
      );
    }

    const pcgSnap = await db
      .collection('stores')
      .doc(STORE_ID)
      .collection('pcgClientAccounts')
      .where('partyId', '==', fix.supplierId)
      .get();
    for (const doc of pcgSnap.docs) {
      entry.actions.push(`archive_pcg:${doc.id}`);
      if (WRITE) {
        writes.push((batch) =>
          batch.set(doc.ref, { archived: true, isActive: false, archivedBy: CREATED_BY, updatedAt: ts }, { merge: true }),
        );
      }
    }

    for (const pid of fix.purchaseIds) {
      const purRef = db.collection('purchases').doc(pid);
      entry.actions.push(`reclass_purchase:${pid}`);
      if (WRITE) {
        writes.push((batch) =>
          batch.set(
            purRef,
            {
              archivedForPurchasesUi: true,
              purchasesPageEligible: false,
              organizedCategory: fix.kind === 'employee_payroll' ? 'payroll' : 'payroll',
              expenseUiSurface: 'payroll',
              payrollStaffId: fix.staffId || null,
              miscodedSupplierId: fix.supplierId,
              reclassBy: CREATED_BY,
              updatedAt: ts,
            },
            { merge: true },
          ),
        );
      }
    }

    for (const eid of fix.voidPurchaseEntryIds) {
      entry.actions.push(`void_purchase_je:${eid}`);
      if (WRITE) {
        writes.push((batch) =>
          batch.set(
            db.collection('stores').doc(STORE_ID).collection('journalEntries').doc(eid),
            {
              status: 'voided',
              voidedAt: ts,
              voidedBy: CREATED_BY,
              voidReason: `Miscoded supplier AP — ${fix.label}`,
              updatedAt: ts,
            },
            { merge: true },
          ),
        );
      }
    }

    report.fixes.push(entry);
  }

  const out = path.join(
    __dirname,
    '..',
    'reporting',
    'data',
    `littlehands-misnamed-suppliers-repair-2026-09-20${WRITE ? '' : '-dry-run'}.json`,
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
