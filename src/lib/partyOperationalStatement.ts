import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  where,
} from 'firebase/firestore';
import { isCountedSaleStatus, normalizeDateString } from '@/lib/salesRules';
import {
  parseCashBookSettlementMemo,
  scoreSettlementInvoiceCandidates,
} from '@/lib/cashBookSettlementMemo';
import { resolvePurchaseAmountPaid } from '@/lib/purchasePaymentStatement';

export type PartyType = 'customer' | 'supplier';

const BALANCE_EPSILON = 0.005;

export interface PartyBillTo {
  name: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  taxId?: string;
  accountCode?: string;
}

export type StatementCurrency = 'USD' | 'LBP';

export interface PartyStatementLine {
  date: string;
  invoiceRef: string;
  description: string;
  /** Cash-book / import provenance for AP lines. */
  sourceDetail?: string;
  charges: number;
  credits: number;
  lineTotal: number;
  currency?: StatementCurrency;
  sourceType?: 'order' | 'payment' | 'purchase' | 'return';
  sourceId?: string;
}

export interface PartyCurrencyBalance {
  openingBalance: number;
  closingBalance: number;
  totalCharges: number;
  totalCredits: number;
}

export interface PartyStatementReport {
  partyType: PartyType;
  partyId: string;
  partyName: string;
  accountNo: string;
  billTo: PartyBillTo;
  statementDate: string;
  statementNumber: string;
  openingBalance: number;
  closingBalance: number;
  totalCharges: number;
  totalCredits: number;
  paymentDueDate: string;
  currency: string;
  currencyBalances: Record<StatementCurrency, PartyCurrencyBalance>;
  lines: PartyStatementLine[];
}

interface StatementTxn {
  date: string;
  type: string;
  ref: string;
  description: string;
  debit: number;
  credit: number;
  currency?: StatementCurrency;
  data: Record<string, unknown>;
}

export function statementCurrency(value: unknown): StatementCurrency {
  const code = String(value || '').trim().toUpperCase();
  return code === 'LBP' || code === 'LL' ? 'LBP' : 'USD';
}

/** Split a document into USD and LBP amounts. Line currency wins; otherwise the document currency. */
export function statementAmountBuckets(
  data: Record<string, unknown>,
  fallbackTotal: number,
): Array<{ currency: StatementCurrency; amount: number }> {
  const items = Array.isArray(data.items) ? data.items : Array.isArray(data.lineItems) ? data.lineItems : [];
  const buckets = new Map<StatementCurrency, number>();
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    if (item.currency == null || String(item.currency).trim() === '') continue;
    const qty = toFiniteNumber(item.quantity, 0);
    const price = toFiniteNumber(item.unitPrice ?? item.unitCost, 0);
    const sub = toFiniteNumber(item.subtotal ?? item.totalPrice, qty * price);
    const code = statementCurrency(item.currency);
    buckets.set(code, (buckets.get(code) || 0) + sub);
  }
  if (buckets.size === 0) {
    return [{ currency: statementCurrency(data.currency), amount: fallbackTotal }];
  }
  return [...buckets.entries()].map(([currency, amount]) => ({ currency, amount }));
}

function tagStatementCurrencies(txns: StatementTxn[]): StatementTxn[] {
  const out: StatementTxn[] = [];
  for (const txn of txns) {
    const original = txn.debit || txn.credit;
    const buckets = statementAmountBuckets(txn.data || {}, original);
    if (buckets.length <= 1) {
      out.push({ ...txn, currency: buckets[0]?.currency || statementCurrency(txn.data?.currency) });
      continue;
    }
    const total = buckets.reduce((sum, bucket) => sum + bucket.amount, 0);
    const side = txn.debit > 0 ? 'debit' : 'credit';
    for (const bucket of buckets) {
      const share = total > 0 ? original * (bucket.amount / total) : 0;
      out.push({
        ...txn,
        currency: bucket.currency,
        debit: side === 'debit' ? share : 0,
        credit: side === 'credit' ? share : 0,
      });
    }
  }
  return out;
}

