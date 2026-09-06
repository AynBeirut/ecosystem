import type { CrmRepLiveLocation } from '@/lib/crmService';

const LIVE_FRESH_MS = 3 * 60 * 1000;
const LIVE_STALE_MS = 12 * 60 * 60 * 1000;

export function liveLocationAgeMs(updatedAtIso?: string): number | null {
  if (!updatedAtIso) return null;
  const t = new Date(updatedAtIso).getTime();
  if (!Number.isFinite(t)) return null;
  return Date.now() - t;
}

export function formatLiveLocationAge(updatedAtIso?: string): string {
  const age = liveLocationAgeMs(updatedAtIso);
  if (age == null) return 'Unknown';
  if (age < 60_000) return 'Live now';
  if (age < 3_600_000) return `${Math.round(age / 60_000)}m ago`;
  return `${Math.round(age / 3_600_000)}h ago`;
}

export function isLiveLocationFresh(updatedAtIso?: string): boolean {
  const age = liveLocationAgeMs(updatedAtIso);
  return age != null && age <= LIVE_FRESH_MS;
}

export function isLiveLocationVisible(updatedAtIso?: string): boolean {
  const age = liveLocationAgeMs(updatedAtIso);
  return age != null && age <= LIVE_STALE_MS;
}

export function isManagerLiveRole(role?: string): boolean {
  return role === 'sub_manager' || role === 'manager';
}

export function filterLiveRepsForViewer(
  reps: CrmRepLiveLocation[],
  viewerRole = 'owner',
): CrmRepLiveLocation[] {
  const visible = reps.filter((r) => isLiveLocationVisible(r.updatedAtIso));
  if (viewerRole === 'owner' || viewerRole === 'admin') return visible;
  return visible.filter(
    (r) => r.role === 'sub_seller' || r.role === 'crm_rep' || r.role === 'sales',
  );
}

export function liveRepMatchesFilter(
  rep: Pick<CrmRepLiveLocation, 'repId' | 'userId'>,
  filterId?: string,
  extraIds: string[] = [],
): boolean {
  if (!filterId || filterId === 'all') return true;
  const keys = new Set<string>([rep.repId, rep.userId, `user:${rep.userId}`, ...extraIds]);
  return keys.has(filterId);
}

export function liveRepMatchesAnyFilter(
  rep: Pick<CrmRepLiveLocation, 'repId' | 'userId'>,
  filterIds: string[],
): boolean {
  if (!filterIds.length) return true;
  return filterIds.some((id) => liveRepMatchesFilter(rep, id));
}
