import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ScreenSafeArea from '../../components/ScreenSafeArea';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useNavigation, useFocusEffect, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../types';
import { COLORS, RADIUS, SHADOW } from '../../theme';
import TabletScreen from '../../components/TabletScreen';
import { useTabletLayout } from '../../hooks/useTabletLayout';
import { useResolvedStoreId } from '../../hooks/useResolvedStoreId';
import {
  canAssignClientGpsLocation,
  canFilterBySalesAgent,
  collectMobileCrmRepIds,
  hasStoreAdminAccess,
  isFieldSalesRep,
  resolveMobileCrmRepId,
} from '../../lib/crmRepResolve';
import {
  agentDisplayName,
  agentsForFilterChips,
  fetchAssignedClients,
  fetchCrmAssignableAgents,
  type CrmAssignableAgent,
  type CrmClient,
} from '../../lib/crmMobileService';
import { fetchVisitRoutes, invalidateVisitRouteCache, type CrmVisitRoute } from '../../lib/crmVisitRouteService';
import CrmUpcomingRoutesList from '../../components/CrmUpcomingRoutesList';
import AssignClientLocationFab from '../../components/AssignClientLocationFab';
import { formatLastVisit } from '../../lib/crmVisitMetrics';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type ClientsRoute = RouteProp<RootStackParamList, 'CrmMyClients'>;

function isOverdue(c: CrmClient) {
  if (!c.nextFollowUpAt) return false;
  return new Date(c.nextFollowUpAt).getTime() < Date.now();
}

