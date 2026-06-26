
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
  Layers,
  LayoutGrid
} from 'lucide-react';
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, updateDoc, orderBy, limit } from 'firebase/firestore';
import { fetchUsdToLbpRateFresh, getUsdToLbpRate, formatLbp } from '@/lib/currency';
import MobileHeader from '@/components/MobileHeader';
import { useIsMobile } from '@/hooks/use-mobile';
import { isCountedSaleStatus } from '@/lib/salesRules';
import type { StoreProfile } from '@/types/storeProfile';
import { requestNotificationPermission, saveFcmToken } from '@/lib/notifications';
import { ECOSYSTEM_FLAGS } from '@/lib/ecosystemFlags';
import { useStoreEntitlements } from '@/hooks/useStoreEntitlements';
import PoweredByEmoove from '@/components/PoweredByEmoove';

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

const MAX_QUICK_ACTIONS = 12;
const DEFAULT_QUICK_ACTION_IDS = [
  'customers',
  'sales-crm',
  'inventory',
  'orders',
  'account-statement',
  'cash-collection',
  'service-renewals',
  'marketplace-sync',
  'product-reviews',
  'notification-logs',
  'store-logs',
  'delivery',
  'announcements',
  'analytics',
];

const QUICK_ACTION_GRADIENTS: Record<string, string> = {
  inventory: 'from-violet-500 to-purple-700',
  orders: 'from-orange-400 to-orange-600',
  products: 'from-teal-500 to-teal-700',
  purchases: 'from-sky-500 to-blue-700',
  customers: 'from-indigo-500 to-indigo-700',
  'sales-crm': 'from-emerald-500 to-teal-700',
  payments: 'from-amber-500 to-orange-600',
  'account-statement': 'from-slate-600 to-slate-800',
  'cash-collection': 'from-green-500 to-emerald-700',
  finance: 'from-cyan-500 to-blue-700',
  staff: 'from-pink-500 to-rose-700',
  'sub-accounts': 'from-fuchsia-500 to-purple-700',
  'store-profile': 'from-blue-500 to-indigo-700',
  templates: 'from-violet-400 to-fuchsia-600',
  marketing: 'from-rose-400 to-pink-600',
  'seo-analytics': 'from-lime-500 to-green-700',
  'seo-audit': 'from-cyan-400 to-teal-600',
  'service-renewals': 'from-blue-400 to-indigo-600',
  'marketplace-sync': 'from-amber-400 to-yellow-600',
  'product-reviews': 'from-yellow-400 to-amber-600',
  'notification-logs': 'from-sky-400 to-cyan-600',
  'store-logs': 'from-slate-500 to-zinc-700',
  delivery: 'from-stone-500 to-stone-700',
  announcements: 'from-red-400 to-rose-600',
  analytics: 'from-teal-400 to-cyan-600',
};

const DEFAULT_QUICK_GRADIENT = 'from-slate-500 to-slate-700';

const ACTIVITY_META = {
  product: { label: 'New product', Icon: Package, gradient: 'from-teal-500 to-teal-700' },
  order: { label: 'Order placed', Icon: ShoppingCart, gradient: 'from-orange-400 to-orange-600' },
  announcement: { label: 'Announcement', Icon: Megaphone, gradient: 'from-rose-400 to-pink-600' },
} as const;

