#!/usr/bin/env node
/** One-store void of test sale ORD-000182 (laptops, $1000). Does not touch other orders. */
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const admin = require(path.join(repoRoot, 'functions', 'node_modules', 'firebase-admin'));
const serviceAccount = JSON.parse(fs.readFileSync(path.join(repoRoot, 'serviceAccountKey.json'), 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'market-flow-7b074',
});

const { glPostOrderSaleReversal } = require(path.join(repoRoot, 'functions', 'lib', 'lib', 'ledger', 'platformGlBridge.js'));
const { resolveOrderCogsLines } = require(path.join(repoRoot, 'functions', 'lib', 'lib', 'ledger', 'resolveOrderCogs.js'));

const db = admin.firestore();

function isLaptopOrder(data) {
  const items = Array.isArray(data.items) ? data.items : [];
  const blob = items.map((item) => String(item.name || item.productName || '')).join(' ').toLowerCase();
  const total = Number(data.total || 0);
  return blob.includes('laptop') && Math.abs(total - 1000) < 0.01;
}

async function main() {
  const snap = await db.collection('orders').where('invoiceNumber', '==', 'ORD-000182').get();
  const matches = snap.docs.filter((doc) => isLaptopOrder(doc.data() || {}));
  if (matches.length !== 1) {
    console.error(JSON.stringify({
      ok: false,
      found: snap.size,
      laptopMatches: matches.length,
    }));
    process.exit(1);
  }

  const doc = matches[0];
  const data = doc.data() || {};
  const storeId = String(data.storeId || '').trim();
  if (!storeId) {
    console.error(JSON.stringify({ ok: false, reason: 'missing storeId' }));
    process.exit(1);
  }

  const already = data.voided === true && String(data.status || '').toLowerCase() === 'cancelled';
  const localSaleId = String(data.localSaleId || '').trim();
  const now = new Date().toISOString();

  if (!already) {
    const orderTotal = Number(data.total || 0);
    if (orderTotal > 0) {
      const cogsLines = await resolveOrderCogsLines(storeId, Array.isArray(data.items) ? data.items : []);
      await glPostOrderSaleReversal(
        storeId,
        {
          id: doc.id,
          storeId,
          date: now,
          total: orderTotal,
          subtotal: Number(data.subtotal || orderTotal),
          taxAmount: Number(data.taxAmount || 0),
          discountAmount: Number(data.discountAmount || data.discount || 0),
          paymentMethod: String(data.paymentMethod || 'cash').trim() || 'cash',
          invoiceNumber: 'ORD-000182',
          cogsLines,
          isCashSale: true,
        },
        localSaleId ? `void-${localSaleId}` : 'void-ORD-000182',
      );
    }
    await doc.ref.set(
      {
        status: 'cancelled',
        paymentStatus: 'voided',
        amountPaid: 0,
        voided: true,
        voidReason: 'test_sale_cancel',
        voidedAt: now,
        voidSource: 'admin',
        updatedAt: now,
      },
      { merge: true },
    );
    if (localSaleId) {
      await db.collection('stores').doc(storeId).collection('posOrdersByLocalSaleId').doc(localSaleId).set(
        {
          orderId: doc.id,
          localSaleId,
          storeId,
          voided: true,
          voidReason: 'test_sale_cancel',
          voidedAt: now,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
  }

  const refunded = await db.collection('orders').where('invoiceNumber', '==', 'ORD-000181').where('storeId', '==', storeId).get();
  const refundRow = refunded.docs[0]?.data() || null;

  const evidence = {
    ok: true,
    invoiceNumber: 'ORD-000182',
    storeId,
    alreadyVoided: already,
    status: 'cancelled',
    paymentStatus: 'voided',
    total: Number(data.total || 0),
    ord181Status: refundRow ? String(refundRow.status || '') : 'not_found',
    ord181PaymentStatus: refundRow ? String(refundRow.paymentStatus || '') : '',
    at: now,
  };
  const out = path.join(repoRoot, 'reporting', 'data', 'pos-void-ord-000182-2026-09-25.json');
  fs.writeFileSync(out, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