export default function CrmMyClientsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const route = useRoute<ClientsRoute>();
  const { isTablet, gridColumns } = useTabletLayout();
  const [clients, setClients] = useState<CrmClient[]>([]);
  const [agents, setAgents] = useState<CrmAssignableAgent[]>([]);
  const [visitRoutes, setVisitRoutes] = useState<CrmVisitRoute[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [repFilter, setRepFilter] = useState('all');
  const [myRepId, setMyRepId] = useState<string | null>(null);
  const [myRepIds, setMyRepIds] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [assignLocationOpen, setAssignLocationOpen] = useState(false);
  const { storeId, loading: storeLoading } = useResolvedStoreId();
  const isManager = hasStoreAdminAccess(user?.userRole, user?.subAccountRole);
  const isSalesRep = isFieldSalesRep(user?.userRole);
  const canFilterAgents = canFilterBySalesAgent(user?.userRole, user?.subAccountRole);
  const canAssignGps = canAssignClientGpsLocation(user?.userRole, user?.subAccountRole);

  const loadRoutes = useCallback(async (opts?: { force?: boolean }) => {
    if (!storeId || !user) return;
    if (opts?.force) invalidateVisitRouteCache(storeId);
    const managerView = isManager && !isSalesRep;
    const repIds = managerView ? undefined : await collectMobileCrmRepIds({ ...user, storeId });
    if (repIds) setMyRepIds(repIds);
    const routes = await fetchVisitRoutes(storeId, {
      managerView,
      repIds,
      assignedUserId: managerView ? undefined : user.uid,
    });
    setVisitRoutes(routes);
  }, [storeId, user, isManager, isSalesRep]);

  useFocusEffect(
    useCallback(() => {
      void loadRoutes({ force: visitRoutes.length === 0 });
    }, [loadRoutes, visitRoutes.length]),
  );

  const load = useCallback(async () => {
    if (!user) {
      setClientsLoading(false);
      return;
    }
    if (!storeId) {
      setLoadError('Store not linked to your account.');
      setClientsLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      setClientsLoading(true);
      setLoadError(null);
      const managerView = isManager && !isSalesRep;
      const repId = await resolveMobileCrmRepId({ ...user, storeId });
      setMyRepId(repId);
      const repIds = isManager && !isSalesRep ? [] : await collectMobileCrmRepIds({ ...user, storeId });
      setMyRepIds(repIds);
      const [list, agentList] = await Promise.all([
        fetchAssignedClients(storeId, { ...user, storeId }, { managerView }),
        canFilterAgents ? fetchCrmAssignableAgents(storeId) : Promise.resolve([]),
      ]);
      setClients(list);
      setAgents(agentList);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not load CRM clients';
      setLoadError(msg);
      setClients([]);
      setAgents([]);
    } finally {
      setClientsLoading(false);
      setRefreshing(false);
    }
  }, [user, storeId, isManager, isSalesRep, canFilterAgents]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      const stackParams = route.params as { openAssignLocation?: boolean } | undefined;
      if (stackParams?.openAssignLocation) {
        setAssignLocationOpen(true);
      }
    }, [route.params]),
  );

  const sorted = useMemo(() => {
    let base = clients;
    if (canFilterAgents && repFilter !== 'all') {
      base = repFilter === 'unassigned'
        ? base.filter((c) => !c.assignedRepId)
        : base.filter((c) => c.assignedRepId === repFilter);
    }
    const filtered = search
      ? base.filter(
          (c) =>
            (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (c.phone || '').includes(search),
        )
      : base;
    return [...filtered].sort((a, b) => {
      const ao = isOverdue(a) ? 0 : 1;
      const bo = isOverdue(b) ? 0 : 1;
      if (ao !== bo) return ao - bo;
      const af = a.nextFollowUpAt ? new Date(a.nextFollowUpAt).getTime() : Infinity;
      const bf = b.nextFollowUpAt ? new Date(b.nextFollowUpAt).getTime() : Infinity;
      return af - bf;
    });
  }, [clients, search, repFilter, canFilterAgents]);

  const filterAgents = agentsForFilterChips(agents);

  const listHeader = (
    <>
      <Text style={styles.heading}>
        {isSalesRep ? 'My clients' : isManager ? 'All CRM clients' : 'My clients'}
      </Text>
      <CrmUpcomingRoutesList
        routes={visitRoutes}
        repFilter={canFilterAgents ? repFilter : undefined}
        repIds={canFilterAgents ? undefined : myRepIds}
        onCreateRoute={() => navigation.navigate('CrmVisitRouteForm')}
        compact
      />
      {canAssignGps ? (
        <Text style={styles.assignLocHint}>
          At a client with no GPS? Use the green Capture location button below.
        </Text>
      ) : null}
      {isManager || isSalesRep ? (
        <View style={styles.adminRow}>
          <TouchableOpacity style={styles.adminBtn} onPress={() => navigation.navigate('CrmTasks')}>
            <Text style={styles.adminBtnText}>✅ Tasks</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.adminBtn} onPress={() => navigation.navigate('CrmTeamMap')}>
            <Text style={styles.adminBtnText}>🗺 Map</Text>
          </TouchableOpacity>
          {isManager ? (
            <>
              <TouchableOpacity style={styles.adminBtn} onPress={() => navigation.navigate('CrmStoreAreas')}>
                <Text style={styles.adminBtnText}>📍 Areas</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.adminBtn} onPress={() => navigation.navigate('CrmPerformance')}>
                <Text style={styles.adminBtnText}>📊 Stats</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      ) : null}
      {loadError ? (
        <TouchableOpacity style={styles.errorBox} onPress={() => { setClientsLoading(true); void load(); }}>
          <Text style={styles.errorText}>{loadError}</Text>
          <Text style={styles.errorRetry}>Tap to retry</Text>
        </TouchableOpacity>
      ) : null}
      {canFilterAgents && filterAgents.length > 0 ? (
        <>
          <Text style={styles.filterLabel}>Assigned to</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.filterChip, repFilter === 'all' && styles.filterChipActive]}
              onPress={() => setRepFilter('all')}
            >
              <Text style={[styles.filterChipText, repFilter === 'all' && styles.filterChipTextActive]}>All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterChip, repFilter === 'unassigned' && styles.filterChipActive]}
              onPress={() => setRepFilter('unassigned')}
            >
              <Text style={[styles.filterChipText, repFilter === 'unassigned' && styles.filterChipTextActive]}>Unassigned</Text>
            </TouchableOpacity>
            {filterAgents.map((a) => (
              <TouchableOpacity
                key={a.id}
                style={[styles.filterChip, repFilter === a.id && styles.filterChipActive]}
                onPress={() => setRepFilter(a.id)}
              >
                <Text style={[styles.filterChipText, repFilter === a.id && styles.filterChipTextActive]}>{a.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      ) : null}
      <TextInput
        style={styles.search}
        placeholder="Search clients…"
        placeholderTextColor={COLORS.textMuted}
        value={search}
        onChangeText={setSearch}
      />
    </>
  );

  if (storeLoading) {
    return (
      <ScreenSafeArea style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading CRM…</Text>
        </View>
      </ScreenSafeArea>
    );
  }

  return (
    <ScreenSafeArea style={styles.container}>
      <TabletScreen centered={false}>
        <FlatList
          style={styles.list}
          data={sorted}
          key={isTablet ? `tablet-${gridColumns}` : 'phone-1'}
          numColumns={isTablet ? gridColumns : 1}
          keyExtractor={(item) => item.id}
          initialNumToRender={12}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews
          columnWrapperStyle={isTablet ? styles.columnWrap : undefined}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={listHeader}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); void loadRoutes({ force: true }); }} colors={[COLORS.primary]} />
          }
          ListEmptyComponent={
            clientsLoading ? (
              <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 24 }} />
            ) : !loadError ? (
              <Text style={styles.empty}>
                {isSalesRep
                  ? 'No clients assigned to you yet. Ask your manager to assign clients in CRM.'
                  : 'No clients yet. Tap ＋ below to add your first CRM client.'}
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, isTablet && styles.cardTablet]}
              onPress={() => navigation.navigate('CrmClientDetail', { clientId: item.id, clientName: item.name || 'Client' })}
            >
              <Text style={styles.name}>{item.name || 'Unnamed'}</Text>
              {canFilterAgents ? (
                <Text style={styles.repTag}>Rep: {agentDisplayName(agents, item.assignedRepId)}</Text>
              ) : null}
              {item.phone ? <Text style={styles.meta}>{item.phone}</Text> : null}
              {(item.district || item.area) ? (
                <Text style={styles.meta}>{[item.district, item.area].filter(Boolean).join(' · ')}</Text>
              ) : null}
              <Text style={styles.meta}>Last visit: {formatLastVisit(item.lastVisitDate || item.lastActivityAt)}</Text>
              {item.pipelineStage ? <Text style={styles.stage}>{item.pipelineStage.replace(/_/g, ' ')}</Text> : null}
              {item.nextFollowUpAt ? (
                <Text style={[styles.followUp, isOverdue(item) && styles.followUpOverdue]}>
                  Visit: {new Date(item.nextFollowUpAt).toLocaleString()}
                </Text>
              ) : null}
            </TouchableOpacity>
          )}
        />
        {canAssignGps || isManager || isSalesRep ? (
          <View style={styles.bottomBar}>
            {canAssignGps ? (
              <AssignClientLocationFab
                clients={clients}
                variant="bar"
                autoOpen={assignLocationOpen}
                onSaved={() => {
                  setAssignLocationOpen(false);
                  void load();
                }}
              />
            ) : null}
            {isManager || isSalesRep ? (
              <TouchableOpacity
                style={[styles.newClientBtn, !canAssignGps && styles.newClientBtnFull]}
                onPress={() => navigation.navigate('CrmClientForm', {})}
              >
                <Text style={styles.newClientBtnText}>＋ New</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </TabletScreen>
    </ScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, color: COLORS.textSecondary, fontSize: 15 },
  list: { flex: 1 },
  listContent: { paddingBottom: 100, flexGrow: 1 },
  heading: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary, marginTop: 8, marginBottom: 4 },
  adminRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  adminBtn: {
    flex: 1,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  adminBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 14 },
  assignLocHint: {
    fontSize: 12,
    color: '#059669',
    marginBottom: 8,
    fontWeight: '600',
    lineHeight: 17,
  },
  filterLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginTop: 8 },
  filterRow: { marginBottom: 4, marginTop: 6 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.border,
    marginRight: 8,
  },
  filterChipActive: { backgroundColor: COLORS.primary },
  filterChipText: { fontSize: 13, color: COLORS.textPrimary },
  filterChipTextActive: { color: '#fff', fontWeight: '700' },
  search: {
    marginVertical: 12,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: 16,
    color: COLORS.textPrimary,
    minHeight: 52,
  },
  columnWrap: { gap: 12 },
  card: {
    flex: 1,
    marginBottom: 12,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 16,
    ...SHADOW.sm,
    minHeight: 110,
  },
  cardTablet: { marginHorizontal: 4 },
  name: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  repTag: { fontSize: 12, color: COLORS.primary, marginTop: 4, fontWeight: '600' },
  meta: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
  stage: { fontSize: 13, color: COLORS.primary, marginTop: 6, textTransform: 'capitalize' },
  followUp: { fontSize: 13, color: COLORS.textMuted, marginTop: 6 },
  followUpOverdue: { color: COLORS.error, fontWeight: '700' },
  empty: { textAlign: 'center', marginTop: 40, color: COLORS.textMuted, fontSize: 15, lineHeight: 22 },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderRadius: RADIUS.md,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: { color: COLORS.error, fontSize: 14 },
  errorRetry: { color: COLORS.primary, fontWeight: '700', marginTop: 6, fontSize: 13 },
  bottomBar: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 10,
  },
  newClientBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 88,
    minHeight: 52,
    elevation: 6,
  },
  newClientBtnFull: { flex: 1 },
  newClientBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
