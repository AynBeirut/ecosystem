import type { LebanonVatReturnForm } from '@/lib/ledger/lebanonVatReturnForm';

export type VatFormDraftMeta = {
  companyName: string;
  taxId: string;
  miscExplain: string;
};

export type VatFormDraft = {
  form: LebanonVatReturnForm;
  meta: VatFormDraftMeta;
  updatedAt: string;
};

const STORAGE_PREFIX = 'grabio.lebanonVatForm.v1';

function draftKey(storeId: string, startDate: string, endDate: string): string {
  return `${STORAGE_PREFIX}.${storeId}.${startDate}_${endDate}`;
}

export function loadVatFormDraft(
  storeId: string,
  startDate: string,
  endDate: string,
): VatFormDraft | null {
  if (!storeId) return null;
  try {
    const raw = localStorage.getItem(draftKey(storeId, startDate, endDate));
    if (!raw) return null;
    return JSON.parse(raw) as VatFormDraft;
  } catch {
    return null;
  }
}

export function saveVatFormDraft(
  storeId: string,
  startDate: string,
  endDate: string,
  draft: Omit<VatFormDraft, 'updatedAt'>,
): void {
  if (!storeId) return;
  try {
    const payload: VatFormDraft = { ...draft, updatedAt: new Date().toISOString() };
    localStorage.setItem(draftKey(storeId, startDate, endDate), JSON.stringify(payload));
  } catch {
    /* ignore quota errors */
  }
}

export function clearVatFormDraft(storeId: string, startDate: string, endDate: string): void {
  if (!storeId) return;
  try {
    localStorage.removeItem(draftKey(storeId, startDate, endDate));
  } catch {
    /* ignore */
  }
}
