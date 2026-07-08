import React, { Suspense, useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { ChevronDown, CreditCard, FileText } from 'lucide-react';
import { useAuth } from '@/context/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAdminNavigation, type AdminNavItem } from '@/hooks/useAdminNavigation';
import MobileHeader from '@/components/MobileHeader';
import PoweredByEmoove from '@/components/PoweredByEmoove';
import AdminPageFallback from '@/components/admin/AdminPageFallback';
import { getActualStoreId } from '@/lib/storeUtils';
import { preloadAdminRoute, preloadCommonAdminRoutes } from '@/lib/adminRoutePreload';
import { doc, getDoc, getFirestore, updateDoc } from 'firebase/firestore';

function AdminUserStrip({ variant = 'sidebar' }: { variant?: 'sidebar' | 'mobile' }) {
  const { user } = useAuth();
  const initial = user?.name ? String(user.name).charAt(0) : 'G';
  const isSidebar = variant === 'sidebar';

  return (
    <div
      className={
        isSidebar
          ? 'flex items-center gap-3 min-w-0'
          : 'flex items-center gap-3 min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5'
      }
    >
      <div
        className={
          isSidebar
            ? 'h-9 w-9 shrink-0 rounded-lg bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center text-white text-sm font-semibold shadow-md'
            : 'h-9 w-9 shrink-0 rounded-lg bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center text-white text-sm font-semibold'
        }
      >
        {initial}
      </div>
      <div className="min-w-0">
        <p className={`text-sm font-medium truncate ${isSidebar ? 'text-white' : 'text-slate-900'}`}>
          {user?.name || 'Guest'}
        </p>
        <p className={`text-xs truncate ${isSidebar ? 'text-slate-500' : 'text-slate-500'}`}>
          {user?.email || ''}
        </p>
      </div>
    </div>
  );
}

const PAGE_TITLES: Record<string, string> = {
  '/admin/dashboard': 'Dashboard',
  '/admin': 'Dashboard',
  '/admin/products': 'Products',
  '/admin/profile': 'Store Profile',
  '/admin/payments': 'Payments',
  '/admin/delivery': 'Delivery',
  '/admin/builder': 'Store Builder',
  '/admin/templates': 'Templates',
  '/admin/announcements': 'Announcements',
  '/admin/analytics': 'Analytics',
  '/admin/revenue': 'Revenue',
  '/admin/marketing': 'Email Marketing',
  '/admin/orders': 'Orders',
  '/admin/inventory': 'Inventory',
  '/admin/customers': 'Customers',
  '/admin/purchases': 'Purchases',
  '/admin/finance': 'Finance Suite',
  '/admin/finance/invoices': 'Invoice Manager',
  '/admin/staff': 'Staff',
  '/admin/sub-accounts': 'Sub-Accounts',
  '/admin/account-statement': 'Account Statement',
  '/admin/cash-collection': 'Cash Collection',
  '/admin/audit-logs': 'Store Logs',
  '/admin/seo-analytics': 'SEO Analytics',
  '/admin/seo-audit': 'SEO Audit',
  '/admin/crm': 'Sales CRM',
  '/subscription': 'Subscription',
  '/team/dashboard': 'Seller Dashboard',
};

function resolvePageTitle(pathname: string, fallback: string) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith('/admin/crm')) return 'Sales CRM';
  if (pathname.startsWith('/admin/finance/invoices') || pathname.startsWith('/admin/finance/estimates') || pathname.startsWith('/admin/finance/receipts') || pathname.startsWith('/admin/finance/clients') || pathname.startsWith('/admin/finance/products') || (pathname.startsWith('/admin/finance/reports') && pathname !== '/admin/reports')) return 'Invoice Manager';
  if (pathname.startsWith('/admin/finance')) return 'Finance';
  if (pathname.startsWith('/admin/ai')) return 'AI Tools';
  const segment = pathname.split('/').filter(Boolean).pop();
  if (!segment) return fallback;
  return segment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function renderSidebarNavItem(
  item: AdminNavItem,
  isRouteActive: (route: string) => boolean,
  activeClass: string,
  inactiveClass: string,
) {
  const Icon = item.icon;
  const className = `flex items-center rounded-lg px-2.5 py-2 text-sm transition ${
    isRouteActive(item.to) ? activeClass : inactiveClass
  }`;

  if (item.external) {
    return (
      <a key={item.to} href={item.to} className={className}>
        <Icon className="mr-2.5 h-4 w-4 shrink-0 opacity-80" />
        <span>{item.label}</span>
      </a>
    );
  }

  return (
    <Link
      key={item.to}
      to={item.to}
      onMouseEnter={() => preloadAdminRoute(item.to)}
      className={className}
    >
      <Icon className="mr-2.5 h-4 w-4 shrink-0 opacity-80" />
      <span>{item.label}</span>
    </Link>
  );
}

