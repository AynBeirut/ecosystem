export type VoucherType = 'JV' | 'PV' | 'RV' | 'CV';

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

export function allocateVoucherNumberInTransaction(
  tx: FirebaseFirestore.Transaction,
  serialRef: FirebaseFirestore.DocumentReference,
  serialSnap: FirebaseFirestore.DocumentSnapshot,
  storeId: string,
  voucherType: VoucherType,
): string {
  const data = serialSnap.exists ? serialSnap.data() : undefined;
  const counters = (data?.counters as Record<string, number>) || {};
  const { voucherNumber, counterKey, next } = peekNextVoucherSerial(counters, voucherType);
  const now = new Date().toISOString();
  tx.set(
    serialRef,
    {
      storeId,
      counters: { ...counters, [counterKey]: next },
      updatedAt: now,
      ...(serialSnap.exists ? {} : { createdAt: now }),
    },
    { merge: true },
  );
  return voucherNumber;
}
