import type {
  GeneralLedgerReport,
  GeneralLedgerReportRow,
  JournalEntry,
  JournalLine,
  LedgerAccount,
} from '@/types/generalLedger';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function inRange(date: string, start: string, end: string): boolean {
  const d = date.slice(0, 10);
  return d >= start.slice(0, 10) && d <= end.slice(0, 10);
}

export function buildGeneralLedgerReport(
  account: LedgerAccount,
  entries: JournalEntry[],
  lines: JournalLine[],
  options: { startDate: string; endDate: string; costCenterId?: string },
): GeneralLedgerReport {
  const postedBefore = new Set(
    entries.filter((e) => e.status === 'posted' && e.date.slice(0, 10) < options.startDate.slice(0, 10)).map((e) => e.id),
  );
  const postedInRange = entries
    .filter((e) => e.status === 'posted' && inRange(e.date, options.startDate, options.endDate))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  let openingBalance = round2(account.openingBalance || 0);
  for (const line of lines) {
    if (line.accountId !== account.id || !postedBefore.has(line.entryId)) continue;
    if (options.costCenterId && line.costCenterId !== options.costCenterId) continue;
    if (account.normalBalance === 'debit') openingBalance = round2(openingBalance + line.debit - line.credit);
    else openingBalance = round2(openingBalance + line.credit - line.debit);
  }

  const rows: GeneralLedgerReportRow[] = [];
  let running = openingBalance;

  for (const entry of postedInRange) {
    const entryLines = lines
      .filter((l) => l.entryId === entry.id && l.accountId === account.id)
      .filter((l) => !options.costCenterId || l.costCenterId === options.costCenterId);
    for (const line of entryLines) {
      const debit = round2(line.debit || 0);
      const credit = round2(line.credit || 0);
      if (account.normalBalance === 'debit') running = round2(running + debit - credit);
      else running = round2(running + credit - debit);
      rows.push({
        date: entry.date.slice(0, 10),
        entryId: entry.id,
        voucherNumber: entry.voucherNumber,
        voucherType: entry.voucherType,
        memo: entry.memo,
        debit,
        credit,
        runningBalance: running,
        costCenterId: line.costCenterId,
      });
    }
  }

  return {
    accountId: account.id,
    accountCode: account.code,
    accountName: account.name,
    startDate: options.startDate.slice(0, 10),
    endDate: options.endDate.slice(0, 10),
    openingBalance,
    closingBalance: running,
    rows,
  };
}

export function generalLedgerToCsv(report: GeneralLedgerReport): string {
  const header = ['Date', 'Voucher', 'Type', 'Memo', 'Debit', 'Credit', 'Balance', 'Cost Center'];
  const body = report.rows.map((r) =>
    [r.date, r.voucherNumber || r.entryId, r.voucherType || '', (r.memo || '').replace(/,/g, ' '), r.debit, r.credit, r.runningBalance, r.costCenterId || ''].join(','),
  );
  return [header.join(','), ...body].join('\n');
}
