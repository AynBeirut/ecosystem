import { describe, expect, it } from 'vitest';
import {
  isSellableMenuProduct,
  resolveSellableProductType,
} from '@/lib/catalogProductCount';

describe('sellable menu catalog', () => {
  it('excludes raw material product types from menu', () => {
    expect(
      isSellableMenuProduct({ productType: 'raw_material', name: 'Flour', price: 5 }),
    ).toBe(false);
  });

  it('treats legacy POS services category as service', () => {
    expect(resolveSellableProductType({ category: 'services', name: 'Entrance' })).toBe('service');
    expect(isSellableMenuProduct({ category: 'services', name: 'Entrance', price: 20 })).toBe(true);
  });
});
