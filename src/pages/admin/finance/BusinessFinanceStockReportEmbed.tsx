import React, { Suspense, lazy } from 'react';
import AdminEmbedLoader from '@/components/admin/AdminEmbedLoader';
import type { StockReportTab } from '@/pages/admin/finance/businessFinanceTabs';

const AdminAccountStatement = lazy(() => import('@/pages/admin/AdminAccountStatement'));
const AdminInventory = lazy(() => import('@/pages/admin/AdminInventory'));
const AdminProducts = lazy(() => import('@/pages/admin/AdminProducts'));

type Props = {
  tab: StockReportTab;
};

export default function BusinessFinanceStockReportEmbed({ tab }: Props) {
  const fallback = <AdminEmbedLoader label="Loading report…" compact />;

  if (tab === 'sales' || tab === 'purchases') {
    return (
      <Suspense fallback={fallback}>
        <AdminAccountStatement embedded fixedTab={tab} />
      </Suspense>
    );
  }

  if (tab === 'inventory') {
    return (
      <Suspense fallback={fallback}>
        <AdminInventory embedded />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={fallback}>
      <AdminProducts embedded />
    </Suspense>
  );
}
