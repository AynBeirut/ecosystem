import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '@/context/useAuth';

const NAV_LINKS = [
  { label: 'Features', href: '/features' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Use Cases', href: '/use-cases' },
  { label: 'Blog', href: '/blog' },
  { label: 'About', href: '/about' },
];

const PublicNav: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { user, isLoading } = useAuth();
  const isSignedIn = !!user;
  const dashboardPath =
    user?.role === 'crm_rep'
      ? '/team/crm'
      : user?.role === 'sub_account'
        ? '/team/dashboard'
        : '/admin/dashboard';

  const isActive = (href: string) =>
    href === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(href);

  const closeMobile = () => setMobileOpen(false);

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
      <nav
        className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16 gap-3"
        aria-label="Main navigation"
      >
        <Link
          to="/home"
          className="flex items-center gap-2 font-bold text-xl text-gray-900 hover:text-teal-600 transition-colors shrink-0"
          aria-label="Grabio home"
        >
          <span className="text-teal-600">Grabio</span>
        </Link>

        <ul className="hidden md:flex items-center gap-1 list-none m-0 p-0">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                to={link.href}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive(link.href)
                    ? 'text-teal-600 bg-teal-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden md:flex items-center gap-2 shrink-0 min-h-[40px]">
          <Link
            to="/search"
            className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors whitespace-nowrap"
          >
            Marketplace
          </Link>
          {isLoading ? (
            <div className="h-9 w-[220px] rounded-lg bg-gray-100 animate-pulse" aria-hidden />
          ) : isSignedIn ? (
            <Link
              to={dashboardPath}
              className="px-4 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors whitespace-nowrap"
            >
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors whitespace-nowrap"
              >
                Sign In
              </Link>
              <Link
                to="/login?tab=signup"
                className="px-4 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors whitespace-nowrap"
              >
                Get Started Free
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="md:hidden p-2.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 pb-4">
          <ul className="flex flex-col gap-1 pt-3 list-none m-0 p-0">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  to={link.href}
                  onClick={closeMobile}
                  className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive(link.href)
                      ? 'text-teal-600 bg-teal-50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                to="/search"
                onClick={closeMobile}
                className="block px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Marketplace
              </Link>
            </li>
          </ul>

          <div className="pt-3 mt-3 border-t border-gray-100 grid gap-2 min-h-[52px]">
            {isLoading ? (
              <div className="h-11 w-full rounded-xl bg-gray-100 animate-pulse" aria-hidden />
            ) : isSignedIn ? (
              <Link
                to={dashboardPath}
                onClick={closeMobile}
                className="block w-full py-3 px-4 rounded-xl text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 text-center"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={closeMobile}
                  className="block w-full py-3 px-4 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 text-center"
                >
                  Sign In
                </Link>
                <Link
                  to="/login?tab=signup"
                  onClick={closeMobile}
                  className="block w-full py-3 px-4 rounded-xl text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 text-center"
                >
                  Get Started Free
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default PublicNav;
