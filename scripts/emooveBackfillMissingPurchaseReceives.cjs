#!/usr/bin/env node
/**
 * E-Moove (EZfuo) — idempotent backfill for 3 POS purchases missing purchase:received GL.
 *
 *   node scripts/emooveBackfillMissingPurchaseReceives.cjs --dry-run
 *   node scripts/emooveBackfillMissingPurchaseReceives.cjs --write
 */
const fs = require('fs');
const path = require('path');
const admin = require('../functions/node_modules/firebase-admin');

const STORE_ID = 'EZfuoNQFTJVU4cubNuckpp4K7zw2';
const CREATED_BY = 'cursor-emoove-purchase-receive-backfill-2026-07';
const PURCHASE_IDS = [
  'pos-EZfuoNQFTJVU4cubNuckpp4K7zw2-11',
  'pos-EZfuoNQFTJVU4cubNuckpp4K7zw2-12',
  'pos-EZfuoNQFTJVU4cubNuckpp4K7zw2-13',
];

const dryRun = !process.argv.includes('--write');
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function initAdmin() {
  const saPath = path.join(process.cwd(), 'serviceAccountKey.json');
  const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
  }
  return admin.firestore();
}

const { glPostPurchaseReceived } = require('../functions/lib/lib/ledger/platformGlBridge');
const { buildSourceKey } = require('../functions/lib/lib/ledger/postingService');

function mapPurchaseForGl(id, data) {
  const items = Array.isArray(data.items)
    ? data.items.map((it) => ({
        quantity: Number(it.quantity) || 0,
        unitCost: Number(it.unitCost ?? it.unitPrice ?? 0),
        unitPrice: Number(it.unitPrice ?? it.unitCost ?? 0),
        rawPrice: Number(it.rawPrice ?? it.unitCost ?? it.unitPrice ?? 0),
      }))
    : [];
  const total = round2(Number(data.totalAmount ?? data.total ?? data.totalCost ?? data.amount ?? 0));
  return {
    id,
    date: String(data.date ?? data.receivedDate ?? data.orderDate ?? data.createdAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString()).slice(0, 10),
    supplierId: data.supplierId != null ? String(data.supplierId) : undefined,
    supplierName: String(data.supplierName ?? 'Supplier'),
    items,
    amount: total,
    total,
    totalCost: total,
    subtotal: round2(Number(data.subtotal ?? 0)) || undefined,
    taxAmount: round2(Number(data.taxAmount ?? data.vat ?? 0)) || undefined,
    taxType: data.taxType != null ? String(data.taxType) : undefined,
    taxRate: Number(data.taxRate ?? 0) || undefined,
    status: 'fulfilled',
    currency: String(data.currency ?? 'USD'),
  };
}

async function ap201NetCredit(db) {
  const [acctSnap, entrySnap, lineSnap] = await Promise.all([
    db.collection(`stores/${STORE_ID}/ledgerAccounts`).where('code', '==', '201').limit(1).get(),
    db.collection(`stores/${STORE_ID}/journalEntries`).where('status', '==', 'posted').get(),
    db.collection(`stores/${STORE_ID}/journalLines`).get(),
  ]);
  const ap = acctSnap.docs[0]?.data();
  const apId = acctSnap.docs[0]?.id;
  if (!ap) return null;
  const posted = new Set(entrySnap.docs.map((d) => d.id));
  let d = 0;
  let c = 0;
  for (const line of lineSnap.docs) {
    const l = line.data();
    if (!posted.has(l.entryId)) continue;
    if (l.accountId !== apId && l.accountCode !== '201') continue;
    d = round2(d + (Number(l.debit) || 0));
    c = round2(c + (Number(l.credit) || 0));
  }
  const opening = round2(Number(ap.openingBalance) || 0);
  return round2(c - d + opening);
}

(async () => {
  const db = initAdmin();
  console.log(`\n=== E-Moove missing receive backfill (${dryRun ? 'DRY-RUN' : 'WRITE'}) ===\n`);

  const apBefore = await ap201NetCredit(db);
  console.log('GL 201 net credit before:', apBefore);

  let plannedTotal = 0;
  for (const purchaseId of PURCHASE_IDS) {
    const ref = db.collection('purchases').doc(purchaseId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error(`Missing purchase ${purchaseId}`);
    const data = snap.data();
    if (String(data.storeId) !== STORE_ID) throw new Error(`${purchaseId} wrong storeId`);
    if (String(data.status) !== 'received') throw new Error(`${purchaseId} status=${data.status}`);

    const sourceKey = buildSourceKey('purchase', purchaseId, 'received');
    const existing = await db
      .collection(`stores/${STORE_ID}/journalEntries`)
      .where('sourceKey', '==', sourceKey)
      .limit(1)
      .get();
    const po = mapPurchaseForGl(purchaseId, data);
    plannedTotal = round2(plannedTotal + po.total);

    console.log(`${purchaseId} | ${data.supplierName} | TTC ${po.total} | existing JE: ${existing.size > 0 ? existing.docs[0].id : 'none'}`);

    if (existing.size > 0) {
      console.log('  → skip (idempotent)');
      continue;
    }
    if (dryRun) {
      console.log('  → would post', sourceKey);
      continue;
    }

    await glPostPurchaseReceived(STORE_ID, po);
    await ref.update({
      glPostingStatus: 'posted',
      glPostedAt: admin.firestore.FieldValue.serverTimestamp(),
      glPostingError: admin.firestore.FieldValue.delete(),
    });
    const after = await db
      .collection(`stores/${STORE_ID}/journalEntries`)
      .where('sourceKey', '==', sourceKey)
      .limit(1)
      .get();
    if (after.empty) throw new Error(`Post succeeded but no JE for ${sourceKey}`);
    console.log('  → posted', after.docs[0].id);
  }

  const apAfter = await ap201NetCredit(db);
  console.log('\nPlanned AP credit add (no existing JEs):', plannedTotal);
  console.log('GL 201 net credit after:', apAfter);
  if (!dryRun && apBefore != null && apAfter != null) {
    console.log('Δ 201:', round2(apAfter - apBefore));
  }
  console.log(dryRun ? '\nRe-run with --write to post.' : '\nDone.');
})().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
