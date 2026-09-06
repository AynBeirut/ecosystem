import type { CrmClient } from './crmMobileService';
import { clientAreaOrDistrict } from './crmCustomerPhone';

export type CrmActivityRow = {
  id?: string;
  customerId: string;
  repId: string;
  repName?: string;
  type: string;
  loggedAt: string;
  visitCompleted?: boolean;
  result?: string;
  orderTaken?: boolean;
};

export type CrmRepRow = {
  id: string;
  name: string;
  dailyVisitTarget?: number;
  assignedTerritory?: string;
};

function startOfDayMs(d = new Date()): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function endOfDayMs(d = new Date()): number {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x.getTime();
}

function weekStartMs(d = new Date()): number {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

export function isCompletedVisit(a: CrmActivityRow): boolean {
  if (a.type !== 'visit') return false;
  return a.visitCompleted === true || (a.visitCompleted == null && a.result !== 'no_answer');
}

export function visitInRange(a: CrmActivityRow, fromMs: number, toMs: number): boolean {
  const t = new Date(a.loggedAt).getTime();
  return t >= fromMs && t <= toMs;
}

export function filterClientsForPerformance(
  clients: CrmClient[],
  opts: {
    area?: string;
    routeStopIds?: Set<string>;
    clientId?: string;
    repId?: string;
  },
): CrmClient[] {
  return clients.filter((c) => {
    if (c.status === 'inactive' || c.crmEnabled === false) return false;
    if (opts.repId && opts.repId !== 'all' && c.assignedRepId !== opts.repId) return false;
    if (opts.area && opts.area !== 'all') {
      const label = clientAreaOrDistrict(c);
      if (label !== opts.area) return false;
    }
    if (opts.routeStopIds && !opts.routeStopIds.has(c.id)) return false;
    if (opts.clientId && opts.clientId !== 'all' && c.id !== opts.clientId) return false;
    return true;
  });
}

export function filterActivitiesForDay(
  activities: CrmActivityRow[],
  day: Date,
  clientIds?: Set<string>,
): CrmActivityRow[] {
  const dayStart = startOfDayMs(day);
  const dayEnd = endOfDayMs(day);
  return activities.filter((a) => {
    if (clientIds && !clientIds.has(a.customerId)) return false;
    return visitInRange(a, dayStart, dayEnd);
  });
}

export type VisitedClientRow = {
  client: CrmClient;
  visitAt: string;
  repName?: string;
  orderTaken?: boolean;
};

export function listVisitedClientsOnDay(
  clients: CrmClient[],
  activities: CrmActivityRow[],
  day: Date,
): VisitedClientRow[] {
  const dayStart = startOfDayMs(day);
  const dayEnd = endOfDayMs(day);
  const byClient = new Map<string, { visitAt: string; repName?: string; orderTaken?: boolean }>();
  for (const a of activities) {
    if (a.type !== 'visit' || !isCompletedVisit(a)) continue;
    if (!visitInRange(a, dayStart, dayEnd)) continue;
    const existing = byClient.get(a.customerId);
    if (!existing || new Date(a.loggedAt).getTime() > new Date(existing.visitAt).getTime()) {
      byClient.set(a.customerId, {
        visitAt: a.loggedAt,
        repName: a.repName,
        orderTaken: a.orderTaken,
      });
    }
  }
  const clientById = new Map(clients.map((c) => [c.id, c]));
  return [...byClient.entries()]
    .map(([customerId, meta]) => {
      const client = clientById.get(customerId);
      if (!client) return null;
      return { client, ...meta };
    })
    .filter((row): row is VisitedClientRow => row != null)
    .sort((a, b) => new Date(b.visitAt).getTime() - new Date(a.visitAt).getTime());
}

export function computeRepDailyMetrics(
  rep: CrmRepRow,
  assignedClients: CrmClient[],
  activities: CrmActivityRow[],
  day = new Date(),
) {
  const dayStart = startOfDayMs(day);
  const dayEnd = endOfDayMs(day);
  const activeAssigned = assignedClients.filter((c) => c.status !== 'inactive' && c.crmEnabled !== false);
  const target = rep.dailyVisitTarget ?? activeAssigned.length;
  const todayVisits = activities.filter(
    (a) => a.repId === rep.id && a.type === 'visit' && isCompletedVisit(a) && visitInRange(a, dayStart, dayEnd),
  );
  const visited = new Set(todayVisits.map((a) => a.customerId)).size;
  const orders = todayVisits.filter((a) => a.orderTaken === true).length;
  return {
    rep,
    target,
    visited,
    remaining: Math.max(0, target - visited),
    coveragePct: target > 0 ? Math.round((visited / target) * 100) : 0,
    orders,
    noOrders: visited - orders,
  };
}

export function computeDistrictCoverage(clients: CrmClient[], activities: CrmActivityRow[], day = new Date()) {
  const weekStart = weekStartMs(day);
  const nowMs = endOfDayMs(day);
  const active = clients.filter((c) => c.status !== 'inactive' && c.crmEnabled !== false);
  const byDistrict = new Map<string, CrmClient[]>();
  for (const c of active) {
    const district = (c.district || 'Unassigned').trim() || 'Unassigned';
    const list = byDistrict.get(district) ?? [];
    list.push(c);
    byDistrict.set(district, list);
  }
  const weekVisits = new Set<string>();
  for (const a of activities) {
    if (a.type !== 'visit' || !isCompletedVisit(a)) continue;
    if (!visitInRange(a, weekStart, nowMs)) continue;
    weekVisits.add(a.customerId);
  }
  return Array.from(byDistrict.entries())
    .map(([district, districtClients]) => {
      const totalCustomers = districtClients.length;
      const visitedThisWeek = districtClients.filter((c) => weekVisits.has(c.id)).length;
      return {
        district,
        totalCustomers,
        visitedThisWeek,
        notVisited: totalCustomers - visitedThisWeek,
        coveragePct: totalCustomers > 0 ? Math.round((visitedThisWeek / totalCustomers) * 100) : 0,
      };
    })
    .sort((a, b) => a.district.localeCompare(b.district));
}

export function computeAreaCoverage(clients: CrmClient[], activities: CrmActivityRow[], day = new Date()) {
  const weekStart = weekStartMs(day);
  const nowMs = endOfDayMs(day);
  const active = clients.filter((c) => c.status !== 'inactive' && c.crmEnabled !== false);
  const byArea = new Map<string, CrmClient[]>();
  for (const c of active) {
    const area = clientAreaOrDistrict(c) || 'Unassigned';
    const list = byArea.get(area) ?? [];
    list.push(c);
    byArea.set(area, list);
  }
  const weekVisits = new Set<string>();
  for (const a of activities) {
    if (a.type !== 'visit' || !isCompletedVisit(a)) continue;
    if (!visitInRange(a, weekStart, nowMs)) continue;
    weekVisits.add(a.customerId);
  }
  return Array.from(byArea.entries())
    .map(([area, areaClients]) => {
      const totalCustomers = areaClients.length;
      const visitedThisWeek = areaClients.filter((c) => weekVisits.has(c.id)).length;
      return {
        area,
        totalCustomers,
        visitedThisWeek,
        notVisited: totalCustomers - visitedThisWeek,
        coveragePct: totalCustomers > 0 ? Math.round((visitedThisWeek / totalCustomers) * 100) : 0,
      };
    })
    .sort((a, b) => a.area.localeCompare(b.area));
}

export function formatLastVisit(date?: string | null): string {
  if (!date) return 'Never';
  try {
    return new Date(date).toLocaleDateString();
  } catch {
    return '—';
  }
}
