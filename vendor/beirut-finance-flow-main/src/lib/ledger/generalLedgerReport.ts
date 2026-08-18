import type {
  GeneralLedgerReport,
  JournalEntry,
  JournalLine,
  LedgerAccount,
} from '@/types/generalLedger';
import {
  buildGeneralLedgerRowsFromContext,
  createLedgerReportContext,
} from '@/lib/ledger/ledgerReportContext';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function buildGeneralLedgerReport(
  account: LedgerAccount,
  entries: JournalEntry[],
  lines: JournalLine[],
  options: {
    startDate: string;
    endDate: string;
    costCenterId?: string;
    defaultCurrency?: string;
    presentation?: import('@/lib/ledger/glEntryPresentation').GlPresentationContext;
  },
): GeneralLedgerReport {
  const ctx = createLedgerReportContext(entries, lines, options);
  const built = buildGeneralLedgerRowsFromContext(account, ctx, {
    costCenterId: options.costCenterId,
    includeZeroActivity: true,
    presentation: options.presentation,
    defaultCurrency: options.defaultCurrency,
  });
  const openingBalance = built?.openingBalance ?? round2(account.openingBalance || 0);
  const closingBalance = built?.closingBalance ?? openingBalance;
  const rows = built?.rows ?? [];

  return {
    accountId: account.id,
    accountCode: account.code,
    accountName: account.name,
    startDate: options.startDate.slice(0, 10),
    endDate: options.endDate.slice(0, 10),
    openingBalance,
    closingBalance,
    rows,
  };
}

export function generalLedgerToCsv(report: GeneralLedgerReport): string {
  const header = ['Date', 'Type', 'Voucher', 'Party', 'Category', 'Reference', 'Description', 'Debit', 'Credit', 'Balance', 'Currency'];
  const body = report.rows.map((r) =>
    [
      r.date,
      r.typeLabel || r.voucherType || '',
      r.voucherNumber || r.entryId,
      (r.party || '').replace(/,/g, ' '),
      (r.category || '').replace(/,/g, ' '),
      (r.reference || '').replace(/,/g, ' '),
      (r.displayDescription || r.memo || '').replace(/,/g, ' '),
      r.debit,
      r.credit,
      r.runningBalance,
      r.currency || '',
    ].join(','),
  );
  return [header.join(','), ...body].join('\n');
}
