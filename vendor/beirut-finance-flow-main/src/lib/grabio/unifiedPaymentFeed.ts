import { collection, getDocs, query, where } from 'firebase/firestore';
import { getFinanceDb } from '@/integrations/firebase/client';
import type { Payment, PaymentOrder, Receipt } from '@/types';

export type UnifiedPaymentDirection = 'in' | 'out';

export type UnifiedPaymentSource =
  | 'pos_order'
  | 'account_payment'
  | 'finance_receipt'
  | 'finance_invoice'
  | 'payment_order';

export type UnifiedPaymentRow = {
  id: string;
  direction: UnifiedPaymentDirection;
  date: string;
  amount: number;
  currency: string;
  partyName: string;
  method: string;
  source: UnifiedPaymentSource;
  sourceLabel: string;
  reference: string;
  adminLink?: string;
  accountingLink: string;
  notes?: string;
};

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function toDateString(value: unknown, fallback = ''): string {
  if (typeof value === 'string' && value.trim()) return value.slice(0, 10);
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
  }
  return fallback;
}

function sourceLabel(source: UnifiedPaymentSource): string {
  switch (source) {
    case 'pos_order':
      return 'POS / Orders';
    case 'order':
      return 'POS Sale';
    case 'account_payment':
      return 'Account Statement';
    case 'finance_receipt':
      return 'Finance receipt';
    case 'finance_invoice':
      return 'Invoice payment';
    case 'payment_order':
      return 'Supplier payment';
    default:
      return 'Payment';
  }
}

function coveredSourceKey(sourceType: string, sourceId: string): string {
  return `${sourceType}:${sourceId}`;
}

function adminLinkForSource(sourceType?: string): string | undefined {
  switch (sourceType) {
    case 'account_payment':
      return '/admin/account-statement';
    case 'invoice_payment':
      return '/admin/finance/quotations';
    case 'payment_order':
      return '/admin/purchases';
    case 'order':
    case 'pos_order':
      return '/admin/orders';
    default:
      return undefined;
  }
}

function mapAutoReceiptSource(sourceType?: string): UnifiedPaymentSource {
  switch (sourceType) {
    case 'account_payment':
      return 'account_payment';
    case 'invoice_payment':
      return 'finance_invoice';
    case 'payment_order':
      return 'payment_order';
    case 'order':
      return 'pos_order';
    default:
      return 'finance_receipt';
  }
}

type OrderReceiptIndex = {
  byOrderId: Map<string, Record<string, unknown>>;
  byPartyAmountDate: Map<string, Record<string, unknown>>;
};

