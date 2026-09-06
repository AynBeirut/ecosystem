export type VoucherEditIntent = {
  entryId: string;
  returnUrl?: string;
};

const STORAGE_KEY = 'grabio.voucherEditIntent';

export function stashVoucherEditIntent(intent: VoucherEditIntent): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(intent));
}

export function consumeVoucherEditIntent(): VoucherEditIntent | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(STORAGE_KEY);
  try {
    const parsed = JSON.parse(raw) as VoucherEditIntent;
    return parsed?.entryId ? parsed : null;
  } catch {
    return null;
  }
}
