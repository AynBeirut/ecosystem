/**
 * Minimal React tree for theme-editor iframe preview.
 * Avoids mounting a second full AuthProvider (fixes parent sign-in loop).
 */
import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthContext } from '@/context/AuthContextValue';
import type { AuthContextType } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { FavoritesProvider } from '@/context/FavoritesContext';
import StoreDetail from '@/pages/StoreDetail';
import { EDITOR_EMBED_PREVIEW_BASE } from '@/lib/editorPreviewBridge';

import type { User } from '@/types/product';

const previewUser: User = {
  id: 'editor-preview',
  name: 'Preview',
  email: '',
  role: 'admin',
  avatar:
    'https://ui-avatars.com/api/?name=Preview&background=38B2AC&color=fff',
  dailyAdsWatched: 0,
  lastAdWatchDate: new Date().toISOString().split('T')[0],
  storeId: 'editor-preview',
  isSeller: true,
};

const passiveAuth: AuthContextType = {
  user: previewUser,
  setUser: () => undefined,
  isLoading: false,
  login: async () => undefined,
  googleLogin: async () => undefined,
  logout: async () => undefined,
  upgradeToAdmin: async () => undefined,
  followStore: async () => undefined,
  unfollowStore: async () => undefined,
};

const EditorPreviewRoot: React.FC = () => (
  <HelmetProvider>
    <ThemeProvider>
      <AuthContext.Provider value={passiveAuth}>
        <CartProvider>
          <FavoritesProvider>
            <BrowserRouter
              basename={EDITOR_EMBED_PREVIEW_BASE}
              future={{
                v7_startTransition: true,
                v7_relativeSplatPath: true,
              }}
            >
              <Routes>
                <Route path="/store/:slug" element={<StoreDetail />} />
                <Route path="/store/:slug/category/:categorySlug" element={<StoreDetail />} />
                <Route path="/store/id/:id" element={<StoreDetail />} />
                <Route path="/store/id/:id/category/:categorySlug" element={<StoreDetail />} />
                <Route path="/:slug" element={<StoreDetail />} />
                <Route path="/:slug/category/:categorySlug" element={<StoreDetail />} />
                <Route path="*" element={<StoreDetail />} />
              </Routes>
            </BrowserRouter>
          </FavoritesProvider>
        </CartProvider>
      </AuthContext.Provider>
    </ThemeProvider>
  </HelmetProvider>
);

export default EditorPreviewRoot;
export { isEditorEmbedFrame } from '@/lib/editorPreviewBridge';
