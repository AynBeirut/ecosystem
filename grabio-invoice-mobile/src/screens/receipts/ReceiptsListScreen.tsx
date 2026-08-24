import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { listReceipts } from '../../lib/financeService';
import type { FinanceReceipt, RootStackParamList } from '../../types';
import { COLORS, RADIUS, SHADOW } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ReceiptsListScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const [items, setItems] = useState<FinanceReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.storeId) { setLoading(false); return; }
    setItems(await listReceipts(user.storeId));
    setLoading(false);
    setRefreshing(false);
  }, [user?.storeId]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Receipts</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('ReceiptEditor', {})}>
          <Text style={styles.addText}>+ New</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
        ListEmptyComponent={<Text style={styles.empty}>No receipts yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.clientName}</Text>
            <Text style={styles.meta}>{item.currency} {item.amount.toFixed(2)} · {item.paymentMethod}</Text>
            <Text style={styles.meta}>{new Date(item.paymentDate).toLocaleDateString()}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '700' },
  addBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.md },
  addText: { color: '#fff', fontWeight: '700' },
  card: { marginHorizontal: 16, marginBottom: 10, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 14, ...SHADOW.sm },
  cardTitle: { fontWeight: '700' },
  meta: { color: COLORS.textSecondary, marginTop: 4 },
  empty: { textAlign: 'center', color: COLORS.textMuted, marginTop: 40 },
});
