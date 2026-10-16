import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import ScreenSafeArea from '../../components/ScreenSafeArea';
import ScreenHeader from '../../components/ui/ScreenHeader';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { listExpenses } from '../../lib/financeService';
import { shareExpensePdf } from '../../lib/pdfShare';
import type { FinanceExpense, RootStackParamList } from '../../types';
import { adminUi } from '../../theme/adminUi';
import { COLORS } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ExpensesListScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const [items, setItems] = useState<FinanceExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sharingId, setSharingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.storeId) {
      setLoading(false);
      return;
    }
    try {
      const rows = await listExpenses(user.storeId);
      setItems(rows.sort((a, b) => b.startDate.localeCompare(a.startDate)));
    } catch {
      setItems([]);
    }
    setLoading(false);
    setRefreshing(false);
  }, [user?.storeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sharePdf = async (item: FinanceExpense) => {
    if (!user?.storeId) return;
    setSharingId(item.id);
    try {
      await shareExpensePdf(item, user.storeId);
    } catch (e) {
      Alert.alert('PDF failed', e instanceof Error ? e.message : 'Could not export PDF');
    } finally {
      setSharingId(null);
    }
  };

  if (loading) return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />;

  return (
    <ScreenSafeArea edges={['top', 'bottom']} style={adminUi.screen}>
      <ScreenHeader
        eyebrow="Finance"
        title="Expenses"
        subtitle="Track and export business expenses"
        actionLabel="+ New"
        onAction={() => navigation.navigate('ExpenseEditor', {})}
      />
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
        ListEmptyComponent={<Text style={adminUi.empty}>No expenses yet. Tap + New to add one.</Text>}
        renderItem={({ item }) => (
          <View style={adminUi.listCard}>
            <Text style={adminUi.listCardTitle}>{item.name}</Text>
            <Text style={adminUi.listCardMeta}>
              {item.currency || 'USD'} {item.amount.toFixed(2)} · {item.category} · {item.status}
            </Text>
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => navigation.navigate('ExpenseEditor', { expenseId: item.id })}>
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
  list: { paddingBottom: 24 },
  actions: { flexDirection: 'row', gap: 16, marginTop: 10 },
  link: { color: COLORS.primary, fontWeight: '700' },
});
