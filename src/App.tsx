import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { HelmetProvider } from 'react-helmet-async';
import { initGA, trackPageView } from './lib/analytics';
import { initMetaPixel } from './lib/metaPixel';

// Initialize analytics on load (no-ops if env vars not set)
initGA();
initMetaPixel();

function RouteTracker() {
  const location = useLocation();
  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location]);
  return null;
}
import { Toaster } from "sonner";
import { ThemeProvider } from "./components/theme-provider";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { FavoritesProvider } from "./context/FavoritesContext";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Marketplace from "./pages/Marketplace";
import StoreDetail from "./pages/StoreDetail";
import ProductDetail from "./pages/ProductDetail";
import NotFound from "./pages/NotFound";
import AuthCallback from "./routes/auth/auth-callback";
import Cart from "./pages/Cart";
import Favorites from "./pages/Favorites";
import UpgradeToAdmin from "./pages/UpgradeToAdmin";
import ProtectedRoute from "./components/ProtectedRoute";
import OrderTracking from "./pages/OrderTracking";
import GuestOrderTracking from "./pages/GuestOrderTracking";
import CustomerProfile from "./pages/CustomerProfile";
import DebugConsole from './components/DebugConsole';
import Footer from './components/Footer';
import OrderConfirmation from "./pages/OrderConfirmation";
import SupplierReturns from "./pages/admin/SupplierReturns";
import SalesReturns from "./pages/admin/SalesReturns";
import AdminCustomers from "./pages/admin/AdminCustomers";
import PaymentSuccess from "./pages/payment/Success";
import PaymentFailed from "./pages/payment/Failed";
import Blocked from "./pages/Blocked";
import ContactUs from "./pages/ContactUs";
import CustomDomainStore from "./pages/CustomDomainStore";
import CookieConsent from "./components/CookieConsent";
import PublicPageFallback from "./components/public/PublicPageFallback";
import AdminLayout from "./components/admin/AdminLayout";

const ModularHome = lazy(() => import("./pages/public/ModularHome"));
const Features = lazy(() => import("./pages/public/Features"));
const Pricing = lazy(() => import("./pages/public/Pricing"));

