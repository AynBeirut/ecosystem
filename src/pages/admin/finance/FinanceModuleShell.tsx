import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import '@/embed/wireFinanceOnLoad';
import FinanceAppBridge from '@/embed/FinanceAppBridge';
import { wireFinanceFirebaseFromGrabio } from '@/embed/financeFirebaseBridge';
import { adminSubnavLink } from '@/lib/adminStyles';
import AdminPageShell from '@/components/admin/AdminPageShell';
import FinanceInvoiceModuleGate from '@/components/finance/FinanceInvoiceModuleGate';
import { useStoreEntitlements } from '@/hooks/useStoreEntitlements';
import FinanceTabHost from '@/pages/admin/finance/FinanceTabHost';
import {
  FINANCE_PAGE_LOADERS,
  loadAccounting,
  loadEstimateManager,
  loadExpenseManager,
  loadFinanceReports,
  loadInvoiceManager,
  loadReceiptManager,
  preloadFinancePages,
} from '@/pages/admin/finance/financeEmbeddedLoaders';

const FINANCE_IM_NAV = [
  { to: '/admin/finance/invoices', label: 'Invoices', preload: loadInvoiceManager },
  { to: '/admin/finance/estimates', label: 'Estimates', preload: loadEstimateManager },
  { to: '/admin/finance/receipts', label: 'Receipts', preload: loadReceiptManager },
  { to: '/admin/finance/expenses', label: 'Expenses', preload: loadExpenseManager },
  { to: '/admin/finance/reports', label: 'Reports', preload: loadFinanceReports },
  { to: '/admin/finance/accounting', label: 'Accounting', preload: loadAccounting },
] as const;

const FinanceModuleShell: React.FC = () => {
  const location = useLocation();
  const { profile } = useStoreEntitlements();
  const accent = profile?.templateColors?.primary ?? '#38B2AC';

  useEffect(() => {
    wireFinanceFirebaseFromGrabio();
    preloadFinancePages(FINANCE_PAGE_LOADERS);
  }, []);

  return (
    <FinanceInvoiceModuleGate>
      <AdminPageShell
        title="Invoice Manager"
        description="Invoices, estimates, receipts, expenses, and reports. Customers and catalog live under Sales & Stock."
        eyebrow="Business Tools"
        backTo="/admin/dashboard"
        backLabel="Dashboard"
      >
        <nav className="flex flex-wrap gap-2 mb-2">
          {FINANCE_IM_NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              preventScrollReset
              onMouseEnter={() => preloadFinancePages([item.preload])}
              className={adminSubnavLink(location.pathname.startsWith(item.to))}
              style={
                location.pathname.startsWith(item.to)
                  ? { backgroundColor: accent, borderColor: accent }
                  : undefined
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div
          className="finance-embed-theme"
          style={
            {
              '--finance-accent': accent,
            } as React.CSSProperties
          }
        >
          <FinanceAppBridge>
            <FinanceTabHost />
          </FinanceAppBridge>
        </div>
      </AdminPageShell>
    </FinanceInvoiceModuleGate>
  );
};

export default FinanceModuleShell;
