
import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from '@/components/ui/sonner';
import { Product } from '@/types/product';

type FavoritesContextType = {
  favorites: Product[];
  addToFavorites: (product: Product) => void;
  removeFromFavorites: (productId: string) => void;
  isFavorite: (productId: string) => boolean;
};

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [favorites, setFavorites] = useState<Product[]>([]);
  
  // Load favorites from localStorage on first render
  useEffect(() => {
    const savedFavorites = localStorage.getItem('market-flow-favorites');
    if (savedFavorites) {
      setFavorites(JSON.parse(savedFavorites));
    }
  }, []);
  
  // Save favorites to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('market-flow-favorites', JSON.stringify(favorites));
  }, [favorites]);
  
  const addToFavorites = (product: Product) => {
    if (favorites.some(p => p.id === product.id)) {
      // Already a favorite
      return;
    }
    
    setFavorites(prev => [...prev, product]);
    toast.success(`Added ${product.name} to favorites`);
  };
  
  const removeFromFavorites = (productId: string) => {
    setFavorites(prev => prev.filter(product => product.id !== productId));
    toast.success('Removed from favorites');
  };
  
  const isFavorite = (productId: string) => {
    return favorites.some(product => product.id === productId);
  };
  
  return (
    <FavoritesContext.Provider 
      value={{
        favorites,
        addToFavorites,
        removeFromFavorites,
        isFavorite
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
};

export const useFavorites = () => {
  const context = useContext(FavoritesContext);
  if (context === undefined) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
};
