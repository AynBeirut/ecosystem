/* AUTO-SYNCED from vendor/beirut-finance-flow-main — DO NOT EDIT HERE. */
/**
 * User-visible ledger labels must never show Firebase/POS opaque ids.
 * Internal ids stay in sourceId / Firestore only.
 */

const POS_DOC_ID = /^pos-[A-Za-z0-9_-]+$/i;
const FIREBASE_UID_LIKE = /^[A-Za-z0-9_-]{18,}$/;
const STORE_SCOPED_ID = /^[A-Za-z0-9_-]{18,}-\d+$/;

export function isOpaqueInternalId(value: string): boolean {
  const s = String(value || '').trim();
  if (!s) return false;
  if (POS_DOC_ID.test(s)) return true;
  if (STORE_SCOPED_ID.test(s)) return true;
  if (/^\d{1,12}$/.test(s)) return false;
  if (FIREBASE_UID_LIKE.test(s)) return true;
  return false;
}

/** Hide Firebase / POS internal ids from user-visible labels (party, ref, etc.). */
export function sanitizeDisplayLabel(value: string): string {
  const s = String(value || '').trim();
  if (!s || isOpaqueInternalId(s)) return '';
  const cleaned = stripInternalIdTokens(s);
  if (!cleaned || isOpaqueInternalId(cleaned)) return '';
  return cleaned;
}

export function stripInternalIdTokens(text: string): string {
  return String(text || '')
    .replace(/\bpos-[A-Za-z0-9_-]{8,}(?:-[A-Za-z0-9_-]+)?\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s*[—–-]\s*[—–-]+\s*/g, ' — ')
    .replace(/^\s*[—–-]\s*/g, '')
    .replace(/\s*[—–-]\s*$/g, '')
    .trim();
}

/** Clean legacy memos that embedded internal ids at post time. */
export function sanitizeJournalMemoForDisplay(memo: string): string {
  let s = String(memo || '').trim();
  if (!s) return '';

  if (s.startsWith('(') && s.endsWith(')')) {
    s = s.slice(1, -1).trim();
  }

  for (let pass = 0; pass < 3; pass += 1) {
    const next = s.replace(
      /^(?:Expense|Invoice|Purchase|Order|Payroll payment|Cash collection deposit|COD collected|Delivery wallet settlement|Production batch|Reverse production(?:\s+\w+)?)\s+(\S+)\s*(?:[—–-]\s*)?/i,
      (_full, token) => (isOpaqueInternalId(token) ? '' : _full),
    );
    if (next === s) break;
    s = next;
  }

  s = stripInternalIdTokens(s);
  return s || String(memo || '').trim();
}

export function displayMemoForJournalEntry(entry: {
  memo?: string;
  voucherNumber?: string;
  sourceType?: string;
}): string {
  return sanitizeJournalMemoForDisplay(entry.memo || '') || journalEntryDisplayLabel(entry);
}

export function formatExpenseJournalMemo(input: {
  description?: string;
  name?: string;
  category?: string;
  vendor?: string;
  vendorName?: string;
  reference?: string;
}): string {
  const description = String(input.description || '').trim();
  const name = String(input.name || '').trim();
  const vendor = String(input.vendor || input.vendorName || '').trim();
  const category = String(input.category || '').trim();
  const reference = String(input.reference || '').trim();

  if (description) return description;
  const parts = [reference, vendor, name, category].map((part) => part.trim()).filter(Boolean);
  return parts.join(' — ') || 'Expense';
}

export function formatInvoiceJournalMemo(invoice: {
  invoiceNumber?: string;
  clientName?: string;
}): string {
  const num = String(invoice.invoiceNumber || '').trim();
  const client = String(invoice.clientName || '').trim();
  if (num && client) return `Invoice ${num} — ${client}`;
  if (client) return `Invoice — ${client}`;
  if (num) return `Invoice ${num}`;
  return 'Invoice';
}

export function formatPurchaseJournalMemo(purchase: {
  poNumber?: string;
  purchaseOrderNumber?: string;
  supplierName?: string;
}): string {
  const ref = String(purchase.poNumber || purchase.purchaseOrderNumber || '').trim();
  const supplier = String(purchase.supplierName || '').trim();
  if (ref && supplier) return `PO ${ref} — ${supplier}`;
  if (supplier) return `Purchase — ${supplier}`;
  if (ref) return `PO ${ref}`;
  return 'Purchase';
}

const WALK_IN_CLIENT_RE = /walk[- ]?in|cash\s*customer|anonymous|pos\s*customer|guest|counter\s*sale/i;

export function isWalkInClientLabel(clientId?: string, clientName?: string): boolean {
  if (String(clientId || '').trim()) return false;
  const name = String(clientName || '').trim();
  if (!name) return true;
  return WALK_IN_CLIENT_RE.test(name);
}

export function resolveOrderClientName(input: {
  clientId?: string;
  clientName?: string;
  customerId?: string;
  customerName?: string;
}): string {
  const id = String(input.clientId || input.customerId || '').trim();
  const name = String(input.clientName || input.customerName || '').trim();
  if (!name || isWalkInClientLabel(id, name)) return '';
  return name;
}

/** Extract client name from order sale memos (new + legacy). */
export function parseOrderMemoClientName(memo: string): string {
  const m = sanitizeJournalMemoForDisplay(memo);
  const withRef = m.match(/^Sale\s+(\S+)\s*[—–-]\s*(.+)$/i);
  if (withRef?.[2]) return withRef[2].trim();
  const bare = m.match(/^Sale\s*[—–-]\s*(.+)$/i);
  if (bare?.[1] && !/^POS-/i.test(bare[1]) && !/^INV/i.test(bare[1])) return bare[1].trim();
  return '';
}

export function formatOrderJournalMemo(order: {
  invoiceNumber?: string;
  clientName?: string;
  customerName?: string;
  clientId?: string;
  customerId?: string;
}): string {
  const inv = String(order.invoiceNumber || '').trim();
  const client = resolveOrderClientName(order);
  if (inv && client) return `Sale ${inv} — ${client}`;
  if (inv) return `Sale ${inv}`;
  if (client) return `Sale — ${client}`;
  return 'Sale';
}

export function journalEntryDisplayLabel(entry: {
  memo?: string;
  voucherNumber?: string;
  sourceType?: string;
}): string {
  if (entry.voucherNumber) return entry.voucherNumber;
  const memo = sanitizeJournalMemoForDisplay(entry.memo || '');
  if (memo) return memo;
  if (entry.sourceType === 'order') return 'Sales voucher';
  return 'Voucher';
}

export function journalEntryReferenceLabel(reference: string | undefined, fallback = '—'): string {
  const s = String(reference || '').trim();
  if (!s || isOpaqueInternalId(s)) return fallback;
  const cleaned = stripInternalIdTokens(s);
  return cleaned || fallback;
}
