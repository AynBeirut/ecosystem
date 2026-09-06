import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import type { CrmActivityResult } from '@/types/crm';
import type { CrmClient } from '@/lib/crmService';
import { logCrmActivity } from '@/lib/crmService';
import { applyRouteVisitScheduleToCustomers } from '@/lib/crmVisitScheduleService';

export type VisitRouteRepeat = 'none' | 'weekly' | 'every_15_days' | 'monthly';

export type VisitRouteStop = {
  clientId: string;
  clientName: string;
  sortOrder: number;
  district?: string | null;
  area?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export type CrmVisitRoute = {
  id: string;
  storeId: string;
  title: string;
  assignedRepId: string;
  assignedRepName: string;
  assignedUserId?: string;
  visitDate: string;
  repeatRule: VisitRouteRepeat;
  stops: VisitRouteStop[];
  occurrenceCompletions: Record<string, Record<string, string>>;
  status: 'active' | 'archived';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export function toDateYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setHours(12, 0, 0, 0);
  return dt;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysBetween(a: Date, b: Date): number {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(ms / 86400000);
}

function sameMonthDay(a: Date, b: Date): boolean {
  return a.getDate() === b.getDate();
}

export function routeMatchesDate(route: CrmVisitRoute, targetYmd: string): boolean {
  if (route.visitDate === targetYmd) return true;
  if (!route.repeatRule || route.repeatRule === 'none') return false;

  const anchor = parseDateYmd(route.visitDate);
  const target = parseDateYmd(targetYmd);
  if (target < startOfDay(anchor)) return false;

  const diff = daysBetween(anchor, target);
  if (route.repeatRule === 'weekly') return diff > 0 && diff % 7 === 0;
  if (route.repeatRule === 'every_15_days') return diff > 0 && diff % 15 === 0;
  if (route.repeatRule === 'monthly') {
    return diff > 0 && sameMonthDay(anchor, target) && target > anchor;
  }
  return false;
}

export function stopDoneOnDate(route: CrmVisitRoute, occurrenceYmd: string, clientId: string): boolean {
  return Boolean(route.occurrenceCompletions?.[occurrenceYmd]?.[clientId]);
}

export function routeProgressOnDate(
  route: CrmVisitRoute,
  occurrenceYmd: string,
): { done: number; total: number } {
  const total = route.stops.length;
  const done = route.stops.filter((s) => stopDoneOnDate(route, occurrenceYmd, s.clientId)).length;
  return { done, total };
}

export function buildStopsFromClients(clients: CrmClient[]): VisitRouteStop[] {
  return clients.map((c, idx) => ({
    clientId: c.id,
    clientName: c.name || 'Client',
    sortOrder: idx,
    district: c.district || null,
    area: c.area || null,
    lat: c.location?.lat ?? null,
    lng: c.location?.lng ?? null,
  }));
}

const routeCache = new Map<string, { at: number; rows: CrmVisitRoute[] }>();
const ROUTE_CACHE_MS = 300_000;

export function invalidateVisitRouteCache(storeId: string): void {
  for (const key of [...routeCache.keys()]) {
    if (key === storeId || key.startsWith(`all:${storeId}`) || key.startsWith(`rep:${storeId}:`)) {
      routeCache.delete(key);
    }
  }
}

export async function fetchVisitRoutes(
  storeId: string,
  opts?: { managerView?: boolean; repIds?: string[]; assignedUserId?: string },
): Promise<CrmVisitRoute[]> {
  const managerView = Boolean(opts?.managerView);
  const cacheKey = managerView
    ? `all:${storeId}`
    : `rep:${storeId}:${(opts?.repIds || []).join('|')}:${opts?.assignedUserId || ''}`;
  const cached = routeCache.get(cacheKey);
  if (cached && Date.now() - cached.at < ROUTE_CACHE_MS) return cached.rows;

  const db = getFirestore();
  const byId = new Map<string, CrmVisitRoute>();

  try {
    if (managerView) {
      const snap = await getDocs(
        query(collection(db, 'crmVisitRoutes'), where('storeId', '==', storeId)),
      );
      snap.docs.forEach((d) => byId.set(d.id, { id: d.id, ...d.data() } as CrmVisitRoute));
    } else {
      const repIds = (opts?.repIds || []).filter(Boolean).slice(0, 10);
      const tasks = [];
      if (repIds.length > 0) {
        tasks.push(
          getDocs(
            query(
              collection(db, 'crmVisitRoutes'),
              where('storeId', '==', storeId),
              where('assignedRepId', 'in', repIds),
            ),
          ),
        );
      }
      if (opts?.assignedUserId) {
        tasks.push(
          getDocs(
            query(
              collection(db, 'crmVisitRoutes'),
              where('storeId', '==', storeId),
              where('assignedUserId', '==', opts.assignedUserId),
            ),
          ),
        );
      }
      if (tasks.length === 0) return [];
      const snaps = await Promise.allSettled(tasks);
      snaps.forEach((result) => {
        if (result.status !== 'fulfilled') {
          console.warn('[crmVisitRoutes] query rejected', result.reason);
          return;
        }
        result.value.docs.forEach((d) => byId.set(d.id, { id: d.id, ...d.data() } as CrmVisitRoute));
      });
    }
  } catch (e) {
    console.warn('[crmVisitRoutes] fetch failed', e);
    return [];
  }

  const rows = [...byId.values()]
    .filter((r) => r.status !== 'archived')
    .sort((a, b) => String(a.visitDate).localeCompare(String(b.visitDate)));
  routeCache.set(cacheKey, { at: Date.now(), rows });
  return rows;
}

export function filterRoutesForDate(
  routes: CrmVisitRoute[],
  dateYmd: string,
  repFilter?: string,
  repIds?: string[],
): CrmVisitRoute[] {
  return routes.filter((r) => {
    if (!routeMatchesDate(r, dateYmd)) return false;
    if (repIds && repIds.length > 0) {
      return repIds.includes(r.assignedRepId);
    }
    if (repFilter && repFilter !== 'all' && r.assignedRepId !== repFilter) return false;
    return true;
  });
}

export async function fetchVisitRoute(routeId: string): Promise<CrmVisitRoute | null> {
  try {
    const snap = await getDoc(doc(getFirestore(), 'crmVisitRoutes', routeId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as CrmVisitRoute;
  } catch (e) {
    const code = e && typeof e === 'object' && 'code' in e ? String((e as { code?: string }).code) : '';
    if (code.includes('permission')) throw new Error('You do not have access to this visit route.');
    throw e instanceof Error ? e : new Error('Could not load visit route');
  }
}

export function filterUpcomingRoutes(
  routes: CrmVisitRoute[],
  daysAhead = 14,
  repFilter?: string,
  repIds?: string[],
  daysBack = 14,
): Array<{ dateYmd: string; route: CrmVisitRoute }> {
  const today = parseDateYmd(toDateYmd(new Date()));
  const out: Array<{ dateYmd: string; route: CrmVisitRoute }> = [];
  for (let i = -daysBack; i <= daysAhead; i += 1) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const ymd = toDateYmd(d);
    filterRoutesForDate(routes, ymd, repFilter, repIds).forEach((route) => {
      const prog = routeProgressOnDate(route, ymd);
      const isPast = parseDateYmd(ymd) < today;
      if (isPast && prog.done >= prog.total && prog.total > 0) return;
      out.push({ dateYmd: ymd, route });
    });
  }
  return out.sort((a, b) => {
    const byDate = a.dateYmd.localeCompare(b.dateYmd);
    if (byDate !== 0) return byDate;
    return a.route.title.localeCompare(b.route.title);
  });
}

export function filterNextUpcomingRoutes(
  routes: CrmVisitRoute[],
  daysAhead = 14,
  repFilter?: string,
  repIds?: string[],
  daysBack = 14,
): Array<{ dateYmd: string; route: CrmVisitRoute }> {
  const all = filterUpcomingRoutes(routes, daysAhead, repFilter, repIds, daysBack);
  const nextByRoute = new Map<string, { dateYmd: string; route: CrmVisitRoute }>();
  for (const entry of all) {
    if (!nextByRoute.has(entry.route.id)) {
      nextByRoute.set(entry.route.id, entry);
    }
  }
  return [...nextByRoute.values()];
}

export async function updateVisitRoute(input: {
  routeId: string;
  storeId: string;
  title: string;
  assignedRepId: string;
  assignedRepName: string;
  visitDate: string;
  repeatRule: VisitRouteRepeat;
  stops: VisitRouteStop[];
  assignedUserId?: string;
}): Promise<void> {
  const now = new Date().toISOString();
  await updateDoc(doc(getFirestore(), 'crmVisitRoutes', input.routeId), {
    title: input.title.trim() || `Visit route · ${input.visitDate}`,
    assignedRepId: input.assignedRepId,
    assignedRepName: input.assignedRepName,
    ...(input.assignedUserId ? { assignedUserId: input.assignedUserId } : {}),
    visitDate: input.visitDate,
    repeatRule: input.repeatRule,
    stops: input.stops,
    updatedAt: now,
  });
  invalidateVisitRouteCache(input.storeId);

  if (input.stops.length > 0) {
    await applyRouteVisitScheduleToCustomers({
      storeId: input.storeId,
      visitDate: input.visitDate,
      stops: input.stops,
      routeId: input.routeId,
    });
  }
}

export async function createVisitRoute(input: {
  storeId: string;
  title: string;
  assignedRepId: string;
  assignedRepName: string;
  visitDate: string;
  repeatRule: VisitRouteRepeat;
  stops: VisitRouteStop[];
  createdBy: string;
  assignedUserId?: string;
}): Promise<string> {
  const now = new Date().toISOString();
  const ref = await addDoc(collection(getFirestore(), 'crmVisitRoutes'), {
    storeId: input.storeId,
    title: input.title.trim() || `Visit route · ${input.visitDate}`,
    assignedRepId: input.assignedRepId,
    assignedRepName: input.assignedRepName,
    ...(input.assignedUserId ? { assignedUserId: input.assignedUserId } : {}),
    visitDate: input.visitDate,
    repeatRule: input.repeatRule,
    stops: input.stops,
    occurrenceCompletions: {},
    status: 'active',
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  });
  invalidateVisitRouteCache(input.storeId);

  if (input.stops.length > 0) {
    await applyRouteVisitScheduleToCustomers({
      storeId: input.storeId,
      visitDate: input.visitDate,
      stops: input.stops,
      routeId: ref.id,
    });
  }

  return ref.id;
}

export async function markVisitRouteStopDone(input: {
  route: CrmVisitRoute;
  occurrenceYmd: string;
  clientId: string;
  repId: string;
  repName: string;
  userId: string;
  notes?: string;
  followUpAt?: string | null;
  result?: CrmActivityResult;
  orderTaken?: boolean;
}): Promise<void> {
  const { route, occurrenceYmd, clientId, repId, repName, userId } = input;
  const now = new Date().toISOString();
  const completions = { ...(route.occurrenceCompletions || {}) };
  const dayMap = { ...(completions[occurrenceYmd] || {}) };
  if (dayMap[clientId]) return;
  dayMap[clientId] = now;
  completions[occurrenceYmd] = dayMap;

  await updateDoc(doc(getFirestore(), 'crmVisitRoutes', route.id), {
    occurrenceCompletions: completions,
    updatedAt: now,
  });
  invalidateVisitRouteCache(route.storeId);

  const stop = route.stops.find((s) => s.clientId === clientId);
  await logCrmActivity({
    storeId: route.storeId,
    customerId: clientId,
    repId,
    repName,
    type: 'visit',
    loggedAt: now,
    result: input.result ?? 'interested',
    notes: input.notes || `Visit route: ${route.title}`,
    followUpAt: input.followUpAt ?? null,
    location: stop?.lat != null && stop?.lng != null ? { lat: stop.lat, lng: stop.lng } : null,
    visitCompleted: true,
    orderTaken: input.orderTaken ?? false,
    createdBy: userId,
    source: 'web',
  });
}

export function googleMapsDirectionsUrl(stops: VisitRouteStop[]): string | null {
  const points = stops
    .filter((s) => s.lat != null && s.lng != null)
    .map((s) => `${s.lat},${s.lng}`);
  if (points.length === 0) return null;
  if (points.length === 1) return `https://www.google.com/maps?q=${points[0]}`;
  return `https://www.google.com/maps/dir/${points.join('/')}`;
}

export const REPEAT_LABELS: Record<VisitRouteRepeat, string> = {
  none: 'One time',
  weekly: 'Weekly',
  every_15_days: 'Every 15 days',
  monthly: 'Monthly',
};
