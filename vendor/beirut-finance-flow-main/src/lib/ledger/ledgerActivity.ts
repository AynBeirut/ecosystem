import type { JournalEntry, JournalLine, LedgerAccount } from '@/types/generalLedger';
import { buildBookLinesForAccount } from '@/lib/ledger/accountLedgerLines';

export type LedgerActivityFocus =
  | { kind: 'account'; accountId: string; label: string }
  | { kind: 'client'; clientId?: string; clientName: string; label: string }
  | { kind: 'supplier'; supplierId?: string; supplierName: string; label: string };

function metaRecord(entry: JournalEntry): Record<string, unknown> | undefined {
  return entry.voucherMeta as Record<string, unknown> | undefined;
}

export function entriesForClient(
  entries: JournalEntry[],
  clientId: string | undefined,
  clientName: string,
): JournalEntry[] {
  const nameLower = clientName.trim().toLowerCase();
  return entries.filter((entry) => {
    if (entry.status !== 'posted') return false;
    const meta = metaRecord(entry);
    if (clientId && meta?.clientId === clientId) return true;
    if (entry.voucherType === 'RV' && entry.memo?.toLowerCase().includes(nameLower)) return true;
    const payer = typeof meta?.payer === 'string' ? meta.payer.toLowerCase() : '';
    if (payer && payer.includes(nameLower)) return true;
    return false;
  });
}

export function entriesForSupplier(
  entries: JournalEntry[],
  supplierId: string | undefined,
  supplierName: string,
): JournalEntry[] {
  const nameLower = supplierName.trim().toLowerCase();
  return entries.filter((entry) => {
    if (entry.status !== 'posted') return false;
    const meta = metaRecord(entry);
    if (supplierId && meta?.supplierId === supplierId) return true;
    if (entry.voucherType === 'PV' && entry.memo?.toLowerCase().includes(nameLower)) return true;
    const payee = typeof meta?.payee === 'string' ? meta.payee.toLowerCase() : '';
    if (payee && payee.includes(nameLower)) return true;
    return false;
  });
}

export function resolveActivityEntries(
  focus: LedgerActivityFocus,
  entries: JournalEntry[],
): JournalEntry[] {
  if (focus.kind === 'client') {
    return entriesForClient(entries, focus.clientId, focus.clientName);
  }
  if (focus.kind === 'supplier') {
    return entriesForSupplier(entries, focus.supplierId, focus.supplierName);
  }
  return [];
}

export function accountActivityLines(
  accountId: string,
  accounts: LedgerAccount[],
  entries: JournalEntry[],
  lines: JournalLine[],
  endDate: string,
) {
  return buildBookLinesForAccount(accountId, accounts, entries, lines, {
    startDate: '1970-01-01',
    endDate,
  });
}

const LEDGER_FOCUS_KEY = 'grabio.ledgerFocus';

export function stashLedgerFocus(focus: LedgerActivityFocus): void {
  sessionStorage.setItem(LEDGER_FOCUS_KEY, JSON.stringify(focus));
}

export function consumeLedgerFocus(): LedgerActivityFocus | null {
  const raw = sessionStorage.getItem(LEDGER_FOCUS_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(LEDGER_FOCUS_KEY);
  try {
    const parsed = JSON.parse(raw) as LedgerActivityFocus;
    return parsed?.kind ? parsed : null;
  } catch {
    return null;
  }
}

export function openAccountingWithFocus(focus: LedgerActivityFocus): void {
  stashLedgerFocus(focus);
  window.location.assign('/admin/finance/accounting');
}
