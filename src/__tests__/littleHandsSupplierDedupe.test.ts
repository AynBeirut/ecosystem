import { describe, expect, it } from 'vitest';
import { dedupeLittleHandsSuppliersByDisplayName } from '@/lib/littleHandsSupplierDedupe';
import type { Supplier } from '@/types/inventory';

function sup(id: string, name: string, extra: Partial<Supplier> = {}): Supplier {
  return {
    id,
    name,
    storeId: '8WgfKtgaE8aAXdqFhIfweEo5WFq2',
    status: 'active',
    supplierCode: id,
    ...extra,
  } as Supplier;
}

describe('dedupeLittleHandsSuppliersByDisplayName', () => {
  it('keeps one row per stripped vendor title', () => {
    const rows = dedupeLittleHandsSuppliersByDisplayName([
      sup('lh-sup-a', 'Event Mega Store'),
      sup('lh-sup-b', 'Event Mega Store'),
      sup('lh-sup-c', 'Le Marchet Selectif ( Ice )'),
      sup('lh-sup-406c44032aa379de', 'Le  Marchet Selectif'),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.id).sort()).toEqual(['lh-sup-406c44032aa379de', 'lh-sup-a'].sort());
    expect(rows.find((r) => r.id === 'lh-sup-406c44032aa379de')?.name).toBe('Le Marchet Selectif');
  });
});
