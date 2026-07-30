import type {
  JournalEntry,
  JournalLine,
  LedgerAccount,
} from '@/types/generalLedger';
import type { AgedReceivablesBucketKey, AgedReceivablesReport, AgedReceivablesRow } from '@/types/generalLedger';
import { buildTrialBalance } from '@/lib/ledger/trialBalance';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const AR_ACCOUNT_CODE = '110';

export type AgedReceivableInvoice = {
  id: string;
  date: string;
  clientId?: string;
  clientName: string;
  status: string;
  amount: number;
  total?: number;
  paidAmount?: number;
  currency?: string;
};

const BUCKET_ORDER: AgedReceivablesBucketKey[] = ['current', 'days31_60', 'days61_90', 'days91_plus'];

function emptyBuckets(): Record<AgedReceivablesBucketKey, number> {
  return { current: 0, days31_60: 0, days61_90: 0, days91_plus: 0 };
}

export function invoiceOutstandingBalance(invoice: AgedReceivableInvoice): number {
  if (invoice.status === 'paid' || invoice.status === 'draft') return 0;
  const total = round2(Number(invoice.total ?? invoice.amount) || 0);
  const paid = round2(Number(invoice.paidAmount) || 0);
  return round2(Math.max(0, total - paid));
}

function bucketForDays(daysPast: number): AgedReceivablesBucketKey {
  if (daysPast <= 30) return 'current';
  if (daysPast <= 60) return 'days31_60';
  if (daysPast <= 90) return 'days61_90';
  return 'days91_plus';
}

function daysBetween(invoiceDate: string, asOfDate: string): number {
  const start = new Date(invoiceDate.slice(0, 10));
  const end = new Date(asOfDate.slice(0, 10));
  const ms = end.getTime() - start.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function glArBalance(
  accounts: LedgerAccount[],
  entries: JournalEntry[],
  lines: JournalLine[],
  asOfDate: string,
): number {
  const tb = buildTrialBalance(accounts, entries, lines, { endDate: asOfDate });
  const codeSet = new Set([AR_ACCOUNT_CODE]);
  return round2(
    tb.rows.filter((r) => codeSet.has(r.accountCode)).reduce((s, r) => s + r.debit - r.credit, 0),
  );
}

/** Open invoice balances aged by days since invoice date; tie to GL account 110. */
export function buildAgedReceivablesReport(
  invoices: AgedReceivableInvoice[],
  accounts: LedgerAccount[],
  entries: JournalEntry[],
  lines: JournalLine[],
  asOfDate: string,
): AgedReceivablesReport {
  const asOf = asOfDate.slice(0, 10);
  const buckets = emptyBuckets();
  const rows: AgedReceivablesRow[] = [];

  for (const inv of invoices) {
    const outstanding = invoiceOutstandingBalance(inv);
    if (outstanding <= 0) continue;
    const daysPast = daysBetween(inv.date, asOf);
    const bucket = bucketForDays(daysPast);
    buckets[bucket] = round2(buckets[bucket] + outstanding);
    rows.push({
      invoiceId: inv.id,
      clientId: inv.clientId,
      clientName: inv.clientName || '—',
      invoiceDate: inv.date.slice(0, 10),
      daysPast,
      bucket,
      outstanding,
      currency: inv.currency || 'USD',
      status: inv.status,
    });
  }

  rows.sort((a, b) => b.daysPast - a.daysPast || b.outstanding - a.outstanding);

  const subledgerTotal = round2(Object.values(buckets).reduce((s, n) => s + n, 0));
  const glBalance = glArBalance(accounts, entries, lines, asOf);
  const variance = round2(glBalance - subledgerTotal);

  return {
    asOfDate: asOf,
    buckets,
    rows,
    subledgerTotal,
    glBalance,
    variance,
    matched: variance === 0,
    openInvoiceCount: rows.length,
  };
}

export const AGED_RECEIVABLES_BUCKET_LABELS: Record<AgedReceivablesBucketKey, string> = {
  current: 'Current (0–30 days)',
  days31_60: '31–60 days',
  days61_90: '61–90 days',
  days91_plus: '91+ days',
};

export function agedReceivablesToCsv(report: AgedReceivablesReport): string {
  const header = ['Invoice', 'Client', 'Date', 'Days', 'Bucket', 'Outstanding', 'Status'];
  const lines = report.rows.map((r) => [
    r.invoiceId,
    r.clientName,
    r.invoiceDate,
    String(r.daysPast),
    AGED_RECEIVABLES_BUCKET_LABELS[r.bucket],
    String(r.outstanding),
    r.status,
  ]);
  const summary = [
    [],
    ['As of', report.asOfDate],
    ['Subledger total', String(report.subledgerTotal)],
    ['GL 110 balance', String(report.glBalance)],
    ['Variance', String(report.variance)],
    ...BUCKET_ORDER.map((k) => [AGED_RECEIVABLES_BUCKET_LABELS[k], String(report.buckets[k])]),
  ];
  return [header, ...lines, ...summary]
    .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}
