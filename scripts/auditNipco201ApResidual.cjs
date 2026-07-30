#!/usr/bin/env node
/**
 * Nipco — trace GL 201 vs AP subledger residual to exact PO(s). Read-only.
 *   node scripts/auditNipco201ApResidual.cjs
 */
const admin = require('firebase-admin');
const { readFileSync } = require('fs');
const { join } = require('path');

const STORE = 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';
const AP = '201';
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

function derivePaymentStatus(data, total) {
  const raw = String(data.paymentStatus || '').toLowerCase();
  if (raw === 'paid' || raw === 'unpaid' || raw === 'partial') return raw;
  const amountPaid = Number(data.amountPaid ?? data.paidAmount ?? 0) || 0;
  if (total > 0 && amountPaid >= total) return 'paid';
  if (amountPaid > 0) return 'partial';
  return 'unpaid';
}

function subledgerOpen(data, total, amountPaid) {
  const ps = derivePaymentStatus(data, total);
  if (ps === 'paid') return 0;
  return round2(Math.max(0, total - amountPaid));
}

/** Mirrors autoPostPurchaseReceived (functions platformAutoPosting.ts) */
function glReceiveLogicFromItems(data) {
  let total = 0;
  for (const item of data.items || []) {
    const unitCost = round2(Number(item.rawPrice ?? item.unitCost ?? item.unitPrice ?? 0));
    const qty = round2(Number(item.quantity || 0));
    total = round2(total + unitCost * qty);
  }
  if (total <= 0) total = round2(Number(data.totalAmount || 0));
  return total;
}

function glReceiveWithVatOnUnit(data) {
  const purchaseTaxType = data.taxType || 'none';
  const purchaseSubtotal = Number(data.subtotal || 0);
  const purchaseTaxAmount = Number(data.taxAmount || data.vat || 0);
  const derivedTaxRate = Number(
    data.taxRate || (purchaseSubtotal > 0 ? (purchaseTaxAmount / purchaseSubtotal) * 100 : 0),
  );
  const purchaseTaxRate = Number.isFinite(derivedTaxRate) && derivedTaxRate > 0 ? derivedTaxRate : 0;
  const shouldAddVatToUnitCost = purchaseTaxType === 'VAT' && purchaseTaxRate > 0;
  const round4 = (v) => Math.round((v + Number.EPSILON) * 10000) / 10000;
  let total = 0;
  for (const item of data.items || []) {
    let base = round2(Number(item.rawPrice ?? item.unitCost ?? item.unitPrice ?? 0));
    if (shouldAddVatToUnitCost && base > 0) base = round4(base * (1 + purchaseTaxRate / 100));
    total = round2(total + base * round2(Number(item.quantity || 0)));
  }
  if (total <= 0) total = round2(Number(data.totalAmount || 0));
  return { total, shouldAddVatToUnitCost, purchaseTaxRate, purchaseTaxType };
}

function sumApForEntry(entryId, lines, apId) {
  let dr = 0;
  let cr = 0;
  for (const line of lines) {
    if (line.entryId !== entryId) continue;
    if (line.accountId !== apId && line.accountCode !== AP) continue;
    dr = round2(dr + (Number(line.debit) || 0));
    cr = round2(cr + (Number(line.credit) || 0));
  }
  return { dr, cr };
}

