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
import {
  canAccessBusinessTools,
  canAccessGrabioPos,
  canManageStoreInventory,
  canViewStoreInventory,
  isManagerSubAccount,
  hasStoreAdminAccess,
} from '@/lib/subAccountAccess';
import { isAccountingFreelancerSubAccount, isWebBuilderSubAccount } from '@/lib/webBuilderAccess';
import {
  canShowAdminBuilderNav,
  canShowAdminCrmNav,
  canShowAdminFinanceNav,
  canShowAdminInventoryNav,
  canShowAdminSeoNav,
  resolveEffectiveStoreContext,
} from '@/lib/effectiveStoreContext';
import { useRestaurantDemoOptional, toDemoAdminPath } from '@/context/RestaurantDemoContext';

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
  venue_operations: true,
  setup_profile: false,
  setup_seo: false,
  setup_template: false,
  setup_grow: false,
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
  '/admin/staff-presence',
  '/admin/sub-accounts',
  '/admin/marketplace',
  '/admin/audit-logs',
  '/admin/ai-agent',
];

function adminPathFromLocation(pathname: string, demoAdminBase?: string): string {
  if (demoAdminBase && pathname.startsWith(demoAdminBase)) {
    const suffix = pathname.slice(demoAdminBase.length) || '/dashboard';
    return suffix.startsWith('/admin') ? suffix : `/admin${suffix}`;
  }
  return pathname;
}

function groupOpenForPath(pathname: string, groupId: string): boolean | undefined {
  if (groupId === 'daily_stock') {
    return (
      pathname.startsWith('/admin/inventory') ||
      pathname.startsWith('/admin/products') ||
      pathname.startsWith('/admin/purchases') ||
      pathname.startsWith('/admin/delivery') ||
      pathname.startsWith('/admin/invoice-manager/expenses')
    );
  }
  if (groupId === 'daily_sales' || groupId === 'venue_operations') {
    return (
      pathname.startsWith('/admin/orders') ||
      pathname.startsWith('/admin/scheduled-orders') ||
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
  if (groupId === 'setup_grow') {
    return (
      TEMPLATE_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))
      || SEO_OPS_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))
    );
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

const DEMO_ADMIN_SUFFIXES = [
  '/dashboard',
  '/orders',
  '/customers',
  '/products',
  '/crm/dashboard',
  '/profile',
  '/events',
  '/scheduled-orders',
];

function isDemoSupportedAdminPath(adminPath: string): boolean {
  const suffix = adminPath.startsWith('/admin') ? adminPath.slice('/admin'.length) : adminPath;
  return DEMO_ADMIN_SUFFIXES.some((s) => suffix === s || suffix.startsWith(`${s}/`));
}

function mapNavGroupsForDemo(
  groups: { daily: AdminNavGroup[]; setup: AdminNavGroup[] },
  adminBase: string,
): { daily: AdminNavGroup[]; setup: AdminNavGroup[] } {
  const mapGroup = (g: AdminNavGroup): AdminNavGroup => ({
    ...g,
    items: g.items.map((item) => {
      const demoTo = toDemoAdminPath(item.to, adminBase);
      const supported = isDemoSupportedAdminPath(item.to);
      return {
        ...item,
        to: supported ? demoTo : item.to,
        visible: item.visible && supported,
      };
    }),
  });
  return {
    daily: groups.daily.map(mapGroup),
    setup: groups.setup.map(mapGroup),
  };
}

