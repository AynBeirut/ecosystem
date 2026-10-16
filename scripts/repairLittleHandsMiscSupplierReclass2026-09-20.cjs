#!/usr/bin/env node
/**
 * Little Hands — reclass misc / wrong supplier cash-book rows (2026-09-20).
 *
 *   node scripts/repairLittleHandsMiscSupplierReclass2026-09-20.cjs
 *   node scripts/repairLittleHandsMiscSupplierReclass2026-09-20.cjs --write
 */
const fs = require('fs');
const path = require('path');
const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));

const STORE_ID = '8WgfKtgaE8aAXdqFhIfweEo5WFq2';
const WRITE = process.argv.includes('--write');
const CREATED_BY = 'repair-lh-misc-supplier-reclass-2026-09-20';

const DIVERS_SUPPLIER_ID = 'lh-sup-divers';
const DIVERS_LEDGER_CODE = '61111000099';
const DIVERS_LEDGER_ID = `acct-${DIVERS_LEDGER_CODE}`;
const ACCT_DIVERS_EXPENSE = 'acct-6269.91';
const ACCT_SOCIAL = 'acct-6269.3';
const ACCT_CASH = 'acct-1000';

const ARCHIVE_SUPPLIER_IDS = [
  'lh-sup-5623a5b6abd5ef9a',
  'lh-sup-595d975c85438a1a',
  'lh-sup-7db5e0643a67db2e',
  'lh-sup-c46fe3b30c0f7c41',
  'lh-sup-fd7dee87ec0c51d6',
];

const ACTIONS = {
  divers: {
    purchaseId: 'lh-cashbook-3e2650843f17780b',
    label: 'Youssef Aalaf & Maintenance Car ( Thaer)',
    amount: 66,
    date: '2026-06-14',
    voidEntryIds: ['JE-1789734042945-3eb8ab'],
    newSourceKey: 'lh-reclass:divers:youssef-aalaf:2026-06-14',
    expenseAccountId: ACCT_DIVERS_EXPENSE,
  },
  social: {
    purchaseId: 'lh-cashbook-c80293df90cdfef4',
    label: 'Social Media ( Sara, Sanaa) July',
    amount: 100,
    date: '2026-06-14',
    voidEntryIds: ['JE-1789733440704', 'JE-1789734342792-4ca78e'],
    newSourceKey: 'lh-reclass:social-media:july-2026',
    expenseAccountId: ACCT_SOCIAL,
  },
  removeExchange: {
    purchaseId: 'lh-cashbook-a47d7d3dedbe0636',
    label: 'For sanaa From Yesterday ( Maken Fi Frata)',
    voidEntryIds: ['JE-1789734261639-fa4069', 'JE-1789734262202-fad858'],
  },
  antiFly: {
    purchaseId: 'lh-cashbook-13d049f1791bb575',
    label: 'Anti Fly Fan (Marwaha Lal Deben)',
    amount: 84,
    date: '2026-06-14',
    voidEntryIds: ['JE-1789732563635', 'JE-1789733937475-730277'],
    newSourceKey: 'lh-reclass:divers:anti-fly-fan',
    expenseAccountId: ACCT_DIVERS_EXPENSE,
  },
  hammok: {
    purchaseId: 'lh-cashbook-1c77a0a1db87e419',
    label: 'Hammok ( Marjouha Mlawane)',
    amount: 15,
    date: '2026-06-14',
    voidEntryIds: ['JE-1789733954850-fb9f37', 'JE-1789733955322-f5fd9b'],
    newSourceKey: 'lh-reclass:divers:hammok',
    expenseAccountId: ACCT_DIVERS_EXPENSE,
  },
};

function nowIso() {
  return new Date().toISOString();
}

function round2(n) {
  return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
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
  const chunk = 400;
  for (let i = 0; i < writes.length; i += chunk) {
    const batch = db.batch();
    for (const fn of writes.slice(i, i + chunk)) fn(batch);
    await batch.commit();
  }
}

