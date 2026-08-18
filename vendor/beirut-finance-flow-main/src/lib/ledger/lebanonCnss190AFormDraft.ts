import type { LebanonCnss190AForm } from '@/lib/ledger/lebanonCnss190AForm';

export type Cnss190AFormDraftMeta = {
  companyName: string;
  companyNumber: string;
};

export type Cnss190AFormDraft = {
  form: LebanonCnss190AForm;
  meta: Cnss190AFormDraftMeta;
  updatedAt: string;
};

const STORAGE_PREFIX = 'grabio.lebanonCnss190A.v1';

function draftKey(storeId: string, startDate: string, endDate: string): string {
  return `${STORAGE_PREFIX}.${storeId}.${startDate}_${endDate}`;
}

export function loadCnss190AFormDraft(
  storeId: string,
  startDate: string,
  endDate: string,
): Cnss190AFormDraft | null {
  if (!storeId) return null;
  try {
    const raw = localStorage.getItem(draftKey(storeId, startDate, endDate));
    if (!raw) return null;
    return JSON.parse(raw) as Cnss190AFormDraft;
  } catch {
    return null;
  }
}

export function saveCnss190AFormDraft(
  storeId: string,
  startDate: string,
  endDate: string,
  draft: Omit<Cnss190AFormDraft, 'updatedAt'>,
): void {
  if (!storeId) return;
  try {
    const payload: Cnss190AFormDraft = { ...draft, updatedAt: new Date().toISOString() };
    localStorage.setItem(draftKey(storeId, startDate, endDate), JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function clearCnss190AFormDraft(storeId: string, startDate: string, endDate: string): void {
  if (!storeId) return;
  try {
    localStorage.removeItem(draftKey(storeId, startDate, endDate));
  } catch {
    /* ignore */
  }
}
