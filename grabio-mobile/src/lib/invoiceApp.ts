/** Same URLs as standalone Grabio Invoice Manager (space.grabio.finance TWA). */
export const INVOICE_MANAGER_HOME = '/invoice/invoices';

export const INVOICE_MANAGER_SECTIONS = [
  { id: 'invoices', label: 'Invoices', path: '/invoice/invoices' },
  { id: 'estimates', label: 'Estimates', path: '/invoice/estimates' },
  { id: 'receipts', label: 'Receipts', path: '/invoice/receipts' },
  { id: 'clients', label: 'Clients', path: '/invoice/clients' },
  { id: 'products', label: 'Products', path: '/invoice/products' },
  { id: 'reports', label: 'Reports', path: '/invoice/reports' },
  { id: 'settings', label: 'Settings', path: '/invoice/settings' },
] as const;

/** Match standalone Play Store app launch params — full AppLayout UI, not stripped embed. */
export function invoiceManagerUrl(path = INVOICE_MANAGER_HOME): string {
  const base = 'https://grabio.space';
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${base}${normalized}`);
  url.searchParams.set('source', 'grabio-finance-app');
  return url.toString();
}

const ALLOWED_HOSTS = new Set([
  'grabio.space',
  'accounts.google.com',
  'www.google.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'www.googleapis.com',
  'firebaseapp.com',
  'market-flow-7b074.firebaseapp.com',
]);

function hostAllowed(hostname: string): boolean {
  if (ALLOWED_HOSTS.has(hostname)) return true;
  return hostname.endsWith('.google.com') || hostname.endsWith('.firebaseapp.com');
}

/** Keep all invoice work inside the app WebView. */
export function isInvoiceManagerUrl(url: string): boolean {
  if (url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('whatsapp:') || url.startsWith('blob:')) {
    return true;
  }
  try {
    const parsed = new URL(url);
    if (!hostAllowed(parsed.hostname)) return false;
    if (parsed.hostname === 'grabio.space') {
      return (
        parsed.pathname === '/invoice' ||
        parsed.pathname.startsWith('/invoice/') ||
        parsed.pathname === '/auth/callback'
      );
    }
    return true;
  } catch {
    return false;
  }
}

export function buildShellBootstrapJs(ssoToken?: string | null): string {
  const tokenLiteral = ssoToken ? JSON.stringify(ssoToken) : 'null';
  return `
    (function() {
      try {
        if (${tokenLiteral}) window.__GRABIO_MOBILE_SSO_TOKEN__ = ${tokenLiteral};
        sessionStorage.setItem('grabio-finance-play-app', '1');
        localStorage.setItem('grabio-finance-play-app', '1');
        sessionStorage.setItem('grabio-admin-app-shell', '1');
        localStorage.setItem('grabio-admin-app-shell', '1');
      } catch (e) {}
    })();
    true;
  `;
}
