import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { ThemeProvider } from "./components/theme-provider";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { FavoritesProvider } from "./context/FavoritesContext";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Marketplace from "./pages/Marketplace";
import StoreDetail from "./pages/StoreDetail";
import ProductDetail from "./pages/ProductDetail";
import NotFound from "./pages/NotFound";
import AuthCallback from "./routes/auth/auth-callback";
import Cart from "./pages/Cart";
import Favorites from "./pages/Favorites";
import UpgradeToAdmin from "./pages/UpgradeToAdmin";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminDashboard from "./pages/admin/AdminDashboard";
import SubAccountDashboard from "./pages/admin/SubAccountDashboard";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminProfile from "./pages/admin/AdminProfile";
import AdminPayments from "./pages/admin/AdminPayments";
import AdminDelivery from "./pages/admin/AdminDelivery";
import AdminTemplates from "./pages/admin/AdminTemplates";
import AdminAnnouncements from "./pages/admin/AdminAnnouncements";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminRevenue from "./pages/admin/AdminRevenue";
import AdminOrders from "./pages/admin/AdminOrders";
import OrderTracking from "./pages/OrderTracking";
import GuestOrderTracking from "./pages/GuestOrderTracking";
import DebugConsole from './components/DebugConsole';
import Footer from './components/Footer';
import OrderConfirmation from "./pages/OrderConfirmation";
import AdminSuppliers from "./pages/admin/AdminSuppliers";
import AdminSupplierStatements from "./pages/admin/AdminSupplierStatements";
import AdminRawMaterials from "./pages/admin/AdminRawMaterials";
import AdminRecipes from "./pages/admin/AdminRecipes";
import AdminComposedProducts from "./pages/admin/AdminComposedProducts";
import AdminPurchases from "./pages/admin/AdminPurchases";
import AdminSupplierReturns from "./pages/admin/AdminSupplierReturns";
import AdminSupplierCredits from "./pages/admin/AdminSupplierCredits";
import AdminSupplierReturnDetail from "./pages/admin/AdminSupplierReturnDetail";
import SupplierReturns from "./pages/admin/SupplierReturns";
import SalesReturns from "./pages/admin/SalesReturns";
import AdminStaff from "./pages/admin/AdminStaff";
import AdminSalaries from "./pages/admin/AdminSalaries";
import AdminSubAccounts from "./pages/admin/AdminSubAccounts";
import AdminExpenses from "./pages/admin/AdminExpenses";
import AdminReports from "./pages/admin/AdminReports";
import AdminCustomers from "./pages/admin/AdminCustomers";
import AdminInventory from "./pages/admin/AdminInventory";
import AdminProduction from "./pages/admin/AdminProduction";
import AdminAccountStatement from "./pages/admin/AdminAccountStatement";
import AdminBankReconciliation from "./pages/admin/AdminBankReconciliation";
import AdminAuditLogs from "./pages/admin/AdminAuditLogs";
import AdminReturns from "./pages/admin/AdminReturns";
import AdminFinishedGoods from "./pages/admin/AdminFinishedGoods";
import Subscription from "./pages/admin/Subscription";
import PaymentSuccess from "./pages/payment/Success";
import PaymentFailed from "./pages/payment/Failed";
import Blocked from "./pages/Blocked";


      function App() {
        return (
          <ThemeProvider>
            <AuthProvider>
              <CartProvider>
                {/* CreditsProvider removed */}
                  <FavoritesProvider>
                    <BrowserRouter
                      future={{
                        v7_startTransition: true,
                        v7_relativeSplatPath: true,
                      }}
                    >
                      <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/signup" element={<Signup />} />
                        <Route path="/auth/callback" element={<AuthCallback />} />
                        {/* Main app routes */}
                        <Route path="/" element={<Marketplace />} />
                        <Route path="/search" element={<Marketplace />} />
                        <Route path="/store/:slug" element={<StoreDetail />} />
                        <Route path="/store/:storeSlug/product/:productSlug" element={<ProductDetail />} />
                        {/* Backward compatibility routes */}
                        <Route path="/store/id/:id" element={<StoreDetail />} />
                        <Route path="/product/id/:id" element={<ProductDetail />} />
                        {/* Public routes (use localStorage, work for guests) */}
                        <Route path="/cart" element={<Cart />} />
                        <Route path="/favorites" element={<Favorites />} />
                        <Route path="/track-order" element={<GuestOrderTracking />} />
                        {/* Protected routes */}
                        <Route path="/orders" element={<ProtectedRoute><OrderTracking /></ProtectedRoute>} />
                        <Route path="/orders/confirmation" element={<ProtectedRoute><OrderConfirmation /></ProtectedRoute>} />
                        <Route path="/upgrade" element={<ProtectedRoute><UpgradeToAdmin /></ProtectedRoute>} />
                        {/* Payment Routes */}
                        <Route path="/payment/success" element={<ProtectedRoute><PaymentSuccess /></ProtectedRoute>} />
                        <Route path="/payment/failed" element={<ProtectedRoute><PaymentFailed /></ProtectedRoute>} />
                        <Route path="/blocked" element={<ProtectedRoute><Blocked /></ProtectedRoute>} />
                        {/* Admin Routes */}
                        <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
                        <Route path="/subscription" element={<ProtectedRoute allowedRoles={['admin']}><Subscription /></ProtectedRoute>} />
                        <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
                        {/* Sub-Account Routes */}
                        <Route path="/team/dashboard" element={<ProtectedRoute allowedRoles={['sub_account']}><SubAccountDashboard /></ProtectedRoute>} />
                        <Route path="/admin/products" element={<ProtectedRoute allowedRoles={['admin', 'sub_account']} requiredPermission="view_inventory"><AdminProducts /></ProtectedRoute>} />
                        <Route path="/admin/profile" element={<ProtectedRoute allowedRoles={['admin']}><AdminProfile /></ProtectedRoute>} />
                        <Route path="/admin/payments" element={<ProtectedRoute allowedRoles={['admin']}><AdminPayments /></ProtectedRoute>} />
                        <Route path="/admin/delivery" element={<ProtectedRoute allowedRoles={['admin', 'sub_account']} requiredPermission="manage_deliveries"><AdminDelivery /></ProtectedRoute>} />
                        <Route path="/admin/templates" element={<ProtectedRoute allowedRoles={['admin']}><AdminTemplates /></ProtectedRoute>} />
                        <Route path="/admin/announcements" element={<ProtectedRoute allowedRoles={['admin', 'sub_account']}><AdminAnnouncements /></ProtectedRoute>} />
                        <Route path="/admin/analytics" element={<ProtectedRoute allowedRoles={['admin', 'sub_account']} requiredPermission="view_reports"><AdminAnalytics /></ProtectedRoute>} />
                        <Route path="/admin/revenue" element={<ProtectedRoute allowedRoles={['admin', 'sub_account']} requiredPermission="view_reports"><AdminRevenue /></ProtectedRoute>} />
                        <Route path="/admin/orders" element={<ProtectedRoute allowedRoles={['admin', 'sub_account']} requiredPermission="view_orders"><AdminOrders /></ProtectedRoute>} />
                        {/* Inventory Management */}
                        <Route path="/admin/inventory" element={<ProtectedRoute allowedRoles={['admin']}><AdminInventory /></ProtectedRoute>} />
                        <Route path="/admin/suppliers" element={<ProtectedRoute allowedRoles={['admin']}><AdminSuppliers /></ProtectedRoute>} />
                        <Route path="/admin/supplier-statements" element={<ProtectedRoute allowedRoles={['admin']}><AdminSupplierStatements /></ProtectedRoute>} />
                        <Route path="/admin/raw-materials" element={<ProtectedRoute allowedRoles={['admin']}><AdminRawMaterials /></ProtectedRoute>} />
                        <Route path="/admin/recipes" element={<ProtectedRoute allowedRoles={['admin']}><AdminRecipes /></ProtectedRoute>} />
                        <Route path="/admin/composed-products" element={<ProtectedRoute allowedRoles={['admin', 'sub_account']} requiredPermission="view_inventory"><AdminComposedProducts /></ProtectedRoute>} />
                        <Route path="/admin/production" element={<ProtectedRoute allowedRoles={['admin']}><AdminProduction /></ProtectedRoute>} />
                        <Route path="/admin/finished-goods" element={<ProtectedRoute allowedRoles={['admin']}><AdminFinishedGoods /></ProtectedRoute>} />
                        {/* Purchasing & Returns */}
                        <Route path="/admin/purchases" element={<ProtectedRoute allowedRoles={['admin']}><AdminPurchases /></ProtectedRoute>} />
                        <Route path="/admin/returns" element={<ProtectedRoute allowedRoles={['admin']}><AdminReturns /></ProtectedRoute>} />
                        <Route path="/admin/supplier-returns-old" element={<ProtectedRoute allowedRoles={['admin']}><AdminSupplierReturns /></ProtectedRoute>} />
                        <Route path="/admin/supplier-returns-old/:id" element={<ProtectedRoute allowedRoles={['admin']}><AdminSupplierReturnDetail /></ProtectedRoute>} />
                        <Route path="/admin/supplier-credits" element={<ProtectedRoute allowedRoles={['admin']}><AdminSupplierCredits /></ProtectedRoute>} />
                        <Route path="/admin/supplier-returns" element={<ProtectedRoute allowedRoles={['admin']}><SupplierReturns /></ProtectedRoute>} />
                        <Route path="/admin/sales-returns" element={<ProtectedRoute allowedRoles={['admin']}><SalesReturns /></ProtectedRoute>} />
                        {/* Staff & HR */}
                        <Route path="/admin/staff" element={<ProtectedRoute allowedRoles={['admin']}><AdminStaff /></ProtectedRoute>} />
                        <Route path="/admin/salaries" element={<ProtectedRoute allowedRoles={['admin']}><AdminSalaries /></ProtectedRoute>} />
                        <Route path="/admin/sub-accounts" element={<ProtectedRoute allowedRoles={['admin']}><AdminSubAccounts /></ProtectedRoute>} />
                        {/* Financial */}
                        <Route path="/admin/expenses" element={<ProtectedRoute allowedRoles={['admin']}><AdminExpenses /></ProtectedRoute>} />
                        <Route path="/admin/reports" element={<ProtectedRoute allowedRoles={['admin']}><AdminReports /></ProtectedRoute>} />
                        <Route path="/admin/account-statement" element={<ProtectedRoute allowedRoles={['admin']}><AdminAccountStatement /></ProtectedRoute>} />
                        <Route path="/admin/bank-reconciliation" element={<ProtectedRoute allowedRoles={['admin']}><AdminBankReconciliation /></ProtectedRoute>} />
                        <Route path="/admin/audit-logs" element={<ProtectedRoute allowedRoles={['admin']}><AdminAuditLogs /></ProtectedRoute>} />
                        {/* CRM */}
                        <Route path="/admin/customers" element={<ProtectedRoute allowedRoles={['admin', 'sub_account']} requiredPermission="view_customers"><AdminCustomers /></ProtectedRoute>} />
                        {/* 404 catch-all route */}
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                      <Footer />
                      <Toaster />
                      <DebugConsole />
                    </BrowserRouter>
                  </FavoritesProvider>
                {/* CreditsProvider removed */}
              </CartProvider>
            </AuthProvider>
          </ThemeProvider>
        );
      }

      export default App;
