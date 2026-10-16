import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import ScreenSafeArea from '../../components/ScreenSafeArea';
import ScreenHeader from '../../components/ui/ScreenHeader';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { listClientPlans, planUnitsRemaining } from '../../lib/clientPlanService';
import { recordClientPlanPayment } from '../../lib/financeService';
import type { FinanceClientPlan, RootStackParamList } from '../../types';
import { adminUi } from '../../theme/adminUi';
import { COLORS } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ClientPlansListScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const [items, setItems] = useState<FinanceClientPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.storeId) {
      setLoading(false);
      return;
    }
    setItems(await listClientPlans(user.storeId));
    setLoading(false);
    setRefreshing(false);
  }, [user?.storeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const recordPayment = (plan: FinanceClientPlan) => {
    if (!user?.storeId) return;
    Alert.alert(
      'Record payment',
      `${plan.clientName} — ${plan.currency} ${plan.amount.toFixed(2)} via ${plan.paymentMethod}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Record',
          onPress: () => {
            void recordClientPlanPayment(user.storeId!, plan.id, {
              amount: plan.amount,
              paymentMethod: plan.paymentMethod,
              paymentSource: plan.paymentSource,
            })
              .then(() => {
                Alert.alert('Recorded', 'Payment saved as receipt.');
                void load();
              })
              .catch((e) => Alert.alert('Error', e instanceof Error ? e.message : 'Failed'));
          },
        },
      ],
    );
  };

  if (loading) return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />;

  return (
    <ScreenSafeArea edges={['top']} style={adminUi.screen}>
      <ScreenHeader
        eyebrow="Clients"
        title="Service plans"
        subtitle="One-time or monthly billing per client"
        actionLabel="+ New"
        onAction={() => navigation.navigate('ClientPlanEditor', {})}
      />
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
        ListEmptyComponent={<Text style={adminUi.empty}>No service plans yet.</Text>}
        renderItem={({ item }) => {
          const remaining = planUnitsRemaining(item);
          return (
            <View style={adminUi.listCard}>
              <TouchableOpacity onPress={() => navigation.navigate('ClientPlanEditor', { planId: item.id })}>
                <Text style={adminUi.listCardTitle}>{item.title}</Text>
                <Text style={adminUi.listCardMeta}>Client: {item.clientName}</Text>
                <Text style={adminUi.listCardMeta}>
                  {item.billingType === 'monthly' ? 'Monthly' : 'One-time'} · {item.currency} {item.amount.toFixed(2)}
                </Text>
                <Text style={adminUi.listCardMeta}>
                  Pays via: {item.paymentMethod}
                  {item.paymentSource ? ` (${item.paymentSource})` : ''}
                </Text>
                {item.billingType === 'monthly' && item.monthlyUnits ? (
                  <Text style={adminUi.listCardMeta}>
                    Tasks this month: {item.monthlyUnits - (remaining ?? 0)}/{item.monthlyUnits}
                    {remaining != null ? ` · ${remaining} left` : ''}
                  </Text>
                ) : null}
              </TouchableOpacity>
              <View style={styles.actions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => recordPayment(item)}>
                  <Text style={styles.actionPay}>Record payment</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => navigation.navigate('ClientPlanEditor', { planId: item.id })}
                >
                  <Text style={styles.actionEdit}>Edit</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
    </ScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 10, paddingTop: 8 },
  actionBtn: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  actionPay: { color: COLORS.primary, fontWeight: '700' },
  actionEdit: { color: COLORS.textSecondary, fontWeight: '600' },
});
