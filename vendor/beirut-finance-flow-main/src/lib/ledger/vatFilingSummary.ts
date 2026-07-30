import type {
  JournalEntry,
  JournalLine,
  LedgerAccount,
  VatFilingSummaryReport,
  VatFilingSourceRow,
} from '@/types/generalLedger';
import { buildTrialBalance } from '@/lib/ledger/trialBalance';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const VAT_ACCOUNT_CODES = {
  INPUT: '140',
  OUTPUT: '220',
  SETTLEMENT: '222',
} as const;

function inDateRange(entryDate: string, start: string, end: string): boolean {
  const d = entryDate.slice(0, 10);
  return d >= start.slice(0, 10) && d <= end.slice(0, 10);
}

function closingBalanceCreditNormal(
  account: LedgerAccount | undefined,
  tbRows: Array<{ accountId: string; debit: number; credit: number }>,
): number {
  if (!account) return 0;
  const row = tbRows.find((r) => r.accountId === account.id);
  if (!row) return 0;
  if (account.normalBalance === 'credit') return round2(row.credit - row.debit);
  return round2(row.debit - row.credit);
}

function accountByCode(accounts: LedgerAccount[], code: string): LedgerAccount | undefined {
  return accounts.find((a) => a.isActive && a.code === code);
}

type VatSide = { collectedOrDebits: number; reversedOrCredits: number };

function netOutput(side: VatSide): number {
  return round2(side.collectedOrDebits - side.reversedOrCredits);
}

function netInput(side: VatSide): number {
  return round2(side.collectedOrDebits - side.reversedOrCredits);
}

/**
 * Period VAT filing summary from posted GL lines (Lebanon-style 11% accounts 220 / 140 / 222).
 * Period activity = sums on lines whose entry date falls in [startDate, endDate].
 */
