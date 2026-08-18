import { describe, expect, it } from 'vitest';
import { compareProductsInStockFirst, isProductInStock, sortProductsInStockFirst } from '@/lib/productSort';
import type { Product } from '@/types/product';

const base = (overrides: Partial<Product>): Product =>
  ({
    id: 'p1',
    name: 'Test',
    description: '',
    price: 10,
    image: '',
    storeId: 's1',
    category: 'Cat',
    deliveryTime: '1d',
    inStock: true,
    ...overrides,
  }) as Product;

describe('productSort', () => {
  it('treats zero stock as out of stock for physical products', () => {
    expect(isProductInStock(base({ stock: 0 }))).toBe(false);
    expect(isProductInStock(base({ stock: 3 }))).toBe(true);
  });

  it('keeps services available when inStock is not explicitly false', () => {
    expect(isProductInStock(base({ productType: 'service', inStock: true }))).toBe(true);
    expect(isProductInStock(base({ productType: 'service', inStock: false }))).toBe(false);
  });

  it('sorts in-stock products before out-of-stock while preserving order', () => {
    const products = [
      base({ id: 'a', name: 'A', inStock: false, stock: 0 }),
      base({ id: 'b', name: 'B', stock: 2 }),
      base({ id: 'c', name: 'C', inStock: false, stock: 0 }),
      base({ id: 'd', name: 'D', stock: 1 }),
    ];

    expect(sortProductsInStockFirst(products).map((p) => p.id)).toEqual(['b', 'd', 'a', 'c']);
    expect(compareProductsInStockFirst(products[1], products[0])).toBeLessThan(0);
  });
});
