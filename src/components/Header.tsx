
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Menu, X, ShoppingCart, Heart, User, CreditCard, 
  LogOut, Settings, Store, PlusCircle, Wallet, Package
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/useAuth';
import { useCart } from '@/context/CartContext';
import { useFavorites } from '@/context/FavoritesContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

// Helper function to determine if a color is light or dark
const isColorLight = (color: string): boolean => {
  let r = 0, g = 0, b = 0;
  
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    r = parseInt(hex.substr(0, 2), 16);
    g = parseInt(hex.substr(2, 2), 16);
    b = parseInt(hex.substr(4, 2), 16);
  } else if (color.startsWith('rgb')) {
    const rgb = color.match(/\d+/g);
    if (rgb) {
      r = parseInt(rgb[0]);
      g = parseInt(rgb[1]);
      b = parseInt(rgb[2]);
    }
  }
  
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
};

interface HeaderProps {
  storeName?: string;
  storeLogo?: string;
  storeSlug?: string;
  logoPosition?: 'left' | 'center' | 'right';
  primaryColor?: string;
  subscriptionTier?: 'trial' | 'starter' | 'pro' | 'business' | 'premium';
  hasCustomDomain?: boolean;
  hasImportedDesign?: boolean;
}

const Header: React.FC<HeaderProps> = ({ 
  storeName, 
  storeLogo, 
  storeSlug, 
  logoPosition = 'left',
  primaryColor,
  subscriptionTier,
  hasCustomDomain = false,
  hasImportedDesign = false
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const { items } = useCart();
  const { favorites } = useFavorites();
  // Credits feature removed
  const navigate = useNavigate();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  // White-label conditions: Pro/Business/Enterprise OR Custom Domain OR Imported Design
  const isPaidTier = ['pro', 'business', 'premium'].includes(subscriptionTier || '');
  const useWhiteLabel = isPaidTier || hasCustomDomain || hasImportedDesign;
  
  // Use store color or default Grabio green
  const headerBgColor = useWhiteLabel && primaryColor 
    ? primaryColor 
    : 'rgb(56, 178, 172)'; // Grabio brand color #38B2AC
  
  // Determine text color based on background
  const isLightBg = primaryColor ? isColorLight(primaryColor) : false;
  const textColor = isLightBg ? 'text-gray-900' : 'text-white';
  const hoverColor = isLightBg ? 'hover:text-gray-700' : 'hover:text-white/80';
  const iconBg = isLightBg ? 'text-gray-600 hover:bg-gray-100' : 'text-white hover:bg-white/10';
  const logoContainerClass = logoPosition === 'center'
    ? 'flex-col items-center text-center'
    : logoPosition === 'right'
      ? 'flex-row-reverse'
      : 'flex-row';

  return (
    <header className="shadow-sm sticky top-0 z-50" style={{ backgroundColor: headerBgColor }}>
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to={useWhiteLabel && storeSlug ? `/${storeSlug}` : '/'} className={`flex items-center gap-2 ${logoContainerClass}`}>
            {useWhiteLabel && storeLogo && (
              <img src={storeLogo} alt={storeName} className="h-8 w-8 object-cover rounded" />
            )}
            <span className={`text-xl font-bold ${textColor}`}>
              {useWhiteLabel && storeName ? storeName : 'Home'}
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {user && (user.role === 'admin' || user.role === 'sub_account') && !useWhiteLabel && (
              <Link to={user.role === 'admin' ? '/admin/dashboard' : '/team/dashboard'} className={`${textColor} ${hoverColor}`}>
                Dashboard
              </Link>
            )}
            {user && user.role === 'user' && !useWhiteLabel && (
              <Link to="/upgrade" className={`${textColor} ${hoverColor}`}>
                Become a Seller
              </Link>
            )}
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            {/* Favorites Link - Available to everyone (uses localStorage) */}
            <Link 
              to="/favorites"
              className={`p-2 rounded-full ${iconBg} relative`}
              aria-label="Favorites"
            >
              <Heart size={20} />
              {favorites.length > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px]">
                  {favorites.length}
                </Badge>
              )}
            </Link>

            {/* Cart Link - Available to everyone (uses localStorage) */}
            <Link 
              to="/cart"
              className={`p-2 rounded-full ${iconBg} relative`}
              aria-label="Cart"
            >
              <ShoppingCart size={20} />
              {items.length > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px]">
                  {items.length}
                </Badge>
              )}
            </Link>
            
            {user ? (
              <>
                {/* Order Tracking Link - Only for logged-in users */}
                <Link 
                  to="/orders"
                  className={`p-2 rounded-full ${iconBg} relative`}
                  aria-label="Order Tracking"
                >
                  <Package size={20} />
                </Link>
                
                {/* User Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="focus:outline-none">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatar} alt={user.name} />
                        <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user.name}</p>
                        <p className="text-xs leading-none text-gray-500">{user.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    
                    {/* Credits feature removed */}
                    
                    {(user.role === 'admin' || user.role === 'sub_account') ? (
                      <DropdownMenuItem asChild>
                        <Link to={user.role === 'admin' ? '/admin/dashboard' : '/team/dashboard'} className="flex cursor-pointer items-center">
                          <Store className="mr-2 h-4 w-4" />
                          <span>Manage Store</span>
                        </Link>
                      </DropdownMenuItem>
                    ) : user.role === 'user' ? (
                      <DropdownMenuItem asChild>
                        <Link to="/upgrade" className="flex cursor-pointer items-center">
                          <PlusCircle className="mr-2 h-4 w-4" />
                          <span>Become a Seller</span>
                        </Link>
                      </DropdownMenuItem>
                    ) : null}
                    
                    <DropdownMenuItem asChild>
                      <Link to="/profile" className="flex cursor-pointer items-center">
                        <User className="mr-2 h-4 w-4" />
                        <span>My Profile</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/favorites" className="flex cursor-pointer items-center">
                        <Heart className="mr-2 h-4 w-4" />
                        <span>Favorites</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/orders" className="flex cursor-pointer items-center">
                        <Package className="mr-2 h-4 w-4" />
                        <span>Order Tracking</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/cart" className="flex cursor-pointer items-center">
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        <span>Cart</span>
                      </Link>
                    </DropdownMenuItem>
                    {/* Credits feature removed */}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => logout()} className="text-red-500 focus:text-red-500 hover:text-red-500 font-normal">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Log out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                {/* Guest Track Order Button */}
                <Button asChild variant="ghost" size="sm">
                  <Link to="/track-order">Track Order</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/login">Sign in</Link>
                </Button>
              </>
            )}

            {/* Mobile Menu Button */}
            <button
              className={`md:hidden p-2 rounded-full ${iconBg} focus:outline-none`}
              onClick={toggleMenu}
              aria-label="Open menu"
            >
              {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className={`md:hidden mt-3 py-3 border-t ${isLightBg ? 'border-gray-300' : 'border-white/20'}`}>
            <nav className="flex flex-col space-y-3">
              <Link
                to={useWhiteLabel && storeSlug ? `/${storeSlug}` : '/'}
                className={`px-2 py-1 ${textColor} ${hoverColor}`}
                onClick={toggleMenu}
              >
                {useWhiteLabel && storeName ? storeName : 'Home'}
              </Link>
              
              {user && (user.role === 'admin' || user.role === 'sub_account') && (
                <Link
                  to={user.role === 'admin' ? '/admin/dashboard' : '/team/dashboard'}
                  className={`px-2 py-1 ${textColor} ${hoverColor}`}
                  onClick={toggleMenu}
                >
                  Dashboard
                </Link>
              )}
              
              {user && user.role === 'user' && (
                <Link
                  to="/upgrade"
                  className={`px-2 py-1 ${textColor} ${hoverColor}`}
                  onClick={toggleMenu}
                >
                  Become a Seller
                </Link>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
