
import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
// tabs import removed (unused)
import { 
  Store as StoreIcon, 
  Package, 
  CreditCard, 
  Clock, 
  User, 
  Users,
  Palette, 
  Megaphone,
  BarChart,
  ShoppingCart,
  FileText,
  Undo2,
  DollarSign,
  Mail,
  Globe,
  TrendingUp,
  Star,
  Bell,
  ChevronDown,
  Settings2,
  Layers
} from 'lucide-react';
import { getFirestore, doc, getDoc, collection, query, where, getDocs, updateDoc, orderBy, limit } from 'firebase/firestore';
import { fetchUsdToLbpRateFresh, getUsdToLbpRate, formatLbp } from '@/lib/currency';
import MobileHeader from '@/components/MobileHeader';
import { useIsMobile } from '@/hooks/use-mobile';
import { isCountedSaleStatus } from '@/lib/salesRules';
import { requestNotificationPermission, saveFcmToken } from '@/lib/notifications';

type RecentEvent = {
  type: 'product' | 'order' | 'announcement';
  name?: string;
  total?: number;
  title?: string;
  createdAt?: Date | number | string;
};

type QuickActionItem = {
  id: string;
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  visible: boolean;
};

type QuickActionStoragePayload = {
  selectedQuickActionIds: string[];
  customQuickActions: QuickActionItem[];
};

const QUICK_ACTION_COLORS: Record<string, { border: string; iconBg: string; iconText: string }> = {
  inventory: { border: 'border-purple-600/20', iconBg: 'bg-purple-100', iconText: 'text-purple-600' },
  orders: { border: 'border-orange-500/20', iconBg: 'bg-orange-100', iconText: 'text-orange-600' },
  'account-statement': { border: 'border-indigo-600/20', iconBg: 'bg-indigo-100', iconText: 'text-indigo-600' },
  'cash-collection': { border: 'border-emerald-600/20', iconBg: 'bg-emerald-100', iconText: 'text-emerald-700' },
  'service-renewals': { border: 'border-blue-600/20', iconBg: 'bg-blue-100', iconText: 'text-blue-700' },
  'marketplace-sync': { border: 'border-amber-600/20', iconBg: 'bg-amber-100', iconText: 'text-amber-700' },
  'product-reviews': { border: 'border-yellow-600/20', iconBg: 'bg-yellow-100', iconText: 'text-yellow-700' },
  'notification-logs': { border: 'border-sky-600/20', iconBg: 'bg-sky-100', iconText: 'text-sky-700' },
  'store-logs': { border: 'border-slate-600/20', iconBg: 'bg-slate-100', iconText: 'text-slate-700' },
  delivery: { border: 'border-gray-300/70', iconBg: 'bg-gray-100', iconText: 'text-gray-700' },
  announcements: { border: 'border-rose-500/20', iconBg: 'bg-rose-100', iconText: 'text-rose-700' },
  analytics: { border: 'border-cyan-600/20', iconBg: 'bg-cyan-100', iconText: 'text-cyan-700' },
};

