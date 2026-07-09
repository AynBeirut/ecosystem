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
  '/admin/inventory': () => import('@/pages/admin/AdminInventory'),
  '/admin/customers': () => import('@/pages/admin/AdminCustomers'),
  '/admin/purchases': () => import('@/pages/admin/AdminPurchases'),
  '/admin/finance': () => import('@/pages/admin/AdminFinanceSuite'),
  '/admin/staff': () => import('@/pages/admin/AdminStaff'),
  '/admin/sub-accounts': () => import('@/pages/admin/AdminSubAccounts'),
  '/admin/account-statement': () => import('@/pages/admin/AdminAccountStatement'),
  '/admin/cash-collection': () => import('@/pages/admin/AdminBankReconciliation'),
  '/admin/bank-reconciliation': () => import('@/pages/admin/AdminBankReconciliation'),
  '/admin/crm/pipeline': () => import('@/pages/admin/crm/CrmPipeline'),
  '/subscription': () => import('@/pages/admin/Subscription'),
};

const preloaded = new Set<string>();

export function preloadAdminRoute(path: string): void {
  const normalized = path.split('?')[0].replace(/\/$/, '') || '/admin/dashboard';
  const loader =
    ROUTE_PRELOADERS[normalized] ??
    (normalized.startsWith('/admin/crm') ? ROUTE_PRELOADERS['/admin/crm/pipeline'] : undefined);

  if (!loader || preloaded.has(normalized)) return;
  preloaded.add(normalized);
  void loader();
}

export function preloadCommonAdminRoutes(): void {
  [
    '/admin/dashboard',
    '/admin/orders',
    '/admin/inventory',
    '/admin/products',
    '/admin/customers',
    '/admin/profile',
    '/admin/purchases',
  ].forEach(preloadAdminRoute);
}
