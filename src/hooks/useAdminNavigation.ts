import { useEffect, useMemo, useState } from 'react';
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
  Landmark,
  CalendarDays,
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
import { SallyNavIcon } from '@/components/admin/SallyIconBadge';
import { useAuth } from '@/context/useAuth';
import { ECOSYSTEM_FLAGS } from '@/lib/ecosystemFlags';
import { canUseInvoiceManagerApp } from '@/lib/entitlements';
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
  setup_seo: false,
  setup_template: false,
  setup_system: false,
};

const SEO_OPS_ROUTES = [
  '/admin/seo-analytics',
  '/admin/seo-audit',
  '/admin/seo-keywords',
  '/admin/seo-technical',
  '/admin/seo-content',
  '/admin/seo-competitors',
  '/admin/seo-aeo',
  '/admin/seo-geo',
  '/admin/seo-programmatic',
  '/admin/seo-links',
];

const PROFILE_SETUP_ROUTES = [
  '/admin/profile',
  '/admin/payments',
  '/admin/delivery',
  '/admin/announcements',
  '/admin/marketing',
];

const TEMPLATE_ROUTES = ['/admin/templates', '/admin/theme-editor', '/admin/builder'];

const BUSINESS_TOOLS_ROUTES = [
  '/admin/finance',
  '/admin/invoice-manager',
  '/admin/cash-collection',
  '/admin/delivery-wallet',
  '/admin/staff',
  '/admin/sub-accounts',
  '/admin/marketplace',
  '/admin/audit-logs',
  '/admin/ai-agent',
];

