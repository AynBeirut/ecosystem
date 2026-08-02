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
  loadFinanceReports,
  loadFinanceSettings,
  loadReceiptManager,
  preloadFinancePages,
} from '@/pages/admin/finance/financeEmbeddedLoaders';

/** Top-level Business Finance navigation (owner-friendly labels). */
const BUSINESS_FINANCE_NAV = [
  { to: '/admin/finance/quotations', label: 'Quotation', preload: loadEstimateManager },
  { to: '/admin/finance/accounting', label: 'Accounting', preload: loadAccounting },
  { to: '/admin/finance/recu', label: 'Reçu', preload: loadReceiptManager },
  { to: '/admin/finance/reports', label: 'Reports', preload: loadFinanceReports },
  { to: '/admin/finance/settings', label: 'Settings', preload: loadFinanceSettings },
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
        title="Business Finance"
        description="Quotations, receipts, accounting vouchers, reports, and document settings."
        eyebrow="Business Tools"
        backTo="/admin/dashboard"
        backLabel="Dashboard"
      >
        <nav className="flex flex-wrap gap-2 mb-2">
          {BUSINESS_FINANCE_NAV.map((item) => (
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
