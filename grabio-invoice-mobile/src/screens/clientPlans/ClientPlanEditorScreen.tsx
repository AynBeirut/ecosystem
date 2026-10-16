import React, { useEffect, useState } from 'react';
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
import ClientPickerSection from '../../components/ClientPickerSection';
import ProductPickerSection from '../../components/ProductPickerSection';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import {
  deleteClientPlan,
  getClientPlan,
  incrementClientPlanTaskUsage,
  planUnitsRemaining,
  saveClientPlan,
} from '../../lib/clientPlanService';
import { getClient, getProduct, productUnitPrice, recordClientPlanPayment } from '../../lib/financeService';
import type { BillingType, RootStackParamList } from '../../types';
import { COLORS, RADIUS } from '../../theme';
import PaymentMethodChips from '../../components/PaymentMethodChips';

type Route = RouteProp<RootStackParamList, 'ClientPlanEditor'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;


export default function ClientPlanEditorScreen() {
  const { user } = useAuth();
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const isEditing = !!route.params.planId;
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [clientId, setClientId] = useState(route.params.clientId || '');
  const [clientName, setClientName] = useState('');
  const [title, setTitle] = useState('');
  const [billingType, setBillingType] = useState<BillingType>('monthly');
  const [amount, setAmount] = useState('');
  const [monthlyUnits, setMonthlyUnits] = useState('12');
  const [paymentMethod, setPaymentMethod] = useState('bank');
  const [paymentSource, setPaymentSource] = useState('');
  const [notes, setNotes] = useState('');
  const [planId, setPlanId] = useState(route.params.planId);
  const [unitsRemaining, setUnitsRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!user?.storeId) return;
    void (async () => {
      if (route.params.planId) {
        const plan = await getClientPlan(user.storeId!, route.params.planId);
        if (plan) {
          setClientId(plan.clientId);
          setClientName(plan.clientName);
          setTitle(plan.title);
          setBillingType(plan.billingType);
          setAmount(String(plan.amount));
          setMonthlyUnits(String(plan.monthlyUnits || 12));
          setPaymentMethod(plan.paymentMethod);
          setPaymentSource(plan.paymentSource || '');
          setNotes(plan.notes || '');
          setUnitsRemaining(planUnitsRemaining(plan));
        }
      } else if (route.params.clientId) {
        const c = await getClient(user.storeId!, route.params.clientId);
        if (c) {
          setClientId(c.id);
          setClientName(c.name);
        }
      }
      setLoading(false);
    })();
  }, [user?.storeId, route.params.planId, route.params.clientId]);

  const applyProduct = async (productId: string) => {
    if (!user?.storeId) return;
    const p = await getProduct(user.storeId, productId);
    if (!p) return;
    setTitle(p.name);
    setAmount(String(productUnitPrice(p)));
    if (p.billingType === 'monthly') {
      setBillingType('monthly');
      setMonthlyUnits(String(p.monthlyUnits || 12));
    } else {
      setBillingType('one_time');
    }
  };

  const save = async () => {
    if (!user?.storeId || !clientName.trim() || !title.trim()) {
      Alert.alert('Required', 'Client and plan title are required');
      return;
    }
    setSaving(true);
    try {
      const id = await saveClientPlan(user.storeId, {
        id: planId,
        clientId: clientId || clientName.trim(),
        clientName: clientName.trim(),
        title: title.trim(),
        billingType,
        amount: parseFloat(amount) || 0,
        currency: 'USD',
        monthlyUnits: billingType === 'monthly' ? parseInt(monthlyUnits, 10) || 0 : undefined,
        paymentMethod,
        paymentSource: paymentSource.trim() || undefined,
        status: 'active',
        notes,
      });
      setPlanId(id);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const logTask = async () => {
    if (!user?.storeId || !planId) return;
    try {
      await incrementClientPlanTaskUsage(user.storeId, planId);
      const plan = await getClientPlan(user.storeId, planId);
      if (plan) setUnitsRemaining(planUnitsRemaining(plan));
      Alert.alert('Task logged', 'Counted against this month\'s plan.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not log task');
    }
  };

  const recordPayment = async () => {
    if (!user?.storeId || !planId) return;
    const value = parseFloat(amount) || 0;
    if (!value) {
      Alert.alert('Required', 'Enter plan amount first');
      return;
    }
    try {
      await recordClientPlanPayment(user.storeId, planId, {
        amount: value,
        paymentMethod,
        paymentSource: paymentSource.trim() || undefined,
      });
      Alert.alert('Recorded', 'Payment saved as receipt for this client.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Payment failed');
    }
  };

  const remove = () => {
    if (!user?.storeId || !planId) return;
    Alert.alert('Delete plan', 'Remove this service plan?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteClientPlan(user.storeId!, planId!)
            .then(() => navigation.goBack())
            .catch((e) => Alert.alert('Error', e instanceof Error ? e.message : 'Delete failed'));
        },
      },
    ]);
  };

  if (loading || !user?.storeId) return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />;

  return (
    <ScreenSafeArea edges={['bottom']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{isEditing ? 'Edit service plan' : 'New service plan'}</Text>
        <ClientPickerSection
          storeId={user.storeId}
          clientName={clientName}
          onChangeName={setClientName}
          onSelect={(c) => {
            setClientId(c.id);
            setClientName(c.name);
          }}
          onCreateNew={() => navigation.navigate('ClientEditor', {})}
        />
        <ProductPickerSection
          storeId={user.storeId}
          multiSelect={false}
          onAdd={(ids) => void applyProduct(ids[0])}
          onCreateNew={() => navigation.navigate('ProductEditor', {})}
        />
        <Text style={styles.label}>Plan title</Text>
        <TextInput style={styles.input} placeholder="e.g. Monthly support" placeholderTextColor={COLORS.textMuted} value={title} onChangeText={setTitle} />
        <Text style={styles.label}>Billing</Text>
        <View style={styles.row}>
          {(['one_time', 'monthly'] as BillingType[]).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.chip, billingType === t && styles.chipActive]}
              onPress={() => setBillingType(t)}
            >
              <Text style={[styles.chipText, billingType === t && styles.chipTextActive]}>
                {t === 'monthly' ? 'Monthly' : 'One-time'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput style={styles.input} placeholder="Amount (USD)" placeholderTextColor={COLORS.textMuted} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        {billingType === 'monthly' ? (
          <TextInput
            style={styles.input}
            placeholder="Tasks per month (e.g. 12)"
            placeholderTextColor={COLORS.textMuted}
            value={monthlyUnits}
            onChangeText={setMonthlyUnits}
            keyboardType="number-pad"
          />
        ) : null}
        <Text style={styles.label}>How client pays</Text>
        {user?.storeId ? (
          <PaymentMethodChips storeId={user.storeId} value={paymentMethod} onChange={setPaymentMethod} />
        ) : null}
        <TextInput
          style={styles.input}
          placeholder="Payment source detail (e.g. Bank Audi, Whish +961…)"
          placeholderTextColor={COLORS.textMuted}
          value={paymentSource}
          onChangeText={setPaymentSource}
        />
        <TextInput style={styles.input} placeholder="Notes" placeholderTextColor={COLORS.textMuted} value={notes} onChangeText={setNotes} multiline />
        {isEditing && billingType === 'monthly' && unitsRemaining != null ? (
          <Text style={styles.usage}>Tasks remaining this month: {unitsRemaining}</Text>
        ) : null}
        <TouchableOpacity style={styles.saveBtn} onPress={() => void save()} disabled={saving}>
          <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save plan'}</Text>
        </TouchableOpacity>
        {isEditing ? (
          <>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => void recordPayment()}>
              <Text style={styles.secondaryText}>Record payment (creates receipt)</Text>
            </TouchableOpacity>
            {billingType === 'monthly' ? (
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => void logTask()}>
                <Text style={styles.secondaryText}>Log task (use 1 from monthly quota)</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.deleteBtn} onPress={remove}>
              <Text style={styles.deleteText}>Delete plan</Text>
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
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 8,
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  row: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  chipText: { color: COLORS.textSecondary, fontWeight: '600', textTransform: 'capitalize' },
  chipTextActive: { color: COLORS.secondary },
  usage: { fontWeight: '700', color: COLORS.primary, marginVertical: 8 },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 16, alignItems: 'center', marginTop: 8 },
  saveText: { color: '#fff', fontWeight: '700' },
  secondaryBtn: {
    marginTop: 10,
    borderRadius: RADIUS.md,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  secondaryText: { color: COLORS.primary, fontWeight: '700' },
  deleteBtn: { marginTop: 12, padding: 14, alignItems: 'center' },
  deleteText: { color: COLORS.error, fontWeight: '700' },
});
