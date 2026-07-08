
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from '@/context/useAuth';
import { Navigate, Link, useLocation } from 'react-router-dom';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { ECOSYSTEM_FLAGS } from '@/lib/ecosystemFlags';
import ModuleGate from '@/components/ModuleGate';


const ProtectedRoute: React.FC<{ 
  children: React.ReactNode; 
  allowedRoles?: string[];
  requiredPermission?: string;
  /** When VITE_ECOSYSTEM_ENFORCE_MODULES is on, gate by module entitlement */
  requiredModule?: string;
}> = ({ children, allowedRoles, requiredPermission, requiredModule }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const [ipCheckState, setIpCheckState] = useState<'idle' | 'checking' | 'allowed' | 'blocked'>('idle');
  const [ipCheckMessage, setIpCheckMessage] = useState('');

  const loadingTitle = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith('/admin/crm')) return 'Sales CRM';
    if (path.startsWith('/team/crm')) return 'Sales CRM';
    if (path === '/admin/customers') return 'Customer Management';
    if (path.startsWith('/admin')) return 'Admin Panel';
    if (path.startsWith('/team')) return 'Team Dashboard';
    return 'Loading';
  }, [location.pathname]);

  const LoadingShell = () => (
    <div className="min-h-[40vh] flex items-center justify-center bg-[#eef2f7]">
      <div className="rounded-2xl border border-slate-200/80 bg-white px-6 py-5 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">{loadingTitle}</h1>
        <div className="mt-3 h-2 w-40 animate-pulse rounded-full bg-slate-200" />
      </div>
    </div>
  );

  const requiresAdminIpCheck = useMemo(() => {
    return Boolean(allowedRoles && allowedRoles.includes('admin') && user?.role === 'admin');
  }, [allowedRoles, user?.role]);

  useEffect(() => {
    if (!user || !requiresAdminIpCheck) {
      setIpCheckState('idle');
      setIpCheckMessage('');
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
          if (!cancelled) setIpCheckState('allowed');
          return;
        }

        const profile = profileSnap.data() as {
          adminIpWhitelistEnabled?: boolean;
          adminIpAllowlist?: string[];
        };

        if (!profile.adminIpWhitelistEnabled) {
          if (!cancelled) setIpCheckState('allowed');
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
          if (!cancelled) setIpCheckState('allowed');
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
            setIpCheckState('allowed');
          } else {
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

  // Wait for auth state to finish loading before making redirect decisions
  if (isLoading) {
    return <LoadingShell />;
  }

  if (!user) {
    const dest = `${location.pathname}${location.search}`;
    if (dest && dest !== '/login' && !dest.startsWith('/login?')) {
      try {
        localStorage.setItem('redirectAfterLogin', dest);
      } catch {
        // ignore quota / private mode
      }
    }
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (requiresAdminIpCheck && (ipCheckState === 'idle' || ipCheckState === 'checking')) {
    return <LoadingShell />;
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
    } else if (!allowedRoles.includes(user.role)) {
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
