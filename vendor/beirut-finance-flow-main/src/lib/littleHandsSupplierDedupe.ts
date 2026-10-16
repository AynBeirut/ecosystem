import type { Supplier } from '@/types/inventory';
import { stripCashBookLineFromVendorName } from '@/lib/vendorDisplayName';

export function littleHandsSupplierListKey(name: string): string {
  return stripCashBookLineFromVendorName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function supplierPickScore(s: Supplier): number {
  let score = 0;
  if (s.isSourceOfTruth) score += 10_000;
  if (s.id.startsWith('pos-')) score += 1_000;
  if (s.id === 'lh-sup-406c44032aa379de') score += 500;
  return score;
}

export function dedupeLittleHandsSuppliersByDisplayName(suppliers: Supplier[]): Supplier[] {
  const groups = new Map<string, Supplier[]>();
  for (const s of suppliers) {
    const key = littleHandsSupplierListKey(s.name || '');
    if (!key) continue;
    const bucket = groups.get(key) ?? [];
    bucket.push(s);
    groups.set(key, bucket);
  }

  const out: Supplier[] = [];
  for (const bucket of groups.values()) {
    if (bucket.length === 1) {
      out.push(bucket[0]);
      continue;
    }
    const winner = [...bucket].sort((a, b) => {
      const scoreDelta = supplierPickScore(b) - supplierPickScore(a);
      if (scoreDelta !== 0) return scoreDelta;
      return a.id.localeCompare(b.id);
    })[0];
    out.push({
      ...winner,
      name: stripCashBookLineFromVendorName(winner.name || ''),
    });
  }

  return out.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}
