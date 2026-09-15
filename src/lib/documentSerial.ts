/**
 * Per-store business document numbers — counter per document calendar date.
 * Format: PO-2026-09-12-001 (001 each date, then 002…).
 */
import { doc, getFirestore, runTransaction } from 'firebase/firestore';

export type BusinessDocumentKind = 'PO' | 'SO' | 'INV' | 'EST' | 'BILL';

const DEFAULT_PREFIX: Record<BusinessDocumentKind, string> = {
  PO: 'PO',
  SO: 'SO',
  INV: 'INV',
  EST: 'EST',
  BILL: 'BILL',
};

const DATE_BASED_PO = /^PO-\d{4}-\d{2}-\d{2}-\d{3,}$/i;
const CASH_BOOK_PO = /^CB-\d{4}-\d{2}-\d{2}-/i;

export function normalizeDocumentDateKey(input?: string | Date | null): string {
  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    return input.toISOString().slice(0, 10);
  }
  const s = String(input || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

export function peekNextDocumentSerial(
  counters: Record<string, number> | undefined,
  kind: BusinessDocumentKind,
  documentDateKey: string,
  prefixOverride?: string,
  seqPadding = 3,
): { next: number; documentNumber: string; counterKey: string } {
  const prefix = (prefixOverride || DEFAULT_PREFIX[kind] || kind).trim() || kind;
  const dateKey = normalizeDocumentDateKey(documentDateKey);
  const counterKey = `${kind}-${dateKey}`;
  const next = (counters?.[counterKey] || 0) + 1;
  return {
    next,
    counterKey,
    documentNumber: `${prefix}-${dateKey}-${String(next).padStart(seqPadding, '0')}`,
  };
}

export function isDateBasedPurchaseOrderNumber(value: string): boolean {
  const s = String(value || '').trim();
  return DATE_BASED_PO.test(s) || CASH_BOOK_PO.test(s);
}

export function isOpaqueBusinessRef(value: string): boolean {
  const s = String(value || '').trim();
  if (!s) return true;
  if (isDateBasedPurchaseOrderNumber(s)) return false;
  if (/^pos-[A-Za-z0-9_-]{8,}(?:-[A-Za-z0-9_-]+)?$/i.test(s)) return true;
  if (/^[A-Za-z0-9_-]{18,}$/.test(s) && !/^\d{1,12}$/.test(s)) return true;
  if (/^PO-pos-/i.test(s)) return true;
  if (/^PO-\d{4}-\d{5,}$/i.test(s)) return true;
  return false;
}

export function resolvePurchaseOrderNumber(fields: {
  poNumber?: string;
  purchaseOrderNumber?: string;
  invoiceNumber?: string;
}): string {
  for (const raw of [fields.poNumber, fields.purchaseOrderNumber, fields.invoiceNumber]) {
    const s = String(raw || '').trim();
    if (s && !isOpaqueBusinessRef(s) && isDateBasedPurchaseOrderNumber(s)) return s;
  }
  return '';
}

export async function allocateStoreDocumentNumber(
  storeId: string,
  kind: BusinessDocumentKind,
  documentDateKey: string,
  prefixOverride?: string,
): Promise<string> {
  const db = getFirestore();
  const serialRef = doc(db, 'stores', storeId, 'ledgerMeta', 'documentSerials');
  const dateKey = normalizeDocumentDateKey(documentDateKey);
  return runTransaction(db, async (tx) => {
    const serialSnap = await tx.get(serialRef);
    const data = serialSnap.exists() ? serialSnap.data() : undefined;
    const counters = (data?.counters as Record<string, number>) || {};
    const { documentNumber, counterKey, next } = peekNextDocumentSerial(
      counters,
      kind,
      dateKey,
      prefixOverride,
    );
    const now = new Date().toISOString();
    tx.set(
      serialRef,
      {
        storeId,
        counters: { ...counters, [counterKey]: next },
        updatedAt: now,
        ...(serialSnap.exists() ? {} : { createdAt: now }),
      },
      { merge: true },
    );
    return documentNumber;
  });
}

export async function allocatePurchaseOrderNumber(
  storeId: string,
  purchaseOrderPrefix?: string,
  documentDate?: string | Date | null,
): Promise<string> {
  const prefix = (purchaseOrderPrefix || 'PO').trim() || 'PO';
  const dateKey = normalizeDocumentDateKey(documentDate);
  return allocateStoreDocumentNumber(storeId, 'PO', dateKey, prefix);
}
