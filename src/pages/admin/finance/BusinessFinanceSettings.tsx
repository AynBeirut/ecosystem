import React from 'react';
import BusinessFinanceHubLayout, { BusinessFinanceHubSection, type BusinessFinanceHubItem } from '@/pages/admin/finance/BusinessFinanceHubLayout';
import { Building2, Receipt, RefreshCw, Upload, Layers, CalendarRange, Repeat, FileText } from 'lucide-react';

const DOCUMENT_SETTINGS: BusinessFinanceHubItem[] = [
  {
    to: '/admin/profile',
    label: 'Company on documents',
    description: 'Logo, business name, address, and tax ID on invoices.',
    icon: Building2,
  },
];

const LEDGER_SETTINGS: BusinessFinanceHubItem[] = [
  {
    to: '/admin/finance/accounting?tab=coa',
    label: 'Chart of accounts',
    description: 'Account list and PCG client codes.',
    icon: Receipt,
  },
  {
    to: '/admin/finance/accounting?tab=opening',
    label: 'Opening balances',
    description: 'Starting balances when you go live.',
    icon: CalendarRange,
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
    description: 'Departments or branches on postings.',
    icon: Layers,
  },
  {
    to: '/admin/finance/accounting?tab=bulk-import',
    label: 'Bulk import',
    description: 'Import voucher rows from CSV.',
    icon: Upload,
  },
  {
    to: '/admin/finance/accounting?tab=recurring',
    label: 'Recurring vouchers',
    description: 'Templates that post on a schedule.',
    icon: Repeat,
  },
  {
    to: '/admin/finance/accounting?tab=checks',
    label: 'Check register',
    description: 'Issued and cleared checks.',
    icon: FileText,
  },
];

const BusinessFinanceSettings: React.FC = () => (
  <BusinessFinanceHubLayout
    title="Settings"
    description="Document branding, chart of accounts, and ledger setup tools."
  >
    <BusinessFinanceHubSection title="Documents" items={DOCUMENT_SETTINGS} />
    <BusinessFinanceHubSection title="Ledger setup" items={LEDGER_SETTINGS} />
  </BusinessFinanceHubLayout>
);

export default BusinessFinanceSettings;
