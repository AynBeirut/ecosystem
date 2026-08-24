import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, TextInput, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { listInvoices } from '../../lib/financeService';
import type { FinanceInvoice, RootStackParamList } from '../../types';
import { COLORS, RADIUS, SHADOW } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function InvoicesListScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const [items, setItems] = useState<FinanceInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  const load = useCallback(async () => {
    if (!user?.storeId) { setLoading(false); return; }
    const rows = await listInvoices(user.storeId);
    setItems(rows);
    setLoading(false);
    setRefreshing(false);
  }, [user?.storeId]);

  useEffect(() => { void load(); }, [load]);

  const filtered = items.filter((inv) => {
    if (status !== 'all' && inv.status !== status) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [inv.invoiceNumber, inv.clientName, inv.id, inv.notes].some((v) => String(v || '').toLowerCase().includes(q));
  });

  if (loading) return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Invoices</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('InvoiceEditor', {})}>
          <Text style={styles.addText}>+ New</Text>
        </TouchableOpacity>
      </View>
      <TextInput style={styles.search} placeholder="Search invoices…" value={search} onChangeText={setSearch} />
      <View style={styles.filters}>
        {['all', 'draft', 'sent', 'partial', 'paid'].map((s) => (
          <TouchableOpacity key={s} style={[styles.chip, status === s && styles.chipActive]} onPress={() => setStatus(s)}>
            <Text style={[styles.chipText, status === s && styles.chipTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
        ListEmptyComponent={<Text style={styles.empty}>No invoices yet.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('InvoicePreview', { invoiceId: item.id })}>
            <View style={styles.row}>
              <Text style={styles.cardTitle}>{item.invoiceNumber || item.id.slice(0, 8)}</Text>
              <Text style={[styles.badge, item.status === 'paid' && styles.badgePaid]}>{item.status}</Text>
            </View>
            <Text style={styles.meta}>{item.clientName}</Text>
            <Text style={styles.amount}>{item.currency} {(item.total ?? item.amount).toFixed(2)}</Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.textPrimary },
  addBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.md },
  addText: { color: '#fff', fontWeight: '700' },
  search: { marginHorizontal: 16, marginBottom: 8, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 12, borderWidth: 1, borderColor: COLORS.border },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.light },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { color: COLORS.textSecondary, fontSize: 12, textTransform: 'capitalize' },
  chipTextActive: { color: '#fff' },
  card: { marginHorizontal: 16, marginBottom: 10, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 14, ...SHADOW.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontWeight: '700', color: COLORS.textPrimary },
  badge: { fontSize: 12, color: COLORS.warning, textTransform: 'capitalize' },
  badgePaid: { color: COLORS.success },
  meta: { color: COLORS.textSecondary, marginTop: 4 },
  amount: { marginTop: 6, fontWeight: '700', color: COLORS.primary },
  empty: { textAlign: 'center', color: COLORS.textMuted, marginTop: 40 },
});
