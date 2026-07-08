import type { FinanceCollectionKey } from './paths';

/** Supabase table name → Firestore location. */
export type TableLocation =
  | { kind: 'top'; collection: 'customers' | 'products' }
  | { kind: 'store'; key: FinanceCollectionKey }
  | { kind: 'noop' };

const TABLE_MAP: Record<string, TableLocation> = {
  clients: { kind: 'top', collection: 'customers' },
  products: { kind: 'top', collection: 'products' },
  invoices: { kind: 'store', key: 'invoices' },
  estimates: { kind: 'store', key: 'estimates' },
  receipts: { kind: 'store', key: 'receipts' },
  payments: { kind: 'store', key: 'payments' },
  expenses: { kind: 'store', key: 'expenses' },
  suppliers: { kind: 'store', key: 'suppliers' },
  purchase_orders: { kind: 'store', key: 'purchaseOrders' },
  inventory_movements: { kind: 'store', key: 'inventoryMovements' },
  invoice_items: { kind: 'noop' },
  estimate_items: { kind: 'noop' },
};

export function resolveTable(table: string): TableLocation | null {
  return TABLE_MAP[table] ?? null;
}
