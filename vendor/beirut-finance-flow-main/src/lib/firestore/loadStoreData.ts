import { collection, getDocs, query, where } from 'firebase/firestore';
import { getFinanceDb } from '@/integrations/firebase/client';
import { FINANCE_COLLECTIONS } from './paths';
import {
  mapFsClient,
  mapFsSupplier,
  mapFsProduct,
  mapFsInvoice,
  mapFsEstimate,
  mapFsPaymentOrder,
  mapFsReceipt,
  mapFsPayment,
  mapFsExpense,
  mapFsPlatformPurchase,
} from './mappers';
import {
  buildFinishedGoodsCostMap,
  overlayPlatformCostsOnProducts,
} from '@/lib/grabio/platformUnitCost';
import type {
  Client,
  Supplier,
  Product,
  Invoice,
  Estimate,
  PurchaseOrder,
  PaymentOrder,
  Receipt,
  Payment,
  Expense,
} from '@/context/AppContext';

export type LoadedStoreData = {
  clients: Client[];
  suppliers: Supplier[];
  products: Product[];
  invoices: Invoice[];
  estimates: Estimate[];
  purchaseOrders: PurchaseOrder[];
  paymentOrders: PaymentOrder[];
  receipts: Receipt[];
  payments: Payment[];
  expenses: Expense[];
};

async function loadStoreSubcollection<T>(
  storeId: string,
  sub: keyof typeof FINANCE_COLLECTIONS,
  mapper: (id: string, data: Record<string, unknown>) => T,
): Promise<T[]> {
  const snap = await getDocs(collection(getFinanceDb(), 'stores', storeId, FINANCE_COLLECTIONS[sub]));
  return snap.docs.map((d) => mapper(d.id, d.data() as Record<string, unknown>));
}

export async function loadStoreData(storeId: string): Promise<LoadedStoreData> {
  // Canonical data migration runs server-side: scripts/migrateCanonicalFinanceData.cjs
  // (admin SDK). Do not migrate on client load — it blocks UI and can fail rules on writes.

  const [
    customersSnap,
    productsSnap,
    finishedGoodsSnap,
    suppliersSnap,
    purchasesSnap,
    invoices,
    estimates,
    receipts,
    payments,
    expenses,
    paymentOrders,
  ] = await Promise.all([
    getDocs(query(collection(getFinanceDb(), 'customers'), where('storeId', '==', storeId))),
    getDocs(query(collection(getFinanceDb(), 'products'), where('storeId', '==', storeId))),
    getDocs(query(collection(getFinanceDb(), 'finishedGoodsInventory'), where('storeId', '==', storeId))),
    getDocs(query(collection(getFinanceDb(), 'suppliers'), where('storeId', '==', storeId))),
    getDocs(query(collection(getFinanceDb(), 'purchases'), where('storeId', '==', storeId))),
    loadStoreSubcollection(storeId, 'invoices', mapFsInvoice),
    loadStoreSubcollection(storeId, 'estimates', mapFsEstimate),
    loadStoreSubcollection(storeId, 'receipts', mapFsReceipt),
    loadStoreSubcollection(storeId, 'payments', mapFsPayment),
    loadStoreSubcollection(storeId, 'expenses', mapFsExpense),
    loadStoreSubcollection(storeId, 'paymentOrders', mapFsPaymentOrder),
  ]);

  const clients = customersSnap.docs.map((d) => mapFsClient(d.id, d.data() as Record<string, unknown>));
  const fgCostMap = buildFinishedGoodsCostMap(
    finishedGoodsSnap.docs.map((d) => ({ data: d.data() as Record<string, unknown> })),
  );
  const products = overlayPlatformCostsOnProducts(
    productsSnap.docs.map((d) => mapFsProduct(d.id, d.data() as Record<string, unknown>)),
    fgCostMap,
  );
  const suppliers = suppliersSnap.docs.map((d) => mapFsSupplier(d.id, d.data() as Record<string, unknown>));
  const purchaseOrders = purchasesSnap.docs.map((d) =>
    mapFsPlatformPurchase(d.id, d.data() as Record<string, unknown>),
  );

  return {
    clients,
    suppliers,
    products,
    invoices,
    estimates,
    purchaseOrders,
    paymentOrders,
    receipts,
    payments,
    expenses,
  };
}
