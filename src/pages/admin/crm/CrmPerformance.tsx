import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import type { StoreProfile } from '@/types/storeProfile';
import {
  fetchActivities,
  fetchCrmClients,
  fetchCrmReps,
  type CrmClient,
} from '@/lib/crmService';
import { daysSinceLastActivity } from '@/lib/crmService';
import { crmConversionRate, DEFAULT_CRM_SETTINGS } from '@/lib/crm';
import type { CrmRep } from '@/types/crm';

function weekStartMs(d = new Date()): number {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function monthStartMs(d = new Date()): number {
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

const CrmPerformance: React.FC = () => {
  const { user } = useAuth();
  const storeId = getActualStoreId(user);
  const [loading, setLoading] = useState(true);
  const [reps, setReps] = useState<CrmRep[]>([]);
  const [clients, setClients] = useState<CrmClient[]>([]);
  const [activitiesCache, setActivitiesCache] = useState<Awaited<ReturnType<typeof fetchActivities>>>([]);
  const [alertDays, setAlertDays] = useState(DEFAULT_CRM_SETTINGS.noContactAlertDays);

  const load = useCallback(async () => {
    if (!storeId) {
      setReps([]);
      setClients([]);
      setActivitiesCache([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const db = getFirestore();
      const profileSnap = await getDoc(doc(db, 'storeProfiles', storeId));
      const profile = profileSnap.exists() ? (profileSnap.data() as StoreProfile) : null;
      const days =
        profile?.crmSettings?.noContactAlertDays ?? DEFAULT_CRM_SETTINGS.noContactAlertDays;
      setAlertDays(days);

      const [repList, clientList, activities] = await Promise.all([
        fetchCrmReps(storeId),
        fetchCrmClients(storeId, { crmOnly: true }),
        fetchActivities(storeId, undefined, 600),
      ]);
      setReps(repList);
      setClients(clientList);
      setActivitiesCache(activities);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const repRows = useMemo(() => {
    const nowMs = Date.now();
    const w0 = weekStartMs();
    const m0 = monthStartMs();
    return reps.map((rep) => {
      const assigned = clients.filter((c) => c.assignedRepId === rep.id && c.crmEnabled);
      const totalAssigned = assigned.length;
      const closedCount = assigned.filter((c) => c.pipelineStage === 'closed').length;
      const conversion = crmConversionRate(closedCount, totalAssigned);

      const visitWeek = activitiesCache.filter(
        (a) =>
          a.repId === rep.id &&
          a.type === 'visit' &&
          new Date(a.loggedAt).getTime() >= w0 &&
          new Date(a.loggedAt).getTime() <= nowMs,
      ).length;

      const visitMonth = activitiesCache.filter(
        (a) =>
          a.repId === rep.id &&
          a.type === 'visit' &&
          new Date(a.loggedAt).getTime() >= m0 &&
          new Date(a.loggedAt).getTime() <= nowMs,
      ).length;

      return {
        rep,
        visitWeek,
        visitMonth,
        closedCount,
        totalAssigned,
        conversion,
      };
    });
  }, [reps, clients, activitiesCache]);

  const staleClients = useMemo(() => {
    const threshold = alertDays;
    return clients.filter((c) => {
      if (!c.crmEnabled) return false;
      const days = daysSinceLastActivity(c);
      if (days === null) return true;
      return days >= threshold;
    });
  }, [clients, alertDays]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-semibold">Rep performance</h2>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Per-rep metrics</CardTitle>
              <CardDescription>
                Visit counts use activities where type is visit. Conversion uses CRM-enabled clients assigned
                to the rep: closed ÷ assigned ({alertDays}-day stale rule below uses store CRM settings).
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rep</TableHead>
                    <TableHead className="text-right">Visits (week)</TableHead>
                    <TableHead className="text-right">Visits (month)</TableHead>
                    <TableHead className="text-right">Closed / assigned</TableHead>
                    <TableHead className="text-right">Conversion %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No CRM reps yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    repRows.map((row) => (
                      <TableRow key={row.rep.id}>
                        <TableCell className="font-medium">{row.rep.name}</TableCell>
                        <TableCell className="text-right">{row.visitWeek}</TableCell>
                        <TableCell className="text-right">{row.visitMonth}</TableCell>
                        <TableCell className="text-right">
                          {row.closedCount} / {row.totalAssigned}
                        </TableCell>
                        <TableCell className="text-right">{row.conversion}%</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-900">
                <AlertTriangle className="h-5 w-5" />
                Stale clients (no contact in {alertDays}+ days)
              </CardTitle>
              <CardDescription>
                Based on <code className="text-xs">lastActivityAt</code> or clients with no logged activity yet.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {staleClients.length === 0 ? (
                <p className="text-sm text-muted-foreground">No stale CRM clients.</p>
              ) : (
                <ul className="divide-y rounded-md border bg-white">
                  {staleClients.map((c) => {
                    const days = daysSinceLastActivity(c);
                    return (
                      <li key={c.id} className="flex items-center justify-between px-4 py-2 text-sm">
                        <span className="font-medium">{c.name || c.id}</span>
                        <Badge variant="secondary">
                          {days === null ? 'No activity' : `${days}d since contact`}
                        </Badge>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default CrmPerformance;
