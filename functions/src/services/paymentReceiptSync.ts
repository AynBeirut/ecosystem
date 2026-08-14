import * as admin from 'firebase-admin';
import { GL_ACCOUNT_CODES } from '../lib/ledger/defaultChartOfAccounts';
import {
  accountByCode,
  accountsMap,
  buildSourceKey,
  ensureDefaultChartOfAccounts,
  postJournalEntry,
  type JournalLineInput,
  type LedgerAccount,
} from '../lib/ledger/postingService';
import { isPlatformOrderCashSale } from '../lib/ledger/platformAutoPosting';
import { orderDateFromData, orderTotalFromData } from '../lib/ledger/resolveOrderCogs';

const COUNTED_SALE_STATUSES = new Set(['delivered', 'paid', 'completed']);

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isCountedSaleStatus(status: unknown): boolean {
  return COUNTED_SALE_STATUSES.has(normalizeString(status).toLowerCase());
}

function isPaidPaymentStatus(paymentStatus: unknown): boolean {
  return normalizeString(paymentStatus).toLowerCase() === 'paid';
}

function orderNeedsSaleReceipt(orderData: Record<string, unknown>): boolean {
  const storeId = normalizeString(orderData.storeId);
  const total = Math.round((Math.abs(orderTotalFromData(orderData)) + Number.EPSILON) * 100) / 100;
  const items = Array.isArray(orderData.items) ? orderData.items : [];
  if (!storeId || total === 0 || items.length === 0) return false;
  return isCountedSaleStatus(orderData.status) || isPaidPaymentStatus(orderData.paymentStatus);
}

function getDb() {
  return admin.firestore();
}

const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function cashOrBank(method?: string): string {
  const m = (method || '').toLowerCase();
  if (m === 'bank' || m === 'card' || m === 'stripe' || m === 'square') return GL_ACCOUNT_CODES.BANK;
  return GL_ACCOUNT_CODES.CASH;
}

export type AccountPaymentDoc = {
  storeId: string;
  accountId?: string;
  accountName?: string;
  accountType?: 'customer' | 'supplier' | string;
  direction?: 'in' | 'out' | string;
  amount?: number;
  date?: string;
  method?: string;
  notes?: string;
  createdBy?: string;
  orderAllocation?: {
    appliedOrderIds?: string[];
    appliedAmount?: number;
  };
};

function receiptDocId(sourceKey: string): string {
  return `auto_${sourceKey.replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 120)}`;
}

async function findJournalEntryBySourceKey(storeId: string, sourceKey: string) {
  const snap = await getDb()
    .collection('stores')
    .doc(storeId)
    .collection('journalEntries')
    .where('sourceKey', '==', sourceKey)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  const data = doc.data();
  return {
    entryId: doc.id,
    voucherNumber: typeof data.voucherNumber === 'string' ? data.voucherNumber : undefined,
  };
}

async function shouldSkipGlForCashOrderAllocation(
  storeId: string,
  payment: AccountPaymentDoc,
): Promise<string | null> {
  if (payment.direction !== 'in' || payment.accountType !== 'customer') return null;
  const orderIds = payment.orderAllocation?.appliedOrderIds || [];
  if (!orderIds.length) return null;

  for (const orderId of orderIds) {
    const orderSnap = await getDb().collection('orders').doc(orderId).get();
    if (!orderSnap.exists) return null;
    const order = orderSnap.data() || {};
    if (!isPlatformOrderCashSale(String(order.paymentMethod || 'cash'))) return null;
    const saleKey = buildSourceKey('order', orderId, 'sale-recognized');
    const saleEntry = await findJournalEntryBySourceKey(storeId, saleKey);
    if (!saleEntry) return null;
  }

  return 'cash_orders_already_recognized';
}

function buildAccountPaymentLines(
  payment: AccountPaymentDoc,
  accounts: LedgerAccount[],
  amount: number,
): { lines: JournalLineInput[]; voucherType: 'RV' | 'PV' } {
  const cashAcct = accountByCode(accounts, cashOrBank(payment.method));
  const ar = accountByCode(accounts, GL_ACCOUNT_CODES.AR);
  const ap = accountByCode(accounts, GL_ACCOUNT_CODES.AP);
  const direction = payment.direction === 'out' ? 'out' : 'in';
  const accountType = payment.accountType === 'supplier' ? 'supplier' : 'customer';

  if (direction === 'in') {
    if (accountType === 'supplier') {
      return {
        voucherType: 'RV',
        lines: [
          { accountId: cashAcct.id, debit: amount, credit: 0, description: 'Supplier refund received' },
          { accountId: ap.id, debit: 0, credit: amount, description: 'AP relief' },
        ],
      };
    }
    return {
      voucherType: 'RV',
      lines: [
        { accountId: cashAcct.id, debit: amount, credit: 0, description: 'Customer payment received' },
        { accountId: ar.id, debit: 0, credit: amount, description: 'AR relief' },
      ],
    };
  }

  if (accountType === 'customer') {
    return {
      voucherType: 'PV',
      lines: [
        { accountId: ar.id, debit: amount, credit: 0, description: 'Customer refund paid' },
        { accountId: cashAcct.id, debit: 0, credit: amount, description: 'Cash out' },
      ],
    };
  }

  return {
    voucherType: 'PV',
    lines: [
      { accountId: ap.id, debit: amount, credit: 0, description: 'Supplier payment' },
      { accountId: cashAcct.id, debit: 0, credit: amount, description: 'Cash out' },
    ],
  };
}

