/**
 * grabio Design Tokens
 * Matches the web app's Tailwind CSS config (tailwind.config.ts)
 * market-primary: #38B2AC (teal)
 * market-secondary: #2C5282 (dark blue)
 * market-accent: #ED8936 (orange)
 * market-light: #EDF2F7
 * market-dark: #1A202C
 */

export const COLORS = {
  // Brand
  primary: '#38B2AC',       // market-primary teal — buttons, prices, brand
  primaryLight: '#E6FFFA',  // teal-50 — light teal backgrounds
  secondary: '#2C5282',     // market-secondary dark blue — headers
  accent: '#ED8936',        // market-accent orange — CTAs

  // Layout
  background: '#f8fafc',    // --background near-white
  surface: '#ffffff',       // card / panel backgrounds
  light: '#EDF2F7',         // market-light — placeholder bg, muted areas
  border: '#e2e8f0',        // --border subtle dividers

  // Text
  textPrimary: '#1A202C',   // market-dark near-black
  textSecondary: '#64748b', // --muted-foreground gray
  textMuted: '#9ca3af',     // gray-400 empty states

  // Semantic
  success: '#38a169',       // green — delivered, paid
  warning: '#d97706',       // amber — pending, low stock
  error: '#ef4444',         // red — cancelled, critical
  info: '#3b82f6',          // blue — confirmed state

  // Order status badge colors (matches web admin)
  status: {
    pending:   { bg: '#fef3c7', text: '#92400e' },
    confirmed: { bg: '#dbeafe', text: '#1e40af' },
    preparing: { bg: '#ede9fe', text: '#5b21b6' },
    ready:     { bg: '#d1fae5', text: '#065f46' },
    delivered: { bg: '#f3f4f6', text: '#374151' },
    cancelled: { bg: '#fee2e2', text: '#991b1b' },
  },
};

export const FONT = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
};

export const RADIUS = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 999,
};

export const SHADOW = {
  sm: {
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
};
