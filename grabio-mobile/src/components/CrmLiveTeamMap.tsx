import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Linking } from 'react-native';
import type { CrmRepLiveLocation } from '../lib/crmMobileService';
import {
  formatLiveLocationAge,
  isLiveLocationFresh,
  isManagerLiveRole,
  liveRepMatchesAnyFilter,
  toLiveMapMarkers,
} from '../lib/crmLiveLocationUtils';
import { googleMapsUrl } from '../lib/crmMapUtils';
import NativeMapPreview from './NativeMapPreview';
import { COLORS, RADIUS, SHADOW } from '../theme';

type RosterAgent = {
  id: string;
  name: string;
  userId?: string;
};

type Props = {
  reps: CrmRepLiveLocation[];
  loading?: boolean;
  title?: string;
  subtitle?: string;
  highlightRepIds?: string[];
  rosterAgents?: RosterAgent[];
  onSelectRep?: (repId: string) => void;
};

export default function CrmLiveTeamMap({
  reps,
  loading,
  title = 'Live team map',
  subtitle,
  highlightRepIds = [],
  rosterAgents = [],
  onSelectRep,
}: Props) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const displayReps = useMemo(() => {
    if (!highlightRepIds.length) return reps;
    return reps.filter((r) => liveRepMatchesAnyFilter(r, highlightRepIds));
  }, [reps, highlightRepIds]);

  const offlineRoster = useMemo(() => {
    if (!rosterAgents.length) return [];
    const trackedUserIds = new Set(displayReps.map((r) => r.userId));
    const trackedRepIds = new Set(displayReps.map((r) => r.repId));
    return rosterAgents.filter((a) => {
      if (a.userId && trackedUserIds.has(a.userId)) return false;
      if (trackedRepIds.has(a.id)) return false;
      if (highlightRepIds.length && !highlightRepIds.includes(a.id) && (!a.userId || !highlightRepIds.includes(a.userId))) {
        return false;
      }
      return true;
    });
  }, [rosterAgents, displayReps, highlightRepIds]);

  const markers = useMemo(() => toLiveMapMarkers(displayReps), [displayReps]);
  const freshCount = displayReps.filter((r) => isLiveLocationFresh(r.updatedAtIso)).length;

  const selected =
    displayReps.find((r) => r.userId === selectedUserId) ?? displayReps[0] ?? null;

  const openRep = (r: CrmRepLiveLocation) => {
    setSelectedUserId(r.userId);
    onSelectRep?.(r.repId);
    void Linking.openURL(googleMapsUrl(r.lat, r.lng));
  };

  const openAllInMaps = () => {
    const first = displayReps[0];
    if (first) void Linking.openURL(googleMapsUrl(first.lat, first.lng));
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
        </View>
        <View style={styles.livePill}>
          <View style={[styles.liveDot, freshCount > 0 && styles.liveDotOn]} />
          <Text style={styles.liveText}>
            {freshCount > 0 ? `${freshCount} live` : `${displayReps.length || offlineRoster.length} tracked`}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : displayReps.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>
            {offlineRoster.length > 0
              ? 'No live GPS yet. Field agents must open Grabio with location on — last position shows for 12 hours.'
              : 'No team GPS in the last 12 hours. Sales reps must open Grabio with location allowed — it updates every minute while the app is open.'}
          </Text>
        </View>
      ) : (
        <>
          {selected ? (
            <NativeMapPreview
              lat={selected.lat}
              lng={selected.lng}
              label={selected.repName || 'Agent'}
              subtitle={formatLiveLocationAge(selected.updatedAtIso)}
              height={120}
            />
          ) : null}
          <View style={styles.nativeMapHint}>
            <Text style={styles.nativeMapTitle}>📍 {markers.length} team member{markers.length === 1 ? '' : 's'} on map</Text>
            <Text style={styles.nativeMapSub}>Tap a person below — opens Google Maps and filters by agent.</Text>
            {markers.length > 0 ? (
              <TouchableOpacity style={styles.openAllBtn} onPress={openAllInMaps}>
                <Text style={styles.openAllText}>Open nearest on map</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </>
      )}

      <View style={styles.legend}>
        <Text style={styles.legendItem}>🔵 Agent (live)</Text>
        <Text style={styles.legendItem}>🟣 Manager</Text>
        <Text style={styles.legendItem}>⚪ Stale</Text>
      </View>

      {displayReps.length > 0 ? (
        <View style={styles.repList}>
          {displayReps.map((r) => {
            const active = selected?.userId === r.userId;
            const fresh = isLiveLocationFresh(r.updatedAtIso);
            return (
              <TouchableOpacity
                key={r.userId}
                style={[styles.repRow, active && styles.repRowActive]}
                onPress={() => openRep(r)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Open ${r.repName || r.repId} on map`}
              >
                <View
                  style={[
                    styles.repDot,
                    isManagerLiveRole(r.role)
                      ? styles.repDotManager
                      : fresh
                        ? styles.repDotLive
                        : styles.repDotStale,
                  ]}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.repName}>{r.repName || r.repId}</Text>
                  <Text style={styles.repMeta}>
                    {formatLiveLocationAge(r.updatedAtIso)}
                    {' · '}
                    {r.lat.toFixed(4)}, {r.lng.toFixed(4)}
                  </Text>
                </View>
                <Text style={styles.openMap}>Maps ↗</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {offlineRoster.length > 0 ? (
        <View style={styles.repList}>
          {offlineRoster.map((a) => (
            <TouchableOpacity
              key={a.id}
              style={styles.repRow}
              onPress={() => onSelectRep?.(a.id)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Filter map by ${a.name}`}
            >
              <View style={[styles.repDot, styles.repDotOffline]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.repName}>{a.name}</Text>
                <Text style={styles.repMeta}>No GPS yet — app closed or location off</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.sm,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  title: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary },
  sub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2, lineHeight: 17 },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#94a3b8' },
  liveDotOn: { backgroundColor: '#22c55e' },
  liveText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  nativeMapHint: {
    backgroundColor: '#e0f2fe',
    borderRadius: RADIUS.md,
    padding: 14,
    borderWidth: 1,
    borderColor: '#bae6fd',
    marginBottom: 8,
    marginTop: 8,
  },
  nativeMapTitle: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
  nativeMapSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4, lineHeight: 17 },
  openAllBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
  },
  openAllText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  loadingBox: { height: 100, justifyContent: 'center', alignItems: 'center' },
  emptyBox: { padding: 16, backgroundColor: COLORS.background, borderRadius: RADIUS.md },
  emptyText: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 19 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  legendItem: { fontSize: 11, color: COLORS.textSecondary },
  repList: { marginTop: 10, gap: 6 },
  repRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  repRowActive: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
    marginHorizontal: -4,
    paddingHorizontal: 8,
  },
  repDot: { width: 10, height: 10, borderRadius: 5 },
  repDotLive: { backgroundColor: '#0284c7' },
  repDotManager: { backgroundColor: '#7c3aed' },
  repDotStale: { backgroundColor: '#94a3b8' },
  repDotOffline: { backgroundColor: '#cbd5e1' },
  repName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  repMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  openMap: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
});
