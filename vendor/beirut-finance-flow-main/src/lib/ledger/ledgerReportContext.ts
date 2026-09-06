import type { GeneralLedgerReportRow, JournalEntry, JournalLine, LedgerAccount, LedgerDateBasis } from '@/types/generalLedger';
import type { GlPresentationContext } from '@/lib/ledger/glEntryPresentation';
import { presentGlEntry } from '@/lib/ledger/glEntryPresentation';
import { sanitizeJournalMemoForDisplay } from '@/lib/ledger/ledgerHumanLabels';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function inRange(date: string, start: string, end: string): boolean {
  const d = date.slice(0, 10);
  return d >= start.slice(0, 10) && d <= end.slice(0, 10);
}

export type LedgerReportContext = {
  startDate: string;
  endDate: string;
  dateBasis: LedgerDateBasis;
  entriesById: Map<string, JournalEntry>;
  postedBefore: Set<string>;
  postedInRange: JournalEntry[];
  linesByAccountId: Map<string, JournalLine[]>;
  linesByEntryAndAccount: Map<string, JournalLine[]>;
  linesByEntryId: Map<string, JournalLine[]>;
};

export function effectiveLineDate(
  line: JournalLine,
  entry: JournalEntry,
  basis: LedgerDateBasis,
): string {
  if (basis === 'value' && line.valueDate) return line.valueDate.slice(0, 10);
  return entry.date.slice(0, 10);
}

export function createLedgerReportContext(
  entries: JournalEntry[],
  lines: JournalLine[],
  options: { startDate: string; endDate: string; dateBasis?: LedgerDateBasis },
): LedgerReportContext {
  const startDate = options.startDate.slice(0, 10);
  const endDate = options.endDate.slice(0, 10);
  const dateBasis = options.dateBasis || 'posting';
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
  const postedBefore = new Set<string>();
  const postedInRange: JournalEntry[] = [];

  if (dateBasis === 'posting') {
    for (const entry of entries) {
      if (entry.status !== 'posted') continue;
      const day = entry.date.slice(0, 10);
      if (day < startDate) postedBefore.add(entry.id);
      else if (inRange(day, startDate, endDate)) postedInRange.push(entry);
    }
    postedInRange.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  } else {
    const inRangeEntryIds = new Set<string>();
    for (const line of lines) {
      const entry = entriesById.get(line.entryId);
      if (!entry || entry.status !== 'posted') continue;
      const day = effectiveLineDate(line, entry, dateBasis);
      if (day < startDate) postedBefore.add(line.entryId);
      else if (inRange(day, startDate, endDate)) inRangeEntryIds.add(line.entryId);
    }
    for (const entry of entries) {
      if (entry.status !== 'posted') continue;
      if (inRangeEntryIds.has(entry.id)) postedInRange.push(entry);
    }
    postedInRange.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  }

  const linesByAccountId = new Map<string, JournalLine[]>();
  const linesByEntryAndAccount = new Map<string, JournalLine[]>();
  const linesByEntryId = new Map<string, JournalLine[]>();

  for (const line of lines) {
    const byAccount = linesByAccountId.get(line.accountId);
    if (byAccount) byAccount.push(line);
    else linesByAccountId.set(line.accountId, [line]);

    const byEntry = linesByEntryId.get(line.entryId);
    if (byEntry) byEntry.push(line);
    else linesByEntryId.set(line.entryId, [line]);

    const key = `${line.entryId}\0${line.accountId}`;
    const byEntryAcct = linesByEntryAndAccount.get(key);
    if (byEntryAcct) byEntryAcct.push(line);
    else linesByEntryAndAccount.set(key, [line]);
  }

  return {
    startDate,
    endDate,
    dateBasis,
    entriesById,
    postedBefore,
    postedInRange,
    linesByAccountId,
    linesByEntryAndAccount,
    linesByEntryId,
  };
}

