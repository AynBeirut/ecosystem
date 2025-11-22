
import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from '@/components/ui/sonner';
import { Product } from '@/types/product';

type CartItem = {
  product: Product;
  quantity: number;
};

type CartContextType = {
  items: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
  appliedCredits: number;
  applyCredits: (amount: number) => void;
  removeCredits: () => void;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [appliedCredits, setAppliedCredits] = useState(0);
  
  // Load cart from localStorage on first render
  useEffect(() => {
    const savedCart = localStorage.getItem('market-flow-cart');
    const savedCredits = localStorage.getItem('market-flow-credits');
    
    if (savedCart) {
      setItems(JSON.parse(savedCart));
    }
    
    if (savedCredits) {
      setAppliedCredits(Number(savedCredits));
    }
  }, []);
  
  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('market-flow-cart', JSON.stringify(items));
  }, [items]);
  
  // Save applied credits to localStorage
  useEffect(() => {
    localStorage.setItem('market-flow-credits', String(appliedCredits));
  }, [appliedCredits]);
  
  const addToCart = (product: Product, quantity = 1) => {
    setItems(prevItems => {
      const existingItem = prevItems.find(item => item.product.id === product.id);
      
      if (existingItem) {
        return prevItems.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + quantity } 
            : item
        );
      } else {
        return [...prevItems, { product, quantity }];
      }
    });
    
    toast.success(`Added ${product.name} to cart`);
  };
  
  const removeFromCart = (productId: string) => {
    setItems(prevItems => prevItems.filter(item => item.product.id !== productId));
    toast.success('Item removed from cart');
  };
  
  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    
    setItems(prevItems => 
      prevItems.map(item => 
        item.product.id === productId 
          ? { ...item, quantity } 
          : item
      )
    );
  };
  
  const clearCart = () => {
    setItems([]);
    setAppliedCredits(0);
    toast.success('Cart cleared');
  };
  
  const applyCredits = (amount: number) => {
    setAppliedCredits(amount);
    toast.success(`${amount} credits applied to your cart`);
  };
  
  const removeCredits = () => {
    setAppliedCredits(0);
    toast.success('Credits removed from cart');
  };
  
  // Calculate derived values
  const totalItems = items.reduce((total, item) => total + item.quantity, 0);
  
  const subtotal = items.reduce(
    (total, item) => total + item.product.price * item.quantity, 
    0
  );
  
  return (
    <CartContext.Provider 
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalItems,
        subtotal,
        appliedCredits,
        applyCredits,
        removeCredits
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
