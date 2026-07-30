import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, Loader2, MapPin, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import {
  fetchActivities,
  fetchCrmClients,
  fetchCrmReps,
  type CrmClient,
} from '@/lib/crmService';
import {
  computeDistrictCoverage,
  computeRepDailyMetrics,
} from '@/lib/crmVisitMetrics';
import type { CrmRep } from '@/types/crm';

const CrmPerformance: React.FC = () => {
  const { user } = useAuth();
  const storeId = getActualStoreId(user);
  const [loading, setLoading] = useState(true);
  const [reps, setReps] = useState<CrmRep[]>([]);
  const [clients, setClients] = useState<CrmClient[]>([]);
  const [activities, setActivities] = useState<Awaited<ReturnType<typeof fetchActivities>>>([]);

  const load = useCallback(async () => {
    if (!storeId) {
      setReps([]);
      setClients([]);
      setActivities([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [repList, clientList, actList] = await Promise.all([
        fetchCrmReps(storeId),
        fetchCrmClients(storeId, { crmOnly: true }),
        fetchActivities(storeId, undefined, 2000),
      ]);
      setReps(repList);
      setClients(clientList);
      setActivities(actList);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const repMetrics = useMemo(() => {
    return reps.map((rep) => {
      const assigned = clients.filter((c) => c.assignedRepId === rep.id);
      return computeRepDailyMetrics(rep, assigned, activities);
    });
  }, [reps, clients, activities]);

  const districtMetrics = useMemo(
    () => computeDistrictCoverage(clients, activities),
    [clients, activities],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-xl font-semibold">Morning dashboard</h2>
          <p className="text-sm text-muted-foreground">Today&apos;s rep coverage and weekly district gaps</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Sales reps — today
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
