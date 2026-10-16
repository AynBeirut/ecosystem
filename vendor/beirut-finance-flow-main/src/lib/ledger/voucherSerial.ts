import { doc, runTransaction, type DocumentReference, type Transaction } from 'firebase/firestore';
import { getFinanceDb } from '@/integrations/firebase/client';
import { normalizeDocumentDateKey } from '@/lib/documentSerial';
import type { VoucherType } from '@/types/generalLedger';

const nowIso = () => new Date().toISOString();

export function voucherSerialsRef(storeId: string) {
  return doc(getFinanceDb(), 'stores', storeId, 'ledgerMeta', 'voucherSerials');
}

/** Pure helper — next serial from meta snapshot (for tests). */
export function peekNextVoucherSerial(
  counters: Record<string, number> | undefined,
  voucherType: VoucherType,
  documentDateKey?: string,
): { next: number; voucherNumber: string; counterKey: string } {
  const dateKey = normalizeDocumentDateKey(documentDateKey);
  const counterKey = `${voucherType}-${dateKey}`;
  const next = (counters?.[counterKey] || 0) + 1;
  return {
    next,
    counterKey,
    voucherNumber: `${voucherType}-${dateKey}-${String(next).padStart(6, '0')}`,
  };
}

/** Increment counter inside an open Firestore transaction; returns allocated voucher number. */
export function allocateVoucherNumberInTransaction(
  tx: Transaction,
  serialRef: DocumentReference,
  serialSnap: { exists: () => boolean; data: () => Record<string, unknown> | undefined },
  storeId: string,
  voucherType: VoucherType,
  entryDate?: string | Date | null,
): string {
  const data = serialSnap.exists() ? serialSnap.data() : undefined;
  const counters = (data?.counters as Record<string, number>) || {};
  const dateKey = normalizeDocumentDateKey(entryDate);
  const { voucherNumber, counterKey, next } = peekNextVoucherSerial(counters, voucherType, dateKey);
  tx.set(
    serialRef,
    {
      storeId,
      counters: { ...counters, [counterKey]: next },
      updatedAt: nowIso(),
      ...(serialSnap.exists() ? {} : { createdAt: nowIso() }),
    },
    { merge: true },
  );
  return voucherNumber;
}

/** @deprecated Prefer allocation inside postJournalEntry transaction. Kept for tests/tools. */
export async function allocateVoucherNumber(
  storeId: string,
  voucherType: VoucherType,
  entryDate?: string | Date | null,
): Promise<string> {
  const ref = voucherSerialsRef(storeId);
  return runTransaction(getFinanceDb(), async (tx) => {
    const snap = await tx.get(ref);
    return allocateVoucherNumberInTransaction(tx, ref, snap, storeId, voucherType, entryDate);
  });
}

export function voucherEventForType(voucherType: VoucherType): string {
  switch (voucherType) {
    case 'PV':
      return 'payment-voucher';
    case 'RV':
      return 'receipt-voucher';
    case 'CV':
      return 'contra-voucher';
    case 'CRN':
      return 'credit-note';
    case 'DRN':
      return 'debit-note';
    default:
      return 'journal-voucher';
  }
}
