import type { Purchase } from '@/types/inventory';
import type { PurchaseOrder } from '../../vendor/beirut-finance-flow-main/src/context/AppContext';
import { mapFsPlatformPurchase } from '../../vendor/beirut-finance-flow-main/src/lib/firestore/mappers';

type PurchaseWithTax = Purchase & {
  taxType?: string;
  taxRate?: number;
  vat?: number;
  currency?: string;
};

/** Map platform `purchases` doc → finance PO for receive GL (status fulfilled, same as Finance load). */
export function purchaseOrderForGlReceive(purchase: PurchaseWithTax): PurchaseOrder {
  const receivedDate = purchase.receivedDate || new Date().toISOString();
  return mapFsPlatformPurchase(purchase.id, {
    ...purchase,
    status: 'received',
    orderDate: receivedDate,
    receivedDate,
  } as Record<string, unknown>);
}