export default function AdminLayout() {
  const location = useLocation();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const {
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
  } = useAdminNavigation();

  const [storeStatus, setStoreStatus] = useState<'online' | 'offline' | null>(null);
  const pageTitle = resolvePageTitle(location.pathname, dashboardLabel);

  useEffect(() => {
    document.title = `${pageTitle} — Grabio`;
  }, [pageTitle]);

  useEffect(() => {
    const schedule = () => preloadCommonAdminRoutes();
    const idleId = window.requestIdleCallback?.(schedule);
    const timeoutId = idleId == null ? window.setTimeout(schedule, 1500) : undefined;
    return () => {
      if (idleId != null) window.cancelIdleCallback(idleId);
      if (timeoutId != null) window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    const loadStatus = async () => {
      if (!user?.id) return;
      const storeId = getActualStoreId(user);
      if (!storeId) return;
      try {
        const snap = await getDoc(doc(getFirestore(), 'storeProfiles', storeId));
        if (snap.exists()) {
          const status = snap.data().status === 'online' ? 'online' : 'offline';
          setStoreStatus(status);
        }
      } catch {
        /* ignore */
      }
    };
    void loadStatus();
  }, [user]);

  const handleStatusToggle = async () => {
    if (!user?.id || !storeStatus) return;
    const storeId = getActualStoreId(user);
    if (!storeId) return;
    const next = storeStatus === 'online' ? 'offline' : 'online';
    try {
      await updateDoc(doc(getFirestore(), 'storeProfiles', storeId), { status: next });
      setStoreStatus(next);
    } catch (err) {
      console.warn('Failed to toggle store status', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#eef2f7] flex flex-col">
      {isMobile && (
        <MobileHeader title={pageTitle} showBackButton={false} showHomeButton />
      )}

      <div className="md:hidden px-4 pt-3 pb-3 border-b border-slate-200/80 bg-white/80 backdrop-blur-md shrink-0">
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200/80 bg-[#0b1220] px-3 py-3 text-white">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-300/90">Daily Operations</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link
                to={user?.role === 'admin' ? '/admin/inventory' : '/admin/products'}
                className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white border border-white/15 hover:bg-white/15"
              >
                Inventory
              </Link>
              <Link to="/admin/orders" className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white border border-white/15 hover:bg-white/15">
                Orders
              </Link>
              <Link to="/admin/customers" className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white border border-white/15 hover:bg-white/15">
                Customers
              </Link>
              {crmEnabled && (
                <Link to="/admin/crm/pipeline" className="rounded-lg bg-teal-500/20 px-3 py-1.5 text-xs font-medium text-teal-100 border border-teal-400/30">
                  Sales CRM
                </Link>
              )}
              {canProcessPayments && (
                <Link to="/admin/payments" className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white border border-white/15 hover:bg-white/15">
                  Payments
                </Link>
              )}
            </div>
          </div>
          {storeStatus && user?.role === 'admin' && (
            <button
              type="button"
              onClick={handleStatusToggle}
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 bg-white border border-slate-200 hover:bg-slate-50"
            >
              <span className={`h-2.5 w-2.5 rounded-full ${storeStatus === 'online' ? 'bg-green-500' : 'bg-slate-400'}`} />
              {storeStatus === 'online' ? 'Store Online' : 'Store Offline'}
            </button>
          )}
          <AdminUserStrip variant="mobile" />
        </div>
      </div>

      <div className="flex flex-1 min-h-0 min-w-0 items-stretch">
        <aside className="hidden lg:flex lg:flex-col w-[17.5rem] shrink-0 self-stretch bg-[#0f172a] text-slate-300 border-r border-white/5">
          <div className="p-5 flex-shrink-0 border-b border-white/5">
            <Link to="/" className="text-xl font-bold tracking-tight text-white">
              Grabio
            </Link>
            <p className="text-slate-500 text-xs mt-1 uppercase tracking-wider">{dashboardLabel}</p>
          </div>

          <nav className="flex-1 min-h-0 overflow-y-auto py-4 px-3">
            <div className="space-y-5">
              <Link
                to="/admin/dashboard"
                onMouseEnter={() => preloadAdminRoute('/admin/dashboard')}
                className={`flex items-center px-3 py-2.5 rounded-xl border transition ${
                  isRouteActive('/admin/dashboard')
                    ? 'bg-teal-500/15 text-teal-300 border-teal-500/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                    : 'border-transparent text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <StoreIcon className="h-4 w-4 mr-3 shrink-0" />
                <span className="text-sm font-medium">Dashboard Home</span>
              </Link>

              <section>
                <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Daily Operations
                </div>
                <div className="space-y-1.5">
                  {menuGroups.daily.map((group) => (
                    <div key={group.id} className="rounded-xl border border-white/5 bg-white/[0.02]">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium text-slate-200 hover:text-white"
                        onClick={() => toggleMenuGroup(group.id)}
                      >
                        <span>{group.title}</span>
                        <ChevronDown
                          className={`h-4 w-4 text-slate-500 transition-transform ${openMenuGroups[group.id] ? 'rotate-180' : ''}`}
                        />
                      </button>
                      {openMenuGroups[group.id] && (
                        <div className="space-y-0.5 px-2 pb-2">
                          {group.items
                            .filter((item) => item.visible)
                            .map((item) =>
                              renderSidebarNavItem(
                                item,
                                isRouteActive,
                                'bg-teal-500/15 text-teal-300',
                                'text-slate-400 hover:bg-white/5 hover:text-slate-200',
                              ),
                            )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2 px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <Settings2 className="h-3.5 w-3.5" />
                  <span>Setup & Settings</span>
                </div>
                <div className="space-y-1.5">
                  {menuGroups.setup.map((group) => (
                    <div key={group.id} className="rounded-xl border border-white/5 bg-white/[0.02]">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium text-slate-200 hover:text-white"
                        onClick={() => toggleMenuGroup(group.id)}
                      >
                        <span>{group.title}</span>
                        <ChevronDown
                          className={`h-4 w-4 text-slate-500 transition-transform ${openMenuGroups[group.id] ? 'rotate-180' : ''}`}
                        />
                      </button>
                      {openMenuGroups[group.id] && (
                        <div className="space-y-0.5 px-2 pb-2">
                          {group.items
                            .filter((item) => item.visible)
                            .map((item) =>
                              renderSidebarNavItem(
                                item,
                                isRouteActive,
                                'bg-indigo-500/15 text-indigo-300',
                                'text-slate-400 hover:bg-white/5 hover:text-slate-200',
                              ),
                            )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {user?.role === 'admin' && (
                <Link
                  to="/subscription"
                  onMouseEnter={() => preloadAdminRoute('/subscription')}
                  className={`flex items-center px-3 py-2.5 text-sm font-medium rounded-xl border transition ${
                    isRouteActive('/subscription')
                      ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25'
                      : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <CreditCard className="h-4 w-4 mr-3 text-teal-400" />
                  <span>Subscription</span>
                </Link>
              )}

              <a
                href="/store-owner-guide.html"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center px-3 py-2.5 text-sm font-medium rounded-xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white transition"
              >
                <FileText className="h-4 w-4 mr-3 text-teal-400" />
                <span>Store Owner Guide</span>
              </a>
            </div>
          </nav>

          <div className="shrink-0 border-t border-white/5 p-4">
            <AdminUserStrip variant="sidebar" />
          </div>
        </aside>

        <main className="flex-1 min-w-0 min-h-0 p-4 md:p-6">
          <div className="mx-auto w-full max-w-screen-2xl">
            <Suspense fallback={<AdminPageFallback />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>

      <footer className="shrink-0 w-full border-t border-slate-200 bg-gray-100 py-4 flex flex-col items-center gap-2">
        <div className="text-xs text-gray-500">
          © {new Date().getFullYear()} <PoweredByEmoove />
        </div>
        <div className="text-xs text-gray-600 flex items-center gap-2">
          <Link to="/contact" className="text-market-primary hover:underline font-medium">Contact Us</Link>
          <span className="text-gray-400">·</span>
          <a href="mailto:support@grabio.space" className="text-market-primary hover:underline">support@grabio.space</a>
        </div>
        <Link
          to="/search"
          className="px-4 py-2 rounded bg-market-primary text-white hover:bg-market-primary/90 text-xs font-medium"
        >
          Go to Marketplace
        </Link>
      </footer>
    </div>
  );
}
