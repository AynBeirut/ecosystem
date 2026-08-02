import React from 'react';
import { Link } from 'react-router-dom';
import { adminSubnavLink } from '@/lib/adminStyles';
import { Building2, Receipt, RefreshCw, Upload, Layers } from 'lucide-react';

const SETTINGS_LINKS = [
  {
    to: '/admin/profile',
    label: 'Company on documents',
    description: 'Logo, business name, address, and tax ID on invoices.',
    icon: Building2,
  },
  {
    to: '/admin/finance/accounting?tab=fx-revaluation',
    label: 'Foreign exchange (FX)',
    description: 'Rates and revaluation.',
    icon: RefreshCw,
  },
  {
    to: '/admin/finance/accounting?tab=cost-centers',
    label: 'Cost centers',
    description: 'Track departments or branches on postings.',
    icon: Layers,
  },
  {
    to: '/admin/finance/accounting?tab=bulk-import',
    label: 'Bulk import',
    description: 'Import voucher rows from CSV.',
    icon: Upload,
  },
  {
    to: '/admin/finance/accounting?tab=coa',
    label: 'Chart of accounts',
    description: 'Account list and PCG client codes (accountants).',
    icon: Receipt,
  },
] as const;

const BusinessFinanceSettings: React.FC = () => (
  <div className="space-y-6 rounded-lg border bg-white p-4 md:p-6">
    <div>
      <h1 className="text-xl font-bold text-gray-900">Settings</h1>
      <p className="text-sm text-gray-600 mt-1">
        Document branding, tax ID, FX, cost centers, and import tools.
      </p>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      {SETTINGS_LINKS.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`${adminSubnavLink(false)} flex flex-col items-start gap-1 h-auto py-3 text-left`}
          >
            <span className="flex items-center gap-2 font-medium">
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </span>
            <span className="text-xs font-normal text-gray-600">{item.description}</span>
          </Link>
        );
      })}
    </div>
  </div>
);

export default BusinessFinanceSettings;
