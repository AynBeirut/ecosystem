import type {
  JournalEntry,
  JournalLine,
  LedgerAccount,
  PartyStatementReport,
  PartyStatementRow,
  VoucherLineSettlement,
} from '@/types/generalLedger';
import { isAccountsPayableCode, isAccountsReceivableCode } from '@/lib/ledger/accountControlCodes';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function inRange(date: string, start: string, end: string): boolean {
  const d = date.slice(0, 10);
  return d >= start.slice(0, 10) && d <= end.slice(0, 10);
}

function settlementMapForAccount(
  accountId: string,
  lines: JournalLine[],
  settlements: VoucherLineSettlement[],
): Map<string, string> {
  const entryIds = new Set(lines.filter((l) => l.accountId === accountId).map((l) => l.entryId));
  const map = new Map<string, string>();
  for (const s of settlements) {
    if (entryIds.has(s.paymentEntryId)) {
      map.set(s.paymentEntryId, s.documentId);
    }
  }
  return map;
}

export function buildPartyStatement(
  account: LedgerAccount,
  entries: JournalEntry[],
  lines: JournalLine[],
  settlements: VoucherLineSettlement[],
  options: { startDate: string; endDate: string; partyName: string; partyType: 'client' | 'supplier' },
): PartyStatementReport {
  const code = account.code;
  const isAr = isAccountsReceivableCode(code);
  const isAp = isAccountsPayableCode(code);
  if (!isAr && !isAp) {
    throw new Error('Party statement requires an AR (411x/110) or AP (401x/201) account.');
  }

  const postedBefore = new Set(
    entries.filter((e) => e.status === 'posted' && e.date.slice(0, 10) < options.startDate.slice(0, 10)).map((e) => e.id),
  );
  const postedInRange = entries
    .filter((e) => e.status === 'posted' && inRange(e.date, options.startDate, options.endDate))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  let openingBalance = round2(account.openingBalance || 0);
  for (const line of lines) {
    if (line.accountId !== account.id || !postedBefore.has(line.entryId)) continue;
    if (isAr) openingBalance = round2(openingBalance + line.debit - line.credit);
    else openingBalance = round2(openingBalance + line.credit - line.debit);
  }

  const matchMap = settlementMapForAccount(account.id, lines, settlements);
  const rows: PartyStatementRow[] = [];
  let running = openingBalance;

  for (const entry of postedInRange) {
    const entryLines = lines.filter((l) => l.entryId === entry.id && l.accountId === account.id);
    for (const line of entryLines) {
      const debit = round2(line.debit || 0);
      const credit = round2(line.credit || 0);
      if (isAr) running = round2(running + debit - credit);
      else running = round2(running + credit - debit);
      rows.push({
        date: entry.date.slice(0, 10),
        voucherType: entry.voucherType,
        refNumber: entry.voucherNumber || entry.id,
        entryId: entry.id,
        debit,
        credit,
        runningBalance: running,
        matchedDocumentId: matchMap.get(entry.id),
        memo: entry.memo,
      });
    }
  }

  return {
    partyName: options.partyName,
    partyType: options.partyType,
    startDate: options.startDate.slice(0, 10),
    endDate: options.endDate.slice(0, 10),
    openingBalance,
    closingBalance: running,
    rows,
  };
}

export function partyStatementToCsv(report: PartyStatementReport): string {
  const header = ['Date', 'Type', 'Ref', 'Debit', 'Credit', 'Balance', 'Matched Doc', 'Memo'];
  const body = report.rows.map((r) => [
    r.date,
    r.voucherType || '',
    r.refNumber || '',
    String(r.debit || ''),
    String(r.credit || ''),
    String(r.runningBalance),
    r.matchedDocumentId || '',
    (r.memo || '').replace(/,/g, ' '),
  ]);
  return [header.join(','), ...body.map((row) => row.join(','))].join('\n');
}
