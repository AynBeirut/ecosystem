/** Numeric-aware sort for Grabio 3-digit and PCG client account codes. */
export function compareLedgerAccountCode(a: string, b: string): number {
  const na = Number(String(a).replace(/[^\d.-]/g, ""));
  const nb = Number(String(b).replace(/[^\d.-]/g, ""));
  const aFinite = Number.isFinite(na);
  const bFinite = Number.isFinite(nb);
  if (aFinite && bFinite && na !== nb) return na - nb;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

export function sortLedgerAccountsByCode<T extends { code: string }>(accounts: T[]): T[] {
  return [...accounts].sort((x, y) => compareLedgerAccountCode(x.code, y.code));
}
