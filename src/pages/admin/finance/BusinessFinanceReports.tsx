import React from 'react';
import { Link } from 'react-router-dom';
import { adminSubnavLink } from '@/lib/adminStyles';
import {
  Scale,
  FileSpreadsheet,
  PieChart,
  Calculator,
  GitCompare,
  Layers,
  ShoppingCart,
  Package,
  TrendingUp,
  List,
} from 'lucide-react';

type ReportLink = {
  to: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  external?: boolean;
};

const ACCOUNTING_REPORTS: ReportLink[] = [
  { to: '/admin/finance/accounting?tab=trial-balance', label: 'Trial Balance', description: 'All accounts — debits must equal credits.', icon: Scale },
  { to: '/admin/finance/accounting?tab=balance-sheet', label: 'Balance Sheet', description: 'Assets, liabilities, and equity.', icon: FileSpreadsheet },
  { to: '/admin/finance/accounting?tab=profit-loss', label: 'Profit & Loss', description: 'Revenue, costs, and net result.', icon: PieChart },
  { to: '/admin/finance/accounting?tab=depreciation', label: 'Depreciation', description: 'Fixed assets and monthly runs.', icon: Calculator },
  { to: '/admin/finance/accounting?tab=reconciliation', label: 'Reconciliation', description: 'GL vs cash, bank, AR, and AP.', icon: GitCompare },
  { to: '/admin/finance/accounting?tab=general-ledger', label: 'General Ledger', description: 'Full ledger for any account.', icon: Layers },
];

const STOCK_REPORTS: ReportLink[] = [
  { to: '/admin/account-statement?tab=sales', label: 'List of Sales', description: 'Sales lines by customer and invoice.', icon: TrendingUp, external: true },
  { to: '/admin/account-statement?tab=purchases', label: 'List of Purchases', description: 'Supplier purchases and payments.', icon: ShoppingCart, external: true },
  { to: '/admin/inventory', label: 'Inventory & Stock Movement', description: 'Stock levels and movement overview.', icon: Package, external: true },
  { to: '/admin/products', label: 'Items & Price List', description: 'Catalog, quantities, and prices.', icon: List, external: true },
];

function ReportSection({ title, items }: { title: string; items: ReportLink[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;
          const className = `${adminSubnavLink(false)} flex flex-col items-start gap-1 h-auto py-3 text-left`;
          const body = (
            <>
              <span className="flex items-center gap-2 font-medium">
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </span>
              <span className="text-xs font-normal text-gray-600">{item.description}</span>
            </>
          );
          return item.external ? (
            <Link key={item.to} to={item.to} className={className}>
              {body}
            </Link>
          ) : (
            <Link key={item.to} to={item.to} className={className}>
              {body}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

const BusinessFinanceReports: React.FC = () => (
  <div className="space-y-8 rounded-lg border bg-white p-4 md:p-6">
    <div>
      <h1 className="text-xl font-bold text-gray-900">Reports</h1>
      <p className="text-sm text-gray-600 mt-1">
        Financial statements from the ledger and operational stock lists — pick a report to open.
      </p>
    </div>
    <ReportSection title="Accounting reports" items={ACCOUNTING_REPORTS} />
    <ReportSection title="Stock & operations" items={STOCK_REPORTS} />
  </div>
);

export default BusinessFinanceReports;
