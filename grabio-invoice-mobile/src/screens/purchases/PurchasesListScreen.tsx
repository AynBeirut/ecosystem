import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import ScreenSafeArea from '../../components/ScreenSafeArea';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { listPurchaseOrders } from '../../lib/financeService';
import { sharePurchaseOrderPdf } from '../../lib/pdfShare';
import type { FinancePurchaseOrder, RootStackParamList } from '../../types';
import { COLORS, RADIUS, SHADOW } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function PurchasesListScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const [items, setItems] = useState<FinancePurchaseOrder[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sharingId, setSharingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.storeId) {
      setLoading(false);
      return;
    }
    try {
      setItems(await listPurchaseOrders(user.storeId));
      setError('');
    } catch (e) {
      setItems([]);
      setError(e instanceof Error ? e.message : 'Could not load purchase orders');
    }
    setLoading(false);
    setRefreshing(false);
  }, [user?.storeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sharePdf = async (item: FinancePurchaseOrder) => {
    if (!user?.storeId) return;
    setSharingId(item.id);
    try {
      await sharePurchaseOrderPdf(item, user.storeId);
    } catch (e) {
      Alert.alert('PDF failed', e instanceof Error ? e.message : 'Could not export PDF');
    } finally {
      setSharingId(null);
    }
  };

  if (loading) return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />;

  return (
    <ScreenSafeArea edges={['bottom']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Purchase orders</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('PurchaseEditor', {})}>
          <Text style={styles.addText}>+ New</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
        ListEmptyComponent={<Text style={styles.empty}>{error || 'No purchase orders yet.'}</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.poNumber || item.supplierName || 'Purchase'}</Text>
            <Text style={styles.meta}>
              {[item.poNumber ? item.supplierName : '', `${item.currency} ${(item.total ?? item.amount).toFixed(2)}`, item.status].filter(Boolean).join(' · ')}
            </Text>
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => navigation.navigate('PurchaseEditor', { purchaseId: item.id })}>
                <Text style={styles.link}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => void sharePdf(item)} disabled={sharingId === item.id}>
                <Text style={styles.link}>{sharingId === item.id ? 'Preparing PDF…' : 'Export PDF'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </ScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.textPrimary },
  addBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.md },
  addText: { color: '#fff', fontWeight: '700' },
  card: { marginHorizontal: 16, marginBottom: 10, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 14, ...SHADOW.sm },
  cardTitle: { fontWeight: '700', color: COLORS.textPrimary },
  meta: { color: COLORS.textSecondary, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 16, marginTop: 10 },
  link: { color: COLORS.primary, fontWeight: '700' },
  empty: { textAlign: 'center', color: COLORS.textMuted, marginTop: 40 },
});
