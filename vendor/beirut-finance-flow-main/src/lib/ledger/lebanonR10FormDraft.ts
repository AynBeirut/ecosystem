import type { LebanonR10Form } from '@/lib/ledger/lebanonR10Form';

export type R10FormDraftMeta = {
  companyName: string;
  taxId: string;
};

export type R10FormDraft = {
  form: LebanonR10Form;
  meta: R10FormDraftMeta;
  updatedAt: string;
};

const STORAGE_PREFIX = 'grabio.lebanonR10Form.v1';

function draftKey(storeId: string, startDate: string, endDate: string): string {
  return `${STORAGE_PREFIX}.${storeId}.${startDate}_${endDate}`;
}

export function loadR10FormDraft(storeId: string, startDate: string, endDate: string): R10FormDraft | null {
  if (!storeId) return null;
  try {
    const raw = localStorage.getItem(draftKey(storeId, startDate, endDate));
    if (!raw) return null;
    return JSON.parse(raw) as R10FormDraft;
  } catch {
    return null;
  }
}

export function saveR10FormDraft(
  storeId: string,
  startDate: string,
  endDate: string,
  draft: Omit<R10FormDraft, 'updatedAt'>,
): void {
  if (!storeId) return;
  try {
    const payload: R10FormDraft = { ...draft, updatedAt: new Date().toISOString() };
    localStorage.setItem(draftKey(storeId, startDate, endDate), JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function clearR10FormDraft(storeId: string, startDate: string, endDate: string): void {
  if (!storeId) return;
  try {
    localStorage.removeItem(draftKey(storeId, startDate, endDate));
  } catch {
    /* ignore */
  }
}
