#!/usr/bin/env node
/**
 * Little Hands: one Le Marchet Selectif vendor — strip invoice junk from stored names.
 *
 *   node scripts/normalizeLittleHandsLeMarchetVendor2026-09-20.cjs
 *   node scripts/normalizeLittleHandsLeMarchetVendor2026-09-20.cjs --write
 */
const fs = require('fs');
const path = require('path');
const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));

const STORE_ID = '8WgfKtgaE8aAXdqFhIfweEo5WFq2';
const WRITE = process.argv.includes('--write');
const CREATED_BY = 'normalize-lh-le-marchet-vendor-2026-09-20';
const CANON_SUPPLIER_ID = 'lh-sup-406c44032aa379de';
const CANON_LEDGER_CODE = '61111000030';
const CANON_NAME = 'Le Marchet Selectif';

function stripCashBookLineFromVendorName(raw) {
  let name = String(raw || '').trim();
  if (!name) return name;
  const openParen = name.indexOf(' (');
  if (openParen > 0) name = name.slice(0, openParen).trim();
  name = name.replace(/\s+inv\s*\([^)]*\)\s*$/i, '').trim();
  name = name.replace(/\s+for\s+.+$/i, '').trim();
  name = name.replace(/\s+/g, ' ');
  if (/^le\s+m[ae]rche?t\s+sel[ae]ctif\s*$/i.test(name)) return CANON_NAME;
  if (/^le\s+m[ae]rche?t\s+slectif\s*$/i.test(name)) return CANON_NAME;
  if (/^le\s+marcher\s*$/i.test(name)) return CANON_NAME;
  if (/^le\s+m[ae]rche?t\s+(fruits|ice)\b/i.test(name)) return CANON_NAME;
  if (/^le\s+m[ae]rche?t\s+sel[ae]ctif\s+for\b/i.test(name)) return CANON_NAME;
  if (/^le\s+m[ae]rche?t\b/i.test(name) && !/firas/i.test(name)) return CANON_NAME;
  return name;
}