async function ensureDiversParty(db, ts, report, writes) {
  const supRef = db.collection('suppliers').doc(DIVERS_SUPPLIER_ID);
  const supSnap = await supRef.get();
  report.diversSupplier = { id: DIVERS_SUPPLIER_ID, existed: supSnap.exists };
  if (!supSnap.exists) {
    writes.push((batch) =>
      batch.set(supRef, {
        storeId: STORE_ID,
        name: 'Divers',
        status: 'active',
        isSourceOfTruth: true,
        importSource: 'lh-misc-reclass-2026-09-20',
        createdAt: ts,
        updatedAt: ts,
      }),
    );
  }

  const ledgerRef = db.collection('stores').doc(STORE_ID).collection('ledgerAccounts').doc(DIVERS_LEDGER_ID);
  const ledgerSnap = await ledgerRef.get();
  writes.push((batch) =>
    batch.set(
      ledgerRef,
      {
        storeId: STORE_ID,
        code: DIVERS_LEDGER_CODE,
        name: 'Divers',
        type: 'expense',
        normalBalance: 'debit',
        parentCode: '6111',
        isSystem: false,
        isActive: true,
        openingBalance: 0,
        isPcgChart: false,
        partyId: DIVERS_SUPPLIER_ID,
        partyType: 'supplier',
        pcgKind: 'D',
        grabioOperationalCode: '501',
        currency: 'USD',
        updatedAt: ts,
        ...(ledgerSnap.exists ? {} : { createdAt: ts }),
      },
      { merge: true },
    ),
  );

  const expenseRef = db.collection('stores').doc(STORE_ID).collection('ledgerAccounts').doc(ACCT_DIVERS_EXPENSE);
  const expenseSnap = await expenseRef.get();
  writes.push((batch) =>
    batch.set(
      expenseRef,
      {
        storeId: STORE_ID,
        code: '6269.91',
        name: 'Divers',
        type: 'expense',
        normalBalance: 'debit',
        parentCode: '6269.9',
        isSystem: false,
        isActive: true,
        openingBalance: 0,
        isPcgChart: true,
        pcgKind: 'D',
        grabioOperationalCode: '799',
        currency: 'USD',
        updatedAt: ts,
        ...(expenseSnap.exists ? {} : { createdAt: ts }),
      },
      { merge: true },
    ),
  );

  const pcgCol = db.collection('stores').doc(STORE_ID).collection('pcgClientAccounts');
  const pcgSnap = await pcgCol.where('partyId', '==', DIVERS_SUPPLIER_ID).limit(1).get();
  if (pcgSnap.empty) {
    writes.push((batch) =>
      batch.set(pcgCol.doc(`pcg-divers-${DIVERS_LEDGER_CODE}`), {
        storeId: STORE_ID,
        clientCode: DIVERS_LEDGER_CODE,
        grabioOperationalCode: '501',
        parentPcgCode: '6111',
        name: 'Divers',
        currency: 'USD',
        partyId: DIVERS_SUPPLIER_ID,
        partyType: 'supplier',
        createdAt: ts,
        updatedAt: ts,
      }),
    );
  }
}

function voidEntry(writes, entryRef, entryId, reason, ts, report) {
  report.voided.push({ entryId, reason });
  writes.push((batch) =>
    batch.set(
      entryRef,
      {
        status: 'voided',
        voidedAt: ts,
        voidedBy: CREATED_BY,
        voidReason: reason,
        updatedAt: ts,
      },
      { merge: true },
    ),
  );
}

