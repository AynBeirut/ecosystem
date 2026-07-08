
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  Bell, 
  FileText, 
  Settings, 
  User, 
  CreditCard, 
  LogOut, 
  Menu, 
  X, 
  PlusCircle,
  Moon, 
  Sun,
  FileEdit,
  Users,
  Package,
  Image,
  Home,
  BoxIcon,
  BarChart3,
  Receipt,
  Truck,
  Wallet,
  Building2,
  FolderOpen,
  Sparkles,
  CheckSquare,
  ArrowRightLeft,
  Activity
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAppContext } from "@/context/AppContext";
import OrgSwitcher from "@/components/OrgSwitcher";
import BrandMark from "@/components/BrandMark";
import { BRAND } from "@/lib/branding";
import { usePlayStoreV1Nav } from "@/hooks/usePlayStoreV1Nav";
import { playStoreWebUrl, isFinanceInAppShell } from "@/lib/playStoreNavScope";

interface AppLayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
}

const AppLayout = ({ children, onLogout }: AppLayoutProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, isDarkMode, currentUserRole, isGuestDemo, exitGuestDemo } = useAppContext();
  const canManageOrg = currentUserRole === "owner" || currentUserRole === "admin";
  const location = useLocation();
  const { active: playStoreV1Nav } = usePlayStoreV1Nav();
  const inAppShell = playStoreV1Nav || isFinanceInAppShell();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed top-0 bottom-0 left-0 w-64 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 z-50 transition-transform duration-300 ease-in-out flex flex-col",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="p-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <BrandMark size="sm" linked />
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          {user && (
            <div className="mt-4 p-3 bg-teal-50 dark:bg-teal-950/30 rounded-lg">
              <p className="text-sm font-medium text-teal-900 dark:text-teal-100">{user.company.name}</p>
              <p className="text-xs text-teal-700/80 dark:text-teal-300/80 mt-1 capitalize">{user.plan} Plan{user.isDemoAccount && " (Demo)"}</p>
            </div>
          )}
        </div>
        
        {/* Scrollable menu area */}
        <div className="flex-grow overflow-y-auto py-4 px-4 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700">
          <div className="space-y-1">
            {playStoreV1Nav ? (
              <Button 
                variant="ghost" 
                className={cn("w-full justify-start", 
                  location.pathname === "/invoices" && "bg-gray-100 dark:bg-gray-800")}
                asChild
              >
                <Link to="/invoices">
                  <FileText className="mr-2 h-4 w-4" /> Invoices
                </Link>
              </Button>
            ) : (
              <>
                <Button 
                  variant="ghost" 
                  className={cn("w-full justify-start", 
                    location.pathname === "/" && "bg-gray-100 dark:bg-gray-800")}
                  asChild
                >
                  <Link to="/">
                    <Home className="mr-2 h-4 w-4" /> Dashboard
                  </Link>
                </Button>
                <Button 
                  variant="ghost" 
                  className={cn("w-full justify-start", 
                    location.pathname === "/invoices" && "bg-gray-100 dark:bg-gray-800")}
                  asChild
                >
                  <Link to="/invoices">
                    <FileText className="mr-2 h-4 w-4" /> Invoices
                  </Link>
                </Button>
              </>
            )}

            {!playStoreV1Nav && (
            <Button 
              variant="ghost" 
              className={cn("w-full justify-start", 
                location.pathname === "/projects" && "bg-gray-100 dark:bg-gray-800")}
              asChild
            >
              <Link to="/projects">
                <FolderOpen className="mr-2 h-4 w-4" /> Projects
              </Link>
            </Button>
            )}

            {!playStoreV1Nav && (
            <Button 
              variant="ghost" 
              className={cn("w-full justify-start", 
                location.pathname === "/proposals" && "bg-gray-100 dark:bg-gray-800")}
              asChild
            >
              <Link to="/proposals">
                <Sparkles className="mr-2 h-4 w-4" /> Proposals (AI)
              </Link>
            </Button>
            )}

            {!playStoreV1Nav && (
            <Button 
              variant="ghost" 
              className={cn("w-full justify-start", 
                location.pathname === "/tasks" && "bg-gray-100 dark:bg-gray-800")}
              asChild
            >
              <Link to="/tasks">
                <CheckSquare className="mr-2 h-4 w-4" /> Tasks & Time
              </Link>
            </Button>
            )}

            <Button 
              variant="ghost" 
              className={cn("w-full justify-start",
                location.pathname === "/estimates" && "bg-gray-100 dark:bg-gray-800")}
              asChild
            >
              <Link to="/estimates">
                <FileEdit className="mr-2 h-4 w-4" /> Estimates
              </Link>
            </Button>

            <Button 
              variant="ghost" 
              className={cn("w-full justify-start",
                location.pathname === "/receipts" && "bg-gray-100 dark:bg-gray-800")}
              asChild
            >
              <Link to="/receipts">
                <CreditCard className="mr-2 h-4 w-4" /> Receipts
              </Link>
            </Button>

            <Button 
              variant="ghost" 
              className={cn("w-full justify-start",
                location.pathname === "/clients" && "bg-gray-100 dark:bg-gray-800")}
              asChild
            >
              <Link to="/clients">
                <Users className="mr-2 h-4 w-4" /> Clients
              </Link>
            </Button>

            <Button 
              variant="ghost" 
              className={cn("w-full justify-start",
                location.pathname === "/products" && "bg-gray-100 dark:bg-gray-800")}
              asChild
            >
              <Link to="/products">
                <Package className="mr-2 h-4 w-4" /> Products
              </Link>
            </Button>

            <Button 
              variant="ghost" 
              className={cn("w-full justify-start",
                location.pathname === "/reports" && "bg-gray-100 dark:bg-gray-800")}
              asChild
            >
              <Link to="/reports">
                <BarChart3 className="mr-2 h-4 w-4" /> Reports
              </Link>
            </Button>

            {!playStoreV1Nav && (
            <>
            <Button 
              variant="ghost" 
              className={cn("w-full justify-start",
                location.pathname === "/suppliers" && "bg-gray-100 dark:bg-gray-800")}
              asChild
            >
              <Link to="/suppliers">
                <Building2 className="mr-2 h-4 w-4" /> Suppliers
              </Link>
            </Button>

            <Button 
              variant="ghost" 
              className={cn("w-full justify-start",
                location.pathname === "/inventory" && "bg-gray-100 dark:bg-gray-800")}
              asChild
            >
              <Link to="/inventory">
                <BoxIcon className="mr-2 h-4 w-4" /> Inventory
              </Link>
            </Button>

            <Button 
              variant="ghost" 
              className={cn("w-full justify-start",
                location.pathname === "/expenses" && "bg-gray-100 dark:bg-gray-800")}
              asChild
            >
              <Link to="/expenses">
                <Receipt className="mr-2 h-4 w-4" /> Expenses
              </Link>
            </Button>

            <Button 
              variant="ghost" 
              className={cn("w-full justify-start",
                location.pathname === "/staff" && "bg-gray-100 dark:bg-gray-800")}
              asChild
            >
              <Link to="/staff">
                <Users className="mr-2 h-4 w-4" /> Staff & Payroll
              </Link>
            </Button>

            <Button 
              variant="ghost" 
              className={cn("w-full justify-start",
                location.pathname === "/delivery" && "bg-gray-100 dark:bg-gray-800")}
              asChild
            >
              <Link to="/delivery">
                <Truck className="mr-2 h-4 w-4" /> Delivery
              </Link>
            </Button>

            <Button 
              variant="ghost" 
              className={cn("w-full justify-start",
                location.pathname === "/purchase-orders" && "bg-gray-100 dark:bg-gray-800")}
              asChild
            >
              <Link to="/purchase-orders">
                <FileText className="mr-2 h-4 w-4" /> Purchase Orders
              </Link>
            </Button>

            <Button 
              variant="ghost" 
              className={cn("w-full justify-start",
                location.pathname === "/portfolio" && "bg-gray-100 dark:bg-gray-800")}
              asChild
            >
              <Link to="/portfolio">
                <Image className="mr-2 h-4 w-4" /> Portfolio
              </Link>
            </Button>
            </>
            )}

            <Button 
              variant="ghost" 
              className={cn("w-full justify-start",
                location.pathname === "/settings" && "bg-gray-100 dark:bg-gray-800")}
              asChild
            >
              <Link to="/settings">
                <Settings className="mr-2 h-4 w-4" /> Settings
              </Link>
            </Button>

            {!inAppShell && (
            <Button 
              variant="ghost" 
              className="w-full justify-start"
              asChild
            >
              <a href={`${BRAND.ecosystemUrl}/admin/profile`} target="_blank" rel="noopener noreferrer">
                <User className="mr-2 h-4 w-4" /> Store Profile (Grabio)
              </a>
            </Button>
            )}

            {!playStoreV1Nav && user?.plan === "pro" && (
              <Button 
                variant="ghost" 
                className={cn("w-full justify-start",
                  location.pathname === "/sub-users" && "bg-gray-100 dark:bg-gray-800")}
                asChild
              >
                <Link to="/sub-users">
                  <User className="mr-2 h-4 w-4" /> Sub Users
                </Link>
              </Button>
            )}

            {!playStoreV1Nav && (
            <Button 
              variant="ghost" 
              className={cn("w-full justify-start",
                location.pathname === "/currency" && "bg-gray-100 dark:bg-gray-800")}
              asChild
            >
              <Link to="/currency">
                <ArrowRightLeft className="mr-2 h-4 w-4" /> Currency
              </Link>
            </Button>
            )}

            {!playStoreV1Nav && canManageOrg && (
              <Button 
                variant="ghost" 
                className={cn("w-full justify-start",
                  location.pathname === "/admin" && "bg-gray-100 dark:bg-gray-800")}
                asChild
              >
                <Link to="/admin">
                  <Activity className="mr-2 h-4 w-4" /> Admin & PSA
                </Link>
              </Button>
            )}

            {!playStoreV1Nav && canManageOrg && (
              <Button 
                variant="ghost" 
                className={cn("w-full justify-start",
                  location.pathname === "/org/members" && "bg-gray-100 dark:bg-gray-800")}
                asChild
              >
                <Link to="/org/members">
                  <Users className="mr-2 h-4 w-4" /> Members
                </Link>
              </Button>
            )}

            {!playStoreV1Nav && canManageOrg && (
              <Button 
                variant="ghost" 
                className={cn("w-full justify-start",
                  location.pathname === "/payment-methods" && "bg-gray-100 dark:bg-gray-800")}
                asChild
              >
                <Link to="/payment-methods">
                  <CreditCard className="mr-2 h-4 w-4" /> Payment Methods
                </Link>
              </Button>
            )}

            {playStoreV1Nav && !inAppShell && (
              <div className="mt-4 rounded-lg border border-teal-200/80 bg-teal-50/80 dark:bg-teal-950/20 p-3">
                <p className="text-xs font-medium text-teal-900 dark:text-teal-100">More on desktop</p>
                <p className="text-xs text-teal-800/80 dark:text-teal-300/80 mt-1">
                  Inventory, staff, currency &amp; payment setup — use grabio.space on a computer.
                </p>
                <a
                  href={playStoreWebUrl()}
                  className="text-xs font-medium text-teal-700 dark:text-teal-300 underline mt-2 inline-block"
                >
                  grabio.space/invoice
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex-shrink-0">
          {!playStoreV1Nav && (
            user?.plan === "pro" ? (
              <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Pro Account</p>
                <p className="text-xs text-amber-700/70 dark:text-amber-400/70 mt-1">Unlimited operations</p>
              </div>
            ) : (
              <Link to="/premium">
                <Button className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700">
                  Upgrade to Pro
                </Button>
              </Link>
            )
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Top Nav */}
        <header className="bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
          <div className="px-4 py-3 flex items-center justify-between">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <OrgSwitcher />
            {user && (
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                  {user.company.logo ? (
                    <img 
                      src={user.company.logo} 
                      alt={user.company.name} 
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    user.company.name.substring(0, 2).toUpperCase()
                  )}
                </div>
                <span className="text-sm font-medium hidden sm:inline">{user.company.name}</span>
                <span className="text-sm font-medium ml-2 px-2 py-1 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 rounded-full">
                  {isGuestDemo ? "Demo" : user.plan === "pro" ? "Pro" : "Free"}
                </span>
              </div>
            )}
            </div>
          </div>
        </header>

        {isGuestDemo && (
          <div className="bg-teal-50 dark:bg-teal-950/40 border-b border-teal-200 dark:border-teal-800 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-sm text-teal-900 dark:text-teal-100">
              <span className="font-semibold">Demo mode</span> — create one client, product, invoice, estimate, receipt, and purchase. Data stays on this device only.
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" variant="outline" className="border-teal-300" asChild>
                <Link to="/" onClick={() => exitGuestDemo()}>Sign up free</Link>
              </Button>
              <Button size="sm" variant="ghost" onClick={onLogout}>
                Exit demo
              </Button>
            </div>
          </div>
        )}

        {/* Page Content */}
        <main className="p-3 sm:p-6">
          {children}
        </main>
        
        {/* Footer */}
        <footer className="border-t border-gray-200 dark:border-gray-800 py-3 px-6">
          <div className="text-center text-xs text-gray-500 dark:text-gray-400">
            Made in Lebanon 🇱🇧
          </div>
        </footer>
      </div>
    </div>
  );
};

export default AppLayout;
