import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ScreenSafeArea from '../../components/ScreenSafeArea';
import DatePickerField from '../../components/DatePickerField';
import FilterSelectField from '../../components/FilterSelectField';
import { useAuth } from '../../context/AuthContext';
import { useResolvedStoreId } from '../../hooks/useResolvedStoreId';
import {
  canFilterBySalesAgent,
  collectMobileCrmRepIds,
  hasStoreAdminAccess,
  isFieldSalesRep,
} from '../../lib/crmRepResolve';
import {
  fetchAssignedClients,
  fetchTeamFilterAgents,
  fetchCrmReps,
  fetchStoreActivities,
  clientAreaOrDistrict,
  type CrmAssignableAgent,
  type CrmRep,
} from '../../lib/crmMobileService';
import { fetchAllCrmStoreAreaNames } from '../../lib/crmStoreAreaService';
import {
  fetchVisitRoutes,
  type CrmVisitRoute,
} from '../../lib/crmVisitRouteService';
import {
  computeAreaCoverage,
  computeDistrictCoverage,
  computeRepDailyMetrics,
  filterActivitiesForDay,
  filterClientsForPerformance,
  listVisitedClientsOnDay,
} from '../../lib/crmVisitMetrics';
import { RootStackParamList } from '../../types';
import { COLORS, RADIUS, SHADOW } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type DateMode = 'today' | 'yesterday' | 'pick';

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function FilterChips({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ id: string; name: string }>;
  onChange: (id: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <View style={styles.filterBlock}>
      <Text style={styles.filterLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterRowContent}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt.id}
            style={[styles.filterChip, value === opt.id && styles.filterChipActive]}
            onPress={() => onChange(opt.id)}
          >
            <Text style={[styles.filterChipText, value === opt.id && styles.filterChipTextActive]}>
              {opt.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

export default function CrmPerformanceScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const { storeId } = useResolvedStoreId();
  const isAdmin = hasStoreAdminAccess(user?.userRole, user?.subAccountRole);
  const isSalesRep = isFieldSalesRep(user?.userRole);
  const canFilterAgents = canFilterBySalesAgent(user?.userRole, user?.subAccountRole);
  const [loading, setLoading] = useState(true);
  const [reps, setReps] = useState<CrmRep[]>([]);
  const [agents, setAgents] = useState<CrmAssignableAgent[]>([]);
  const [visitRoutes, setVisitRoutes] = useState<CrmVisitRoute[]>([]);
  const [storeAreaNames, setStoreAreaNames] = useState<string[]>([]);
  const [repFilter, setRepFilter] = useState('all');
  const [areaFilter, setAreaFilter] = useState('all');
  const [routeFilter, setRouteFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [dateMode, setDateMode] = useState<DateMode>('today');
  const [pickDate, setPickDate] = useState<Date | null>(null);
  const [activities, setActivities] = useState<Array<Record<string, unknown>>>([]);
  const [clients, setClients] = useState<Awaited<ReturnType<typeof fetchAssignedClients>>>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const selectedDate = useMemo(() => {
    if (dateMode === 'today') return new Date();
    if (dateMode === 'yesterday') return addDays(new Date(), -1);
    return pickDate || new Date();
  }, [dateMode, pickDate]);

  const load = useCallback(async () => {
    if (!storeId || !user) {
      setLoading(false);
      return;
    }
    setLoadError(null);
    try {
      const managerView = isAdmin && !isSalesRep;
      const repIds = managerView ? undefined : await collectMobileCrmRepIds({ ...user, storeId });
      const [repList, agentList, clientList, actList, routeList, areaNames] = await Promise.all([
        fetchCrmReps(storeId),
        canFilterAgents ? fetchTeamFilterAgents(storeId) : Promise.resolve([]),
        fetchAssignedClients(storeId, { ...user, storeId }, {
          managerView: isAdmin,
          repFilter: canFilterAgents ? repFilter : undefined,
        }),
        fetchStoreActivities(storeId, 400, canFilterAgents ? repFilter : undefined),
        fetchVisitRoutes(storeId, {
          managerView,
          repIds,
          assignedUserId: managerView ? undefined : user.uid,
        }),
        fetchAllCrmStoreAreaNames(storeId),
      ]);
      setReps(repList);
      setAgents(agentList);
      setClients(clientList);
      setActivities(actList);
      setVisitRoutes(routeList);
      setStoreAreaNames(areaNames);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not load performance data';
      setLoadError(msg);
      setClients([]);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, isSalesRep, storeId, user, canFilterAgents, repFilter]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    if (dateMode === 'pick' && !pickDate) {
      setPickDate(new Date());
    }
  }, [dateMode, pickDate]);

  const routeRepKey = useMemo(() => {
    if (!canFilterAgents || repFilter === 'all') return undefined;
    return repFilter;
  }, [canFilterAgents, repFilter]);

  const routeStopIds = useMemo(() => {
    if (routeFilter === 'all') return undefined;
    const route = visitRoutes.find((r) => r.id === routeFilter);
    if (!route) return new Set<string>();
    return new Set(route.stops.map((s) => s.clientId));
  }, [routeFilter, visitRoutes]);

  const scopedClients = useMemo(
    () =>
      filterClientsForPerformance(clients, {
        area: areaFilter,
        routeStopIds,
        clientId: clientFilter,
        repId: canFilterAgents ? repFilter : undefined,
      }),
    [clients, areaFilter, routeStopIds, clientFilter, repFilter, canFilterAgents],
  );

  const scopedClientIds = useMemo(() => new Set(scopedClients.map((c) => c.id)), [scopedClients]);

  const scopedActivities = useMemo(
    () => filterActivitiesForDay(activities as never, selectedDate, scopedClientIds),
    [activities, selectedDate, scopedClientIds],
  );

  const performanceReps = useMemo(() => {
    if (reps.length > 0) {
      return reps.map((r) => ({ id: r.id, name: r.name, dailyVisitTarget: r.dailyVisitTarget }));
    }
    return agents.map((a) => ({ id: a.id, name: a.name, dailyVisitTarget: undefined }));
  }, [reps, agents]);

  const repMetrics = useMemo(
    () =>
      performanceReps
        .filter((rep) => repFilter === 'all' || rep.id === repFilter)
        .map((rep) => {
          const assigned = scopedClients.filter((c) => c.assignedRepId === rep.id);
          return computeRepDailyMetrics(rep, assigned, scopedActivities as never, selectedDate);
        }),
    [performanceReps, scopedClients, scopedActivities, repFilter, selectedDate],
  );

  const districtMetrics = useMemo(
    () => computeDistrictCoverage(scopedClients, scopedActivities as never, selectedDate),
    [scopedClients, scopedActivities, selectedDate],
  );

  const areaMetrics = useMemo(
    () => computeAreaCoverage(scopedClients, scopedActivities as never, selectedDate),
    [scopedClients, scopedActivities, selectedDate],
  );

  const visitedClients = useMemo(
    () => listVisitedClientsOnDay(scopedClients, scopedActivities as never, selectedDate),
    [scopedClients, scopedActivities, selectedDate],
  );

  const areaOptions = useMemo(() => {
    const set = new Set<string>(storeAreaNames);
    clients.forEach((c) => {
      const area = (c.area || '').trim();
      if (area) set.add(area);
      const label = clientAreaOrDistrict(c);
      if (label) set.add(label);
    });
    return [{ id: 'all', name: 'All areas' }, ...[...set].sort().map((a) => ({ id: a, name: a }))];
  }, [clients, storeAreaNames]);

  const routeOptions = useMemo(() => {
    const active = visitRoutes.filter((r) => r.status !== 'archived');
    const list = routeRepKey
      ? active.filter((r) => r.assignedRepId === routeRepKey)
      : active;
    const sorted = [...list].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    return [
      { id: 'all', name: `All routes (${sorted.length})` },
      ...sorted.map((r) => ({
        id: r.id,
        name: r.title?.trim() || 'Unnamed route',
      })),
    ];
  }, [visitRoutes, routeRepKey]);

  const clientOptions = useMemo(() => {
    const withoutClient = filterClientsForPerformance(clients, {
      area: areaFilter,
      routeStopIds,
      repId: canFilterAgents ? repFilter : undefined,
    });
    const acts = filterActivitiesForDay(
      activities as never,
      selectedDate,
      new Set(withoutClient.map((c) => c.id)),
    );
    const visited = listVisitedClientsOnDay(withoutClient, acts as never, selectedDate);
    return [
      { id: 'all', name: 'All clients' },
      ...visited.map((v) => ({ id: v.client.id, name: v.client.name || 'Client' })),
    ];
  }, [clients, areaFilter, routeStopIds, repFilter, canFilterAgents, activities, selectedDate]);

  useEffect(() => {
    setRouteFilter('all');
  }, [repFilter]);

  useEffect(() => {
    if (routeFilter !== 'all' && !routeOptions.some((r) => r.id === routeFilter)) {
      setRouteFilter('all');
    }
  }, [routeFilter, routeOptions]);

  useEffect(() => {
    if (clientFilter !== 'all' && !clientOptions.some((c) => c.id === clientFilter)) {
      setClientFilter('all');
    }
  }, [clientFilter, clientOptions]);

  const dateLabel = selectedDate.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  if (loading) {
    return (
      <ScreenSafeArea style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      </ScreenSafeArea>
    );
  }

  return (
    <ScreenSafeArea style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Rep performance</Text>
        <Text style={styles.sub}>Visits and coverage for {dateLabel}.</Text>
        {loadError ? (
          <TouchableOpacity style={styles.errorBanner} onPress={() => { setLoading(true); void load(); }}>
            <Text style={styles.errorBannerText}>{loadError} Tap to retry.</Text>
          </TouchableOpacity>
        ) : null}

        <Text style={styles.filterLabel}>Date</Text>
        <View style={styles.dateRow}>
          {(['today', 'yesterday', 'pick'] as DateMode[]).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[styles.filterChip, dateMode === mode && styles.filterChipActive]}
              onPress={() => setDateMode(mode)}
            >
              <Text style={[styles.filterChipText, dateMode === mode && styles.filterChipTextActive]}>
                {mode === 'today' ? 'Today' : mode === 'yesterday' ? 'Yesterday' : 'Pick date'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {dateMode === 'pick' ? (
          <DatePickerField
            label="Performance date"
            value={pickDate}
            onChange={setPickDate}
            placeholder="Select date…"
          />
        ) : null}

        {canFilterAgents && agents.length > 0 ? (
          <FilterChips
            label="Agent"
            value={repFilter}
            options={[{ id: 'all', name: 'All agents' }, ...agents.map((a) => ({ id: a.id, name: a.name }))]}
            onChange={setRepFilter}
          />
        ) : null}

        <FilterSelectField label="Area" value={areaFilter} options={areaOptions} onChange={setAreaFilter} />
        <FilterSelectField label="Route" value={routeFilter} options={routeOptions} onChange={setRouteFilter} />
        {routeFilter !== 'all' ? (
          <Text style={styles.filterHint}>
            Showing clients on this route only ({routeStopIds?.size || 0} stops).
          </Text>
        ) : null}
        <FilterChips label="Client" value={clientFilter} options={clientOptions} onChange={setClientFilter} />

        <Text style={styles.section}>Sales reps — {dateLabel}</Text>
        {repMetrics.length === 0 ? (
          <Text style={styles.empty}>No CRM reps configured yet.</Text>
        ) : (
          repMetrics.map((m) => (
            <View key={m.rep.id} style={styles.card}>
              <Text style={styles.cardTitle}>{m.rep.name}</Text>
              <Text style={styles.row}>Visited: {m.visited} / {m.target}</Text>
              <Text style={styles.row}>Remaining: {m.remaining}</Text>
              <Text style={styles.row}>Coverage: {m.coveragePct}%</Text>
              <Text style={styles.row}>Orders: {m.orders}</Text>
            </View>
          ))
        )}

        <Text style={styles.section}>Visited clients — {dateLabel}</Text>
        {visitedClients.length === 0 ? (
          <Text style={styles.empty}>No completed visits for these filters.</Text>
        ) : (
          visitedClients.map((row) => (
            <TouchableOpacity
              key={row.client.id}
              style={styles.card}
              onPress={() =>
                navigation.navigate('CrmClientDetail', {
                  clientId: row.client.id,
                  clientName: row.client.name || 'Client',
                })
              }
            >
              <Text style={styles.cardTitle}>{row.client.name || 'Client'}</Text>
              <Text style={styles.row}>
                {[row.client.area, row.client.district].filter(Boolean).join(' · ') || '—'}
              </Text>
              <Text style={styles.row}>
                {new Date(row.visitAt).toLocaleString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                })}
                {row.repName ? ` · ${row.repName}` : ''}
                {row.orderTaken ? ' · Order taken' : ''}
              </Text>
            </TouchableOpacity>
          ))
        )}

        <Text style={styles.section}>
          {areaFilter !== 'all' ? `Area — ${areaFilter}` : 'Area coverage (week of selected date)'}
        </Text>
        {areaFilter !== 'all' ? (
          areaMetrics.filter((a) => a.area === areaFilter).map((a) => (
            <View key={a.area} style={styles.card}>
              <Text style={styles.cardTitle}>{a.area}</Text>
              <Text style={styles.row}>
                Visited: {a.visitedThisWeek} / {a.totalCustomers} ({a.coveragePct}%)
              </Text>
              <Text style={styles.row}>Not visited: {a.notVisited}</Text>
            </View>
          ))
        ) : areaMetrics.length === 0 ? (
          <Text style={styles.empty}>No clients with areas yet.</Text>
        ) : (
          areaMetrics.map((a) => (
            <View key={a.area} style={styles.card}>
              <Text style={styles.cardTitle}>{a.area}</Text>
              <Text style={styles.row}>
                Visited: {a.visitedThisWeek} / {a.totalCustomers} ({a.coveragePct}%)
              </Text>
              <Text style={styles.row}>Not visited: {a.notVisited}</Text>
            </View>
          ))
        )}

        <Text style={styles.section}>District coverage (week of selected date)</Text>
        {districtMetrics.length === 0 ? (
          <Text style={styles.empty}>No clients with districts yet.</Text>
        ) : (
          districtMetrics.map((d) => (
            <View key={d.district} style={styles.card}>
              <Text style={styles.cardTitle}>{d.district}</Text>
              <Text style={styles.row}>
                Visited: {d.visitedThisWeek} / {d.totalCustomers} ({d.coveragePct}%)
              </Text>
              <Text style={styles.row}>Not visited: {d.notVisited}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </ScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  sub: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4, marginBottom: 12 },
  filterBlock: { marginBottom: 8 },
  filterLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, marginBottom: 6, textTransform: 'uppercase' },
  filterHint: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 8, marginTop: -2 },
  filterRow: { marginBottom: 4, flexGrow: 0 },
  filterRowContent: { flexDirection: 'row', alignItems: 'center' },
  dateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.border,
    marginRight: 8,
    alignSelf: 'flex-start',
  },
  filterChipActive: { backgroundColor: COLORS.primary },
  filterChipText: { fontSize: 13, color: COLORS.textPrimary },
  filterChipTextActive: { color: '#fff', fontWeight: '700' },
  section: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginTop: 20, marginBottom: 10 },
  empty: { color: COLORS.textMuted, fontStyle: 'italic', fontSize: 14 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.sm,
  },
  cardTitle: { fontWeight: '700', fontSize: 16, color: COLORS.textPrimary, marginBottom: 6 },
  row: { fontSize: 14, color: COLORS.textSecondary, marginTop: 2 },
  errorBanner: {
    marginBottom: 12,
    padding: 12,
    borderRadius: RADIUS.lg,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorBannerText: { color: COLORS.error, fontSize: 13 },
});
