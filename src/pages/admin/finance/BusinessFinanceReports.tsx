import React from 'react';
import BusinessFinanceHubLayout, { BusinessFinanceHubSection, type BusinessFinanceHubItem } from '@/pages/admin/finance/BusinessFinanceHubLayout';
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
  TrendingDown,
  Wallet,
  Receipt,
  Landmark,
  FileText,
} from 'lucide-react';

const ACCOUNTING_REPORTS: BusinessFinanceHubItem[] = [
  { to: '/admin/finance/accounting?tab=trial-balance', label: 'Trial Balance', description: 'All accounts — debits must equal credits.', icon: Scale },
  { to: '/admin/finance/accounting?tab=balance-sheet', label: 'Balance Sheet', description: 'Assets, liabilities, and equity.', icon: FileSpreadsheet },
  { to: '/admin/finance/accounting?tab=profit-loss', label: 'Profit & Loss', description: 'Revenue, costs, and net result.', icon: PieChart },
  { to: '/admin/finance/accounting?tab=cash-flow', label: 'Cash Flow', description: 'Cash in and out for the period.', icon: Wallet },
  { to: '/admin/finance/accounting?tab=depreciation', label: 'Depreciation', description: 'Fixed assets and monthly runs.', icon: Calculator },
  { to: '/admin/finance/accounting?tab=reconciliation', label: 'Reconciliation', description: 'GL vs cash, bank, AR, and AP.', icon: GitCompare },
  { to: '/admin/finance/accounting?tab=general-ledger', label: 'General Ledger', description: 'Full ledger for any account.', icon: Layers },
  { to: '/admin/finance/accounting?tab=party-soa', label: 'Party Statement', description: 'Customer or supplier GL statement.', icon: FileText },
  { to: '/admin/finance/accounting?tab=vat-filing', label: 'VAT Filing', description: 'Output, input VAT, and MoF export.', icon: Receipt },
  { to: '/admin/finance/accounting?tab=ar-aging', label: 'AR Aging', description: 'Who owes you — by age bucket.', icon: TrendingUp },
  { to: '/admin/finance/accounting?tab=ap-aging', label: 'AP Aging', description: 'Who you owe — by age bucket.', icon: TrendingDown },
  { to: '/admin/finance/accounting?tab=bank-rec', label: 'Bank Reconciliation', description: 'Match bank statement to books.', icon: Landmark },
  { to: '/admin/finance/accounting?tab=tax-reports', label: 'Tax (R10 / CNSS)', description: 'Salary withholding and employer summary.', icon: Receipt },
];

const STOCK_REPORTS: BusinessFinanceHubItem[] = [
  { to: '/admin/account-statement?tab=sales', label: 'List of Sales', description: 'Sales lines by customer and invoice.', icon: TrendingUp },
  { to: '/admin/account-statement?tab=purchases', label: 'List of Purchases', description: 'Supplier purchases and payments.', icon: ShoppingCart },
  { to: '/admin/inventory', label: 'Inventory & Stock Movement', description: 'Stock levels and movement overview.', icon: Package },
  { to: '/admin/products', label: 'Items & Price List', description: 'Catalog, quantities, and prices.', icon: Layers },
];

const BusinessFinanceReports: React.FC = () => (
  <BusinessFinanceHubLayout
    title="Reports"
    description="Financial statements and stock lists — pick one to open."
  >
    <BusinessFinanceHubSection title="Accounting reports" items={ACCOUNTING_REPORTS} />
    <BusinessFinanceHubSection title="Stock & operations" items={STOCK_REPORTS} />
  </BusinessFinanceHubLayout>
);

export default BusinessFinanceReports;
