import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import { fetchActivities, fetchCrmClients, type CrmClient } from '@/lib/crmService';
import {
  agentDisplayName,
  agentsForMapFilterChips,
  fetchTeamFilterAgents,
} from '@/lib/crmAssignableAgents';
import { useLiveTeamLocations } from '@/hooks/useLiveTeamLocations';
import CrmLiveTeamPanel from '@/components/crm/CrmLiveTeamPanel';
import CrmUpcomingRoutesList from '@/components/crm/CrmUpcomingRoutesList';
import {
  fetchVisitRoutes,
  invalidateVisitRouteCache,
  toDateYmd,
  type CrmVisitRoute,
} from '@/lib/crmVisitRouteService';
import {
  buildMapClientRows,
  filterClientsByRep,
  formatCustomerDateLabel,
  pipelineStageCounts,
  repeatChipLabel,
  resolveCustomerDate,
  routeStopIdsForDate,
} from '@/lib/crmTeamMapFilters';
import {
  callClient,
  clientCanShareLocationForDriver,
  CRM_PIPELINE_COLORS,
  googleMapsUrl,
  PIPELINE_LABELS,
  statusColor,
  whatsappClient,
  whatsappShareClientLocationForDriver,
  type CustomerDateMode,
  type RepeatFilter,
} from '@/lib/crmMapUtils';
import { cn } from '@/lib/utils';
import CrmActivityTypeIcon from '@/components/crm/CrmActivityTypeIcon';
import { useToast } from '@/hooks/use-toast';

const REPEAT_OPTIONS: RepeatFilter[] = ['all', 'due', 'overdue'];
const MAP_PERIOD = 'day' as const;

