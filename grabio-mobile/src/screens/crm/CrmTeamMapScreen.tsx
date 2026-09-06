import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ScreenSafeArea from '../../components/ScreenSafeArea';
import DatePickerField from '../../components/DatePickerField';
import { useResolvedStoreId } from '../../hooks/useResolvedStoreId';
import {
  agentDisplayName,
  agentsForMapFilterChips,
  fetchAssignedClients,
  fetchTeamFilterAgents,
  fetchStoreActivities,
  type CrmAssignableAgent,
  type CrmClient,
} from '../../lib/crmMobileService';
import { useAuth } from '../../context/AuthContext';
import {
  canAssignClientGpsLocation,
  canFilterBySalesAgent,
  collectMobileCrmRepIds,
  hasStoreAdminAccess,
  isFieldSalesRep,
  resolveMobileCrmRepId,
} from '../../lib/crmRepResolve';
import {
  callClient,
  googleMapsUrl,
  PIPELINE_LABELS,
  CRM_PIPELINE_COLORS,
  statusColor,
  whatsappClient,
  whatsappShareClientLocationForDriver,
  clientCanShareLocationForDriver,
  type CustomerDateMode,
  type MapPeriod,
  type RepeatFilter,
} from '../../lib/crmMapUtils';
import {
  fetchVisitRoutes,
  invalidateVisitRouteCache,
  toDateYmd,
  type CrmVisitRoute,
} from '../../lib/crmVisitRouteService';
import {
  buildMapClientRows,
  filterClientsByRep,
  formatCustomerDateLabel,
  pipelineStageCounts,
  repeatChipLabel,
  resolveCustomerDate,
  routeStopIdsForDate,
  routesOnDate,
} from '../../lib/crmTeamMapFilters';
import CrmUpcomingRoutesList from '../../components/CrmUpcomingRoutesList';
import AssignClientLocationFab from '../../components/AssignClientLocationFab';
import CrmLiveTeamMap from '../../components/CrmLiveTeamMap';
import NativeMapPreview from '../../components/NativeMapPreview';
import { useLiveTeamLocations } from '../../hooks/useLiveTeamLocations';
import { RootStackParamList } from '../../types';
import { COLORS, RADIUS, SHADOW } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const REPEAT_OPTIONS: RepeatFilter[] = ['all', 'due', 'overdue'];
const MAP_PERIOD: MapPeriod = 'day';

const MAP_HEIGHT = Math.min(280, Dimensions.get('window').height * 0.32);

