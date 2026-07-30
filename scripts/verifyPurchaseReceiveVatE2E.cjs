#!/usr/bin/env node
/**
 * Proof: purchase receive split matches TTC subledger (VAT → Dr 120 + Dr 140 / Cr 201).
 * Uses compiled functions/lib (run npm run build in functions/ first).
 */
const assert = require('assert');
const {
  resolvePurchaseReceiveSplit,
  sumPurchaseLinesExVat,
} = require('../functions/lib/lib/ledger/purchaseReceiveAmounts');

function ok(cond, msg) {
  if (!cond) throw new Error(msg);
  console.log('PASS', msg);
}

const nipcoPo050 = {
  taxType: 'VAT',
  taxRate: 11,
  subtotal: 1688.7,
  totalCost: 1874.46,
  total: 1874.46,
  items: [{ quantity: 179, unitCost: 5 }, { quantity: 141.5, unitCost: 4.2 }],
};

const split = resolvePurchaseReceiveSplit(nipcoPo050);
ok(split.apCredit === 1874.46, `PO-050 TTC AP ${split.apCredit}`);
ok(split.inventoryDebit === 1688.7, `PO-050 inventory ${split.inventoryDebit}`);
ok(split.inputVatDebit === 185.76, `PO-050 VAT ${split.inputVatDebit}`);
ok(split.inventoryDebit + split.inputVatDebit === split.apCredit, 'PO-050 balanced');

const noVat = {
  taxType: 'none',
  total: 100,
  subtotal: 100,
  items: [{ quantity: 1, unitCost: 100 }],
};
const s2 = resolvePurchaseReceiveSplit(noVat);
ok(s2.apCredit === 100 && s2.inputVatDebit === 0, 'non-VAT single line');

const linesOnly = {
  items: [{ quantity: 10, rawPrice: 12.5 }],
};
ok(sumPurchaseLinesExVat(linesOnly.items) === 125, 'line sum');
ok(resolvePurchaseReceiveSplit(linesOnly).apCredit === 125, 'lines-only TTC');

console.log('\nAll purchase receive VAT logic checks passed.\n');
