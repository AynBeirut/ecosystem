import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import ScreenSafeArea from '../../components/ScreenSafeArea';
import DatePickerField from '../../components/DatePickerField';
import HourPickerField from '../../components/HourPickerField';
import ClientPickerSection from '../../components/ClientPickerSection';
import SupplierPickerSection from '../../components/SupplierPickerSection';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import {
  closeServiceTask,
  deleteServiceTask,
  getServiceTask,
  logServiceTaskDelivery,
  saveServiceTask,
} from '../../lib/serviceTaskService';
import {
  completionOutcomeLabel,
  serviceTaskUnitsCompleted,
  serviceTaskUnitsRemaining,
} from '../../lib/serviceTaskLogic';
import { promptServiceTaskCompletion } from '../../lib/serviceTaskCompletionPrompt';
import {
  combineDateAndTime,
  formatServiceTaskSchedule,
  normalizeScheduleWeekdays,
  toggleWeekdaySelection,
  WEEKDAY_OPTIONS,
  weekDaysNeededPerMonth,
} from '../../lib/serviceTaskSchedule';
import { recordServiceTaskPayment } from '../../lib/financeService';
import type { BillingType, FinanceServiceTask, RootStackParamList, ServiceTaskCompletionOutcome, ServiceTaskDirection } from '../../types';
import { COLORS, RADIUS } from '../../theme';
import PaymentMethodChips from '../../components/PaymentMethodChips';

type Route = RouteProp<RootStackParamList, 'ServiceTaskEditor'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;