async function postCashExpense(db, ts, action, report, writes, accountsById) {
  const expense = accountsById[action.expenseAccountId];
  const cash = accountsById[ACCT_CASH];
  if (!expense || !cash) throw new Error(`Missing accounts for ${action.purchaseId}`);

  const keyRef = db.collection('stores').doc(STORE_ID).collection('journalEntryKeys').doc(action.newSourceKey);
  const keySnap = await keyRef.get();
  if (keySnap.exists) {
    report.reposted.push({ purchaseId: action.purchaseId, action: 'skip_existing_key', key: action.newSourceKey });
    return;
  }

  const entryId = `JE-lh-reclass-${action.purchaseId}`;
  const ymd = action.date;
  const voucherNumber = `PV-${ymd}-LHRECLASS`;
  report.reposted.push({
    purchaseId: action.purchaseId,
    entryId,
    voucherNumber,
    debit: expense.code,
    amount: action.amount,
  });

  if (!WRITE) return;

  const entryRef = db.collection('stores').doc(STORE_ID).collection('journalEntries').doc(entryId);
  writes.push((batch) =>
    batch.set(entryRef, {
      id: entryId,
      storeId: STORE_ID,
      date: `${ymd}T12:00:00.000Z`,
      memo: `Divers / reclass — ${action.label}`,
      status: 'posted',
      sourceType: 'expense',
      sourceId: action.purchaseId,
      sourceKey: action.newSourceKey,
      event: 'lh-misc-supplier-reclass',
      currency: 'USD',
      voucherType: 'PV',
      voucherNumber,
      isSystemGenerated: true,
      createdBy: CREATED_BY,
      postedAt: ts,
      createdAt: ts,
      updatedAt: ts,
    }),
  );
  writes.push((batch) =>
    batch.set(keyRef, { storeId: STORE_ID, journalEntryId: entryId, createdAt: ts, createdBy: CREATED_BY }),
  );

  const lines = [
    {
      id: `${entryId}-L1`,
      accountId: expense.id,
      accountCode: expense.code,
      accountName: expense.name,
      debit: round2(action.amount),
      credit: 0,
      description: action.label,
    },
    {
      id: `${entryId}-L2`,
      accountId: cash.id,
      accountCode: cash.code,
      accountName: cash.name,
      debit: 0,
      credit: round2(action.amount),
      description: 'Cash payment',
    },
  ];
  lines.forEach((line, idx) => {
    writes.push((batch) =>
      batch.set(db.collection('stores').doc(STORE_ID).collection('journalLines').doc(line.id), {
        id: line.id,
        storeId: STORE_ID,
        entryId,
        accountId: line.accountId,
        accountCode: line.accountCode,
        accountName: line.accountName,
        currency: 'USD',
        debit: line.debit,
        credit: line.credit,
        description: line.description,
        lineOrder: idx,
        createdAt: ts,
        updatedAt: ts,
      }),
    );
  });
}

