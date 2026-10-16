#!/usr/bin/env node
/**
 * Merge duplicate Little Hands supplier cards (same display vendor after cash-book strip).
 *
 *   node scripts/mergeLittleHandsDuplicateSuppliers2026-09-20.cjs
 *   node scripts/mergeLittleHandsDuplicateSuppliers2026-09-20.cjs --write
 */
const fs = require('fs');
const path = require('path');
const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));
const { classifyLittleHandsSupplierName } = require(path.join(__dirname, 'lib', 'littleHandsSupplierRouting.cjs'));

const STORE_ID = '8WgfKtgaE8aAXdqFhIfweEo5WFq2';
const WRITE = process.argv.includes('--write');
const CREATED_BY = 'merge-lh-duplicate-suppliers-2026-09-20';

const CANON_BY_KEY = {
  'le marchet selectif': 'lh-sup-406c44032aa379de',
  spinneys: 'pos-8WgfKtgaE8aAXdqFhIfweEo5WFq2-1',
};

function stripCashBookLineFromVendorName(raw) {
  let name = String(raw || '').trim();
  if (!name) return name;
  const openParen = name.indexOf(' (');
  if (openParen > 0) name = name.slice(0, openParen).trim();
  name = name.replace(/\s+inv\s*\([^)]*\)\s*$/i, '').trim();
  name = name.replace(/\s+for\s+.+$/i, '').trim();
  name = name.replace(/\s+/g, ' ');
  if (/^le\s+m[ae]rche?t\s+sel[ae]ctif\s*$/i.test(name)) return 'Le Marchet Selectif';
  if (/^le\s+m[ae]rche?t\s+slectif\s*$/i.test(name)) return 'Le Marchet Selectif';
  if (/^le\s+marcher\s*$/i.test(name)) return 'Le Marchet Selectif';
  if (/^le\s+m[ae]rche?t\s+(fruits|ice)\b/i.test(name)) return 'Le Marchet Selectif';
  if (/^spinneys\b/i.test(name)) return 'Spinneys';
  if (/^storium\b/i.test(name)) return 'Storium';
  if (/^boucherie\s+ziad\b/i.test(name)) return 'Boucherie Ziad';
  return name;
}

function listKey(name) {
  return stripCashBookLineFromVendorName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function showOnList(name) {
  return classifyLittleHandsSupplierName(name) === 'vendor' && !/^karam\s+bek$/i.test(String(name).trim());
}

function initDb() {
  const saPath = path.join(__dirname, '..', 'serviceAccountKey.json');
  if (!fs.existsSync(saPath)) throw new Error('missing serviceAccountKey.json');
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

async function archiveParty(db, ts, writes, supplierId, mergedInto) {
  writes.push((batch) =>
    batch.set(
      db.collection('suppliers').doc(supplierId),
      {
        status: 'inactive',
        archivedForPurchasesUi: true,
        mergedIntoSupplierId: mergedInto,
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
  const report = { generatedAt: ts, mode: WRITE ? 'write' : 'dry-run', merges: [], purchasesRemapped: 0 };

  const [supSnap, purSnap] = await Promise.all([
    db.collection('suppliers').where('storeId', '==', STORE_ID).get(),
    db.collection('purchases').where('storeId', '==', STORE_ID).get(),
  ]);

  const purchaseCount = new Map();
  purSnap.docs.forEach((p) => {
    const sid = p.data().supplierId;
    if (!sid) return;
    purchaseCount.set(sid, (purchaseCount.get(sid) || 0) + 1);
  });

  const visible = [];
  supSnap.docs.forEach((d) => {
    const x = d.data();
    if (x.status === 'inactive' || x.archivedForPurchasesUi) return;
    const name = String(x.name || '').trim();
    if (!showOnList(name)) return;
    visible.push({ id: d.id, name, data: x });
  });

  const groups = new Map();
  for (const row of visible) {
    const key = listKey(row.name);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const writes = [];

  for (const [key, rows] of groups.entries()) {
    if (rows.length < 2) continue;

    let winnerId = CANON_BY_KEY[key];
    if (winnerId && !rows.some((r) => r.id === winnerId)) {
      winnerId = null;
    }
    if (!winnerId) {
      const sorted = [...rows].sort((a, b) => {
        const ca = purchaseCount.get(a.id) || 0;
        const cb = purchaseCount.get(b.id) || 0;
        if (cb !== ca) return cb - ca;
        if (a.data.isSourceOfTruth && !b.data.isSourceOfTruth) return -1;
        if (b.data.isSourceOfTruth && !a.data.isSourceOfTruth) return 1;
        if (a.id.startsWith('pos-') && !b.id.startsWith('pos-')) return -1;
        if (b.id.startsWith('pos-') && !a.id.startsWith('pos-')) return 1;
        return a.id.localeCompare(b.id);
      });
      winnerId = sorted[0].id;
    }

    const winner = rows.find((r) => r.id === winnerId) || rows[0];
    const displayName = stripCashBookLineFromVendorName(winner.name);
    const losers = rows.filter((r) => r.id !== winnerId);

    const mergeRow = {
      key,
      displayName,
      winnerId,
      loserIds: losers.map((l) => l.id),
      loserNames: losers.map((l) => l.name),
    };
    report.merges.push(mergeRow);

    if (!WRITE) continue;

    writes.push((batch) =>
      batch.set(
        db.collection('suppliers').doc(winnerId),
        {
          name: displayName,
          isSourceOfTruth: true,
          mergedFromSupplierIds: losers.map((l) => l.id),
          updatedAt: ts,
          updatedBy: CREATED_BY,
        },
        { merge: true },
      ),
    );

    for (const loser of losers) {
      await archiveParty(db, ts, writes, loser.id, winnerId);
      purSnap.docs
        .filter((p) => p.data().supplierId === loser.id)
        .forEach((p) => {
          report.purchasesRemapped += 1;
          writes.push((batch) =>
            batch.set(
              p.ref,
              {
                supplierId: winnerId,
                supplierName: displayName,
                mergedFromSupplierId: loser.id,
                updatedAt: ts,
              },
              { merge: true },
            ),
          );
        });
    }
  }

  const out = path.join(
    __dirname,
    '..',
    'reporting',
    'data',
    `littlehands-duplicate-suppliers-merge-2026-09-20${WRITE ? '' : '-dry-run'}.json`,
  );
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ merges: report.merges.length, purchasesRemapped: report.purchasesRemapped, merges: report.merges }, null, 2));
  if (WRITE && writes.length) {
    await commitBatches(db, writes);
    console.log(`✅ ${writes.length} writes`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
