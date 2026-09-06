import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  filterNextUpcomingRoutes,
  filterRoutesForDate,
  routeProgressOnDate,
  REPEAT_LABELS,
  toDateYmd,
  type CrmVisitRoute,
} from '../lib/crmVisitRouteService';
import { RootStackParamList } from '../types';
import { COLORS, RADIUS, SHADOW } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Props = {
  routes: CrmVisitRoute[];
  repFilter?: string;
  /** All rep id aliases for the signed-in agent (sub:, user:, crmReps id). */
  repIds?: string[];
  /** When set, only routes on this customer visit date (YYYY-MM-DD). */
  customerDateYmd?: string;
  /** Owner/admin: if none on customer date, list every route with its visit date. */
  showAllRoutesWhenDateEmpty?: boolean;
  onCreateRoute?: () => void;
  compact?: boolean;
};

export default function CrmUpcomingRoutesList({
  routes,
  repFilter,
  repIds,
  customerDateYmd,
  showAllRoutesWhenDateEmpty,
  onCreateRoute,
  compact,
}: Props) {
  const navigation = useNavigation<Nav>();
  const repKey = repIds?.length ? undefined : (repFilter === 'all' ? undefined : repFilter);

  const filterByRep = (list: CrmVisitRoute[]) => {
    if (repIds?.length) {
      return list.filter((r) => repIds.includes(r.assignedRepId));
    }
    if (repKey) {
      return list.filter((r) => r.assignedRepId === repKey);
    }
    return list;
  };

  let upcoming: Array<{ dateYmd: string; route: CrmVisitRoute }>;
  let title = customerDateYmd ? `Visit routes · ${customerDateYmd}` : 'Upcoming visit routes';

  if (customerDateYmd) {
    const onDate = filterRoutesForDate(routes, customerDateYmd, repKey, repIds).map((route) => ({
      dateYmd: customerDateYmd,
      route,
    }));
    if (onDate.length > 0) {
      upcoming = onDate;
    } else if (showAllRoutesWhenDateEmpty) {
      upcoming = filterByRep(routes.filter((r) => r.status !== 'archived'))
        .map((route) => ({ dateYmd: route.visitDate, route }))
        .sort((a, b) => a.dateYmd.localeCompare(b.dateYmd));
      title = 'All visit routes';
    } else {
      upcoming = [];
    }
  } else {
    upcoming = filterNextUpcomingRoutes(routes, 14, repKey, repIds);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>
          {title}
        </Text>
        {onCreateRoute ? (
          <TouchableOpacity onPress={onCreateRoute}>
            <Text style={styles.link}>＋ New</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {upcoming.length === 0 ? (
        <Text style={styles.empty}>
          {customerDateYmd
            ? 'No visit routes on this customer date.'
            : 'No routes scheduled. Tap Map & pipeline → Create visit route, or pick Tomorrow if the route is for the next day.'}
        </Text>
      ) : (
        upcoming.map(({ dateYmd, route }) => {
          const prog = routeProgressOnDate(route, dateYmd);
          return (
            <TouchableOpacity
              key={`${route.id}-${dateYmd}`}
              style={[styles.card, compact && styles.cardCompact]}
              onPress={() => navigation.navigate('CrmVisitRouteDetail', { routeId: route.id, occurrenceDate: dateYmd })}
            >
              <Text style={styles.cardTitle}>{route.title}</Text>
              <Text style={styles.cardMeta}>
                📅 {dateYmd}{dateYmd < toDateYmd(new Date()) ? ' · overdue' : ''} · {route.assignedRepName} · {prog.done}/{prog.total} done
                {route.repeatRule !== 'none' ? ` · ${REPEAT_LABELS[route.repeatRule]}` : ''}
              </Text>
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  link: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  empty: { fontSize: 13, color: COLORS.textMuted, lineHeight: 20, marginBottom: 8 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.sm,
  },
  cardCompact: { padding: 10 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  cardMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
});
