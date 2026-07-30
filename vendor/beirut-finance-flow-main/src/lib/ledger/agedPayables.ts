import type {
  JournalEntry,
  JournalLine,
  LedgerAccount,
  AgedPayablesBucketKey,
  AgedPayablesReport,
  AgedPayablesRow,
} from '@/types/generalLedger';
import { buildTrialBalance } from '@/lib/ledger/trialBalance';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const AP_ACCOUNT_CODE = '201';

export type AgedPayablePurchaseOrder = {
  id: string;
  date: string;
  supplierId?: string;
  supplierName: string;
  status: string;
  amount: number;
  total?: number;
  paidAmount?: number;
  paymentStatus?: string;
  source?: 'platform' | 'finance';
  currency?: string;
};

export type AgedPayablePayment = {
  id: string;
  purchaseOrderId?: string;
  amount: number;
  status: string;
};

const BUCKET_ORDER: AgedPayablesBucketKey[] = ['current', 'days31_60', 'days61_90', 'days91_plus'];

function emptyBuckets(): Record<AgedPayablesBucketKey, number> {
  return { current: 0, days31_60: 0, days61_90: 0, days91_plus: 0 };
}

export function purchaseOrderPaidTotal(
  poId: string,
  paymentOrders: AgedPayablePayment[],
  poPaidAmount?: number,
): number {
  const fromPayments = round2(
    paymentOrders
      .filter((p) => p.purchaseOrderId === poId && p.status === 'paid')
      .reduce((s, p) => s + (Number(p.amount) || 0), 0),
  );
  const explicit = round2(Number(poPaidAmount) || 0);
  return round2(Math.max(fromPayments, explicit));
}

export function purchaseOrderOutstandingBalance(
  po: AgedPayablePurchaseOrder,
  paymentOrders: AgedPayablePayment[],
): number {
  const total = round2(Number(po.total ?? po.amount) || 0);
  if (total <= 0) return 0;
  if (po.status === 'draft') return 0;

  const paid = purchaseOrderPaidTotal(po.id, paymentOrders, po.paidAmount);
  const outstandingFromAmount = round2(Math.max(0, total - paid));

  const paymentStatus = String(po.paymentStatus || '').toLowerCase();
  if (paymentStatus === 'paid') return 0;
  if (paymentStatus === 'unpaid' || paymentStatus === 'partial') return outstandingFromAmount;

  if (po.status === 'sent' || po.status === 'approved') return outstandingFromAmount;

  if (po.status === 'fulfilled') {
    if (po.source === 'platform') return outstandingFromAmount;
    if (paid < total) return outstandingFromAmount;
    return 0;
  }

  return 0;
}

function bucketForDays(daysPast: number): AgedPayablesBucketKey {
  if (daysPast <= 30) return 'current';
  if (daysPast <= 60) return 'days31_60';
  if (daysPast <= 90) return 'days61_90';
  return 'days91_plus';
}

function daysBetween(poDate: string, asOfDate: string): number {
  const ms = new Date(asOfDate.slice(0, 10)).getTime() - new Date(poDate.slice(0, 10)).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function glApBalance(
  accounts: LedgerAccount[],
  entries: JournalEntry[],
  lines: JournalLine[],
  asOfDate: string,
): number {
  const tb = buildTrialBalance(accounts, entries, lines, { endDate: asOfDate });
  const codeSet = new Set([AP_ACCOUNT_CODE]);
  return round2(
    tb.rows
      .filter((r) => codeSet.has(r.accountCode))
      .reduce((s, r) => s + r.credit - r.debit, 0),
  );
}

/** Open PO balances aged by days since PO date; tie to GL account 201. */
export function buildAgedPayablesReport(
  purchaseOrders: AgedPayablePurchaseOrder[],
  paymentOrders: AgedPayablePayment[],
  accounts: LedgerAccount[],
  entries: JournalEntry[],
  lines: JournalLine[],
  asOfDate: string,
): AgedPayablesReport {
  const asOf = asOfDate.slice(0, 10);
  const buckets = emptyBuckets();
  const rows: AgedPayablesRow[] = [];

  for (const po of purchaseOrders) {
    const outstanding = purchaseOrderOutstandingBalance(po, paymentOrders);
    if (outstanding <= 0) continue;
    const daysPast = daysBetween(po.date, asOf);
    const bucket = bucketForDays(daysPast);
    buckets[bucket] = round2(buckets[bucket] + outstanding);
    const paid = purchaseOrderPaidTotal(po.id, paymentOrders, po.paidAmount);
    rows.push({
      purchaseOrderId: po.id,
      supplierId: po.supplierId,
      supplierName: po.supplierName || '—',
      poDate: po.date.slice(0, 10),
      daysPast,
      bucket,
      outstanding,
      grossAmount: round2(Number(po.total ?? po.amount) || 0),
      paidAmount: paid,
      currency: po.currency || 'USD',
      status: po.status,
    });
  }

  rows.sort((a, b) => b.daysPast - a.daysPast || b.outstanding - a.outstanding);

  const subledgerTotal = round2(Object.values(buckets).reduce((s, n) => s + n, 0));
  const glBalance = glApBalance(accounts, entries, lines, asOf);
  const variance = round2(glBalance - subledgerTotal);

  return {
    asOfDate: asOf,
    buckets,
    rows,
    subledgerTotal,
    glBalance,
    variance,
    matched: variance === 0,
    openPoCount: rows.length,
  };
}

export const AGED_PAYABLES_BUCKET_LABELS: Record<AgedPayablesBucketKey, string> = {
  current: 'Current (0–30 days)',
  days31_60: '31–60 days',
  days61_90: '61–90 days',
  days91_plus: '91+ days',
};

export function agedPayablesToCsv(report: AgedPayablesReport): string {
  const header = ['PO', 'Supplier', 'Date', 'Days', 'Bucket', 'Gross', 'Paid', 'Outstanding', 'Status'];
  const lines = report.rows.map((r) => [
    r.purchaseOrderId,
    r.supplierName,
    r.poDate,
    String(r.daysPast),
    AGED_PAYABLES_BUCKET_LABELS[r.bucket],
    String(r.grossAmount),
    String(r.paidAmount),
    String(r.outstanding),
    r.status,
  ]);
  const summary = [
    [],
    ['As of', report.asOfDate],
    ['Subledger total', String(report.subledgerTotal)],
    ['GL 201 balance', String(report.glBalance)],
    ['Variance', String(report.variance)],
    ...BUCKET_ORDER.map((k) => [AGED_PAYABLES_BUCKET_LABELS[k], String(report.buckets[k])]),
  ];
  return [header, ...lines, ...summary]
    .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}