function groupOpenForPath(pathname: string, groupId: string): boolean | undefined {
  if (groupId === 'daily_stock') {
    return (
      pathname.startsWith('/admin/inventory') ||
      pathname.startsWith('/admin/products') ||
      pathname.startsWith('/admin/purchases') ||
      pathname.startsWith('/admin/delivery')
    );
  }
  if (groupId === 'daily_sales') {
    return (
      pathname.startsWith('/admin/orders') ||
      pathname.startsWith('/admin/v-pos') ||
      pathname.startsWith('/admin/v-purchase') ||
      pathname.startsWith('/admin/v-expense') ||
      pathname.startsWith('/admin/pos') ||
      pathname.startsWith('/admin/events') ||
      pathname.startsWith('/admin/customers') ||
      pathname.startsWith('/admin/crm') ||
      pathname.startsWith('/admin/payments') ||
      pathname.startsWith('/admin/analytics')
    );
  }
  if (groupId === 'setup_profile') {
    return PROFILE_SETUP_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  }
  if (groupId === 'setup_seo') {
    return SEO_OPS_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  }
  if (groupId === 'setup_template') {
    return TEMPLATE_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  }
  if (groupId === 'setup_system') {
    return (
      BUSINESS_TOOLS_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`)) ||
      pathname.startsWith('/admin/finance/')
    );
  }
  return undefined;
}

export function useAdminNavigation() {
  const { user } = useAuth();
  const location = useLocation();
  const { canUse: canUseModule, profile } = useStoreEntitlements();
  const [openMenuGroups, setOpenMenuGroups] = useState<Record<string, boolean>>(DEFAULT_OPEN_GROUPS);
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    const pathname = location.pathname;
    setOpenMenuGroups((prev) => {
      const next = { ...prev };
      for (const groupId of Object.keys(DEFAULT_OPEN_GROUPS)) {
        const shouldOpen = groupOpenForPath(pathname, groupId);
        if (shouldOpen === true) next[groupId] = true;
      }
      return next;
    });
  }, [location.pathname]);

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
  /** Legacy Finance Suite hub — hide when Invoice Manager + Business Finance are available. */
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
            to: '/admin/inventory',
            label: 'Inventory Overview',
            icon: Package,
            visible: Boolean(isAdmin && canViewInventory),
          },
          {
            to: '/admin/products',
            label: 'Products',
            icon: Package,
            visible: Boolean(canViewInventory),
          },
          {
            to: '/admin/purchases',
            label: 'Purchases',
            icon: ShoppingCart,
            visible: Boolean(isAdmin && canManageInventory),
          },
          { to: '/admin/delivery', label: 'Delivery', icon: Clock, visible: Boolean(canManageDeliveries) },
        ],
      },
      {
        id: 'daily_sales',
        title: 'Sales & Customers',
        items: [
          { to: '/admin/v-pos', label: 'V·POS', icon: ShoppingCart, visible: Boolean(canViewOrders) },
          { to: '/admin/v-purchase', label: 'V·Purchase', icon: ShoppingCart, visible: Boolean(isAdmin && canManageInventory) },
          { to: '/admin/v-expense', label: 'V·Expense', icon: CreditCard, visible: isAdmin },
          { to: '/admin/orders', label: 'Orders', icon: Package, visible: Boolean(canViewOrders) },
          { to: '/admin/scheduled-orders', label: 'Scheduled Orders', icon: Clock, visible: Boolean(canViewOrders) },
          {
            to: '/admin/pos',
            label: 'Grabio POS',
            icon: Monitor,
            visible: user?.role === 'admin' && (!ECOSYSTEM_FLAGS.enforceModuleGates || canUseModule('pos')),
          },
          {
            to: '/admin/events',
            label: 'Store Events',
            icon: CalendarDays,
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
          { to: '/admin/profile', label: 'Store Profile', icon: User, visible: isAdmin },
          {
            to: '/admin/payments',
            label: 'Payment Settings',
            icon: CreditCard,
            visible: isAdmin && Boolean(canProcessPayments),
          },
          {
            to: '/admin/announcements',
            label: 'Announcements',
            icon: Megaphone,
            visible: isAdmin || user?.role === 'sub_account',
          },
          { to: '/admin/marketing', label: 'Email Marketing', icon: Mail, visible: isAdmin && Boolean(canViewReports) },
        ],
      },
      {
        id: 'setup_seo',
        title: 'SEO Ops',
        items: [
          { to: '/admin/seo-analytics', label: 'SEO Analytics', icon: TrendingUp, visible: isAdmin },
          { to: '/admin/seo-audit', label: 'SEO Audit (GSC)', icon: Globe, visible: isAdmin },
          { to: '/admin/seo-keywords', label: 'SEO Keywords', icon: BarChart, visible: isAdmin },
          { to: '/admin/seo-content', label: 'SEO Content', icon: FileText, visible: isAdmin },
          { to: '/admin/seo-competitors', label: 'SEO Competitors', icon: Monitor, visible: isAdmin },
          { to: '/admin/seo-aeo', label: 'SEO AEO', icon: Bot, visible: isAdmin },
          { to: '/admin/seo-geo', label: 'SEO GEO', icon: Globe, visible: isAdmin },
          { to: '/admin/seo-programmatic', label: 'Programmatic SEO', icon: LayoutGrid, visible: isAdmin },
          { to: '/admin/seo-links', label: 'SEO Links', icon: Globe, visible: isAdmin },
          { to: '/admin/seo-technical', label: 'SEO Technical', icon: Settings2, visible: isAdmin },
        ],
      },
      {
        id: 'setup_template',
        title: 'Template',
        items: [
          { to: '/admin/templates', label: 'Classic Template', icon: LayoutTemplate, visible: builderVisible },
          { to: '/admin/theme-editor', label: 'Theme Editor', icon: Paintbrush, visible: builderVisible },
          { to: '/admin/builder', label: 'WordPress', icon: Globe, visible: builderVisible },
        ],
      },
      {
        id: 'setup_system',
        title: 'Business Tools',
        items: [
          { to: '/admin/finance/accounting', label: 'Finance Suite', icon: DollarSign, visible: financeSuiteVisible },
          { to: '/admin/finance/accounting', label: 'Business Finance', icon: Landmark, visible: invoiceManagerEnabled },
          {
            to: '/admin/invoice-manager/invoices',
            label: 'Invoice Manager',
            icon: Receipt,
            visible: invoiceManagerEnabled,
          },
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
            label: 'Sally',
            icon: SallyNavIcon as typeof Bot,
            visible: user?.role === 'admin',
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
    isAdmin,
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
