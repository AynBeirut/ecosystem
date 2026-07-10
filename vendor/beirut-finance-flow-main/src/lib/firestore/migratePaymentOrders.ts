import type { PaymentOrder } from '@/context/AppContext';
import { dbInsert } from '@/context/helpers/dbOps';

const migratedKey = (storeId: string) => `paymentOrders_migrated_${storeId}`;

function paymentOrderToRow(storeId: string, po: PaymentOrder): Record<string, unknown> {
  return {
    id: po.id,
    organization_id: storeId,
    supplier_id: po.supplierId || null,
    supplier_name: po.supplierName,
    amount: po.amount,
    currency: po.currency,
    status: po.status,
    payment_method: po.paymentMethod || 'bank',
    notes: po.notes || null,
    purchase_order_id: po.purchaseOrderId || null,
    date: po.date,
  };
}

/** One-time lift of legacy localStorage payment orders into Firestore for the active store. */
export async function migrateLocalPaymentOrders(
  storeId: string,
  existing: PaymentOrder[],
): Promise<PaymentOrder[]> {
  if (typeof localStorage === 'undefined') return existing;
  if (localStorage.getItem(migratedKey(storeId))) return existing;

  const raw = localStorage.getItem('paymentOrders');
  if (!raw) {
    localStorage.setItem(migratedKey(storeId), '1');
    return existing;
  }

  let legacy: PaymentOrder[] = [];
  try {
    const parsed = JSON.parse(raw);
    legacy = Array.isArray(parsed) ? parsed : [];
  } catch {
    localStorage.removeItem('paymentOrders');
    localStorage.setItem(migratedKey(storeId), '1');
    return existing;
  }

  const existingIds = new Set(existing.map((p) => p.id));
  const toMigrate = legacy.filter((p) => p?.id && !existingIds.has(p.id));

  for (const po of toMigrate) {
    await dbInsert('payment_orders', paymentOrderToRow(storeId, po), 'Context][PaymentOrder][migrate]');
  }

  localStorage.removeItem('paymentOrders');
  localStorage.setItem(migratedKey(storeId), '1');

  if (!toMigrate.length) return existing;
  return [...existing, ...toMigrate];
}
