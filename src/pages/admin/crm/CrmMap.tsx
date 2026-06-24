import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import { fetchActivities, fetchCrmReps } from '@/lib/crmService';
import type { CrmActivity } from '@/types/crm';
import { CRM_ACTIVITY_TYPE_LABELS } from '@/lib/crm';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

const CrmMap: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const storeId = getActualStoreId(user);
  const [reps, setReps] = useState<Awaited<ReturnType<typeof fetchCrmReps>>>([]);
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [repFilter, setRepFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!storeId) {
      setActivities([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [repList, actList] = await Promise.all([
        fetchCrmReps(storeId),
        fetchActivities(storeId, {
          repId: repFilter === 'all' ? undefined : repFilter,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
        }, 800),
      ]);
      setReps(repList);
      const withLoc = actList.filter(
        (a) => a.location != null && typeof a.location.lat === 'number' && typeof a.location.lng === 'number',
      );
      setActivities(withLoc);
      setSelectedId((prev) => {
        if (prev && withLoc.some((a) => a.id === prev)) return prev;
        return withLoc[0]?.id ?? null;
      });
    } catch (e) {
      toast({
        title: 'Failed to load map data',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [storeId, repFilter, fromDate, toDate, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => activities.find((a) => a.id === selectedId) ?? null,
    [activities, selectedId],
  );

  const mapSrc =
    selected?.location?.lat != null && selected?.location?.lng != null
      ? `https://maps.google.com/maps?q=${selected.location.lat},${selected.location.lng}&z=15&output=embed`
      : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MapPin className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-semibold">Visit map</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Show logged activities that include GPS coordinates.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 items-end">
          <div className="min-w-[180px]">
            <Label>Rep</Label>
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
          <div>
            <Label>From</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <Label>To</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
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
              <CardTitle className="text-base">Activities ({activities.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 min-h-0">
              {activities.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No activities with location in this range.</p>
              ) : (
                <ScrollArea className="h-[380px] lg:h-[480px]">
                  <ul className="divide-y pr-3">
                    {activities.map((a) => (
                      <li key={a.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(a.id)}
                          className={cn(
                            'w-full text-left px-4 py-3 text-sm transition-colors hover:bg-muted/60',
                            selectedId === a.id && 'bg-primary/10 border-l-2 border-primary',
                          )}
                        >
                          <div className="font-medium">{new Date(a.loggedAt).toLocaleString()}</div>
                          <div className="text-muted-foreground text-xs mt-1">
                            {a.repName} · {CRM_ACTIVITY_TYPE_LABELS[a.type]}
                          </div>
                          {a.location && (
                            <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                              {a.location.lat.toFixed(5)}, {a.location.lng.toFixed(5)}
                            </div>
                          )}
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
                {selected ? `Pin: ${selected.repName}` : 'Select an activity to preview.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 flex-1">
              {mapSrc ? (
                <iframe
                  title="Activity location map"
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
