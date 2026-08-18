import type {
  JournalEntry,
  JournalLine,
  LedgerAccount,
  PartyStatementReport,
  PartyStatementRow,
  VoucherLineSettlement,
} from '@/types/generalLedger';
import { isAccountsPayableCode, isAccountsReceivableCode } from '@/lib/ledger/accountControlCodes';
import { entriesForSupplier } from '@/lib/ledger/ledgerActivity';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type PurchasePartyLookup = Map<string, { supplierId?: string; supplierName: string; poRef: string }>;

export type PartySupplierFilter = {
  supplierId?: string;
  supplierName?: string;
};

type PurchaseOrderLike = {
  id: string;
  supplierId?: string;
  supplierName?: string;
  poNumber?: string;
  purchaseOrderNumber?: string;
};

type PaymentOrderLike = {
  id: string;
  supplierId?: string;
  supplierName?: string;
  purchaseOrderId?: string;
};

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

export function buildPurchasePartyLookup(
  purchaseOrders: PurchaseOrderLike[],
  paymentOrders: PaymentOrderLike[] = [],
): PurchasePartyLookup {
  const map: PurchasePartyLookup = new Map();
  for (const po of purchaseOrders) {
    const poRef = po.poNumber || po.purchaseOrderNumber || po.id;
    map.set(po.id, {
      supplierId: po.supplierId,
      supplierName: po.supplierName || '',
      poRef,
    });
  }
  for (const payment of paymentOrders) {
    if (!payment.id) continue;
    const linkedPo = payment.purchaseOrderId ? map.get(payment.purchaseOrderId) : undefined;
    map.set(payment.id, {
      supplierId: payment.supplierId || linkedPo?.supplierId,
      supplierName: payment.supplierName || linkedPo?.supplierName || '',
      poRef: linkedPo?.poRef || payment.purchaseOrderId || payment.id,
    });
  }
  return map;
}

function metaRecord(entry: JournalEntry): Record<string, unknown> | undefined {
  return entry.voucherMeta as Record<string, unknown> | undefined;
}

export function resolvePartyFromEntry(
  entry: JournalEntry,
  lookup: PurchasePartyLookup,
): { supplierId?: string; supplierName?: string; description: string; refNumber: string } {
  const meta = metaRecord(entry);
  let supplierId = typeof meta?.supplierId === 'string' ? meta.supplierId : undefined;
  let supplierName = typeof meta?.payee === 'string' ? meta.payee : undefined;
  let poRef = '';

  const sourceId = entry.sourceId;
  if (sourceId && lookup.has(sourceId)) {
    const linked = lookup.get(sourceId)!;
    supplierId = supplierId || linked.supplierId;
    supplierName = supplierName || linked.supplierName;
    poRef = linked.poRef;
  }

  const memo = (entry.memo || '').trim();
  const purchaseReceive = memo.match(/^Purchase\s+(\S+)\s*[—–-]\s*(.+)$/i);
  if (purchaseReceive) {
    const [, id, name] = purchaseReceive;
    if (name.trim()) supplierName = supplierName || name.trim();
    if (lookup.has(id)) {
      const linked = lookup.get(id)!;
      supplierId = supplierId || linked.supplierId;
      supplierName = supplierName || linked.supplierName;
      poRef = poRef || linked.poRef;
    } else if (!poRef) {
      poRef = id;
    }
  }

  const purchasePay = memo.match(/^Purchase payment(?:\s*[—–-]\s*)?(\S+)(?:\s*\(([^)]+)\))?/i);
  if (purchasePay) {
    const [, id, name] = purchasePay;
    if (name?.trim()) supplierName = supplierName || name.trim();
    if (lookup.has(id)) {
      const linked = lookup.get(id)!;
      supplierId = supplierId || linked.supplierId;
      supplierName = supplierName || linked.supplierName;
      poRef = poRef || linked.poRef;
    } else if (!poRef) {
      poRef = id;
    }
  }

  const refNumber = entry.voucherNumber || poRef || entry.id;
  const description = memo || (supplierName ? `${entry.voucherType || 'Entry'} — ${supplierName}` : entry.voucherType || '');

  return { supplierId, supplierName, description, refNumber };
}

function hasSupplierFilter(filter?: PartySupplierFilter): boolean {
  return Boolean(filter?.supplierId || filter?.supplierName?.trim());
}

