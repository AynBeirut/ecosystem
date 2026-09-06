import React, { useCallback, useEffect, useState } from 'react';
import ScreenSafeArea from '../../components/ScreenSafeArea';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useResolvedStoreId } from '../../hooks/useResolvedStoreId';
import { useAuth } from '../../context/AuthContext';
import { COLORS, RADIUS, SHADOW } from '../../theme';
import { fetchClientBalances, type ClientBalanceRow } from '../../lib/clientBalanceService';
import { isClientBalanceViewerOnly } from '../../lib/ownerAccess';

export default function ClientBalancesScreen() {
  const { user } = useAuth();
  const { storeId, loading: storeLoading } = useResolvedStoreId();
  const viewerOnly = isClientBalanceViewerOnly(user?.userRole, user?.subAccountRole);
  const [rows, setRows] = useState<ClientBalanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!storeId) return;
    try {
      const data = await fetchClientBalances(storeId);
      setRows(data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [storeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = search.trim()
    ? rows.filter(
        (r) =>
          r.name.toLowerCase().includes(search.toLowerCase())
          || (r.phone || '').includes(search),
      )
    : rows;

  const totalDue = filtered.reduce((sum, r) => sum + r.balance, 0);
  const currency = filtered[0]?.currency || 'USD';

  return (
    <ScreenSafeArea style={styles.container}>
      {viewerOnly ? (
        <View style={styles.viewerBanner}>
          <Text style={styles.viewerBannerText}>👁 Viewer only — client balances (no payments)</Text>
        </View>
      ) : null}

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Total client balance due</Text>
        <Text style={styles.summaryAmount}>
          {currency} {totalDue.toFixed(2)}
        </Text>
        <Text style={styles.summaryMeta}>{filtered.length} client{filtered.length === 1 ? '' : 's'} with open balance</Text>
      </View>

      <TextInput
        style={styles.search}
        placeholder="Search client name or phone…"
        placeholderTextColor={COLORS.textMuted}
        value={search}
        onChangeText={setSearch}
      />

      {loading || storeLoading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
              colors={[COLORS.primary]}
            />
          }
          contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
          ListEmptyComponent={
            <Text style={styles.empty}>No open client balances</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                {item.phone ? <Text style={styles.meta}>📞 {item.phone}</Text> : null}
              </View>
              <View style={styles.balanceCol}>
                <Text style={styles.balanceLabel}>Balance due</Text>
                <Text style={styles.balanceAmount}>
                  {item.currency} {item.balance.toFixed(2)}
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </ScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  viewerBanner: {
    marginHorizontal: 12,
    marginTop: 8,
    padding: 10,
    borderRadius: RADIUS.md,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#93c5fd',
  },
  viewerBannerText: { fontSize: 13, fontWeight: '600', color: '#1d4ed8', textAlign: 'center' },
  summaryCard: {
    margin: 12,
    marginBottom: 8,
    padding: 16,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.sm,
  },
  summaryLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  summaryAmount: { fontSize: 28, fontWeight: '800', color: '#c2410c', marginTop: 4 },
  summaryMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 6 },
  search: {
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 12,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 10,
    ...SHADOW.sm,
    gap: 12,
  },
  name: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  meta: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  balanceCol: { alignItems: 'flex-end' },
  balanceLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },
  balanceAmount: { fontSize: 17, fontWeight: '800', color: '#c2410c', marginTop: 2 },
  empty: { textAlign: 'center', marginTop: 40, color: COLORS.textMuted, fontSize: 15 },
});