const CrmMap: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const storeId = getActualStoreId(user);

  const [agents, setAgents] = useState<Awaited<ReturnType<typeof fetchTeamFilterAgents>>>([]);
  const [allClients, setAllClients] = useState<CrmClient[]>([]);
  const [activities, setActivities] = useState<Awaited<ReturnType<typeof fetchActivities>>>([]);
  const [visitRoutes, setVisitRoutes] = useState<CrmVisitRoute[]>([]);
  const { reps: liveReps, loading: liveLoading } = useLiveTeamLocations(storeId, 'owner', Boolean(storeId));

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [repeatFilter, setRepeatFilter] = useState<RepeatFilter>('all');
  const [customerDateMode, setCustomerDateMode] = useState<CustomerDateMode>('today');
  const [pickCustomerDate, setPickCustomerDate] = useState<string>(() => toDateYmd(new Date()));
  const [repFilter, setRepFilter] = useState('all');
  const [routeFilter, setRouteFilter] = useState('all');
  const [visitDateOnly, setVisitDateOnly] = useState(false);
  const [pipelineFilter, setPipelineFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadRoutesOnly = useCallback(async (force = false) => {
    if (!storeId) return;
    try {
      if (force) invalidateVisitRouteCache(storeId);
      const routes = await fetchVisitRoutes(storeId, { managerView: true });
      setVisitRoutes(routes);
    } catch {
      // keep existing
    }
  }, [storeId]);

  const load = useCallback(async () => {
    if (!storeId) {
      setAllClients([]);
      setLoading(false);
      return;
    }
    setLoadError(null);
    setLoading(true);
    try {
      const [clientList, actList, agentList, routes] = await Promise.all([
        fetchCrmClients(storeId, { crmOnly: true }),
        fetchActivities(storeId, undefined, 2000),
        fetchTeamFilterAgents(storeId),
        fetchVisitRoutes(storeId, { managerView: true }),
      ]);
      setAllClients(clientList);
      setActivities(actList);
      setAgents(agentList);
      setVisitRoutes(routes);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not load map data';
      setLoadError(msg);
      toast({ title: 'Map unavailable', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [storeId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const customerDate = useMemo(
    () =>
      resolveCustomerDate(
        customerDateMode,
        customerDateMode === 'pick' ? new Date(`${pickCustomerDate}T12:00:00`) : null,
      ),
    [customerDateMode, pickCustomerDate],
  );
  const customerDateYmd = useMemo(() => toDateYmd(customerDate), [customerDate]);
  const customerDateLabel = useMemo(() => formatCustomerDateLabel(customerDate), [customerDate]);

  const clients = useMemo(
    () => filterClientsByRep(allClients, repFilter, null),
    [allClients, repFilter],
  );

  const routeRepFilter = repFilter === 'all' ? undefined : repFilter;

  const routeChipOptions = useMemo(() => {
    let list = visitRoutes.filter((r) => r.status !== 'archived');
    if (routeRepFilter) {
      list = list.filter((r) => r.assignedRepId === routeRepFilter);
    }
    return list.sort((a, b) => a.title.localeCompare(b.title));
  }, [visitRoutes, routeRepFilter]);

  useEffect(() => {
    if (routeFilter !== 'all' && !routeChipOptions.some((r) => r.id === routeFilter)) {
      setRouteFilter('all');
    }
  }, [routeFilter, routeChipOptions]);

  const routeStopClientIds = useMemo(
    () =>
      routeStopIdsForDate(
        visitRoutes,
        customerDateYmd,
        routeRepFilter,
        undefined,
        routeFilter,
      ),
    [visitRoutes, customerDateYmd, routeRepFilter, routeFilter],
  );

  const mapped = useMemo(
    () =>
      buildMapClientRows({
        clients,
        activities,
        customerDate,
        customerDateYmd,
        period: MAP_PERIOD,
        repeatFilter,
        pipelineFilter,
        routeStopIds: routeStopClientIds,
        routeFilter,
        visitDateOnly,
      }),
    [
      clients,
      activities,
      customerDate,
      customerDateYmd,
      repeatFilter,
      pipelineFilter,
      routeStopClientIds,
      routeFilter,
      visitDateOnly,
    ],
  );

  const pipelineCounts = useMemo(
    () =>
      pipelineStageCounts(
        clients,
        activities,
        customerDate,
        customerDateYmd,
        MAP_PERIOD,
        repeatFilter,
        routeStopClientIds,
        routeFilter,
        visitDateOnly,
      ),
    [
      clients,
      activities,
      customerDate,
      customerDateYmd,
      repeatFilter,
      routeStopClientIds,
      routeFilter,
      visitDateOnly,
    ],
  );

  const totalBeforePipeline = useMemo(() => {
    const all = pipelineStageCounts(
      clients,
      activities,
      customerDate,
      customerDateYmd,
      MAP_PERIOD,
      repeatFilter,
      routeStopClientIds,
      routeFilter,
      visitDateOnly,
    );
    return Object.values(all).reduce((sum, n) => sum + n, 0);
  }, [
    clients,
    activities,
    customerDate,
    customerDateYmd,
    repeatFilter,
    routeStopClientIds,
    routeFilter,
    visitDateOnly,
  ]);

  useEffect(() => {
    if (mapped.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !mapped.some((m) => m.client.id === selectedId)) {
      setSelectedId(mapped.find((m) => m.hasGps)?.client.id || mapped[0].client.id);
    }
  }, [mapped, selectedId]);

  const selected = mapped.find((m) => m.client.id === selectedId) ?? null;
  const filterAgentChips = useMemo(() => agentsForMapFilterChips(agents), [agents]);
  const liveRosterAgents = useMemo(
    () => filterAgentChips.map((a) => ({ id: a.id, name: a.name, userId: a.userId })),
    [filterAgentChips],
  );

  const liveHighlightRepIds = useMemo(() => {
    if (repFilter === 'all') return [];
    const agent = agents.find((a) => a.id === repFilter);
    const ids = [repFilter];
    if (agent?.userId) ids.push(agent.userId, `user:${agent.userId}`);
    return ids;
  }, [repFilter, agents]);

  const onLiveRepSelect = (liveRepId: string) => {
    const agent = agents.find(
      (a) => a.id === liveRepId || a.userId === liveRepId || `user:${a.userId}` === liveRepId,
    );
    setRepFilter(agent?.id || liveRepId);
  };

  const mapSrc =
    selected?.hasGps && selected.client.location?.lat != null && selected.client.location?.lng != null
      ? `https://maps.google.com/maps?q=${selected.client.location.lat},${selected.client.location.lng}&z=15&output=embed`
      : null;

  const refresh = () => {
    setRefreshing(true);
    void load();
    void loadRoutesOnly(true);
  };

  const chipBtn = (active: boolean) =>
    cn('rounded-full px-3 py-1.5 text-sm border transition-colors', active
      ? 'bg-primary text-primary-foreground border-primary'
      : 'bg-muted/50 hover:bg-muted border-transparent');

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Map & pipeline</h2>
          <p className="text-sm text-muted-foreground">
            All filters use {customerDateLabel} · Live GPS · routes · pipeline
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
          <RefreshCw className={cn('h-4 w-4 mr-2', refreshing && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {loadError ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-3 text-sm text-destructive">{loadError}</CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Visit date</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(['today', 'yesterday', 'pick'] as CustomerDateMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={chipBtn(customerDateMode === mode)}
                onClick={() => setCustomerDateMode(mode)}
              >
                {mode === 'today' ? 'Today' : mode === 'yesterday' ? 'Yesterday' : 'Pick date'}
              </button>
            ))}
          </div>
          {customerDateMode === 'pick' ? (
            <Input
              type="date"
              value={pickCustomerDate}
              onChange={(e) => setPickCustomerDate(e.target.value)}
              className="w-[200px]"
            />
          ) : null}
          <button
            type="button"
            className={cn(
              'w-full text-left rounded-md border px-3 py-2 text-sm font-medium transition-colors',
              visitDateOnly ? 'border-primary bg-primary/10 text-primary' : 'border-border',
            )}
            onClick={() => setVisitDateOnly((v) => !v)}
          >
            {visitDateOnly ? '✓ ' : ''}Only clients on {customerDateLabel}
          </button>
        </CardContent>
      </Card>

      <CrmLiveTeamPanel
        reps={liveReps}
        loading={liveLoading}
        repFilter={repFilter}
        highlightRepIds={liveHighlightRepIds}
        rosterAgents={liveRosterAgents}
        onSelectRep={onLiveRepSelect}
      />

      <CrmUpcomingRoutesList
        routes={visitRoutes}
        repFilter={routeRepFilter}
        customerDateYmd={customerDateYmd}
        showAllRoutesWhenDateEmpty
        onCreateRoute={() => navigate('/admin/crm/visit-routes/new')}
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Sales agent · {customerDateLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={chipBtn(repFilter === 'all')} onClick={() => setRepFilter('all')}>
              All agents
            </button>
            {filterAgentChips.map((a) => (
              <button
                key={a.id}
                type="button"
                className={chipBtn(repFilter === a.id)}
                onClick={() => setRepFilter(a.id)}
              >
                {a.name}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Route · {customerDateLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={chipBtn(routeFilter === 'all')} onClick={() => setRouteFilter('all')}>
              All routes ({routeChipOptions.length})
            </button>
            {routeChipOptions.map((route) => (
              <button
                key={route.id}
                type="button"
                className={chipBtn(routeFilter === route.id)}
                onClick={() => setRouteFilter(route.id)}
              >
                {route.title} ({route.stops.length})
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Repeat / follow-up · {customerDateLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {REPEAT_OPTIONS.map((r) => (
              <button
                key={r}
                type="button"
                className={chipBtn(repeatFilter === r)}
                onClick={() => setRepeatFilter(r)}
              >
                {repeatChipLabel(r, customerDate)}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Pipeline stage · {customerDateLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={chipBtn(pipelineFilter === 'all')}
              onClick={() => setPipelineFilter('all')}
            >
              All ({totalBeforePipeline})
            </button>
            {Object.entries(pipelineCounts).map(([stage, count]) => (
              <button
                key={stage}
                type="button"
                className={chipBtn(pipelineFilter === stage)}
                style={{ borderColor: CRM_PIPELINE_COLORS[stage] || undefined }}
                onClick={() => setPipelineFilter(stage)}
              >
                {PIPELINE_LABELS[stage] || stage} ({count})
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: statusColor('visited') }} />
          Visited ({customerDateLabel})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: statusColor('due') }} />
          {customerDateYmd === toDateYmd(new Date()) ? 'Due today' : 'Due on date'}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: statusColor('overdue') }} />
          Overdue
        </span>
      </div>

      {selected ? (
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{selected.client.name || 'Client'}</CardTitle>
            <CardDescription>
              {agentDisplayName(agents, selected.client.assignedRepId)}
              {' · '}
              {PIPELINE_LABELS[selected.client.pipelineStage || 'new_lead'] || selected.client.pipelineStage}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {selected.client.phone ? (
              <p className="text-sm text-muted-foreground">{selected.client.phone}</p>
            ) : null}
            {selected.client.nextFollowUpAt ? (
              <p className="text-sm text-muted-foreground">
                Next visit: {new Date(selected.client.nextFollowUpAt).toLocaleString()}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => callClient(selected.client.phone)}>
                Call
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-green-300 text-green-800"
                onClick={() => whatsappClient(selected.client.phone, `Hi ${selected.client.name || ''}, `)}
              >
                WhatsApp
              </Button>
              {clientCanShareLocationForDriver(selected.client) ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => whatsappShareClientLocationForDriver(selected.client)}
                >
                  Driver
                </Button>
              ) : null}
              <Button type="button" size="sm" asChild>
                <Link to={`/admin/crm/clients/${selected.client.id}`}>Open profile</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[420px]">
        <Card className="overflow-hidden flex flex-col">
          <CardHeader className="py-3">
            <CardTitle className="text-base">
              Clients · {customerDateLabel} ({mapped.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 min-h-0">
            {mapped.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                No clients match these filters for {customerDateLabel}.
              </p>
            ) : (
              <ScrollArea className="h-[380px] lg:h-[480px]">
                <ul className="divide-y pr-3">
                  {mapped.map(({ client: c, mapStatus, hasGps }) => (
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
                            style={{ backgroundColor: statusColor(mapStatus) }}
                          />
                          {c.nextFollowUpType || c.lastActivityType ? (
                            <CrmActivityTypeIcon type={c.nextFollowUpType || c.lastActivityType} />
                          ) : c.nextFollowUpAt ? (
                            <CrmActivityTypeIcon type="visit" />
                          ) : null}
                          <span className="font-medium">{c.name || 'Unnamed'}</span>
                          <Badge variant="outline" className="text-[10px] ml-auto">
                            {PIPELINE_LABELS[c.pipelineStage || 'new_lead'] || c.pipelineStage}
                          </Badge>
                        </div>
                        <div className="text-muted-foreground text-xs mt-1 ml-5">
                          {agentDisplayName(agents, c.assignedRepId)}
                          {' · '}
                          {[c.district, c.area].filter(Boolean).join(' · ') || '—'}
                          {hasGps ? '' : ' · No GPS'}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2 ml-5">
                          {c.phone ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                callClient(c.phone);
                              }}
                            >
                              Call
                            </Button>
                          ) : null}
                          {c.phone ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-green-700"
                              onClick={(e) => {
                                e.stopPropagation();
                                whatsappClient(c.phone);
                              }}
                            >
                              WA
                            </Button>
                          ) : null}
                          {hasGps && c.location ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(googleMapsUrl(c.location!.lat, c.location!.lng), '_blank');
                              }}
                            >
                              Map
                            </Button>
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
              {selected?.hasGps
                ? selected.client.name
                : 'Select a client with GPS to view the map.'}
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
                No GPS for selected client
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CrmMap;