interface AccountPaymentDoc {
  id: string;
  amount?: number;
  direction?: string;
  date?: string;
  createdAt?: string;
  method?: string;
  orderAllocation?: {
    appliedAmount?: number;
    remainingAmount?: number;
  };
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toStatementDateLabel(value: unknown): string {
  const normalized = normalizeDateString(value as string | number | Date | { toDate?: () => Date } | null | undefined);
  if (!normalized) return 'N/A';
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return 'N/A';
  return parsed.toLocaleDateString('en-GB');
}

function generateNumericAccountNo(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash &= hash;
  }
  return Math.abs(hash).toString().padStart(10, '0');
}

function sanitizePublicReceiptNote(note: unknown, amount: number): string {
  const cleaned = String(note || '')
    .replace(/\s*—\s*WhatsApp date pending/gi, '')
    .replace(/\s*—\s*Jobran WhatsApp/gi, '')
    .replace(/\s*\(date pending\)/gi, '')
    .trim();
  if (cleaned) return cleaned;
  return `Payment — $${amount.toFixed(2)}`;
}

function getUnappliedPaymentAmount(payment: AccountPaymentDoc): number {
  const total = toFiniteNumber(payment.amount, 0);
  if (total <= 0) return 0;
  const alloc = payment.orderAllocation;
  if (alloc) {
    if (typeof alloc.remainingAmount === 'number') {
      return Math.max(0, alloc.remainingAmount);
    }
    const applied = toFiniteNumber(alloc.appliedAmount, 0);
    return Math.max(0, total - applied);
  }
  return 0;
}

function paymentDueDateFromTerms(terms: string | undefined, fromDate: Date): string {
  const base = new Date(fromDate);
  const normalized = String(terms || '').toLowerCase();
  let days = 30;
  if (normalized.includes('60')) days = 60;
  else if (normalized.includes('90')) days = 90;
  else if (normalized.includes('cod') || normalized.includes('cash')) days = 0;
  base.setDate(base.getDate() + days);
  return base.toLocaleDateString('en-GB');
}

function mapTxnToLine(
  txn: StatementTxn,
  runningBalance: number,
  partyType: PartyType,
): { line: PartyStatementLine; balance: number } {
  const balance = runningBalance + txn.debit - txn.credit;
  const charges =
    partyType === 'customer' ? txn.debit : txn.credit;
  const credits =
    partyType === 'customer' ? txn.credit : txn.debit;
  return {
    balance,
      line: {
      date: toStatementDateLabel(txn.date),
      invoiceRef: txn.ref,
      description: txn.description,
      sourceDetail:
        typeof txn.data === 'object' && txn.data && 'sourceDetail' in txn.data
          ? String(txn.data.sourceDetail || '') || undefined
          : undefined,
      charges,
      credits,
      lineTotal: balance,
      currency: txn.currency,
      sourceType:
        txn.type === 'order'
          ? 'order'
          : txn.type === 'payment'
            ? 'payment'
            : txn.type === 'purchase'
              ? 'purchase'
              : txn.type === 'return'
                ? 'return'
                : undefined,
      sourceId:
        typeof txn.data === 'object' && txn.data && 'id' in txn.data
          ? String(txn.data.id || '')
          : undefined,
    },
  };
}

/** Business date on purchases — never prefer import createdAt when orderDate exists. */
export function resolvePurchaseStatementDate(purchase: Record<string, unknown>): string {
  return (
    normalizeDateString(purchase.orderDate as string | undefined) ||
    normalizeDateString(purchase.receivedDate as string | undefined) ||
    normalizeDateString(purchase.date as string | undefined) ||
    normalizeDateString(purchase.paymentDate as string | undefined) ||
    normalizeDateString(purchase.paidAt as string | undefined) ||
    normalizeDateString(purchase.createdAt as string | undefined) ||
    ''
  );
}

function cashBookLineText(purchase: Record<string, unknown>): string {
  const stored = String(purchase.cashBookLineText || '').trim();
  if (stored) return stored;
  const items = purchase.items as Array<{ materialName?: string }> | undefined;
  return String(items?.[0]?.materialName || purchase.supplierName || '').trim();
}

