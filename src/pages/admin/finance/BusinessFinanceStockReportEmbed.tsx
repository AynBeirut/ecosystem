import React, { Suspense, lazy } from 'react';
import AdminEmbedLoader from '@/components/admin/AdminEmbedLoader';
import type { StockReportTab } from '@/pages/admin/finance/businessFinanceTabs';

const StockSalesReport = lazy(() => import('@/components/admin/StockSalesReport'));
const StockPurchasesReport = lazy(() => import('@/components/admin/StockPurchasesReport'));
const StockMovementReport = lazy(() => import('@/components/admin/StockMovementReport'));
const AdminProducts = lazy(() => import('@/pages/admin/AdminProducts'));

type Props = {
  tab: StockReportTab;
};

export default function BusinessFinanceStockReportEmbed({ tab }: Props) {
  const fallback = <AdminEmbedLoader label="Loading report…" compact />;

  if (tab === 'sales') {
    return (
      <Suspense fallback={fallback}>
        <StockSalesReport />
      </Suspense>
    );
  }

  if (tab === 'purchases') {
    return (
      <Suspense fallback={fallback}>
        <StockPurchasesReport />
      </Suspense>
    );
  }

  if (tab === 'inventory') {
    return (
      <Suspense fallback={fallback}>
        <StockMovementReport />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={fallback}>
      <AdminProducts embedded />
    </Suspense>
  );
}
