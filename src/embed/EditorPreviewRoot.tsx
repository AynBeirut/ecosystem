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

const passiveAuth: AuthContextType = {
  user: null,
  setUser: () => undefined,
  isLoading: false,
  login: async () => undefined,
  googleLogin: async () => undefined,
  logout: async () => undefined,
  upgradeToAdmin: async () => undefined,
  followStore: async () => undefined,
  unfollowStore: async () => undefined,
};

export function isEditorEmbedFrame(): boolean {
  if (typeof window === 'undefined') return false;
  // Parent iframe sets name="grabio-theme-preview" — most reliable signal.
  if (window.name === 'grabio-theme-preview') return true;
  const params = new URLSearchParams(window.location.search);
  if (params.get('editorEmbed') === '1') return true;
  if (params.get('editorPreview') !== '1') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

const EditorPreviewRoot: React.FC = () => (
  <HelmetProvider>
    <ThemeProvider>
      <AuthContext.Provider value={passiveAuth}>
        <CartProvider>
          <FavoritesProvider>
            <BrowserRouter
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