export function buildGeneralLedgerRowsFromContext(
  account: LedgerAccount,
  ctx: LedgerReportContext,
  options?: {
    costCenterId?: string;
    includeZeroActivity?: boolean;
    entriesById?: Map<string, JournalEntry>;
    presentation?: GlPresentationContext;
    defaultCurrency?: string;
  },
): {
  openingBalance: number;
  closingBalance: number;
  rows: GeneralLedgerReportRow[];
} | null {
  const accountLines = ctx.linesByAccountId.get(account.id);
  const costCenterId = options?.costCenterId;
  const includeZeroActivity = options?.includeZeroActivity === true;
  const entriesById = options?.entriesById || ctx.entriesById;

  let openingBalance = round2(account.openingBalance || 0);
  if (accountLines) {
    for (const line of accountLines) {
      const entry = entriesById.get(line.entryId);
      if (!entry || entry.status !== 'posted') continue;
      const effectiveDate = entry ? effectiveLineDate(line, entry, ctx.dateBasis) : '';
      if (ctx.dateBasis === 'value') {
        if (!effectiveDate || effectiveDate >= ctx.startDate) continue;
      } else if (!ctx.postedBefore.has(line.entryId)) {
        continue;
      }
      if (costCenterId && line.costCenterId !== costCenterId) continue;
      if (account.normalBalance === 'debit') openingBalance = round2(openingBalance + line.debit - line.credit);
      else openingBalance = round2(openingBalance + line.credit - line.debit);
    }
  }

  const rows: GeneralLedgerReportRow[] = [];
  let running = openingBalance;

  const pushRow = (journalEntry: JournalEntry, line: JournalLine, rowDate: string) => {
    const debit = round2(line.debit || 0);
    const credit = round2(line.credit || 0);
    if (account.normalBalance === 'debit') running = round2(running + debit - credit);
    else running = round2(running + credit - debit);

    const currency =
      line.currency ||
      journalEntry.currency ||
      account.currency ||
      options?.defaultCurrency ||
      'USD';
    const presentation = options?.presentation
      ? presentGlEntry(journalEntry, line, options.presentation, ctx.linesByEntryId.get(journalEntry.id) || [])
      : undefined;

    rows.push({
      date: rowDate,
      entryId: journalEntry.id,
      voucherNumber: journalEntry.voucherNumber,
      voucherType: journalEntry.voucherType,
      memo: sanitizeJournalMemoForDisplay(journalEntry.memo || ''),
      debit,
      credit,
      runningBalance: running,
      costCenterId: line.costCenterId,
      currency,
      typeLabel: presentation?.typeLabel,
      party: presentation?.party,
      category: presentation?.category,
      reference: presentation?.reference,
      displayDescription: presentation?.description,
    });
  };

  if (ctx.dateBasis === 'value' && accountLines) {
    const ranged: Array<{ entry: JournalEntry; line: JournalLine; rowDate: string }> = [];
    for (const line of accountLines) {
      const entry = entriesById.get(line.entryId);
      if (!entry || entry.status !== 'posted') continue;
      const rowDate = effectiveLineDate(line, entry, ctx.dateBasis);
      if (!inRange(rowDate, ctx.startDate, ctx.endDate)) continue;
      if (costCenterId && line.costCenterId !== costCenterId) continue;
      ranged.push({ entry, line, rowDate });
    }
    ranged.sort(
      (a, b) => a.rowDate.localeCompare(b.rowDate) || a.entry.id.localeCompare(b.entry.id) || a.line.lineOrder - b.line.lineOrder,
    );
    for (const item of ranged) pushRow(item.entry, item.line, item.rowDate);
  } else {
    for (const journalEntry of ctx.postedInRange) {
      const key = `${journalEntry.id}\0${account.id}`;
      const entryLines = ctx.linesByEntryAndAccount.get(key);
      if (!entryLines) continue;
      for (const line of entryLines) {
        if (costCenterId && line.costCenterId !== costCenterId) continue;
        pushRow(journalEntry, line, journalEntry.date.slice(0, 10));
      }
    }
  }

  if (!includeZeroActivity && rows.length === 0 && openingBalance === 0 && running === 0) {
    return null;
  }

  return { openingBalance, closingBalance: running, rows };
}
