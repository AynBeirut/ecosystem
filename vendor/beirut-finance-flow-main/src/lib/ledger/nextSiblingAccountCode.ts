/** Next free sibling code under a parent (numeric suffix, zero-padded). */

export function inferSiblingSuffixDigits(
  parentCode: string,
  existingCodes: string[],
  fallback = 2,
): number {
  const parent = String(parentCode || '').trim();
  if (!parent) return fallback;
  const extras = existingCodes
    .map((code) => String(code || '').trim())
    .filter((code) => code.startsWith(parent) && code.length > parent.length)
    .map((code) => code.length - parent.length);
  if (extras.includes(4)) return 4;
  if (extras.includes(2)) return 2;
  if (extras.length) return Math.min(...extras);
  return fallback;
}

export function nextSiblingAccountCode(
  parentCode: string,
  existingCodes: string[],
  suffixDigits?: number,
): string {
  const parent = String(parentCode || '').trim();
  if (!parent) throw new Error('Parent account code is required.');
  const used = new Set(existingCodes.map((code) => String(code || '').trim()).filter(Boolean));
  const digits = suffixDigits ?? inferSiblingSuffixDigits(parent, existingCodes, 2);
  const max = 10 ** digits - 1;
  let start = 1;
  for (const code of used) {
    if (!code.startsWith(parent) || code.length !== parent.length + digits) continue;
    const n = Number.parseInt(code.slice(parent.length), 10);
    if (Number.isFinite(n) && n >= start) start = n + 1;
  }
  for (let i = start; i <= max; i += 1) {
    const next = `${parent}${String(i).padStart(digits, '0')}`;
    if (!used.has(next)) return next;
  }
  throw new Error(`No free sibling code left under ${parent}.`);
}