export function buildVatFilingSummary(
  accounts: LedgerAccount[],
  entries: JournalEntry[],
  lines: JournalLine[],
  options: { startDate: string; endDate: string; currency?: string },
): VatFilingSummaryReport {
  const { startDate, endDate } = options;
  const currency = options.currency || 'USD';

  const outputAcct = accountByCode(accounts, VAT_ACCOUNT_CODES.OUTPUT);
  const inputAcct = accountByCode(accounts, VAT_ACCOUNT_CODES.INPUT);
  const settlementAcct = accountByCode(accounts, VAT_ACCOUNT_CODES.SETTLEMENT);

  const outputId = outputAcct?.id;
  const inputId = inputAcct?.id;
  const settlementId = settlementAcct?.id;

  const entryById = new Map(entries.map((e) => [e.id, e]));
  const postedInPeriod = new Set(
    entries
      .filter((e) => e.status === 'posted' && inDateRange(e.date, startDate, endDate))
      .map((e) => e.id),
  );

  const output: VatSide = { collectedOrDebits: 0, reversedOrCredits: 0 };
  const input: VatSide = { collectedOrDebits: 0, reversedOrCredits: 0 };
  const settlement: VatSide = { collectedOrDebits: 0, reversedOrCredits: 0 };

  const bySourceMap = new Map<string, { outputNet: number; inputNet: number; entryIds: Set<string> }>();

  let lineCount = 0;
  for (const line of lines) {
    if (!postedInPeriod.has(line.entryId)) continue;
    const entry = entryById.get(line.entryId);
    if (!entry) continue;

    const debit = round2(line.debit || 0);
    const credit = round2(line.credit || 0);
    const sourceType = entry.sourceType || 'unknown';

    const bumpSource = (outputDelta: number, inputDelta: number) => {
      const cur = bySourceMap.get(sourceType) || { outputNet: 0, inputNet: 0, entryIds: new Set<string>() };
      cur.outputNet = round2(cur.outputNet + outputDelta);
      cur.inputNet = round2(cur.inputNet + inputDelta);
      cur.entryIds.add(entry.id);
      bySourceMap.set(sourceType, cur);
    };

    if (outputId && line.accountId === outputId) {
      lineCount += 1;
      output.collectedOrDebits = round2(output.collectedOrDebits + credit);
      output.reversedOrCredits = round2(output.reversedOrCredits + debit);
      bumpSource(round2(credit - debit), 0);
    }
    if (inputId && line.accountId === inputId) {
      lineCount += 1;
      input.collectedOrDebits = round2(input.collectedOrDebits + debit);
      input.reversedOrCredits = round2(input.reversedOrCredits + credit);
      bumpSource(0, round2(debit - credit));
    }
    if (settlementId && line.accountId === settlementId) {
      lineCount += 1;
      settlement.collectedOrDebits = round2(settlement.collectedOrDebits + credit);
      settlement.reversedOrCredits = round2(settlement.reversedOrCredits + debit);
    }
  }

  const tbEnd = buildTrialBalance(accounts, entries, lines, { endDate }).rows;

  const outputNet = netOutput(output);
  const inputNet = netInput(input);
  const netVatDue = round2(outputNet - inputNet);

  const bySource: VatFilingSourceRow[] = [...bySourceMap.entries()]
    .map(([sourceType, v]) => ({
      sourceType,
      outputNet: v.outputNet,
      inputNet: v.inputNet,
      entryCount: v.entryIds.size,
    }))
    .filter((r) => r.outputNet !== 0 || r.inputNet !== 0)
    .sort((a, b) => a.sourceType.localeCompare(b.sourceType));

  const entryCount = new Set(
    lines.filter((l) => postedInPeriod.has(l.entryId) && (l.accountId === outputId || l.accountId === inputId || l.accountId === settlementId)).map((l) => l.entryId),
  ).size;

  return {
    startDate: startDate.slice(0, 10),
    endDate: endDate.slice(0, 10),
    currency,
    outputVat: {
      accountCode: VAT_ACCOUNT_CODES.OUTPUT,
      accountName: outputAcct?.name || 'Output VAT',
      collected: output.collectedOrDebits,
      reversed: output.reversedOrCredits,
      net: outputNet,
      closingBalance: closingBalanceCreditNormal(outputAcct, tbEnd),
      accountActive: Boolean(outputAcct?.isActive),
    },
    inputVat: {
      accountCode: VAT_ACCOUNT_CODES.INPUT,
      accountName: inputAcct?.name || 'Input VAT',
      recoverable: input.collectedOrDebits,
      reversed: input.reversedOrCredits,
      net: inputNet,
      closingBalance: closingBalanceCreditNormal(inputAcct, tbEnd),
      accountActive: Boolean(inputAcct?.isActive),
    },
    settlement: settlementAcct
      ? {
          accountCode: VAT_ACCOUNT_CODES.SETTLEMENT,
          accountName: settlementAcct.name,
          credits: settlement.collectedOrDebits,
          debits: settlement.reversedOrCredits,
          net: netOutput(settlement),
          closingBalance: closingBalanceCreditNormal(settlementAcct, tbEnd),
          accountActive: true,
        }
      : undefined,
    netVatDue,
    netVatDueLabel: netVatDue >= 0 ? 'payable' : 'recoverable',
    entryCount,
    lineCount,
    bySource,
  };
}

export function vatFilingSummaryToCsv(report: VatFilingSummaryReport): string {
  const rows: string[][] = [
    ['VAT Filing Summary', `${report.startDate} to ${report.endDate}`],
    ['Currency', report.currency],
    [],
    ['Output VAT', report.outputVat.accountCode, report.outputVat.accountName],
    ['Collected (Cr)', String(report.outputVat.collected)],
    ['Reversed (Dr)', String(report.outputVat.reversed)],
    ['Net output VAT', String(report.outputVat.net)],
    ['Closing balance', String(report.outputVat.closingBalance)],
    [],
    ['Input VAT', report.inputVat.accountCode, report.inputVat.accountName],
    ['Recoverable (Dr)', String(report.inputVat.recoverable)],
    ['Reversed (Cr)', String(report.inputVat.reversed)],
    ['Net input VAT', String(report.inputVat.net)],
    ['Closing balance', String(report.inputVat.closingBalance)],
    [],
    ['Net VAT due (output − input)', String(report.netVatDue), report.netVatDueLabel],
    [],
    ['By source', 'Output net', 'Input net', 'Entries'],
    ...report.bySource.map((r) => [r.sourceType, String(r.outputNet), String(r.inputNet), String(r.entryCount)]),
  ];
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}
