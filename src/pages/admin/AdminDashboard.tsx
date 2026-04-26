
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  Mail
} from 'lucide-react';
import { getFirestore, doc, getDoc, collection, query, where, getDocs, updateDoc, orderBy, limit } from 'firebase/firestore';
import { getUsdToLbpRate, formatLbp } from '@/lib/currency';
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
  // Credits feature removed
  const [customerCount, setCustomerCount] = useState(0);
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);

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
          // If the store has a custom rate, prefer it.
          if (profileData?.usdToLbpRate && typeof profileData.usdToLbpRate === 'number') {
            const rateVal = profileData.usdToLbpRate as number;
            setUsdToLbpRate(rateVal);
            // DocumentSnapshot doesn't expose updateTime on the client SDK types; use now.
            setRateFetchedAt(Date.now());
            setEditRateValue(String(rateVal));
          }
        } else {
          setStore(null);
        }
        // Products count
        const productsRef = collection(db, 'products');
        const productsQuery = query(productsRef, where('storeId', '==', actualStoreId));
        const productsSnap = await getDocs(productsQuery);
        setProductCount(productsSnap.size);
        // Orders
        const ordersRef = collection(db, 'orders');
        const ordersQuery = query(ordersRef, where('storeId', '==', actualStoreId));
        const ordersSnap = await getDocs(ordersQuery);
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
        // Fetch USD->LBP rate in background (non-blocking)
        // Only fetch global rate if store doesn't provide its own rate
        if (!profileSnap.exists() || !profileSnap.data()?.usdToLbpRate) {
          getUsdToLbpRate().then(r => {
            setUsdToLbpRate(r.rate);
            setRateFetchedAt(r.fetchedAt);
          }).catch(() => {
            // ignore
          });
        }
        setCustomerCount(customerSet.size);
        // Recent Activity: fetch last 5 events (products, orders, announcements)
  const events: RecentEvent[] = [];
        // Recent products
        const recentProductsQuery = query(productsRef, where('storeId', '==', actualStoreId), orderBy('createdAt', 'desc'), limit(2));
        const recentProductsSnap = await getDocs(recentProductsQuery);
        recentProductsSnap.forEach(doc => {
          events.push({
            type: 'product',
            name: doc.data().name,
            createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
          });
        });
        // Recent orders
        const recentOrdersQuery = query(ordersRef, where('storeId', '==', actualStoreId), orderBy('createdAt', 'desc'), limit(2));
        const recentOrdersSnap = await getDocs(recentOrdersQuery);
        recentOrdersSnap.forEach(doc => {
          events.push({
            type: 'order',
            total: doc.data().total,
            createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
          });
        });
        // Recent announcements
        const announcementsRef = collection(db, 'announcements');
        const recentAnnouncementsQuery = query(announcementsRef, where('storeId', '==', actualStoreId), orderBy('createdAt', 'desc'), limit(1));
        const recentAnnouncementsSnap = await getDocs(recentAnnouncementsQuery);
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
      <div className="flex items-center gap-3 overflow-x-auto">
        <Link to={user?.role === 'admin' ? "/admin/inventory" : "/admin/products"} className="flex flex-col items-center shrink-0 px-3 py-2 rounded-lg bg-white border border-gray-100 shadow-sm hover:shadow-md transition">
          <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700">
            <Package className="h-4 w-4" />
          </div>
          <span className="text-xs text-gray-700 mt-1">{user?.role === 'admin' ? 'Inventory' : 'Products'}</span>
        </Link>

        <Link to="/admin/products" className="relative flex flex-col items-center shrink-0 px-3 py-2 rounded-lg bg-white border border-gray-100 shadow-sm hover:shadow-md transition">
          <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-market-primary">
            <Package className="h-4 w-4" />
          </div>
          {productCount > 0 && <span className="absolute -top-1 -right-1 bg-market-primary text-white text-[10px] px-1 rounded-full">{productCount}</span>}
          <span className="text-xs text-gray-700 mt-1">Products</span>
        </Link>

        <Link to="/admin/purchases" className="flex flex-col items-center shrink-0 px-3 py-2 rounded-lg bg-white border border-gray-100 shadow-sm hover:shadow-md transition">
          <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-blue-600">
            <ShoppingCart className="h-4 w-4" />
          </div>
          <span className="text-xs text-gray-700 mt-1">Purchases</span>
        </Link>

        <Link to="/admin/orders" className="relative flex flex-col items-center shrink-0 px-3 py-2 rounded-lg bg-white border border-gray-100 shadow-sm hover:shadow-md transition">
          <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-market-accent">
            <Clock className="h-4 w-4" />
          </div>
          {orderCount > 0 && <span className="absolute -top-1 -right-1 bg-market-primary text-white text-[10px] px-1 rounded-full">{orderCount}</span>}
          <span className="text-xs text-gray-700 mt-1">Orders</span>
        </Link>

        <Link to="/admin/announcements" className="flex flex-col items-center shrink-0 px-3 py-2 rounded-lg bg-white border border-gray-100 shadow-sm hover:shadow-md transition">
          <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-700">
            <Megaphone className="h-4 w-4" />
          </div>
          <span className="text-xs text-gray-700 mt-1">Announcements</span>
        </Link>

        <Link to="/admin/expenses" className="flex flex-col items-center shrink-0 px-3 py-2 rounded-lg bg-white border border-gray-100 shadow-sm hover:shadow-md transition">
          <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-orange-600">
            <CreditCard className="h-4 w-4" />
          </div>
          <span className="text-xs text-gray-700 mt-1">Expenses</span>
        </Link>

        <Link to="/admin/finance" className="flex flex-col items-center shrink-0 px-3 py-2 rounded-lg bg-white border border-green-200 shadow-sm hover:shadow-md transition">
          <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-green-700">
            <DollarSign className="h-4 w-4" />
          </div>
          <span className="text-xs text-gray-700 mt-1">Finance</span>
        </Link>

        <Link to="/admin/delivery" className="flex flex-col items-center shrink-0 px-3 py-2 rounded-lg bg-white border border-gray-100 shadow-sm hover:shadow-md transition">
          <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-700">
            <Package className="h-4 w-4" />
          </div>
          <span className="text-xs text-gray-700 mt-1">Delivery</span>
        </Link>

        <Link to="/admin/analytics" className="flex flex-col items-center shrink-0 px-3 py-2 rounded-lg bg-white border border-gray-100 shadow-sm hover:shadow-md transition">
          <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-700">
            <BarChart className="h-4 w-4" />
          </div>
          <span className="text-xs text-gray-700 mt-1">Analytics</span>
        </Link>

        <button onClick={handleStatusToggle} className="flex flex-col items-center shrink-0 px-3 py-2 rounded-md hover:bg-gray-100">
          <div className={`h-5 w-5 rounded-full ${store?.status === 'online' ? 'bg-green-500' : 'bg-gray-400'}`} />
          <span className="text-xs text-gray-600 mt-1">{store?.status === 'online' ? 'Online' : 'Offline'}</span>
        </button>

        <Link to="/admin/profile" className="flex flex-col items-center shrink-0 px-3 py-2 rounded-md hover:bg-gray-100">
          <User className="h-5 w-5 text-gray-700" />
          <span className="text-xs text-gray-600 mt-1">Profile</span>
        </Link>

        <a href="/store-owner-guide.html" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center shrink-0 px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition">
          <FileText className="h-5 w-5 text-indigo-600" />
          <span className="text-xs text-indigo-700 mt-1 font-semibold">Guide</span>
        </a>
      </div>
    </div>
  <div className="flex">
  <aside className="hidden lg:flex lg:flex-col w-64 bg-white shadow-sm h-screen sticky top-0">
        <div className="p-6 flex-shrink-0">
          <Link to="/" className="text-2xl font-bold text-market-primary">Market Flow</Link>
          <p className="text-gray-500 text-sm mt-1">{user?.role === 'sub_account' ? 'Seller Dashboard' : 'Admin Dashboard'}</p>
        </div>
        <nav className="mt-6 flex-1 overflow-y-auto pb-32">
          <ul className="space-y-2 px-4">
            <li>
              <Link to="/admin/dashboard" className="flex items-center px-3 py-2 text-gray-700 rounded-lg bg-white border border-gray-100 hover:shadow-sm transition">
                <StoreIcon className="h-5 w-5 mr-3 text-market-primary" />
                <span className="font-medium">Dashboard</span>
              </Link>
            </li>
            {canViewInventory && (
              <li>
                <Link to={user?.role === 'admin' ? "/admin/inventory" : "/admin/products"} className="flex items-center px-3 py-2 text-gray-600 rounded-lg bg-white border border-gray-100 hover:shadow-sm transition">
                  <Package className="h-5 w-5 mr-3 text-purple-600" />
                  <span className="font-medium">{user?.role === 'admin' ? 'Inventory Overview' : 'Products'}</span>
                </Link>
              </li>
            )}
            <li>
              <Link to="/admin/orders" className="flex items-center px-3 py-2 text-gray-600 rounded-lg bg-white border border-gray-100 hover:shadow-sm transition">
                <Package className="h-5 w-5 mr-3" />
                <span>Orders</span>
              </Link>
            </li>
            {canProcessPayments && (
              <li>
                <Link to="/admin/payments" className="flex items-center px-3 py-2 text-gray-600 rounded-lg bg-white border border-gray-100 hover:shadow-sm transition">
                  <CreditCard className="h-5 w-5 mr-3" />
                  <span>Payments</span>
                </Link>
              </li>
            )}
            {user?.role === 'admin' && (
              <li>
                <Link to="/admin/finance" className="flex items-center px-3 py-2 text-gray-700 rounded-lg bg-green-50 border border-green-200 hover:shadow-sm transition">
                  <DollarSign className="h-5 w-5 mr-3 text-green-700" />
                  <span className="font-medium">Finance Suite</span>
                </Link>
              </li>
            )}
            {user?.role === 'admin' && (
              <li>
                <Link to="/admin/account-statement" className="flex items-center px-3 py-2 text-gray-600 rounded-lg bg-white border border-gray-100 hover:shadow-sm transition">
                  <FileText className="h-5 w-5 mr-3" />
                  <span>Account Statement</span>
                </Link>
              </li>
            )}
            {user?.role === 'admin' && (
              <li>
                <Link to="/admin/cash-collection" className="flex items-center px-3 py-2 text-gray-600 rounded-lg bg-white border border-gray-100 hover:shadow-sm transition">
                  <DollarSign className="h-5 w-5 mr-3" />
                  <span>Cash Collection</span>
                </Link>
              </li>
            )}
            {user?.role === 'admin' && (
              <li>
                <Link to="/admin/service-renewals" className="flex items-center px-3 py-2 text-gray-600 rounded-lg bg-white border border-gray-100 hover:shadow-sm transition">
                  <Clock className="h-5 w-5 mr-3" />
                  <span>Service Renewals</span>
                </Link>
              </li>
            )}
            {user?.role === 'admin' && (
              <li>
                <Link to="/admin/audit-logs" className="flex items-center px-3 py-2 text-gray-600 rounded-lg bg-white border border-gray-100 hover:shadow-sm transition">
                  <FileText className="h-5 w-5 mr-3" />
                  <span>System Logs</span>
                </Link>
              </li>
            )}
            {canManageDeliveries && (
              <li>
                <Link to="/admin/delivery" className="flex items-center px-3 py-2 text-gray-600 rounded-lg bg-white border border-gray-100 hover:shadow-sm transition">
                  <Clock className="h-5 w-5 mr-3" />
                  <span>Delivery</span>
                </Link>
              </li>
            )}
            {user?.role === 'admin' && (
              <>
                <li>
                  <Link to="/admin/profile" className="flex items-center px-3 py-2 text-gray-600 rounded-lg bg-white border border-gray-100 hover:shadow-sm transition">
                    <User className="h-5 w-5 mr-3" />
                    <span>Store Profile</span>
                  </Link>
                </li>
                <li className="ml-4">
                  <Link to="/admin/templates" className="flex items-center px-3 py-2 text-gray-600 rounded-lg bg-white border border-gray-100 hover:shadow-sm transition">
                    <Palette className="h-5 w-5 mr-3" />
                    <span>Templates</span>
                  </Link>
                </li>
              </>
            )}
            <li>
              <Link to="/admin/announcements" className="flex items-center px-3 py-2 text-gray-600 rounded-lg bg-white border border-gray-100 hover:shadow-sm transition">
                <Megaphone className="h-5 w-5 mr-3" />
                <span>Announcements</span>
              </Link>
            </li>
            {canViewReports && (
              <>
                <li>
                  <Link to="/admin/analytics" className="flex items-center px-3 py-2 text-gray-600 rounded-lg bg-white border border-gray-100 hover:shadow-sm transition">
                    <BarChart className="h-5 w-5 mr-3" />
                    <span>Analytics</span>
                  </Link>
                </li>
                <li>
                  <Link to="/admin/revenue" className="flex items-center px-3 py-2 text-gray-600 rounded-lg bg-white border border-gray-100 hover:shadow-sm transition">
                    <DollarSign className="h-5 w-5 mr-3" />
                    <span>Revenue</span>
                  </Link>
                </li>
                <li>
                  <Link to="/admin/marketing" className="flex items-center px-3 py-2 text-gray-600 rounded-lg bg-white border border-gray-100 hover:shadow-sm transition">
                    <Mail className="h-5 w-5 mr-3" />
                    <span>Email Marketing</span>
                  </Link>
                </li>
              </>
            )}
            {user?.role === 'admin' && (
              <>
                <li>
                  <Link to="/admin/staff" className="flex items-center px-3 py-2 text-gray-600 rounded-lg bg-white border border-gray-100 hover:shadow-sm transition">
                    <Users className="h-5 w-5 mr-3" />
                    <span>Staff (Payroll)</span>
                  </Link>
                </li>
                <li>
                  <Link to="/admin/sub-accounts" className="flex items-center px-3 py-2 text-gray-600 rounded-lg bg-white border border-green-200 hover:shadow-sm transition">
                    <Users className="h-5 w-5 mr-3 text-green-600" />
                    <span className="font-medium">Sub-Accounts (Login)</span>
                  </Link>
                </li>
              </>
            )}            <li>
              <a href="/store-owner-guide.html" target="_blank" rel="noopener noreferrer" className="flex items-center px-3 py-2 text-indigo-700 font-semibold rounded-lg bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition">
                <FileText className="h-5 w-5 mr-3 text-indigo-600" />
                <span>Store Owner Guide</span>
              </a>
            </li>          </ul>
        </nav>
          <div className="px-6 py-4 absolute bottom-0 w-full border-t bg-white">
          <div className="flex items-center">
            <div className="h-10 w-10 rounded-full bg-market-primary flex items-center justify-center text-white">
              {user?.name ? String(user.name).charAt(0) : 'G'}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">{user?.name || 'Guest'}</p>
              <p className="text-xs text-gray-500">{user?.email || ''}</p>
            </div>
          </div>
          <Button variant="outline" className="w-full mt-4" onClick={() => navigate('/')}>View Marketplace</Button>
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
            <Link to="/admin/inventory">
              <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="flex items-center gap-4">
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

            <Link to="/admin/orders">
              <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="flex items-center gap-4">
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

            <Link to="/admin/revenue">
              <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="flex items-center gap-4">
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
                      <div className="text-xs text-gray-500">≈ {formatLbp(revenue, usdToLbpRate)} <span className="ml-2">{rateFetchedAt ? `(rate updated ${new Date(rateFetchedAt).toLocaleTimeString()})` : ''}</span></div>
                    ) : (
                      <div className="text-xs text-gray-500">LBP estimate unavailable</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/admin/customers">
              <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="flex items-center gap-4">
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
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

            <Card>
              <CardHeader>
                <CardTitle>Store Summary</CardTitle>
                <CardDescription>Your store at a glance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
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
                                  await updateDoc(profileRef, { usdToLbpRate: parsed });
                                  // update local state
                                  setUsdToLbpRate(parsed);
                                  setRateFetchedAt(Date.now());
                                  setStore(prev => ({ ...(prev as Record<string, unknown>), usdToLbpRate: parsed }));
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
                          <div className="flex items-center gap-3">
                            <div className="text-sm text-gray-700">{usdToLbpRate ? `${usdToLbpRate} LBP per USD` : 'Not set'}</div>
                            <button onClick={() => setEditingRate(true)} className="text-sm text-market-primary">Edit</button>
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

          <div>
            <h3 className="text-lg font-semibold mb-3">Quick Actions</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {canViewInventory && (
                  <Link to={user?.role === 'admin' ? "/admin/inventory" : "/admin/products"} className="flex items-center gap-3 p-3 rounded-lg bg-white border border-purple-600/20 shadow-sm hover:shadow-md transition">
                    <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                      <Package className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium">{user?.role === 'admin' ? 'Inventory' : 'Products'}</span>
                  </Link>
                )}
                <Link to="/admin/orders" className="flex items-center gap-3 p-3 rounded-lg bg-white border border-gray-200 shadow-sm hover:shadow-md transition">
                  <div className="h-8 w-8 rounded-full bg-market-accent/10 flex items-center justify-center text-market-accent">
                    <Clock className="h-4 w-4" />
                  </div>
                  <span className="font-medium">Orders</span>
                </Link>

                {canProcessPayments && (
                  <Link to="/admin/payments" className="flex items-center gap-3 p-3 rounded-lg bg-white border border-gray-200 shadow-sm hover:shadow-md transition">
                    <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-700">
                      <CreditCard className="h-4 w-4" />
                    </div>
                    <span className="font-medium">Payments</span>
                  </Link>
                )}

                {user?.role === 'admin' && (
                  <Link to="/admin/account-statement" className="flex items-center gap-3 p-3 rounded-lg bg-white border border-indigo-600/20 shadow-sm hover:shadow-md transition">
                    <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                      <FileText className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium">Account Statement</span>
                  </Link>
                )}

                {user?.role === 'admin' && (
                  <Link to="/admin/cash-collection" className="flex items-center gap-3 p-3 rounded-lg bg-white border border-emerald-600/20 shadow-sm hover:shadow-md transition">
                    <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                      <DollarSign className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium">Cash Collection</span>
                  </Link>
                )}

                {user?.role === 'admin' && (
                  <Link to="/admin/service-renewals" className="flex items-center gap-3 p-3 rounded-lg bg-white border border-blue-600/20 shadow-sm hover:shadow-md transition">
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700">
                      <Clock className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium">Service Renewals</span>
                  </Link>
                )}

                {user?.role === 'admin' && (
                  <Link to="/admin/audit-logs" className="flex items-center gap-3 p-3 rounded-lg bg-white border border-slate-600/20 shadow-sm hover:shadow-md transition">
                    <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700">
                      <FileText className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium">System Logs</span>
                  </Link>
                )}

                {canManageDeliveries && (
                  <Link to="/admin/delivery" className="flex items-center gap-3 p-3 rounded-lg bg-white border border-gray-200 shadow-sm hover:shadow-md transition">
                    <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-700">
                      <Package className="h-4 w-4" />
                    </div>
                    <span className="font-medium">Delivery</span>
                  </Link>
                )}

                <Link to="/admin/announcements" className="flex items-center gap-3 p-3 rounded-lg bg-white border border-gray-200 shadow-sm hover:shadow-md transition">
                  <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-700">
                    <Megaphone className="h-4 w-4" />
                  </div>
                  <span className="font-medium">Announcements</span>
                </Link>

                {canViewReports && (
                  <Link to="/admin/analytics" className="flex items-center gap-3 p-3 rounded-lg bg-white border border-gray-200 shadow-sm hover:shadow-md transition">
                    <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-700">
                      <BarChart className="h-4 w-4" />
                    </div>
                    <span className="font-medium">Analytics</span>
                  </Link>
                )}

                {user?.role === 'admin' && (
                  <>
                    <Link to="/admin/sub-accounts" className="flex items-center gap-3 p-3 rounded-lg bg-white border border-green-200 shadow-sm hover:shadow-md transition">
                      <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-green-700">
                        <Users className="h-4 w-4" />
                      </div>
                      <span className="font-medium">Sub-Accounts</span>
                    </Link>
                    <Link to="/admin/staff" className="flex items-center gap-3 p-3 rounded-lg bg-white border border-green-200 shadow-sm hover:shadow-md transition">
                      <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-green-700">
                        <Users className="h-4 w-4" />
                      </div>
                      <span className="font-medium">Team (5+5)</span>
                    </Link>
                  </>
                )}
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
