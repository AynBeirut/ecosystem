import type { Purchase } from '@/types/inventory';

function itemHaystack(items: Purchase['items'] | undefined): string {
  if (!items?.length) return '';
  return items
    .map((i) => [i.materialName, i.sku, i.unit].filter(Boolean).join(' '))
    .join(' ');
}

/** Match supplier name, PO/CB ref, notes, or line item names. */
export function purchaseMatchesSearch(
  purchase: Purchase,
  resolvedSupplierName: string | undefined,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    purchase.supplierName,
    resolvedSupplierName,
    purchase.notes,
    purchase.purchaseOrderNumber,
    purchase.poNumber,
    purchase.invoiceNumber,
    purchase.importKey,
    itemHaystack(purchase.items),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}
