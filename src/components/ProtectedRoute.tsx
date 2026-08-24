
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from '@/context/useAuth';
import { Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { auth } from '@/lib/firebase';
import { ECOSYSTEM_FLAGS } from '@/lib/ecosystemFlags';
import ModuleGate from '@/components/ModuleGate';
import { checkSubscriptionAccess } from '@/lib/subscriptionGuard';
import type { StoreProfile } from '@/types/storeProfile';
import { getActualStoreId } from '@/lib/storeUtils';
import {
  gateIpAllowedFor,
  gateSubscriptionAllowed,
  markGateIpAllowed,
  markGateSubscriptionAllowed,
} from '@/lib/vOpsCache';
import AdminEmbedLoader from '@/components/admin/AdminEmbedLoader';
import FinanceModuleLoadingShell from '@/pages/admin/finance/FinanceModuleLoadingShell';


const ProtectedRoute: React.FC<{ 
  children: React.ReactNode; 
  allowedRoles?: string[];
  requiredPermission?: string;
  /** When VITE_ECOSYSTEM_ENFORCE_MODULES is on, gate by module entitlement */
  requiredModule?: string;
}> = ({ children, allowedRoles, requiredPermission, requiredModule }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [ipCheckState, setIpCheckState] = useState<'idle' | 'checking' | 'allowed' | 'blocked'>('idle');
  const [ipCheckMessage, setIpCheckMessage] = useState('');
  const [subscriptionState, setSubscriptionState] = useState<'idle' | 'checking' | 'allowed' | 'blocked'>('idle');
  const [subscriptionMessage, setSubscriptionMessage] = useState('');
  const subscriptionAllowedRef = useRef(false);
  const ipAllowedRef = useRef(false);
  const lastKnownUserRef = useRef(user);
  const authRecoveryUntilRef = useRef(0);

  const isBuilderAuthGracePath = useMemo(
    () =>
      location.pathname.startsWith('/admin/theme-editor') ||
      location.pathname.startsWith('/admin/templates'),
    [location.pathname],
  );

  useEffect(() => {
    if (user) {
      lastKnownUserRef.current = user;
      authRecoveryUntilRef.current = 0;
      return;
    }
    if ((lastKnownUserRef.current || auth.currentUser) && authRecoveryUntilRef.current === 0) {
      authRecoveryUntilRef.current = Date.now() + (isBuilderAuthGracePath ? 15000 : 2500);
    }
  }, [user, isBuilderAuthGracePath]);

  const loadingTitle = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith('/admin/crm')) return 'Sales CRM';
    if (path.startsWith('/team/crm')) return 'Sales CRM';
    if (path.startsWith('/admin/finance')) return 'Business Finance';
    if (path === '/admin/customers') return 'Customer Management';
    if (path.startsWith('/admin')) return 'Workspace';
    if (path.startsWith('/team')) return 'Team Dashboard';
    return 'Loading';
  }, [location.pathname]);

  const LoadingShell = ({ message }: { message?: string } = {}) => {
    const path = location.pathname;
    const label = message || `Opening ${loadingTitle}…`;
    if (path.startsWith('/admin/theme-editor')) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#f6f6f7]">
          <AdminEmbedLoader label={label} compact />
        </div>
      );
    }
    if (path.startsWith('/admin/finance')) {
      return <FinanceModuleLoadingShell variant="finance" message={label} />;
    }
    if (path.startsWith('/admin/invoice-manager')) {
      return <FinanceModuleLoadingShell variant="invoice" message={label} />;
    }
    return (
      <div className="flex min-h-[40vh] items-center justify-center py-12">
        <AdminEmbedLoader label={label} compact />
      </div>
    );
  };

  const requiresAdminIpCheck = useMemo(() => {
    return Boolean(allowedRoles && allowedRoles.includes('admin') && user?.role === 'admin');
  }, [allowedRoles, user?.role]);

  useEffect(() => {
    if (!user || !requiresAdminIpCheck) {
      setIpCheckState('idle');
      setIpCheckMessage('');
      ipAllowedRef.current = false;
      return;
    }

    const storeIdForGate = user.storeId || user.id || '';
    if (ipAllowedRef.current || gateIpAllowedFor(storeIdForGate)) {
      ipAllowedRef.current = true;
      setIpCheckState('allowed');
      return;
    }

    let cancelled = false;

    const verifyIpAllowlist = async () => {
      setIpCheckState('checking');
      setIpCheckMessage('');

      try {
        const db = getFirestore();
        const storeId = user.storeId || user.id;
        const profileSnap = await getDoc(doc(db, 'storeProfiles', storeId));

        if (!profileSnap.exists()) {
          if (!cancelled) {
            ipAllowedRef.current = true;
            markGateIpAllowed(storeId);
            setIpCheckState('allowed');
          }
          return;
        }

        const profile = profileSnap.data() as {
          adminIpWhitelistEnabled?: boolean;
          adminIpAllowlist?: string[];
        };

        if (!profile.adminIpWhitelistEnabled) {
          if (!cancelled) {
            ipAllowedRef.current = true;
            markGateIpAllowed(storeId);
            setIpCheckState('allowed');
          }
          return;
        }

        const allowlist = (profile.adminIpAllowlist || [])
          .map((entry) => String(entry || '').trim())
          .filter((entry) => entry.length > 0);

        if (allowlist.length === 0) {
          if (!cancelled) {
            setIpCheckState('blocked');
            setIpCheckMessage('Admin IP allowlist is enabled but empty.');
          }
          return;
        }

        const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
          if (!cancelled) {
            ipAllowedRef.current = true;
            markGateIpAllowed(storeId);
            setIpCheckState('allowed');
          }
          return;
        }

        let currentIp = '';
        try {
          const raw = localStorage.getItem('adminCurrentIpCache');
          if (raw) {
            const cached = JSON.parse(raw) as { ip?: string; ts?: number };
            if (cached.ip && cached.ts && (Date.now() - cached.ts) < 5 * 60 * 1000) {
              currentIp = cached.ip;
            }
          }
        } catch (_err) {
          // ignore local cache parsing issues
        }

        if (!currentIp) {
          const response = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
          const data = await response.json() as { ip?: string };
          currentIp = String(data.ip || '').trim();
          if (currentIp) {
            localStorage.setItem('adminCurrentIpCache', JSON.stringify({ ip: currentIp, ts: Date.now() }));
          }
        }

        if (!currentIp) {
          if (!cancelled) {
            setIpCheckState('blocked');
            setIpCheckMessage('Could not verify your public IP address.');
          }
          return;
        }

        const ipAllowed = allowlist.includes(currentIp);
        if (!cancelled) {
          if (ipAllowed) {
            ipAllowedRef.current = true;
            markGateIpAllowed(storeId);
            setIpCheckState('allowed');
          } else {
            ipAllowedRef.current = false;
            setIpCheckState('blocked');
            setIpCheckMessage(`Current IP ${currentIp} is not in the admin allowlist.`);
          }
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'IP check failed';
          setIpCheckState('blocked');
          setIpCheckMessage(msg);
        }
      }
    };

    verifyIpAllowlist();

    return () => {
      cancelled = true;
    };
  }, [user, requiresAdminIpCheck]);

  const requiresSubscriptionCheck = useMemo(() => {
    if (!user) return false;
    if (user.role !== 'admin' && user.role !== 'sub_account') return false;
    const path = location.pathname;
    if (path === '/subscription' || path.startsWith('/subscription/')) return false;
    if (path.startsWith('/admin/builder') || path.startsWith('/admin/theme-editor')) return false;
    return path.startsWith('/admin') || path.startsWith('/team');
  }, [user, location.pathname]);

  useEffect(() => {
    if (!user || !requiresSubscriptionCheck) {
      setSubscriptionState('idle');
      setSubscriptionMessage('');
      subscriptionAllowedRef.current = false;
      return;
    }

    const storeIdEarly = getActualStoreId(user) || '';
    if (subscriptionAllowedRef.current || gateSubscriptionAllowed(storeIdEarly)) {
      subscriptionAllowedRef.current = true;
      setSubscriptionState('allowed');
      return;
    }

    let cancelled = false;

    const verifySubscription = async () => {
      setSubscriptionState('checking');
      setSubscriptionMessage('');

      try {
        const db = getFirestore();
        const storeId = getActualStoreId(user);
        if (!storeId) {
          if (!cancelled) {
            setSubscriptionState('blocked');
            setSubscriptionMessage('Store not found for this account.');
          }
          return;
        }

        const profileSnap = await getDoc(doc(db, 'storeProfiles', storeId));
        const profile = profileSnap.exists()
          ? ({ id: storeId, ...profileSnap.data() } as StoreProfile)
          : null;
        const profileForAccess = profile
          ? ({
              ...profile,
              email: String(profile.email || (user as { email?: string })?.email || ''),
            } as StoreProfile)
          : null;
        const access = checkSubscriptionAccess(profileForAccess);

        if (!cancelled) {
          if (access.allowed) {
            subscriptionAllowedRef.current = true;
            markGateSubscriptionAllowed(storeId);
            setSubscriptionState('allowed');
          } else {
            subscriptionAllowedRef.current = false;
            setSubscriptionState('blocked');
            setSubscriptionMessage(access.message || 'No active subscription found.');
            if (access.redirectTo && access.redirectTo !== '/blocked') {
              navigate(access.redirectTo, { replace: true, state: { from: location } });
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          setSubscriptionState('blocked');
          setSubscriptionMessage(err instanceof Error ? err.message : 'Subscription check failed.');
        }
      }
    };

    void verifySubscription();

    return () => {
      cancelled = true;
    };
  }, [user, requiresSubscriptionCheck, navigate, location]);

  // Wait for auth state to finish loading before making redirect decisions
  if (isLoading) {
    return <LoadingShell />;
  }

  if (!user) {
    const dest = `${location.pathname}${location.search}`;
    const firebaseSignedIn = Boolean(auth.currentUser);

    if (firebaseSignedIn) {
      return <LoadingShell message="Restoring your session…" />;
    }

    const canRecoverAuth =
      isBuilderAuthGracePath &&
      Boolean(lastKnownUserRef.current) &&
      Date.now() < authRecoveryUntilRef.current;

    if (canRecoverAuth) {
      return <LoadingShell message="Restoring your session…" />;
    }

    if (dest && dest !== '/login' && !dest.startsWith('/login?')) {
      try {
        localStorage.setItem('redirectAfterLogin', dest);
      } catch {
        // ignore quota / private mode
      }
    }
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (requiresAdminIpCheck) {
    const sid = user.storeId || user.id || '';
    const ipOk = ipAllowedRef.current || gateIpAllowedFor(sid) || ipCheckState === 'allowed';
    if (!ipOk && (ipCheckState === 'idle' || ipCheckState === 'checking')) {
      return <LoadingShell />;
    }
  }

  if (requiresSubscriptionCheck) {
    const sid = getActualStoreId(user) || '';
    const subOk =
      subscriptionAllowedRef.current ||
      gateSubscriptionAllowed(sid) ||
      subscriptionState === 'allowed';
    if (!subOk && (subscriptionState === 'idle' || subscriptionState === 'checking')) {
      return <LoadingShell />;
    }
  }

  if (requiresSubscriptionCheck && subscriptionState === 'blocked' && !gateSubscriptionAllowed(getActualStoreId(user) || '')) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center px-4">
        <div className="max-w-lg w-full border rounded-lg p-6 space-y-3 bg-white">
          <h2 className="text-lg font-semibold">Subscription required</h2>
          <p className="text-sm text-gray-600">
            {subscriptionMessage || 'Start a trial or subscribe to use admin features.'}
          </p>
          <div className="flex gap-2">
            <Link to="/subscription" className="inline-flex items-center px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm">
              View plans
            </Link>
            <Link to="/" className="inline-flex items-center px-3 py-2 rounded-md border text-sm">Marketplace</Link>
          </div>
        </div>
      </div>
    );
  }

  if (requiresAdminIpCheck && ipCheckState === 'blocked') {
    return (
      <div className="min-h-[50vh] flex items-center justify-center px-4">
        <div className="max-w-lg w-full border rounded-lg p-6 space-y-3 bg-white">
          <h2 className="text-lg font-semibold">Admin Access Restricted</h2>
          <p className="text-sm text-gray-600">
            Admin IP allowlist blocked this session.
          </p>
          {ipCheckMessage ? <p className="text-xs text-red-600">{ipCheckMessage}</p> : null}
          <div className="flex gap-2">
            <Link to="/" className="inline-flex items-center px-3 py-2 rounded-md border text-sm">Go to Marketplace</Link>
          </div>
        </div>
      </div>
    );
  }

  // Check role-based access
  if (allowedRoles) {
    // For admin routes, allow both 'admin' and all sub-accounts
    if (allowedRoles.includes('admin')) {
      const hasAccess =
        user.role === 'admin' ||
        user.role === 'sub_account';

      if (!hasAccess) {
        if (user.role === 'user') {
          return <Navigate to="/subscription" replace state={{ from: location }} />;
        }
        return <Navigate to="/" replace />;
      }
    } else if (allowedRoles.includes('crm_rep')) {
      if (user.role !== 'crm_rep') {
        return <Navigate to="/" replace />;
      }
    } else if (user.role && !allowedRoles.includes(user.role)) {
      if (user.role === 'user') {
        return <Navigate to="/subscription" replace state={{ from: location }} />;
      }
      return <Navigate to="/" replace />;
    }
  }

  // Check permission-based access for sub-accounts
  if (requiredPermission && user.role === 'sub_account') {
    if (!user.permissions || !user.permissions.includes(requiredPermission)) {
      return <Navigate to="/admin" replace />;
    }
  }

  if (requiredModule && ECOSYSTEM_FLAGS.enforceModuleGates) {
    return (
      <ModuleGate moduleId={requiredModule}>
        {children}
      </ModuleGate>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
