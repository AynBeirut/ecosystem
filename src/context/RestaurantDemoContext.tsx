import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from '@/types/product';
import type { StoreProfile } from '@/types/storeProfile';
import { resolveStoreEntitlements, type StoreEntitlements } from '@/lib/entitlements';
import { RESTAURANT_DEMO_SEED } from '@/lib/restaurantDemoConstants';
import {
  createRestaurantDemoEntity,
  getOrCreateRestaurantDemoSession,
  subscribeRestaurantDemoEntities,
  subscribeRestaurantDemoSession,
  type CreateDemoPayload,
} from '@/lib/restaurantDemoService';
import { remainingDemoActions } from '@/lib/restaurantDemoLogic';
import type { RestaurantDemoEntityType, RestaurantDemoSession } from '@/types/restaurantDemo';
import { auth } from '@/lib/firebase';

export const RESTAURANT_DEMO_ADMIN_BASE = '/demo/restaurant/admin';

export const DEMO_LIVE_KITCHEN_PROFILE: StoreProfile = {
  id: 'demo-live-kitchen',
  name: RESTAURANT_DEMO_SEED.venueName,
  slug: 'demo-bistro-lumiere',
  businessWorkflow: 'live_kitchen',
  startingPackage: 'pkg_live_kitchen',
  pricingVersion: 'modular-v2',
  subscriptionTier: 'pro',
  enabledModules: {
    pos: true,
    crm: true,
    restaurant: true,
    delivery: true,
    invoicing: true,
    invoice_manager: true,
    analytics: true,
    admin_mobile: true,
    stock: false,
    payments: false,
    builder: false,
    blog_publisher: false,
  },
  venueOpsSettings: {
    restaurantFirstNavEnabled: true,
    enableCrmPipeline: true,
    enableReservationsHub: true,
    enableFullInventory: false,
    enableBusinessFinance: false,
    enableStorefrontBuilder: false,
    enableSeoOps: false,
  },
};

type RestaurantDemoContextValue = {
  active: true;
  adminBase: string;
  sessionId: string | null;
  session: RestaurantDemoSession | null;
  profile: StoreProfile;
  entitlements: StoreEntitlements;
  remainingCreates: number;
  loading: boolean;
  error: string | null;
  entities: Partial<Record<RestaurantDemoEntityType, Record<string, unknown>[]>>;
  createDemo: (payload: CreateDemoPayload) => Promise<void>;
  resetSession: () => Promise<void>;
  toAdminPath: (adminPath: string) => string;
};

const RestaurantDemoContext = createContext<RestaurantDemoContextValue | null>(null);

export function useRestaurantDemoOptional(): RestaurantDemoContextValue | null {
  return useContext(RestaurantDemoContext);
}

export function useRestaurantDemo(): RestaurantDemoContextValue {
  const ctx = useContext(RestaurantDemoContext);
  if (!ctx) throw new Error('useRestaurantDemo outside RestaurantDemoProvider');
  return ctx;
}

export function toDemoAdminPath(adminPath: string, base = RESTAURANT_DEMO_ADMIN_BASE): string {
  if (adminPath.startsWith(base)) return adminPath;
  if (adminPath.startsWith('/admin')) return `${base}${adminPath.slice('/admin'.length) || '/dashboard'}`;
  return adminPath;
}

export const RestaurantDemoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<RestaurantDemoSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entities, setEntities] = useState<Partial<Record<RestaurantDemoEntityType, Record<string, unknown>[]>>>(
    {},
  );

  const profile = DEMO_LIVE_KITCHEN_PROFILE;
  const entitlements = useMemo(() => resolveStoreEntitlements(profile), [profile]);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { sessionId: id, session: s } = await getOrCreateRestaurantDemoSession();
      setSessionId(id);
      setSession(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Demo unavailable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!sessionId) return;
    return subscribeRestaurantDemoSession(sessionId, setSession);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const types: RestaurantDemoEntityType[] = [
      'products',
      'guests',
      'reservations',
      'orders',
      'documents',
      'crmTasks',
    ];
    const unsubs = types.map((type) =>
      subscribeRestaurantDemoEntities(sessionId, type, (rows) => {
        setEntities((prev) => ({ ...prev, [type]: rows }));
      }),
    );
    return () => unsubs.forEach((u) => u());
  }, [sessionId]);

  const createDemo = useCallback(
    async (payload: CreateDemoPayload) => {
      if (!sessionId) return;
      setError(null);
      try {
        await createRestaurantDemoEntity(sessionId, payload);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save demo item');
        throw e;
      }
    },
    [sessionId],
  );

  const resetSession = useCallback(async () => {
    localStorage.removeItem('grabio_restaurant_demo_session_id');
    if (auth.currentUser) {
      try {
        await auth.signOut();
      } catch {
        // ignore
      }
    }
    setSessionId(null);
    setSession(null);
    setEntities({});
    await bootstrap();
  }, [bootstrap]);

  const remainingCreates = session ? remainingDemoActions(session.actionCount, session.maxActions) : 0;

  const value = useMemo<RestaurantDemoContextValue>(
    () => ({
      active: true,
      adminBase: RESTAURANT_DEMO_ADMIN_BASE,
      sessionId,
      session,
      profile,
      entitlements,
      remainingCreates,
      loading,
      error,
      entities,
      createDemo,
      resetSession,
      toAdminPath: (p) => toDemoAdminPath(p, RESTAURANT_DEMO_ADMIN_BASE),
    }),
    [
      sessionId,
      session,
      profile,
      entitlements,
      remainingCreates,
      loading,
      error,
      entities,
      createDemo,
      resetSession,
    ],
  );

  return <RestaurantDemoContext.Provider value={value}>{children}</RestaurantDemoContext.Provider>;
};

/** Synthetic store admin for demo routes (anonymous Firebase user underneath). */
export function buildRestaurantDemoUser(authUid: string, sessionId: string): User {
  return {
    id: authUid,
    storeId: `demo-restaurant-${sessionId}`,
    role: 'admin',
    name: 'Demo visitor',
    email: 'demo@grabio.space',
    permissions: [
      'view_orders',
      'create_orders',
      'manage_orders',
      'view_inventory',
      'manage_inventory',
      'view_customers',
      'manage_customers',
      'view_reports',
      'manage_deliveries',
      'process_payments',
    ],
  } as User;
}
