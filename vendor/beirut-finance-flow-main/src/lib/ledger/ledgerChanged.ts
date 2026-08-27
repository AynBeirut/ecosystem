export const LEDGER_CHANGED_EVENT = 'grabio-ledger-changed';

export function notifyLedgerChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(LEDGER_CHANGED_EVENT));
}
