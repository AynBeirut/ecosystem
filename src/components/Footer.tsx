import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import PoweredByEmoove from '@/components/PoweredByEmoove';
import { useCart } from '@/context/CartContext';
import { resolveStoreShopLabel, resolveStoreShopUrl } from '@/lib/storeNavigation';
import { isExternalUrl } from '@/lib/storeUrls';

const PUBLIC_MARKETING_PATHS = new Set([
  '/home',
  '/features',
  '/pricing',
  '/use-cases',
  '/about',
  '/blog',
  '/onboarding/package',
]);

const ADMIN_SHELL_PREFIXES = ['/admin', '/team/dashboard'];

function isAdminShellPath(pathname: string) {
  return pathname === '/subscription' || ADMIN_SHELL_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

const Footer: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { items } = useCart();
  const year = new Date().getFullYear();
  const isHome = location.pathname === '/';
  const isLogin = location.pathname === '/login';
  const isMarketplace = location.pathname === '/search' || location.pathname === '/marketplace';
  const isPublicMarketing =
    PUBLIC_MARKETING_PATHS.has(location.pathname) ||
    location.pathname.startsWith('/blog/');

  const shopUrl = resolveStoreShopUrl({ pathname: location.pathname, items });
  const shopLabel = resolveStoreShopLabel(shopUrl);
  const showShopButton = !isHome && !isLogin && !isMarketplace && !isPublicMarketing;

  if (isPublicMarketing || isAdminShellPath(location.pathname)) return null;

  return (
    <footer className="w-full bg-gray-100 border-t py-4 mt-8 flex flex-col items-center gap-2">
      <div className="text-xs text-gray-500">
        © {year} <PoweredByEmoove />
      </div>
      <div className="text-xs text-gray-600 flex items-center gap-2">
        <Link to="/contact" className="text-market-primary hover:underline font-medium">Contact Us</Link>
        <span className="text-gray-400">·</span>
        <a href="mailto:support@grabio.space" className="text-market-primary hover:underline">support@grabio.space</a>
      </div>
      {showShopButton && (
        isExternalUrl(shopUrl) ? (
          <a
            href={shopUrl}
            className="px-4 py-2 rounded bg-market-primary text-white hover:bg-market-primary/90 text-xs font-medium"
          >
            {shopLabel}
          </a>
        ) : (
        <button
          onClick={() => navigate(shopUrl)}
          className="px-4 py-2 rounded bg-market-primary text-white hover:bg-market-primary/90 text-xs font-medium"
        >
          {shopLabel}
        </button>
        )
      )}
    </footer>
  );
};

export default Footer;
