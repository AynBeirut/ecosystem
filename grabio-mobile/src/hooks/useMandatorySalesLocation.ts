import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useResolvedStoreId } from './useResolvedStoreId';
import {
  captureCurrentPosition,
  ensureLocationPermission,
  hasLocationPermission,
  watchRepPosition,
  type GpsCoords,
} from '../lib/geolocation';
import { repLocationFromCoords, syncRepLiveLocation } from '../lib/crmRepLocationSync';
import { resolveMobileCrmRepId } from '../lib/crmRepResolve';
import { resolveRepDisplayName } from '../lib/crmMobileService';
import { requiresMandatorySalesLocation } from '../lib/salesLocationPolicy';

const SYNC_MIN_MS = 12_000;
const HEARTBEAT_MS = 45_000;
const PERMISSION_POLL_MS = 20_000;
const MIN_MOVE_METERS = 8;

export function useMandatorySalesLocation(): {
  required: boolean;
  ready: boolean;
  checking: boolean;
  retry: () => void;
} {
  const { user } = useAuth();
  const { storeId } = useResolvedStoreId();
  const required = requiresMandatorySalesLocation(user);
  const [ready, setReady] = useState(!required);
  const [checking, setChecking] = useState(required);
  const lastSyncAt = useRef(0);
  const lastCoords = useRef<GpsCoords | null>(null);
  const repMeta = useRef<{ repId: string; repName: string } | null>(null);
  const activateInFlight = useRef<Promise<void> | null>(null);
  const userRef = useRef(user);
  const storeIdRef = useRef(storeId);
  userRef.current = user;
  storeIdRef.current = storeId;

  const pushLocation = useCallback(async (coords: GpsCoords, force = false) => {
    const u = userRef.current;
    const sid = storeIdRef.current;
    if (!required || !u?.uid || !sid) return;
    const now = Date.now();
    const prev = lastCoords.current;
    if (prev && !force) {
      const moved =
        Math.abs(prev.lat - coords.lat) > 0.00008
        || Math.abs(prev.lng - coords.lng) > 0.00008;
      if (!moved && now - lastSyncAt.current < SYNC_MIN_MS) return;
    }
    if (!force && now - lastSyncAt.current < SYNC_MIN_MS) return;
    lastSyncAt.current = now;
    lastCoords.current = coords;

    if (!repMeta.current) {
      const repId = await resolveMobileCrmRepId({ ...u, storeId: sid });
      if (!repId) return;
      const repName = await resolveRepDisplayName(
        u.uid,
        u.teamMemberName || u.displayName || u.email || 'Rep',
      );
      repMeta.current = { repId, repName };
    }

    const { repId, repName } = repMeta.current;
    await syncRepLiveLocation(
      repLocationFromCoords(
        {
          storeId: sid,
          repId,
          userId: u.uid,
          repName,
          role: u.userRole === 'sub_manager'
            ? 'sub_manager'
            : u.userRole === 'sub_seller'
              ? 'sub_seller'
              : u.userRole || 'sales',
        },
        coords,
      ),
    ).catch((err) => {
      console.warn('[liveLocation] sync failed', err instanceof Error ? err.message : err);
    });
  }, [required]);

  const activate = useCallback(async () => {
    if (!required) {
      setReady(true);
      setChecking(false);
      return;
    }
    if (activateInFlight.current) {
      await activateInFlight.current;
      return;
    }

    const run = async () => {
      try {
        const already = await hasLocationPermission();
        if (!already) setChecking(true);

        const allowed = await ensureLocationPermission(true);
        if (!allowed) {
          setReady(false);
          return;
        }

        setReady(true);
        void captureCurrentPosition()
          .then((coords) => pushLocation(coords, true))
          .catch(() => undefined);
      } finally {
        setChecking(false);
        activateInFlight.current = null;
      }
    };

    activateInFlight.current = run();
    await activateInFlight.current;
  }, [pushLocation, required]);

  useEffect(() => {
    repMeta.current = null;
    void activate();
  }, [activate, user?.uid, storeId]);

  useEffect(() => {
    if (!required || !ready) return undefined;
    const stop = watchRepPosition((coords) => {
      void pushLocation(coords);
    }, undefined, { distanceFilter: MIN_MOVE_METERS });
    const heartbeat = setInterval(() => {
      void captureCurrentPosition()
        .then((coords) => pushLocation(coords, true))
        .catch(() => undefined);
    }, HEARTBEAT_MS);
    return () => {
      stop();
      clearInterval(heartbeat);
    };
  }, [pushLocation, ready, required]);

  useEffect(() => {
    if (!required) return undefined;

    const syncWhenGranted = async () => {
      if (AppState.currentState !== 'active') return;
      const ok = await hasLocationPermission();
      if (ok) {
        setReady(true);
        setChecking(false);
        void captureCurrentPosition()
          .then((coords) => pushLocation(coords, true))
          .catch(() => undefined);
        return;
      }
      if (!activateInFlight.current) {
        setReady(false);
        await activate();
      }
    };

    const onState = (state: AppStateStatus) => {
      if (state === 'active') void syncWhenGranted();
    };
    const sub = AppState.addEventListener('change', onState);
    const poll = setInterval(() => {
      void syncWhenGranted();
    }, PERMISSION_POLL_MS);

    void syncWhenGranted();

    return () => {
      sub.remove();
      clearInterval(poll);
    };
  }, [activate, required, pushLocation]);

  return { required, ready, checking, retry: activate };
}
