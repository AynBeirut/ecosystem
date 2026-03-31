import { StoreProfile } from '../types/storeProfile';

/**
 * Checks if a store's subscription is active and the user has access
 * @param storeProfile - The store profile to check
 * @returns Object with allowed status and optional message/redirect
 */
export function checkSubscriptionAccess(storeProfile: StoreProfile | null | undefined): {
  allowed: boolean;
  status?: 'trial' | 'active' | 'grace' | 'expired' | 'blocked' | 'legacy';
  message?: string;
  redirectTo?: string;
  daysRemaining?: number;
} {
  if (!storeProfile) {
    return {
      allowed: false,
      message: 'Store profile not found',
      redirectTo: '/subscription',
    };
  }

  // Legacy users have access until their legacy expiry date
  if (storeProfile.isLegacyUser && storeProfile.legacyExpiresAt) {
    const legacyExpiry = new Date(storeProfile.legacyExpiresAt);
    const now = new Date();
    
    if (now < legacyExpiry) {
      const daysRemaining = Math.ceil((legacyExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return {
        allowed: true,
        status: 'legacy',
        daysRemaining,
      };
    } else {
      // Legacy period expired, check regular subscription
      // Fall through to regular subscription check
    }
  }

  const status = storeProfile.subscriptionStatus;

  // If account is blocked, deny access
  if (status === 'blocked') {
    return {
      allowed: false,
      status: 'blocked',
      message: 'Your account has been blocked due to expired subscription. Please contact support or renew your subscription.',
      redirectTo: '/blocked',
    };
  }

  // If in grace period, allow access but show warning
  if (status === 'grace') {
    const gracePeriodStarted = storeProfile.gracePeriodStartedAt 
      ? new Date(storeProfile.gracePeriodStartedAt) 
      : null;
    
    if (gracePeriodStarted) {
      const now = new Date();
      const daysSinceGrace = Math.floor((now.getTime() - gracePeriodStarted.getTime()) / (1000 * 60 * 60 * 24));
      const daysRemaining = 7 - daysSinceGrace;
      
      return {
        allowed: true,
        status: 'grace',
        message: `Your subscription has expired. You have ${daysRemaining} days remaining in your grace period. Please renew to avoid losing access.`,
        daysRemaining: Math.max(0, daysRemaining),
      };
    }
  }

  // If subscription is expired (but not in grace), redirect to upgrade
  if (status === 'expired') {
    return {
      allowed: false,
      status: 'expired',
      message: 'Your subscription has expired. Please renew to continue using admin features.',
      redirectTo: '/subscription',
    };
  }

  // If active or trial, allow access
  if (status === 'active' || status === 'trial') {
    const endsAt = storeProfile.subscriptionEndsAt ? new Date(storeProfile.subscriptionEndsAt) : null;
    
    if (endsAt) {
      const now = new Date();
      const daysRemaining = Math.ceil((endsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      return {
        allowed: true,
        status,
        daysRemaining: Math.max(0, daysRemaining),
      };
    }
    
    return {
      allowed: true,
      status,
    };
  }

  // No subscription status - redirect to upgrade page
  return {
    allowed: false,
    message: 'No active subscription found. Please subscribe to access admin features.',
    redirectTo: '/subscription',
  };
}

/**
 * Component wrapper that displays subscription status banner
 * @param storeProfile - The store profile to check
 * @returns JSX element for subscription status banner
 */
export function SubscriptionStatusBanner({ 
  storeProfile 
}: { 
  storeProfile: StoreProfile | null | undefined 
}): JSX.Element | null {
  const access = checkSubscriptionAccess(storeProfile);
  
  if (!access.allowed) {
    return null; // Will be redirected by guard
  }

  // Show warning for grace period
  if (access.status === 'grace' && access.message) {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-red-700">
              {access.message}
            </p>
          </div>
          <div className="ml-auto">
            <a href="/subscription" className="text-sm font-medium text-red-700 hover:text-red-600 underline">
              Renew Now
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Show info for trial or expiring subscriptions
  if ((access.status === 'trial' || access.status === 'active') && access.daysRemaining !== undefined && access.daysRemaining <= 7) {
    return (
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-yellow-700">
              {access.status === 'trial' 
                ? `Your trial expires in ${access.daysRemaining} days.` 
                : `Your subscription expires in ${access.daysRemaining} days.`}
            </p>
          </div>
          <div className="ml-auto">
            <a href="/subscription" className="text-sm font-medium text-yellow-700 hover:text-yellow-600 underline">
              Manage Subscription
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Show legacy user info
  if (access.status === 'legacy' && access.daysRemaining !== undefined && access.daysRemaining <= 30) {
    return (
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              Your legacy free access expires in {access.daysRemaining} days. Subscribe to continue enjoying admin features.
            </p>
          </div>
          <div className="ml-auto">
            <a href="/subscription" className="text-sm font-medium text-blue-700 hover:text-blue-600 underline">
              Subscribe Now
            </a>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

/**
 * Hook to check subscription access and redirect if needed
 * Use this in admin pages to enforce subscription requirements
 */
export function useSubscriptionGuard(
  storeProfile: StoreProfile | null | undefined,
  navigate: (path: string) => void
): {
  allowed: boolean;
  status?: string;
  message?: string;
  daysRemaining?: number;
} {
  const access = checkSubscriptionAccess(storeProfile);
  
  if (!access.allowed && access.redirectTo) {
    // Redirect to appropriate page
    navigate(access.redirectTo);
  }
  
  return access;
}
