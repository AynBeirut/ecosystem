export type AdminTheme = 'dark' | 'light';

export const ADMIN_THEME_STORAGE_KEY = 'grabio-admin-theme';

export function readAdminTheme(): AdminTheme {
  if (typeof window === 'undefined') return 'dark';
  const stored = window.localStorage.getItem(ADMIN_THEME_STORAGE_KEY);
  if (stored === 'light') return 'light';
  if (stored === 'dark' || stored === 'obsidian') return 'dark';
  return 'dark';
}

export function writeAdminTheme(theme: AdminTheme) {
  window.localStorage.setItem(ADMIN_THEME_STORAGE_KEY, theme);
}

export function toggleAdminTheme(current: AdminTheme): AdminTheme {
  return current === 'dark' ? 'light' : 'dark';
}
