import { useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

const NOINDEX_PREFIXES = [
  '/admin',
  '/auth',
  '/builder',
  '/cart',
  '/favorites',
  '/freelancer',
  '/invoice',
  '/login',
  '/onboarding',
  '/orders',
  '/payment',
  '/profile',
  '/subscription',
  '/team',
  '/track-order',
  '/upgrade',
];

const NOINDEX_EXACT = new Set(['/blocked']);

function shouldNoindex(pathname: string): boolean {
  if (NOINDEX_EXACT.has(pathname)) return true;
  return NOINDEX_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export default function RouteRobots() {
  const { pathname } = useLocation();
  if (!shouldNoindex(pathname)) return null;

  return (
    <Helmet>
      <meta name="robots" content="noindex, nofollow" />
    </Helmet>
  );
}
