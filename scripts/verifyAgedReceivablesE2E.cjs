/**
 * Proof AR aging vs GL 110 + open invoices (live Firestore).
 *
 * Usage: node scripts/verifyAgedReceivablesE2E.cjs [--store-id=...]
 */

const admin = require('firebase-admin');
const { readFileSync } = require('fs');
const { join } = require('path');

const storeArg = process.argv.find((a) => a.startsWith('--store-id='));
const STORE = storeArg ? storeArg.split('=')[1] : 'Av22LKyet8QmVcu9b8Njz1HVfoy1';
const AS_OF = '2026-07-25';
const AR = '110';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

try {
  const sa = JSON.parse(readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
} catch {
  console.error('❌ serviceAccountKey.json required');
  process.exit(1);
}

const db = admin.firestore();

function outstanding(inv) {
  if (inv.status === 'paid' || inv.status === 'draft') return 0;
  const total = round2(Number(inv.total ?? inv.amount) || 0);
  const paid = round2(Number(inv.paidAmount) || 0);
  return round2(Math.max(0, total - paid));
}

function daysBetween(d1, d2) {
  const ms = new Date(d2).getTime() - new Date(d1.slice(0, 10)).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

function bucket(days) {
  if (days <= 30) return 'current';
  if (days <= 60) return 'days31_60';
  if (days <= 90) return 'days61_90';
  return 'days91_plus';
}

(async () => {
  console.log('\nAR aging proof — store', STORE, 'as of', AS_OF, '\n');

  const [acctSnap, entrySnap, lineSnap, invSnap] = await Promise.all([
    db.collection(`stores/${STORE}/ledgerAccounts`).get(),
    db.collection(`stores/${STORE}/journalEntries`).get(),
    db.collection(`stores/${STORE}/journalLines`).get(),
    db.collection(`stores/${STORE}/financeInvoices`).get(),
  ]);

  const accounts = acctSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const arAcct = accounts.find((a) => String(a.code) === AR);
  const entries = entrySnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const lines = lineSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const invoices = invSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const buckets = { current: 0, days31_60: 0, days61_90: 0, days91_plus: 0 };
  const openRows = [];
  for (const inv of invoices) {
    const out = outstanding(inv);
    if (out <= 0) continue;
    const days = daysBetween(inv.date || inv.createdAt, AS_OF);
    const b = bucket(days);
    buckets[b] = round2(buckets[b] + out);
    openRows.push({ id: inv.id, client: inv.clientName, out, days, b, status: inv.status });
  }
  const subledgerTotal = round2(Object.values(buckets).reduce((s, n) => s + n, 0));

  let dr = 0;
  let cr = 0;
  for (const line of lines) {
    const entry = entries.find((e) => e.id === line.entryId);
    if (!entry || entry.status !== 'posted') continue;
    if (line.accountId !== arAcct?.id && line.accountCode !== AR) continue;
    if (entry.date.slice(0, 10) > AS_OF) continue;
    dr = round2(dr + (Number(line.debit) || 0));
    cr = round2(cr + (Number(line.credit) || 0));
  }
  const glBalance = round2(dr - cr);

  console.log('Open invoices:', openRows.length);
  console.log('Buckets:', buckets);
  console.log('Subledger total:', subledgerTotal);
  console.log('GL 110 balance:', glBalance);
  console.log('Variance (GL − invoices):', round2(glBalance - subledgerTotal));
  if (openRows.length) {
    console.log('\nSample open rows:');
    openRows.slice(0, 10).forEach((r) => console.log(r));
  }

  process.exit(0);
})();
