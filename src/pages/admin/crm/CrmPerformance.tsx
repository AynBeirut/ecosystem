import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, Loader2, MapPin, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import {
  fetchActivities,
  fetchCrmClients,
  type CrmClient,
} from '@/lib/crmService';
import { fetchCrmTeamReps } from '@/lib/crmAssignableAgents';
import { fetchAllCrmStoreAreaNames } from '@/lib/crmStoreAreaService';
import {
  fetchVisitRoutes,
  type CrmVisitRoute,
} from '@/lib/crmVisitRouteService';
import {
  computeDistrictCoverage,
  computeRepDailyMetrics,
  filterActivitiesForDay,
} from '@/lib/crmVisitMetrics';
import type { CrmRep } from '@/types/crm';

function clientAreaOrDistrict(client: CrmClient): string {
  const area = (client.area || '').trim();
  if (area) return area;
  return (client.district || '').trim();
}

const CrmPerformance: React.FC = () => {
  const { user } = useAuth();
  const storeId = getActualStoreId(user);
  const [loading, setLoading] = useState(true);
  const [reps, setReps] = useState<CrmRep[]>([]);
  const [clients, setClients] = useState<CrmClient[]>([]);
  const [activities, setActivities] = useState<Awaited<ReturnType<typeof fetchActivities>>>([]);
  const [visitRoutes, setVisitRoutes] = useState<CrmVisitRoute[]>([]);
  const [storeAreaNames, setStoreAreaNames] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [repFilter, setRepFilter] = useState('all');
  const [areaFilter, setAreaFilter] = useState('all');
  const [routeFilter, setRouteFilter] = useState('all');

  const load = useCallback(async () => {
    if (!storeId) {
      setReps([]);
      setClients([]);
      setActivities([]);
      setVisitRoutes([]);
      setStoreAreaNames([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [repList, clientList, actList, routes, areaNames] = await Promise.all([
        fetchCrmTeamReps(storeId),
        fetchCrmClients(storeId, { crmOnly: true }),
        fetchActivities(storeId, undefined, 2000),
        fetchVisitRoutes(storeId),
        fetchAllCrmStoreAreaNames(storeId),
      ]);
      setReps(repList);
      setClients(clientList);
      setActivities(actList);
      setVisitRoutes(routes);
      setStoreAreaNames(areaNames);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const day = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }, [selectedDate]);

  const routeRepKey = repFilter === 'all' ? undefined : repFilter;

  const routeChipList = useMemo(() => {
    const active = visitRoutes.filter((r) => r.status !== 'archived');
    const list = routeRepKey
      ? active.filter((r) => r.assignedRepId === routeRepKey)
      : active;
    return [...list].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  }, [visitRoutes, routeRepKey]);

  const routeStopIds = useMemo(() => {
    if (routeFilter === 'all') return null;
    const route = visitRoutes.find((r) => r.id === routeFilter);
    if (!route) return new Set<string>();
    return new Set(route.stops.map((s) => s.clientId));
  }, [routeFilter, visitRoutes]);

  const areaOptions = useMemo(() => {
    const set = new Set<string>(storeAreaNames);
    clients.forEach((c) => {
      const label = clientAreaOrDistrict(c);
      if (label) set.add(label);
    });
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [clients, storeAreaNames]);

  const scopedClients = useMemo(() => {
    let rows = clients.filter((c) => c.status !== 'inactive' && c.crmEnabled !== false);
    if (repFilter !== 'all') rows = rows.filter((c) => c.assignedRepId === repFilter);
    if (areaFilter !== 'all') {
      rows = rows.filter((c) => clientAreaOrDistrict(c) === areaFilter);
    }
    if (routeStopIds) rows = rows.filter((c) => routeStopIds.has(c.id));
    return rows;
  }, [clients, repFilter, areaFilter, routeStopIds]);

  const scopedActivities = useMemo(
    () => filterActivitiesForDay(activities, day, routeStopIds || undefined),
    [activities, day, routeStopIds],
  );

  const performanceReps = useMemo(
    () => (repFilter === 'all' ? reps : reps.filter((r) => r.id === repFilter)),
    [reps, repFilter],
  );

  const repMetrics = useMemo(() => {
    return performanceReps.map((rep) => {
      const assigned = scopedClients.filter((c) => c.assignedRepId === rep.id);
      return computeRepDailyMetrics(rep, assigned, scopedActivities, day);
    });
  }, [performanceReps, scopedClients, scopedActivities, day]);

  const districtMetrics = useMemo(
    () => computeDistrictCoverage(scopedClients, scopedActivities, day),
    [scopedClients, scopedActivities, day],
  );

  useEffect(() => {
    setRouteFilter('all');
  }, [repFilter]);

  useEffect(() => {
    if (routeFilter !== 'all' && !routeChipList.some((r) => r.id === routeFilter)) {
      setRouteFilter('all');
    }
  }, [routeFilter, routeChipList]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-xl font-semibold">Morning dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Rep coverage for {day.toLocaleDateString(undefined, { dateStyle: 'medium' })}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Date, sales rep, area, and visit route — same as mobile.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 items-end">
          <div>
            <Label>Date</Label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-[180px]"
            />
          </div>
          <div className="min-w-[180px]">
            <Label>Sales rep</Label>
            <Select value={repFilter} onValueChange={setRepFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All reps</SelectItem>
                {reps.filter((r) => !r.id.startsWith('owner:')).map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[180px]">
            <Label>Area</Label>
            <Select value={areaFilter} onValueChange={setAreaFilter}>
              <SelectTrigger><SelectValue placeholder="All areas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All areas</SelectItem>
                {areaOptions.map((area) => (
                  <SelectItem key={area} value={area}>{area}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[200px]">
            <Label>Route</Label>
            <Select value={routeFilter} onValueChange={setRouteFilter}>
              <SelectTrigger><SelectValue placeholder="All routes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All routes ({routeChipList.length})</SelectItem>
                {routeChipList.map((route) => (
                  <SelectItem key={route.id} value={route.id}>
                    {route.title || 'Unnamed route'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Sales reps — selected day
            </h3>
            {repMetrics.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">No CRM reps yet.</CardContent></Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {repMetrics.map((m) => (
                  <Card key={m.rep.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Rep {m.rep.name}</CardTitle>
                      {m.rep.assignedTerritory ? (
                        <CardDescription>{m.rep.assignedTerritory}</CardDescription>
                      ) : null}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Today&apos;s target</p>
                          <p className="text-2xl font-bold">{m.target}</p>
                          <p className="text-xs text-muted-foreground">customers</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Visited</p>
                          <p className="text-2xl font-bold text-green-600">{m.visited}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Remaining</p>
                          <p className="text-xl font-semibold text-amber-600">{m.remaining}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Coverage</p>
                          <p className="text-xl font-semibold">{m.coveragePct}%</p>
                        </div>
                      </div>
                      <Progress value={m.coveragePct} className="h-2" />
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="default">Orders: {m.orders}</Badge>
                        <Badge variant="secondary">No orders: {m.noOrders}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              District coverage — this week
            </h3>
            {districtMetrics.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">No customers with districts yet.</CardContent></Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {districtMetrics.map((d) => (
                  <Card key={d.district}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">{d.district}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Customers</span>
                        <span className="font-semibold">{d.totalCustomers}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Visited this week</span>
                        <span className="font-semibold text-green-600">{d.visitedThisWeek}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Coverage</span>
                        <span className="font-semibold">{d.coveragePct}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Not visited</span>
                        <span className="font-semibold text-red-600">{d.notVisited}</span>
                      </div>
                      <Progress value={d.coveragePct} className="h-2 mt-2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default CrmPerformance;
