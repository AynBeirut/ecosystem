import type { CrmActivity, CrmRep } from '@/types/crm';
import type { CrmClient } from '@/lib/crmService';

export function startOfDayMs(d = new Date()): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

export function endOfDayMs(d = new Date()): number {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x.getTime();
}

export function weekStartMs(d = new Date()): number {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

export function isCompletedVisit(a: CrmActivity): boolean {
  if (a.type !== 'visit') return false;
  return a.visitCompleted === true || (a.visitCompleted == null && a.result !== 'no_answer');
}

export function visitOnDate(a: CrmActivity, dayMs: number): boolean {
  const t = new Date(a.loggedAt).getTime();
  return t >= dayMs && t <= endOfDayMs(new Date(dayMs));
}

export function visitInRange(a: CrmActivity, fromMs: number, toMs: number): boolean {
  const t = new Date(a.loggedAt).getTime();
  return t >= fromMs && t <= toMs;
}

export type RepDailyMetrics = {
  rep: CrmRep;
  target: number;
  visited: number;
  remaining: number;
  coveragePct: number;
  orders: number;
  noOrders: number;
};

export function computeRepDailyMetrics(
  rep: CrmRep,
  assignedClients: CrmClient[],
  activities: CrmActivity[],
  day = new Date(),
): RepDailyMetrics {
  const dayStart = startOfDayMs(day);
  const dayEnd = endOfDayMs(day);
  const activeAssigned = assignedClients.filter(
    (c) => c.status !== 'inactive' && c.crmEnabled !== false,
  );
  const target = rep.dailyVisitTarget ?? activeAssigned.length;

  const todayVisits = activities.filter(
    (a) =>
      a.repId === rep.id &&
      a.type === 'visit' &&
      isCompletedVisit(a) &&
      visitInRange(a, dayStart, dayEnd),
  );
  const visitedCustomerIds = new Set(todayVisits.map((a) => a.customerId));
  const visited = visitedCustomerIds.size;
  const orders = todayVisits.filter((a) => a.orderTaken === true).length;
  const noOrders = visited - orders;
  const remaining = Math.max(0, target - visited);
  const coveragePct = target > 0 ? Math.round((visited / target) * 100) : 0;

  return { rep, target, visited, remaining, coveragePct, orders, noOrders };
}

export type DistrictCoverageMetrics = {
  district: string;
  totalCustomers: number;
  visitedThisWeek: number;
  notVisited: number;
  coveragePct: number;
};

export function computeDistrictCoverage(
  clients: CrmClient[],
  activities: CrmActivity[],
  day = new Date(),
): DistrictCoverageMetrics[] {
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

  const weekVisitsByCustomer = new Map<string, boolean>();
  for (const a of activities) {
    if (a.type !== 'visit' || !isCompletedVisit(a)) continue;
    if (!visitInRange(a, weekStart, nowMs)) continue;
    weekVisitsByCustomer.set(a.customerId, true);
  }

  return Array.from(byDistrict.entries())
    .map(([district, districtClients]) => {
      const totalCustomers = districtClients.length;
      const visitedThisWeek = districtClients.filter((c) => weekVisitsByCustomer.has(c.id)).length;
      const notVisited = totalCustomers - visitedThisWeek;
      const coveragePct =
        totalCustomers > 0 ? Math.round((visitedThisWeek / totalCustomers) * 100) : 0;
      return { district, totalCustomers, visitedThisWeek, notVisited, coveragePct };
    })
    .sort((a, b) => a.district.localeCompare(b.district));
}

export type CustomerVisitStatus = 'visited_today' | 'visited_this_week' | 'not_visited';

export function customerVisitStatus(
  customerId: string,
  activities: CrmActivity[],
  day = new Date(),
): CustomerVisitStatus {
  const dayStart = startOfDayMs(day);
  const weekStart = weekStartMs(day);
  const nowMs = endOfDayMs(day);

  let visitedToday = false;
  let visitedWeek = false;

  for (const a of activities) {
    if (a.customerId !== customerId || a.type !== 'visit' || !isCompletedVisit(a)) continue;
    const t = new Date(a.loggedAt).getTime();
    if (t >= dayStart && t <= nowMs) visitedToday = true;
    if (t >= weekStart && t <= nowMs) visitedWeek = true;
  }

  if (visitedToday) return 'visited_today';
  if (visitedWeek) return 'visited_this_week';
  return 'not_visited';
}