function purchaseSourceDetail(
  purchase: Record<string, unknown>,
  purchaseId: string,
  allStorePurchases: Array<Record<string, unknown> & { id: string }>,
): string | undefined {
  const parts: string[] = [];
  const lineText = cashBookLineText(purchase);
  const settlement = parseCashBookSettlementMemo(lineText);
  if (settlement) {
    parts.push(`${settlement.humanLabel} — cash-book: “${settlement.rawLine}”`);
  }

  const file = String(purchase.cashBookSourceFile || '').trim();
  const sheet = String(purchase.cashBookExcelSheet || '').trim();
  const row = purchase.cashBookExcelRow;
  const source = String(purchase.source || '').trim();
  const importKey = String(purchase.importKey || '').trim();
  if (file) parts.push(`Excel: ${file}`);
  if (sheet && row) parts.push(`sheet “${sheet}” row ${row}`);
  else if (sheet) parts.push(`sheet “${sheet}”`);
  if (source) parts.push(source);
  if (importKey) parts.push(importKey);

  const neighbors = purchase.cashBookExpenseNeighbors as Array<{ row?: number; label?: string; amount?: number }> | undefined;
  if (Array.isArray(neighbors) && neighbors.length > 0) {
    const block = neighbors
      .map((n) => `${n.label || '?'} $${Number(n.amount || 0).toFixed(2)} (row ${n.row})`)
      .join('; ');
    parts.push(`Same expense block: ${block}`);
  }

  const items = purchase.items as Array<{ materialName?: string; quantity?: number; unitPrice?: number }> | undefined;
  if (Array.isArray(items) && items.length > 0) {
    const itemText = items
      .map((item) => {
        const name = String(item.materialName || '').trim();
        if (!name) return '';
        const qty = item.quantity != null ? ` ×${item.quantity}` : '';
        const price = item.unitPrice != null ? ` @${item.unitPrice}` : '';
        return `${name}${qty}${price}`;
      })
      .filter(Boolean)
      .join('; ');
    if (itemText) parts.push(`Items: ${itemText}`);
  }

  if (settlement) {
    const businessDate = resolvePurchaseStatementDate(purchase);
    const amount = Number(purchase.total ?? purchase.totalAmount ?? purchase.totalCost ?? 0);
    const candidates = scoreSettlementInvoiceCandidates(
      allStorePurchases.map((p) => ({
        id: p.id,
        supplierName: String(p.supplierName || ''),
        invoiceNumber: String(p.invoiceNumber || ''),
        purchaseOrderNumber: String(p.purchaseOrderNumber || ''),
        orderDate: String(p.orderDate || ''),
        total: Number(p.total ?? p.totalAmount ?? p.totalCost ?? 0),
      })),
      {
        settlementPurchaseId: purchaseId,
        settlementDate: businessDate,
        amount,
        referenceName: settlement.referenceName,
      },
    );
    if (candidates.length > 0) {
      parts.push(
        `Possible prior invoice: ${candidates
          .map((c) => `${c.invoiceNumber} · ${c.supplierName} · ${c.orderDate} · $${c.total.toFixed(2)} (${c.matchReason})`)
          .join(' | ')}`,
      );
    } else {
      parts.push(
        settlement.referenceName
          ? `No prior PO in Grabio for “${settlement.referenceName}” — check paper invoice`
          : 'No prior PO in Grabio — check paper invoice for this balance',
      );
    }
  }

  return parts.length > 0 ? parts.join(' · ') : undefined;
}

function supplierPurchaseDescription(
  partyName: string,
  purchase: Record<string, unknown>,
  invoiceRef: string,
): string {
  const settlement = parseCashBookSettlementMemo(cashBookLineText(purchase));
  if (settlement) {
    return `${settlement.humanLabel} — ${invoiceRef}`;
  }
  const note = String(purchase.notes || purchase.description || '').trim();
  const cleaned = note.replace(/\.\s*Owner owes[^.]*\.?/i, '').trim();
  if (cleaned) return `${partyName} — ${cleaned}`;
  return `${partyName} — Purchase ${invoiceRef}`;
}