async function resolveStoreCurrency(storeId: string): Promise<string> {
  const snap = await getDb().collection('storeProfiles').doc(storeId).get();
  const data = snap.exists ? snap.data() || {} : {};
  return String((data as { mainCurrency?: string }).mainCurrency || 'USD');
}

export async function upsertAutoPaymentReceiptDoc(input: {
  storeId: string;
  sourceType: string;
  sourceId: string;
  sourceKey: string;
  direction: 'in' | 'out';
  amount: number;
  date: string;
  method: string;
  partyName: string;
  currency?: string;
  notes?: string;
  journalEntryId?: string;
  voucherNumber?: string;
  glSkippedReason?: string;
  createdBy?: string;
  invoiceNumber?: string;
}): Promise<string> {
  const currency = input.currency || (await resolveStoreCurrency(input.storeId));
  const docId = receiptDocId(input.sourceKey);
  const now = new Date().toISOString();
  const direction = input.direction;
  const payload: Record<string, unknown> = {
    storeId: input.storeId,
    amount: round2(input.amount),
    paymentDate: input.date,
    paymentMethod: input.method || 'cash',
    currency,
    notes: input.notes || null,
    date: now,
    createdAt: now,
    updatedAt: now,
    autoGenerated: true,
    direction,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    sourceKey: input.sourceKey,
    ...(input.journalEntryId ? { journalEntryId: input.journalEntryId } : {}),
    ...(input.voucherNumber ? { voucherNumber: input.voucherNumber } : {}),
    ...(input.glSkippedReason ? { glSkippedReason: input.glSkippedReason } : {}),
    ...(input.createdBy ? { createdBy: input.createdBy } : {}),
    ...(input.invoiceNumber ? { invoiceNumber: input.invoiceNumber } : {}),
  };

  if (direction === 'out') {
    payload.vendor = input.partyName;
    payload.clientName = input.partyName;
  } else {
    payload.clientName = input.partyName;
  }

  await getDb()
    .collection('stores')
    .doc(input.storeId)
    .collection('financeReceipts')
    .doc(docId)
    .set(payload, { merge: true });

  return docId;
}

export async function syncAccountPaymentReceiptAndGl(
  paymentId: string,
  payment: AccountPaymentDoc,
): Promise<void> {
  const storeId = payment.storeId;
  const amount = round2(Number(payment.amount) || 0);
  if (!storeId || amount <= 0) return;

  const sourceType = 'account_payment';
  const event = 'posted';
  const sourceKey = buildSourceKey(sourceType, paymentId, event);
  const date = String(payment.date || new Date().toISOString().slice(0, 10));
  const direction = payment.direction === 'out' ? 'out' : 'in';
  const partyName = String(payment.accountName || payment.accountId || 'Account');

  const skipReason = await shouldSkipGlForCashOrderAllocation(storeId, payment);
  let journalEntryId: string | undefined;
  let voucherNumber: string | undefined;

  if (!skipReason) {
    const accounts = await ensureDefaultChartOfAccounts(storeId);
    const { lines, voucherType } = buildAccountPaymentLines(payment, accounts, amount);
    const posted = await postJournalEntry(
      {
        storeId,
        date,
        memo: `Account payment ${paymentId} — ${partyName}`,
        sourceType,
        sourceId: paymentId,
        event,
        voucherType,
        createdBy: payment.createdBy,
        lines,
      },
      accountsMap(accounts),
    );
    journalEntryId = posted.entryId;
    const entry = await findJournalEntryBySourceKey(storeId, sourceKey);
    voucherNumber = entry?.voucherNumber;
  }

  await upsertAutoPaymentReceiptDoc({
    storeId,
    sourceType,
    sourceId: paymentId,
    sourceKey,
    direction,
    amount,
    date,
    method: String(payment.method || 'cash'),
    partyName,
    notes: payment.notes,
    journalEntryId,
    voucherNumber,
    glSkippedReason: skipReason || undefined,
    createdBy: payment.createdBy,
  });
}

function orderReceiptAmount(orderData: Record<string, unknown>): number {
  const total = round2(Math.abs(orderTotalFromData(orderData)));
  const paid = round2(Number(orderData.amountPaid) || 0);
  const paymentStatus = String(orderData.paymentStatus || '').toLowerCase();
  if (paymentStatus === 'paid') return Math.max(total, paid);
  return paid > 0 ? paid : total;
}

/** Phase 3 — one accountant-friendly receipt per POS / order sale (links to sale-recognized RV). */
export async function syncOrderSaleReceiptDoc(
  orderId: string,
  orderData: Record<string, unknown>,
): Promise<void> {
  if (!orderNeedsSaleReceipt(orderData)) return;

  const storeId = String(orderData.storeId || '').trim();
  if (!storeId) return;

  const amount = orderReceiptAmount(orderData);
  if (amount <= 0) return;

  const sourceKey = buildSourceKey('order', orderId, 'sale-recognized');
  const entry = await findJournalEntryBySourceKey(storeId, sourceKey);
  const invoiceRef = String(orderData.invoiceNumber || orderId).trim();
  const partyName = String(orderData.customerName || 'Walk-in customer').trim() || 'Walk-in customer';
  const method = String(orderData.paymentMethod || 'cash').trim() || 'cash';
  const date = orderDateFromData(orderData).slice(0, 10);

  await upsertAutoPaymentReceiptDoc({
    storeId,
    sourceType: 'order',
    sourceId: orderId,
    sourceKey,
    direction: 'in',
    amount,
    date,
    method,
    partyName,
    notes: `POS ${invoiceRef}`,
    invoiceNumber: invoiceRef,
    journalEntryId: entry?.entryId,
    voucherNumber: entry?.voucherNumber,
  });
}
