import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  readAdminTheme,
  toggleAdminTheme,
  writeAdminTheme,
  type AdminTheme,
} from '@/lib/adminTheme';

type AdminThemeContextValue = {
  theme: AdminTheme;
  setAdminTheme: (next: AdminTheme) => void;
  flipTheme: () => void;
  isDark: boolean;
};

const AdminThemeContext = createContext<AdminThemeContextValue | null>(null);

export function AdminThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<AdminTheme>(() => readAdminTheme());

  useEffect(() => {
    writeAdminTheme(theme);
  }, [theme]);

  const setAdminTheme = useCallback((next: AdminTheme) => {
    setTheme(next);
  }, []);

  const flipTheme = useCallback(() => {
    setTheme((current) => toggleAdminTheme(current));
  }, []);

  const value = useMemo(
    () => ({
      theme,
      setAdminTheme,
      flipTheme,
      isDark: theme === 'dark',
    }),
    [theme, setAdminTheme, flipTheme],
  );

  return <AdminThemeContext.Provider value={value}>{children}</AdminThemeContext.Provider>;
}

export function useAdminTheme() {
  const ctx = useContext(AdminThemeContext);
  if (!ctx) {
    throw new Error('useAdminTheme must be used within AdminThemeProvider');
  }
  return ctx;
}
