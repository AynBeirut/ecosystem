export function normalizeCounterpartyName(value: string): string {
  return value.trim().toLowerCase();
}

export function findExactCounterpartyMatch<T extends { id: string; name: string }>(
  items: T[],
  name: string,
): T | null {
  const needle = normalizeCounterpartyName(name);
  if (!needle) return null;
  return items.find((item) => normalizeCounterpartyName(item.name) === needle) ?? null;
}