async function loadBillTo(
  partyType: PartyType,
  partyId: string,
): Promise<PartyBillTo | null> {
  const db = getFirestore();
  const collectionName = partyType === 'customer' ? 'customers' : 'suppliers';
  const snap = await getDoc(doc(db, collectionName, partyId));
  if (!snap.exists()) return null;
  const data = snap.data();
  if (partyType === 'customer') {
    return {
      name: String(data.name || ''),
      address: String(data.address || ''),
      city: String(data.city || ''),
      country: String(data.country || ''),
      phone: String(data.phone || ''),
      email: String(data.email || ''),
      taxId: String(data.taxId || ''),
      accountCode: partyId.slice(0, 8).toUpperCase(),
    };
  }
  return {
    name: String(data.name || ''),
    address: String(data.address || ''),
    phone: String(data.phone || ''),
    email: String(data.email || ''),
    taxId: String(data.taxId || ''),
    accountCode: String(data.supplierCode || partyId.slice(0, 8).toUpperCase()),
  };
}

export async function buildPartyOperationalStatement(params: {
  storeId: string;
  partyType: PartyType;
  partyId: string;
  partyName?: string;
  currency?: string;
  /** YYYY-MM-DD inclusive — filters statement lines and computes opening balance. */
  startDate?: string;
  endDate?: string;
}): Promise<PartyStatementReport> {
  const { storeId, partyType, partyId, startDate, endDate } = params;
  const db = getFirestore();
  const billTo = (await loadBillTo(partyType, partyId)) || {
    name: params.partyName || 'Unknown',
    accountCode: partyId.slice(0, 8).toUpperCase(),
  };
  const partyName = billTo.name || params.partyName || 'Unknown';

  const allTxns: StatementTxn[] = [];
  let phone = billTo.phone || '';
  let paymentTerms = '';
  let nextPaymentDueFromMeta: string | null = null;

  if (partyType === 'supplier') {
    const supplierSnap = await getDoc(doc(db, 'suppliers', partyId));
    if (supplierSnap.exists()) {
      paymentTerms = String(supplierSnap.data().paymentTerms || 'net_30');
    }

    const [purchasesSnap, allPurchasesSnap, returnsSnap, paymentsSnap, financeExpSnap] = await Promise.all([
      getDocs(
        query(
          collection(db, 'purchases'),
          where('storeId', '==', storeId),
          where('supplierId', '==', partyId),
        ),
      ),
      getDocs(query(collection(db, 'purchases'), where('storeId', '==', storeId))),
      getDocs(
        query(
          collection(db, 'supplierReturns'),
          where('storeId', '==', storeId),
          where('supplierId', '==', partyId),
          where('status', '==', 'credited'),
        ),
      ),
      getDocs(
        query(
          collection(db, 'accountPayments'),
          where('storeId', '==', storeId),
          where('accountId', '==', partyId),
          where('accountType', '==', 'supplier'),
        ),
      ),
      getDocs(
        query(
          collection(db, 'stores', storeId, 'financeExpenses'),
          where('supplierId', '==', partyId),
        ),
      ),
    ]);

    const validPurchaseIds = new Set(purchasesSnap.docs.map((d) => d.id));
    const allStorePurchases = allPurchasesSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Record<string, unknown>),
    }));

    purchasesSnap.forEach((purchaseDoc) => {
      const purchase = purchaseDoc.data();
      if (
        purchase.status === 'cancelled'
        || purchase.excludeFromPartyStatement === true
        || purchase.paymentStatus === 'voided'
        || purchase.accountingActive === false
      ) {
        return;
      }
      const total = purchase.totalCost || purchase.totalAmount || purchase.total || 0;
      const subtotal = purchase.subtotal || total;
      const purchaseForPay = { ...purchase, id: purchaseDoc.id } as import('@/types/inventory').Purchase;
      const paid = resolvePurchaseAmountPaid(purchaseForPay);
      const invoiceRef = purchase.invoiceNumber || purchaseDoc.id.substring(0, 8);

      const businessDate = resolvePurchaseStatementDate(purchase);
      const sourceDetail = purchaseSourceDetail(purchase, purchaseDoc.id, allStorePurchases);

      allTxns.push({
        date: businessDate,
        type: 'purchase',
        ref: invoiceRef,
        description: supplierPurchaseDescription(partyName, purchase, invoiceRef),
        debit: 0,
        credit: total,
        data: {
          ...purchase,
          id: purchaseDoc.id,
          net: subtotal,
          sourceDetail,
        },
      });

      if (paid > 0) {
        const paymentDate =
          normalizeDateString(purchase.paymentDate as string | undefined) ||
          normalizeDateString(purchase.paidAt as string | undefined) ||
          businessDate;
        allTxns.push({
          date: paymentDate,
          type: 'purchase_payment',
          ref: `PAY-${invoiceRef}`.substring(0, 20),
          description: `${partyName} — Payment ${invoiceRef}`,
          debit: paid,
          credit: 0,
          data: { ...purchase, sourceDetail },
        });
      }
    });

    paymentsSnap.forEach((paymentDoc) => {
      const pmt = paymentDoc.data();
      if (pmt.direction !== 'out') return;
      const amount = toFiniteNumber(pmt.amount, 0);
      if (amount <= 0) return;
      allTxns.push({
        date: pmt.date || pmt.createdAt || '',
        type: 'payment',
        ref: pmt.reference || paymentDoc.id.substring(0, 8),
        description: `Payment - ${pmt.method || 'cash'}`,
        debit: amount,
        credit: 0,
        data: { ...pmt, id: paymentDoc.id },
      });
    });

    returnsSnap.forEach((returnDoc) => {
      const returnData = returnDoc.data();
      const purchaseId = returnData.purchaseId || returnData.originalPurchaseId;
      if (!purchaseId || !validPurchaseIds.has(purchaseId)) return;
      const creditAmount = returnData.creditIssued || returnData.totalClaimAmount || 0;
      allTxns.push({
        date: returnData.date || returnData.createdAt || '',
        type: 'return',
        ref: returnData.returnNumber || returnDoc.id.substring(0, 8),
        description: 'Return Credit',
        debit: 0,
        credit: creditAmount,
        data: { ...returnData, id: returnDoc.id },
      });
    });

    financeExpSnap.forEach((expDoc) => {
      const exp = expDoc.data();
      const amount = toFiniteNumber(exp.amount, 0);
      if (amount <= 0) return;
      const expDate = normalizeDateString(exp.expenseDate || exp.paidAt || exp.startDate);
      if (!expDate) return;
      const ref = String(exp.voucherNumber || expDoc.id.replace(/^whish_/, '').substring(0, 16));
      const label = String(exp.name || exp.description || exp.notes || 'Subscription').trim();
      allTxns.push({
        date: expDate,
        type: 'purchase',
        ref,
        description: `${partyName} — ${label}`,
        debit: 0,
        credit: amount,
        data: { ...exp, id: expDoc.id },
      });
      allTxns.push({
        date: expDate,
        type: 'purchase_payment',
        ref: `PAY-${ref}`.substring(0, 20),
        description: `${partyName} — Paid via ${exp.paymentMethod || 'card'}`,
        debit: amount,
        credit: 0,
        data: { ...exp, id: expDoc.id },
      });
    });
  } else {
    const customerSnap = await getDoc(doc(db, 'customers', partyId));
    const customerData = customerSnap.exists() ? customerSnap.data() : null;
    const accountStatementMeta = (customerData?.accountStatementMeta ?? {}) as Record<string, unknown>;

    if (customerData) {
      paymentTerms = String(customerData.paymentTerms || 'net_30');
      nextPaymentDueFromMeta = normalizeDateString(accountStatementMeta.nextPaymentDue as string | undefined);
    }

    const [ordersSnap, paymentsSnap, financeInvSnap, financeRcptSnap] = await Promise.all([
      getDocs(
        query(
          collection(db, 'orders'),
          where('storeId', '==', storeId),
          where('customerId', '==', partyId),
        ),
      ),
      getDocs(
        query(
          collection(db, 'accountPayments'),
          where('storeId', '==', storeId),
          where('accountId', '==', partyId),
          where('accountType', '==', 'customer'),
        ),
      ),
      getDocs(
        query(
          collection(db, 'stores', storeId, 'financeInvoices'),
          where('clientId', '==', partyId),
        ),
      ),
      getDocs(
        query(
          collection(db, 'stores', storeId, 'financeReceipts'),
          where('clientId', '==', partyId),
        ),
      ),
    ]);

    ordersSnap.forEach((orderDoc) => {
      const order = orderDoc.data();
      if (!isCountedSaleStatus(String(order.status || ''))) return;
      if (!phone) {
        phone = order.customerPhone || order.deliveryPhone || order.phone || '';
      }
      const total = order.totalAmount || order.total || 0;
      const orderDate = normalizeDateString(order.createdAt || order.date);
      if (!orderDate) return;
      const paid =
        order.paymentStatus === 'paid'
          ? Math.max(total, toFiniteNumber(order.amountPaid, 0))
          : toFiniteNumber(order.amountPaid, 0);

      allTxns.push({
        date: orderDate,
        type: 'order',
        ref: order.invoiceNumber || order.orderNumber || orderDoc.id.substring(0, 8),
        description: `Sales Inv.${order.invoiceNumber || orderDoc.id.substring(0, 6)}`,
        debit: total,
        credit: paid,
        data: { ...order, id: orderDoc.id },
      });
    });

    paymentsSnap.forEach((paymentDoc) => {
      const payment = paymentDoc.data();
      if (payment.direction !== 'in') return;
      const unapplied = getUnappliedPaymentAmount({ ...payment, id: paymentDoc.id });
      if (unapplied <= BALANCE_EPSILON) return;
      const paymentDate = normalizeDateString(payment.date || payment.createdAt);
      if (!paymentDate) return;
      allTxns.push({
        date: paymentDate,
        type: 'payment',
        ref: paymentDoc.id.substring(0, 8),
        description: `Payment - ${payment.method || 'cash'}`,
        debit: 0,
        credit: unapplied,
        data: { ...payment, id: paymentDoc.id },
      });
    });

    financeInvSnap.forEach((invDoc) => {
      const inv = invDoc.data();
      const total = toFiniteNumber(inv.total ?? inv.amount, 0);
      if (total <= 0) return;
      const invDate =
        normalizeDateString(inv.date || inv.createdAt) ||
        normalizeDateString(accountStatementMeta.contractDate as string | undefined);
      if (!invDate) return;
      const invoiceRef = String(inv.invoiceNumber || invDoc.id.substring(0, 8));
      const lineDesc =
        Array.isArray(inv.lineItems) && inv.lineItems[0]?.description
          ? String(inv.lineItems[0].description)
          : String(inv.notes || `Finance Inv.${invoiceRef}`);
      allTxns.push({
        date: invDate,
        type: 'order',
        ref: invoiceRef,
        description: lineDesc.substring(0, 80),
        debit: total,
        credit: 0,
        data: { ...inv, id: invDoc.id },
      });
    });

    financeRcptSnap.forEach((rcptDoc) => {
      const rcpt = rcptDoc.data();
      const amount = toFiniteNumber(rcpt.amount, 0);
      if (amount <= 0) return;
      const rawDate = rcpt.paymentDate || rcpt.paidAt || rcpt.createdAt;
      const pendingDate = String(rawDate || '').trim() === 'pending' || rcpt.pendingOwnerDate === true;
      let paymentDate = pendingDate
        ? normalizeDateString(accountStatementMeta.contractDate as string | undefined)
        : normalizeDateString(rawDate || rcpt.createdAt);
      if (!paymentDate) return;
      const note = sanitizePublicReceiptNote(rcpt.notes || rcpt.paymentMethod, amount);
      allTxns.push({
        date: paymentDate,
        type: 'payment',
        ref: rcptDoc.id.replace(/^rcpt-/, 'RCPT-').substring(0, 12).toUpperCase(),
        description: `Payment — ${note}`,
        debit: 0,
        credit: amount,
        data: { ...rcpt, id: rcptDoc.id },
      });
    });
  }

  if (phone && !billTo.phone) {
    billTo.phone = phone;
  }

  const taggedTxns = tagStatementCurrencies(allTxns);
  taggedTxns.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const openingByCurrency: Record<StatementCurrency, number> = { USD: 0, LBP: 0 };
  const periodTxns: StatementTxn[] = [];
  for (const txn of taggedTxns) {
    const txnDate = normalizeDateString(txn.date);
    if (!txnDate) continue;
    const code = txn.currency || 'USD';
    if (startDate && txnDate < startDate) {
      openingByCurrency[code] += txn.debit - txn.credit;
      continue;
    }
    if (endDate && txnDate > endDate) {
      continue;
    }
    periodTxns.push(txn);
  }

  const lines: PartyStatementLine[] = [];
  const runningByCurrency: Record<StatementCurrency, number> = { ...openingByCurrency };
  const chargesByCurrency: Record<StatementCurrency, number> = { USD: 0, LBP: 0 };
  const creditsByCurrency: Record<StatementCurrency, number> = { USD: 0, LBP: 0 };

  periodTxns.forEach((txn) => {
    const code = txn.currency || 'USD';
    const mapped = mapTxnToLine(txn, runningByCurrency[code], partyType);
    runningByCurrency[code] = mapped.balance;
    chargesByCurrency[code] += mapped.line.charges;
    creditsByCurrency[code] += mapped.line.credits;
    lines.push(mapped.line);
  });

  const currencyBalances: Record<StatementCurrency, PartyCurrencyBalance> = {
    USD: {
      openingBalance: openingByCurrency.USD,
      closingBalance: runningByCurrency.USD,
      totalCharges: chargesByCurrency.USD,
      totalCredits: creditsByCurrency.USD,
    },
    LBP: {
      openingBalance: openingByCurrency.LBP,
      closingBalance: runningByCurrency.LBP,
      totalCharges: chargesByCurrency.LBP,
      totalCredits: creditsByCurrency.LBP,
    },
  };
  const openingBalance = openingByCurrency.USD;
  const runningBalance = runningByCurrency.USD;
  const totalCharges = chargesByCurrency.USD;
  const totalCredits = creditsByCurrency.USD;

  const now = new Date();
  const statementNumber = `${partyType === 'customer' ? 'CS' : 'SS'}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${partyId.slice(0, 6).toUpperCase()}`;

  const dueAnchor =
    periodTxns.length > 0
      ? new Date(normalizeDateString(periodTxns[periodTxns.length - 1]!.date) || now.toISOString())
      : now;
  let paymentDueDate = paymentDueDateFromTerms(paymentTerms, dueAnchor);
  if (partyType === 'customer' && nextPaymentDueFromMeta) {
    paymentDueDate = new Date(nextPaymentDueFromMeta).toLocaleDateString('en-GB');
  }

  return {
    partyType,
    partyId,
    partyName,
    accountNo: generateNumericAccountNo(partyId),
    billTo,
    statementDate: now.toLocaleDateString('en-GB'),
    statementNumber,
    openingBalance,
    closingBalance: runningBalance,
    totalCharges,
    totalCredits,
    paymentDueDate,
    currency: params.currency || 'USD',
    currencyBalances,
    lines,
  };
}

export interface StoreCompanyProfile {
  name: string;
  slogan?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
}

export async function loadStoreCompanyProfile(storeId: string): Promise<StoreCompanyProfile> {
  const db = getFirestore();
  const snap = await getDoc(doc(db, 'storeProfiles', storeId));
  if (!snap.exists()) {
    return { name: 'My Company' };
  }
  const data = snap.data();
  return {
    name: String(data.storeName || data.name || 'My Company'),
    slogan: String(data.tagline || data.slogan || ''),
    address: String(data.address || data.storeAddress || ''),
    phone: String(data.phone || data.whatsappBusiness || ''),
    email: String(data.email || ''),
    website: String(data.website || ''),
    logoUrl: String(data.logoUrl || data.logo || ''),
  };
}
