export const COLORS = {
  primary: '#38B2AC',
  primaryLight: '#E6FFFA',
  secondary: '#2C5282',
  accent: '#ED8936',
  background: '#f8fafc',
  surface: '#ffffff',
  light: '#EDF2F7',
  border: '#e2e8f0',
  textPrimary: '#1A202C',
  textSecondary: '#64748b',
  textMuted: '#9ca3af',
  success: '#38a169',
  warning: '#d97706',
  error: '#ef4444',
  info: '#3b82f6',
  status: {
    pending: { bg: '#fef3c7', text: '#92400e' },
    confirmed: { bg: '#dbeafe', text: '#1e40af' },
    preparing: { bg: '#ede9fe', text: '#5b21b6' },
    ready: { bg: '#d1fae5', text: '#065f46' },
    delivered: { bg: '#f3f4f6', text: '#374151' },
    cancelled: { bg: '#fee2e2', text: '#991b1b' },
  },
};

export const FONT = { regular: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800 };
export const RADIUS = { sm: 6, md: 8, lg: 12, xl: 16, full: 999 };
export const SHADOW = {
  sm: { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  md: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
};
