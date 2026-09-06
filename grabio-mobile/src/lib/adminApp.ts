export const SALES_CRM_HOME = '/admin/crm/dashboard';

export function adminWebUrl(path = SALES_CRM_HOME): string {
  const base = 'https://grabio.space';
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${base}${normalized}`);
  url.searchParams.set('source', 'grabio-admin-app');
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

/** Keep admin CRM work inside the app WebView. */
export function isAdminWebUrl(url: string): boolean {
  if (url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('whatsapp:') || url.startsWith('blob:')) {
    return true;
  }
  try {
    const parsed = new URL(url);
    if (!hostAllowed(parsed.hostname)) return false;
    if (parsed.hostname === 'grabio.space') {
      return (
        parsed.pathname === '/login' ||
        parsed.pathname === '/admin' ||
        parsed.pathname.startsWith('/admin/') ||
        parsed.pathname === '/auth/callback'
      );
    }
    return true;
  } catch {
    return false;
  }
}
