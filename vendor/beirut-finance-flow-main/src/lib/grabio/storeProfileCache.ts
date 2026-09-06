import type { GrabioStoreProfile } from './types';

const profileCache = new Map<string, GrabioStoreProfile>();

export function peekCachedGrabioStoreProfile(storeId: string | null | undefined): GrabioStoreProfile | null {
  if (!storeId) return null;
  return profileCache.get(storeId) ?? null;
}

export function setCachedGrabioStoreProfile(storeId: string, profile: GrabioStoreProfile): void {
  profileCache.set(storeId, profile);
}

export function clearCachedGrabioStoreProfile(storeId: string): void {
  profileCache.delete(storeId);
}
