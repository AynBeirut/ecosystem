import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/integrations/firebase/client';
import { FINANCE_COLLECTIONS } from './paths';
import {
  mapFsClient,
  mapFsSupplier,
  mapFsProduct,
  mapFsInvoice,
  mapFsEstimate,
  mapFsPurchaseOrder,
  mapFsReceipt,
  mapFsPayment,
  mapFsExpense,
} from './mappers';
import type {
  Client,
  Supplier,
  Product,
  Invoice,
  Estimate,
  PurchaseOrder,
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
  receipts: Receipt[];
  payments: Payment[];
  expenses: Expense[];
};

async function loadStoreSubcollection<T>(
  storeId: string,
  sub: keyof typeof FINANCE_COLLECTIONS,
  mapper: (id: string, data: Record<string, unknown>) => T,
): Promise<T[]> {
  const snap = await getDocs(collection(db, 'stores', storeId, FINANCE_COLLECTIONS[sub]));
  return snap.docs.map((d) => mapper(d.id, d.data() as Record<string, unknown>));
}

export async function loadStoreData(storeId: string): Promise<LoadedStoreData> {
  const [customersSnap, productsSnap, invoices, estimates, receipts, payments, expenses, suppliers, purchaseOrders] =
    await Promise.all([
      getDocs(query(collection(db, 'customers'), where('storeId', '==', storeId))),
      getDocs(query(collection(db, 'products'), where('storeId', '==', storeId))),
      loadStoreSubcollection(storeId, 'invoices', mapFsInvoice),
      loadStoreSubcollection(storeId, 'estimates', mapFsEstimate),
      loadStoreSubcollection(storeId, 'receipts', mapFsReceipt),
      loadStoreSubcollection(storeId, 'payments', mapFsPayment),
      loadStoreSubcollection(storeId, 'expenses', mapFsExpense),
      loadStoreSubcollection(storeId, 'suppliers', mapFsSupplier),
      loadStoreSubcollection(storeId, 'purchaseOrders', mapFsPurchaseOrder),
    ]);

  const clients = customersSnap.docs.map((d) => mapFsClient(d.id, d.data() as Record<string, unknown>));
  const products = productsSnap.docs.map((d) => mapFsProduct(d.id, d.data() as Record<string, unknown>));

  return {
    clients,
    suppliers,
    products,
    invoices,
    estimates,
    purchaseOrders,
    receipts,
    payments,
    expenses,
  };
}