export default function ServiceTaskEditorScreen() {
  const { user } = useAuth();
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const editId = route.params.taskId || route.params.planId;
  const isEditing = !!editId;
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [direction, setDirection] = useState<ServiceTaskDirection>(route.params.direction || 'from_client');
  const [isFree, setIsFree] = useState(false);
  const [counterpartyId, setCounterpartyId] = useState(route.params.counterpartyId || '');
  const [counterpartyName, setCounterpartyName] = useState('');
  const [title, setTitle] = useState('');
  const [billingType, setBillingType] = useState<BillingType>('one_time');
  const [amount, setAmount] = useState('');
  const [monthlyUnits, setMonthlyUnits] = useState('12');
  const [paymentMethod, setPaymentMethod] = useState('bank');
  const [paymentSource, setPaymentSource] = useState('');
  const [notes, setNotes] = useState('');
  const [taskId, setTaskId] = useState(editId);
  const [status, setStatus] = useState<'open' | 'closed'>('open');
  const [unitsRemaining, setUnitsRemaining] = useState<number | null>(null);
  const [unitsCompleted, setUnitsCompleted] = useState(0);
  const [completions, setCompletions] = useState<FinanceServiceTask['completions']>([]);
  const [scheduleDate, setScheduleDate] = useState<Date | null>(null);
  const [scheduleWeekdays, setScheduleWeekdays] = useState<number[]>([]);
  const [scheduleHour, setScheduleHour] = useState(9);
  const [linkedDailyTaskId, setLinkedDailyTaskId] = useState<string | undefined>();

  useEffect(() => {
    if (!user?.storeId) return;
    void (async () => {
      if (editId) {
        const task = await getServiceTask(user.storeId!, editId);
        if (task) {
          setDirection(task.direction);
          setIsFree(!!task.isFree);
          setCounterpartyId(task.counterpartyId);
          setCounterpartyName(task.counterpartyName);
          setTitle(task.title);
          setBillingType(task.billingType);
          setAmount(String(task.amount));
          setMonthlyUnits(String(task.monthlyUnits || 12));
          setPaymentMethod(task.paymentMethod);
          setPaymentSource(task.paymentSource || '');
          setNotes(task.notes || '');
          setStatus(task.status);
          setUnitsRemaining(serviceTaskUnitsRemaining(task));
          setUnitsCompleted(serviceTaskUnitsCompleted(task));
          setCompletions(task.completions || []);
          setLinkedDailyTaskId(task.linkedDailyTaskId);
          setScheduleWeekdays(normalizeScheduleWeekdays(task.scheduleWeekdays, task.scheduleWeekday));
          if (task.scheduleHour != null) setScheduleHour(task.scheduleHour);
          if (task.scheduledAt) setScheduleDate(new Date(task.scheduledAt));
          else if (task.nextDueAt) setScheduleDate(new Date(task.nextDueAt));
        }
      }
      setLoading(false);
    })();
  }, [user?.storeId, editId]);

  const timesPerMonth = parseInt(monthlyUnits, 10) || 0;
  const daysNeeded = weekDaysNeededPerMonth(timesPerMonth);

  const scheduleSummary = useMemo(
    () =>
      formatServiceTaskSchedule({
        billingType,
        scheduledAt: scheduleDate ? combineDateAndTime(scheduleDate, scheduleHour).toISOString() : undefined,
        scheduleWeekdays,
        scheduleHour,
        monthlyUnits: billingType === 'monthly' ? timesPerMonth : undefined,
      }),
    [billingType, scheduleDate, scheduleHour, scheduleWeekdays, timesPerMonth],
  );

  const save = async () => {
    if (!user?.storeId || !counterpartyName.trim() || !title.trim()) {
      Alert.alert('Required', 'Pick client/freelancer and enter task title');
      return;
    }
    const value = isFree ? 0 : parseFloat(amount) || 0;
    if (!isFree && value <= 0) {
      Alert.alert('Required', 'Enter price for paid tasks');
      return;
    }
    if (billingType === 'monthly') {
      if (!timesPerMonth) {
        Alert.alert('Required', 'Enter times per month (e.g. 12 or 30)');
        return;
      }
      if (scheduleWeekdays.length !== daysNeeded) {
        Alert.alert(
          'Pick weekdays',
          `${timesPerMonth}/month needs ${daysNeeded} day${daysNeeded > 1 ? 's' : ''} per week.\nSelected: ${scheduleWeekdays.length}`,
        );
        return;
      }
    }
    if (billingType === 'one_time' && !scheduleDate) {
      Alert.alert('Required', 'Pick date and time for this task');
      return;
    }
    if (!user?.uid) {
      Alert.alert('Error', 'Sign in again to save');
      return;
    }
    const scheduledAt =
      billingType === 'one_time' && scheduleDate
        ? combineDateAndTime(scheduleDate, scheduleHour).toISOString()
        : undefined;
    setSaving(true);
    try {
      const id = await saveServiceTask(
        user.storeId,
        {
          id: taskId,
          direction,
          counterpartyId: counterpartyId || counterpartyName.trim(),
          counterpartyName: counterpartyName.trim(),
          title: title.trim(),
          billingType,
          isFree,
          amount: value,
          currency: 'USD',
          monthlyUnits: billingType === 'monthly' ? timesPerMonth : undefined,
          paymentMethod,
          paymentSource: paymentSource.trim() || undefined,
          status,
          notes,
          scheduledAt,
          scheduleWeekdays: billingType === 'monthly' ? scheduleWeekdays : undefined,
          scheduleHour,
          scheduleMinute: 0,
          linkedDailyTaskId,
        },
        {
          uid: user.uid,
          name: user.displayName || user.email || 'User',
        },
      );
      setTaskId(id);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const logDelivery = async (outcome: ServiceTaskCompletionOutcome) => {
    if (!user?.storeId || !taskId) return;
    try {
      await logServiceTaskDelivery(user.storeId, taskId, outcome, {
        uid: user.uid,
        name: user.displayName || user.email || 'User',
      });
      const task = await getServiceTask(user.storeId, taskId);
      if (task) {
        setStatus(task.status);
        setUnitsRemaining(serviceTaskUnitsRemaining(task));
        setUnitsCompleted(serviceTaskUnitsCompleted(task));
        setCompletions(task.completions || []);
      }
      const closed = task?.status === 'closed';
      Alert.alert(
        closed ? 'Contract complete' : 'Occurrence logged',
        closed
          ? `Marked ${completionOutcomeLabel(outcome)}. Task closed.`
          : `Marked ${completionOutcomeLabel(outcome)}.`,
      );
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not log task');
    }
  };

  const pickAndLogDelivery = () => {
    if (billingType === 'one_time') {
      void logDelivery('done');
      return;
    }
    promptServiceTaskCompletion((outcome) => void logDelivery(outcome));
  };

  const recordPayment = async () => {
    if (!user?.storeId || !taskId) return;
    const value = parseFloat(amount) || 0;
    if (!value) {
      Alert.alert('Required', 'Enter amount first');
      return;
    }
    try {
      await recordServiceTaskPayment(user.storeId, taskId, {
        amount: value,
        paymentMethod,
        paymentSource: paymentSource.trim() || undefined,
      });
      Alert.alert('Recorded', direction === 'from_client' ? 'Receipt saved.' : 'Expense saved.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Payment failed');
    }
  };

  const remove = () => {
    if (!user?.storeId || !taskId) return;
    Alert.alert('Delete task', 'Remove this service task?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteServiceTask(user.storeId!, taskId!)
            .then(() => navigation.goBack())
            .catch((e) => Alert.alert('Error', e instanceof Error ? e.message : 'Delete failed'));
        },
      },
    ]);
  };

  const closeTask = (outcome: ServiceTaskCompletionOutcome = 'done') => {
    if (!user?.storeId || !taskId) return;
    void closeServiceTask(user.storeId, taskId, outcome).then(() => setStatus('closed'));
  };

  const pickAndCloseTask = () => {
    promptServiceTaskCompletion((outcome) => closeTask(outcome));
  };

  if (loading) return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />;

  return (
    <ScreenSafeArea edges={['bottom']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{isEditing ? 'Edit service task' : 'New service task'}</Text>

        <Text style={styles.label}>Who is this for?</Text>
        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.dirChip, direction === 'from_client' && styles.dirChipActive]}
            onPress={() => setDirection('from_client')}
          >
            <Text style={[styles.dirText, direction === 'from_client' && styles.dirTextActive]}>Client (we charge)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dirChip, direction === 'to_freelancer' && styles.dirChipActive]}
            onPress={() => setDirection('to_freelancer')}
          >
            <Text style={[styles.dirText, direction === 'to_freelancer' && styles.dirTextActive]}>Freelancer (we pay)</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Free or paid?</Text>
        <View style={styles.row}>
          <TouchableOpacity style={[styles.dirChip, !isFree && styles.dirChipActive]} onPress={() => setIsFree(false)}>
            <Text style={[styles.dirText, !isFree && styles.dirTextActive]}>Paid</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.dirChip, isFree && styles.dirChipActive]} onPress={() => setIsFree(true)}>
            <Text style={[styles.dirText, isFree && styles.dirTextActive]}>Free</Text>
          </TouchableOpacity>
        </View>

        {direction === 'from_client' ? (
          <ClientPickerSection
            storeId={user.storeId!}
            clientName={counterpartyName}
            onChangeName={setCounterpartyName}
            onSelect={(c) => {
              setCounterpartyId(c.id);
              setCounterpartyName(c.name);
            }}
            onCreateNew={() => navigation.navigate('ClientEditor', {})}
          />
        ) : (
          <SupplierPickerSection
            storeId={user!.storeId!}
            label="Freelancer"
            newLabel="+ New freelancer"
            supplierName={counterpartyName}
            onChangeName={setCounterpartyName}
            onSelect={(s) => {
              setCounterpartyId(s.id);
              setCounterpartyName(s.name);
            }}
          />
        )}

        <Text style={styles.label}>Task / service</Text>
        <TextInput style={styles.input} placeholder="What is the work?" placeholderTextColor={COLORS.textMuted} value={title} onChangeText={setTitle} />

        <Text style={styles.label}>Billing</Text>
        <View style={styles.row}>
          {(['one_time', 'monthly'] as BillingType[]).map((t) => (
            <TouchableOpacity key={t} style={[styles.chip, billingType === t && styles.chipActive]} onPress={() => setBillingType(t)}>
              <Text style={[styles.chipText, billingType === t && styles.chipTextActive]}>
                {t === 'monthly' ? 'Monthly' : 'One-time'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {!isFree ? (
          <TextInput style={styles.input} placeholder="Price USD" placeholderTextColor={COLORS.textMuted} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        ) : (
          <Text style={styles.hint}>Free task — no charge or payment.</Text>
        )}
        {billingType === 'monthly' ? (
          <>
            <Text style={styles.label}>Times per month</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 12 or 30"
              placeholderTextColor={COLORS.textMuted}
              value={monthlyUnits}
              onChangeText={setMonthlyUnits}
              keyboardType="number-pad"
            />
            <Text style={styles.hint}>
              Pick {daysNeeded} weekday{daysNeeded > 1 ? 's' : ''} · mark Done / Reported / Call each time
            </Text>
          </>
        ) : (
          <Text style={styles.hint}>One-time: mark complete when done — task will close.</Text>
        )}

        <View style={styles.scheduleCard}>
          <Text style={styles.scheduleTitle}>📆 Schedule</Text>
          {billingType === 'monthly' ? (
            <>
              <Text style={styles.scheduleSub}>
                Select {daysNeeded} day{daysNeeded > 1 ? 's' : ''} ({scheduleWeekdays.length}/{daysNeeded})
              </Text>
              <View style={styles.weekRow}>
                {WEEKDAY_OPTIONS.map((day) => {
                  const selected = scheduleWeekdays.includes(day.value);
                  const full = !selected && scheduleWeekdays.length >= daysNeeded;
                  return (
                    <TouchableOpacity
                      key={day.value}
                      style={[
                        styles.dayChip,
                        selected && styles.dayChipActive,
                        full && styles.dayChipDisabled,
                      ]}
                      onPress={() => setScheduleWeekdays((days) => toggleWeekdaySelection(days, day.value, daysNeeded))}
                    >
                      <Text style={[styles.dayChipText, selected && styles.dayChipTextActive]}>{day.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          ) : (
            <DatePickerField
              label=""
              value={scheduleDate}
              onChange={setScheduleDate}
              required
              placeholder="Pick date"
              minimumDate={new Date()}
            />
          )}
          <HourPickerField label="" value={scheduleHour} onChange={setScheduleHour} />
          <Text style={styles.schedulePreview}>{scheduleSummary}</Text>
          <Text style={styles.scheduleNote}>Reminder 1h before · appears in Team to-do</Text>
        </View>

        {!isFree ? (
          <>
            <Text style={styles.label}>Payment</Text>
            {user?.storeId ? (
              <PaymentMethodChips storeId={user.storeId} value={paymentMethod} onChange={setPaymentMethod} />
            ) : null}
            <TextInput
              style={styles.input}
              placeholder={direction === 'from_client' ? 'How they pay (bank, Whish…)' : 'How we pay them'}
              placeholderTextColor={COLORS.textMuted}
              value={paymentSource}
              onChangeText={setPaymentSource}
            />
          </>
        ) : null}
        <TextInput style={styles.input} placeholder="Notes" placeholderTextColor={COLORS.textMuted} value={notes} onChangeText={setNotes} multiline />

        {isEditing && billingType === 'monthly' && unitsRemaining != null ? (
          <Text style={styles.usage}>
            {unitsCompleted}/{monthlyUnits} completed · {unitsRemaining} left
          </Text>
        ) : null}
        {isEditing && completions && completions.length > 0 ? (
          <View style={styles.historyBox}>
            <Text style={styles.label}>History</Text>
            {completions.slice().reverse().map((c, idx) => (
              <Text key={`${c.at}-${idx}`} style={styles.historyRow}>
                {new Date(c.at).toLocaleDateString()} · {completionOutcomeLabel(c.outcome)}
              </Text>
            ))}
          </View>
        ) : null}

        <TouchableOpacity style={styles.saveBtn} onPress={() => void save()} disabled={saving}>
          <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save task'}</Text>
        </TouchableOpacity>

        {isEditing && status === 'open' ? (
          <>
            {billingType === 'monthly' ? (
              <>
                <Text style={styles.label}>Mark this month</Text>
                <View style={styles.rowWrap}>
                  {(['done', 'reported', 'call'] as ServiceTaskCompletionOutcome[]).map((outcome) => (
                    <TouchableOpacity
                      key={outcome}
                      style={styles.chip}
                      onPress={() => void logDelivery(outcome)}
                    >
                      <Text style={styles.chipText}>{completionOutcomeLabel(outcome)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : (
              <TouchableOpacity style={styles.secondaryBtn} onPress={pickAndLogDelivery}>
                <Text style={styles.secondaryText}>Mark complete & close</Text>
              </TouchableOpacity>
            )}
            {!isFree ? (
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => void recordPayment()}>
                <Text style={styles.secondaryText}>
                  {direction === 'from_client' ? 'Record income (receipt)' : 'Record payment (expense)'}
                </Text>
              </TouchableOpacity>
            ) : null}
            {billingType === 'monthly' ? (
              <TouchableOpacity style={styles.secondaryBtn} onPress={pickAndCloseTask}>
                <Text style={styles.secondaryText}>End contract early</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.deleteBtn} onPress={remove}>
              <Text style={styles.deleteText}>Delete task</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>
    </ScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12, color: COLORS.textPrimary },
  label: { fontWeight: '600', color: COLORS.textSecondary, marginTop: 8, marginBottom: 6 },
  input: { backgroundColor: COLORS.surface, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: 14, marginBottom: 8, fontSize: 16 },
  pick: { color: COLORS.primary, marginBottom: 6, fontWeight: '600' },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 8,
  },
  dropdownText: { flex: 1, fontSize: 16, color: COLORS.textMuted },
  chevron: { fontSize: 16, color: COLORS.textMuted, fontWeight: '700' },
  hint: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  dirChip: { flex: 1, padding: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  dirChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  dirText: { fontWeight: '700', fontSize: 12, color: COLORS.textSecondary, textAlign: 'center' },
  dirTextActive: { color: COLORS.secondary },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  chipActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  chipText: { color: COLORS.textSecondary, fontWeight: '600', textTransform: 'capitalize' },
  chipTextActive: { color: COLORS.secondary },
  scheduleCard: {
    marginTop: 8,
    marginBottom: 12,
    padding: 14,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  scheduleTitle: { fontSize: 16, fontWeight: '800', color: COLORS.secondary, marginBottom: 8 },
  scheduleSub: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  dayChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dayChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dayChipDisabled: { opacity: 0.35 },
  dayChipText: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },
  dayChipTextActive: { color: '#fff' },
  schedulePreview: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, marginTop: 4 },
  scheduleNote: { fontSize: 11, color: COLORS.textSecondary, marginTop: 4 },
  usage: { fontWeight: '700', color: COLORS.primary, marginVertical: 8 },
  historyBox: { marginBottom: 8, padding: 12, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  historyRow: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 16, alignItems: 'center', marginTop: 8 },
  saveText: { color: '#fff', fontWeight: '700' },
  secondaryBtn: { marginTop: 10, borderRadius: RADIUS.md, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: COLORS.primary },
  secondaryText: { color: COLORS.primary, fontWeight: '700', textAlign: 'center' },
  deleteBtn: { marginTop: 12, padding: 14, alignItems: 'center' },
  deleteText: { color: COLORS.error, fontWeight: '700' },
});
