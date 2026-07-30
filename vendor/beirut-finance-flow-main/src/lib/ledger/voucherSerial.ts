import { doc, runTransaction, type DocumentReference, type Transaction } from 'firebase/firestore';
import { getFinanceDb } from '@/integrations/firebase/client';
import type { VoucherType } from '@/types/generalLedger';

const nowIso = () => new Date().toISOString();

export function voucherSerialsRef(storeId: string) {
  return doc(getFinanceDb(), 'stores', storeId, 'ledgerMeta', 'voucherSerials');
}

/** Pure helper — next serial from meta snapshot (for tests). */
export function peekNextVoucherSerial(
  counters: Record<string, number> | undefined,
  voucherType: VoucherType,
  year = new Date().getFullYear(),
): { next: number; voucherNumber: string; counterKey: string } {
  const counterKey = `${voucherType}-${year}`;
  const next = (counters?.[counterKey] || 0) + 1;
  return {
    next,
    counterKey,
    voucherNumber: `${voucherType}-${year}-${String(next).padStart(5, '0')}`,
  };
}

/** Increment counter inside an open Firestore transaction; returns allocated voucher number. */
export function allocateVoucherNumberInTransaction(
  tx: Transaction,
  serialRef: DocumentReference,
  serialSnap: { exists: () => boolean; data: () => Record<string, unknown> | undefined },
  storeId: string,
  voucherType: VoucherType,
): string {
  const data = serialSnap.exists() ? serialSnap.data() : undefined;
  const counters = (data?.counters as Record<string, number>) || {};
  const { voucherNumber, counterKey, next } = peekNextVoucherSerial(counters, voucherType);
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
export async function allocateVoucherNumber(storeId: string, voucherType: VoucherType): Promise<string> {
  const ref = voucherSerialsRef(storeId);
  return runTransaction(getFinanceDb(), async (tx) => {
    const snap = await tx.get(ref);
    return allocateVoucherNumberInTransaction(tx, ref, snap, storeId, voucherType);
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
    default:
      return 'journal-voucher';
  }
}
