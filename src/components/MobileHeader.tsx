
import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, Menu, Home, Heart, ShoppingCart, Package, Store, PlusCircle, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useAuth } from '@/context/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface MobileHeaderProps {
  title?: string;
  showBackButton?: boolean;
  showHomeButton?: boolean;
}

const MobileHeader: React.FC<MobileHeaderProps> = ({
  title = 'Market Space',
  showBackButton = true,
  showHomeButton = false,
}) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  // Credits feature removed

  const goBack = () => {
    navigate('/admin');
  };

  const goHome = () => {
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b border-gray-100 md:hidden">
      <div className="container flex items-center justify-between h-14 px-4">
        <div className="flex items-center gap-3">
          {showBackButton && (
            <Button variant="ghost" size="icon" onClick={goBack} aria-label="Go back">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
          {showHomeButton && (
            <Button variant="ghost" size="icon" onClick={goHome} aria-label="Go to home">
              <Home className="h-5 w-5" />
            </Button>
          )}
          <h1 className="text-lg font-semibold truncate">{title}</h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Credits feature removed */}

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader className="pb-4">
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>

              {user ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 py-4 border-b">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.avatar} alt={user.name} />
                      <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                  </div>

                  <nav className="space-y-2">
                    <Link to="/" className="flex items-center gap-3 p-3 rounded-md hover:bg-gray-100 transition">
                      <Home className="h-5 w-5" />
                      <span>Home</span>
                    </Link>
                    
                    {(user.role === 'admin' || user.role === 'sub_account') ? (
                      <Link to="/admin/dashboard" className="flex items-center gap-3 p-3 rounded-md bg-market-primary text-white font-semibold hover:bg-market-primary/90 transition">
                        <Store className="h-5 w-5" />
                        <span>Manage Store</span>
                      </Link>
                    ) : user.role === 'user' ? (
                      <Link to="/upgrade" className="flex items-center gap-3 p-3 rounded-md hover:bg-gray-100 transition">
                        <PlusCircle className="h-5 w-5" />
                        <span>Become a Seller</span>
                      </Link>
                    ) : null}
                    
                    <Link to="/favorites" className="flex items-center gap-3 p-3 rounded-md hover:bg-gray-100 transition">
                      <Heart className="h-5 w-5" />
                      <span>Favorites</span>
                    </Link>
                    
                    <Link to="/cart" className="flex items-center gap-3 p-3 rounded-md hover:bg-gray-100 transition">
                      <ShoppingCart className="h-5 w-5" />
                      <span>Cart</span>
                    </Link>
                    
                    <Link to="/orders" className="flex items-center gap-3 p-3 rounded-md hover:bg-gray-100 transition">
                      <Package className="h-5 w-5" />
                      <span>Order Tracking</span>
                    </Link>
                    
                    <button 
                      onClick={logout}
                      className="flex items-center gap-3 p-3 rounded-md text-red-500 hover:bg-red-50 w-full text-left transition"
                    >
                      <LogOut className="h-5 w-5" />
                      <span>Log out</span>
                    </button>
                  </nav>
                </div>
              ) : (
                <div className="space-y-4 pt-4">
                  <nav className="space-y-2 mb-4">
                    <Link to="/" className="flex items-center gap-3 p-3 rounded-md hover:bg-gray-100 transition">
                      <Home className="h-5 w-5" />
                      <span>Home</span>
                    </Link>
                    
                    <Link to="/favorites" className="flex items-center gap-3 p-3 rounded-md hover:bg-gray-100 transition">
                      <Heart className="h-5 w-5" />
                      <span>Favorites</span>
                    </Link>
                    
                    <Link to="/cart" className="flex items-center gap-3 p-3 rounded-md hover:bg-gray-100 transition">
                      <ShoppingCart className="h-5 w-5" />
                      <span>Cart</span>
                    </Link>
                    
                    <Link to="/track-order" className="flex items-center gap-3 p-3 rounded-md hover:bg-gray-100 transition">
                      <Package className="h-5 w-5" />
                      <span>Track Order</span>
                    </Link>
                  </nav>
                  
                  <Link 
                    to="/login" 
                    className="flex items-center justify-center w-full p-2 bg-market-primary text-white rounded-md"
                  >
                    Sign In
                  </Link>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

export default MobileHeader;
