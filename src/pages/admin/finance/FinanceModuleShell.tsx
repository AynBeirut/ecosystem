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
import {
  FileText,
  Landmark,
  Receipt,
  Settings2,
  BarChart3,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const BUSINESS_FINANCE_NAV: {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
  preload: (typeof FINANCE_PAGE_LOADERS)[number];
}[] = [
  {
    to: '/admin/finance/quotations',
    label: 'Quotation',
    description: 'Customer quotes before sale',
    icon: FileText,
    preload: loadEstimateManager,
  },
  {
    to: '/admin/finance/accounting',
    label: 'Accounting',
    description: 'Vouchers and ledger work',
    icon: Landmark,
    preload: loadAccounting,
  },
  {
    to: '/admin/finance/recu',
    label: 'Reçu',
    description: 'Money received',
    icon: Receipt,
    preload: loadReceiptManager,
  },
  {
    to: '/admin/finance/reports',
    label: 'Reports',
    description: 'TB, P&L, stock lists',
    icon: BarChart3,
    preload: loadFinanceReports,
  },
  {
    to: '/admin/finance/settings',
    label: 'Settings',
    description: 'COA, FX, branding',
    icon: Settings2,
    preload: loadFinanceSettings,
  },
];

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
        description="Pick a module below — each area has its own clear menu."
        eyebrow="Business Tools"
        backTo="/admin/dashboard"
        backLabel="Dashboard"
      >
        <nav className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5 mb-4">
          {BUSINESS_FINANCE_NAV.map((item) => {
            const Icon = item.icon;
            const active = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                preventScrollReset
                onMouseEnter={() => preloadFinancePages([item.preload])}
                className={`${adminSubnavLink(active)} flex flex-col items-start gap-0.5 h-auto py-3 text-left`}
                style={active ? { backgroundColor: accent, borderColor: accent, color: '#fff' } : undefined}
              >
                <span className="flex items-center gap-2 font-medium">
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </span>
                <span className={`text-xs font-normal ${active ? 'text-white/90' : 'text-gray-600'}`}>
                  {item.description}
                </span>
              </Link>
            );
          })}
        </nav>
        <div
          className="finance-embed-theme"
          style={{ '--finance-accent': accent } as React.CSSProperties}
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