(async () => {
  const [acctSnap, entrySnap, lineSnap, purchSnap] = await Promise.all([
    db.collection(`stores/${STORE}/ledgerAccounts`).get(),
    db.collection(`stores/${STORE}/journalEntries`).get(),
    db.collection(`stores/${STORE}/journalLines`).get(),
    db.collection('purchases').where('storeId', '==', STORE).get(),
  ]);

  const apAcct = acctSnap.docs.find((d) => String(d.data().code) === AP);
  const entries = entrySnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const lines = lineSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const posted = new Set(entries.filter((e) => e.status === 'posted').map((e) => e.id));

  let gl201Cr = 0;
  let gl201Dr = 0;
  for (const line of lines) {
    if (!posted.has(line.entryId)) continue;
    if (line.accountId !== apAcct?.id && line.accountCode !== AP) continue;
    gl201Cr = round2(gl201Cr + (Number(line.credit) || 0));
    gl201Dr = round2(gl201Dr + (Number(line.debit) || 0));
  }
  const glApBalance = round2(gl201Cr - gl201Dr);

  const paymentReliefIds = new Set([
    'uzQAdmEK5cTRnHNuEgby',
    'z0tAwN51mrwOwL2jxBde',
    'LxfgyPxubJ5LxROdBLeC',
    'Ptud9OUVYPcWVp4yQj3q',
    'szBATx3rJ2MD4kepIwVn',
    'qAM9Er8bPAmBqDkBdir7',
    'e9mYqlZlMseFYb9v2g3l',
    'sOif0XK6ODrT4hhb1UDd',
    'CFkAYZZZNVvc3nNHcl4q',
    'la19h92UU4I7gHYr82Wn',
    '9cPxeZ2LSf7k4cjYYM7R',
    'o2bxFQfwZxGlWO58Ghti',
  ]);

  const rows = [];
  let sumSubOpen = 0;
  let sumGlNetPerPo = 0;
  let sumResidualContribution = 0;

  for (const doc of purchSnap.docs) {
    const data = doc.data();
    if (String(data.status || '').toLowerCase() !== 'received') continue;

    const id = doc.id;
    const invoice = data.invoiceNumber || data.purchaseNumber || id.slice(0, 8);
    const subTotal = purchaseTotalSubledger(data);
    const amountPaid = round2(Number(data.amountPaid ?? 0) || 0);
    const open = subledgerOpen(data, subTotal, amountPaid);
    sumSubOpen = round2(sumSubOpen + open);

    const itemSumExVat = glReceiveLogicFromItems(data);
    const vatCalc = glReceiveWithVatOnUnit(data);

    let glReceiveCr = 0;
    let glPaymentDr = 0;
    let glReversalDr = 0;
    let keptReceiveCr = 0;
    const keptId = data.duplicateReceiveCleanupKeptJournalEntryId;

    const related = entries.filter(
      (e) => posted.has(e.id) && String(e.sourceId) === id && String(e.sourceType || '').includes('purchase'),
    );

    for (const e of related) {
      const { dr, cr } = sumApForEntry(e.id, lines, apAcct.id);
      if (e.event === 'received' && !String(e.event || '').includes('reversal')) {
        glReceiveCr = round2(glReceiveCr + cr);
        if (e.id === keptId || (!keptId && cr > 0)) {
          /* use net: after dedupe, reversals offset dup receives */
        }
      } else if (String(e.event || '').startsWith('reversal-duplicate-receive')) {
        glReversalDr = round2(glReversalDr + dr);
      } else if (e.sourceType === 'purchase_payment' || String(e.event || '').startsWith('paid')) {
        glPaymentDr = round2(glPaymentDr + dr);
      }
    }

    // Net AP on 201 for this PO from all posted purchase* entries
    let glNetAp = 0;
    for (const e of related) {
      const { dr, cr } = sumApForEntry(e.id, lines, apAcct.id);
      glNetAp = round2(glNetAp + cr - dr);
    }

    // Kept receive only (active liability at recognition)
    if (keptId) {
      const { cr } = sumApForEntry(keptId, lines, apAcct.id);
      keptReceiveCr = cr;
    } else {
      const receives = related.filter((e) => e.event === 'received');
      if (receives.length === 1) {
        keptReceiveCr = sumApForEntry(receives[0].id, lines, apAcct.id).cr;
      }
    }

    const receiveVsSubledger = round2(keptReceiveCr - subTotal);
    const residualPiece = round2(open - glNetAp);
    sumGlNetPerPo = round2(sumGlNetPerPo + glNetAp);
    sumResidualContribution = round2(sumResidualContribution + residualPiece);

    rows.push({
      id,
      invoice,
      paymentRelief: paymentReliefIds.has(id),
      paymentStatus: derivePaymentStatus(data, subTotal),
      subledgerTotalField: subTotal,
      subledgerFieldsUsed: {
        total: data.total,
        totalCost: data.totalCost,
        totalAmount: data.totalAmount,
        amount: data.amount,
        subtotal: data.subtotal,
        taxAmount: data.taxAmount,
        taxType: data.taxType,
        vat: data.vat,
      },
      amountPaid,
      subledgerOpen: open,
      glKeptReceiveCr201: keptReceiveCr,
      glItemSumExVat: itemSumExVat,
      glItemSumVatInUnit: vatCalc.total,
      glPaymentDr201: glPaymentDr,
      glNetAp201: glNetAp,
      receiveCrMinusSubTotal: receiveVsSubledger,
      openMinusGlNet: residualPiece,
      vatInUnitAtReceive: vatCalc.shouldAddVatToUnitCost,
    });
  }

  rows.sort((a, b) => Math.abs(b.openMinusGlNet) - Math.abs(a.openMinusGlNet));

  const variance = round2(sumSubOpen - glApBalance);

  console.log('\n=== Nipco GL 201 vs AP subledger residual audit ===\n');
  console.log('GL 201 balance (Cr−Dr):', glApBalance);
  console.log('Sum subledger open (received POs):', sumSubOpen);
  console.log('Residual (subledger − GL):', variance);
  console.log('Sum per-PO (open − glNetAp):', sumResidualContribution);
  console.log('Sum per-PO glNetAp:', sumGlNetPerPo);

  console.log('\n--- Per PO (sorted by |open−glNet|) ---\n');
  for (const r of rows) {
    if (Math.abs(r.openMinusGlNet) < 0.005 && Math.abs(r.receiveCrMinusSubTotal) < 0.005) continue;
    console.log(
      [
        r.invoice,
        r.paymentRelief ? 'REL' : '   ',
        `subTot ${r.subledgerTotalField}`,
        `glRecv ${r.glKeptReceiveCr201}`,
        `recvΔ ${r.receiveCrMinusSubTotal}`,
        `open ${r.subledgerOpen}`,
        `glNet ${r.glNetAp201}`,
        `resid ${r.openMinusGlNet}`,
        r.paymentStatus,
      ].join(' | '),
    );
    if (Math.abs(r.receiveCrMinusSubTotal) > 0.01) {
      console.log(
        `    cause hint: itemΣexVAT=${r.glItemSumExVat} itemΣVATinUnit=${r.glItemSumVatInUnit} taxType=${r.subledgerFieldsUsed.taxType} taxAmt=${r.subledgerFieldsUsed.taxAmount}`,
      );
    }
  }

  console.log('\n--- All received POs: receive Cr vs subledger total ---\n');
  let sumReceiveDelta = 0;
  for (const r of rows) {
    sumReceiveDelta = round2(sumReceiveDelta + r.receiveCrMinusSubTotal);
    console.log(
      `${r.invoice.padEnd(8)} sub ${String(r.subledgerTotalField).padStart(10)} glRecv ${String(r.glKeptReceiveCr201).padStart(10)} Δ ${String(r.receiveCrMinusSubTotal).padStart(8)} paid ${r.amountPaid} glNet ${r.glNetAp201} open ${r.subledgerOpen}`,
    );
  }
  console.log('\nSum (glReceive − subledgerTotal) all POs:', sumReceiveDelta);

  const openRows = rows.filter((r) => r.subledgerOpen > 0);
  console.log('\n--- Open POs only ---');
  let sumOpenResid = 0;
  for (const r of openRows) {
    sumOpenResid = round2(sumOpenResid + r.openMinusGlNet);
    console.log(r.invoice, 'open', r.subledgerOpen, 'glNet', r.glNetAp201, 'piece', r.openMinusGlNet);
  }
  console.log('Sum open pieces:', sumOpenResid);

  console.log('\n--- Classification ---');
  const structural = rows.filter(
    (r) => Math.abs(r.receiveCrMinusSubTotal) > 0.01 && r.glItemSumExVat !== r.subledgerTotalField,
  );
  console.log('POs with receive≠subledger total:', structural.length);
})();
