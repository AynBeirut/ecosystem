import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, getFirestore, query, where } from 'firebase/firestore';
import {
  mapOrderToSaleRow,
  mapPurchaseToRow,
  type ProductCatalogRow,
  type PurchaseRow,
  type SaleRow,
} from '@/lib/stockListReports';

export function useStockReportData(storeId: string | undefined) {
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [catalog, setCatalog] = useState<ProductCatalogRow[]>([]);

  useEffect(() => {
    if (!storeId) {
      setSales([]);
      setPurchases([]);
      setCatalog([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const db = getFirestore();

    (async () => {
      setLoading(true);
      try {
        const [ordersSnap, purchasesSnap, productsSnap, suppliersSnap] = await Promise.all([
          getDocs(query(collection(db, 'orders'), where('storeId', '==', storeId))),
          getDocs(query(collection(db, 'purchases'), where('storeId', '==', storeId))),
          getDocs(query(collection(db, 'products'), where('storeId', '==', storeId))),
          getDocs(query(collection(db, 'suppliers'), where('storeId', '==', storeId))),
        ]);

        const supplierNames = new Map<string, string>();
        suppliersSnap.forEach((doc) => {
          supplierNames.set(doc.id, String(doc.data().name || 'Unknown Supplier'));
        });

        const salesList: SaleRow[] = [];
        ordersSnap.forEach((doc) => {
          const row = mapOrderToSaleRow(doc.id, doc.data() as Record<string, unknown>);
          if (row) salesList.push(row);
        });

        const purchaseList: PurchaseRow[] = [];
        purchasesSnap.forEach((doc) => {
          const data = doc.data() as Record<string, unknown>;
          const supplierId = data.supplierId ? String(data.supplierId) : '';
          const supplierName =
            supplierNames.get(supplierId) ||
            String(data.supplierName || data.supplier_name || 'Unknown Supplier');
          purchaseList.push(mapPurchaseToRow(doc.id, data, supplierName));
        });

        const productList: ProductCatalogRow[] = [];
        productsSnap.forEach((doc) => {
          const data = doc.data();
          productList.push({
            id: doc.id,
            name: String(data.name || 'Unknown Product'),
            category: data.category ? String(data.category) : undefined,
            localId: data.localId ? String(data.localId) : undefined,
          });
        });

        if (!cancelled) {
          setSales(salesList);
          setPurchases(purchaseList);
          setCatalog(productList);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [storeId]);

  return useMemo(
    () => ({ loading, sales, purchases, catalog }),
    [loading, sales, purchases, catalog],
  );
}
