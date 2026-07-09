import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/useAuth';

/**
 * Auth-aware CTA button used on all public marketing pages.
 *
 * Not signed in   → "Get Started Free"  → /login?tab=signup
 * admin           → "Visit Dashboard"   → /admin
 * sub_account     → "Visit Dashboard"   → /team/dashboard
 * user (buyer)    → "View Pricing"      → /pricing
 */
interface AuthCTAProps {
  className?: string;
  onClick?: () => void;
  showArrow?: boolean;
}

export function useAuthCTA() {
  const { user } = useAuth();
  if (!user) return { label: 'Get Started Free', href: '/login?tab=signup' };
  if (user.role === 'admin') return { label: 'Visit Dashboard', href: '/admin' };
  if (user.role === 'sub_account') return { label: 'Visit Dashboard', href: '/team/dashboard' };
  if (user.role === 'crm_rep') return { label: 'Sales CRM', href: '/team/crm' };
  // role === 'user' (buyer / guest — has no store)
  return { label: 'View Pricing', href: '/pricing' };
}

const AuthCTA: React.FC<AuthCTAProps> = ({ className = '', onClick, showArrow = false }) => {
  const { label, href } = useAuthCTA();
  return (
    <Link to={href} className={className} onClick={onClick}>
      {label}
      {showArrow && <ArrowRight className="inline ml-1 h-4 w-4" />}
    </Link>
  );
};

export default AuthCTA;
