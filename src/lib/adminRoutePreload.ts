type Preloader = () => Promise<unknown>;

const ROUTE_PRELOADERS: Record<string, Preloader> = {
  '/admin/dashboard': () => import('@/pages/admin/AdminDashboard'),
  '/admin/products': () => import('@/pages/admin/AdminProducts'),
  '/admin/profile': () => import('@/pages/admin/AdminProfile'),
  '/admin/payments': () => import('@/pages/admin/AdminPayments'),
  '/admin/delivery': () => import('@/pages/admin/AdminDelivery'),
  '/admin/templates': () => import('@/pages/admin/AdminTemplates'),
  '/admin/announcements': () => import('@/pages/admin/AdminAnnouncements'),
  '/admin/analytics': () => import('@/pages/admin/AdminAnalytics'),
  '/admin/revenue': () => import('@/pages/admin/AdminRevenue'),
  '/admin/marketing': () => import('@/pages/admin/AdminMarketing'),
  '/admin/orders': () => import('@/pages/admin/AdminOrders'),
  '/admin/v-pos': () => import('@/pages/admin/AdminVPos'),
  '/admin/v-purchase': () => import('@/pages/admin/AdminVPurchase'),
  '/admin/v-expense': () => import('@/pages/admin/AdminVExpense'),
  '/admin/scheduled-orders': () => import('@/pages/admin/AdminScheduledOrders'),
  '/admin/inventory': () => import('@/pages/admin/AdminInventory'),
  '/admin/customers': () => import('@/pages/admin/AdminCustomers'),
  '/admin/purchases': () => import('@/pages/admin/AdminPurchases'),
  '/admin/finance': () => import('@/pages/admin/finance/FinanceModuleShell'),
  '/admin/finance/accounting': () => import('@/pages/admin/finance/FinanceModuleShell'),
  '/admin/invoice-manager': () => import('@/pages/admin/invoice-manager/InvoiceManagerModuleShell'),
  '/admin/invoice-manager/invoices': () => import('@/pages/admin/invoice-manager/InvoiceManagerModuleShell'),
  '/admin/staff': () => import('@/pages/admin/AdminStaff'),
  '/admin/staff-presence': () => import('@/pages/admin/AdminStaffPresence'),
  '/admin/hr': () => import('@/pages/admin/AdminHrShell'),
  '/admin/venue-ops': () => import('@/pages/admin/AdminVenueOpsShell'),
  '/admin/sub-accounts': () => import('@/pages/admin/AdminSubAccounts'),
  '/admin/account-statement': () => import('@/pages/admin/AdminAccountStatement'),
  '/admin/cash-collection': () => import('@/pages/admin/AdminBankReconciliation'),
  '/admin/delivery-wallet': () => import('@/pages/admin/AdminDeliveryWallet'),
  '/admin/bank-reconciliation': () => import('@/pages/admin/AdminBankReconciliation'),
  '/admin/crm/dashboard': () => import('@/pages/admin/crm/CrmModuleShell'),
  '/admin/crm/map': () => import('@/pages/admin/crm/CrmMap'),
  '/subscription': () => import('@/pages/admin/Subscription'),
};

const preloaded = new Set<string>();

function schedulePreload(loader: Preloader): void {
  if (typeof window === 'undefined') {
    void loader();
    return;
  }

  const run = () => {
    void loader();
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(run, { timeout: 2500 });
    return;
  }

  window.setTimeout(run, 250);
}

export function preloadAdminRoute(path: string): void {
  const normalized = path.split('?')[0].replace(/\/$/, '') || '/admin/dashboard';
  const loader =
    ROUTE_PRELOADERS[normalized] ??
    (normalized.startsWith('/admin/finance')
      ? ROUTE_PRELOADERS['/admin/finance']
      : normalized.startsWith('/admin/invoice-manager')
        ? ROUTE_PRELOADERS['/admin/invoice-manager']
        : normalized.startsWith('/admin/crm')
          ? ROUTE_PRELOADERS['/admin/crm/dashboard']
          : normalized.startsWith('/admin/hr')
            ? ROUTE_PRELOADERS['/admin/hr']
            : normalized.startsWith('/admin/venue-ops')
              ? ROUTE_PRELOADERS['/admin/venue-ops']
              : undefined);

  if (!loader || preloaded.has(normalized)) return;
  preloaded.add(normalized);
  schedulePreload(loader);
}

export function preloadCommonAdminRoutes(): void {
  [
    '/admin/dashboard',
    '/admin/inventory',
    '/admin/products',
    '/admin/customers',
    '/admin/profile',
    '/admin/purchases',
  ].forEach(preloadAdminRoute);
}