const AdminDashboard: React.FC = () => {
  // Defensive: calling `useAuth` normally; ensure consumer handles undefined user safely.
  // If the auth hook throws or returns unexpectedly during HMR, this component will
  // still render a guest-safe UI because we guard accesses to `user` below.
  type MinimalAuth = { user: { id?: string; name?: string; email?: string } | null } | null;
  const auth = (() => {
    try {
      // NOTE: This is a defensive wrapper. The hook is still called as a React hook
      // but in very rare HMR failure modes it may throw; we catch and return a
      // minimal null-shaped object so the page remains usable.
      // eslint-disable-next-line react-hooks/rules-of-hooks
      return useAuth() as MinimalAuth;
    } catch (e) {
      console.warn('useAuth unavailable in AdminDashboard fallback', e);
      return { user: null } as MinimalAuth;
    }
  })();
  const { user } = (auth as MinimalAuth) || { user: null };
  const navigate = useNavigate();
  const location = useLocation();
  const [store, setStore] = useState<Record<string, unknown> | null>(null);
  const [productCount, setProductCount] = useState(0);
  const [orderCount, setOrderCount] = useState(0);
  const [revenue, setRevenue] = useState(0);
  const [quarantinedRevenueOrders, setQuarantinedRevenueOrders] = useState(0);
  const [usdToLbpRate, setUsdToLbpRate] = useState<number | null>(null);
  const [rateFetchedAt, setRateFetchedAt] = useState<number | null>(null);
  const [editingRate, setEditingRate] = useState(false);
  const [editRateValue, setEditRateValue] = useState<string>('');
  const [savingRate, setSavingRate] = useState(false);
  const [exchangeRateMode, setExchangeRateMode] = useState<'manual' | 'auto'>('manual');
  const [syncingAutoRate, setSyncingAutoRate] = useState(false);
  // Credits feature removed
  const [customerCount, setCustomerCount] = useState(0);
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [selectedQuickActionIds, setSelectedQuickActionIds] = useState<string[]>([]);
  const [customQuickActions, setCustomQuickActions] = useState<QuickActionItem[]>([]);
  const [showQuickActionManager, setShowQuickActionManager] = useState(false);
  const [quickActionsLoaded, setQuickActionsLoaded] = useState(false);
  const [newQuickActionLabel, setNewQuickActionLabel] = useState('');
  const [newQuickActionPath, setNewQuickActionPath] = useState('');

  const syncAutoRateForStore = async (actualStoreId: string) => {
    setSyncingAutoRate(true);
    try {
      const fresh = await fetchUsdToLbpRateFresh();
      const db = getFirestore();
      const profileRef = doc(db, 'storeProfiles', actualStoreId);
      await updateDoc(profileRef, {
        customExchangeRate: fresh.rate,
        usdToLbpRate: fresh.rate,
        exchangeRateMode: 'auto',
        exchangeRateProvider: 'exchangerate.host',
        exchangeRateBaseCurrency: 'USD',
        exchangeRateQuoteCurrency: 'LBP',
        exchangeRateLastAutoUpdatedAt: new Date(fresh.fetchedAt).toISOString(),
        exchangeRateLastAutoStatus: 'success',
        exchangeRateLastAutoMessage: '',
      });

      setUsdToLbpRate(fresh.rate);
      setRateFetchedAt(fresh.fetchedAt);
      setEditRateValue(String(fresh.rate));
      setStore((prev) => ({
        ...(prev as Record<string, unknown>),
        customExchangeRate: fresh.rate,
        usdToLbpRate: fresh.rate,
        exchangeRateMode: 'auto',
        exchangeRateLastAutoUpdatedAt: new Date(fresh.fetchedAt).toISOString(),
      }));
    } catch (err) {
      console.warn('Failed to sync auto exchange rate', err);
      try {
        const db = getFirestore();
        const profileRef = doc(db, 'storeProfiles', actualStoreId);
        await updateDoc(profileRef, {
          exchangeRateLastAutoStatus: 'error',
          exchangeRateLastAutoMessage: err instanceof Error ? err.message : 'Failed to refresh rate',
        });
      } catch (writeErr) {
        console.warn('Failed to write exchange rate error metadata', writeErr);
      }
    } finally {
      setSyncingAutoRate(false);
    }
  };

  // Access control is handled by ProtectedRoute; avoid imperative redirects here.
  // Use `useIsMobile` unconditionally so mobile-specific UI (header/quick-actions)
  // appears based on viewport size even while auth is resolving.
  const isMobile = useIsMobile();
  
  // Permission checks for sub-accounts
  const canViewInventory = user?.role === 'admin' || user?.permissions?.includes('view_inventory');
  const canManageInventory = user?.role === 'admin' || user?.permissions?.includes('manage_inventory');
  const canViewReports = user?.role === 'admin' || user?.permissions?.includes('view_reports');
  const canManageDeliveries = user?.role === 'admin' || user?.permissions?.includes('manage_deliveries');
  const canProcessPayments = user?.role === 'admin' || user?.permissions?.includes('process_payments');

  const quickActionStorageKey = useMemo(() => {
    if (!user?.id) return 'dashboardQuickActions:guest';
    const ownerKey = getActualStoreId(user) || user.id;
    return `dashboardQuickActions:${ownerKey}`;
  }, [user]);

  const quickActionItems = useMemo<QuickActionItem[]>(() => [
    {
      id: 'inventory',
      to: user?.role === 'admin' ? '/admin/inventory' : '/admin/products',
      label: user?.role === 'admin' ? 'Inventory' : 'Products',
      icon: Package,
      visible: canViewInventory,
    },
    { id: 'orders', to: '/admin/orders', label: 'Orders', icon: Clock, visible: true },
    { id: 'account-statement', to: '/admin/account-statement', label: 'Account Statement', icon: FileText, visible: user?.role === 'admin' },
    { id: 'cash-collection', to: '/admin/cash-collection', label: 'Cash Collection', icon: DollarSign, visible: user?.role === 'admin' },
    { id: 'service-renewals', to: '/admin/service-renewals', label: 'Service Renewals', icon: Clock, visible: user?.role === 'admin' },
    { id: 'marketplace-sync', to: '/admin/marketplace', label: 'Marketplace Sync', icon: Globe, visible: user?.role === 'admin' },
    { id: 'product-reviews', to: '/admin/product-reviews', label: 'Product Reviews', icon: Star, visible: user?.role === 'admin' },
    { id: 'notification-logs', to: '/admin/order-notifications', label: 'Notification Logs', icon: Bell, visible: user?.role === 'admin' },
    { id: 'store-logs', to: '/admin/audit-logs', label: 'Store Logs', icon: FileText, visible: user?.role === 'admin' },
    { id: 'delivery', to: '/admin/delivery', label: 'Delivery', icon: Package, visible: canManageDeliveries },
    { id: 'announcements', to: '/admin/announcements', label: 'Announcements', icon: Megaphone, visible: true },
    { id: 'analytics', to: '/admin/analytics', label: 'Analytics', icon: BarChart, visible: canViewReports },
  ], [canManageDeliveries, canViewInventory, canViewReports, user]);

  const visibleQuickActionItems = useMemo(
    () => quickActionItems.filter((item) => item.visible),
    [quickActionItems],
  );

  const allQuickActionItems = useMemo(
    () => [...visibleQuickActionItems, ...customQuickActions],
    [customQuickActions, visibleQuickActionItems],
  );

  useEffect(() => {
    const visibleIds = visibleQuickActionItems.map((item) => item.id);
    if (visibleIds.length === 0) {
      setSelectedQuickActionIds([]);
      setQuickActionsLoaded(true);
      return;
    }

    try {
      const raw = localStorage.getItem(quickActionStorageKey);
      const parsed = raw ? JSON.parse(raw) : null;

      let storedIds: string[] = [];
      let storedCustomActions: QuickActionItem[] = [];

      if (Array.isArray(parsed)) {
        storedIds = parsed;
      } else if (parsed && typeof parsed === 'object') {
        const payload = parsed as Partial<QuickActionStoragePayload>;
        if (Array.isArray(payload.selectedQuickActionIds)) {
          storedIds = payload.selectedQuickActionIds;
        }
        if (Array.isArray(payload.customQuickActions)) {
          storedCustomActions = payload.customQuickActions.filter((item): item is QuickActionItem => {
            return !!item && typeof item.id === 'string' && typeof item.to === 'string' && typeof item.label === 'string';
          }).map((item) => ({
            ...item,
            visible: true,
            icon: Layers,
          }));
        }
      }

      setCustomQuickActions(storedCustomActions);
      const storedCustomIds = storedCustomActions.map((item) => item.id);
      const sanitized = storedIds.filter((id) => visibleIds.includes(id) || storedCustomIds.includes(id));
      setSelectedQuickActionIds(sanitized.length > 0 ? sanitized : visibleIds);
    } catch {
      setCustomQuickActions([]);
      setSelectedQuickActionIds(visibleIds);
    }
    setQuickActionsLoaded(true);
  }, [quickActionStorageKey, visibleQuickActionItems]);

  useEffect(() => {
    if (!quickActionsLoaded) return;
    const payload: QuickActionStoragePayload = {
      selectedQuickActionIds,
      customQuickActions: customQuickActions.map((item) => ({ ...item, icon: Layers, visible: true })),
    };
    localStorage.setItem(quickActionStorageKey, JSON.stringify(payload));
  }, [customQuickActions, quickActionStorageKey, quickActionsLoaded, selectedQuickActionIds]);

  const selectedQuickActions = useMemo(
    () => allQuickActionItems.filter((item) => selectedQuickActionIds.includes(item.id)),
    [allQuickActionItems, selectedQuickActionIds],
  );

  const addableQuickActions = useMemo(
    () => visibleQuickActionItems.filter((item) => !selectedQuickActionIds.includes(item.id)),
    [selectedQuickActionIds, visibleQuickActionItems],
  );

  const handleAddQuickAction = (actionId: string) => {
    setSelectedQuickActionIds((prev) => (prev.includes(actionId) ? prev : [...prev, actionId]));
  };

  const handleRemoveQuickAction = (actionId: string) => {
    setSelectedQuickActionIds((prev) => prev.filter((id) => id !== actionId));
    setCustomQuickActions((prev) => prev.filter((item) => item.id !== actionId));
  };

  const handleAddCustomQuickAction = () => {
    const label = newQuickActionLabel.trim();
    const pathInput = newQuickActionPath.trim();
    if (!label || !pathInput) return;

    const normalizedPath = pathInput.startsWith('/') ? pathInput : `/${pathInput}`;
    const actionId = `custom:${Date.now()}`;
    const customAction: QuickActionItem = {
      id: actionId,
      to: normalizedPath,
      label,
      icon: Layers,
      visible: true,
    };

    setCustomQuickActions((prev) => [...prev, customAction]);
    setSelectedQuickActionIds((prev) => [...prev, actionId]);
    setNewQuickActionLabel('');
    setNewQuickActionPath('');
  };

  const [openMenuGroups, setOpenMenuGroups] = useState<Record<string, boolean>>({
    daily_stock: false,
    daily_sales: false,
    setup_profile: false,
    setup_system: false,
  });

  const toggleMenuGroup = (groupId: string) => {
    setOpenMenuGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const isRouteActive = (route: string) => location.pathname === route;

  const menuGroups = {
    daily: [
      {
        id: 'daily_stock',
        title: 'Stock & Catalog',
        items: [
          { to: user?.role === 'admin' ? '/admin/inventory' : '/admin/products', label: user?.role === 'admin' ? 'Inventory Overview' : 'Products', icon: Package, visible: canViewInventory },
          { to: '/admin/products', label: 'Products', icon: Package, visible: canViewInventory },
          { to: '/admin/purchases', label: 'Purchases', icon: ShoppingCart, visible: canManageInventory },
          { to: '/admin/delivery', label: 'Delivery', icon: Clock, visible: canManageDeliveries },
        ],
      },
      {
        id: 'daily_sales',
        title: 'Sales & Customers',
        items: [
          { to: '/admin/orders', label: 'Orders', icon: Package, visible: true },
          { to: '/admin/customers', label: 'Customers', icon: Users, visible: true },
          { to: '/admin/payments', label: 'Payments', icon: CreditCard, visible: canProcessPayments },
          { to: '/admin/analytics', label: 'Analytics', icon: BarChart, visible: canViewReports },
        ],
      },
    ],
    setup: [
      {
        id: 'setup_profile',
        title: 'Profile & Store Setup',
        items: [
          { to: '/admin/profile', label: 'Store Profile', icon: User, visible: user?.role === 'admin' },
          { to: '/admin/payments', label: 'Payment Settings', icon: CreditCard, visible: user?.role === 'admin' && canProcessPayments },
          { to: '/admin/templates', label: 'Templates & Store Logos', icon: Palette, visible: user?.role === 'admin' },
          { to: '/admin/announcements', label: 'Announcements', icon: Megaphone, visible: true },
          { to: '/admin/marketing', label: 'Email Marketing', icon: Mail, visible: canViewReports },
          { to: '/admin/seo-analytics', label: 'SEO Analytics', icon: TrendingUp, visible: user?.role === 'admin' },
          { to: '/admin/seo-audit', label: 'SEO Audit (GSC)', icon: Globe, visible: user?.role === 'admin' },
        ],
      },
      {
        id: 'setup_system',
        title: 'Business Tools',
        items: [
          { to: '/admin/finance', label: 'Finance Suite', icon: DollarSign, visible: user?.role === 'admin' },
          { to: '/admin/account-statement', label: 'Account Statement', icon: FileText, visible: user?.role === 'admin' },
          { to: '/admin/cash-collection', label: 'Cash Collection', icon: DollarSign, visible: user?.role === 'admin' },
          { to: '/admin/staff', label: 'Staff (Payroll)', icon: Users, visible: user?.role === 'admin' },
          { to: '/admin/sub-accounts', label: 'Sub-Accounts', icon: Users, visible: user?.role === 'admin' },
          { to: '/admin/marketplace', label: 'Marketplace Sync', icon: Globe, visible: user?.role === 'admin' },
          { to: '/admin/audit-logs', label: 'Store Logs', icon: FileText, visible: user?.role === 'admin' },
        ],
      },
    ],
  };

  // Set document title based on user role
  useEffect(() => {
    document.title = user?.role === 'sub_account' ? 'Seller Dashboard' : 'Admin Dashboard';
  }, [user?.role]);

  // Request FCM push notification permission and save token for store owners
  useEffect(() => {
    if (!user?.id || !user?.storeId) return;
    // Only request for admin and sub_account roles (not regular customers)
    if (user.role !== 'admin' && user.role !== 'sub_account') return;
    requestNotificationPermission()
      .then(token => { if (token && user.id) saveFcmToken(user.id, token); })
      .catch(err => console.warn('FCM setup failed:', err));
  // Run once per session when user is known
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Mount/unmount instrumentation removed after verification.

  useEffect(() => {
    const fetchStats = async () => {
      if (!user?.id) {
        // No authenticated store user yet; clear stats and exit early.
        setStore(null);
        setProductCount(0);
        setOrderCount(0);
        setRevenue(0);
        setQuarantinedRevenueOrders(0);
        setCustomerCount(0);
        setRecentEvents([]);
        return;
      }
      try {
        const db = getFirestore();
        // Use storeId for sub-accounts, user.id for regular admins
        const actualStoreId = getActualStoreId(user);
        if (!actualStoreId) return;
        
        // Store profile
        const profileRef = doc(db, 'storeProfiles', actualStoreId);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          const profileData = profileSnap.data() as Record<string, unknown>;
          setStore(profileData);
          const storedMode = profileData?.exchangeRateMode === 'auto' ? 'auto' : 'manual';
          setExchangeRateMode(storedMode);

          // Prefer unified customExchangeRate, with usdToLbpRate retained as legacy fallback.
          const storedRateRaw = typeof profileData?.customExchangeRate === 'number'
            ? profileData.customExchangeRate
            : profileData?.usdToLbpRate;

          if (storedRateRaw && typeof storedRateRaw === 'number') {
            const rateVal = storedRateRaw as number;
            setUsdToLbpRate(rateVal);
            // DocumentSnapshot doesn't expose updateTime on the client SDK types; use now.
            setRateFetchedAt(Date.now());
            setEditRateValue(String(rateVal));
          }

          if (storedMode === 'auto') {
            void syncAutoRateForStore(actualStoreId);
          }
        } else {
          setStore(null);
        }
        const productsRef = collection(db, 'products');
        const ordersRef = collection(db, 'orders');
        const announcementsRef = collection(db, 'announcements');

        const productsQuery = query(productsRef, where('storeId', '==', actualStoreId));
        const ordersQuery = query(ordersRef, where('storeId', '==', actualStoreId));
        const recentAnnouncementsQuery = query(announcementsRef, where('storeId', '==', actualStoreId), orderBy('createdAt', 'desc'), limit(1));

        // Fetch dashboard datasets in parallel for faster page load.
        const [productsSnap, ordersSnap, recentAnnouncementsSnap] = await Promise.all([
          getDocs(productsQuery),
          getDocs(ordersQuery),
          getDocs(recentAnnouncementsQuery),
        ]);

        setProductCount(productsSnap.size);
        setOrderCount(ordersSnap.size);
        // Revenue and customers
        let totalRevenue = 0;
        let invalidRevenueRows = 0;
        const customerSet = new Set();
        ordersSnap.forEach(doc => {
          const data = doc.data();
          if (!isCountedSaleStatus(data.status)) return;
          const orderTotal = typeof data.total === 'number' ? data.total : Number(data.total);
          if (!Number.isFinite(orderTotal) || orderTotal < 0) {
            invalidRevenueRows += 1;
            return;
          }
          totalRevenue += orderTotal;
          if (data.customerId) customerSet.add(data.customerId);
        });
        setRevenue(totalRevenue);
        setQuarantinedRevenueOrders(invalidRevenueRows);
        // Fetch a fallback rate in background if no stored rate exists.
        if (!profileSnap.exists() || (!profileSnap.data()?.customExchangeRate && !profileSnap.data()?.usdToLbpRate)) {
          getUsdToLbpRate().then(r => {
            setUsdToLbpRate(r.rate);
            setRateFetchedAt(r.fetchedAt);
          }).catch(() => {
            // ignore
          });
        }
        setCustomerCount(customerSet.size);
        // Recent Activity: derive from fetched docs to avoid duplicate Firestore reads.
        const events: RecentEvent[] = [];
        productsSnap.docs
          .sort((a, b) => {
            const ta = a.data().createdAt?.toDate?.()?.getTime?.() || new Date(String(a.data().createdAt || 0)).getTime() || 0;
            const tb = b.data().createdAt?.toDate?.()?.getTime?.() || new Date(String(b.data().createdAt || 0)).getTime() || 0;
            return tb - ta;
          })
          .slice(0, 2)
          .forEach(doc => {
          events.push({
            type: 'product',
            name: doc.data().name,
            createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
          });
        });

        ordersSnap.docs
          .sort((a, b) => {
            const ta = a.data().createdAt?.toDate?.()?.getTime?.() || new Date(String(a.data().createdAt || 0)).getTime() || 0;
            const tb = b.data().createdAt?.toDate?.()?.getTime?.() || new Date(String(b.data().createdAt || 0)).getTime() || 0;
            return tb - ta;
          })
          .slice(0, 2)
          .forEach(doc => {
          events.push({
            type: 'order',
            total: doc.data().total,
            createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
          });
        });

        recentAnnouncementsSnap.forEach(doc => {
          events.push({
            type: 'announcement',
            title: doc.data().title,
            createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
          });
        });
        // Sort all events by createdAt desc
        events.sort((a, b) => {
          const ta = a.createdAt ? +new Date(String(a.createdAt)) : 0;
          const tb = b.createdAt ? +new Date(String(b.createdAt)) : 0;
          return tb - ta;
        });
        setRecentEvents(events.slice(0, 5));
      } catch (err) {
        // If any of the Firestore calls fail, surface a console warning and keep UI usable.
        console.warn('Failed to fetch admin stats', err);
      }
    };
    fetchStats();
  }, [user]);

  // credits toggle removed

  // Derive a safe store name string for rendering
  const storeName: string = (() => {
    try {
      const s = store as Record<string, unknown> | null;
      if (s && typeof s.name === 'string') return s.name as string;
    } catch (e) {
      // ignore
    }
    return 'AYN BEIRUT';
  })();

  // Toggle store online/offline
  const handleStatusToggle = async () => {
    if (!user?.id || !store) return;
    const actualStoreId = getActualStoreId(user);
    if (!actualStoreId) return;
    try {
      const db = getFirestore();
      const profileRef = doc(db, 'storeProfiles', actualStoreId);
      const newStatus = store.status === 'online' ? 'offline' : 'online';
      await updateDoc(profileRef, { status: newStatus });
      setStore({ ...store, status: newStatus });
    } catch (err) {
      console.warn('Failed to toggle store status', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
    {isMobile && <MobileHeader title={user?.role === 'sub_account' ? "Seller Dashboard" : "Admin Dashboard"} showBackButton={false} showHomeButton={true} />}
    <div className="md:hidden px-4 pt-3 pb-2 bg-white border-b">
      <div className="space-y-3">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Daily Operations</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link to={user?.role === 'admin' ? '/admin/inventory' : '/admin/products'} className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-gray-700 border border-emerald-200">Inventory</Link>
            <Link to="/admin/orders" className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-gray-700 border border-emerald-200">Orders</Link>
            <Link to="/admin/customers" className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-gray-700 border border-emerald-200">Customers</Link>
            {canProcessPayments && <Link to="/admin/payments" className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-gray-700 border border-emerald-200">Payments</Link>}
          </div>
        </div>

        <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Setup & Settings</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link to="/admin/profile" className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-gray-700 border border-indigo-200">Profile</Link>
            <Link to="/admin/templates" className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-gray-700 border border-indigo-200">Templates & Store Logos</Link>
            <Link to="/admin/announcements" className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-gray-700 border border-indigo-200">Announcements</Link>
            <Link to="/admin/marketing" className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-gray-700 border border-indigo-200">Email Marketing</Link>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <button onClick={handleStatusToggle} className="flex items-center gap-2 rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100">
            <div className={`h-3 w-3 rounded-full ${store?.status === 'online' ? 'bg-green-500' : 'bg-gray-400'}`} />
            <span>{store?.status === 'online' ? 'Store Online' : 'Store Offline'}</span>
          </button>
          <a href="/store-owner-guide.html" target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-indigo-700">Open Guide</a>
        </div>
      </div>
    </div>
  <div className="flex">
  <aside className="hidden lg:flex lg:flex-col w-64 bg-white shadow-sm h-screen sticky top-0">
        <div className="p-6 flex-shrink-0">
          <Link to="/" className="text-2xl font-bold text-market-primary">Grabio</Link>
          <p className="text-gray-500 text-sm mt-1">{user?.role === 'sub_account' ? 'Seller Dashboard' : 'Admin Dashboard'}</p>
        </div>
        <nav className="mt-6 flex-1 overflow-y-auto pb-24">
          <div className="px-4 space-y-4">
            <Link to="/admin/dashboard" className={`flex items-center px-3 py-2 rounded-lg border transition ${isRouteActive('/admin/dashboard') ? 'bg-market-primary/10 text-market-primary border-market-primary/20' : 'bg-white text-gray-700 border-gray-100 hover:shadow-sm'}`}>
              <StoreIcon className="h-5 w-5 mr-3" />
              <span className="font-medium">Dashboard Home</span>
            </Link>

            <section className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-2">
              <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Daily Operations</div>
              <div className="space-y-2">
                {menuGroups.daily.map((group) => (
                  <div key={group.id} className="rounded-lg border border-emerald-200/70 bg-white">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-gray-800"
                      onClick={() => toggleMenuGroup(group.id)}
                    >
                      <span>{group.title}</span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${openMenuGroups[group.id] ? 'rotate-180' : ''}`} />
                    </button>
                    {openMenuGroups[group.id] && (
                      <div className="space-y-1 px-2 pb-2">
                        {group.items.filter((item) => item.visible).map((item) => {
                          const Icon = item.icon;
                          return (
                            <Link
                              key={item.to}
                              to={item.to}
                              className={`flex items-center rounded-md px-2 py-2 text-sm transition ${isRouteActive(item.to) ? 'bg-emerald-100 text-emerald-900' : 'text-gray-600 hover:bg-emerald-50'}`}
                            >
                              <Icon className="mr-2 h-4 w-4" />
                              <span>{item.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-2">
              <div className="flex items-center gap-2 px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-700">
                <Settings2 className="h-3.5 w-3.5" />
                <span>Setup & Settings</span>
              </div>
              <div className="space-y-2">
                {menuGroups.setup.map((group) => (
                  <div key={group.id} className="rounded-lg border border-indigo-200/70 bg-white">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-gray-800"
                      onClick={() => toggleMenuGroup(group.id)}
                    >
                      <span>{group.title}</span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${openMenuGroups[group.id] ? 'rotate-180' : ''}`} />
                    </button>
                    {openMenuGroups[group.id] && (
                      <div className="space-y-1 px-2 pb-2">
                        {group.items.filter((item) => item.visible).map((item) => {
                          const Icon = item.icon;
                          return (
                            <Link
                              key={item.to}
                              to={item.to}
                              className={`flex items-center rounded-md px-2 py-2 text-sm transition ${isRouteActive(item.to) ? 'bg-indigo-100 text-indigo-900' : 'text-gray-600 hover:bg-indigo-50'}`}
                            >
                              <Icon className="mr-2 h-4 w-4" />
                              <span>{item.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <a href="/store-owner-guide.html" target="_blank" rel="noopener noreferrer" className="flex items-center px-3 py-2 text-indigo-700 font-semibold rounded-lg bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition">
              <FileText className="h-5 w-5 mr-3 text-indigo-600" />
              <span>Store Owner Guide</span>
            </a>
          </div>
        </nav>
          <div className="absolute inset-x-0 -bottom-3 border-t bg-white px-6 pt-3 pb-3">
          <div className="flex items-center">
            <div className="h-10 w-10 rounded-full bg-market-primary flex items-center justify-center text-white">
              {user?.name ? String(user.name).charAt(0) : 'G'}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">{user?.name || 'Guest'}</p>
              <p className="text-xs text-gray-500">{user?.email || ''}</p>
            </div>
          </div>
          <Button variant="outline" className="w-full mt-3" onClick={() => navigate('/')}>View Marketplace</Button>
        </div>
      </aside>
      <div className="flex-1 p-6">
        {/* Main content: full width with max constraint */}
        <div className="mx-auto w-full max-w-screen-2xl">
          <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900">{user?.role === 'sub_account' ? 'Seller Dashboard' : 'Admin Dashboard'}</h1>
              <p className="text-sm text-gray-600 mt-1">Welcome back, {user?.name || 'Store Owner'}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Overview</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link to="/admin/inventory" className="h-full">
              <Card className="h-full min-h-[140px] p-4 cursor-pointer hover:shadow-md transition-shadow overflow-hidden">
                <CardContent className="h-full flex items-center gap-4">
                  <div className="h-12 w-12 rounded-md bg-market-primary text-white flex items-center justify-center">
                    <Package className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Products</div>
                    <div className="text-2xl font-semibold text-gray-900">{productCount}</div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/admin/orders" className="h-full">
              <Card className="h-full min-h-[140px] p-4 cursor-pointer hover:shadow-md transition-shadow overflow-hidden">
                <CardContent className="h-full flex items-center gap-4">
                  <div className="h-12 w-12 rounded-md bg-market-accent text-white flex items-center justify-center">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Orders</div>
                    <div className="text-2xl font-semibold text-gray-900">{orderCount}</div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/admin/revenue" className="h-full">
              <Card className="h-full min-h-[140px] p-4 cursor-pointer hover:shadow-md transition-shadow overflow-hidden">
                <CardContent className="h-full flex items-center gap-4">
                  <div className="h-12 w-12 rounded-md bg-green-500 text-white flex items-center justify-center">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Revenue</div>
                    <div className="text-2xl font-semibold text-gray-900">${revenue.toFixed(2)}</div>
                    {quarantinedRevenueOrders > 0 && (
                      <div className="text-xs text-orange-600">Quarantined orders: {quarantinedRevenueOrders}</div>
                    )}
                    {usdToLbpRate ? (
                      <div
                        className="text-xs text-gray-500 truncate"
                        title={`≈ ${formatLbp(revenue, usdToLbpRate)}`}
                      >
                        ≈ {formatLbp(revenue, usdToLbpRate)}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500">LBP estimate unavailable</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/admin/customers" className="h-full">
              <Card className="h-full min-h-[140px] p-4 cursor-pointer hover:shadow-md transition-shadow overflow-hidden">
                <CardContent className="h-full flex items-center gap-4">
                  <div className="h-12 w-12 rounded-md bg-indigo-500 text-white flex items-center justify-center">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Customers</div>
                    <div className="text-2xl font-semibold text-gray-900">{customerCount}</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
            <div className="lg:col-span-2 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                  <h3 className="text-lg font-semibold">Quick Actions</h3>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowQuickActionManager((prev) => !prev)}
                      disabled={addableQuickActions.length === 0 && !showQuickActionManager}
                    >
                      {showQuickActionManager ? 'Done' : 'Add Quick Action'}
                    </Button>
                  </div>
                </div>

                {showQuickActionManager && (
                  <div className="mb-3 p-3 bg-white border rounded-lg">
                    <div className="mb-3 grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2">
                      <input
                        type="text"
                        value={newQuickActionLabel}
                        onChange={(event) => setNewQuickActionLabel(event.target.value)}
                        placeholder="Button label (example: Raw Materials)"
                        className="h-9 rounded-md border px-3 text-sm"
                      />
                      <input
                        type="text"
                        value={newQuickActionPath}
                        onChange={(event) => setNewQuickActionPath(event.target.value)}
                        placeholder="Route path (example: /admin/raw-materials)"
                        className="h-9 rounded-md border px-3 text-sm"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleAddCustomQuickAction}
                        disabled={!newQuickActionLabel.trim() || !newQuickActionPath.trim()}
                      >
                        Add Custom
                      </Button>
                    </div>

                    {addableQuickActions.length === 0 ? (
                      <div className="text-sm text-gray-500">All preset quick actions are already added.</div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {addableQuickActions.map((item) => (
                          <Button key={item.id} type="button" size="sm" variant="outline" onClick={() => handleAddQuickAction(item.id)}>
                            Add {item.label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {selectedQuickActions.length === 0 ? (
                  <div className="text-sm text-gray-500">No quick actions selected. Use Add Quick Action.</div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {selectedQuickActions.map((item) => {
                      const Icon = item.icon;
                      const colors = QUICK_ACTION_COLORS[item.id] || {
                        border: 'border-gray-200',
                        iconBg: 'bg-gray-100',
                        iconText: 'text-gray-700',
                      };
                      return (
                        <Link key={item.id} to={item.to} className={`relative flex items-center gap-3 p-3 rounded-lg bg-white border ${colors.border} shadow-sm hover:shadow-md transition`}>
                          {showQuickActionManager && (
                            <button
                              type="button"
                              className="absolute top-1 right-1 text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 hover:bg-red-200"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                handleRemoveQuickAction(item.id);
                              }}
                            >
                              Remove
                            </button>
                          )}
                          <div className={`h-8 w-8 rounded-full ${colors.iconBg} flex items-center justify-center ${colors.iconText}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className="text-sm font-medium">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold">Recent Activity</h3>
                  <Link to="/admin/announcements" className="text-sm text-market-primary">View all</Link>
                </div>
                {recentEvents.length === 0 ? (
                  <div className="text-sm text-gray-500">No recent activity.</div>
                ) : (
                  <ul className="space-y-2">
                    {recentEvents.map((ev, idx) => (
                      <li key={idx} className="p-3 bg-white rounded-lg shadow-sm border">
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-800">
                              {ev.type === 'product' && `New product: ${ev.name}`}
                              {ev.type === 'order' && `Order placed — $${ev.total}`}
                              {ev.type === 'announcement' && `Announcement: ${ev.title}`}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">{(ev.createdAt && new Date(String(ev.createdAt)).toLocaleString()) || '—'}</div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">Store Summary</h3>
              <Card className="min-h-[455px] mt-5">
              <CardContent className="pt-4">
                <div className="space-y-6">
                    <div><strong>Store Name</strong>: {storeName}</div>
                  <div><strong>Location</strong>: Lebanon</div>
                  <div><strong>Active Template</strong>: Vibrant</div>
                    <div><strong>Active Announcements</strong>: 1</div>
                    <div><strong>Seller Subscription</strong>: You are seller #4 — 12 months free remaining.</div>
                    <div>
                      <strong>Exchange rate (USD → LBP)</strong>:
                      <div className="mt-1">
                        {editingRate ? (
                          <div className="flex items-center gap-2">
                            <input
                              value={editRateValue}
                              onChange={e => setEditRateValue(e.target.value)}
                              className="border px-2 py-1 rounded w-32 text-sm"
                              placeholder="e.g. 15000"
                            />
                            <button
                              onClick={async () => {
                                const parsed = Number(editRateValue);
                                if (!parsed || parsed <= 0) {
                                  // basic validation
                                  alert('Please enter a valid positive number for the rate.');
                                  return;
                                }
                                if (!user?.id) return;
                                const actualStoreId = getActualStoreId(user);
                                if (!actualStoreId) return;
                                setSavingRate(true);
                                try {
                                  const db = getFirestore();
                                  const profileRef = doc(db, 'storeProfiles', actualStoreId);
                                  await updateDoc(profileRef, {
                                    customExchangeRate: parsed,
                                    usdToLbpRate: parsed,
                                    exchangeRateMode: 'manual',
                                  });
                                  // update local state
                                  setUsdToLbpRate(parsed);
                                  setRateFetchedAt(Date.now());
                                  setExchangeRateMode('manual');
                                  setStore(prev => ({
                                    ...(prev as Record<string, unknown>),
                                    customExchangeRate: parsed,
                                    usdToLbpRate: parsed,
                                    exchangeRateMode: 'manual',
                                  }));
                                  setEditingRate(false);
                                } catch (err) {
                                  console.warn('Failed to save rate', err);
                                  alert('Failed to save rate. See console for details.');
                                } finally {
                                  setSavingRate(false);
                                }
                              }}
                              className="px-3 py-1 bg-market-primary text-white rounded text-sm"
                              disabled={savingRate}
                            >
                              Save
                            </button>
                            <button onClick={() => setEditingRate(false)} className="px-2 py-1 rounded text-sm border">Cancel</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="text-sm text-gray-700">{usdToLbpRate ? `${usdToLbpRate} LBP per USD` : 'Not set'}</div>
                            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">Mode: {exchangeRateMode === 'auto' ? 'Auto' : 'Manual'}</span>
                            <button onClick={() => setEditingRate(true)} className="text-sm text-market-primary">Edit</button>
                            <button
                              onClick={async () => {
                                if (!user?.id) return;
                                const actualStoreId = getActualStoreId(user);
                                if (!actualStoreId) return;
                                setExchangeRateMode('auto');
                                try {
                                  const db = getFirestore();
                                  const profileRef = doc(db, 'storeProfiles', actualStoreId);
                                  await updateDoc(profileRef, { exchangeRateMode: 'auto' });
                                  await syncAutoRateForStore(actualStoreId);
                                } catch (err) {
                                  console.warn('Failed to enable auto exchange rates', err);
                                }
                              }}
                              className="text-sm text-blue-600"
                              disabled={syncingAutoRate}
                            >
                              {syncingAutoRate && exchangeRateMode === 'auto' ? 'Syncing...' : 'Auto Mode'}
                            </button>
                            <button
                              onClick={async () => {
                                if (!user?.id) return;
                                const actualStoreId = getActualStoreId(user);
                                if (!actualStoreId) return;
                                try {
                                  const db = getFirestore();
                                  const profileRef = doc(db, 'storeProfiles', actualStoreId);
                                  await updateDoc(profileRef, { exchangeRateMode: 'manual' });
                                  setExchangeRateMode('manual');
                                  setStore(prev => ({ ...(prev as Record<string, unknown>), exchangeRateMode: 'manual' }));
                                } catch (err) {
                                  console.warn('Failed to switch to manual mode', err);
                                }
                              }}
                              className="text-sm text-amber-700"
                            >
                              Manual Mode
                            </button>
                            <button
                              onClick={async () => {
                                if (!user?.id) return;
                                const actualStoreId = getActualStoreId(user);
                                if (!actualStoreId) return;
                                await syncAutoRateForStore(actualStoreId);
                              }}
                              className="text-sm text-green-700"
                              disabled={syncingAutoRate}
                            >
                              {syncingAutoRate ? 'Refreshing...' : 'Refresh Now'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Credits feature removed */}
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="ghost" onClick={() => navigate('/admin/profile')}>Edit Store Profile</Button>
              </CardFooter>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
    </div>
  );
}

export default AdminDashboard;
