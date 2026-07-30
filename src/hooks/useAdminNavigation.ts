import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  BarChart,
  Bot,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
  Globe,
  LayoutGrid,
  LayoutTemplate,
  Mail,
  Megaphone,
  Monitor,
  Package,
  Paintbrush,
  Receipt,
  Settings2,
  ShoppingCart,
  Store as StoreIcon,
  TrendingUp,
  User,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/context/useAuth';
import { ECOSYSTEM_FLAGS } from '@/lib/ecosystemFlags';
import { canUseInvoiceManagerApp } from '@/lib/entitlements';
import { INVOICE_MANAGER_EMBED_URL } from '@/lib/invoiceApp';
import { useStoreEntitlements } from '@/hooks/useStoreEntitlements';
import { canAccessBusinessTools, isManagerSubAccount } from '@/lib/subAccountAccess';

export type AdminNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  visible: boolean;
  /** Full-page navigation to a separate SPA (e.g. /invoice/) */
  external?: boolean;
};

export type AdminNavGroup = {
  id: string;
  title: string;
  items: AdminNavItem[];
};

const DEFAULT_OPEN_GROUPS: Record<string, boolean> = {
  daily_stock: true,
  daily_sales: true,
  setup_profile: false,
  setup_template: false,
  setup_system: false,
};