export function entryMatchesSupplierFilter(
  entry: JournalEntry,
  filter: PartySupplierFilter,
  lookup: PurchasePartyLookup,
): boolean {
  if (!hasSupplierFilter(filter)) return true;

  const resolved = resolvePartyFromEntry(entry, lookup);
  if (filter.supplierId && resolved.supplierId === filter.supplierId) return true;

  const nameLower = (filter.supplierName || '').trim().toLowerCase();
  if (nameLower && resolved.supplierName?.toLowerCase().includes(nameLower)) return true;

  return entriesForSupplier([entry], filter.supplierId, filter.supplierName || '').length > 0;
}

export function buildPartyStatement(
  account: LedgerAccount,
  entries: JournalEntry[],
  lines: JournalLine[],
  settlements: VoucherLineSettlement[],
  options: {
    startDate: string;
    endDate: string;
    partyName: string;
    partyType: 'client' | 'supplier';
    supplierFilter?: PartySupplierFilter;
    purchaseLookup?: PurchasePartyLookup;
  },
): PartyStatementReport {
  const code = account.code;
  const isAr = isAccountsReceivableCode(code);
  const isAp = isAccountsPayableCode(code);
  if (!isAr && !isAp) {
    throw new Error('Party statement requires an AR (411x/110) or AP (401x/201) account.');
  }

  const lookup = options.purchaseLookup || new Map();
  const supplierFilter = options.supplierFilter;
  const filtered = hasSupplierFilter(supplierFilter);
  const start = options.startDate.slice(0, 10);
  const end = options.endDate.slice(0, 10);

  const postedBefore = entries
    .filter((e) => e.status === 'posted' && e.date.slice(0, 10) < start)
    .filter((e) => !filtered || !supplierFilter || entryMatchesSupplierFilter(e, supplierFilter, lookup));
  const postedInRange = entries
    .filter((e) => e.status === 'posted' && inRange(e.date, start, end))
    .filter((e) => !filtered || !supplierFilter || entryMatchesSupplierFilter(e, supplierFilter, lookup))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  let openingBalance = filtered ? 0 : round2(account.openingBalance || 0);
  for (const entry of postedBefore) {
    const entryLines = lines.filter((l) => l.entryId === entry.id && l.accountId === account.id);
    for (const line of entryLines) {
      const debit = round2(line.debit || 0);
      const credit = round2(line.credit || 0);
      if (isAr) openingBalance = round2(openingBalance + debit - credit);
      else openingBalance = round2(openingBalance + credit - debit);
    }
  }

  const matchMap = settlementMapForAccount(account.id, lines, settlements);
  const rows: PartyStatementRow[] = [];
  let running = openingBalance;

  for (const entry of postedInRange) {
    const resolved = resolvePartyFromEntry(entry, lookup);
    const entryLines = lines.filter((l) => l.entryId === entry.id && l.accountId === account.id);
    for (const line of entryLines) {
      const debit = round2(line.debit || 0);
      const credit = round2(line.credit || 0);
      if (isAr) running = round2(running + debit - credit);
      else running = round2(running + credit - debit);
      rows.push({
        date: entry.date.slice(0, 10),
        voucherType: entry.voucherType,
        refNumber: resolved.refNumber,
        entryId: entry.id,
        debit,
        credit,
        runningBalance: running,
        matchedDocumentId: matchMap.get(entry.id),
        memo: entry.memo,
        supplierName: resolved.supplierName,
        description: resolved.description,
      });
    }
  }

  return {
    partyName: options.partyName,
    partyType: options.partyType,
    startDate: start,
    endDate: end,
    openingBalance,
    closingBalance: running,
    rows,
  };
}

export function partyStatementToCsv(report: PartyStatementReport): string {
  const header = ['Date', 'Type', 'Ref', 'Supplier', 'Description', 'Debit', 'Credit', 'Balance', 'Matched Doc', 'Memo'];
  const body = report.rows.map((r) => [
    r.date,
    r.voucherType || '',
    r.refNumber || '',
    (r.supplierName || '').replace(/,/g, ' '),
    (r.description || '').replace(/,/g, ' '),
    String(r.debit || ''),
    String(r.credit || ''),
    String(r.runningBalance),
    r.matchedDocumentId || '',
    (r.memo || '').replace(/,/g, ' '),
  ]);
  return [header.join(','), ...body.map((row) => row.join(','))].join('\n');
}
