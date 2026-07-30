import type { JournalLineInput } from './postingService';

const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export type BalanceLine = {
  accountId: string;
  entryId: string;
  debit: number;
  credit: number;
};

/** Net balance in the debit-normal direction (assets/expenses). */
export function computeAccountNetDebitBalance(
  accountId: string,
  openingBalance: number,
  lines: BalanceLine[],
  postedEntryIds: Set<string>,
): number {
  let debit = 0;
  let credit = 0;
  for (const line of lines) {
    if (line.accountId !== accountId) continue;
    if (!postedEntryIds.has(line.entryId)) continue;
    debit += Number(line.debit) || 0;
    credit += Number(line.credit) || 0;
  }
  return round2((Number(openingBalance) || 0) + debit - credit);
}

/** Split COGS relief: FG up to on-hand FG balance, remainder from raw materials. */
export function buildCogsInventoryReliefLines(
  totalCogs: number,
  cogsAccountId: string,
  fgAccountId: string,
  rawAccountId: string,
  fgNetDebitBalance: number,
): JournalLineInput[] {
  const total = round2(totalCogs);
  if (total <= 0) return [];

  const fgAvailable = Math.max(0, round2(fgNetDebitBalance));
  const fgRelief = round2(Math.min(total, fgAvailable));
  const rawRelief = round2(total - fgRelief);

  const lines: JournalLineInput[] = [
    { accountId: cogsAccountId, debit: total, credit: 0, description: 'COGS' },
  ];
  if (fgRelief > 0) {
    lines.push({
      accountId: fgAccountId,
      debit: 0,
      credit: fgRelief,
      description: 'FG inventory relief',
    });
  }
  if (rawRelief > 0) {
    lines.push({
      accountId: rawAccountId,
      debit: 0,
      credit: rawRelief,
      description: 'Raw materials relief',
    });
  }
  return lines;
}

export type CogsReliefSplit = { fgRelief: number; rawRelief: number };

export function parseCogsReliefSplit(lines: Array<{ accountId: string; debit: number; credit: number; description?: string }>, fgAccountId: string, rawAccountId: string, totalCogs: number): CogsReliefSplit {
  let fgRelief = 0;
  let rawRelief = 0;
  for (const line of lines) {
    if (line.accountId === fgAccountId && (line.credit || 0) > 0) fgRelief += line.credit || 0;
    if (line.accountId === rawAccountId && (line.credit || 0) > 0) rawRelief += line.credit || 0;
  }
  fgRelief = round2(fgRelief);
  rawRelief = round2(rawRelief);
  const total = round2(totalCogs);
  if (fgRelief + rawRelief === total) return { fgRelief, rawRelief };
  return { fgRelief: total, rawRelief: 0 };
}

export function buildCogsInventoryReversalLines(
  totalCogs: number,
  cogsAccountId: string,
  fgAccountId: string,
  rawAccountId: string,
  split: CogsReliefSplit,
): JournalLineInput[] {
  const total = round2(totalCogs);
  if (total <= 0) return [];
  const lines: JournalLineInput[] = [
    { accountId: cogsAccountId, debit: 0, credit: total, description: 'Reverse COGS' },
  ];
  if (split.fgRelief > 0) {
    lines.push({
      accountId: fgAccountId,
      debit: split.fgRelief,
      credit: 0,
      description: 'Restore FG inventory',
    });
  }
  if (split.rawRelief > 0) {
    lines.push({
      accountId: rawAccountId,
      debit: split.rawRelief,
      credit: 0,
      description: 'Restore raw materials',
    });
  }
  return lines;
}
