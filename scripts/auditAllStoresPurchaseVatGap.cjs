#!/usr/bin/env node
/**
 * Audit live stores for purchase receive VAT gap (GL Cr 201 vs subledger TTC).
 *   node scripts/auditAllStoresPurchaseVatGap.cjs
 */
const admin = require('firebase-admin');
const { readFileSync } = require('fs');
const { join } = require('path');
const {
  resolvePurchaseReceiveSplit,
} = require('../functions/lib/lib/ledger/purchaseReceiveAmounts');

const LIVE_STORES = [
  { label: 'Nipco', id: 'DfIhBAEZ5NR7yNX0HboZvv58Nf82' },
  { label: 'Little Hands', id: '8WgfKtgaE8aAXdqFhIfweEo5WFq2' },
  { label: 'E-Service Av22', id: 'Av22LKyet8QmVcu9b8Njz1HVfoy1' },
  { label: 'Moove', id: '1HfsBr45XYM5SkaaazWegmyqGpA3' },
  { label: 'EZfuo', id: 'EZfuoNQFTJVU4cubNuckpp4K7zw2' },
];

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

try {
  const sa = JSON.parse(readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
} catch {
  console.error('❌ serviceAccountKey.json required');
  process.exit(1);
}

const db = admin.firestore();

function purchaseTotalSubledger(data) {
  return round2(Number(data.total ?? data.totalCost ?? data.totalAmount ?? data.amount ?? 0) || 0);
}

(async () => {
  console.log('\n=== Purchase receive VAT gap — all live stores ===\n');

  for (const store of LIVE_STORES) {
    const [purchSnap, entrySnap, lineSnap, acctSnap] = await Promise.all([
      db.collection('purchases').where('storeId', '==', store.id).get(),
      db.collection(`stores/${store.id}/journalEntries`).get(),
      db.collection(`stores/${store.id}/journalLines`).get(),
      db.collection(`stores/${store.id}/ledgerAccounts`).get(),
    ]);

    const apId = acctSnap.docs.find((d) => d.data().code === '201')?.id;
    const entries = entrySnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const lines = lineSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const posted = new Set(entries.filter((e) => e.status === 'posted').map((e) => e.id));

    let receiveGap = 0;
    let poWithGap = 0;
    let receivedCount = 0;

    for (const doc of purchSnap.docs) {
      const data = doc.data();
      if (String(data.status || '').toLowerCase() !== 'received') continue;
      receivedCount++;
      const subT = purchaseTotalSubledger(data);
      const keptId = data.duplicateReceiveCleanupKeptJournalEntryId;
      let glCr = 0;
      for (const e of entries) {
        if (!posted.has(e.id) || e.sourceId !== doc.id || e.event !== 'received') continue;
        if (keptId && e.id !== keptId) continue;
        if (!keptId) {
          /* single or first */
        }
        for (const line of lines) {
          if (line.entryId !== e.id) continue;
          if (line.accountId === apId || line.accountCode === '201') glCr = round2(glCr + (Number(line.credit) || 0));
        }
      }
      if (!keptId) {
        const receives = entries.filter(
          (e) => posted.has(e.id) && e.sourceId === doc.id && e.event === 'received',
        );
        if (receives.length === 1) {
          for (const line of lines) {
            if (line.entryId !== receives[0].id) continue;
            if (line.accountId === apId || line.accountCode === '201') glCr = round2(glCr + (Number(line.credit) || 0));
          }
        }
      }

      const expected = resolvePurchaseReceiveSplit({
        items: data.items,
        total: data.total,
        totalCost: data.totalCost,
        totalAmount: data.totalAmount,
        subtotal: data.subtotal,
        taxAmount: data.taxAmount,
        vat: data.vat,
        taxType: data.taxType,
        taxRate: data.taxRate,
      });
      const expectedAp = expected?.apCredit ?? subT;
      const delta = round2(subT - glCr);
      if (Math.abs(delta) > 0.02) {
        poWithGap++;
        receiveGap = round2(receiveGap + delta);
      }
    }

    console.log(
      `${store.label} (${store.id.slice(0, 8)}…): received POs=${receivedCount}, POs with subT−glRecv≠0: ${poWithGap}, Σ gap=${receiveGap}`,
    );
  }
  console.log('');
})();
