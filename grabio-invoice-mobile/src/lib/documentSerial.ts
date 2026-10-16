import firestore from '@react-native-firebase/firestore';

export type BusinessDocumentKind = 'INV' | 'EST';

const DEFAULT_PREFIX: Record<BusinessDocumentKind, string> = { INV: 'INV', EST: 'EST' };

function formatNumber(kind: BusinessDocumentKind, sequence: number): string {
  const prefix = DEFAULT_PREFIX[kind];
  return `${prefix}-${String(sequence).padStart(6, '0')}`;
}

export async function allocateMobileDocumentNumber(
  storeId: string,
  kind: BusinessDocumentKind,
): Promise<string> {
  const serialRef = firestore()
    .collection('stores')
    .doc(storeId)
    .collection('ledgerMeta')
    .doc('documentSerials');

  return firestore().runTransaction(async (tx) => {
    const snap = await tx.get(serialRef);
    const counters = (snap.data()?.counters as Record<string, number>) || {};
    const next = (counters[kind] || 0) + 1;
    const documentNumber = formatNumber(kind, next);
    tx.set(
      serialRef,
      {
        storeId,
        counters: { ...counters, [kind]: next },
        updatedAt: new Date().toISOString(),
        ...(snap.exists ? {} : { createdAt: new Date().toISOString() }),
      },
      { merge: true },
    );
    return documentNumber;
  });
}

export function isHumanDocumentNumber(value?: string | null): boolean {
  const s = String(value || '').trim();
  if (!s) return false;
  return /^(INV|EST)-\d{6,}$/i.test(s);
}