const STAT_TILES = {
  products: { gradient: 'from-teal-500 to-teal-700', glow: 'group-hover:shadow-teal-500/20', Icon: Package },
  orders: { gradient: 'from-orange-400 to-orange-600', glow: 'group-hover:shadow-orange-500/20', Icon: Clock },
  revenue: { gradient: 'from-emerald-500 to-emerald-700', glow: 'group-hover:shadow-emerald-500/20', Icon: CreditCard },
  customers: { gradient: 'from-indigo-500 to-indigo-700', glow: 'group-hover:shadow-indigo-500/20', Icon: User },
} as const;

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
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
  const [quickActionToAdd, setQuickActionToAdd] = useState('');

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
        exchangeRateProvider: 'open.er-api.com',
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
  const { canUse: canUseModule } = useStoreEntitlements();
  const crmEnabled = user?.role === 'admin' && canUseModule('crm');
  const moduleVisible = (moduleId: string) =>
    !ECOSYSTEM_FLAGS.enforceModuleGates || canUseModule(moduleId);

  const quickActionStorageKey = useMemo(() => {
    if (!user?.id) return 'dashboardQuickActions:guest';
    const ownerKey = getActualStoreId(user) || user.id;
    return `dashboardQuickActions:${ownerKey}`;
  }, [user]);

  const quickActionPreferenceRef = useMemo(() => {
    if (!user?.id) return null;
    const db = getFirestore();
    return doc(db, 'users', user.id);
  }, [user?.id]);

  const quickActionItems = useMemo<QuickActionItem[]>(() => [
    {
      id: 'inventory',
      to: user?.role === 'admin' ? '/admin/inventory' : '/admin/products',
      label: user?.role === 'admin' ? 'Inventory' : 'Products',
      icon: Package,
      visible: canViewInventory,
    },
    { id: 'orders', to: '/admin/orders', label: 'Orders', icon: Clock, visible: true },
    { id: 'products', to: '/admin/products', label: 'Products', icon: Package, visible: canViewInventory },
    { id: 'purchases', to: '/admin/purchases', label: 'Purchases', icon: ShoppingCart, visible: canManageInventory },
    { id: 'customers', to: '/admin/customers', label: 'Customers', icon: Users, visible: true },
    {
      id: 'sales-crm',
      to: '/admin/crm',
      label: 'Sales CRM',
      icon: LayoutGrid,
      visible: crmEnabled,
    },
    { id: 'payments', to: '/admin/payments', label: 'Payments', icon: CreditCard, visible: canProcessPayments },
    { id: 'account-statement', to: '/admin/account-statement', label: 'Account Statement', icon: FileText, visible: user?.role === 'admin' },
    { id: 'cash-collection', to: '/admin/cash-collection', label: 'Cash Collection', icon: DollarSign, visible: user?.role === 'admin' },
    { id: 'finance', to: '/admin/finance', label: 'Finance Suite', icon: DollarSign, visible: user?.role === 'admin' },
    { id: 'staff', to: '/admin/staff', label: 'Staff (Payroll)', icon: Users, visible: user?.role === 'admin' },
    { id: 'sub-accounts', to: '/admin/sub-accounts', label: 'Sub-Accounts', icon: Users, visible: user?.role === 'admin' && moduleVisible('team') },
    { id: 'store-profile', to: '/admin/profile', label: 'Store Profile', icon: User, visible: user?.role === 'admin' },
    { id: 'templates', to: '/admin/templates', label: 'Templates & Store Logos', icon: Palette, visible: user?.role === 'admin' },
    { id: 'marketing', to: '/admin/marketing', label: 'Email Marketing', icon: Mail, visible: canViewReports },
    { id: 'seo-analytics', to: '/admin/seo-analytics', label: 'SEO Analytics', icon: TrendingUp, visible: user?.role === 'admin' },
    { id: 'seo-audit', to: '/admin/seo-audit', label: 'SEO Audit (GSC)', icon: Globe, visible: user?.role === 'admin' },
    { id: 'service-renewals', to: '/admin/service-renewals', label: 'Service Renewals', icon: Clock, visible: user?.role === 'admin' && moduleVisible('services') },
    { id: 'marketplace-sync', to: '/admin/marketplace', label: 'Marketplace Sync', icon: Globe, visible: user?.role === 'admin' && moduleVisible('dropship') },
    { id: 'product-reviews', to: '/admin/product-reviews', label: 'Product Reviews', icon: Star, visible: user?.role === 'admin' },
    { id: 'notification-logs', to: '/admin/order-notifications', label: 'Notification Logs', icon: Bell, visible: user?.role === 'admin' },
    { id: 'store-logs', to: '/admin/audit-logs', label: 'Store Logs', icon: FileText, visible: user?.role === 'admin' },
    { id: 'delivery', to: '/admin/delivery', label: 'Delivery', icon: Package, visible: canManageDeliveries },
    { id: 'announcements', to: '/admin/announcements', label: 'Announcements', icon: Megaphone, visible: true },
    { id: 'analytics', to: '/admin/analytics', label: 'Analytics', icon: BarChart, visible: canViewReports },
  ], [canManageDeliveries, canViewInventory, canViewReports, crmEnabled, user, canUseModule]);

  const visibleQuickActionItems = useMemo(
    () => quickActionItems.filter((item) => item.visible),
    [quickActionItems],
  );

  const allQuickActionItems = useMemo(
    () => [...visibleQuickActionItems, ...customQuickActions],
    [customQuickActions, visibleQuickActionItems],
  );

  const defaultQuickActionIds = useMemo(() => {
    const visibleIds = visibleQuickActionItems.map((item) => item.id);
    const preferred = DEFAULT_QUICK_ACTION_IDS.filter((id) => visibleIds.includes(id));
    const fallback = visibleIds.filter((id) => !preferred.includes(id));
    return [...preferred, ...fallback].slice(0, MAX_QUICK_ACTIONS);
  }, [visibleQuickActionItems]);

  useEffect(() => {
    const sanitizeCustomActions = (items: unknown): QuickActionItem[] => {
      if (!Array.isArray(items)) return [];
      return items.filter((item): item is QuickActionItem => {
        if (!item || typeof item !== 'object') return false;
        const candidate = item as Partial<QuickActionItem>;
        return typeof candidate.id === 'string' && typeof candidate.to === 'string' && typeof candidate.label === 'string';
      }).map((item) => ({
        ...item,
        visible: true,
        icon: Layers,
      }));
    };

    const loadQuickActionPreferences = async () => {
      const visibleIds = visibleQuickActionItems.map((item) => item.id);
      if (visibleIds.length === 0) {
        setSelectedQuickActionIds([]);
        setQuickActionsLoaded(true);
        return;
      }

      let serverIds: string[] = [];
      let serverCustomActions: QuickActionItem[] = [];

      if (quickActionPreferenceRef) {
        try {
          const prefSnap = await getDoc(quickActionPreferenceRef);
          if (prefSnap.exists()) {
            const data = prefSnap.data() as { dashboardQuickActions?: Partial<QuickActionStoragePayload> };
            const dashboardPrefs = data.dashboardQuickActions;
            if (dashboardPrefs && Array.isArray(dashboardPrefs.selectedQuickActionIds)) {
              serverIds = dashboardPrefs.selectedQuickActionIds;
            }
            serverCustomActions = sanitizeCustomActions(dashboardPrefs?.customQuickActions);
          }
        } catch (error) {
          console.warn('Failed to load quick action preferences from Firestore', error);
        }
      }

      let localIds: string[] = [];
      let localCustomActions: QuickActionItem[] = [];

      try {
        const raw = localStorage.getItem(quickActionStorageKey);
        const parsed = raw ? JSON.parse(raw) : null;

        if (Array.isArray(parsed)) {
          localIds = parsed;
        } else if (parsed && typeof parsed === 'object') {
          const payload = parsed as Partial<QuickActionStoragePayload>;
          if (Array.isArray(payload.selectedQuickActionIds)) {
            localIds = payload.selectedQuickActionIds;
          }
          localCustomActions = sanitizeCustomActions(payload.customQuickActions);
        }
      } catch {
        localIds = [];
        localCustomActions = [];
      }

      const mergedCustomActions = serverCustomActions.length > 0 ? serverCustomActions : localCustomActions;
      const customIds = mergedCustomActions.map((item) => item.id);
      const preferredIds = serverIds.length > 0 ? serverIds : localIds;
      const sanitizedIds = preferredIds
        .filter((id) => visibleIds.includes(id) || customIds.includes(id))
        .slice(0, MAX_QUICK_ACTIONS);

      setCustomQuickActions(mergedCustomActions);
      setSelectedQuickActionIds(sanitizedIds.length > 0 ? sanitizedIds : defaultQuickActionIds);
      setQuickActionsLoaded(true);
    };

    void loadQuickActionPreferences();
  }, [defaultQuickActionIds, quickActionPreferenceRef, quickActionStorageKey, visibleQuickActionItems]);

  useEffect(() => {
    if (!quickActionsLoaded) return;
    const payload: QuickActionStoragePayload = {
      selectedQuickActionIds: selectedQuickActionIds.slice(0, MAX_QUICK_ACTIONS),
      customQuickActions: customQuickActions.map((item) => ({ ...item, icon: Layers, visible: true })),
    };
    localStorage.setItem(quickActionStorageKey, JSON.stringify(payload));

    if (!quickActionPreferenceRef) return;
    void setDoc(quickActionPreferenceRef, {
      dashboardQuickActions: payload,
      dashboardQuickActionsUpdatedAt: new Date().toISOString(),
    }, { merge: true }).catch((error) => {
      console.warn('Failed to save quick action preferences to Firestore', error);
    });
  }, [customQuickActions, quickActionPreferenceRef, quickActionStorageKey, quickActionsLoaded, selectedQuickActionIds]);

  const selectedQuickActions = useMemo(
    () => allQuickActionItems.filter((item) => selectedQuickActionIds.includes(item.id)),
    [allQuickActionItems, selectedQuickActionIds],
  );

  const addableQuickActions = useMemo(
    () => {
      if (selectedQuickActionIds.length >= MAX_QUICK_ACTIONS) return [];
      return visibleQuickActionItems.filter((item) => !selectedQuickActionIds.includes(item.id));
    },
    [selectedQuickActionIds, visibleQuickActionItems],
  );

  const handleAddQuickAction = (actionId: string) => {
    setSelectedQuickActionIds((prev) => {
      if (prev.includes(actionId)) return prev;
      if (prev.length >= MAX_QUICK_ACTIONS) return prev;
      return [...prev, actionId];
    });
    setQuickActionToAdd('');
  };

  const handleRemoveQuickAction = (actionId: string) => {
    setSelectedQuickActionIds((prev) => prev.filter((id) => id !== actionId));
    setCustomQuickActions((prev) => prev.filter((item) => item.id !== actionId));
  };

  useEffect(() => {
    if (!showQuickActionManager) return;
    if (addableQuickActions.length === 0) {
      setQuickActionToAdd('');
      return;
    }

    const stillValid = addableQuickActions.some((item) => item.id === quickActionToAdd);
    if (!stillValid) {
      setQuickActionToAdd(addableQuickActions[0].id);
    }
  }, [addableQuickActions, quickActionToAdd, showQuickActionManager]);

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
          {
            to: '/admin/crm/pipeline',
            label: 'Sales CRM',
            icon: LayoutGrid,
            visible: crmEnabled,
          },
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
        const [productsSnap, ordersSnap] = await Promise.all([
          getDocs(productsQuery),
          getDocs(ordersQuery),
        ]);

        let recentAnnouncementDocs: (typeof productsSnap.docs)[number][] = [];
        try {
          recentAnnouncementDocs = (await getDocs(recentAnnouncementsQuery)).docs;
        } catch (announcementsErr) {
          console.warn('Announcements feed skipped (permissions or index)', announcementsErr);
        }

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

        recentAnnouncementDocs.forEach(doc => {
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
    return 'My Store';
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
    <div className="space-y-6">
          <section className="relative rounded-xl bg-[#0b1220] text-white py-4 px-4 md:px-5 overflow-hidden">
            <div
              className="absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 20% 20%, rgba(20,184,166,0.35) 0%, transparent 45%), radial-gradient(circle at 80% 0%, rgba(99,102,241,0.25) 0%, transparent 40%)',
              }}
              aria-hidden
            />
            <div
              className="absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
                backgroundSize: '48px 48px',
              }}
              aria-hidden
            />
            <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0">
                <p className="inline-flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-teal-300/90 mb-1">
                  <span className="h-px w-4 bg-teal-400/50" />
                  {user?.role === 'sub_account' ? 'Seller Dashboard' : 'Admin Dashboard'}
                  <span className="h-px w-4 bg-teal-400/50" />
                </p>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight leading-tight">{storeName}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                  <span className="text-slate-300">Welcome back, {user?.name || 'Store Owner'}</span>
                  <span className="hidden sm:inline text-slate-600">·</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${store?.status === 'online' ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.5)]' : 'bg-slate-500'}`} />
                    {store?.status === 'online' ? 'Store online' : 'Store offline'}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white text-xs"
                  onClick={handleStatusToggle}
                >
                  {store?.status === 'online' ? 'Go offline' : 'Go online'}
                </Button>
                <Button variant="outline" size="sm" asChild className="h-8 border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white text-xs">
                  <Link to="/admin/profile">Store Profile</Link>
                </Button>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <Link to="/admin/inventory" className="h-full group">
              <Card className="h-full min-h-[120px] p-4 cursor-pointer rounded-2xl border-white/80 bg-white shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)] hover:shadow-[0_20px_50px_-16px_rgba(15,23,42,0.18)] hover:-translate-y-0.5 transition-all duration-300 overflow-hidden ring-1 ring-slate-900/5">
                <CardContent className="h-full flex items-center gap-4 p-0">
                  <div className={`h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br ${STAT_TILES.products.gradient} text-white flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_8px_16px_-6px_rgba(15,23,42,0.45)] ${STAT_TILES.products.glow} transition-shadow`}>
                    <Package className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Products</div>
                    <div className="text-2xl font-bold tracking-tight text-slate-900">{productCount}</div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/admin/orders" className="h-full group">
              <Card className="h-full min-h-[120px] p-4 cursor-pointer rounded-2xl border-white/80 bg-white shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)] hover:shadow-[0_20px_50px_-16px_rgba(15,23,42,0.18)] hover:-translate-y-0.5 transition-all duration-300 overflow-hidden ring-1 ring-slate-900/5">
                <CardContent className="h-full flex items-center gap-4 p-0">
                  <div className={`h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br ${STAT_TILES.orders.gradient} text-white flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_8px_16px_-6px_rgba(15,23,42,0.45)] ${STAT_TILES.orders.glow} transition-shadow`}>
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Orders</div>
                    <div className="text-2xl font-bold tracking-tight text-slate-900">{orderCount}</div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/admin/revenue" className="h-full group">
              <Card className="h-full min-h-[120px] p-4 cursor-pointer rounded-2xl border-white/80 bg-white shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)] hover:shadow-[0_20px_50px_-16px_rgba(15,23,42,0.18)] hover:-translate-y-0.5 transition-all duration-300 overflow-hidden ring-1 ring-slate-900/5">
                <CardContent className="h-full flex items-center gap-4 p-0">
                  <div className={`h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br ${STAT_TILES.revenue.gradient} text-white flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_8px_16px_-6px_rgba(15,23,42,0.45)] ${STAT_TILES.revenue.glow} transition-shadow`}>
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Revenue</div>
                    <div className="text-2xl font-bold tracking-tight text-slate-900">${revenue.toFixed(2)}</div>
                    {quarantinedRevenueOrders > 0 && (
                      <div className="text-xs text-amber-600">Quarantined: {quarantinedRevenueOrders}</div>
                    )}
                    {usdToLbpRate ? (
                      <div
                        className="text-xs text-slate-500 truncate"
                        title={`≈ ${formatLbp(revenue, usdToLbpRate)}`}
                      >
                        ≈ {formatLbp(revenue, usdToLbpRate)}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400">LBP estimate unavailable</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/admin/customers" className="h-full group">
              <Card className="h-full min-h-[120px] p-4 cursor-pointer rounded-2xl border-white/80 bg-white shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)] hover:shadow-[0_20px_50px_-16px_rgba(15,23,42,0.18)] hover:-translate-y-0.5 transition-all duration-300 overflow-hidden ring-1 ring-slate-900/5">
                <CardContent className="h-full flex items-center gap-4 p-0">
                  <div className={`h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br ${STAT_TILES.customers.gradient} text-white flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_8px_16px_-6px_rgba(15,23,42,0.45)] ${STAT_TILES.customers.glow} transition-shadow`}>
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Customers</div>
                    <div className="text-2xl font-bold tracking-tight text-slate-900">{customerCount}</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-2xl border border-white/80 bg-white p-4 md:p-5 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/5">
                <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Shortcuts</p>
                    <h3 className="text-lg font-semibold tracking-tight text-slate-900">Quick Actions</h3>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg border-slate-200 text-slate-700 hover:bg-slate-50"
                    onClick={() => setShowQuickActionManager((prev) => !prev)}
                  >
                    {showQuickActionManager ? 'Done' : 'Customize'}
                  </Button>
                </div>

                {showQuickActionManager && (
                  <div className="mb-4 p-4 bg-slate-50 border border-slate-200/80 rounded-xl">
                    <div className="mb-3 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
                      <select
                        value={quickActionToAdd}
                        onChange={(event) => setQuickActionToAdd(event.target.value)}
                        className="h-9 rounded-lg border border-slate-200 px-3 text-sm bg-white text-slate-800"
                        disabled={addableQuickActions.length === 0}
                      >
                        <option value="" disabled>
                          {addableQuickActions.length === 0 ? 'No more quick actions available' : 'Select a quick action'}
                        </option>
                        {addableQuickActions.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        size="sm"
                        className="rounded-lg"
                        onClick={() => quickActionToAdd && handleAddQuickAction(quickActionToAdd)}
                        disabled={!quickActionToAdd || addableQuickActions.length === 0}
                      >
                        Add Action
                      </Button>
                    </div>

                    {addableQuickActions.length === 0 ? (
                      <div className="text-sm text-slate-500">
                        {selectedQuickActionIds.length >= MAX_QUICK_ACTIONS
                          ? `Maximum ${MAX_QUICK_ACTIONS} quick actions selected. Remove one to add another.`
                          : 'All quick actions are already added.'}
                      </div>
                    ) : null}
                  </div>
                )}

                {selectedQuickActions.length === 0 ? (
                  <div className="text-sm text-slate-500 py-6 text-center rounded-xl border border-dashed border-slate-200">No quick actions selected. Use Customize to add shortcuts.</div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {selectedQuickActions.map((item) => {
                      const Icon = item.icon;
                      const gradient = QUICK_ACTION_GRADIENTS[item.id] || DEFAULT_QUICK_GRADIENT;
                      return (
                        <Link key={item.id} to={item.to} className="relative group flex items-center gap-3 p-3 rounded-xl bg-slate-50/80 border border-slate-200/70 hover:bg-white hover:border-slate-300/80 hover:shadow-[0_12px_32px_-10px_rgba(15,23,42,0.15)] hover:-translate-y-0.5 transition-all duration-300">
                          {showQuickActionManager && (
                            <button
                              type="button"
                              className="absolute top-1.5 right-1.5 text-[10px] px-1.5 py-0.5 rounded-md bg-red-500/10 text-red-600 hover:bg-red-500/20 font-medium"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                handleRemoveQuickAction(item.id);
                              }}
                            >
                              Remove
                            </button>
                          )}
                          <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_6px_12px_-4px_rgba(15,23,42,0.4)] group-hover:scale-105 transition-transform`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className="text-sm font-medium text-slate-800 leading-tight">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-white/80 bg-white p-4 md:p-5 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Live feed</p>
                    <h3 className="text-lg font-semibold tracking-tight text-slate-900">Recent Activity</h3>
                  </div>
                  <Link to="/admin/audit-logs" className="text-sm font-medium text-teal-700 hover:text-teal-800">View all</Link>
                </div>
                {recentEvents.length === 0 ? (
                  <div className="text-sm text-slate-500 py-8 text-center rounded-xl border border-dashed border-slate-200">No recent activity yet.</div>
                ) : (
                  <ul className="space-y-2">
                    {recentEvents.map((ev, idx) => {
                      const meta = ACTIVITY_META[ev.type];
                      const ActivityIcon = meta.Icon;
                      return (
                      <li key={idx} className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-slate-200 hover:shadow-sm transition-all">
                        <div className="flex items-center gap-3">
                          <div className={`h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br ${meta.gradient} flex items-center justify-center text-white shadow-sm`}>
                            <ActivityIcon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-800 truncate">
                              {ev.type === 'product' && `${meta.label}: ${ev.name}`}
                              {ev.type === 'order' && `${meta.label} — $${ev.total}`}
                              {ev.type === 'announcement' && `${meta.label}: ${ev.title}`}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">{(ev.createdAt && new Date(String(ev.createdAt)).toLocaleString()) || '—'}</div>
                          </div>
                        </div>
                      </li>
                    );})}
                  </ul>
                )}
              </div>
            </div>

            <div>
              <div className="mb-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Overview</p>
                <h3 className="text-lg font-semibold tracking-tight text-slate-900">Store Summary</h3>
              </div>
              <Card className="rounded-2xl border-white/80 bg-white shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/5 overflow-hidden">
              <CardContent className="pt-5 pb-2">
                <dl className="divide-y divide-slate-100">
                    <div className="flex items-start justify-between gap-3 py-3 first:pt-0">
                      <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Store Name</dt>
                      <dd className="text-sm font-semibold text-slate-900 text-right">{storeName}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3 py-3">
                      <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Location</dt>
                      <dd className="text-sm text-slate-700 text-right">Lebanon</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3 py-3">
                      <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Template</dt>
                      <dd className="text-sm text-slate-700 text-right">Vibrant</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3 py-3">
                      <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Announcements</dt>
                      <dd className="text-sm text-slate-700 text-right">1 active</dd>
                    </div>
                    {user?.role === 'sub_account' && (
                    <div className="flex items-start justify-between gap-3 py-3">
                      <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Seller Plan</dt>
                      <dd className="text-sm text-slate-700 text-right">#4 — 12 mo free</dd>
                    </div>
                    )}
                    <div className="py-3">
                      <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Exchange Rate (USD → LBP)</dt>
                      <dd>
                        {editingRate ? (
                          <div className="flex items-center gap-2">
                            <input
                              value={editRateValue}
                              onChange={e => setEditRateValue(e.target.value)}
                              className="border border-slate-200 rounded-lg px-2 py-1.5 w-32 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/30"
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
                              className="px-3 py-1.5 bg-[#0b1220] text-white rounded-lg text-sm hover:bg-slate-800"
                              disabled={savingRate}
                            >
                              Save
                            </button>
                            <button onClick={() => setEditingRate(false)} className="px-2.5 py-1.5 rounded-lg text-sm border border-slate-200 text-slate-600 hover:bg-slate-50">Cancel</button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="text-sm font-semibold text-slate-800">{usdToLbpRate ? `${usdToLbpRate.toLocaleString()} LBP / USD` : 'Not set'}</div>
                            <span className="inline-flex text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">{exchangeRateMode === 'auto' ? 'Auto' : 'Manual'}</span>
                            <div className="flex flex-wrap gap-2 pt-1">
                            <button onClick={() => setEditingRate(true)} className="text-xs font-medium text-teal-700 hover:text-teal-800 px-2 py-1 rounded-md hover:bg-teal-50">Edit</button>
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
                              className="text-xs font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded-md hover:bg-blue-50"
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
                              className="text-xs font-medium text-amber-700 hover:text-amber-800 px-2 py-1 rounded-md hover:bg-amber-50"
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
                              className="text-xs font-medium text-emerald-700 hover:text-emerald-800 px-2 py-1 rounded-md hover:bg-emerald-50"
                              disabled={syncingAutoRate}
                            >
                              {syncingAutoRate ? 'Refreshing...' : 'Refresh'}
                            </button>
                            </div>
                          </div>
                        )}
                      </dd>
                    </div>
                </dl>
              </CardContent>
              <CardFooter className="border-t border-slate-100 bg-slate-50/50">
                <Button variant="ghost" className="text-teal-700 hover:text-teal-800 hover:bg-teal-50" onClick={() => navigate('/admin/profile')}>Edit Store Profile</Button>
              </CardFooter>
              </Card>
            </div>
          </div>
    </div>
  );
}

export default AdminDashboard;
