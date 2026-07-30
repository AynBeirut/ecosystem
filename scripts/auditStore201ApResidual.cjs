#!/usr/bin/env node
/**
 * Store PO-level AP residual audit (read-only). Same discipline as Nipco — no corrections.
 *
 *   node scripts/auditStore201ApResidual.cjs --store-id=8WgfKtgaE8aAXdqFhIfweEo5WFq2
 *   node scripts/auditStore201ApResidual.cjs --store-id=DfIhBAEZ5NR7yNX0HboZvv58Nf82 --json=/tmp/out.json
 */
const admin = require('firebase-admin');
const { readFileSync, writeFileSync } = require('fs');
const { join } = require('path');

const storeArg = process.argv.find((a) => a.startsWith('--store-id='));
const STORE = storeArg ? storeArg.split('=')[1] : '';
const jsonArg = process.argv.find((a) => a.startsWith('--json='));
const JSON_OUT = jsonArg ? jsonArg.split('=')[1] : null;
const AP_CODE = '201';

if (!STORE) {
  console.error('Usage: node scripts/auditStore201ApResidual.cjs --store-id=<uid>');
  process.exit(1);
}

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function buildSourceKey(sourceType, sourceId, event) {
  return `${sourceType}:${sourceId}:${event}`;
}

try {
  const sa = JSON.parse(readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
} catch {
  console.error('❌ serviceAccountKey.json required');
  process.exit(1);
}

const db = admin.firestore();

function purchaseTotal(data) {
  return round2(Number(data.total ?? data.totalCost ?? data.totalAmount ?? data.amount ?? 0) || 0);
}

function derivePaymentStatus(data, total) {
  const raw = String(data.paymentStatus || '').toLowerCase();
  if (raw === 'paid' || raw === 'unpaid' || raw === 'partial') return raw;
  const amountPaid = Number(data.amountPaid ?? data.paidAmount ?? 0) || 0;
  if (total > 0 && amountPaid >= total) return 'paid';
  if (amountPaid > 0) return 'partial';
  return 'unpaid';
}

function accountNetCredit(accounts, lines, entries, accountId, code) {
  const acct = accounts.find((a) => a.id === accountId || a.code === code);
  if (!acct) return 0;
  const posted = new Set(entries.filter((e) => e.status === 'posted').map((e) => e.id));
  let d = 0;
  let c = 0;
  for (const line of lines) {
    if (line.accountId !== acct.id && line.accountCode !== acct.code) continue;
    if (!posted.has(line.entryId)) continue;
    d = round2(d + (Number(line.debit) || 0));
    c = round2(c + (Number(line.credit) || 0));
  }
  const opening = round2(Number(acct.openingBalance) || 0);
  if (opening !== 0) {
    if (acct.normalBalance === 'credit') c = round2(c + opening);
    else d = round2(d + opening);
  }
  return round2(c - d);
}

(async () => {
  const [acctSnap, entrySnap, lineSnap, purchasesSnap] = await Promise.all([
    db.collection(`stores/${STORE}/ledgerAccounts`).get(),
    db.collection(`stores/${STORE}/journalEntries`).get(),
    db.collection(`stores/${STORE}/journalLines`).get(),
    db.collection('purchases').where('storeId', '==', STORE).get(),
  ]);

  const accounts = acctSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const entries = entrySnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const lines = lineSnap.docs.map((d) => d.data());
  const apAcct = accounts.find((a) => String(a.code) === AP_CODE);
  const glApCredit = accountNetCredit(accounts, lines, entries, apAcct?.id, AP_CODE);

  const receiveNetByPo = new Map();
  const paymentDr201ByPo = new Map();

  for (const e of entries.filter((x) => x.status === 'posted')) {
    const pid = String(e.sourceId || '');
    if (!pid) continue;
    if (e.sourceType === 'purchase' && e.event === 'received') {
      let cr = 0;
      let dr = 0;
      for (const line of lines) {
        if (line.entryId !== e.id) continue;
        if (line.accountCode === AP_CODE || line.accountId === apAcct?.id) {
          cr = round2(cr + (Number(line.credit) || 0));
          dr = round2(dr + (Number(line.debit) || 0));
        }
      }
      receiveNetByPo.set(pid, round2((receiveNetByPo.get(pid) || 0) + cr - dr));
    }
    if (e.sourceType === 'purchase_payment') {
      let dr201 = 0;
      for (const line of lines) {
        if (line.entryId !== e.id) continue;
        if (line.accountCode === AP_CODE || line.accountId === apAcct?.id) {
          dr201 = round2(dr201 + (Number(line.debit) || 0));
        }
      }
      paymentDr201ByPo.set(pid, round2((paymentDr201ByPo.get(pid) || 0) + dr201));
    }
  }

  let subledgerOpen = 0;
  const poRows = [];

  for (const doc of purchasesSnap.docs) {
    const data = doc.data();
    if (String(data.status || '') !== 'received') continue;
    const total = purchaseTotal(data);
    const paid = round2(Number(data.amountPaid ?? data.paidAmount ?? 0) || 0);
    const paymentStatus = derivePaymentStatus(data, total);
    const open = paymentStatus === 'paid' ? 0 : round2(Math.max(0, total - paid));
    subledgerOpen = round2(subledgerOpen + open);

    const glReceive = receiveNetByPo.get(doc.id) || 0;
    const glPaid = paymentDr201ByPo.get(doc.id) || 0;
    const glNetAp = round2(glReceive - glPaid);
    const residual = round2(glNetAp - open);

    poRows.push({
      purchaseId: doc.id,
      label: data.invoiceNumber || data.purchaseOrderNumber || doc.id,
      supplier: data.supplierName || '',
      total,
      paid,
      paymentStatus,
      subledgerOpen: open,
      glReceiveAp: glReceive,
      glPaymentDr201: glPaid,
      glNetAp,
      poResidualGlMinusSubledger: residual,
      hasReceiveJe: glReceive > 0 || entries.some((e) => e.sourceKey === buildSourceKey('purchase', doc.id, 'received')),
    });
  }

  poRows.sort((a, b) => Math.abs(b.poResidualGlMinusSubledger) - Math.abs(a.poResidualGlMinusSubledger));

  const summary = {
    storeId: STORE,
    asOf: new Date().toISOString().slice(0, 10),
    glAp201NetCredit: glApCredit,
    subledgerOpenTotal: subledgerOpen,
    glMinusSubledger: round2(glApCredit - subledgerOpen),
    receivedPurchaseCount: poRows.length,
    posWithReceiveJe: poRows.filter((r) => r.hasReceiveJe).length,
    posMissingReceiveJe: poRows.filter((r) => !r.hasReceiveJe).length,
  };

  console.log('\n=== AP residual audit (read-only) ===');
  console.log(JSON.stringify(summary, null, 2));
  console.log('\nTop PO residuals (|GL−subledger|):');
  for (const row of poRows.filter((r) => Math.abs(r.poResidualGlMinusSubledger) > 0.01).slice(0, 25)) {
    console.log(
      `  ${row.label} | open ${row.subledgerOpen} | GL net AP ${row.glNetAp} | Δ ${row.poResidualGlMinusSubledger}`,
    );
  }
  if (poRows.filter((r) => !r.hasReceiveJe).length) {
    console.log('\nMissing receive JE:');
    poRows
      .filter((r) => !r.hasReceiveJe)
      .forEach((r) => console.log(`  ${r.label} (${r.purchaseId}) total ${r.total}`));
  }

  const out = { summary, poRows };
  if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(out, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
