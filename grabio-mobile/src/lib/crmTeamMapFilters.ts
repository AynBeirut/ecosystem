import type { CrmActivityRow } from './crmVisitMetrics';
import type { CrmClient } from './crmMobileService';
import type { CrmVisitRoute } from './crmVisitRouteService';
import { filterRoutesForDate, toDateYmd } from './crmVisitRouteService';
import {
  clientMapStatus,
  clientMatchesCustomerDate,
  matchesRepeatFilter,
  type CustomerDateMode,
  type MapPeriod,
  type RepeatFilter,
} from './crmMapUtils';

export type MapClientRow = {
  client: CrmClient;
  mapStatus: ReturnType<typeof clientMapStatus>;
  hasGps: boolean;
  onVisitDate: boolean;
};

export function resolveCustomerDate(mode: CustomerDateMode, pickDate: Date | null): Date {
  if (mode === 'today') return new Date();
  if (mode === 'yesterday') {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d;
  }
  return pickDate || new Date();
}

export function formatCustomerDateLabel(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function periodChipLabel(period: MapPeriod, customerDate: Date): string {
  const ymd = toDateYmd(customerDate);
  const todayYmd = toDateYmd(new Date());
  const short = customerDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  if (period === 'day') return ymd === todayYmd ? 'Today' : `Day · ${short}`;
  if (period === 'week') return ymd === todayYmd ? 'This week' : `Week · ${short}`;
  return ymd === todayYmd ? 'This month' : `Month · ${short}`;
}

export function repeatChipLabel(repeat: RepeatFilter, customerDate: Date): string {
  const ymd = toDateYmd(customerDate);
  const todayYmd = toDateYmd(new Date());
  if (repeat === 'all') return 'All clients';
  if (repeat === 'due') return ymd === todayYmd ? 'Due today' : 'Due on date';
  return 'Overdue visit';
}

export function routesOnDate(
  routes: CrmVisitRoute[],
  dateYmd: string,
  repFilter?: string,
  repIds?: string[],
): CrmVisitRoute[] {
  const repKey = repFilter && repFilter !== 'all' && repFilter !== 'me' ? repFilter : undefined;
  return filterRoutesForDate(routes, dateYmd, repKey, repIds);
}

export function routeStopIdsForDate(
  routes: CrmVisitRoute[],
  dateYmd: string,
  repFilter?: string,
  repIds?: string[],
  routeId?: string,
): Set<string> {
  const ids = new Set<string>();
  routesOnDate(routes, dateYmd, repFilter, repIds)
    .filter((r) => !routeId || routeId === 'all' || r.id === routeId)
    .forEach((route) => {
      route.stops.forEach((s) => ids.add(s.clientId));
    });
  return ids;
}

export function filterClientsByRep(
  clients: CrmClient[],
  repFilter: string,
  myRepId: string | null,
): CrmClient[] {
  if (repFilter === 'all') return clients;
  if (repFilter === 'me' && myRepId) {
    return clients.filter((c) => c.assignedRepId === myRepId);
  }
  if (repFilter !== 'me') {
    return clients.filter((c) => c.assignedRepId === repFilter);
  }
  return clients;
}

export function buildMapClientRows(input: {
  clients: CrmClient[];
  activities: CrmActivityRow[];
  customerDate: Date;
  customerDateYmd: string;
  period: MapPeriod;
  repeatFilter: RepeatFilter;
  pipelineFilter: string;
  routeStopIds: Set<string>;
  routeFilter: string;
  visitDateOnly: boolean;
}): MapClientRow[] {
  const {
    clients,
    activities,
    customerDate,
    customerDateYmd,
    period,
    repeatFilter,
    pipelineFilter,
    routeStopIds,
    routeFilter,
    visitDateOnly,
  } = input;

  const allRouteStopIds = routeFilter === 'all' ? routeStopIds : routeStopIds;

  return clients
    .filter((c) => c.status !== 'inactive')
    .filter((c) => {
      if (routeFilter !== 'all' && !routeStopIds.has(c.id)) return false;
      return true;
    })
    .filter((c) => matchesRepeatFilter(c, repeatFilter, customerDate))
    .filter((c) => {
      if (!visitDateOnly) return true;
      return clientMatchesCustomerDate(c, activities, customerDateYmd, allRouteStopIds);
    })
    .filter((c) => pipelineFilter === 'all' || (c.pipelineStage || 'new_lead') === pipelineFilter)
    .map((c) => ({
      client: c,
      mapStatus: clientMapStatus(c, activities, period, customerDate),
      hasGps: c.location?.lat != null && c.location?.lng != null,
      onVisitDate: clientMatchesCustomerDate(c, activities, customerDateYmd, allRouteStopIds),
    }))
    .sort((a, b) => {
      const rank = (s: string) => (s === 'overdue' ? 0 : s === 'due' ? 1 : s === 'pending' ? 2 : 3);
      return rank(a.mapStatus) - rank(b.mapStatus);
    });
}

export function pipelineStageCounts(
  clients: CrmClient[],
  activities: CrmActivityRow[],
  customerDate: Date,
  customerDateYmd: string,
  period: MapPeriod,
  repeatFilter: RepeatFilter,
  routeStopIds: Set<string>,
  routeFilter: string,
  visitDateOnly: boolean,
): Record<string, number> {
  const rows = buildMapClientRows({
    clients,
    activities,
    customerDate,
    customerDateYmd,
    period,
    repeatFilter,
    pipelineFilter: 'all',
    routeStopIds,
    routeFilter,
    visitDateOnly,
  });
  const counts: Record<string, number> = {};
  rows.forEach(({ client }) => {
    const stage = client.pipelineStage || 'new_lead';
    counts[stage] = (counts[stage] || 0) + 1;
  });
  return counts;
}
