import { collection, getDocs, type Firestore } from 'firebase/firestore';

export type OwnerPayable = {
  id: string;
  creditorName: string;
  amountUsd: number;
  reason?: string;
  program?: string;
  math?: string;
  updatedAt?: string;
};

export async function listOwnerPayables(db: Firestore, storeId: string): Promise<OwnerPayable[]> {
  const snap = await getDocs(collection(db, 'stores', storeId, 'ownerPayables'));
  return snap.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        creditorName: String(data.creditorName || data.name || d.id),
        amountUsd: Number(data.amountUsd ?? data.amount ?? 0),
        reason: data.reason ? String(data.reason) : undefined,
        program: data.program ? String(data.program) : undefined,
        math: data.math ? String(data.math) : undefined,
        updatedAt: data.updatedAt ? String(data.updatedAt) : undefined,
      };
    })
    .filter((row) => row.amountUsd > 0)
    .sort((a, b) => a.creditorName.localeCompare(b.creditorName));
}

export function summarizeOwnerPayables(rows: OwnerPayable[]) {
  const total = rows.reduce((sum, row) => sum + row.amountUsd, 0);
  return { count: rows.length, totalUsd: Math.round(total * 100) / 100 };
}
