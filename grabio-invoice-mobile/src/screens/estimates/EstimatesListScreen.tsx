import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { convertEstimateToInvoice, listEstimates } from '../../lib/financeService';
import type { FinanceEstimate, RootStackParamList } from '../../types';
import { COLORS, RADIUS, SHADOW } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function EstimatesListScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const [items, setItems] = useState<FinanceEstimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.storeId) { setLoading(false); return; }
    setItems(await listEstimates(user.storeId));
    setLoading(false);
    setRefreshing(false);
  }, [user?.storeId]);

  useEffect(() => { void load(); }, [load]);

  const convert = (estimateId: string) => {
    Alert.alert('Convert to invoice?', 'Creates a new invoice from this estimate.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Convert',
        onPress: () => {
          void (async () => {
            if (!user?.storeId) return;
            const invoiceId = await convertEstimateToInvoice(user.storeId, estimateId);
            navigation.navigate('InvoicePreview', { invoiceId });
            await load();
          })();
        },
      },
    ]);
  };

  if (loading) return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Estimates</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('EstimateEditor', {})}>
          <Text style={styles.addText}>+ New</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
        ListEmptyComponent={<Text style={styles.empty}>No estimates yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.clientName}</Text>
            <Text style={styles.meta}>{item.currency} {(item.total ?? item.amount).toFixed(2)} · {item.status}</Text>
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => navigation.navigate('EstimateEditor', { estimateId: item.id })}>
                <Text style={styles.link}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => convert(item.id)}>
                <Text style={styles.link}>Convert</Text>
              </TouchableOpacity>
            </View>
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
  cardTitle: { fontWeight: '700', color: COLORS.textPrimary },
  meta: { color: COLORS.textSecondary, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 16, marginTop: 10 },
  link: { color: COLORS.primary, fontWeight: '700' },
  empty: { textAlign: 'center', color: COLORS.textMuted, marginTop: 40 },
});