export function useAdminNavigation() {
  const { user } = useAuth();
  const location = useLocation();
  const restaurantDemo = useRestaurantDemoOptional();
  const { canUse: canUseModule, profile, entitlements } = useStoreEntitlements();
  const effectiveCtx = useMemo(
    () =>
      resolveEffectiveStoreContext({
        profile,
        entitlements,
        user,
        environment: 'web_admin',
      }),
    [profile, entitlements, user],
  );
  const venueNav = effectiveCtx.nav;
  const [openMenuGroups, setOpenMenuGroups] = useState<Record<string, boolean>>(DEFAULT_OPEN_GROUPS);
  const isManager = isManagerSubAccount(user);
  const storeAdminAccess = hasStoreAdminAccess(user);

  const canViewInventory = canViewStoreInventory(user);
  const canManageInventory = canManageStoreInventory(user);
  const canUseGrabioPos = canAccessGrabioPos(user);
  const canViewReports = storeAdminAccess || user?.permissions?.includes('view_reports');
  const canManageDeliveries = storeAdminAccess || user?.permissions?.includes('manage_deliveries');
  const canProcessPayments = storeAdminAccess || user?.permissions?.includes('process_payments');
  const canViewOrders = storeAdminAccess || user?.permissions?.includes('view_orders');
  const canViewCustomers = storeAdminAccess || user?.permissions?.includes('view_customers');
  const isCashier = user?.role === 'sub_account' && user?.subAccountRole === 'cashier';
  const isWebBuilder = isWebBuilderSubAccount(user);
  const isAccountingFreelancer = isAccountingFreelancerSubAccount(user);
  const canUseBusinessTools = canAccessBusinessTools(user);
  const showStockExpenseNav = canUseBusinessTools || canViewInventory;
  /** Phase 1 field sales — store owner + manager; ModuleGate handles entitlement on routes. */
  const crmEnabled = canShowAdminCrmNav(effectiveCtx, storeAdminAccess);
  const showFinanceNav = canShowAdminFinanceNav(effectiveCtx);
  const showInventoryNav = canShowAdminInventoryNav(effectiveCtx);
  const showBuilderNav = canShowAdminBuilderNav(effectiveCtx) || isWebBuilder;
  const showReservationsNav = effectiveCtx.modulesVisible.reservations;
  const invoiceManagerEnabled =
    showFinanceNav && canUseBusinessTools && canUseInvoiceManagerApp(profile);
  /** Legacy Finance Suite hub — hide when Invoice Manager + Business Finance are available. */
  const financeSuiteVisible = showFinanceNav && canUseBusinessTools && !invoiceManagerEnabled;

  useEffect(() => {
    const pathname = adminPathFromLocation(location.pathname, restaurantDemo?.adminBase);
    setOpenMenuGroups((prev) => {
      const next = { ...prev };
      for (const groupId of Object.keys(DEFAULT_OPEN_GROUPS)) {
        const shouldOpen = groupOpenForPath(pathname, groupId);
        if (shouldOpen === true) next[groupId] = true;
      }
      return next;
    });
  }, [location.pathname, restaurantDemo?.adminBase]);

  const isRouteActive = (route: string) => {
    const activeRoute =
      restaurantDemo && route.startsWith('/admin')
        ? toDemoAdminPath(route, restaurantDemo.adminBase)
        : route;
    if (activeRoute === '/admin/templates' || activeRoute === '/admin/theme-editor' || activeRoute === '/admin/builder') {
      return location.pathname === activeRoute || location.pathname.startsWith(`${activeRoute}/`);
    }
    if (activeRoute.startsWith('/admin/finance/') && activeRoute !== '/admin/finance') {
      return location.pathname.startsWith(activeRoute);
    }
    if (activeRoute.endsWith('/dashboard')) {
      return location.pathname === activeRoute || location.pathname === activeRoute.replace('/dashboard', '');
    }
    if (activeRoute.includes('/crm')) return location.pathname.startsWith(activeRoute.split('/crm')[0] + '/crm');
    return location.pathname === activeRoute || location.pathname.startsWith(`${activeRoute}/`);
  };

  const toggleMenuGroup = (groupId: string) => {
    setOpenMenuGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const menuGroups = useMemo(() => {
    if (isAccountingFreelancer) {
      const financeSetup: AdminNavGroup[] = [
        {
          id: 'client_finance',
          title: 'Client Finance',
          items: [
            {
              to: '/admin/finance/accounting',
              label: 'Business Finance',
              icon: Landmark,
              visible: true,
            },
            {
              to: '/admin/invoice-manager/invoices',
              label: 'Invoice Manager',
              icon: Receipt,
              visible: true,
            },
            {
              to: '/admin/invoice-manager/expenses',
              label: 'Expenses',
              icon: DollarSign,
              visible: true,
            },
            {
              to: '/admin/finance/reports',
              label: 'Reports',
              icon: BarChart,
              visible: canViewReports,
            },
          ],
        },
      ];
      return { daily: [], setup: financeSetup };
    }

    if (isWebBuilder) {
      const builderSetup: AdminNavGroup[] = [
        {
          id: 'setup_template',
          title: 'Storefront Builder',
          items: [
            { to: '/admin/dashboard', label: 'Client dashboard', icon: StoreIcon, visible: true },
            { to: '/admin/theme-editor', label: 'Theme Editor', icon: Paintbrush, visible: true },
            { to: '/admin/templates', label: 'Classic Template', icon: LayoutTemplate, visible: true },
            { to: '/admin/builder', label: 'WordPress', icon: Globe, visible: true },
          ],
        },
        {
          id: 'daily_stock',
          title: 'Catalog',
          items: [
            { to: '/admin/products', label: 'Products', icon: Package, visible: true },
            { to: '/admin/blog', label: 'Blog Posts', icon: FileText, visible: true },
            { to: '/admin/announcements', label: 'Announcements', icon: Megaphone, visible: true },
          ],
        },
      ];
      return { daily: [], setup: builderSetup };
    }

    const stockGroup: AdminNavGroup = {
      id: 'daily_stock',
      title: venueNav.stockGroupTitle,
      items: [
        {
          to: '/admin/inventory',
          label: 'Inventory Overview',
          icon: Package,
          visible: showInventoryNav && Boolean(canViewInventory),
        },
        {
          to: '/admin/products',
          label: 'Products',
          icon: Package,
          visible: showInventoryNav && Boolean(canViewInventory),
        },
        {
          to: '/admin/purchases',
          label: 'Purchases',
          icon: ShoppingCart,
          visible: showInventoryNav && Boolean(canManageInventory),
        },
        {
          to: '/admin/delivery',
          label: 'Delivery',
          icon: Clock,
          visible: showInventoryNav && Boolean(canManageDeliveries),
        },
        {
          to: '/admin/invoice-manager/expenses',
          label: 'Expenses',
          icon: Receipt,
          visible: showFinanceNav && Boolean(showStockExpenseNav),
        },
      ],
    };

    const operationsGroup: AdminNavGroup = {
      id: venueNav.useOperationsFirstLayout ? 'venue_operations' : 'daily_sales',
      title: venueNav.operationsGroupTitle,
      items: [
        { to: '/admin/v-pos', label: 'V·POS', icon: ShoppingCart, visible: Boolean(canViewOrders) },
        {
          to: '/admin/v-purchase',
          label: 'V·Purchase',
          icon: ShoppingCart,
          visible: showInventoryNav && Boolean(canManageInventory),
        },
        {
          to: '/admin/v-expense',
          label: 'V·Expense',
          icon: CreditCard,
          visible: showFinanceNav,
        },
        { to: '/admin/orders', label: 'Orders', icon: Package, visible: Boolean(canViewOrders) },
        {
          to: '/admin/scheduled-orders',
          label: 'Scheduled Orders',
          icon: Clock,
          visible: Boolean(canViewOrders),
        },
        {
          to: '/admin/pos',
          label: 'Grabio POS',
          icon: Monitor,
          visible: canUseGrabioPos && (!ECOSYSTEM_FLAGS.enforceModuleGates || canUseModule('pos')),
        },
        {
          to: '/admin/events',
          label: venueNav.showReservationsNav ? 'Reservations' : 'Store Events',
          icon: CalendarDays,
          visible:
            showReservationsNav
            && canUseGrabioPos
            && (!ECOSYSTEM_FLAGS.enforceModuleGates || canUseModule('pos')),
        },
        {
          to: '/admin/customers',
          label: venueNav.useOperationsFirstLayout ? 'Guests' : 'Customers',
          icon: Users,
          visible: Boolean(canViewCustomers),
        },
        { to: '/admin/crm/dashboard', label: 'Sales CRM', icon: LayoutGrid, visible: crmEnabled },
        { to: '/admin/payments', label: 'Payments', icon: CreditCard, visible: Boolean(canProcessPayments) },
        { to: '/admin/analytics', label: 'Analytics', icon: BarChart, visible: Boolean(canViewReports) },
      ],
    };

    const daily: AdminNavGroup[] = venueNav.useOperationsFirstLayout
      ? [
          operationsGroup,
          ...(showInventoryNav ? [stockGroup] : []),
        ]
      : [stockGroup, operationsGroup];

    const seoOpsVisible = canShowAdminSeoNav(effectiveCtx, storeAdminAccess);
    const templateItems: AdminNavItem[] = [
      { to: '/admin/templates', label: 'Classic Template', icon: LayoutTemplate, visible: showBuilderNav },
      { to: '/admin/theme-editor', label: 'Theme Editor', icon: Paintbrush, visible: showBuilderNav },
      { to: '/admin/builder', label: 'WordPress', icon: Globe, visible: showBuilderNav },
    ];
    const seoItems: AdminNavItem[] = [
      { to: '/admin/seo-analytics', label: 'SEO Analytics', icon: TrendingUp, visible: seoOpsVisible },
      { to: '/admin/seo-audit', label: 'SEO Audit (GSC)', icon: Globe, visible: seoOpsVisible },
      { to: '/admin/seo-keywords', label: 'SEO Keywords', icon: BarChart, visible: seoOpsVisible },
      { to: '/admin/seo-content', label: 'SEO Content', icon: FileText, visible: seoOpsVisible },
      { to: '/admin/seo-competitors', label: 'SEO Competitors', icon: Monitor, visible: seoOpsVisible },
      { to: '/admin/seo-aeo', label: 'SEO AEO', icon: Bot, visible: seoOpsVisible },
      { to: '/admin/seo-geo', label: 'SEO GEO', icon: Globe, visible: seoOpsVisible },
      { to: '/admin/seo-programmatic', label: 'Programmatic SEO', icon: LayoutGrid, visible: seoOpsVisible },
      { to: '/admin/seo-links', label: 'SEO Links', icon: Globe, visible: seoOpsVisible },
      { to: '/admin/seo-technical', label: 'SEO Technical', icon: Settings2, visible: seoOpsVisible },
    ];

    const setup: AdminNavGroup[] = [
      {
        id: 'setup_profile',
        title: 'Profile & Store Setup',
        items: [
          { to: '/admin/profile', label: 'Store Profile', icon: User, visible: storeAdminAccess },
          {
            to: '/admin/payments',
            label: 'Payment Settings',
            icon: CreditCard,
            visible: storeAdminAccess && Boolean(canProcessPayments),
          },
          {
            to: '/admin/announcements',
            label: 'Announcements',
            icon: Megaphone,
            visible: storeAdminAccess || user?.role === 'sub_account',
          },
          { to: '/admin/marketing', label: 'Email Marketing', icon: Mail, visible: storeAdminAccess && Boolean(canViewReports) },
        ],
      },
      ...(venueNav.mode === 'restaurant_first'
        ? [
            {
              id: 'setup_grow',
              title: 'Grow',
              items: [...templateItems, ...seoItems],
            } satisfies AdminNavGroup,
          ]
        : [
            {
              id: 'setup_seo',
              title: 'SEO Ops',
              items: seoItems.map((item) => ({
                ...item,
                visible: seoOpsVisible,
              })),
            },
            {
              id: 'setup_template',
              title: 'Template',
              items: templateItems.map((item) => ({
                ...item,
                visible: showBuilderNav,
              })),
            },
          ]),
      {
        id: 'setup_system',
        title: showFinanceNav ? 'Business Tools' : 'Team & system',
        items: [
          {
            to: '/admin/finance/accounting',
            label: 'Finance Suite',
            icon: DollarSign,
            visible: financeSuiteVisible,
          },
          {
            to: '/admin/finance/accounting',
            label: 'Business Finance',
            icon: Landmark,
            visible: invoiceManagerEnabled,
          },
          {
            to: '/admin/invoice-manager/invoices',
            label: 'Invoice Manager',
            icon: Receipt,
            visible: invoiceManagerEnabled,
          },
          {
            to: '/admin/cash-collection',
            label: 'Cash Collection',
            icon: DollarSign,
            visible: showFinanceNav && canUseBusinessTools,
          },
          {
            to: '/admin/delivery-wallet',
            label: 'Delivery Wallets',
            icon: Wallet,
            visible: showFinanceNav && canUseBusinessTools,
          },
          {
            to: '/admin/staff',
            label: 'Staff (Payroll)',
            icon: Users,
            visible: showFinanceNav && canUseBusinessTools,
          },
          {
            to: '/admin/staff-presence',
            label: 'Daily Presence',
            icon: CalendarDays,
            visible: canUseBusinessTools,
          },
          {
            to: '/admin/salaries',
            label: 'Salary Payments',
            icon: DollarSign,
            visible: showFinanceNav && canUseBusinessTools,
          },
          {
            to: '/admin/sub-accounts',
            label: 'Sub-Accounts',
            icon: Users,
            visible: storeAdminAccess && (!ECOSYSTEM_FLAGS.enforceModuleGates || canUseModule('team')),
          },
          {
            to: '/admin/marketplace',
            label: 'Marketplace Sync',
            icon: Globe,
            visible: storeAdminAccess && (!ECOSYSTEM_FLAGS.enforceModuleGates || canUseModule('dropship')),
          },
          { to: '/admin/audit-logs', label: 'Store Logs', icon: FileText, visible: canUseBusinessTools },
          {
            to: '/admin/ai-agent',
            label: 'Sally',
            icon: SallyNavIcon as typeof Bot,
            visible: storeAdminAccess,
          },
        ],
      },
    ];

    const base = { daily, setup };
    return restaurantDemo ? mapNavGroupsForDemo(base, restaurantDemo.adminBase) : base;
  }, [
    canManageDeliveries,
    canManageInventory,
    canProcessPayments,
    canUseGrabioPos,
    canUseModule,
    canViewCustomers,
    canViewInventory,
    canViewOrders,
    canViewReports,
    crmEnabled,
    invoiceManagerEnabled,
    financeSuiteVisible,
    showBuilderNav,
    showFinanceNav,
    showInventoryNav,
    storeAdminAccess,
    isWebBuilder,
    isAccountingFreelancer,
    user?.role,
    user?.subAccountRole,
    canUseBusinessTools,
    effectiveCtx,
    venueNav,
    user,
    restaurantDemo,
  ]);

  const dashboardLabel = restaurantDemo
    ? 'Restaurant demo'
    : isWebBuilder
    ? 'Builder Workspace'
    : isAccountingFreelancer
      ? 'Finance Workspace'
    : isCashier
    ? 'Cashier Dashboard'
    : isManager
      ? 'Store admin dashboard'
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
    venueNav,
    canProcessPayments,
    canViewInventory,
    canManageInventory,
    canUseGrabioPos,
    StoreIcon,
    Settings2,
  };
}
