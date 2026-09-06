/** Accountant-friendly account picker search — code prefix first, not substring inside PCG labels. */

export type AccountSearchFields = {
  code: string;
  displayCode?: string;
  name: string;
  nameAr?: string;
};

function norm(value: string): string {
  return String(value || '').trim().toLowerCase();
}

export function accountSearchScore(query: string, fields: AccountSearchFields): number {
  const q = norm(query);
  if (!q) return 0;

  const codes = [fields.code, fields.displayCode]
    .map((code) => norm(code))
    .filter(Boolean);
  const names = [fields.name, fields.nameAr]
    .map((name) => norm(name))
    .filter(Boolean);

  if (codes.some((code) => code === q)) return 10_000;

  const prefixCodes = codes.filter((code) => code.startsWith(q));
  if (prefixCodes.length) {
    const best = prefixCodes.sort((a, b) => a.length - b.length || a.localeCompare(b, undefined, { numeric: true }))[0];
    return 9_000 - best.length;
  }

  if (names.some((name) => name.startsWith(q))) return 5_000;
  if (names.some((name) => name.includes(q))) return 1_000;

  return -1;
}

export function compareAccountCodes(a: string, b: string): number {
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

export function compareLedgerAccountSortKeys(
  a: { code: string; displayCode?: string },
  b: { code: string; displayCode?: string },
  useDisplayCode = false,
): number {
  const left = useDisplayCode ? String(a.displayCode || a.code) : a.code;
  const right = useDisplayCode ? String(b.displayCode || b.code) : b.code;
  return compareAccountCodes(left, right);
}

export function filterAccountsByQuery<T>(
  items: T[],
  query: string,
  getFields: (item: T) => AccountSearchFields,
): T[] {
  const q = query.trim();
  if (!q) return [...items].sort((a, b) => compareAccountCodes(getFields(a).code, getFields(b).code));

  return items
    .map((item) => ({ item, score: accountSearchScore(q, getFields(item)) }))
    .filter((row) => row.score >= 0)
    .sort((a, b) => {
      const byScore = b.score - a.score;
      if (byScore !== 0) return byScore;
      return compareAccountCodes(getFields(a.item).code, getFields(b.item).code);
    })
    .map((row) => row.item);
}
