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
import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { listServiceTasks, logServiceTaskDelivery } from '../../lib/serviceTaskService';
import {
  serviceTaskUnitsCompleted,
  serviceTaskUnitsRemaining,
} from '../../lib/serviceTaskLogic';
import { formatServiceTaskSchedule } from '../../lib/serviceTaskSchedule';
import { promptServiceTaskCompletion } from '../../lib/serviceTaskCompletionPrompt';
import { recordServiceTaskPayment } from '../../lib/financeService';
import type { FinanceServiceTask, MainTabParamList, RootStackParamList, ServiceTaskDirection } from '../../types';
import { adminUi } from '../../theme/adminUi';
import { COLORS, RADIUS } from '../../theme';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Tasks'>,
  NativeStackNavigationProp<RootStackParamList>
>;
type SideFilter = 'all' | ServiceTaskDirection;

export default function ServiceTasksListScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const [items, setItems] = useState<FinanceServiceTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [side, setSide] = useState<SideFilter>('all');

  const openEditor = useCallback(
    (params: RootStackParamList['ServiceTaskEditor'] = {}) => {
      const parent = navigation.getParent();
      if (parent) {
        parent.navigate('ServiceTaskEditor', params);
        return;
      }
      navigation.navigate('ServiceTaskEditor', params);
    },
    [navigation],
  );

  const load = useCallback(async () => {
    if (!user?.storeId) {
      setLoading(false);
      return;
    }
    try {
      setLoadError(null);
      setItems(await listServiceTasks(user.storeId));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load tasks');
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.storeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = items.filter((t) => side === 'all' || t.direction === side);

  const logOccurrence = (task: FinanceServiceTask) => {
    if (!user?.storeId) return;
    const run = (outcome: 'done' | 'reported' | 'call') => {
      void logServiceTaskDelivery(user.storeId!, task.id, outcome, {
        uid: user.uid!,
        name: user.displayName || user.email || 'User',
      })
        .then(() => void load())
        .catch((e) => Alert.alert('Error', e instanceof Error ? e.message : 'Failed'));
    };
    if (task.billingType === 'one_time') {
      run('done');
      return;
    }
    promptServiceTaskCompletion(run);
  };

  const recordPayment = (task: FinanceServiceTask) => {
    if (!user?.storeId) return;
    const verb = task.direction === 'from_client' ? 'Receive' : 'Pay';
    Alert.alert(
      `${verb} ${task.currency} ${task.amount.toFixed(2)}?`,
      `${task.counterpartyName} · ${task.title}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: verb,
          onPress: () => {
            void recordServiceTaskPayment(user.storeId!, task.id, {
              amount: task.amount,
              paymentMethod: task.paymentMethod,
              paymentSource: task.paymentSource,
            })
              .then(() => {
                Alert.alert('Recorded', task.direction === 'from_client' ? 'Receipt saved.' : 'Expense saved.');
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
        eyebrow="Invoice Manager"
        title="Tasks"
        subtitle="Client or freelancer · free or paid · monthly or one-time"
        actionLabel="+ New"
        onAction={() => openEditor({})}
      />
      {loadError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{loadError}</Text>
          <TouchableOpacity onPress={() => void load()}>
            <Text style={styles.retry}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <View style={styles.chips}>
        {(['all', 'from_client', 'to_freelancer'] as SideFilter[]).map((s) => (
          <TouchableOpacity key={s} style={[styles.chip, side === s && styles.chipActive]} onPress={() => setSide(s)}>
            <Text style={[styles.chipText, side === s && styles.chipTextActive]}>
              {s === 'all' ? 'All' : s === 'from_client' ? 'From client' : 'To freelancer'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        style={styles.list}
        data={filtered}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
        ListEmptyComponent={<Text style={adminUi.empty}>No tasks yet. Tap + New to add one.</Text>}
        renderItem={({ item }) => {
          const remaining = serviceTaskUnitsRemaining(item);
          const completed = serviceTaskUnitsCompleted(item);
          const isClient = item.direction === 'from_client';
          return (
            <View style={adminUi.listCard}>
              <TouchableOpacity onPress={() => openEditor({ taskId: item.id })}>
                <View style={styles.row}>
                  <Text style={[styles.badge, isClient ? styles.badgeIn : styles.badgeOut]}>
                    {isClient ? 'Client pays' : 'We pay'}
                  </Text>
                  <Text style={styles.status}>{item.status === 'open' ? 'Open' : 'Closed'}</Text>
                </View>
                <Text style={adminUi.listCardTitle}>{item.title}</Text>
                <Text style={adminUi.listCardMeta}>{item.counterpartyName}</Text>
                <Text style={adminUi.listCardMeta}>
                  {item.billingType === 'monthly' ? 'Monthly' : 'One-time'} ·{' '}
                  {item.isFree ? 'Free' : `${item.currency} ${item.amount.toFixed(2)}`}
                </Text>
                {item.billingType === 'monthly' && item.monthlyUnits ? (
                  <Text style={adminUi.listCardMeta}>
                    {completed}/{item.monthlyUnits} this month
                    {remaining != null ? ` · ${remaining} left` : ''}
                  </Text>
                ) : null}
                <Text style={adminUi.listCardMeta}>
                  {formatServiceTaskSchedule(item)}
                </Text>
              </TouchableOpacity>
              {item.status === 'open' ? (
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => logOccurrence(item)}>
                    <Text style={styles.actionPay}>
                      {item.billingType === 'monthly' ? 'Mark month' : 'Mark done'}
                    </Text>
                  </TouchableOpacity>
                  {!item.isFree ? (
                    <TouchableOpacity style={styles.actionBtn} onPress={() => recordPayment(item)}>
                      <Text style={styles.actionEdit}>{isClient ? 'Income' : 'Payment'}</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity style={styles.actionBtn} onPress={() => openEditor({ taskId: item.id })}>
                    <Text style={styles.actionEdit}>Edit</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          );
        }}
      />
    </ScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  errorBox: { marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: RADIUS.md, backgroundColor: '#fef2f2' },
  errorText: { color: '#991b1b', fontSize: 13 },
  retry: { color: COLORS.primary, fontWeight: '700', marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.full, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  chipActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.secondary },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  badge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  badgeIn: { backgroundColor: '#d1fae5', color: '#065f46' },
  badgeOut: { backgroundColor: '#fee2e2', color: '#991b1b' },
  status: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  actions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 10, paddingTop: 8 },
  actionBtn: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  actionPay: { color: COLORS.primary, fontWeight: '700' },
  actionEdit: { color: COLORS.textSecondary, fontWeight: '600' },
});
