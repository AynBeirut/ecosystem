import { isCountedSaleStatus, isDateInRange, normalizeDateString, resolveOrderItemProductKey } from '@/lib/salesRules';

export type SaleLineItem = {
  productId?: string;
  composedProductId?: string;
  id?: string;
  name?: string;
  quantity?: number;
  price?: number;
};

export type SaleRow = {
  id: string;
  customerId?: string;
  date: string;
  customer: string;
  invoiceNumber?: string;
  total: number;
  amountPaid: number;
  items?: SaleLineItem[];
};

export type PurchaseLineItem = Record<string, unknown>;

export type PurchaseRow = {
  id: string;
  supplierId?: string;
  date: string;
  supplier: string;
  amount: number;
  invoiceNumber?: string;
  items: PurchaseLineItem[];
};

export type ProductCatalogRow = {
  id: string;
  name: string;
  category?: string;
  localId?: string;
};

export type SalesByCustomerRow = {
  customer: string;
  customerId?: string;
  invoiceCount: number;
  totalInvoiced: number;
  totalPaid: number;
  balance: number;
};

export type SalesByProductRow = {
  productId: string;
  productName: string;
  category: string;
  quantitySold: number;
  revenue: number;
  discount: number;
};

export type PurchasesBySupplierRow = {
  supplier: string;
  supplierId?: string;
  documentCount: number;
  totalAmount: number;
};

export type PurchasesByProductRow = {
  productKey: string;
  productName: string;
  quantity: number;
  totalCost: number;
  purchaseCount: number;
};

