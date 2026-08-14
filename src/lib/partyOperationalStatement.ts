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

export interface PartyStatementLine {
  date: string;
  invoiceRef: string;
  description: string;
  charges: number;
  credits: number;
  lineTotal: number;
  sourceType?: 'order' | 'payment' | 'purchase' | 'return';
  sourceId?: string;
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
  lines: PartyStatementLine[];
}

interface StatementTxn {
  date: string;
  type: string;
  ref: string;
  description: string;
  debit: number;
  credit: number;
  data: Record<string, unknown>;
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
      charges,
      credits,
      lineTotal: balance,
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
}): Promise<PartyStatementReport> {
  const { storeId, partyType, partyId } = params;
  const db = getFirestore();
  const billTo = (await loadBillTo(partyType, partyId)) || {
    name: params.partyName || 'Unknown',
    accountCode: partyId.slice(0, 8).toUpperCase(),
  };
  const partyName = billTo.name || params.partyName || 'Unknown';

  const allTxns: StatementTxn[] = [];
  let phone = billTo.phone || '';
  let paymentTerms = '';

  if (partyType === 'supplier') {
    const supplierSnap = await getDoc(doc(db, 'suppliers', partyId));
    if (supplierSnap.exists()) {
      paymentTerms = String(supplierSnap.data().paymentTerms || 'net_30');
    }

    const [purchasesSnap, returnsSnap, paymentsSnap] = await Promise.all([
      getDocs(
        query(
          collection(db, 'purchases'),
          where('storeId', '==', storeId),
          where('supplierId', '==', partyId),
        ),
      ),
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
    ]);

    const validPurchaseIds = new Set(purchasesSnap.docs.map((d) => d.id));

    purchasesSnap.forEach((purchaseDoc) => {
      const purchase = purchaseDoc.data();
      const total = purchase.totalCost || purchase.totalAmount || purchase.total || 0;
      const subtotal = purchase.subtotal || total;
      const paid =
        purchase.paymentStatus === 'paid'
          ? Math.max(total, toFiniteNumber(purchase.amountPaid || purchase.paid, 0))
          : toFiniteNumber(purchase.amountPaid || purchase.paid, 0);
      const invoiceRef = purchase.invoiceNumber || purchaseDoc.id.substring(0, 8);

      allTxns.push({
        date: purchase.date || purchase.createdAt || '',
        type: 'purchase',
        ref: invoiceRef,
        description: `Pur.Inv.${invoiceRef}`,
        debit: 0,
        credit: total,
        data: { ...purchase, id: purchaseDoc.id, net: subtotal },
      });

      if (paid > 0) {
        allTxns.push({
          date: purchase.paymentDate || purchase.paidAt || purchase.date || purchase.createdAt || '',
          type: 'purchase_payment',
          ref: `PAY-${invoiceRef}`.substring(0, 20),
          description: `Payment - ${invoiceRef}`,
          debit: paid,
          credit: 0,
          data: purchase,
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
  } else {
    const customerSnap = await getDoc(doc(db, 'customers', partyId));
    if (customerSnap.exists()) {
      paymentTerms = String(customerSnap.data().paymentTerms || 'net_30');
    }

    const [ordersSnap, paymentsSnap] = await Promise.all([
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
  }

  if (phone && !billTo.phone) {
    billTo.phone = phone;
  }

  allTxns.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const lines: PartyStatementLine[] = [];
  let runningBalance = 0;
  let totalCharges = 0;
  let totalCredits = 0;

  allTxns.forEach((txn) => {
    const mapped = mapTxnToLine(txn, runningBalance, partyType);
    runningBalance = mapped.balance;
    totalCharges += mapped.line.charges;
    totalCredits += mapped.line.credits;
    lines.push(mapped.line);
  });

  const now = new Date();
  const statementNumber = `${partyType === 'customer' ? 'CS' : 'SS'}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${partyId.slice(0, 6).toUpperCase()}`;

  return {
    partyType,
    partyId,
    partyName,
    accountNo: generateNumericAccountNo(partyId),
    billTo,
    statementDate: now.toLocaleDateString('en-GB'),
    statementNumber,
    openingBalance: 0,
    closingBalance: runningBalance,
    totalCharges,
    totalCredits,
    paymentDueDate: paymentDueDateFromTerms(paymentTerms, now),
    currency: params.currency || 'USD',
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
