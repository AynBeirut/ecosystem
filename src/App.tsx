import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { HelmetProvider } from 'react-helmet-async';
import { initGA, trackPageView } from './lib/analytics';
import { initMetaPixel, pixelPageView } from './lib/metaPixel';
import { initGTM } from './lib/gtm';

// Initialize analytics on load (no-ops if env vars not set)
initGA();
initMetaPixel();
initGTM();

function RouteTracker() {
  const location = useLocation();
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    const path = location.pathname + location.search;
    trackPageView(path);
    pixelPageView();
  }, [location.pathname, location.search]);
  return null;
}
import { isPlatformHostname } from '@/lib/platformHosts';
import { storeSlugFromHostname } from '@/lib/storeUrls';
import StoreSlugRedirect from './components/StoreSlugRedirect';
import { Toaster as SonnerToaster } from "sonner";
import { Toaster as ShadcnToaster } from "@/components/ui/toaster";
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
import EditorPreviewRoot, { isEditorEmbedFrame } from "./embed/EditorPreviewRoot";
import BuilderSetupGate from "./components/builder/BuilderSetupGate";

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
const UnifiedBuilderWizard = lazy(() => import("./pages/admin/UnifiedBuilderWizard"));
const AdminAnnouncements = lazy(() => import("./pages/admin/AdminAnnouncements"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminRevenue = lazy(() => import("./pages/admin/AdminRevenue"));
const AdminMarketing = lazy(() => import("./pages/admin/AdminMarketing"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminScheduledOrders = lazy(() => import("./pages/admin/AdminScheduledOrders"));
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
const AdminReports = lazy(() => import("./pages/admin/AdminReports"));
const AdminInventory = lazy(() => import("./pages/admin/AdminInventory"));
const AdminProduction = lazy(() => import("./pages/admin/AdminProduction"));
const AdminAccountStatement = lazy(() => import("./pages/admin/AdminAccountStatement"));
const PartyAccountStatementPage = lazy(() => import("./pages/admin/PartyAccountStatementPage"));
const AdminBankReconciliation = lazy(() => import("./pages/admin/AdminBankReconciliation"));
const AdminDeliveryWallet = lazy(() => import("./pages/admin/AdminDeliveryWallet"));
const AdminFinanceSuite = lazy(() => import("./pages/admin/AdminFinanceSuite"));
const AdminMarketplaceSync = lazy(() => import("./pages/admin/AdminMarketplaceSync"));
const AdminSEOAnalytics = lazy(() => import("./pages/admin/AdminSEOAnalytics"));
const AdminSEOAudit = lazy(() => import("./pages/admin/AdminSEOAudit"));
const GscCallback = lazy(() => import("./pages/auth/GscCallback"));
const UseCases = lazy(() => import("./pages/public/UseCases"));
const SolutionsIndex = lazy(() => import("./pages/public/SolutionsIndex"));
const SolutionDetail = lazy(() => import("./pages/public/SolutionDetail"));
const WordPressAccess = lazy(() => import("./pages/public/WordPressAccess"));
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
const CrmRepPortal = lazy(() => import("./pages/team/CrmRepPortal"));
const PackageOnboarding = lazy(() => import("./pages/onboarding/PackageOnboarding"));
const BuilderOnboarding = lazy(() => import("./pages/onboarding/BuilderOnboarding"));
const FreelancerOnboarding = lazy(() => import("./pages/onboarding/FreelancerOnboarding"));
const FreelancerPortal = lazy(() => import("./pages/freelancer/FreelancerPortal"));
const Careers = lazy(() => import("./pages/public/Careers"));
const CareersApply = lazy(() => import("./pages/public/CareersApply"));
const BuilderDashboard = lazy(() => import("./pages/builder/BuilderDashboard"));
const BuilderDemoEdit = lazy(() => import("./pages/builder/BuilderDemoEdit"));
const BuilderDemoPreview = lazy(() => import("./pages/builder/BuilderDemoPreview"));
const FinanceModuleShell = lazy(() => import("./pages/admin/finance/FinanceModuleShell"));
const InvoiceManagerModuleShell = lazy(() => import("./pages/admin/invoice-manager/InvoiceManagerModuleShell"));
const PosPairing = lazy(() => import("./pages/admin/PosPairing"));
const AiBuilder = lazy(() => import("./pages/admin/AiBuilder"));
const BlogPublisher = lazy(() => import("./pages/admin/BlogPublisher"));
const WhitelabelApp = lazy(() => import("./pages/admin/WhitelabelApp"));
const StoreBlog = lazy(() => import("./pages/public/StoreBlog"));
const StoreBlogPost = lazy(() => import("./pages/public/StoreBlogPost"));
const AdminProjects = lazy(() => import("./pages/admin/AdminProjects"));
const AdminWordPressQueue = lazy(() => import("./pages/admin/AdminWordPressQueue"));
const ThemeEditor = lazy(() => import("./pages/admin/ThemeEditor"));
const ContentCreator = lazy(() => import("./pages/admin/ai/ContentCreator"));
const MarketStrategy = lazy(() => import("./pages/admin/ai/MarketStrategy"));
const ProposalWriter = lazy(() => import("./pages/admin/ai/ProposalWriter"));
const SeoAssistant = lazy(() => import("./pages/admin/ai/SeoAssistant"));
const BusinessInsights = lazy(() => import("./pages/admin/ai/BusinessInsights"));
const CampaignWriter = lazy(() => import("./pages/admin/ai/CampaignWriter"));
const AdminAiAgent = lazy(() => import("./pages/admin/AdminAiAgent"));
import InvoiceSpaRedirect from "./components/InvoiceSpaRedirect";

const _hostname = typeof window !== 'undefined' ? window.location.hostname : '';
const _storeSubdomainSlug = _hostname ? storeSlugFromHostname(_hostname) : '';
const isGrabioSubdomain = !!_storeSubdomainSlug;
const isExternalCustomDomain = _hostname !== '' && !isPlatformHostname(_hostname) && !isGrabioSubdomain;
const isCustomDomain = isExternalCustomDomain;

import { isPlatformHostname } from '@/lib/platformHosts';
import { isStoreBrandedHost } from '@/lib/storeUrls';

function AppFooter() {
  const location = useLocation();
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  if (location.pathname === '/admin/theme-editor') return null;
  if (isStoreBrandedHost(hostname)) return null;
  return <Footer />;
}

      function App() {
        if (isEditorEmbedFrame()) {
          return <EditorPreviewRoot />;
        }

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
                        {/* ── Grabio store subdomain: jinans-kitchen.grabio.space ── */}
                        {isGrabioSubdomain && (
                          <>
                            <Route element={<StoreDetail />}>
                              <Route index />
                              <Route path="products" />
                              <Route path="category/:categorySlug" />
                            </Route>
                            <Route path="/product/id/:id" element={<ProductDetail />} />
                            <Route path="/product/:productSlug" element={<ProductDetail />} />
                            <Route path="/blog" element={<StoreBlog />} />
                            <Route path="/blog/:postId" element={<StoreBlogPost />} />
                            <Route path="/cart" element={<Cart />} />
                            <Route path="/favorites" element={<Favorites />} />
                            <Route path="/track-order" element={<GuestOrderTracking />} />
                            <Route path="/contact" element={<ContactUs />} />
                            <Route path="/orders" element={<ProtectedRoute><OrderTracking /></ProtectedRoute>} />
                            <Route path="/orders/confirmation" element={<ProtectedRoute><OrderConfirmation /></ProtectedRoute>} />
                            <Route path="*" element={<NotFound />} />
                          </>
                        )}
                        {/* ── External custom domain ── */}
                        {isCustomDomain && (
                          <>
                            <Route path="/" element={<CustomDomainStore hostname={_hostname} />} />
                            <Route path="/store/:slug" element={<StoreDetail />}>
                              <Route index />
                              <Route path="products" />
                              <Route path="category/:categorySlug" />
                            </Route>
                            <Route path="/store/id/:id" element={<StoreDetail />}>
                              <Route index />
                              <Route path="products" />
                              <Route path="category/:categorySlug" />
                            </Route>
                            <Route path="/store/:slug/blog" element={<StoreBlog />} />
                            <Route path="/store/:slug/blog/:postId" element={<StoreBlogPost />} />
                            <Route path="/product/id/:id" element={<ProductDetail />} />
                            <Route path="/product/:productSlug" element={<ProductDetail />} />
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
                        {!isCustomDomain && !isGrabioSubdomain && (
                          <>
                        <Route path="/login" element={<Login />} />
                        <Route path="/signup" element={<Navigate to="/login?tab=signup" replace />} />
                        <Route path="/auth/callback" element={<AuthCallback />} />
                        <Route path="/auth/gsc-callback" element={<GscCallback />} />
                        {/* Main app routes */}
                        <Route path="/" element={<ModularHome />} />
                        <Route path="/home" element={<ModularHome />} />
                        <Route path="/search" element={<Marketplace />} />
                        <Route path="/marketplace" element={<Navigate to="/search" replace />} />
                        <Route path="/store/:slug" element={<StoreDetail />}>
                          <Route index />
                          <Route path="products" />
                          <Route path="category/:categorySlug" />
                        </Route>
                        <Route path="/store/:slug/blog" element={<StoreBlog />} />
                        <Route path="/store/:slug/blog/:postId" element={<StoreBlogPost />} />
                        <Route path="/store/:storeSlug/product/:productSlug" element={<ProductDetail />} />
                        {/* Backward compatibility routes */}
                        <Route path="/store/id/:id" element={<StoreDetail />}>
                          <Route index />
                          <Route path="products" />
                          <Route path="category/:categorySlug" />
                        </Route>
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
                        <Route path="/onboarding/builder" element={<ProtectedRoute><BuilderOnboarding /></ProtectedRoute>} />
                        <Route path="/onboarding/freelancer" element={<ProtectedRoute><FreelancerOnboarding /></ProtectedRoute>} />
                        <Route path="/freelancer" element={<ProtectedRoute allowedRoles={['freelancer']}><FreelancerPortal /></ProtectedRoute>} />
                        <Route path="/builder" element={<ProtectedRoute><BuilderDashboard /></ProtectedRoute>} />
                        <Route path="/builder/demo/:demoId/edit" element={<ProtectedRoute><BuilderDemoEdit /></ProtectedRoute>} />
                        <Route path="/builder/demo/:demoId/preview" element={<ProtectedRoute><BuilderDemoPreview /></ProtectedRoute>} />
                        {/* Payment Routes */}
                        <Route path="/payment/success" element={<ProtectedRoute><PaymentSuccess /></ProtectedRoute>} />
                        <Route path="/payment/failed" element={<ProtectedRoute><PaymentFailed /></ProtectedRoute>} />
                        <Route path="/blocked" element={<ProtectedRoute><Blocked /></ProtectedRoute>} />
                        {/* Admin shell + routes */}
                        <Route element={<AdminLayout />}>
                        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
                        <Route path="/subscription" element={<ProtectedRoute allowedRoles={['admin', 'user']}><Subscription /></ProtectedRoute>} />
                        <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
                        <Route path="/team/dashboard" element={<ProtectedRoute allowedRoles={['sub_account']}><SubAccountDashboard /></ProtectedRoute>} />
                        <Route path="/admin/products" element={<ProtectedRoute allowedRoles={['admin', 'sub_account']} requiredPermission="view_inventory" requiredModule="stock"><AdminProducts /></ProtectedRoute>} />
                        <Route path="/admin/profile" element={<ProtectedRoute allowedRoles={['admin']}><AdminProfile /></ProtectedRoute>} />
                        <Route path="/admin/payments" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="payments"><AdminPayments /></ProtectedRoute>} />
                        <Route path="/admin/delivery" element={<ProtectedRoute allowedRoles={['admin', 'sub_account']} requiredPermission="manage_deliveries" requiredModule="delivery"><AdminDelivery /></ProtectedRoute>} />
                        <Route path="/admin/builder" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="builder"><UnifiedBuilderWizard /></ProtectedRoute>} />
                        <Route path="/admin/wordpress-queue" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="builder"><AdminWordPressQueue /></ProtectedRoute>} />
                        <Route path="/admin/templates" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="builder"><BuilderSetupGate targetMethod="classic"><AdminTemplates /></BuilderSetupGate></ProtectedRoute>} />
                        <Route
                          path="/admin/theme-editor"
                          element={
                            <ProtectedRoute allowedRoles={['admin']} requiredModule="builder">
                              <BuilderSetupGate targetMethod="theme_editor">
                                <ThemeEditor />
                              </BuilderSetupGate>
                            </ProtectedRoute>
                          }
                        />
                        <Route path="/admin/announcements" element={<ProtectedRoute allowedRoles={['admin', 'sub_account']} requiredModule="marketplace"><AdminAnnouncements /></ProtectedRoute>} />
                        <Route path="/admin/analytics" element={<ProtectedRoute allowedRoles={['admin', 'sub_account']} requiredPermission="view_reports" requiredModule="analytics"><AdminAnalytics /></ProtectedRoute>} />
                        <Route path="/admin/revenue" element={<ProtectedRoute allowedRoles={['admin', 'sub_account']} requiredPermission="view_reports" requiredModule="analytics"><AdminRevenue /></ProtectedRoute>} />
                        <Route path="/admin/marketing" element={<ProtectedRoute allowedRoles={['admin']}><AdminMarketing /></ProtectedRoute>} />
                        <Route path="/admin/orders" element={<ProtectedRoute allowedRoles={['admin', 'sub_account']} requiredPermission="view_orders" requiredModule="invoicing"><AdminOrders /></ProtectedRoute>} />
                        <Route path="/admin/scheduled-orders" element={<ProtectedRoute allowedRoles={['admin', 'sub_account']} requiredPermission="view_orders" requiredModule="invoicing"><AdminScheduledOrders /></ProtectedRoute>} />
                        {/* Inventory Management */}
                        <Route path="/admin/inventory" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="stock"><AdminInventory /></ProtectedRoute>} />
                        <Route path="/admin/suppliers" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="stock"><AdminSuppliers /></ProtectedRoute>} />
                        <Route path="/admin/suppliers/:partyId/statement" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="stock"><PartyAccountStatementPage /></ProtectedRoute>} />
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
                        <Route path="/admin/expenses" element={<Navigate to="/admin/invoice-manager/expenses" replace />} />
                        <Route path="/admin/reports" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="analytics"><AdminReports /></ProtectedRoute>} />
                        <Route path="/admin/finance" element={<Navigate to="/admin/finance/accounting" replace />} />
                        <Route path="/admin/finance/clients" element={<Navigate to="/admin/invoice-manager/clients" replace />} />
                        <Route path="/admin/finance/products" element={<Navigate to="/admin/invoice-manager/products" replace />} />
                        <Route path="/admin/finance/invoices" element={<Navigate to="/admin/invoice-manager/invoices" replace />} />
                        <Route path="/admin/finance/quotations" element={<Navigate to="/admin/invoice-manager/quotations" replace />} />
                        <Route path="/admin/finance/estimates" element={<Navigate to="/admin/invoice-manager/quotations" replace />} />
                        <Route path="/admin/finance/receipts" element={<Navigate to="/admin/invoice-manager/receipts" replace />} />
                        <Route path="/admin/finance/recu" element={<Navigate to="/admin/invoice-manager/receipts" replace />} />
                        <Route path="/admin/finance/settings" element={<Navigate to="/admin/finance/tools" replace />} />
                        <Route path="/admin/finance/*" element={<ProtectedRoute allowedRoles={['admin']}><FinanceModuleShell /></ProtectedRoute>} />
                        <Route path="/admin/invoice-manager/*" element={<ProtectedRoute allowedRoles={['admin']}><InvoiceManagerModuleShell /></ProtectedRoute>} />
                        <Route path="/admin/pos" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="pos"><PosPairing /></ProtectedRoute>} />
                        <Route path="/admin/ai-builder" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="ai_builder"><AiBuilder /></ProtectedRoute>} />
                        <Route path="/admin/blog" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="blog_publisher"><BlogPublisher /></ProtectedRoute>} />
                        <Route path="/admin/whitelabel" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="whitelabel"><WhitelabelApp /></ProtectedRoute>} />
                        <Route path="/admin/projects" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="projects"><AdminProjects /></ProtectedRoute>} />
                        <Route path="/admin/ai/content-creator" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="content_creator"><ContentCreator /></ProtectedRoute>} />
                        <Route path="/admin/ai-agent" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="ai_agent"><AdminAiAgent /></ProtectedRoute>} />
                        <Route path="/admin/ai/market-strategy" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="market_strategy"><MarketStrategy /></ProtectedRoute>} />
                        <Route path="/admin/ai/proposal-writer" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="proposal_writer"><ProposalWriter /></ProtectedRoute>} />
                        <Route path="/admin/ai/seo-assistant" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="seo_assistant"><SeoAssistant /></ProtectedRoute>} />
                        <Route path="/admin/ai/business-insights" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="analytics_insights"><BusinessInsights /></ProtectedRoute>} />
                        <Route path="/admin/ai/campaign-writer" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="campaign_writer"><CampaignWriter /></ProtectedRoute>} />
                        <Route path="/admin/marketplace" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="dropship"><AdminMarketplaceSync /></ProtectedRoute>} />
                        <Route path="/admin/product-reviews" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="marketplace"><AdminProductReviews /></ProtectedRoute>} />
                        <Route path="/admin/order-notifications" element={<ProtectedRoute allowedRoles={['admin']}><AdminOrderNotifications /></ProtectedRoute>} />
                        <Route path="/admin/account-statement" element={<Navigate to="/admin/finance/account-statement" replace />} />
                        <Route path="/admin/cash-collection" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="payments"><AdminBankReconciliation /></ProtectedRoute>} />
                        <Route path="/admin/delivery-wallet" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="payments"><AdminDeliveryWallet /></ProtectedRoute>} />
                        <Route path="/admin/bank-reconciliation" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="payments"><AdminBankReconciliation /></ProtectedRoute>} />
                        <Route path="/admin/service-renewals" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="services"><AdminServiceRenewals /></ProtectedRoute>} />
                        <Route path="/admin/audit-logs" element={<ProtectedRoute allowedRoles={['admin']}><AdminAuditLogs /></ProtectedRoute>} />
                        <Route path="/admin/seo-analytics" element={<ProtectedRoute allowedRoles={['admin']}><AdminSEOAnalytics /></ProtectedRoute>} />
                        <Route path="/admin/seo-audit" element={<ProtectedRoute allowedRoles={['admin']}><AdminSEOAudit /></ProtectedRoute>} />
                        {/* Customer directory (orders/billing) */}
                        <Route path="/admin/customers" element={<ProtectedRoute allowedRoles={['admin', 'sub_account']} requiredPermission="view_customers"><AdminCustomers /></ProtectedRoute>} />
                        <Route path="/admin/customers/:partyId/statement" element={<ProtectedRoute allowedRoles={['admin', 'sub_account']} requiredPermission="view_customers"><PartyAccountStatementPage /></ProtectedRoute>} />
                        {/* Sales CRM add-on */}
                        <Route path="/admin/crm" element={<Navigate to="/admin/crm/dashboard" replace />} />
                        <Route path="/admin/crm/*" element={<ProtectedRoute allowedRoles={['admin']} requiredModule="crm"><CrmModuleShell /></ProtectedRoute>} />
                        </Route>
                        <Route path="/team/crm" element={<ProtectedRoute allowedRoles={['crm_rep']} requiredModule="crm"><CrmRepPortal /></ProtectedRoute>} />
                        {/* Standalone invoice SPA — escape hatch when client-side nav hits /invoice/* */}
                        <Route path="/invoice/*" element={<InvoiceSpaRedirect />} />
                        {/* Public marketing pages — must be BEFORE /:slug */}
                        <Route path="/features" element={<Features />} />
                        <Route path="/solutions" element={<SolutionsIndex />} />
                        <Route path="/solutions/:slug" element={<SolutionDetail />} />
                        <Route path="/wordpress/access" element={<WordPressAccess />} />
                        <Route path="/pricing" element={<Pricing />} />
                        <Route path="/use-cases" element={<UseCases />} />
                        <Route path="/about" element={<About />} />
                        <Route path="/careers" element={<Careers />} />
                        <Route path="/careers/apply/:track" element={<CareersApply />} />
                        <Route path="/blog" element={<Blog />} />
                        <Route path="/blog/:slug" element={<BlogPost />} />
                        {/* Legacy store paths → {slug}.grabio.space */}
                        <Route path="/store/:slug" element={<StoreSlugRedirect />} />
                        <Route path="/store/:slug/products" element={<StoreSlugRedirect />} />
                        <Route path="/store/:slug/category/:categorySlug" element={<StoreSlugRedirect />} />
                        <Route path="/store/:storeSlug/product/:productSlug" element={<StoreSlugRedirect />} />
                        <Route path="/:slug" element={<StoreSlugRedirect />} />
                        <Route path="/:slug/products" element={<StoreSlugRedirect />} />
                        <Route path="/:slug/category/:categorySlug" element={<StoreSlugRedirect />} />
                        <Route path="/:storeSlug/product/:productSlug" element={<StoreSlugRedirect />} />
                        <Route path="/privacy" element={<PrivacyPolicy />} />
                        {/* 404 catch-all route */}
                        <Route path="*" element={<NotFound />} />
                          </>
                        )}
                      </Routes>
                      </Suspense>
                      <AppFooter />
                      <SonnerToaster />
                      <ShadcnToaster />
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
