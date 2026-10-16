import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import ScreenSafeArea from '../../components/ScreenSafeArea';
import DatePickerField from '../../components/DatePickerField';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { fetchStoreProfile, getExpense, saveExpense } from '../../lib/financeService';
import { EXPENSE_CATEGORIES } from '../../lib/expenseConstants';
import PaymentMethodChips from '../../components/PaymentMethodChips';
import type { RootStackParamList } from '../../types';
import { COLORS, RADIUS } from '../../theme';

type Route = RouteProp<RootStackParamList, 'ExpenseEditor'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

function storeCurrencies(profile: Record<string, unknown> | null): string[] {
  const main = String(profile?.mainCurrency || 'USD').trim().toUpperCase() || 'USD';
  const secondary = String(profile?.secondaryCurrency || '').trim().toUpperCase();
  return secondary && secondary !== main ? [main, secondary] : [main];
}

export default function ExpenseEditorScreen() {
  const { user } = useAuth();
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const [loading, setLoading] = useState(!!route.params.expenseId);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('other');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [vendorName, setVendorName] = useState('');
  const [notes, setNotes] = useState('');
  const [currencies, setCurrencies] = useState<string[]>(['USD']);
  const [currency, setCurrency] = useState('USD');
  const [expenseDate, setExpenseDate] = useState<Date>(new Date());

  useEffect(() => {
    if (!user?.storeId) {
      setLoading(false);
      return;
    }
    void (async () => {
      const profile = await fetchStoreProfile(user.storeId!);
      const allowed = storeCurrencies(profile as Record<string, unknown> | null);
      setCurrencies(allowed);
      setCurrency(allowed[0]);
      if (route.params.expenseId) {
        const exp = await getExpense(user.storeId!, route.params.expenseId);
        if (exp) {
          setName(exp.name);
          setAmount(String(exp.amount));
          setCategory(exp.category || 'other');
          setPaymentMethod(exp.paymentMethod || 'cash');
          setVendorName(exp.vendorName || '');
          setNotes(exp.notes || '');
          const saved = (exp.currency || allowed[0]).toUpperCase();
          setCurrency(allowed.includes(saved) ? saved : allowed[0]);
          setExpenseDate(new Date(exp.startDate));
        }
      }
      setLoading(false);
    })();
  }, [user?.storeId, route.params.expenseId]);

  const save = async () => {
    if (!user?.storeId || !name.trim() || !amount) {
      Alert.alert('Required', 'Name and amount are required');
      return;
    }
    setSaving(true);
    try {
      await saveExpense(user.storeId, {
        id: route.params.expenseId,
        name: name.trim(),
        amount: parseFloat(amount) || 0,
        category,
        paymentMethod,
        vendorName: vendorName.trim() || undefined,
        notes,
        currency,
        status: 'paid',
        startDate: expenseDate.toISOString(),
      });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />;

  return (
    <ScreenSafeArea edges={['bottom']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{route.params.expenseId ? 'Edit expense' : 'New expense'}</Text>
        <TextInput style={styles.input} placeholder="Expense name" placeholderTextColor={COLORS.textMuted} value={name} onChangeText={setName} />
        <TextInput
          style={styles.input}
          placeholder="Amount"
          placeholderTextColor={COLORS.textMuted}
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
        />
        <TextInput style={styles.input} placeholder="Vendor (optional)" placeholderTextColor={COLORS.textMuted} value={vendorName} onChangeText={setVendorName} />
        <Text style={styles.label}>Category</Text>
        <View style={styles.chips}>
          {EXPENSE_CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c.value}
              style={[styles.chip, category === c.value && styles.chipActive]}
              onPress={() => setCategory(c.value)}
            >
              <Text style={[styles.chipText, category === c.value && styles.chipTextActive]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.label}>Payment method</Text>
        {user?.storeId ? (
          <PaymentMethodChips storeId={user.storeId} value={paymentMethod} onChange={setPaymentMethod} />
        ) : null}
        <DatePickerField label="Expense date" value={expenseDate} onChange={(d) => d && setExpenseDate(d)} />
        <Text style={styles.label}>Currency</Text>
        <View style={styles.chips}>
          {currencies.map((code) => (
            <TouchableOpacity key={code} style={[styles.chip, currency === code && styles.chipActive]} onPress={() => setCurrency(code)}>
              <Text style={[styles.chipText, currency === code && styles.chipTextActive]}>{code}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput style={styles.input} placeholder="Notes" placeholderTextColor={COLORS.textMuted} value={notes} onChangeText={setNotes} multiline />
        <TouchableOpacity style={styles.saveBtn} onPress={() => void save()} disabled={saving}>
          <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save expense'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12, color: COLORS.textPrimary },
  label: { fontWeight: '600', marginTop: 8, marginBottom: 6, color: COLORS.textSecondary },
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  chipActive: { borderColor: COLORS.primary, backgroundColor: '#E6FFFA' },
  chipText: { fontSize: 13, color: COLORS.textPrimary },
  chipTextActive: { color: COLORS.primary, fontWeight: '700' },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 16, alignItems: 'center', marginTop: 8 },
  saveText: { color: '#fff', fontWeight: '700' },
});
