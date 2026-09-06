/** Invoice Manager — embedded admin module on grabio.space (SSO-aware). */
export const INVOICE_MANAGER_HOME = '/admin/invoice-manager/invoices';

export const INVOICE_MANAGER_SECTIONS = [
  { id: 'invoices', label: 'Invoices', path: '/admin/invoice-manager/invoices' },
  { id: 'quotations', label: 'Quotations', path: '/admin/invoice-manager/quotations' },
  { id: 'receipts', label: 'Receipts', path: '/admin/invoice-manager/receipts' },
  { id: 'clients', label: 'Clients', path: '/admin/invoice-manager/clients' },
  { id: 'products', label: 'Products', path: '/admin/invoice-manager/products' },
  { id: 'purchases', label: 'Purchases', path: '/admin/invoice-manager/purchases' },
  { id: 'expenses', label: 'Expenses', path: '/admin/invoice-manager/expenses' },
] as const;

export function invoiceManagerUrl(path = INVOICE_MANAGER_HOME): string {
  const base = 'https://grabio.space';
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${base}${normalized}`);
  url.searchParams.set('source', 'grabio-finance-app');
  url.searchParams.set('next', normalized);
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

function isGrabioInvoicePath(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/invoice-manager') ||
    pathname === '/auth/callback' ||
    pathname === '/invoice' ||
    pathname.startsWith('/invoice/')
  );
}

/** Keep invoice + auth redirects inside the app WebView. */
export function isInvoiceManagerUrl(url: string): boolean {
  if (url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('whatsapp:') || url.startsWith('blob:')) {
    return true;
  }
  try {
    const parsed = new URL(url);
    if (!hostAllowed(parsed.hostname)) return false;
    if (parsed.hostname === 'grabio.space') {
      return isGrabioInvoicePath(parsed.pathname);
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