const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const SubAccountDashboard = lazy(() => import("./pages/admin/SubAccountDashboard"));
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts"));
const AdminProfile = lazy(() => import("./pages/admin/AdminProfile"));
const AdminPayments = lazy(() => import("./pages/admin/AdminPayments"));
const AdminDelivery = lazy(() => import("./pages/admin/AdminDelivery"));
const AdminTemplates = lazy(() => import("./pages/admin/AdminTemplates"));
const AdminAnnouncements = lazy(() => import("./pages/admin/AdminAnnouncements"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminRevenue = lazy(() => import("./pages/admin/AdminRevenue"));
const AdminMarketing = lazy(() => import("./pages/admin/AdminMarketing"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminSuppliers = lazy(() => import("./pages/admin/AdminSuppliers"));
const AdminSupplierStatements = lazy(() => import("./pages/admin/AdminSupplierStatements"));
const AdminRawMaterials = lazy(() => import("./pages/admin/AdminRawMaterials"));
const AdminRecipes = lazy(() => import("./pages/admin/AdminRecipes"));
const AdminComposedProducts = lazy(() => import("./pages/admin/AdminComposedProducts"));
const AdminPurchases = lazy(() => import("./pages/admin/AdminPurchases"));
const AdminSupplierCredits = lazy(() => import("./pages/admin/AdminSupplierCredits"));
const AdminStaff = lazy(() => import("./pages/admin/AdminStaff"));
const AdminSalaries = lazy(() => import("./pages/admin/AdminSalaries"));
const AdminSubAccounts = lazy(() => import("./pages/admin/AdminSubAccounts"));
const AdminExpenses = lazy(() => import("./pages/admin/AdminExpenses"));
const AdminReports = lazy(() => import("./pages/admin/AdminReports"));
const AdminInventory = lazy(() => import("./pages/admin/AdminInventory"));
const AdminProduction = lazy(() => import("./pages/admin/AdminProduction"));
const AdminAccountStatement = lazy(() => import("./pages/admin/AdminAccountStatement"));
const AdminBankReconciliation = lazy(() => import("./pages/admin/AdminBankReconciliation"));
const AdminFinanceSuite = lazy(() => import("./pages/admin/AdminFinanceSuite"));
const AdminMarketplaceSync = lazy(() => import("./pages/admin/AdminMarketplaceSync"));
const AdminSEOAnalytics = lazy(() => import("./pages/admin/AdminSEOAnalytics"));
const AdminSEOAudit = lazy(() => import("./pages/admin/AdminSEOAudit"));
const GscCallback = lazy(() => import("./pages/auth/GscCallback"));
const UseCases = lazy(() => import("./pages/public/UseCases"));
const About = lazy(() => import("./pages/public/About"));
const Blog = lazy(() => import("./pages/public/Blog"));
const BlogPost = lazy(() => import("./pages/public/BlogPost"));
const AdminProductReviews = lazy(() => import("./pages/admin/AdminProductReviews"));
const AdminOrderNotifications = lazy(() => import("./pages/admin/AdminOrderNotifications"));
const AdminServiceRenewals = lazy(() => import("./pages/admin/AdminServiceRenewals"));
const AdminAuditLogs = lazy(() => import("./pages/admin/AdminAuditLogs"));
const AdminReturns = lazy(() => import("./pages/admin/AdminReturns"));
const AdminFinishedGoods = lazy(() => import("./pages/admin/AdminFinishedGoods"));
const Subscription = lazy(() => import("./pages/admin/Subscription"));
const CrmModuleShell = lazy(() => import("./pages/admin/crm/CrmModuleShell"));
const CrmPipeline = lazy(() => import("./pages/admin/crm/CrmPipeline"));
const CrmActivities = lazy(() => import("./pages/admin/crm/CrmActivities"));
const CrmMap = lazy(() => import("./pages/admin/crm/CrmMap"));
const CrmPerformance = lazy(() => import("./pages/admin/crm/CrmPerformance"));
const CrmClientProfile = lazy(() => import("./pages/admin/crm/CrmClientProfile"));
const AdminCrmReps = lazy(() => import("./pages/admin/AdminCrmReps"));
const CrmRepPortal = lazy(() => import("./pages/team/CrmRepPortal"));
const PackageOnboarding = lazy(() => import("./pages/onboarding/PackageOnboarding"));
const FinanceEstimates = lazy(() => import("./pages/admin/finance/FinanceEstimates"));
const FinanceReceipts = lazy(() => import("./pages/admin/finance/FinanceReceipts"));
const FinancePortfolio = lazy(() => import("./pages/admin/finance/FinancePortfolio"));
const PosPairing = lazy(() => import("./pages/admin/PosPairing"));
const AiBuilder = lazy(() => import("./pages/admin/AiBuilder"));
const BlogPublisher = lazy(() => import("./pages/admin/BlogPublisher"));
const WhitelabelApp = lazy(() => import("./pages/admin/WhitelabelApp"));
const StoreBlog = lazy(() => import("./pages/public/StoreBlog"));
const StoreBlogPost = lazy(() => import("./pages/public/StoreBlogPost"));
const AdminProjects = lazy(() => import("./pages/admin/AdminProjects"));
const ContentCreator = lazy(() => import("./pages/admin/ai/ContentCreator"));
const MarketStrategy = lazy(() => import("./pages/admin/ai/MarketStrategy"));
const ProposalWriter = lazy(() => import("./pages/admin/ai/ProposalWriter"));
const SeoAssistant = lazy(() => import("./pages/admin/ai/SeoAssistant"));
const BusinessInsights = lazy(() => import("./pages/admin/ai/BusinessInsights"));
const CampaignWriter = lazy(() => import("./pages/admin/ai/CampaignWriter"));

const PLATFORM_HOSTS = ['localhost', '127.0.0.1', 'grabio.space', 'www.grabio.space', 'market-flow-7b074.web.app'];
const _hostname = typeof window !== 'undefined' ? window.location.hostname : '';
const isCustomDomain = _hostname !== '' && !PLATFORM_HOSTS.includes(_hostname);

      function App() {
        return (
          <HelmetProvider>
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
                      <RouteTracker />
                      <Suspense fallback={<PublicPageFallback />}>
                      <Routes>
                        {/* ── Custom domain: serve the matched store, then only public/cart routes ── */}
                        {isCustomDomain && (
                          <>
                            <Route path="/" element={<CustomDomainStore hostname={_hostname} />} />
                            <Route path="/store/:slug" element={<StoreDetail />} />
                            <Route path="/store/:slug/category/:categorySlug" element={<StoreDetail />} />
                            <Route path="/store/:slug/blog" element={<StoreBlog />} />
                            <Route path="/store/:slug/blog/:postId" element={<StoreBlogPost />} />
                            <Route path="/store/:storeSlug/product/:productSlug" element={<ProductDetail />} />
                            <Route path="/store/id/:id" element={<StoreDetail />} />
                            <Route path="/store/id/:id/category/:categorySlug" element={<StoreDetail />} />
                            <Route path="/product/id/:id" element={<ProductDetail />} />
                            <Route path="/cart" element={<Cart />} />
                            <Route path="/favorites" element={<Favorites />} />
                            <Route path="/track-order" element={<GuestOrderTracking />} />
                            <Route path="/contact" element={<ContactUs />} />
                            <Route path="/orders" element={<ProtectedRoute><OrderTracking /></ProtectedRoute>} />
                            <Route path="/orders/confirmation" element={<ProtectedRoute><OrderConfirmation /></ProtectedRoute>} />
                            <Route path="*" element={<NotFound />} />
                          </>
                        )}
                        {/* ── Normal platform routes ── */}
                        {!isCustomDomain && (
                          <>
                        <Route path="/login" element={<Login />} />
                        <Route path="/signup" element={<Navigate to="/login?tab=signup" replace />} />
                        <Route path="/auth/callback" element={<AuthCallback />} />
                        <Route path="/auth/gsc-callback" element={<GscCallback />} />
                        {/* Main app routes */}
                        <Route path="/" element={<ModularHome />} />
                        <Route path="/home" element={<ModularHome />} />
                        <Route path="/search" element={<Marketplace />} />
                        <Route path="/store/:slug" element={<StoreDetail />} />
                        <Route path="/store/:slug/category/:categorySlug" element={<StoreDetail />} />
                        <Route path="/store/:slug/blog" element={<StoreBlog />} />
                        <Route path="/store/:slug/blog/:postId" element={<StoreBlogPost />} />
                        <Route path="/store/:storeSlug/product/:productSlug" element={<ProductDetail />} />
                        {/* Backward compatibility routes */}
                        <Route path="/store/id/:id" element={<StoreDetail />} />
                        <Route path="/store/id/:id/category/:categorySlug" element={<StoreDetail />} />
                        <Route path="/product/id/:id" element={<ProductDetail />} />
                        {/* Public routes (use localStorage, work for guests) */}
                        <Route path="/cart" element={<Cart />} />
                        <Route path="/favorites" element={<Favorites />} />
                        <Route path="/track-order" element={<GuestOrderTracking />} />
                        <Route path="/contact" element={<ContactUs />} />
                        {/* Protected routes */}
                        <Route path="/orders" element={<ProtectedRoute><OrderTracking /></ProtectedRoute>} />
                        <Route path="/orders/confirmation" element={<ProtectedRoute><OrderConfirmation /></ProtectedRoute>} />
                        <Route path="/profile" element={<ProtectedRoute><CustomerProfile /></ProtectedRoute>} />
                        <Route path="/upgrade" element={<ProtectedRoute><UpgradeToAdmin /></ProtectedRoute>} />
                        <Route path="/onboarding/package" element={<ProtectedRoute allowedRoles={['admin']}><PackageOnboarding /></ProtectedRoute>} />
                        {/* Payment Routes */}
                        <Route path="/payment/success" element={<ProtectedRoute><PaymentSuccess /></ProtectedRoute>} />
                        <Route path="/payment/failed" element={<ProtectedRoute><PaymentFailed /></ProtectedRoute>} />
                        <Route path="/blocked" element={<ProtectedRoute><Blocked /></ProtectedRoute>} />
                        {/* Admin shell + routes */}
                        <Route element={<AdminLayout />}>
                        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
                        <Route path="/subscription" element={<ProtectedRoute allowedRoles={['admin']}><Subscription /></ProtectedRoute>} />
                        <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
                        <Route path="/team/dashboard" element={<ProtectedRoute allowedRoles={['sub_account']}><SubAccountDashboard /></ProtectedRoute>} />
                        <Route path="/admin/products" element={<ProtectedRoute allowedRoles={['admin', 'sub_account']} requiredPermission="view_inventory" requiredModule="stock"><AdminProducts /></ProtectedRoute>} />
                        <Route path="/admin/profile" element={<ProtectedRoute allowedRoles={['admin']}><AdminProfile /></ProtectedRoute>} />
                        <Route path="/admin/payments" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="payments"><AdminPayments /></ProtectedRoute>} />
                        <Route path="/admin/delivery" element={<ProtectedRoute allowedRoles={['admin', 'sub_account']} requiredPermission="manage_deliveries" requiredModule="delivery"><AdminDelivery /></ProtectedRoute>} />
                        <Route path="/admin/templates" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="builder"><AdminTemplates /></ProtectedRoute>} />
                        <Route path="/admin/announcements" element={<ProtectedRoute allowedRoles={['admin', 'sub_account']} requiredModule="marketplace"><AdminAnnouncements /></ProtectedRoute>} />
                        <Route path="/admin/analytics" element={<ProtectedRoute allowedRoles={['admin', 'sub_account']} requiredPermission="view_reports" requiredModule="analytics"><AdminAnalytics /></ProtectedRoute>} />
                        <Route path="/admin/revenue" element={<ProtectedRoute allowedRoles={['admin', 'sub_account']} requiredPermission="view_reports" requiredModule="analytics"><AdminRevenue /></ProtectedRoute>} />
                        <Route path="/admin/marketing" element={<ProtectedRoute allowedRoles={['admin']}><AdminMarketing /></ProtectedRoute>} />
                        <Route path="/admin/orders" element={<ProtectedRoute allowedRoles={['admin', 'sub_account']} requiredPermission="view_orders" requiredModule="invoicing"><AdminOrders /></ProtectedRoute>} />
                        {/* Inventory Management */}
                        <Route path="/admin/inventory" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="stock"><AdminInventory /></ProtectedRoute>} />
                        <Route path="/admin/suppliers" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="stock"><AdminSuppliers /></ProtectedRoute>} />
                        <Route path="/admin/supplier-statements" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="stock"><AdminSupplierStatements /></ProtectedRoute>} />
                        <Route path="/admin/raw-materials" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="factory"><AdminRawMaterials /></ProtectedRoute>} />
                        <Route path="/admin/recipes" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="restaurant"><AdminRecipes /></ProtectedRoute>} />
                        <Route path="/admin/composed-products" element={<ProtectedRoute allowedRoles={['admin', 'sub_account']} requiredPermission="view_inventory" requiredModule="restaurant"><AdminComposedProducts /></ProtectedRoute>} />
                        <Route path="/admin/production" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="factory"><AdminProduction /></ProtectedRoute>} />
                        <Route path="/admin/finished-goods" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="factory"><AdminFinishedGoods /></ProtectedRoute>} />
                        {/* Purchasing & Returns */}
                        <Route path="/admin/purchases" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="stock"><AdminPurchases /></ProtectedRoute>} />
                        <Route path="/admin/returns" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="stock"><AdminReturns /></ProtectedRoute>} />
                        <Route path="/admin/supplier-credits" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="stock"><AdminSupplierCredits /></ProtectedRoute>} />
                        <Route path="/admin/supplier-returns" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="stock"><SupplierReturns /></ProtectedRoute>} />
                        <Route path="/admin/sales-returns" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="stock"><SalesReturns /></ProtectedRoute>} />
                        {/* Staff & HR */}
                        <Route path="/admin/staff" element={<ProtectedRoute allowedRoles={['admin']}><AdminStaff /></ProtectedRoute>} />
                        <Route path="/admin/salaries" element={<ProtectedRoute allowedRoles={['admin']}><AdminSalaries /></ProtectedRoute>} />
                        <Route path="/admin/sub-accounts" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="team"><AdminSubAccounts /></ProtectedRoute>} />
                        {/* Financial */}
                        <Route path="/admin/expenses" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="payments"><AdminExpenses /></ProtectedRoute>} />
                        <Route path="/admin/reports" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="analytics"><AdminReports /></ProtectedRoute>} />
                        <Route path="/admin/finance" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="payments"><AdminFinanceSuite /></ProtectedRoute>} />
                        <Route path="/admin/finance/estimates" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="invoice_manager"><FinanceEstimates /></ProtectedRoute>} />
                        <Route path="/admin/finance/receipts" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="invoice_manager"><FinanceReceipts /></ProtectedRoute>} />
                        <Route path="/admin/finance/portfolio" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="invoice_manager"><FinancePortfolio /></ProtectedRoute>} />
                        <Route path="/admin/pos" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="pos"><PosPairing /></ProtectedRoute>} />
                        <Route path="/admin/ai-builder" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="ai_builder"><AiBuilder /></ProtectedRoute>} />
                        <Route path="/admin/blog" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="blog_publisher"><BlogPublisher /></ProtectedRoute>} />
                        <Route path="/admin/whitelabel" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="whitelabel"><WhitelabelApp /></ProtectedRoute>} />
                        <Route path="/admin/projects" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="projects"><AdminProjects /></ProtectedRoute>} />
                        <Route path="/admin/ai/content-creator" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="content_creator"><ContentCreator /></ProtectedRoute>} />
                        <Route path="/admin/ai/market-strategy" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="market_strategy"><MarketStrategy /></ProtectedRoute>} />
                        <Route path="/admin/ai/proposal-writer" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="proposal_writer"><ProposalWriter /></ProtectedRoute>} />
                        <Route path="/admin/ai/seo-assistant" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="seo_assistant"><SeoAssistant /></ProtectedRoute>} />
                        <Route path="/admin/ai/business-insights" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="analytics_insights"><BusinessInsights /></ProtectedRoute>} />
                        <Route path="/admin/ai/campaign-writer" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="campaign_writer"><CampaignWriter /></ProtectedRoute>} />
                        <Route path="/admin/marketplace" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="dropship"><AdminMarketplaceSync /></ProtectedRoute>} />
                        <Route path="/admin/product-reviews" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="marketplace"><AdminProductReviews /></ProtectedRoute>} />
                        <Route path="/admin/order-notifications" element={<ProtectedRoute allowedRoles={['admin']}><AdminOrderNotifications /></ProtectedRoute>} />
                        <Route path="/admin/account-statement" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="analytics"><AdminAccountStatement /></ProtectedRoute>} />
                        <Route path="/admin/cash-collection" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="payments"><AdminBankReconciliation /></ProtectedRoute>} />
                        <Route path="/admin/bank-reconciliation" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="payments"><AdminBankReconciliation /></ProtectedRoute>} />
                        <Route path="/admin/service-renewals" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="services"><AdminServiceRenewals /></ProtectedRoute>} />
                        <Route path="/admin/audit-logs" element={<ProtectedRoute allowedRoles={['admin']}><AdminAuditLogs /></ProtectedRoute>} />
                        <Route path="/admin/seo-analytics" element={<ProtectedRoute allowedRoles={['admin']}><AdminSEOAnalytics /></ProtectedRoute>} />
                        <Route path="/admin/seo-audit" element={<ProtectedRoute allowedRoles={['admin']}><AdminSEOAudit /></ProtectedRoute>} />
                        {/* Customer directory (orders/billing) */}
                        <Route path="/admin/customers" element={<ProtectedRoute allowedRoles={['admin', 'sub_account']} requiredPermission="view_customers"><AdminCustomers /></ProtectedRoute>} />
                        {/* Sales CRM add-on */}
                        <Route path="/admin/crm" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="crm"><CrmModuleShell /></ProtectedRoute>}>
                          <Route index element={<Navigate to="pipeline" replace />} />
                          <Route path="pipeline" element={<CrmPipeline />} />
                          <Route path="activities" element={<CrmActivities />} />
                          <Route path="map" element={<CrmMap />} />
                          <Route path="performance" element={<CrmPerformance />} />
                          <Route path="clients/:clientId" element={<CrmClientProfile />} />
                          <Route path="reps" element={<AdminCrmReps />} />
                        </Route>
                        </Route>
                        <Route path="/team/crm" element={<ProtectedRoute allowedRoles={['crm_rep']} requiredModule="crm"><CrmRepPortal /></ProtectedRoute>} />
                        {/* Public marketing pages — must be BEFORE /:slug */}
                        <Route path="/features" element={<Features />} />
                        <Route path="/pricing" element={<Pricing />} />
                        <Route path="/use-cases" element={<UseCases />} />
                        <Route path="/about" element={<About />} />
                        <Route path="/blog" element={<Blog />} />
                        <Route path="/blog/:slug" element={<BlogPost />} />
                        {/* Short store URLs: /:slug and /:slug/product/:productSlug */}
                        <Route path="/:slug" element={<StoreDetail />} />
                        <Route path="/:slug/category/:categorySlug" element={<StoreDetail />} />
                        <Route path="/:storeSlug/product/:productSlug" element={<ProductDetail />} />
                        <Route path="/privacy" element={<PrivacyPolicy />} />
                        {/* 404 catch-all route */}
                        <Route path="*" element={<NotFound />} />
                          </>
                        )}
                      </Routes>
                      </Suspense>
                      <Footer />
                      <Toaster />
                      <DebugConsole />
                      <CookieConsent />
                    </BrowserRouter>
                  </FavoritesProvider>
                {/* CreditsProvider removed */}
              </CartProvider>
            </AuthProvider>
          </ThemeProvider>
          </HelmetProvider>
        );
      }

      export default App;