export type StockMovementRow = {
  date: string;
  type: 'sale_out' | 'purchase_in';
  ref: string;
  party: string;
  productName: string;
  quantity: number;
  amount: number;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function purchaseItemName(item: PurchaseLineItem): string {
  return String(item.materialName || item.name || item.productName || 'Unknown item');
}

function purchaseItemQty(item: PurchaseLineItem): number {
  return Number(item.receivedQuantity ?? item.quantity ?? 0) || 0;
}

function purchaseItemCost(item: PurchaseLineItem): number {
  const qty = purchaseItemQty(item);
  const subtotal = Number(item.subtotal ?? 0);
  if (subtotal > 0) return round2(subtotal);
  const unit = Number(item.unitCost ?? item.unitPrice ?? 0);
  return round2(unit * qty);
}

function productKeyFromCatalog(product: ProductCatalogRow): Map<string, string> {
  const map = new Map<string, string>();
  map.set(product.id, product.id);
  if (product.localId) {
    map.set(product.localId, product.id);
  }
  return map;
}

export function filterSalesByPeriod(sales: SaleRow[], startDate: string, endDate: string): SaleRow[] {
  return sales.filter((sale) => isDateInRange(sale.date, startDate, endDate));
}

export function filterPurchasesByPeriod(
  purchases: PurchaseRow[],
  startDate: string,
  endDate: string,
): PurchaseRow[] {
  return purchases.filter((purchase) => isDateInRange(purchase.date, startDate, endDate));
}

export function aggregateSalesByCustomer(sales: SaleRow[]): SalesByCustomerRow[] {
  const map = new Map<string, SalesByCustomerRow>();
  for (const sale of sales) {
    const key = sale.customer || 'Unknown';
    const row = map.get(key) || {
      customer: key,
      customerId: sale.customerId,
      invoiceCount: 0,
      totalInvoiced: 0,
      totalPaid: 0,
      balance: 0,
    };
    row.invoiceCount += 1;
    row.totalInvoiced = round2(row.totalInvoiced + (sale.total || 0));
    row.totalPaid = round2(row.totalPaid + (sale.amountPaid || 0));
    row.balance = round2(row.totalInvoiced - row.totalPaid);
    if (!row.customerId && sale.customerId) row.customerId = sale.customerId;
    map.set(key, row);
  }
  return Array.from(map.values()).sort((a, b) => b.totalInvoiced - a.totalInvoiced);
}

export function aggregateSalesByProduct(
  sales: SaleRow[],
  catalog: ProductCatalogRow[],
): SalesByProductRow[] {
  const canonical = new Map<string, string>();
  const names = new Map<string, { name: string; category: string }>();
  for (const product of catalog) {
    names.set(product.id, { name: product.name, category: product.category || 'Uncategorized' });
    for (const [alias, id] of productKeyFromCatalog(product)) {
      canonical.set(alias, id);
    }
  }

  const map = new Map<string, SalesByProductRow>();
  for (const sale of sales) {
    const items = sale.items || [];
    const orderSubtotal = sale.total || items.reduce((sum, item) => sum + (item.quantity || 0) * (item.price || 0), 0);
    const orderDiscount = Math.max(0, orderSubtotal - (sale.total || 0));

    for (const item of items) {
      const rawKey = resolveOrderItemProductKey(item);
      const productId = canonical.get(rawKey) || rawKey || 'unknown';
      const meta = names.get(productId);
      const productName = item.name || meta?.name || rawKey || 'Unknown product';
      const category = meta?.category || 'Uncategorized';
      const qty = Number(item.quantity || 0);
      const price = Number(item.price || 0);
      const itemSubtotal = qty * price;
      const itemDiscount = orderSubtotal > 0 ? (itemSubtotal / orderSubtotal) * orderDiscount : 0;
      const revenue = round2(itemSubtotal - itemDiscount);

      const row = map.get(productId) || {
        productId,
        productName,
        category,
        quantitySold: 0,
        revenue: 0,
        discount: 0,
      };
      row.quantitySold += qty;
      row.revenue = round2(row.revenue + revenue);
      row.discount = round2(row.discount + itemDiscount);
      map.set(productId, row);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
}

export function aggregatePurchasesBySupplier(purchases: PurchaseRow[]): PurchasesBySupplierRow[] {
  const map = new Map<string, PurchasesBySupplierRow>();
  for (const purchase of purchases) {
    const key = purchase.supplier || 'Unknown';
    const row = map.get(key) || {
      supplier: key,
      supplierId: purchase.supplierId,
      documentCount: 0,
      totalAmount: 0,
    };
    row.documentCount += 1;
    row.totalAmount = round2(row.totalAmount + (purchase.amount || 0));
    if (!row.supplierId && purchase.supplierId) row.supplierId = purchase.supplierId;
    map.set(key, row);
  }
  return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
}

export function aggregatePurchasesByProduct(purchases: PurchaseRow[]): PurchasesByProductRow[] {
  const map = new Map<string, PurchasesByProductRow>();
  for (const purchase of purchases) {
    const items = Array.isArray(purchase.items) ? purchase.items : [];
    const seenInPurchase = new Set<string>();
    for (const item of items) {
      const productName = purchaseItemName(item);
      const productKey = String(item.productId || item.rawMaterialId || productName);
      const qty = purchaseItemQty(item);
      const cost = purchaseItemCost(item);
      const row = map.get(productKey) || {
        productKey,
        productName,
        quantity: 0,
        totalCost: 0,
        purchaseCount: 0,
      };
      row.quantity = round2(row.quantity + qty);
      row.totalCost = round2(row.totalCost + cost);
      if (!seenInPurchase.has(productKey)) {
        row.purchaseCount += 1;
        seenInPurchase.add(productKey);
      }
      map.set(productKey, row);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.totalCost - a.totalCost);
}

export function buildStockMovements(
  sales: SaleRow[],
  purchases: PurchaseRow[],
  startDate: string,
  endDate: string,
): StockMovementRow[] {
  const rows: StockMovementRow[] = [];

  for (const sale of filterSalesByPeriod(sales, startDate, endDate)) {
    for (const item of sale.items || []) {
      const qty = Number(item.quantity || 0);
      if (qty <= 0) continue;
      rows.push({
        date: normalizeDateString(sale.date),
        type: 'sale_out',
        ref: sale.invoiceNumber || sale.id,
        party: sale.customer,
        productName: item.name || resolveOrderItemProductKey(item) || 'Unknown',
        quantity: -qty,
        amount: round2(qty * Number(item.price || 0)),
      });
    }
  }

  for (const purchase of filterPurchasesByPeriod(purchases, startDate, endDate)) {
    for (const item of purchase.items || []) {
      const qty = purchaseItemQty(item);
      if (qty <= 0) continue;
      rows.push({
        date: normalizeDateString(purchase.date),
        type: 'purchase_in',
        ref: purchase.invoiceNumber || purchase.id,
        party: purchase.supplier,
        productName: purchaseItemName(item),
        quantity: qty,
        amount: purchaseItemCost(item),
      });
    }
  }

  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.ref.localeCompare(b.ref));
}

export function mapOrderToSaleRow(orderId: string, order: Record<string, unknown>): SaleRow | null {
  if (!isCountedSaleStatus(String(order.status || ''))) return null;
  const date =
    normalizeDateString(order.date as string) ||
    normalizeDateString(order.createdAt as string) ||
    normalizeDateString(order.deliveredAt as string) ||
    '';
  const total = Number(order.total ?? 0);
  const amountPaid = Number(order.amountPaid ?? order.paid ?? 0);
  return {
    id: orderId,
    customerId: order.customerId ? String(order.customerId) : order.userId ? String(order.userId) : undefined,
    date,
    customer: String(order.customerName || order.userName || order.customer || 'Walk-in'),
    invoiceNumber: order.invoiceNumber ? String(order.invoiceNumber) : undefined,
    total,
    amountPaid: order.paymentStatus === 'paid' ? Math.max(total, amountPaid) : amountPaid,
    items: Array.isArray(order.items) ? (order.items as SaleLineItem[]) : [],
  };
}

export function mapPurchaseToRow(
  purchaseId: string,
  purchase: Record<string, unknown>,
  supplierName: string,
): PurchaseRow {
  let dateStr =
    normalizeDateString(purchase.date as string) ||
    normalizeDateString(purchase.createdAt as string) ||
    normalizeDateString(purchase.receivedDate as string) ||
    '';
  const amount = Number(purchase.totalCost ?? purchase.totalAmount ?? purchase.total ?? 0);
  return {
    id: purchaseId,
    supplierId: purchase.supplierId ? String(purchase.supplierId) : undefined,
    date: dateStr,
    supplier: supplierName,
    amount,
    invoiceNumber: purchase.invoiceNumber
      ? String(purchase.invoiceNumber)
      : purchase.purchaseOrderNumber
        ? String(purchase.purchaseOrderNumber)
        : purchase.poNumber
          ? String(purchase.poNumber)
          : undefined,
    items: (purchase.items || purchase.materials || []) as PurchaseLineItem[],
  };
}
