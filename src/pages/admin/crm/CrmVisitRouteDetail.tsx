import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/context/useAuth';
import {
  fetchVisitRoute,
  googleMapsDirectionsUrl,
  markVisitRouteStopDone,
  REPEAT_LABELS,
  routeProgressOnDate,
  stopDoneOnDate,
  toDateYmd,
  type CrmVisitRoute,
} from '@/lib/crmVisitRouteService';
import { useToast } from '@/hooks/use-toast';
import { resolveAuthActorId } from '@/lib/authActorId';
import { cn } from '@/lib/utils';

const CrmVisitRouteDetail: React.FC = () => {
  const location = useLocation();
  const detailMatch = location.pathname.match(/\/visit-routes\/([^/]+)$/);
  const routeId = detailMatch?.[1];
  const [searchParams] = useSearchParams();
  const occurrenceDate = searchParams.get('date') || toDateYmd(new Date());
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CrmVisitRoute | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [visitClient, setVisitClient] = useState<{ id: string; name: string } | null>(null);
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    if (!routeId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const row = await fetchVisitRoute(routeId);
      if (!row) {
        setData(null);
        setLoadError('Could not load this route.');
        return;
      }
      setData(row);
    } catch (e) {
      setData(null);
      setLoadError(e instanceof Error ? e.message : 'Could not load route');
    } finally {
      setLoading(false);
    }
  }, [routeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitVisit = async () => {
    if (!data || !user || !visitClient) return;
    setMarkingId(visitClient.id);
    try {
      await markVisitRouteStopDone({
        route: data,
        occurrenceYmd: occurrenceDate,
        clientId: visitClient.id,
        repId: data.assignedRepId,
        repName: data.assignedRepName,
        userId: resolveAuthActorId(user),
        notes: notes.trim() || `Visit route: ${data.title} · ${visitClient.name}`,
        result: 'interested',
      });
      setVisitClient(null);
      setNotes('');
      await load();
      toast({ title: 'Visit logged' });
    } catch (e) {
      toast({
        title: 'Could not save visit',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setMarkingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || loadError) {
    return (
      <div className="space-y-4 text-center py-12">
        <p className="font-semibold">Visit route unavailable</p>
        <p className="text-sm text-muted-foreground">{loadError || 'Route not found.'}</p>
        <Button type="button" onClick={() => void load()}>Retry</Button>
      </div>
    );
  }

  const progress = routeProgressOnDate(data, occurrenceDate);
  const firstGps = data.stops.find((s) => s.lat != null && s.lng != null);
  const directionsUrl = googleMapsDirectionsUrl(data.stops);
  const mapSrc =
    firstGps?.lat != null && firstGps?.lng != null
      ? `https://maps.google.com/maps?q=${firstGps.lat},${firstGps.lng}&z=14&output=embed`
      : null;

  return (
    <div className="space-y-4">
      <Button type="button" variant="ghost" size="sm" asChild>
        <Link to="/admin/crm/map">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Map & pipeline
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{data.title}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            📅 {occurrenceDate} · {data.assignedRepName}
            {data.repeatRule !== 'none' ? ` · ${REPEAT_LABELS[data.repeatRule]}` : ''}
          </p>
          <p className="text-sm font-semibold text-primary mt-2">
            {progress.done}/{progress.total} visits done
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" asChild>
          <Link to={`/admin/crm/visit-routes/${data.id}/edit`}>Edit route</Link>
        </Button>
      </div>

      {mapSrc ? (
        <Card className="overflow-hidden">
          <iframe title="Route map preview" src={mapSrc} className="w-full h-[200px] border-0" loading="lazy" />
        </Card>
      ) : null}

      {directionsUrl ? (
        <Button type="button" variant="secondary" asChild>
          <a href={directionsUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />
            Open full route in Google Maps
          </a>
        </Button>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stops</CardTitle>
          <CardDescription>Mark visited to log a CRM visit for that client.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.stops
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((stop, idx) => {
              const done = stopDoneOnDate(data, occurrenceDate, stop.clientId);
              return (
                <div
                  key={stop.clientId}
                  className={cn(
                    'rounded-lg border p-3',
                    done && 'border-green-400 bg-green-50/50',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">{stop.clientName}</p>
                      <p className="text-xs text-muted-foreground">
                        {[stop.district, stop.area].filter(Boolean).join(' · ') || '—'}
                      </p>
                      {stop.lat != null && stop.lng != null ? (
                        <a
                          href={`https://www.google.com/maps?q=${stop.lat},${stop.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary font-medium mt-1 inline-block"
                        >
                          Open on map
                        </a>
                      ) : null}
                    </div>
                    {done ? (
                      <span className="text-green-700 font-bold text-sm">✓ Done</span>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        disabled={markingId === stop.clientId}
                        onClick={() => setVisitClient({ id: stop.clientId, name: stop.clientName })}
                      >
                        Visited
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
        </CardContent>
      </Card>

      <Dialog open={visitClient != null} onOpenChange={(open) => !open && setVisitClient(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log visit — {visitClient?.name}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            rows={3}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setVisitClient(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void submitVisit()} disabled={markingId != null}>
              Save visit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CrmVisitRouteDetail;
