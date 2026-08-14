import { useLocation } from 'react-router-dom';
import AdminPageFallback from '@/components/admin/AdminPageFallback';
import FinanceModuleLoadingShell from '@/pages/admin/finance/FinanceModuleLoadingShell';

/** Suspense fallback inside AdminLayout — finance routes keep nav chrome while chunks load. */
export default function AdminOutletFallback() {
  const { pathname } = useLocation();

  if (pathname.startsWith('/admin/finance')) {
    return <FinanceModuleLoadingShell variant="finance" message="Loading module…" />;
  }
  if (pathname.startsWith('/admin/invoice-manager')) {
    return <FinanceModuleLoadingShell variant="invoice" message="Loading module…" />;
  }

  return <AdminPageFallback />;
}
