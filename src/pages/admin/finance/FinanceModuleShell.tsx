import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import AdminPageShell from '@/components/admin/AdminPageShell';
import FinanceInvoiceModuleGate from '@/components/finance/FinanceInvoiceModuleGate';
import { useStoreEntitlements } from '@/hooks/useStoreEntitlements';

const FINANCE_IM_NAV = [
  { to: '/admin/finance/invoices', label: 'Invoices' },
  { to: '/admin/finance/estimates', label: 'Estimates' },
  { to: '/admin/finance/receipts', label: 'Receipts' },
  { to: '/admin/finance/clients', label: 'Clients' },
  { to: '/admin/finance/products', label: 'Products' },
  { to: '/admin/finance/reports', label: 'Reports' },
] as const;

const FinanceModuleShell: React.FC = () => {
  const location = useLocation();
  const { profile } = useStoreEntitlements();
  const accent = profile?.templateColors?.primary ?? '#38B2AC';

  return (
    <FinanceInvoiceModuleGate>
      <AdminPageShell
        title="Invoice Manager"
        description="Invoices, estimates, receipts, clients, and reports."
        eyebrow="Business Tools"
        backTo="/admin/dashboard"
        backLabel="Dashboard"
      >
        <div
          className="finance-embed-theme"
          style={
            {
              '--finance-accent': accent,
            } as React.CSSProperties
          }
        >
          <nav className="flex flex-wrap gap-2 mb-6">
            {FINANCE_IM_NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border',
                  location.pathname.startsWith(item.to)
                    ? 'text-white border-transparent'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50',
                )}
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
          <Outlet />
        </div>
      </AdminPageShell>
    </FinanceInvoiceModuleGate>
  );
};

export default FinanceModuleShell;
