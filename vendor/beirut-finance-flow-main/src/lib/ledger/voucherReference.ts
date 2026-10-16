import type { JournalEntry, VoucherType } from '@/types/generalLedger';
import { peekNextVoucherSerial } from '@/lib/ledger/voucherSerial';

function metaRef(entry: JournalEntry): string {
  const meta = (entry.voucherMeta || {}) as Record<string, unknown>;
  const candidates = [
    meta.externalReference,
    meta.paymentRef,
    meta.receiptRef,
    meta.transferRef,
  ];
  for (const value of candidates) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
}

/** Max posted serial per voucher-date key from the register — for auto reference preview. */
export function deriveVoucherCountersFromEntries(
  entries: JournalEntry[],
): Record<string, number> {
  const counters: Record<string, number> = {};
  for (const entry of entries) {
    const serial = String(entry.voucherNumber || '').trim();
    const dated = /^([A-Z]+)-(\d{4}-\d{2}-\d{2})-(\d+)$/i.exec(serial);
    const legacy = dated ? null : /^([A-Z]+)-(\d{4})-(\d+)$/i.exec(serial);
    const match = dated || legacy;
    if (!match) continue;
    const key = `${match[1].toUpperCase()}-${match[2]}`;
    const n = Number.parseInt(match[3], 10);
    if (!Number.isFinite(n)) continue;
    counters[key] = Math.max(counters[key] || 0, n);
  }
  return counters;
}

/** Next voucher serial as external reference (matches posting allocation). */
export function peekAutoVoucherReference(
  voucherType: VoucherType,
  entryDate: string,
  entries: JournalEntry[],
): string {
  const counters = deriveVoucherCountersFromEntries(entries);
  return peekNextVoucherSerial(counters, voucherType, entryDate).voucherNumber;
}

/** Matrix REFFILE-style duplicate reference check (scoped per store). */
export function findEntryByVoucherReference(
  entries: JournalEntry[],
  reference: string,
  excludeEntryId?: string,
): JournalEntry | undefined {
  const needle = reference.trim().toLowerCase();
  if (!needle) return undefined;
  return entries.find((entry) => {
    if (excludeEntryId && entry.id === excludeEntryId) return false;
    if (entry.status !== 'posted' && entry.status !== 'draft') return false;
    return metaRef(entry).toLowerCase() === needle;
  });
}

export function assertUniqueVoucherReference(
  entries: JournalEntry[],
  reference: string,
  excludeEntryId?: string,
): void {
  const ref = reference.trim();
  if (!ref) return;
  const existing = findEntryByVoucherReference(entries, ref, excludeEntryId);
  if (existing) {
    const serial = String(existing.voucherNumber || '').trim();
    throw new Error(serial ? `Reference already used by voucher ${serial}.` : 'Reference already used by another voucher.');
  }
}
