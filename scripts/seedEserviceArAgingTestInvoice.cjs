/**
 * Seed E-Service test invoice (partial payment) + verify AR aging outstanding logic.
 *
 * Usage:
 *   node scripts/seedEserviceArAgingTestInvoice.cjs
 *   node scripts/seedEserviceArAgingTestInvoice.cjs --cleanup
 */

const admin = require('firebase-admin');
const { readFileSync } = require('fs');
const { join } = require('path');

const STORE = 'Av22LKyet8QmVcu9b8Njz1HVfoy1';
const DOC_ID = 'TEST-AR-AGING-2026-07-25';
const AS_OF = '2026-07-25';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

try {
  const sa = JSON.parse(readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
} catch {
  console.error('❌ serviceAccountKey.json required');
  process.exit(1);
}

const db = admin.firestore();
const cleanup = process.argv.includes('--cleanup');

function outstanding(inv) {
  if (inv.status === 'paid' || inv.status === 'draft') return 0;
  const total = round2(Number(inv.total ?? inv.amount) || 0);
  const paid = round2(Number(inv.paidAmount) || 0);
  return round2(Math.max(0, total - paid));
}

function daysBetween(d1, d2) {
  const ms = new Date(d2).getTime() - new Date(String(d1).slice(0, 10)).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

function bucket(days) {
  if (days <= 30) return 'current';
  if (days <= 60) return 'days31_60';
  if (days <= 90) return 'days61_90';
  return 'days91_plus';
}

(async () => {
  const ref = db.doc(`stores/${STORE}/financeInvoices/${DOC_ID}`);

  if (cleanup) {
    await ref.delete();
    console.log('Deleted', DOC_ID);
    process.exit(0);
  }

  const now = new Date().toISOString();
  const payload = {
    storeId: STORE,
    id: DOC_ID,
    date: '2026-07-10T12:00:00.000Z',
    createdAt: now,
    updatedAt: now,
    clientName: 'AR Aging Test Client',
    clientId: 'test-ar-aging-client',
    status: 'partial',
    currency: 'USD',
    amount: 100,
    total: 100,
    paidAmount: 40,
    paidAt: '2026-07-15T10:00:00.000Z',
    paymentMethod: 'cash',
    notes: 'E2E AR aging partial-balance test — safe to delete',
    isArAgingTest: true,
    lineItems: [{ description: 'Test service', quantity: 1, unitPrice: 100 }],
  };

  await ref.set(payload, { merge: true });
  console.log('Created financeInvoices/', DOC_ID);

  const snap = await db.collection(`stores/${STORE}/financeInvoices`).get();
  const invoices = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const testInv = invoices.find((i) => i.id === DOC_ID);
  const out = outstanding(testInv);
  const days = daysBetween(testInv.date, AS_OF);
  const b = bucket(days);

  const buckets = { current: 0, days31_60: 0, days61_90: 0, days91_plus: 0 };
  for (const inv of invoices) {
    const o = outstanding(inv);
    if (o <= 0) continue;
    buckets[bucket(daysBetween(inv.date, AS_OF))] = round2(buckets[bucket(daysBetween(inv.date, AS_OF))] + o);
  }
  const subledgerTotal = round2(Object.values(buckets).reduce((s, n) => s + n, 0));

  console.log('\nTEST INVOICE');
  console.log({
    gross: testInv.total,
    paidAmount: testInv.paidAmount,
    outstanding: out,
    daysPast: days,
    bucket: b,
    expectedOutstanding: 60,
    expectedBucket: 'current',
  });

  const ok =
    out === 60 &&
    testInv.amount === 100 &&
    b === 'current' &&
    buckets.current === 60 &&
    subledgerTotal === 60;

  console.log('\nAGING SUMMARY', { buckets, subledgerTotal });
  console.log(ok ? '\n✅ Partial balance logic verified (shows $60 not $100)' : '\n❌ Verification failed');
  process.exit(ok ? 0 : 1);
})();
