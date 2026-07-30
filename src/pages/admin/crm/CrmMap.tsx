import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import { fetchActivities, fetchCrmClients, fetchCrmReps, type CrmClient } from '@/lib/crmService';
import { customerVisitStatus } from '@/lib/crmVisitMetrics';
import { CRM_CUSTOMER_TYPE_LABELS, CRM_VISIT_STATUS_COLORS } from '@/lib/crm';
import type { CrmCustomerType } from '@/types/crm';
import CrmLocationFilters, {
  crmEmptyLocationFilter,
  crmMatchesLocationFilter,
} from '@/components/crm/CrmLocationFilters';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

const STATUS_LABELS = {
  visited_today: 'Visited today',
  visited_this_week: 'Visited this week',
  not_visited: 'Not visited',
} as const;

const CrmMap: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const storeId = getActualStoreId(user);
  const [reps, setReps] = useState<Awaited<ReturnType<typeof fetchCrmReps>>>([]);
  const [clients, setClients] = useState<CrmClient[]>([]);
  const [activities, setActivities] = useState<Awaited<ReturnType<typeof fetchActivities>>>([]);
  const [loading, setLoading] = useState(true);
  const [repFilter, setRepFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState(crmEmptyLocationFilter());
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!storeId) {
      setClients([]);
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
    } catch (e) {
      toast({
        title: 'Failed to load map data',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [storeId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const extraGovernorates = useMemo(() => {
    const set = new Set<string>();
    for (const c of clients) if (c.district?.trim()) set.add(c.district.trim());
    return Array.from(set);
  }, [clients]);

  const extraAreas = useMemo(() => {
    const set = new Set<string>();
    for (const c of clients) if (c.area?.trim()) set.add(c.area.trim());
    return Array.from(set);
  }, [clients]);

  const mappedClients = useMemo(() => {
    return clients
      .filter((c) => c.location?.lat != null && c.location?.lng != null)
      .filter((c) => {
        if (repFilter !== 'all' && c.assignedRepId !== repFilter) return false;
        if (!crmMatchesLocationFilter(c, locationFilter)) return false;
        if (typeFilter !== 'all' && (c.customerType || '') !== typeFilter) return false;
        return c.status !== 'inactive';
      })
      .map((c) => ({
        client: c,
        status: customerVisitStatus(c.id, activities),
      }));
  }, [clients, activities, repFilter, locationFilter, typeFilter]);

  useEffect(() => {
    if (mappedClients.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !mappedClients.some((m) => m.client.id === selectedId)) {
      setSelectedId(mappedClients[0].client.id);
    }
  }, [mappedClients, selectedId]);

  const selected = useMemo(
    () => mappedClients.find((m) => m.client.id === selectedId) ?? null,
    [mappedClients, selectedId],
  );

  const mapSrc =
    selected?.client.location?.lat != null && selected?.client.location?.lng != null
      ? `https://maps.google.com/maps?q=${selected.client.location.lat},${selected.client.location.lng}&z=15&output=embed`
      : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-sm text-foreground">
        {(Object.keys(STATUS_LABELS) as Array<keyof typeof STATUS_LABELS>).map((key) => (
          <span key={key} className="flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: CRM_VISIT_STATUS_COLORS[key] }}
            />
            {STATUS_LABELS[key]}
          </span>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Customers with GPS, colour-coded by visit status.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CrmLocationFilters
            value={locationFilter}
            onChange={setLocationFilter}
            extraGovernorates={extraGovernorates}
            extraAreas={extraAreas}
          />
          <div className="flex flex-wrap gap-4 items-end pt-1 border-t">
          <div className="min-w-[180px]">
            <Label>Sales rep</Label>
            <Select value={repFilter} onValueChange={setRepFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All reps</SelectItem>
                {reps.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[160px]">
            <Label>Customer type</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {Object.entries(CRM_CUSTOMER_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[420px]">
          <Card className="overflow-hidden flex flex-col">
            <CardHeader className="py-3">
              <CardTitle className="text-base">Customers ({mappedClients.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 min-h-0">
              {mappedClients.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No customers with GPS match filters.</p>
              ) : (
                <ScrollArea className="h-[380px] lg:h-[480px]">
                  <ul className="divide-y pr-3">
                    {mappedClients.map(({ client: c, status }) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(c.id)}
                          className={cn(
                            'w-full text-left px-4 py-3 text-sm transition-colors hover:bg-muted/60',
                            selectedId === c.id && 'bg-primary/10 border-l-2 border-primary',
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: CRM_VISIT_STATUS_COLORS[status] }}
                            />
                            <span className="font-medium">{c.name || c.id}</span>
                          </div>
                          <div className="text-muted-foreground text-xs mt-1 ml-5">
                            {[c.country, c.district, c.area].filter(Boolean).join(' · ') || '—'}
                            {c.customerType && c.customerType in CRM_CUSTOMER_TYPE_LABELS ? (
                              <> · {CRM_CUSTOMER_TYPE_LABELS[c.customerType as CrmCustomerType]}</>
                            ) : null}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden flex flex-col">
            <CardHeader className="py-3">
              <CardTitle className="text-base">Map</CardTitle>
              <CardDescription>
                {selected ? (
                  <span className="flex items-center gap-2 flex-wrap">
                    {selected.client.name}
                    <Badge variant="outline">{STATUS_LABELS[selected.status]}</Badge>
                  </span>
                ) : 'Select a customer to preview.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 flex-1">
              {mapSrc ? (
                <iframe
                  title="Customer location map"
                  src={mapSrc}
                  className="w-full h-[380px] lg:h-[480px] border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : (
                <div className="h-[380px] lg:h-[480px] flex items-center justify-center text-muted-foreground text-sm bg-muted/20">
                  No location selected
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default CrmMap;