export default function CrmTeamMapScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const { storeId, loading: storeLoading } = useResolvedStoreId();
  const isManager = hasStoreAdminAccess(user?.userRole, user?.subAccountRole);
  const isStoreOwner = user?.userRole === 'owner';
  const isSalesRep = isFieldSalesRep(user?.userRole);
  const canFilterAgents = canFilterBySalesAgent(user?.userRole, user?.subAccountRole);
  const canAssignGps = canAssignClientGpsLocation(user?.userRole, user?.subAccountRole);
  const canViewLiveTeam = isManager;

  const { reps: liveReps, loading: liveLoading } = useLiveTeamLocations(
    storeId || undefined,
    isStoreOwner ? 'owner' : user?.userRole,
    canViewLiveTeam,
  );

  const [loading, setLoading] = useState(true);
  const [mapDataLoading, setMapDataLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [repeatFilter, setRepeatFilter] = useState<RepeatFilter>('all');
  const [customerDateMode, setCustomerDateMode] = useState<CustomerDateMode>('today');
  const [pickCustomerDate, setPickCustomerDate] = useState<Date | null>(null);
  const [repFilter, setRepFilter] = useState('all');
  const [routeFilter, setRouteFilter] = useState('all');
  const [visitDateOnly, setVisitDateOnly] = useState(false);
  const [myRepId, setMyRepId] = useState<string | null>(null);
  const [myRepIds, setMyRepIds] = useState<string[]>([]);
  const [agents, setAgents] = useState<CrmAssignableAgent[]>([]);
  const [allClients, setAllClients] = useState<CrmClient[]>([]);
  const [activities, setActivities] = useState<Array<Record<string, unknown>>>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pipelineFilter, setPipelineFilter] = useState<string>('all');
  const [visitRoutes, setVisitRoutes] = useState<CrmVisitRoute[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadRoutesOnly = useCallback(async (opts?: { force?: boolean }) => {
    if (!storeId || !user) return;
    try {
      if (opts?.force) invalidateVisitRouteCache(storeId);
      const managerView = isManager && !isSalesRep;
      const repIds = managerView ? undefined : await collectMobileCrmRepIds({ ...user, storeId });
      const routes = await fetchVisitRoutes(storeId, {
        managerView,
        repIds,
        assignedUserId: managerView ? undefined : user.uid,
      });
      setVisitRoutes(routes);
    } catch {
      // keep existing routes
    }
  }, [storeId, user, isManager, isSalesRep]);

  useFocusEffect(
    useCallback(() => {
      void loadRoutesOnly();
    }, [loadRoutesOnly]),
  );

  const load = useCallback(async (forceAgents = false) => {
    if (!storeId || !user) {
      setLoading(false);
      return;
    }
    setLoadError(null);
    try {
      const repId = await resolveMobileCrmRepId({ ...user, storeId });
      setMyRepId(repId);
      const managerView = isManager && !isSalesRep;
      const repIds = managerView ? undefined : await collectMobileCrmRepIds({ ...user, storeId });
      if (repIds) setMyRepIds(repIds);
      const [agentList, routes] = await Promise.all([
        canFilterAgents ? fetchTeamFilterAgents(storeId, forceAgents) : Promise.resolve([]),
        fetchVisitRoutes(storeId, { managerView, repIds }),
      ]);
      setAgents(agentList);
      setVisitRoutes(routes);

      setMapDataLoading(true);
      const activityRep = !canFilterAgents && repId ? repId : undefined;
      const [clientList, actList] = await Promise.all([
        fetchAssignedClients(storeId, { ...user, storeId }, { managerView }),
        fetchStoreActivities(storeId, 400, activityRep),
      ]);
      setAllClients(clientList);
      setActivities(actList);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not load map data';
      setLoadError(msg);
      setAllClients([]);
      setActivities([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setMapDataLoading(false);
    }
  }, [storeId, user, isManager, isSalesRep, canFilterAgents]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (customerDateMode === 'pick' && !pickCustomerDate) {
      setPickCustomerDate(new Date());
    }
  }, [customerDateMode, pickCustomerDate]);

  const customerDate = useMemo(
    () => resolveCustomerDate(customerDateMode, pickCustomerDate),
    [customerDateMode, pickCustomerDate],
  );

  const customerDateYmd = useMemo(() => toDateYmd(customerDate), [customerDate]);
  const customerDateLabel = useMemo(() => formatCustomerDateLabel(customerDate), [customerDate]);

  const effectiveRepFilter = canFilterAgents ? repFilter : 'all';
  const routeRepFilter = canFilterAgents
    ? (repFilter === 'me' && myRepId ? myRepId : repFilter)
    : undefined;

  const clients = useMemo(
    () => filterClientsByRep(allClients, effectiveRepFilter, myRepId),
    [allClients, effectiveRepFilter, myRepId],
  );

  const routesForDate = useMemo(
    () =>
      routesOnDate(
        visitRoutes,
        customerDateYmd,
        routeRepFilter === 'all' ? undefined : routeRepFilter,
        canFilterAgents ? undefined : myRepIds,
      ),
    [visitRoutes, customerDateYmd, routeRepFilter, canFilterAgents, myRepIds],
  );

  /** Every route in the store (by agent) — chips must list each route, not only today's matches. */
  const routeChipOptions = useMemo(() => {
    let list = visitRoutes.filter((r) => r.status !== 'archived');
    if (routeRepFilter && routeRepFilter !== 'all') {
      list = list.filter((r) => r.assignedRepId === routeRepFilter);
    } else if (!canFilterAgents && myRepIds.length > 0) {
      list = list.filter((r) => myRepIds.includes(r.assignedRepId));
    }
    return list.sort((a, b) => a.title.localeCompare(b.title));
  }, [visitRoutes, routeRepFilter, canFilterAgents, myRepIds]);

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
        routeRepFilter === 'all' ? undefined : routeRepFilter,
        canFilterAgents ? undefined : myRepIds,
        routeFilter,
      ),
    [visitRoutes, customerDateYmd, routeRepFilter, canFilterAgents, myRepIds, routeFilter],
  );

  const mapped = useMemo(
    () =>
      buildMapClientRows({
        clients,
        activities: activities as never,
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
        activities as never,
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
      activities as never,
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
  const mapAgentChips = useMemo(() => agentsForMapFilterChips(agents), [agents]);
  const liveRosterAgents = useMemo(
    () => mapAgentChips.map((a) => ({ id: a.id, name: a.name, userId: a.userId })),
    [mapAgentChips],
  );
  const liveHighlightRepIds = useMemo(() => {
    if (!canFilterAgents || repFilter === 'all') return [];
    if (repFilter === 'me') return myRepIds;
    const agent = agents.find((a) => a.id === repFilter);
    const ids = [repFilter];
    if (agent?.userId) ids.push(agent.userId, `user:${agent.userId}`);
    return ids;
  }, [canFilterAgents, repFilter, myRepIds, agents]);

  const onLiveRepSelect = useCallback(
    (liveRepId: string) => {
      const agent = agents.find(
        (a) => a.id === liveRepId || a.userId === liveRepId || `user:${a.userId}` === liveRepId,
      );
      if (agent) setRepFilter(agent.id);
      else if (myRepIds.includes(liveRepId)) setRepFilter('me');
      else setRepFilter(liveRepId);
    },
    [agents, myRepIds],
  );

  if (storeLoading || loading) {
    return (
      <ScreenSafeArea style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </ScreenSafeArea>
    );
  }

  if (loadError && allClients.length === 0 && visitRoutes.length === 0) {
    return (
      <ScreenSafeArea style={styles.centered}>
        <Text style={styles.errorTitle}>Map unavailable</Text>
        <Text style={styles.errorBody}>{loadError}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); void load(); }}>
          <Text style={styles.retryBtnText}>Tap to retry</Text>
        </TouchableOpacity>
      </ScreenSafeArea>
    );
  }

  return (
    <ScreenSafeArea style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load(true);
              void loadRoutesOnly({ force: true });
            }}
            colors={[COLORS.primary]}
          />
        }
      >
        <Text style={styles.title}>Map & pipeline</Text>
        <Text style={styles.sub}>
          All filters use {customerDateLabel}
          {isManager ? ' · Live GPS · routes · pipeline' : ' · Your clients and routes'}
        </Text>

        {canAssignGps ? (
          <AssignClientLocationFab
            clients={allClients}
            variant="fab"
            style={{ marginBottom: 12 }}
            onSaved={() => {
              void load();
            }}
          />
        ) : null}

        <Text style={styles.filterLabel}>Visit date</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
          {(['today', 'yesterday', 'pick'] as CustomerDateMode[]).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[styles.chip, customerDateMode === mode && styles.chipActive]}
              onPress={() => {
                setCustomerDateMode(mode);
                if (mode === 'pick' && !pickCustomerDate) setPickCustomerDate(new Date());
              }}
            >
              <Text style={[styles.chipText, customerDateMode === mode && styles.chipTextActive]}>
                {mode === 'today' ? 'Today' : mode === 'yesterday' ? 'Yesterday' : 'Pick date'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {customerDateMode === 'pick' ? (
          <DatePickerField
            label={`Visit date · ${customerDateLabel}`}
            value={pickCustomerDate}
            onChange={(d) => setPickCustomerDate(d)}
            placeholder="Select visit date…"
          />
        ) : null}

        <TouchableOpacity
          style={[styles.toggleRow, visitDateOnly && styles.toggleRowActive]}
          onPress={() => setVisitDateOnly((v) => !v)}
        >
          <Text style={[styles.toggleText, visitDateOnly && styles.toggleTextActive]}>
            {visitDateOnly ? '✓ ' : ''}Only clients on {customerDateLabel}
          </Text>
        </TouchableOpacity>

        {canViewLiveTeam ? (
          <CrmLiveTeamMap
            reps={liveReps}
            loading={liveLoading}
            title={isStoreOwner ? 'Live team — agents & managers' : 'Live agents on map'}
            subtitle={
              isStoreOwner
                ? 'Updates automatically while the app is open (like WhatsApp live location).'
                : 'Field agents only · updates every few seconds.'
            }
            highlightRepIds={liveHighlightRepIds}
            rosterAgents={liveRosterAgents}
            onSelectRep={canFilterAgents ? onLiveRepSelect : undefined}
          />
        ) : null}

        {loadError ? (
          <TouchableOpacity style={styles.errorBanner} onPress={() => { setLoading(true); void load(); }}>
            <Text style={styles.errorBannerText}>{loadError}</Text>
            <Text style={styles.errorBannerRetry}>Tap to retry</Text>
          </TouchableOpacity>
        ) : null}

        <CrmUpcomingRoutesList
          routes={visitRoutes}
          repFilter={routeRepFilter}
          repIds={canFilterAgents ? undefined : myRepIds}
          customerDateYmd={customerDateYmd}
          showAllRoutesWhenDateEmpty={canFilterAgents}
          onCreateRoute={() => navigation.navigate('CrmVisitRouteForm')}
        />

        {mapDataLoading ? (
          <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: 12 }} />
        ) : null}

        {canFilterAgents ? (
          <>
            <Text style={styles.filterLabel}>Sales agent · {customerDateLabel}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
              <TouchableOpacity
                style={[styles.chip, repFilter === 'all' && styles.chipActive]}
                onPress={() => setRepFilter('all')}
              >
                <Text style={[styles.chipText, repFilter === 'all' && styles.chipTextActive]}>All agents</Text>
              </TouchableOpacity>
              {myRepId ? (
                <TouchableOpacity
                  style={[styles.chip, repFilter === 'me' && styles.chipActive]}
                  onPress={() => setRepFilter('me')}
                >
                  <Text style={[styles.chipText, repFilter === 'me' && styles.chipTextActive]}>My route</Text>
                </TouchableOpacity>
              ) : null}
              {mapAgentChips.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  style={[styles.chip, repFilter === a.id && styles.chipActive]}
                  onPress={() => setRepFilter(a.id)}
                >
                  <Text style={[styles.chipText, repFilter === a.id && styles.chipTextActive]}>{a.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        ) : null}

        <Text style={styles.filterLabel}>Route · {customerDateLabel}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
          <TouchableOpacity
            style={[styles.chip, routeFilter === 'all' && styles.chipActive]}
            onPress={() => setRouteFilter('all')}
          >
            <Text style={[styles.chipText, routeFilter === 'all' && styles.chipTextActive]}>
              All routes ({routeChipOptions.length})
            </Text>
          </TouchableOpacity>
          {routeChipOptions.map((route) => (
            <TouchableOpacity
              key={route.id}
              style={[styles.chip, routeFilter === route.id && styles.chipActive]}
              onPress={() => setRouteFilter(route.id)}
            >
              <Text style={[styles.chipText, routeFilter === route.id && styles.chipTextActive]}>
                {route.title} ({route.stops.length})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.filterLabel}>Repeat / follow-up · {customerDateLabel}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
          {REPEAT_OPTIONS.map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.chip, repeatFilter === r && styles.chipActive]}
              onPress={() => setRepeatFilter(r)}
            >
              <Text style={[styles.chipText, repeatFilter === r && styles.chipTextActive]}>
                {repeatChipLabel(r, customerDate)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.filterLabel}>Pipeline stage · {customerDateLabel}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          <TouchableOpacity
            style={[styles.chip, pipelineFilter === 'all' && styles.chipActive]}
            onPress={() => setPipelineFilter('all')}
          >
            <Text style={[styles.chipText, pipelineFilter === 'all' && styles.chipTextActive]}>
              All ({totalBeforePipeline})
            </Text>
          </TouchableOpacity>
          {Object.entries(pipelineCounts).map(([stage, count]) => (
            <TouchableOpacity
              key={stage}
              style={[
                styles.chip,
                pipelineFilter === stage && styles.chipActive,
                { borderColor: CRM_PIPELINE_COLORS[stage] || COLORS.primary },
              ]}
              onPress={() => setPipelineFilter(stage)}
            >
              <Text style={[styles.chipText, pipelineFilter === stage && styles.chipTextActive]}>
                {PIPELINE_LABELS[stage] || stage} ({count})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.legend}>
          <LegendDot color={statusColor('visited')} label={`Visited (${customerDateLabel})`} />
          <LegendDot
            color={statusColor('due')}
            label={customerDateYmd === toDateYmd(new Date()) ? 'Due today' : 'Due on date'}
          />
          <LegendDot color={statusColor('overdue')} label="Overdue" />
        </View>

        {selected?.hasGps && selected.client.location ? (
          <NativeMapPreview
            lat={selected.client.location.lat}
            lng={selected.client.location.lng}
            label={selected.client.name || 'Client'}
            subtitle={[selected.client.area, selected.client.district].filter(Boolean).join(' · ') || undefined}
          />
        ) : (
          <View style={styles.mapPlaceholder}>
            <Text style={styles.empty}>Select a client with GPS to view the map.</Text>
          </View>
        )}

        {selected ? (
          <View style={styles.selectedCard}>
            <Text style={styles.cardTitle}>{selected.client.name || 'Client'}</Text>
            <Text style={styles.cardMeta}>
              {agentDisplayName(agents, selected.client.assignedRepId)}
              {' · '}
              {PIPELINE_LABELS[selected.client.pipelineStage || 'new_lead'] || selected.client.pipelineStage}
            </Text>
            {selected.client.phone ? <Text style={styles.cardMeta}>{selected.client.phone}</Text> : null}
            {selected.client.nextFollowUpAt ? (
              <Text style={styles.cardMeta}>
                Next visit: {new Date(selected.client.nextFollowUpAt).toLocaleString()}
              </Text>
            ) : null}
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => void callClient(selected.client.phone)}>
                <Text style={styles.actionBtnText}>📞 Call</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.waBtn]}
                onPress={() => void whatsappClient(selected.client.phone, `Hi ${selected.client.name || ''}, `)}
              >
                <Text style={[styles.actionBtnText, styles.waText]}>💬 WhatsApp</Text>
              </TouchableOpacity>
              {clientCanShareLocationForDriver(selected.client) ? (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.driverBtn]}
                  onPress={() => void whatsappShareClientLocationForDriver(selected.client)}
                >
                  <Text style={[styles.actionBtnText, styles.driverBtnText]}>🚚 Driver</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() =>
                  navigation.navigate('CrmClientDetail', {
                    clientId: selected.client.id,
                    clientName: selected.client.name || 'Client',
                  })
                }
              >
                <Text style={styles.actionBtnText}>Open</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <Text style={styles.section}>Clients · {customerDateLabel} ({mapped.length})</Text>
        {mapped.length === 0 ? (
          <Text style={styles.empty}>
            No clients match these filters for {customerDateLabel}. Try another date, agent, route, or repeat filter.
          </Text>
        ) : (
          mapped.map(({ client: c, mapStatus, hasGps }) => (
            <TouchableOpacity
              key={c.id}
              style={[styles.card, selectedId === c.id && styles.cardSelected]}
              onPress={() => setSelectedId(c.id)}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.dot, { backgroundColor: statusColor(mapStatus) }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{c.name || 'Unnamed'}</Text>
                  <Text style={styles.cardMeta}>
                    {agentDisplayName(agents, c.assignedRepId)}
                    {c.pipelineStage ? ` · ${PIPELINE_LABELS[c.pipelineStage] || c.pipelineStage}` : ''}
                  </Text>
                  <Text style={styles.cardMeta}>
                    {[c.district, c.area].filter(Boolean).join(' · ') || '—'}
                    {hasGps ? '' : ' · No GPS'}
                  </Text>
                </View>
              </View>
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.miniBtn} onPress={() => void callClient(c.phone)}>
                  <Text style={styles.miniBtnText}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.miniBtn, styles.waMini]} onPress={() => void whatsappClient(c.phone)}>
                  <Text style={[styles.miniBtnText, styles.waText]}>WA</Text>
                </TouchableOpacity>
                {hasGps && c.location ? (
                  <TouchableOpacity
                    style={styles.miniBtn}
                    onPress={() => Linking.openURL(googleMapsUrl(c.location!.lat, c.location!.lng))}
                  >
                    <Text style={styles.miniBtnText}>Map</Text>
                  </TouchableOpacity>
                ) : null}
                {clientCanShareLocationForDriver(c) ? (
                  <TouchableOpacity
                    style={[styles.miniBtn, styles.driverMini]}
                    onPress={() => void whatsappShareClientLocationForDriver(c)}
                  >
                    <Text style={[styles.miniBtnText, styles.driverMiniText]}>Driver</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </ScreenSafeArea>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 8 },
  errorBody: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: 20, paddingVertical: 12 },
  retryBtnText: { color: '#fff', fontWeight: '700' },
  errorBanner: {
    backgroundColor: '#fef2f2',
    borderRadius: RADIUS.md,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorBannerText: { color: COLORS.error, fontSize: 14 },
  errorBannerRetry: { color: COLORS.primary, fontWeight: '700', marginTop: 6, fontSize: 13 },
  scroll: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  sub: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4, marginBottom: 12 },
  filterLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, marginTop: 8, marginBottom: 4 },
  chipRow: { marginBottom: 4, flexGrow: 0 },
  chipRowContent: { flexDirection: 'row', alignItems: 'center' },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.border,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    alignSelf: 'flex-start',
  },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { fontSize: 13, color: COLORS.textPrimary },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  toggleRow: {
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  toggleRowActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  toggleText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  toggleTextActive: { color: COLORS.primary, fontWeight: '700' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginVertical: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: COLORS.textSecondary },
  mapPlaceholder: {
    height: 120,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  selectedCard: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  section: { fontSize: 16, fontWeight: '700', marginTop: 20, marginBottom: 10, color: COLORS.textPrimary },
  empty: { color: COLORS.textMuted, fontStyle: 'italic', marginBottom: 8, fontSize: 14 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 10,
    ...SHADOW.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSelected: { borderColor: COLORS.primary },
  cardHeader: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  cardTitle: { fontWeight: '700', fontSize: 16, color: COLORS.textPrimary },
  cardMeta: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  waBtn: { backgroundColor: '#dcfce7', borderColor: '#22c55e' },
  driverBtn: { backgroundColor: '#fef3c7', borderColor: '#f59e0b' },
  driverBtnText: { color: '#b45309' },
  actionBtnText: { fontWeight: '700', fontSize: 13, color: COLORS.textPrimary },
  waText: { color: '#15803d' },
  miniBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
  },
  waMini: { backgroundColor: '#dcfce7' },
  driverMini: { backgroundColor: '#fef3c7' },
  driverMiniText: { color: '#b45309' },
  miniBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
});
