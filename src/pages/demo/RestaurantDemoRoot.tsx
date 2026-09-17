import React, { useMemo } from 'react';
import { Link, Navigate, Outlet } from 'react-router-dom';
import { AuthContext } from '@/context/AuthContextValue';
import { useAuth } from '@/context/useAuth';
import {
  RestaurantDemoProvider,
  buildRestaurantDemoUser,
  RESTAURANT_DEMO_ADMIN_BASE,
  useRestaurantDemoOptional,
} from '@/context/RestaurantDemoContext';
import { Button } from '@/components/ui/button';
import { auth } from '@/lib/firebase';

function RestaurantDemoBanner() {
  const demo = useRestaurantDemoOptional();
  if (!demo) return null;
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950">
      <span className="font-semibold">DEMO sandbox</span> — same admin layout as subscribers; saves only to isolated
      demo data (30 min, {demo.remainingCreates} creates left).{' '}
      {demo.error ? <span className="text-rose-700">{demo.error}</span> : null}
      <Button type="button" variant="link" className="h-auto p-0 ml-2 text-amber-900" onClick={() => void demo.resetSession()}>
        New session
      </Button>
      <Link to="/pricing" className="ml-2 font-medium text-teal-800 underline">Subscribe</Link>
    </div>
  );
}

function RestaurantDemoAuthBridge({ children }: { children: React.ReactNode }) {
  const parent = useAuth();
  const demo = useRestaurantDemoOptional();

  const bridged = useMemo(() => {
    if (!demo?.sessionId || !auth.currentUser?.uid) return parent;
    const user = buildRestaurantDemoUser(auth.currentUser.uid, demo.sessionId);
    return { ...parent, user, isLoading: parent.isLoading || demo.loading };
  }, [parent, demo?.sessionId, demo?.loading]);

  return <AuthContext.Provider value={bridged}>{children}</AuthContext.Provider>;
}

function RestaurantDemoGate() {
  const demo = useRestaurantDemoOptional();
  if (demo?.loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        Starting demo session…
      </div>
    );
  }
  if (demo?.error && !demo.sessionId) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center space-y-3">
        <p className="text-rose-600">{demo.error}</p>
        <p className="text-sm text-muted-foreground">
          Enable <strong>Anonymous</strong> sign-in in Firebase Authentication, then retry.
        </p>
        <Button type="button" onClick={() => void demo.resetSession()}>Retry</Button>
      </div>
    );
  }
  return (
    <>
      <RestaurantDemoBanner />
      <Outlet />
    </>
  );
}

export default function RestaurantDemoRoot() {
  return (
    <RestaurantDemoProvider>
      <RestaurantDemoAuthBridge>
        <RestaurantDemoGate />
      </RestaurantDemoAuthBridge>
    </RestaurantDemoProvider>
  );
}

export function RestaurantDemoIndexRedirect() {
  return <Navigate to={`${RESTAURANT_DEMO_ADMIN_BASE}/dashboard`} replace />;
}
