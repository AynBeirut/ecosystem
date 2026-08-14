import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronLeft, ChevronRight, CreditCard, FileText } from 'lucide-react';
import { useAuth } from '@/context/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAdminNavigation, type AdminNavItem } from '@/hooks/useAdminNavigation';
import MobileHeader from '@/components/MobileHeader';
import PoweredByEmoove from '@/components/PoweredByEmoove';
import AdminOutletFallback from '@/components/admin/AdminOutletFallback';
import { getActualStoreId } from '@/lib/storeUtils';
import { preloadAdminRoute, preloadCommonAdminRoutes } from '@/lib/adminRoutePreload';
import { doc, getDoc, getFirestore, updateDoc } from 'firebase/firestore';
import AdminThemeToggle from '@/components/admin/AdminThemeToggle';
import { AdminThemeProvider, useAdminTheme } from '@/hooks/useAdminTheme';
import { cn } from '@/lib/utils';

function AdminUserStrip({ variant = 'sidebar' }: { variant?: 'sidebar' | 'mobile' }) {
  const { user } = useAuth();
  const initial = user?.name ? String(user.name).charAt(0) : 'G';
  const isSidebar = variant === 'sidebar';

  return (
    <div
      className={
        isSidebar
          ? 'flex items-center gap-3 min-w-0'
          : 'flex items-center gap-3 min-w-0 rounded-xl px-3 py-2.5 admin-shell-user-mobile'
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
        <p className={`text-sm font-medium truncate ${isSidebar ? 'text-white' : 'text-foreground'}`}>
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
  '/admin/theme-editor': 'Theme Editor',
  '/admin/announcements': 'Announcements',
  '/admin/analytics': 'Analytics',
  '/admin/revenue': 'Revenue',
  '/admin/marketing': 'Email Marketing',
  '/admin/orders': 'Orders',
  '/admin/inventory': 'Inventory',
  '/admin/customers': 'Customers',
  '/admin/purchases': 'Purchases',
  '/admin/finance/account-statement': 'Account Statement',
  '/admin/invoice-manager': 'Invoice Manager',
  '/admin/invoice-manager/invoices': 'Invoice Manager',
  '/admin/staff': 'Staff',
  '/admin/sub-accounts': 'Sub-Accounts',
  '/admin/account-statement': 'Account Statement',
  '/admin/cash-collection': 'Cash Collection',
  '/admin/delivery-wallet': 'Delivery Wallets',
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
  if (pathname.startsWith('/admin/invoice-manager')) return 'Invoice Manager';
  if (pathname.startsWith('/admin/finance')) return 'Business Finance';
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
  collapsed: boolean,
  onNavigate?: () => void,
) {
  const Icon = item.icon;
  const className = cn(
    'flex items-center rounded-lg py-2 text-sm transition',
    collapsed ? 'justify-center px-2 py-2.5' : 'px-2.5',
    isRouteActive(item.to) ? activeClass : inactiveClass,
  );

  const itemKey = `${item.to}::${item.label}`;
  const iconClass = cn('h-4 w-4 shrink-0 opacity-80', !collapsed && 'mr-2.5');

  if (item.external) {
    return (
      <a
        key={itemKey}
        href={item.to}
        className={className}
        title={collapsed ? item.label : undefined}
        onClick={onNavigate}
      >
        <Icon className={iconClass} />
        {!collapsed ? <span>{item.label}</span> : null}
      </a>
    );
  }

  return (
    <Link
      key={itemKey}
      to={item.to}
      title={collapsed ? item.label : undefined}
      onMouseEnter={() => preloadAdminRoute(item.to)}
      onClick={onNavigate}
      className={className}
    >
      <Icon className={iconClass} />
      {!collapsed ? <span>{item.label}</span> : null}
    </Link>
  );
}

type SidebarMode = 'auto' | 'open';

const SIDEBAR_MODE_KEY = 'grabio-admin-sidebar-mode';
const SIDEBAR_EXPANDED_KEY = 'grabio-admin-sidebar-expanded';

function readSidebarMode(): SidebarMode {
  if (typeof window === 'undefined') return 'auto';
  return window.localStorage.getItem(SIDEBAR_MODE_KEY) === 'open' ? 'open' : 'auto';
}

function SidebarModeToggle({
  mode,
  expanded,
  onChange,
}: {
  mode: SidebarMode;
  expanded: boolean;
  onChange: (mode: SidebarMode) => void;
}) {
  if (!expanded) {
    return (
      <button
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-[10px] font-bold uppercase tracking-wide text-slate-300 hover:bg-white/5 hover:text-white"
        title={mode === 'open' ? 'Sidebar pinned open' : 'Sidebar auto-hide'}
        onClick={() => onChange(mode === 'open' ? 'auto' : 'open')}
      >
        {mode === 'open' ? 'O' : 'A'}
      </button>
    );
  }

  return (
    <div
      className="mb-3 flex rounded-lg border border-white/10 bg-black/10 p-0.5 text-[11px] font-medium"
      role="group"
      aria-label="Sidebar behavior"
    >
      <button
        type="button"
        className={cn(
          'flex-1 rounded-md px-2 py-1.5 transition',
          mode === 'auto' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-300 hover:text-white',
        )}
        title="Auto-hide sidebar when you open a page"
        onClick={() => onChange('auto')}
      >
        Auto
      </button>
      <button
        type="button"
        className={cn(
          'flex-1 rounded-md px-2 py-1.5 transition',
          mode === 'open' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-300 hover:text-white',
        )}
        title="Keep sidebar open"
        onClick={() => onChange('open')}
      >
        Open
      </button>
    </div>
  );
}

export default function AdminLayout() {
  return (
    <AdminThemeProvider>
      <AdminLayoutShell />
    </AdminThemeProvider>
  );
}

function AdminLayoutShell() {
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
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(() => readSidebarMode());
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    if (typeof window === 'undefined') return true;
    if (readSidebarMode() === 'open') return true;
    return window.localStorage.getItem(SIDEBAR_EXPANDED_KEY) !== '0';
  });
  const skipInitialCollapse = useRef(true);
  const { theme } = useAdminTheme();
  const pageTitle = resolvePageTitle(location.pathname, dashboardLabel);

  const collapseSidebar = useCallback(() => {
    if (sidebarMode === 'open') return;
    setSidebarExpanded(false);
    window.localStorage.setItem(SIDEBAR_EXPANDED_KEY, '0');
  }, [sidebarMode]);

  const expandSidebar = useCallback(() => {
    setSidebarExpanded(true);
    window.localStorage.setItem(SIDEBAR_EXPANDED_KEY, '1');
  }, []);

  const toggleSidebar = useCallback(() => {
    if (sidebarMode === 'open') return;
    setSidebarExpanded((open) => {
      const next = !open;
      window.localStorage.setItem(SIDEBAR_EXPANDED_KEY, next ? '1' : '0');
      return next;
    });
  }, [sidebarMode]);

  const setSidebarBehavior = useCallback((mode: SidebarMode) => {
    setSidebarMode(mode);
    window.localStorage.setItem(SIDEBAR_MODE_KEY, mode);
    if (mode === 'open') {
      expandSidebar();
      return;
    }
    collapseSidebar();
  }, [collapseSidebar, expandSidebar]);

  const flatSidebarItems = useMemo(() => {
    const seen = new Set<string>();
    return [...menuGroups.daily, ...menuGroups.setup].flatMap((group) =>
      group.items.filter((item) => {
        if (!item.visible || seen.has(item.to)) return false;
        seen.add(item.to);
        return true;
      }),
    );
  }, [menuGroups.daily, menuGroups.setup]);

  useEffect(() => {
    document.title = `${pageTitle} — Grabio`;
  }, [pageTitle]);

  useEffect(() => {
    if (sidebarMode === 'open' && !sidebarExpanded) {
      expandSidebar();
    }
  }, [expandSidebar, sidebarExpanded, sidebarMode]);

  useEffect(() => {
    if (sidebarMode === 'open') return;
    if (skipInitialCollapse.current) {
      skipInitialCollapse.current = false;
      return;
    }
    collapseSidebar();
  }, [location.pathname, collapseSidebar, sidebarMode]);

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
    if (location.pathname.startsWith('/admin/finance')) {
      preloadAdminRoute('/admin/finance/accounting');
    } else if (location.pathname.startsWith('/admin/invoice-manager')) {
      preloadAdminRoute('/admin/invoice-manager/invoices');
    }
  }, [location.pathname]);

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
    <div
      data-admin-theme={theme}
      className={cn(
        'min-h-screen text-foreground flex flex-col bg-background',
      )}
    >
      {isMobile && (
        <MobileHeader title={pageTitle} showBackButton={false} showHomeButton />
      )}

      <div className="md:hidden px-4 pt-3 pb-3 border-b backdrop-blur-md shrink-0 admin-shell-mobile-bar">
        <div className="space-y-3">
          <div className="admin-shell-mobile-hero px-3 py-3">
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
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs admin-shell-status-btn"
            >
              <span className={`h-2.5 w-2.5 rounded-full ${storeStatus === 'online' ? 'bg-green-500' : 'bg-slate-400'}`} />
              {storeStatus === 'online' ? 'Store Online' : 'Store Offline'}
            </button>
          )}
          <AdminThemeToggle variant="compact" className="admin-theme-toggle" />
          <AdminUserStrip variant="mobile" />
        </div>
      </div>

      <div className="flex flex-1 min-h-0 min-w-0 items-stretch">
        <aside
          className={cn(
            'admin-shell-sidebar hidden lg:flex lg:flex-col shrink-0 self-stretch relative transition-[width] duration-300 ease-in-out overflow-hidden',
            sidebarExpanded ? 'w-[17.5rem]' : 'w-16',
          )}
        >
          <button
            type="button"
            onClick={toggleSidebar}
            disabled={sidebarMode === 'open'}
            className={cn(
              'admin-shell-sidebar-toggle absolute -right-3 top-5 z-10 flex h-6 w-6 items-center justify-center rounded-full border shadow-sm',
              sidebarMode === 'open' && 'cursor-default opacity-40',
            )}
            aria-label={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
            title={
              sidebarMode === 'open'
                ? 'Pinned open — switch to Auto to collapse'
                : sidebarExpanded
                  ? 'Collapse menu'
                  : 'Open menu'
            }
          >
            {sidebarExpanded ? (
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            )}
          </button>

          <div className={cn('flex-shrink-0 border-b border-border/50', sidebarExpanded ? 'p-5' : 'p-3')}>
            <Link
              to="/"
              className={cn(
                'font-bold tracking-tight text-white',
                sidebarExpanded ? 'text-xl' : 'flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600 text-sm',
              )}
              title="Grabio home"
            >
              {sidebarExpanded ? 'Grabio' : 'G'}
            </Link>
            {sidebarExpanded ? (
              <p className="admin-shell-section-label text-xs mt-1 uppercase tracking-wider">{dashboardLabel}</p>
            ) : null}
          </div>

          <nav className="flex-1 min-h-0 overflow-y-auto py-4 px-2">
            {sidebarExpanded ? (
            <div className="space-y-5 px-1">
              <Link
                to="/admin/dashboard"
                onMouseEnter={() => preloadAdminRoute('/admin/dashboard')}
                onClick={collapseSidebar}
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
                <div className="admin-shell-section-label px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em]">
                  Daily Operations
                </div>
                <div className="space-y-1.5">
                  {menuGroups.daily.map((group) => (
                    <div key={group.id} className="admin-shell-nav-group">
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
                                false,
                                collapseSidebar,
                              ),
                            )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <div className="admin-shell-section-label flex items-center gap-2 px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em]">
                  <Settings2 className="h-3.5 w-3.5" />
                  <span>Setup & Settings</span>
                </div>
                <div className="space-y-1.5">
                  {menuGroups.setup.map((group) => (
                    <div key={group.id} className="admin-shell-nav-group">
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
                                false,
                                collapseSidebar,
                              ),
                            )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              <AdminThemeToggle className="admin-theme-toggle" />

              {user?.role === 'admin' && (
                <Link
                  to="/subscription"
                  onMouseEnter={() => preloadAdminRoute('/subscription')}
                  onClick={collapseSidebar}
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
            ) : (
            <div className="space-y-1">
              <Link
                to="/admin/dashboard"
                title="Dashboard Home"
                onMouseEnter={() => preloadAdminRoute('/admin/dashboard')}
                onClick={collapseSidebar}
                className={cn(
                  'flex items-center justify-center rounded-lg py-2.5 transition',
                  isRouteActive('/admin/dashboard')
                    ? 'bg-teal-500/15 text-teal-300'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
                )}
              >
                <StoreIcon className="h-4 w-4 shrink-0 opacity-90" />
              </Link>
              {flatSidebarItems.map((item) =>
                renderSidebarNavItem(
                  item,
                  isRouteActive,
                  'bg-teal-500/15 text-teal-300',
                  'text-slate-400 hover:bg-white/5 hover:text-slate-200',
                  true,
                  collapseSidebar,
                ),
              )}
              <div className="pt-2 flex justify-center">
                <AdminThemeToggle variant="compact" className="admin-theme-toggle" />
              </div>
              {user?.role === 'admin' ? (
                <Link
                  to="/subscription"
                  title="Subscription"
                  onMouseEnter={() => preloadAdminRoute('/subscription')}
                  onClick={collapseSidebar}
                  className={cn(
                    'flex items-center justify-center rounded-lg py-2.5 transition',
                    isRouteActive('/subscription')
                      ? 'bg-indigo-500/15 text-indigo-300'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
                  )}
                >
                  <CreditCard className="h-4 w-4 shrink-0 text-teal-400" />
                </Link>
              ) : null}
            </div>
            )}
          </nav>

          <div className={cn('shrink-0 border-t border-border/50', sidebarExpanded ? 'p-4' : 'p-2 flex flex-col items-center gap-2')}>
            <SidebarModeToggle mode={sidebarMode} expanded={sidebarExpanded} onChange={setSidebarBehavior} />
            {sidebarExpanded ? (
              <AdminUserStrip variant="sidebar" />
            ) : (
              <button
                type="button"
                onClick={expandSidebar}
                className="h-9 w-9 rounded-lg bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center text-white text-sm font-semibold shadow-md"
                title="Open menu"
              >
                {(user?.name ? String(user.name).charAt(0) : 'G')}
              </button>
            )}
          </div>
        </aside>

        <main className="flex-1 min-w-0 min-h-0 p-4 md:p-6">
          <div className="mx-auto w-full max-w-screen-2xl">
            <Suspense fallback={<AdminOutletFallback />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>

      <footer className="shrink-0 w-full border-t py-4 flex flex-col items-center gap-2 admin-shell-footer">
        <div className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} <PoweredByEmoove />
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Link to="/contact" className="text-primary hover:underline font-medium">Contact Us</Link>
          <span className="opacity-40">·</span>
          <a href="mailto:support@grabio.space" className="text-primary hover:underline">support@grabio.space</a>
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
