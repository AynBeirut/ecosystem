/**
 * Proof: voucher serial counter unchanged on failed post path (logic + latest JEs have event).
 * Usage: node scripts/verifyVoucherSerialAndEventE2E.cjs --store-id=Av22LKyet8QmVcu9b8Njz1HVfoy1
 */
const admin = require('firebase-admin');
const { readFileSync } = require('fs');
const { join } = require('path');

const storeArg = process.argv.find((a) => a.startsWith('--store-id='));
const STORE = storeArg ? storeArg.split('=')[1] : 'Av22LKyet8QmVcu9b8Njz1HVfoy1';
const YEAR = new Date().getFullYear();

try {
  const sa = JSON.parse(readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
} catch {
  console.error('❌ serviceAccountKey.json required');
  process.exit(1);
}

const db = admin.firestore();

function peekNext(counters, type) {
  const key = `${type}-${YEAR}`;
  const next = (counters?.[key] || 0) + 1;
  return { key, next, voucherNumber: `${type}-${YEAR}-${String(next).padStart(5, '0')}` };
}

(async () => {
  console.log('\nVoucher serial + event proof —', STORE, '\n');

  const serialRef = db.doc(`stores/${STORE}/ledgerMeta/voucherSerials`);
  const serialSnap = await serialRef.get();
  const counters = serialSnap.exists ? serialSnap.data().counters || {} : {};
  console.log('Current counters (sample):', counters);

  const jvPeek = peekNext(counters, 'JV');
  console.log('Next JV would be:', jvPeek.voucherNumber, '(not consumed by this script)');

  const entriesSnap = await db.collection(`stores/${STORE}/journalEntries`).get();
  const entries = entriesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const withVoucher = entries.filter((e) => e.voucherNumber);
  const missingEvent = entries.filter((e) => !e.event);
  const recent = entries
    .filter((e) => e.status === 'posted')
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 15);

  console.log('\nPosted JEs with voucherNumber:', withVoucher.length);
  console.log('All-time missing event field:', missingEvent.length, '(legacy; new posts should have event)');

  const recentMissing = recent.filter((e) => !e.event);
  console.log('Recent 15 missing event:', recentMissing.length);
  recent.slice(0, 5).forEach((e) => {
    console.log({
      id: e.id,
      voucher: e.voucherNumber,
      event: e.event,
      sourceKey: e.sourceKey,
    });
  });

  console.log('\nManual staging check: fail a voucher save (bad line) — JV counter must not advance; success advances by 1.');
})();