export function useAdminNavigation() {
  const { user } = useAuth();
  const location = useLocation();
  const { canUse: canUseModule, profile } = useStoreEntitlements();
  const [openMenuGroups, setOpenMenuGroups] = useState<Record<string, boolean>>(DEFAULT_OPEN_GROUPS);

  const canViewInventory = user?.role === 'admin' || user?.permissions?.includes('view_inventory');
  const canManageInventory = user?.role === 'admin' || user?.permissions?.includes('manage_inventory');
  const canViewReports = user?.role === 'admin' || user?.permissions?.includes('view_reports');
  const canManageDeliveries = user?.role === 'admin' || user?.permissions?.includes('manage_deliveries');
  const canProcessPayments = user?.role === 'admin' || user?.permissions?.includes('process_payments');
  const canViewOrders = user?.role === 'admin' || user?.permissions?.includes('view_orders');
  const canViewCustomers = user?.role === 'admin' || user?.permissions?.includes('view_customers');
  const isCashier = user?.role === 'sub_account' && user?.subAccountRole === 'cashier';
  const isManager = isManagerSubAccount(user);
  const canUseBusinessTools = canAccessBusinessTools(user);
  /** Phase 1 field sales — always show for store owners; ModuleGate handles entitlement on routes. */
  const crmEnabled = user?.role === 'admin';
  const invoiceManagerEnabled = canUseBusinessTools && canUseInvoiceManagerApp(profile);
  /** Legacy Finance Suite hub — hide when Invoice Manager covers the same workflows. */
  const financeSuiteVisible = canUseBusinessTools && !invoiceManagerEnabled;
  const builderVisible = user?.role === 'admin' && (!ECOSYSTEM_FLAGS.enforceModuleGates || canUseModule('builder'));

  const isRouteActive = (route: string) => {
    if (route === '/admin/templates' || route === '/admin/theme-editor' || route === '/admin/builder') {
      return location.pathname === route || location.pathname.startsWith(`${route}/`);
    }
    if (route.startsWith('/admin/finance/') && route !== '/admin/finance') {
      return location.pathname.startsWith(route);
    }
    if (route === '/admin/dashboard') return location.pathname === '/admin/dashboard' || location.pathname === '/admin';
    if (route.startsWith('/admin/crm')) return location.pathname.startsWith('/admin/crm');
    return location.pathname === route || location.pathname.startsWith(`${route}/`);
  };

  const toggleMenuGroup = (groupId: string) => {
    setOpenMenuGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const menuGroups = useMemo(() => {
    const daily: AdminNavGroup[] = [
      {
        id: 'daily_stock',
        title: 'Stock & Catalog',
        items: [
          {
            to: user?.role === 'admin' ? '/admin/inventory' : '/admin/products',
            label: user?.role === 'admin' ? 'Inventory Overview' : 'Products',
            icon: Package,
            visible: Boolean(canViewInventory),
          },
          { to: '/admin/products', label: 'Products', icon: Package, visible: Boolean(canViewInventory) },
          { to: '/admin/purchases', label: 'Purchases', icon: ShoppingCart, visible: Boolean(canManageInventory) },
          { to: '/admin/delivery', label: 'Delivery', icon: Clock, visible: Boolean(canManageDeliveries) },
        ],
      },
      {
        id: 'daily_sales',
        title: 'Sales & Customers',
        items: [
          { to: '/admin/orders', label: 'Orders', icon: Package, visible: Boolean(canViewOrders) },
          {
            to: '/admin/pos',
            label: 'Grabio POS',
            icon: Monitor,
            visible: user?.role === 'admin' && (!ECOSYSTEM_FLAGS.enforceModuleGates || canUseModule('pos')),
          },
          { to: '/admin/customers', label: 'Customers', icon: Users, visible: Boolean(canViewCustomers) },
          { to: '/admin/crm/dashboard', label: 'Sales CRM', icon: LayoutGrid, visible: crmEnabled },
          { to: '/admin/payments', label: 'Payments', icon: CreditCard, visible: Boolean(canProcessPayments) },
          { to: '/admin/analytics', label: 'Analytics', icon: BarChart, visible: Boolean(canViewReports) },
        ],
      },
    ];

    const setup: AdminNavGroup[] = [
      {
        id: 'setup_profile',
        title: 'Profile & Store Setup',
        items: [
          { to: '/admin/profile', label: 'Store Profile', icon: User, visible: user?.role === 'admin' },
          {
            to: '/admin/payments',
            label: 'Payment Settings',
            icon: CreditCard,
            visible: user?.role === 'admin' && Boolean(canProcessPayments),
          },
          { to: '/admin/announcements', label: 'Announcements', icon: Megaphone, visible: user?.role === 'admin' },
          { to: '/admin/marketing', label: 'Email Marketing', icon: Mail, visible: user?.role === 'admin' && Boolean(canViewReports) },
          { to: '/admin/seo-analytics', label: 'SEO Analytics', icon: TrendingUp, visible: user?.role === 'admin' },
          { to: '/admin/seo-audit', label: 'SEO Audit (GSC)', icon: Globe, visible: user?.role === 'admin' },
        ],
      },
      {
        id: 'setup_template',
        title: 'Template',
        items: [
          { to: '/admin/templates', label: 'Classic Template', icon: LayoutTemplate, visible: builderVisible },
          { to: '/admin/theme-editor', label: 'Theme Editor', icon: Paintbrush, visible: builderVisible },
          { to: '/admin/builder', label: 'WordPress Builder', icon: Globe, visible: builderVisible },
        ],
      },
      {
        id: 'setup_system',
        title: 'Business Tools',
        items: [
          { to: '/admin/finance', label: 'Finance Suite', icon: DollarSign, visible: financeSuiteVisible },
          {
            to: INVOICE_MANAGER_EMBED_URL,
            label: 'Invoice Manager',
            icon: Receipt,
            visible: invoiceManagerEnabled,
          },
          { to: '/admin/account-statement', label: 'Account Statement', icon: FileText, visible: canUseBusinessTools },
          { to: '/admin/cash-collection', label: 'Cash Collection', icon: DollarSign, visible: canUseBusinessTools },
          { to: '/admin/delivery-wallet', label: 'Delivery Wallets', icon: Wallet, visible: canUseBusinessTools },
          { to: '/admin/staff', label: 'Staff (Payroll)', icon: Users, visible: canUseBusinessTools },
          {
            to: '/admin/sub-accounts',
            label: 'Sub-Accounts',
            icon: Users,
            visible: user?.role === 'admin' && (!ECOSYSTEM_FLAGS.enforceModuleGates || canUseModule('team')),
          },
          {
            to: '/admin/marketplace',
            label: 'Marketplace Sync',
            icon: Globe,
            visible: user?.role === 'admin' && (!ECOSYSTEM_FLAGS.enforceModuleGates || canUseModule('dropship')),
          },
          { to: '/admin/audit-logs', label: 'Store Logs', icon: FileText, visible: canUseBusinessTools },
          {
            to: '/admin/ai-agent',
            label: 'AI Agent',
            icon: Bot,
            visible: user?.role === 'admin' && (!ECOSYSTEM_FLAGS.enforceModuleGates || canUseModule('ai_agent')),
          },
        ],
      },
    ];

    return { daily, setup };
  }, [
    canManageDeliveries,
    canManageInventory,
    canProcessPayments,
    canUseModule,
    canViewCustomers,
    canViewInventory,
    canViewOrders,
    canViewReports,
    crmEnabled,
    invoiceManagerEnabled,
    financeSuiteVisible,
    builderVisible,
    user?.role,
    user?.subAccountRole,
    canUseBusinessTools,
  ]);

  const dashboardLabel = isCashier
    ? 'Cashier Dashboard'
    : isManager
      ? 'Manager Dashboard'
    : user?.role === 'sub_account'
      ? 'Seller Dashboard'
      : 'Admin Dashboard';

  return {
    user,
    menuGroups,
    openMenuGroups,
    toggleMenuGroup,
    isRouteActive,
    dashboardLabel,
    crmEnabled,
    canProcessPayments,
    canViewInventory,
    StoreIcon,
    Settings2,
  };
}
