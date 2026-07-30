import {
  collection,
  doc,
  getDocs,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { getFinanceDb } from '@/integrations/firebase/client';
import { sanitizeForFirestore } from '@/lib/firestore/storeCollection';
import type { FixedAsset, FixedAssetStatus } from '@/types/generalLedger';

const nowIso = () => new Date().toISOString();

function assetsCol(storeId: string) {
  return collection(getFinanceDb(), 'stores', storeId, 'fixedAssets');
}

export async function loadFixedAssets(storeId: string): Promise<FixedAsset[]> {
  const snap = await getDocs(assetsCol(storeId));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<FixedAsset, 'id'>) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type CreateFixedAssetInput = {
  name: string;
  inServiceDate: string;
  cost: number;
  salvageValue?: number;
  usefulLifeMonths: number;
  assetAccountCode?: string;
  accumDeprAccountCode?: string;
  expenseAccountCode?: string;
  currency?: string;
  notes?: string;
};

export async function createFixedAsset(storeId: string, input: CreateFixedAssetInput): Promise<FixedAsset> {
  const id = `FA-${Date.now()}`;
  const now = nowIso();
  const asset: FixedAsset = sanitizeForFirestore({
    id,
    storeId,
    name: input.name.trim(),
    inServiceDate: input.inServiceDate.slice(0, 10),
    cost: input.cost,
    salvageValue: input.salvageValue ?? 0,
    usefulLifeMonths: Math.max(1, Math.floor(input.usefulLifeMonths)),
    assetAccountCode: input.assetAccountCode || '155',
    accumDeprAccountCode: input.accumDeprAccountCode || '156',
    expenseAccountCode: input.expenseAccountCode || '710',
    accumulatedDepreciation: 0,
    status: 'active' as FixedAssetStatus,
    currency: input.currency || 'USD',
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
  }) as FixedAsset;

  await setDoc(doc(assetsCol(storeId), id), asset);
  return asset;
}

export async function applyDepreciationToAssets(
  storeId: string,
  updates: Array<{ assetId: string; amount: number; newAccumulated: number; newStatus: FixedAssetStatus }>,
): Promise<void> {
  const batch = writeBatch(getFinanceDb());
  const now = nowIso();
  for (const u of updates) {
    batch.set(
      doc(assetsCol(storeId), u.assetId),
      sanitizeForFirestore({
        accumulatedDepreciation: u.newAccumulated,
        status: u.newStatus,
        updatedAt: now,
      }),
      { merge: true },
    );
  }
  await batch.commit();
}

export async function setLedgerAccountsActive(
  storeId: string,
  codes: string[],
): Promise<void> {
  const snap = await getDocs(collection(getFinanceDb(), 'stores', storeId, 'ledgerAccounts'));
  const batch = writeBatch(getFinanceDb());
  const now = nowIso();
  const codeSet = new Set(codes);
  for (const d of snap.docs) {
    const data = d.data();
    if (!codeSet.has(String(data.code))) continue;
    if (data.isActive === true) continue;
    batch.set(doc(getFinanceDb(), 'stores', storeId, 'ledgerAccounts', d.id), { isActive: true, updatedAt: now }, { merge: true });
  }
  await batch.commit();
}
