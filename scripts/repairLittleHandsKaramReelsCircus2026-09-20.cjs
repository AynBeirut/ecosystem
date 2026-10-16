#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));

const STORE_ID = '8WgfKtgaE8aAXdqFhIfweEo5WFq2';
const WRITE = process.argv.includes('--write');
const CREATED_BY = 'repair-lh-karam-reels-circus-2026-09-20';
const CANON_KARAM_ID = 'lh-sup-18952c36b096a12f';
const CANON_KARAM_LEDGER = '61111000020';
const CANON_KARAM_NAME = 'Karam Beik';
const ACCT_SOCIAL = 'acct-6269.3';
const ACCT_CASH = 'acct-1000';
const MERGE_KARAM_FROM = ['lh-sup-8942345d15bbf96e', 'lh-sup-89e3a88745a326be'];
const PAYROLL_ANIMATOR_IDS = [
  'lh-sup-d2ca7ba6d0f2672d',
  'lh-sup-0fb5534415dc5fca',
  'lh-sup-d925a1b350eb1328',
];
const REELS_ID = 'lh-sup-9af19ea89bdbfaf5';
const REELS_PURCHASE = 'lh-cashbook-3a507ca397f3b37d';
const REELS_VOID_JE = 'JE-1789734032955-66df87';
const REELS_SOURCE_KEY = 'lh-reclass:social-media:reels-colaboration-2026';

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

async function archiveParty(db, ts, writes, supplierId, reason) {
  const supRef = db.collection('suppliers').doc(supplierId);
  writes.push((batch) =>
    batch.set(
      supRef,
      {
        status: 'inactive',
        archivedForPurchasesUi: true,
        archivedReason: reason,
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
}

async function main() {
  const db = initDb();
  const ts = nowIso();
  const report = { generatedAt: ts, mode: WRITE ? 'write' : 'dry-run', actions: [] };
  const writes = [];

  const canonRef = db.collection('suppliers').doc(CANON_KARAM_ID);
  report.actions.push(`canon_karam:${CANON_KARAM_NAME}`);
  if (WRITE) {
    writes.push((batch) =>
      batch.set(
        canonRef,
        {
          name: CANON_KARAM_NAME,
          status: 'active',
          archivedForPurchasesUi: false,
          mergedFrom: MERGE_KARAM_FROM,
          updatedAt: ts,
        },
        { merge: true },
      ),
    );
    writes.push((batch) =>
      batch.set(
        db.collection('stores').doc(STORE_ID).collection('ledgerAccounts').doc(`acct-${CANON_KARAM_LEDGER}`),
        { name: CANON_KARAM_NAME, partyId: CANON_KARAM_ID, isActive: true, archived: false, updatedAt: ts },
        { merge: true },
      ),
    );
    const pcgCol = db.collection('stores').doc(STORE_ID).collection('pcgClientAccounts');
    const pcgSnap = await pcgCol.where('partyId', '==', CANON_KARAM_ID).limit(1).get();
    if (!pcgSnap.empty) {
      writes.push((batch) =>
        batch.set(pcgSnap.docs[0].ref, { name: CANON_KARAM_NAME, archived: false, isActive: true, updatedAt: ts }, { merge: true }),
      );
    }
  }

  const purSnap = await db.collection('purchases').where('storeId', '==', STORE_ID).get();
  for (const doc of purSnap.docs) {
    const sid = doc.data().supplierId;
    if (MERGE_KARAM_FROM.includes(sid)) {
      report.actions.push(`remap_karam_purchase:${doc.id}`);
      if (WRITE) {
        writes.push((batch) =>
          batch.set(
            doc.ref,
            {
              supplierId: CANON_KARAM_ID,
              supplierName: CANON_KARAM_NAME,
              mergedFromSupplierId: sid,
              updatedAt: ts,
            },
            { merge: true },
          ),
        );
      }
    }
  }

  for (const sid of MERGE_KARAM_FROM) {
    report.actions.push(`archive_karam_dup:${sid}`);
    if (WRITE) await archiveParty(db, ts, writes, sid, 'merged_into_karam_beik');
  }

  report.actions.push('reels_to_6269.3');
  if (WRITE) {
    await archiveParty(db, ts, writes, REELS_ID, 'social_media_expense_not_supplier');
    writes.push((batch) =>
      batch.set(
        db.collection('purchases').doc(REELS_PURCHASE),
        {
          supplierId: null,
          supplierName: 'Advertising & Publicity',
          organizedCategory: 'marketing',
          expenseUiSurface: 'operating',
          archivedForPurchasesUi: true,
          purchasesPageEligible: false,
          updatedAt: ts,
        },
        { merge: true },
      ),
    );
    writes.push((batch) =>
      batch.set(
        db.collection('stores').doc(STORE_ID).collection('journalEntries').doc(REELS_VOID_JE),
        {
          status: 'voided',
          voidedAt: ts,
          voidedBy: CREATED_BY,
          voidReason: 'Reclass to 6269.3 social media',
          updatedAt: ts,
        },
        { merge: true },
      ),
    );
    const entryId = 'JE-lh-reclass-reels-social-2026';
    const keyRef = db.collection('stores').doc(STORE_ID).collection('journalEntryKeys').doc(REELS_SOURCE_KEY);
    const keySnap = await keyRef.get();
    if (!keySnap.exists) {
      writes.push((batch) =>
        batch.set(keyRef, { storeId: STORE_ID, journalEntryId: entryId, createdAt: ts, createdBy: CREATED_BY }),
      );
      writes.push((batch) =>
        batch.set(db.collection('stores').doc(STORE_ID).collection('journalEntries').doc(entryId), {
          id: entryId,
          storeId: STORE_ID,
          date: '2026-06-14T12:00:00.000Z',
          memo: 'Social media — Reels Colaboration',
          status: 'posted',
          sourceType: 'expense',
          sourceId: REELS_PURCHASE,
          sourceKey: REELS_SOURCE_KEY,
          event: 'lh-social-media-reclass',
          currency: 'USD',
          voucherType: 'PV',
          voucherNumber: 'PV-2026-LH-REELS',
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
          debit: 250,
          credit: 0,
          description: 'Reels Colaboration Social Media',
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
          credit: 250,
          description: 'Cash payment',
          lineOrder: 1,
          createdAt: ts,
          updatedAt: ts,
        }),
      );
    }
  }

  for (const sid of PAYROLL_ANIMATOR_IDS) {
    report.actions.push(`animator_payroll:${sid}`);
    if (WRITE) {
      await archiveParty(db, ts, writes, sid, 'event_animator_payroll');
      const p = purSnap.docs.filter((d) => d.data().supplierId === sid);
      for (const doc of p) {
        writes.push((batch) =>
          batch.set(
            doc.ref,
            {
              archivedForPurchasesUi: true,
              purchasesPageEligible: false,
              organizedCategory: 'payroll',
              expenseUiSurface: 'payroll',
              updatedAt: ts,
            },
            { merge: true },
          ),
        );
      }
      const la = await db.collection('stores').doc(STORE_ID).collection('ledgerAccounts').get();
      la.docs
        .filter((d) => d.data().partyId === sid)
        .forEach((d) => {
          writes.push((batch) =>
            batch.set(d.ref, { isActive: false, archived: true, archivedBy: CREATED_BY, updatedAt: ts }, { merge: true }),
          );
        });
    }
  }

  const out = path.join(
    __dirname,
    '..',
    'reporting',
    'data',
    `littlehands-karam-reels-circus-repair-2026-09-20${WRITE ? '' : '-dry-run'}.json`,
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
