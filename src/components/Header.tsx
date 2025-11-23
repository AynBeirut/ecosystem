
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

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const { items } = useCart();
  const { favorites } = useFavorites();
  // Credits feature removed
  const navigate = useNavigate();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <header className="bg-market-primary shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <span className="text-xl font-bold text-white">Home</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {user && user.role === 'admin' && (
              <Link to="/admin" className="text-white hover:text-market-primary/80">
                Dashboard
              </Link>
            )}
            {user && user.role === 'user' && (
              <Link to="/upgrade" className="text-white hover:text-market-primary/80">
                Become a Seller
              </Link>
            )}
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            {user ? (
              <>
                {/* Credits feature removed */}
                
                {/* Favorites Link */}
                <Link 
                  to="/favorites"
                  className="p-2 rounded-full text-gray-600 hover:bg-gray-100 relative"
                  aria-label="Favorites"
                >
                  <Heart size={20} />
                  {favorites.length > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px]">
                      {favorites.length}
                    </Badge>
                  )}
                </Link>
                

                {/* Order Tracking Link */}
                <Link 
                  to="/orders"
                  className="p-2 rounded-full text-gray-600 hover:bg-gray-100 relative"
                  aria-label="Order Tracking"
                >
                  <Package size={20} />
                </Link>

                {/* Cart Link */}
                <Link 
                  to="/cart"
                  className="p-2 rounded-full text-gray-600 hover:bg-gray-100 relative"
                  aria-label="Cart"
                >
                  <ShoppingCart size={20} />
                  {items.length > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px]">
                      {items.length}
                    </Badge>
                  )}
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
                    
                    {user.role === 'admin' ? (
                      <DropdownMenuItem asChild>
                        <Link to="/admin" className="flex cursor-pointer items-center">
                          <Store className="mr-2 h-4 w-4" />
                          <span>Manage Store</span>
                        </Link>
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem asChild>
                        <Link to="/upgrade" className="flex cursor-pointer items-center">
                          <PlusCircle className="mr-2 h-4 w-4" />
                          <span>Become a Seller</span>
                        </Link>
                      </DropdownMenuItem>
                    )}
                    
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
                <Button asChild variant="outline" size="sm">
                  <Link to="/login">Sign in</Link>
                </Button>
              </>
            )}

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 rounded-full text-gray-600 hover:bg-gray-100 focus:outline-none"
              onClick={toggleMenu}
              aria-label="Open menu"
            >
              {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden mt-3 py-3 border-t border-gray-100">
            <nav className="flex flex-col space-y-3">
              <Link
                to="/"
                className="px-2 py-1 text-gray-600 hover:text-market-primary"
                onClick={toggleMenu}
              >
                Home
              </Link>
              
              {user && user.role === 'admin' && (
                <Link
                  to="/admin"
                  className="px-2 py-1 text-gray-600 hover:text-market-primary"
                  onClick={toggleMenu}
                >
                  Dashboard
                </Link>
              )}
              
              {user && user.role === 'user' && (
                <Link
                  to="/upgrade"
                  className="px-2 py-1 text-market-primary font-medium"
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
