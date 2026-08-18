import type { Product } from '@/types/product';

type ProductSortable = Pick<Product, 'inStock' | 'stock' | 'productType'>;

/** True when a product can be ordered on the storefront. */
export function isProductInStock(product: ProductSortable): boolean {
  if (product.productType === 'service') {
    return product.inStock !== false;
  }
  if (product.inStock === false) return false;
  if (typeof product.stock === 'number') return product.stock > 0;
  return product.inStock !== false;
}

/** In-stock products first; preserves original order within each group. */
export function compareProductsInStockFirst(a: ProductSortable, b: ProductSortable): number {
  const aRank = isProductInStock(a) ? 0 : 1;
  const bRank = isProductInStock(b) ? 0 : 1;
  return aRank - bRank;
}

export function sortProductsInStockFirst<T extends ProductSortable>(products: T[]): T[] {
  return products
    .map((product, index) => ({ product, index }))
    .sort((a, b) => {
      const stockCmp = compareProductsInStockFirst(a.product, b.product);
      if (stockCmp !== 0) return stockCmp;
      return a.index - b.index;
    })
    .map(({ product }) => product);
}
