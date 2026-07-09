import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  BarChart,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
  Globe,
  LayoutGrid,
  Mail,
  Megaphone,
  Monitor,
  Package,
  Palette,
  Receipt,
  Settings2,
  ShoppingCart,
  Store as StoreIcon,
  TrendingUp,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/context/useAuth';
import { ECOSYSTEM_FLAGS } from '@/lib/ecosystemFlags';
import { canUseInvoiceManagerApp } from '@/lib/entitlements';
import { INVOICE_MANAGER_EMBED_URL } from '@/lib/invoiceApp';
import { useStoreEntitlements } from '@/hooks/useStoreEntitlements';

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
  const crmEnabled = user?.role === 'admin' && canUseModule('crm');
  const invoiceManagerEnabled = user?.role === 'admin' && canUseInvoiceManagerApp(profile);

  const isRouteActive = (route: string) => {
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
          { to: '/admin/orders', label: 'Orders', icon: Package, visible: true },
          {
            to: '/admin/pos',
            label: 'Grabio POS',
            icon: Monitor,
            visible: user?.role === 'admin' && (!ECOSYSTEM_FLAGS.enforceModuleGates || canUseModule('pos')),
          },
          { to: '/admin/customers', label: 'Customers', icon: Users, visible: true },
          { to: '/admin/crm/pipeline', label: 'Sales CRM', icon: LayoutGrid, visible: crmEnabled },
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
          { to: '/admin/templates', label: 'Classic Templates', icon: Palette, visible: user?.role === 'admin' },
          { to: '/admin/announcements', label: 'Announcements', icon: Megaphone, visible: true },
          { to: '/admin/marketing', label: 'Email Marketing', icon: Mail, visible: Boolean(canViewReports) },
          { to: '/admin/seo-analytics', label: 'SEO Analytics', icon: TrendingUp, visible: user?.role === 'admin' },
          { to: '/admin/seo-audit', label: 'SEO Audit (GSC)', icon: Globe, visible: user?.role === 'admin' },
        ],
      },
      {
        id: 'setup_system',
        title: 'Business Tools',
        items: [
          { to: '/admin/finance', label: 'Finance Suite', icon: DollarSign, visible: user?.role === 'admin' },
          {
            to: INVOICE_MANAGER_EMBED_URL,
            label: 'Invoice Manager',
            icon: Receipt,
            visible: invoiceManagerEnabled,
          },
          { to: '/admin/account-statement', label: 'Account Statement', icon: FileText, visible: user?.role === 'admin' },
          { to: '/admin/cash-collection', label: 'Cash Collection', icon: DollarSign, visible: user?.role === 'admin' },
          { to: '/admin/staff', label: 'Staff (Payroll)', icon: Users, visible: user?.role === 'admin' },
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
          { to: '/admin/audit-logs', label: 'Store Logs', icon: FileText, visible: user?.role === 'admin' },
        ],
      },
    ];

    return { daily, setup };
  }, [
    canManageDeliveries,
    canManageInventory,
    canProcessPayments,
    canUseModule,
    canViewInventory,
    canViewReports,
    crmEnabled,
    invoiceManagerEnabled,
    user?.role,
  ]);

  const dashboardLabel = user?.role === 'sub_account' ? 'Seller Dashboard' : 'Admin Dashboard';

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
