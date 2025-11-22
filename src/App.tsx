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
import NotFound from "./pages/NotFound";
import AuthCallback from "./routes/auth/auth-callback";
import Cart from "./pages/Cart";
import Favorites from "./pages/Favorites";
import UpgradeToAdmin from "./pages/UpgradeToAdmin";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminProfile from "./pages/admin/AdminProfile";
import AdminPayments from "./pages/admin/AdminPayments";
import AdminDelivery from "./pages/admin/AdminDelivery";
import AdminTemplates from "./pages/admin/AdminTemplates";
import AdminAnnouncements from "./pages/admin/AdminAnnouncements";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminOrders from "./pages/admin/AdminOrders";
import OrderTracking from "./pages/OrderTracking";
import DebugConsole from './components/DebugConsole';
import OrderConfirmation from "./pages/OrderConfirmation";


      function App() {
        return (
          <ThemeProvider>
            <AuthProvider>
              <CartProvider>
                {/* CreditsProvider removed */}
                  <FavoritesProvider>
                    <BrowserRouter>
                      <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/signup" element={<Signup />} />
                        <Route path="/auth/callback" element={<AuthCallback />} />
                        {/* Main app routes */}
                        <Route path="/" element={<Marketplace />} />
                        <Route path="/search" element={<Marketplace />} />
                        <Route path="/store/:id" element={<StoreDetail />} />
                        {/* Protected routes */}
                        <Route path="/cart" element={<ProtectedRoute><Cart /></ProtectedRoute>} />
                        <Route path="/favorites" element={<ProtectedRoute><Favorites /></ProtectedRoute>} />
                        <Route path="/orders" element={<ProtectedRoute><OrderTracking /></ProtectedRoute>} />
                        <Route path="/orders/confirmation" element={<ProtectedRoute><OrderConfirmation /></ProtectedRoute>} />
                        <Route path="/upgrade" element={<ProtectedRoute><UpgradeToAdmin /></ProtectedRoute>} />
                        {/* Admin Routes */}
                        <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
                        <Route path="/admin/products" element={<ProtectedRoute allowedRoles={['admin']}><AdminProducts /></ProtectedRoute>} />
                        <Route path="/admin/profile" element={<ProtectedRoute allowedRoles={['admin']}><AdminProfile /></ProtectedRoute>} />
                        <Route path="/admin/payments" element={<ProtectedRoute allowedRoles={['admin']}><AdminPayments /></ProtectedRoute>} />
                        <Route path="/admin/delivery" element={<ProtectedRoute allowedRoles={['admin']}><AdminDelivery /></ProtectedRoute>} />
                        <Route path="/admin/templates" element={<ProtectedRoute allowedRoles={['admin']}><AdminTemplates /></ProtectedRoute>} />
                        <Route path="/admin/announcements" element={<ProtectedRoute allowedRoles={['admin']}><AdminAnnouncements /></ProtectedRoute>} />
                        <Route path="/admin/analytics" element={<ProtectedRoute allowedRoles={['admin']}><AdminAnalytics /></ProtectedRoute>} />
                        <Route path="/admin/orders" element={<ProtectedRoute allowedRoles={['admin']}><AdminOrders /></ProtectedRoute>} />
                        {/* 404 catch-all route */}
                        <Route path="*" element={<NotFound />} />
                      </Routes>
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