function normalizeParty(name: unknown): string {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function partyAmountDateKey(party: unknown, amount: unknown, date: unknown): string {
  return `${normalizeParty(party)}|${toNumber(amount).toFixed(2)}|${toDateString(date).slice(0, 10)}`;
}

function buildOrderReceiptIndexes(
  receipts: Array<Record<string, unknown> & { id?: string; sourceType?: string; sourceId?: string }>,
): OrderReceiptIndex {
  const byOrderId = new Map<string, Record<string, unknown>>();
  const byPartyAmountDate = new Map<string, Record<string, unknown>>();

  for (const receipt of receipts) {
    if (receipt.sourceType !== 'order' || !receipt.sourceId) continue;
    const sourceId = String(receipt.sourceId);
    byOrderId.set(sourceId, receipt);
    const key = partyAmountDateKey(receipt.clientName, receipt.amount, receipt.paymentDate);
    if (!byPartyAmountDate.has(key)) byPartyAmountDate.set(key, receipt);
  }

  return { byOrderId, byPartyAmountDate };
}

function shouldHideLegacyAccountPayment(
  payment: Record<string, unknown> & { id: string },
  indexes: OrderReceiptIndex,
): boolean {
  if (payment.supersededBy || payment.duplicateOfReceipt) return true;
  if (payment.direction === 'out') return false;
  if (payment.accountType === 'supplier' && payment.direction === 'in') return false;

  const { byOrderId, byPartyAmountDate } = indexes;
  const allocation = (payment.orderAllocation as { appliedOrderIds?: string[] } | undefined)?.appliedOrderIds || [];

  if (allocation.length > 0) {
    const receipted = allocation.filter((orderId) => byOrderId.has(String(orderId)));
    if (receipted.length === allocation.length) return true;

    if (receipted.length > 0) {
      const allocatedSum = receipted.reduce(
        (sum, orderId) => sum + toNumber(byOrderId.get(String(orderId))?.amount),
        0,
      );
      if (allocatedSum === toNumber(payment.amount)) return true;
    }
  }

  if (payment.accountType !== 'customer' || payment.direction !== 'in') return false;
  return byPartyAmountDate.has(partyAmountDateKey(payment.accountName, payment.amount, payment.date));
}

export function mergeUnifiedPaymentFeed(input: {
  storeId: string;
  currency?: string;
  receipts: Array<Receipt & {
    direction?: UnifiedPaymentDirection;
    sourceType?: string;
    sourceId?: string;
    voucherNumber?: string;
    invoiceNumber?: string;
    autoGenerated?: boolean;
  }>;
  invoicePayments: Payment[];
  paymentOrders: PaymentOrder[];
  accountPayments: Array<Record<string, unknown> & { id: string }>;
}): UnifiedPaymentRow[] {
  const currency = input.currency || 'USD';
  const rows: UnifiedPaymentRow[] = [];
  const accountingLink = '/admin/finance/accounting';
  const covered = new Set<string>();
  const orderReceiptIndexes = buildOrderReceiptIndexes(
    input.receipts as Array<Record<string, unknown> & { id?: string; sourceType?: string; sourceId?: string }>,
  );

  for (const receipt of input.receipts) {
    const amount = toNumber(receipt.amount);
    if (amount <= 0) continue;
    const direction: UnifiedPaymentDirection = receipt.direction === 'out' ? 'out' : 'in';
    const mappedSource = mapAutoReceiptSource(receipt.sourceType);
    if (receipt.sourceType && receipt.sourceId) {
      covered.add(coveredSourceKey(receipt.sourceType, receipt.sourceId));
    }
    rows.push({
      id: `rec:${receipt.id}`,
      direction,
      date: toDateString(receipt.paymentDate, toDateString(receipt.date)),
      amount,
      currency: receipt.currency || currency,
      partyName: receipt.clientName || receipt.vendor || 'Client',
      method: receipt.paymentMethod || 'cash',
      source: mappedSource,
      sourceLabel: receipt.voucherNumber
        ? `${receipt.sourceType === 'order' ? 'POS Sale' : sourceLabel(mappedSource)} · ${receipt.voucherNumber}`
        : receipt.sourceType === 'order'
          ? 'POS Sale'
          : sourceLabel(mappedSource),
      reference:
        (receipt as { invoiceNumber?: string }).invoiceNumber
        || receipt.voucherNumber
        || receipt.sourceId
        || receipt.id,
      adminLink: adminLinkForSource(receipt.sourceType),
      accountingLink,
      notes: receipt.notes,
    });
  }

  for (const payment of input.accountPayments) {
    if (covered.has(coveredSourceKey('account_payment', payment.id))) continue;
    if (shouldHideLegacyAccountPayment(payment, orderReceiptIndexes)) continue;
    const direction = payment.direction === 'out' ? 'out' : 'in';
    const amount = toNumber(payment.amount);
    if (amount <= 0) continue;
    rows.push({
      id: `ap:${payment.id}`,
      direction,
      date: toDateString(payment.date, toDateString(payment.createdAt)),
      amount,
      currency,
      partyName: String(payment.accountName || payment.accountId || 'Account'),
      method: String(payment.method || 'cash'),
      source: 'account_payment',
      sourceLabel: sourceLabel('account_payment'),
      reference: payment.id,
      adminLink: '/admin/account-statement',
      accountingLink,
      notes: typeof payment.notes === 'string' ? payment.notes : undefined,
    });
  }

  for (const payment of input.invoicePayments) {
    if (covered.has(coveredSourceKey('invoice_payment', payment.id))) continue;
    const amount = toNumber(payment.amount);
    if (amount <= 0) continue;
    rows.push({
      id: `invpay:${payment.id}`,
      direction: 'in',
      date: toDateString(payment.paymentDate),
      amount,
      currency,
      partyName: payment.invoiceId ? `Invoice ${payment.invoiceId}` : 'Invoice payment',
      method: payment.paymentMethod || 'cash',
      source: 'finance_invoice',
      sourceLabel: sourceLabel('finance_invoice'),
      reference: payment.invoiceId || payment.id,
      adminLink: '/admin/finance/quotations',
      accountingLink,
    });
  }

  for (const po of input.paymentOrders) {
    if (po.status !== 'paid') continue;
    if (covered.has(coveredSourceKey('payment_order', po.id))) continue;
    const amount = toNumber(po.amount);
    if (amount <= 0) continue;
    rows.push({
      id: `pay:${po.id}`,
      direction: 'out',
      date: toDateString(po.date),
      amount,
      currency: po.currency || currency,
      partyName: po.supplierName || 'Supplier',
      method: po.paymentMethod || 'bank',
      source: 'payment_order',
      sourceLabel: sourceLabel('payment_order'),
      reference: po.id,
      adminLink: '/admin/purchases',
      accountingLink,
      notes: po.notes,
    });
  }

  return rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export async function fetchGrabioPaymentSources(storeId: string): Promise<{
  accountPayments: Array<Record<string, unknown> & { id: string }>;
  storeReceipts: Array<Record<string, unknown> & { id: string }>;
}> {
  const db = getFinanceDb();
  const [accountSnap, receiptsSnap] = await Promise.all([
    getDocs(query(collection(db, 'accountPayments'), where('storeId', '==', storeId))),
    getDocs(collection(db, 'stores', storeId, 'financeReceipts')),
  ]);

  return {
    accountPayments: accountSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })),
    storeReceipts: receiptsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })),
  };
}
