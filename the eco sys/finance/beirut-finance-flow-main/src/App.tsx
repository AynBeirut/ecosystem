import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AppProvider } from "@/context/AppContext";
import { AccountingProvider } from "@/context/AccountingContext";
import AuthGuard from "@/components/AuthGuard";
import ErrorBoundary from "@/components/ErrorBoundary";
import OfflineBanner from "@/components/OfflineBanner";
import SessionGuard from "@/components/SessionGuard";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AuthCallback from "./pages/AuthCallback";

// Lazy-load heavy pages
const InvoiceManager = lazy(() => import("./pages/InvoiceManager"));
const EstimateManager = lazy(() => import("./pages/EstimateManager"));
const ReceiptManager = lazy(() => import("./pages/ReceiptManager"));
const CompanyProfile = lazy(() => import("./pages/CompanyProfile"));
const Settings = lazy(() => import("./pages/Settings"));
const PremiumUpgrade = lazy(() => import("./pages/PremiumUpgrade"));
const SubUsers = lazy(() => import("./pages/SubUsers"));
const Reports = lazy(() => import("./pages/Reports"));
const ClientsManager = lazy(() => import("./pages/ClientsManager"));
const SuppliersManager = lazy(() => import("./pages/SuppliersManager"));
const ProductsManager = lazy(() => import("./pages/ProductsManager"));
const CompanyPortfolio = lazy(() => import("./pages/CompanyPortfolio"));
const PurchaseOrders = lazy(() => import("./pages/PurchaseOrders"));
const InstallPWA = lazy(() => import("./pages/InstallPWA"));
const Inventory = lazy(() => import("./pages/Inventory"));
const ExpenseManager = lazy(() => import("./pages/ExpenseManager"));
const StaffManager = lazy(() => import("./pages/StaffManager"));
const DeliveryManager = lazy(() => import("./pages/DeliveryManager"));
const ProjectsManager = lazy(() => import("./pages/ProjectsManager"));
const ProposalsManager = lazy(() => import("./pages/ProposalsManager"));
const TasksManager = lazy(() => import("./pages/TasksManager"));
const CurrencySettings = lazy(() => import("./pages/CurrencySettings"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const OrgMembers = lazy(() => import("./pages/OrgMembers"));
const PaymentMethods = lazy(() => import("./pages/PaymentMethods"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

const PageFallback = () => (
  <div className="min-h-[40vh] flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
);

const wrap = (node: React.ReactNode, scope?: string) => (
  <AuthGuard>
    <ErrorBoundary scope={scope}>
      <Suspense fallback={<PageFallback />}>{node}</Suspense>
    </ErrorBoundary>
  </AuthGuard>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ErrorBoundary scope="root">
        <AppProvider>
          <AccountingProvider>
            <SessionGuard />
            <OfflineBanner />
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/invoices" element={wrap(<InvoiceManager />, "invoices")} />
                <Route path="/estimates" element={wrap(<EstimateManager />)} />
                <Route path="/receipts" element={wrap(<ReceiptManager />)} />
                <Route path="/profile" element={wrap(<CompanyProfile />)} />
                <Route path="/settings" element={wrap(<Settings />)} />
                <Route path="/premium" element={wrap(<PremiumUpgrade />)} />
                <Route path="/reports" element={wrap(<Reports />)} />
                <Route path="/sub-users" element={wrap(<SubUsers />)} />
                <Route path="/clients" element={wrap(<ClientsManager />)} />
                <Route path="/suppliers" element={wrap(<SuppliersManager />)} />
                <Route path="/products" element={wrap(<ProductsManager />)} />
                <Route path="/inventory" element={wrap(<Inventory />)} />
                <Route path="/portfolio" element={wrap(<CompanyPortfolio />)} />
                <Route path="/purchase-orders" element={wrap(<PurchaseOrders />)} />
                <Route path="/expenses" element={wrap(<ExpenseManager />)} />
                <Route path="/staff" element={wrap(<StaffManager />)} />
                <Route path="/delivery" element={wrap(<DeliveryManager />)} />
                <Route path="/projects" element={wrap(<ProjectsManager />)} />
                <Route path="/proposals" element={wrap(<ProposalsManager />)} />
                <Route path="/tasks" element={wrap(<TasksManager />)} />
                <Route path="/currency" element={wrap(<CurrencySettings />)} />
                <Route path="/admin" element={wrap(<AdminDashboard />, "admin")} />
                <Route path="/org/members" element={wrap(<OrgMembers />, "admin")} />
                <Route path="/payment-methods" element={wrap(<PaymentMethods />, "admin")} />
                <Route path="/payment-success" element={wrap(<PaymentSuccess />)} />
                <Route path="/install" element={<Suspense fallback={<PageFallback />}><InstallPWA /></Suspense>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </AccountingProvider>
        </AppProvider>
      </ErrorBoundary>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
