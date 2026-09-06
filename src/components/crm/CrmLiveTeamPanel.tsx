import React, { useMemo, useState } from 'react';
import { ExternalLink, Loader2, MapPin } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CrmRepLiveLocation } from '@/lib/crmService';
import {
  formatLiveLocationAge,
  isLiveLocationFresh,
  isManagerLiveRole,
  liveRepMatchesAnyFilter,
} from '@/lib/crmLiveLocationUtils';

type RosterAgent = {
  id: string;
  name: string;
  userId?: string;
};

type Props = {
  reps: CrmRepLiveLocation[];
  loading?: boolean;
  repFilter?: string;
  highlightRepIds?: string[];
  rosterAgents?: RosterAgent[];
  onSelectRep?: (repId: string) => void;
};

export default function CrmLiveTeamPanel({
  reps,
  loading,
  repFilter = 'all',
  highlightRepIds = [],
  rosterAgents = [],
  onSelectRep,
}: Props) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const displayReps = useMemo(() => {
    if (repFilter === 'all' && highlightRepIds.length === 0) return reps;
    const ids = repFilter !== 'all' ? [repFilter, ...highlightRepIds] : highlightRepIds;
    if (!ids.length) return reps;
    return reps.filter((r) => liveRepMatchesAnyFilter(r, ids));
  }, [reps, repFilter, highlightRepIds]);

  const offlineRoster = useMemo(() => {
    if (!rosterAgents.length) return [];
    const trackedUserIds = new Set(displayReps.map((r) => r.userId));
    const trackedRepIds = new Set(displayReps.map((r) => r.repId));
    const filterIds =
      repFilter !== 'all' ? [repFilter, ...highlightRepIds] : highlightRepIds;
    return rosterAgents.filter((a) => {
      if (a.userId && trackedUserIds.has(a.userId)) return false;
      if (trackedRepIds.has(a.id)) return false;
      if (filterIds.length && !filterIds.includes(a.id) && (!a.userId || !filterIds.includes(a.userId))) {
        return false;
      }
      return true;
    });
  }, [rosterAgents, displayReps, repFilter, highlightRepIds]);

  const freshCount = displayReps.filter((r) => isLiveLocationFresh(r.updatedAtIso)).length;
  const trackedCount = displayReps.length || offlineRoster.length;

  const selected =
    displayReps.find((r) => r.userId === selectedUserId) ?? displayReps[0] ?? null;

  const openMaps = (r: CrmRepLiveLocation) => {
    window.open(`https://maps.google.com/?q=${r.lat},${r.lng}`, '_blank', 'noopener,noreferrer');
  };

  const handleSelect = (r: CrmRepLiveLocation) => {
    setSelectedUserId(r.userId);
    onSelectRep?.(r.repId);
  };

  return (
    <Card>
      <CardHeader className="py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Live agents on map</CardTitle>
            <CardDescription>
              Tap an agent to focus · updates in real time while the mobile app is open.
            </CardDescription>
          </div>
          <Badge variant={freshCount > 0 ? 'default' : 'secondary'}>
            {freshCount > 0 ? `${freshCount} live` : `${trackedCount} tracked`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : displayReps.length === 0 && offlineRoster.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No team GPS in the last 12 hours. Sales reps must open Grabio with location allowed.
          </p>
        ) : (
          <>
            {displayReps.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2 text-center">
                No live GPS yet. Field agents must open Grabio with location on — last position shows for 12 hours.
              </p>
            ) : null}
            {selected ? (
              <div className="rounded-lg border overflow-hidden">
                <iframe
                  title={`Live location — ${selected.repName}`}
                  src={`https://maps.google.com/maps?q=${selected.lat},${selected.lng}&z=16&output=embed`}
                  className="w-full h-[220px] border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                <div className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/30 text-sm">
                  <span className="font-medium">{selected.repName || selected.repId}</span>
                  <Button size="sm" variant="outline" onClick={() => openMaps(selected)}>
                    <ExternalLink className="h-3.5 w-3.5 mr-1" />
                    Open in Maps
                  </Button>
                </div>
              </div>
            ) : null}

            {displayReps.length > 0 ? (
            <ul className="divide-y rounded-md border">
              {displayReps.map((r) => {
                const fresh = isLiveLocationFresh(r.updatedAtIso);
                const active = selected?.userId === r.userId;
                return (
                  <li key={r.userId}>
                    <button
                      type="button"
                      onClick={() => handleSelect(r)}
                      className={cn(
                        'w-full text-left px-3 py-3 flex items-center gap-3 transition-colors hover:bg-muted/50',
                        active && 'bg-primary/10 border-l-2 border-primary',
                      )}
                    >
                      <span
                        className={cn(
                          'h-2.5 w-2.5 rounded-full shrink-0',
                          isManagerLiveRole(r.role)
                            ? 'bg-violet-500'
                            : fresh
                              ? 'bg-sky-500'
                              : 'bg-slate-400',
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{r.repName || r.repId}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatLiveLocationAge(r.updatedAtIso)} · {r.lat.toFixed(4)}, {r.lng.toFixed(4)}
                        </p>
                      </div>
                      <MapPin className="h-4 w-4 text-primary shrink-0" />
                    </button>
                  </li>
                );
              })}
            </ul>
            ) : null}

            {offlineRoster.length > 0 ? (
              <ul className="divide-y rounded-md border border-dashed">
                {offlineRoster.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => onSelectRep?.(a.id)}
                      className="w-full text-left px-3 py-3 flex items-center gap-3 transition-colors hover:bg-muted/50"
                    >
                      <span className="h-2.5 w-2.5 rounded-full shrink-0 bg-slate-300" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{a.name}</p>
                        <p className="text-xs text-muted-foreground">No GPS yet — app closed or location off</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