async function main() {
  const db = initDb();
  const ts = nowIso();
  const report = {
    generatedAt: ts,
    storeId: STORE_ID,
    mode: WRITE ? 'write' : 'dry-run',
    voided: [],
    reposted: [],
    purchases: [],
    suppliersArchived: [],
    pcgArchived: [],
    ledgerDeactivated: [],
  };
  const writes = [];

  const entriesSnap = await db.collection('stores').doc(STORE_ID).collection('journalEntries').get();
  const entryById = new Map(entriesSnap.docs.map((d) => [d.id, { id: d.id, ref: d.ref, ...d.data() }]));

  const accountsSnap = await db.collection('stores').doc(STORE_ID).collection('ledgerAccounts').get();
  const accountsById = Object.fromEntries(accountsSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
  accountsById[ACCT_DIVERS_EXPENSE] = {
    id: ACCT_DIVERS_EXPENSE,
    code: '6269.91',
    name: 'Divers',
    ...accountsById[ACCT_DIVERS_EXPENSE],
  };
  if (!accountsById[ACCT_CASH]) {
    const cash = accountsSnap.docs.map((d) => ({ id: d.id, ...d.data() })).find((a) => a.code === '102');
    if (cash) accountsById[ACCT_CASH] = cash;
  }

  await ensureDiversParty(db, ts, report, writes);

  for (const [key, action] of Object.entries(ACTIONS)) {
    if (action.voidEntryIds) {
      for (const eid of action.voidEntryIds) {
        const entry = entryById.get(eid);
        if (!entry) {
          report.voided.push({ entryId: eid, action: 'not_found' });
          continue;
        }
        if (entry.status === 'voided') {
          report.voided.push({ entryId: eid, action: 'already_voided' });
          continue;
        }
        voidEntry(writes, entry.ref, eid, `lh-misc-reclass:${key}`, ts, report);
      }
    }

    const purRef = db.collection('purchases').doc(action.purchaseId);
    const purSnap = await purRef.get();
    if (!purSnap.exists) {
      report.purchases.push({ id: action.purchaseId, action: 'missing' });
      continue;
    }

    if (key === 'removeExchange') {
      report.purchases.push({ id: action.purchaseId, action: 'archived_removed' });
      if (WRITE) {
        writes.push((batch) =>
          batch.set(purRef, {
            archivedForPurchasesUi: true,
            purchasesPageEligible: false,
            removedReason: 'POS cash exchange between days — not a supplier purchase',
            reclassBy: CREATED_BY,
            updatedAt: ts,
          }, { merge: true }),
        );
      }
      continue;
    }

    const diversSupplier = key === 'social' ? null : DIVERS_SUPPLIER_ID;
    const patch = {
      supplierId: diversSupplier || purSnap.data().supplierId,
      supplierName: key === 'social' ? 'Advertising & Publicity' : 'Divers',
      miscItemLabel: action.label,
      organizedCategory: key === 'social' ? 'marketing' : 'misc_expense',
      expenseUiSurface: key === 'social' ? 'operating' : 'misc_divers',
      reclassFromSupplierId: purSnap.data().supplierId,
      reclassBy: CREATED_BY,
      updatedAt: ts,
    };
    if (key === 'social') {
      patch.supplierId = null;
      patch.archivedForPurchasesUi = false;
    } else {
      patch.supplierId = DIVERS_SUPPLIER_ID;
    }
    report.purchases.push({ id: action.purchaseId, action: 'updated', patch });
    if (WRITE) writes.push((batch) => batch.set(purRef, patch, { merge: true }));

    if (action.newSourceKey) {
      await postCashExpense(db, ts, action, report, writes, accountsById);
    }
  }

  for (const sid of ARCHIVE_SUPPLIER_IDS) {
    const ref = db.collection('suppliers').doc(sid);
    report.suppliersArchived.push(sid);
    if (WRITE) {
      writes.push((batch) =>
        batch.set(
          ref,
          {
            status: 'inactive',
            archivedForPurchasesUi: true,
            reclassNote: 'Moved to Divers / social / removed per 2026-09-20',
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
      .where('partyId', '==', sid)
      .get();
    for (const doc of pcgSnap.docs) {
      report.pcgArchived.push({ id: doc.id, partyId: sid, code: doc.data().clientCode });
      if (WRITE) {
        writes.push((batch) =>
          batch.set(
            doc.ref,
            { archived: true, isActive: false, archivedBy: CREATED_BY, updatedAt: ts },
            { merge: true },
          ),
        );
      }
    }
  }

  for (const code of ['61111000067', '61111000084']) {
    const id = `acct-${code}`;
    if (!accountsById[id]) continue;
    report.ledgerDeactivated.push(id);
    if (WRITE) {
      writes.push((batch) =>
        batch.set(
          db.collection('stores').doc(STORE_ID).collection('ledgerAccounts').doc(id),
          { isActive: false, archived: true, archivedBy: CREATED_BY, updatedAt: ts },
          { merge: true },
        ),
      );
    }
  }

  const outPath = path.join(
    __dirname,
    '..',
    'reporting',
    'data',
    `littlehands-misc-supplier-reclass-2026-09-20${WRITE ? '' : '-dry-run'}.json`,
  );
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nWrote ${outPath}`);

  if (WRITE && writes.length) {
    await commitBatches(db, writes);
    console.log(`✅ Applied ${writes.length} batch ops`);
  } else if (!WRITE) {
    console.log(`Dry-run only — ${writes.length} ops planned. Pass --write to apply.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
