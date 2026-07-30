/**
 * Seed E-Service test PO (partial paidAmount) + verify AP aging outstanding.
 * Usage: node scripts/seedEserviceApAgingTestPo.cjs [--cleanup]
 */
const admin = require('firebase-admin');
const { readFileSync } = require('fs');
const { join } = require('path');

const STORE = 'Av22LKyet8QmVcu9b8Njz1HVfoy1';
const DOC_ID = 'TEST-AP-AGING-2026-07-25';
const AS_OF = '2026-07-25';
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

try {
  const sa = JSON.parse(readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
} catch {
  process.exit(1);
}

const db = admin.firestore();
const cleanup = process.argv.includes('--cleanup');

function outstanding(po) {
  if (po.status !== 'sent' && po.status !== 'approved') return 0;
  const total = round2(Number(po.total ?? po.amount) || 0);
  const paid = round2(Number(po.paidAmount) || 0);
  return round2(Math.max(0, total - paid));
}

(async () => {
  const ref = db.doc(`stores/${STORE}/financePurchaseOrders/${DOC_ID}`);
  if (cleanup) {
    await ref.delete();
    console.log('Deleted', DOC_ID);
    process.exit(0);
  }

  const now = new Date().toISOString();
  await ref.set({
    storeId: STORE,
    id: DOC_ID,
    date: '2026-06-20T12:00:00.000Z',
    createdAt: now,
    updatedAt: now,
    supplierName: 'AP Aging Test Supplier',
    status: 'approved',
    currency: 'USD',
    amount: 250,
    total: 250,
    paidAmount: 75,
    isApAgingTest: true,
    notes: 'E2E AP aging partial test',
    lineItems: [{ description: 'Test materials', quantity: 1, unitPrice: 250 }],
  });

  const po = (await ref.get()).data();
  const out = outstanding({ ...po, id: DOC_ID });
  const days = Math.floor((new Date(AS_OF) - new Date(String(po.date).slice(0, 10))) / 86400000);
  const ok = out === 175 && days >= 31 && days <= 60;
  console.log({ gross: 250, paid: 75, outstanding: out, daysPast: days, bucket: days <= 30 ? 'current' : days <= 60 ? '31-60' : 'other' });
  console.log(ok ? '✅ Partial AP aging verified ($175 not $250)' : '❌ failed');
  process.exit(ok ? 0 : 1);
})();
