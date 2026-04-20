import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from './AuthContext';

interface FavoriteStore {
  storeId: string;
  name: string;
  logoUrl?: string;
  description?: string;
  addedAt: any;
}

interface FavoriteProduct {
  productId: string;
  storeId: string;
  storeName: string;
  name: string;
  price: number;
  currency?: string;
  imageUrl?: string;
  unit?: string;
  addedAt: any;
}

interface FavoritesContextType {
  favoriteStores: FavoriteStore[];
  favoriteProducts: FavoriteProduct[];
  isStoreFavorited: (storeId: string) => boolean;
  isProductFavorited: (productId: string) => boolean;
  toggleStoreFavorite: (store: { id: string; name: string; logoUrl?: string; description?: string }) => Promise<void>;
  toggleProductFavorite: (product: { id: string; storeId: string; storeName: string; name: string; price: number; currency?: string; imageUrl?: string; unit?: string }) => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextType>({
  favoriteStores: [],
  favoriteProducts: [],
  isStoreFavorited: () => false,
  isProductFavorited: () => false,
  toggleStoreFavorite: async () => {},
  toggleProductFavorite: async () => {},
});

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [favoriteStores, setFavoriteStores] = useState<FavoriteStore[]>([]);
  const [favoriteProducts, setFavoriteProducts] = useState<FavoriteProduct[]>([]);

  useEffect(() => {
    if (!user) {
      setFavoriteStores([]);
      setFavoriteProducts([]);
      return;
    }

    const unsubStores = firestore()
      .collection('users')
      .doc(user.uid)
      .collection('favorites')
      .orderBy('addedAt', 'desc')
      .onSnapshot((snap) => {
        setFavoriteStores(snap.docs.map((d) => d.data() as FavoriteStore));
      });

    const unsubProducts = firestore()
      .collection('users')
      .doc(user.uid)
      .collection('favoriteProducts')
      .orderBy('addedAt', 'desc')
      .onSnapshot((snap) => {
        setFavoriteProducts(snap.docs.map((d) => d.data() as FavoriteProduct));
      });

    return () => {
      unsubStores();
      unsubProducts();
    };
  }, [user]);

  const isStoreFavorited = useCallback(
    (storeId: string) => favoriteStores.some((f) => f.storeId === storeId),
    [favoriteStores],
  );

  const isProductFavorited = useCallback(
    (productId: string) => favoriteProducts.some((f) => f.productId === productId),
    [favoriteProducts],
  );

  const toggleStoreFavorite = useCallback(
    async (store: { id: string; name: string; logoUrl?: string; description?: string }) => {
      if (!user) return;
      const ref = firestore()
        .collection('users')
        .doc(user.uid)
        .collection('favorites')
        .doc(store.id);

      if (isStoreFavorited(store.id)) {
        await ref.delete();
      } else {
        await ref.set({
          storeId: store.id,
          name: store.name,
          logoUrl: store.logoUrl ?? null,
          description: store.description ?? null,
          addedAt: firestore.FieldValue.serverTimestamp(),
        });
      }
    },
    [user, isStoreFavorited],
  );

  const toggleProductFavorite = useCallback(
    async (product: { id: string; storeId: string; storeName: string; name: string; price: number; currency?: string; imageUrl?: string; unit?: string }) => {
      if (!user) return;
      const ref = firestore()
        .collection('users')
        .doc(user.uid)
        .collection('favoriteProducts')
        .doc(product.id);

      if (isProductFavorited(product.id)) {
        await ref.delete();
      } else {
        await ref.set({
          productId: product.id,
          storeId: product.storeId,
          storeName: product.storeName,
          name: product.name,
          price: product.price,
          currency: product.currency ?? null,
          imageUrl: product.imageUrl ?? null,
          unit: product.unit ?? null,
          addedAt: firestore.FieldValue.serverTimestamp(),
        });
      }
    },
    [user, isProductFavorited],
  );

  return (
    <FavoritesContext.Provider
      value={{ favoriteStores, favoriteProducts, isStoreFavorited, isProductFavorited, toggleStoreFavorite, toggleProductFavorite }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export const useFavorites = () => useContext(FavoritesContext);
