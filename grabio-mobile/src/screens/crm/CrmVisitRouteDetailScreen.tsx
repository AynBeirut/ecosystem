import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import firestore from '@react-native-firebase/firestore';
import ScreenSafeArea from '../../components/ScreenSafeArea';
import NativeMapPreview from '../../components/NativeMapPreview';
import CrmVisitOutcomeModal, { type VisitOutcomeSubmit } from '../../components/CrmVisitOutcomeModal';
import { useAuth } from '../../context/AuthContext';
import { canAssignCrmClients, resolveMobileCrmRepId, collectMobileCrmRepIds } from '../../lib/crmRepResolve';
import {
  fetchVisitRoute,
  googleMapsDirectionsUrl,
  markVisitRouteStopDone,
  REPEAT_LABELS,
  routeProgressOnDate,
  stopDoneOnDate,
  type CrmVisitRoute,
} from '../../lib/crmVisitRouteService';
import { RootStackParamList } from '../../types';
import { COLORS, RADIUS, SHADOW } from '../../theme';

type Route = RouteProp<RootStackParamList, 'CrmVisitRouteDetail'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function CrmVisitRouteDetailScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const { routeId, occurrenceDate } = route.params;
  const canEditRoute = canAssignCrmClients(user?.userRole, user?.subAccountRole);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CrmVisitRoute | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [visitClient, setVisitClient] = useState<{ id: string; name: string } | null>(null);
  const [myRepId, setMyRepId] = useState<string | null>(null);
  const [myRepIds, setMyRepIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const row = await fetchVisitRoute(routeId);
      if (!row) {
        setData(null);
        setLoadError('Could not load this route. You may not have access, or it was removed.');
        return;
      }
      setData(row);
      if (user?.uid) {
        try {
          const repId = await resolveMobileCrmRepId({ ...user, storeId: row.storeId });
          const repIds = await collectMobileCrmRepIds({ ...user, storeId: row.storeId });
          setMyRepId(repId);
          setMyRepIds(repIds);
        } catch {
          setMyRepId(row.assignedRepId || null);
          setMyRepIds(row.assignedRepId ? [row.assignedRepId] : []);
        }
      }
    } catch (e) {
      setData(null);
      setLoadError(e instanceof Error ? e.message : 'Could not load route');
    } finally {
      setLoading(false);
    }
  }, [routeId, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const resolveRep = () => {
    if (!data) return null;
    return myRepId
      || (myRepIds.includes(data.assignedRepId) ? data.assignedRepId : null)
      || data.assignedRepId;
  };

  const submitVisitOutcome = async (clientId: string, clientName: string, outcome: VisitOutcomeSubmit) => {
    if (!data || !user) return;
    const repId = resolveRep();
    if (!repId) {
      Alert.alert('Error', 'No sales agent on this route.');
      return;
    }

    const result =
      outcome.choice === 'next_visit'
        ? 'follow_up'
        : outcome.choice === 'feedback'
          ? 'interested'
          : 'interested';

    await markVisitRouteStopDone({
      route: data,
      occurrenceYmd: occurrenceDate,
      clientId,
      repId,
      repName: data.assignedRepName,
      userId: user.uid,
      notes: outcome.notes || `Visit route: ${data.title} · ${clientName}`,
      followUpAt: outcome.followUpAt,
      result,
      orderTaken: outcome.orderTaken,
    });

    if (outcome.choice === 'order') {
      const snap = await firestore().collection('customers').doc(clientId).get();
      const c = snap.data() || {};
      navigation.navigate('CreateOrder', {
        customerId: clientId,
        customerName: String(c.name || clientName),
        customerPhone: String(c.phone || ''),
      });
    }

    await load();
  };

  const openVisitModal = (clientId: string, clientName: string) => {
    setVisitClient({ id: clientId, name: clientName });
  };

  if (loading) {
    return (
      <ScreenSafeArea style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </ScreenSafeArea>
    );
  }

  if (!data || loadError) {
    return (
      <ScreenSafeArea style={styles.centered}>
        <Text style={styles.errorTitle}>Visit route unavailable</Text>
        <Text style={styles.errorBody}>{loadError || 'Route not found.'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => void load()}>
          <Text style={styles.retryBtnText}>Tap to retry</Text>
        </TouchableOpacity>
      </ScreenSafeArea>
    );
  }

  const progress = routeProgressOnDate(data, occurrenceDate);
  const firstGps = data.stops.find((s) => s.lat != null && s.lng != null);
  const directionsUrl = googleMapsDirectionsUrl(data.stops);

  return (
    <ScreenSafeArea style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{data.title}</Text>
          {canEditRoute ? (
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => navigation.navigate('CrmVisitRouteForm', { routeId: data.id })}
            >
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <Text style={styles.meta}>
          📅 {occurrenceDate} · {data.assignedRepName}
          {data.repeatRule !== 'none' ? ` · ${REPEAT_LABELS[data.repeatRule]}` : ''}
        </Text>
        <Text style={styles.progress}>
          {progress.done}/{progress.total} visits done
        </Text>

        {firstGps ? (
          <NativeMapPreview
            lat={firstGps.lat!}
            lng={firstGps.lng!}
            label="First stop"
            subtitle={firstGps.clientName || undefined}
          />
        ) : null}

        {directionsUrl ? (
          <TouchableOpacity style={styles.mapsBtn} onPress={() => Linking.openURL(directionsUrl)}>
            <Text style={styles.mapsBtnText}>🗺 Open full route in Google Maps</Text>
          </TouchableOpacity>
        ) : null}

        <Text style={styles.section}>Stops — tap Visited, then pick outcome</Text>
        {data.stops
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((stop, idx) => {
            const done = stopDoneOnDate(data, occurrenceDate, stop.clientId);
            return (
              <View key={stop.clientId} style={[styles.stopCard, done && styles.stopDone]}>
                <View style={styles.stopHeader}>
                  <Text style={styles.stopNum}>{idx + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stopName}>{stop.clientName}</Text>
                    <Text style={styles.stopMeta}>
                      {[stop.district, stop.area].filter(Boolean).join(' · ') || '—'}
                    </Text>
                  </View>
                  {done ? (
                    <Text style={styles.doneBadge}>✓ Done</Text>
                  ) : (
                    <TouchableOpacity
                      style={styles.doneBtn}
                      onPress={() => openVisitModal(stop.clientId, stop.clientName)}
                      disabled={markingId === stop.clientId}
                    >
                      {markingId === stop.clientId ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.doneBtnText}>Visited</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
                {stop.lat != null && stop.lng != null ? (
                  <TouchableOpacity
                    onPress={() => Linking.openURL(`https://www.google.com/maps?q=${stop.lat},${stop.lng}`)}
                  >
                    <Text style={styles.mapLink}>Open on map</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}
      </ScrollView>

      <CrmVisitOutcomeModal
        visible={visitClient != null}
        clientName={visitClient?.name || 'Client'}
        onClose={() => setVisitClient(null)}
        onSubmit={async (outcome) => {
          if (!visitClient) return;
          setMarkingId(visitClient.id);
          try {
            await submitVisitOutcome(visitClient.id, visitClient.name, outcome);
            setVisitClient(null);
          } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Could not save visit');
          } finally {
            setMarkingId(null);
          }
        }}
      />
    </ScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 8, textAlign: 'center' },
  errorBody: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  retryBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: 20, paddingVertical: 12 },
  retryBtnText: { color: '#fff', fontWeight: '700' },
  scroll: { padding: 16, paddingBottom: 40 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, flex: 1 },
  editBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  editBtnText: { color: COLORS.primary, fontWeight: '700' },
  meta: { fontSize: 14, color: COLORS.textSecondary, marginTop: 6 },
  progress: { fontSize: 15, fontWeight: '700', color: COLORS.primary, marginTop: 8, marginBottom: 12 },
  mapWrap: { height: 200, borderRadius: RADIUS.lg, overflow: 'hidden', marginBottom: 10, ...SHADOW.sm },
  map: { flex: 1 },
  mapsBtn: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
    padding: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  mapsBtnText: { color: COLORS.primary, fontWeight: '700' },
  section: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 10 },
  stopCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.sm,
  },
  stopDone: { borderColor: COLORS.success, backgroundColor: '#f0fdf4' },
  stopHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stopNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 28,
    fontWeight: '800',
    fontSize: 14,
  },
  stopName: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  stopMeta: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  doneBadge: { color: COLORS.success, fontWeight: '800', fontSize: 14 },
  doneBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 76,
    alignItems: 'center',
  },
  doneBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  mapLink: { marginTop: 8, fontSize: 13, color: COLORS.primary, fontWeight: '600' },
});