function isLeMarchetRow(name) {
  return /marchet|marche\s+sel|marcher/i.test(String(name || ''));
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

async function main() {
  const db = initDb();
  const ts = new Date().toISOString();
  const report = {
    generatedAt: ts,
    storeId: STORE_ID,
    mode: WRITE ? 'write' : 'dry-run',
    canonical: { supplierId: CANON_SUPPLIER_ID, ledgerCode: CANON_LEDGER_CODE, name: CANON_NAME },
    purchasesRemapped: 0,
    suppliersArchived: [],
    pcgArchived: [],
    ledgerUpdated: [],
  };
  const writes = [];

  const canonRef = db.collection('suppliers').doc(CANON_SUPPLIER_ID);
  const canonSnap = await canonRef.get();
  if (!canonSnap.exists || canonSnap.data().storeId !== STORE_ID) {
    throw new Error('Canonical Le Marchet supplier missing on Little Hands');
  }

  if (WRITE) {
    writes.push((batch) =>
      batch.set(
        canonRef,
        {
          name: CANON_NAME,
          status: 'active',
          archivedForPurchasesUi: false,
          isSourceOfTruth: true,
          updatedAt: ts,
        },
        { merge: true },
      ),
    );
  }

  const ledgerRef = db
    .collection('stores')
    .doc(STORE_ID)
    .collection('ledgerAccounts')
    .doc(`acct-${CANON_LEDGER_CODE}`);
  if (WRITE) {
    writes.push((batch) =>
      batch.set(
        ledgerRef,
        {
          name: CANON_NAME,
          partyId: CANON_SUPPLIER_ID,
          partyType: 'supplier',
          isActive: true,
          archived: false,
          updatedAt: ts,
        },
        { merge: true },
      ),
    );
  }
  report.ledgerUpdated.push(CANON_LEDGER_CODE);

  const purSnap = await db.collection('purchases').where('storeId', '==', STORE_ID).get();
  for (const doc of purSnap.docs) {
    const data = doc.data();
    const rawName = data.supplierName || '';
    if (!isLeMarchetRow(rawName) && !isLeMarchetRow(data.items?.[0]?.materialName)) continue;
    const clean = stripCashBookLineFromVendorName(rawName);
    const item = data.items?.[0] ? { ...data.items[0] } : undefined;
    if (item && (!item.materialName || item.materialName === rawName)) {
      item.materialName = rawName.trim();
    }
    report.purchasesRemapped += 1;
    if (WRITE) {
      writes.push((batch) =>
        batch.set(
          doc.ref,
          {
            supplierId: CANON_SUPPLIER_ID,
            supplierName: CANON_NAME,
            items: item ? [item, ...data.items.slice(1)] : data.items,
            invoiceLineLabel: rawName.trim(),
            updatedAt: ts,
          },
          { merge: true },
        ),
      );
    }
  }

  const supSnap = await db.collection('suppliers').where('storeId', '==', STORE_ID).get();
  for (const doc of supSnap.docs) {
    if (doc.id === CANON_SUPPLIER_ID) continue;
    if (/firas/i.test(doc.data().name || '')) continue;
    if (!isLeMarchetRow(doc.data().name)) continue;
    report.suppliersArchived.push({ id: doc.id, name: doc.data().name });
    if (WRITE) {
      writes.push((batch) =>
        batch.set(
          doc.ref,
          {
            status: 'inactive',
            archivedForPurchasesUi: true,
            mergedIntoSupplierId: CANON_SUPPLIER_ID,
            archivedBy: CREATED_BY,
            updatedAt: ts,
          },
          { merge: true },
        ),
      );
    }
  }

  const pcgSnap = await db.collection('stores').doc(STORE_ID).collection('pcgClientAccounts').get();
  let canonPcgKept = false;
  for (const doc of pcgSnap.docs) {
    const row = doc.data();
    if (/firas/i.test(row.name || '')) continue;
    if (!isLeMarchetRow(row.name) && row.partyId !== CANON_SUPPLIER_ID) continue;
    const isCanonRow = row.clientCode === CANON_LEDGER_CODE;
    if (isCanonRow) {
      canonPcgKept = true;
      if (WRITE) {
        writes.push((batch) =>
          batch.set(
            doc.ref,
            {
              name: CANON_NAME,
              archived: false,
              isActive: true,
              partyId: CANON_SUPPLIER_ID,
              updatedAt: ts,
            },
            { merge: true },
          ),
        );
      }
      continue;
    }
    report.pcgArchived.push({ id: doc.id, code: row.clientCode, name: row.name });
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

  if (!canonPcgKept && WRITE) {
    const pcgRef = db.collection('stores').doc(STORE_ID).collection('pcgClientAccounts').doc(`pcg-le-marchet-${CANON_LEDGER_CODE}`);
    writes.push((batch) =>
      batch.set(pcgRef, {
        storeId: STORE_ID,
        clientCode: CANON_LEDGER_CODE,
        grabioOperationalCode: '501',
        parentPcgCode: '6111',
        name: CANON_NAME,
        currency: 'USD',
        partyId: CANON_SUPPLIER_ID,
        partyType: 'supplier',
        createdAt: ts,
        updatedAt: ts,
      }),
    );
  }

  const laSnap = await db.collection('stores').doc(STORE_ID).collection('ledgerAccounts').get();
  for (const doc of laSnap.docs) {
    const row = doc.data();
    if (!isLeMarchetRow(row.name)) continue;
    if (row.code === CANON_LEDGER_CODE) continue;
    if (WRITE) {
      writes.push((batch) =>
        batch.set(
          doc.ref,
          { isActive: false, archived: true, archivedBy: CREATED_BY, updatedAt: ts },
          { merge: true },
        ),
      );
    }
  }

  const out = path.join(__dirname, '..', 'reporting', 'data', `littlehands-le-marchet-vendor-normalize-2026-09-20${WRITE ? '' : '-dry-run'}.json`);
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (WRITE && writes.length) {
    await commitBatches(db, writes);
    console.log(`✅ Applied ${writes.length} writes`);
  } else if (!WRITE) {
    console.log(`Dry-run — ${writes.length} writes planned`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
