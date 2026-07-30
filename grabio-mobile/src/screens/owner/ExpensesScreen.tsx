import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, Alert, TextInput, ScrollView, Modal, Pressable, RefreshControl,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { COLORS, RADIUS, SHADOW } from '../../theme';

const CATEGORIES = ['Rent', 'Utilities', 'Marketing', 'Salaries', 'Supplies', 'Transport', 'Other'];

interface Expense {
  id: string;
  category: string;
  description?: string;
  amount: number;
  currency?: string;
  date?: unknown;
  createdAt?: unknown;
  storeId: string;
}

type TimestampLike = {
  toDate?: () => Date;
};

export default function ExpensesScreen() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(true); // default: last 30 days so webapp data is visible
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1200);
  }, []);

  const financeExpensesRef = user?.storeId
    ? firestore().collection('stores').doc(user.storeId).collection('financeExpenses')
    : null;

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState('Other');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [saving, setSaving] = useState(false);

  const loadExpenses = useCallback(() => {
    if (!user?.storeId) return;
    setLoading(true);

    // Parse timestamp — handles Firestore Timestamp, ISO string, or number
    const getTs = (val: unknown): number => {
      if (!val) return 0;
      if (typeof val === 'object' && val !== null && typeof (val as TimestampLike).toDate === 'function') {
        return (val as TimestampLike).toDate!().getTime();
      }
      if (typeof val === 'string') return new Date(val).getTime();
      if (typeof val === 'number') return val;
      return 0;
    };

    const unsub = firestore()
      .collection('stores')
      .doc(user.storeId)
      .collection('financeExpenses')
      .onSnapshot((snap) => {
        if (!snap) { setLoading(false); return; }
        let data: Expense[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Expense));
        // Filter client-side — avoids composite Firestore index requirement
        if (!showAll) {
          const startOfToday = new Date();
          startOfToday.setHours(0, 0, 0, 0);
          data = data.filter(e => Math.max(
            getTs(e.createdAt),
            getTs(e.date),
            getTs((e as Expense & { expenseDate?: unknown }).expenseDate),
          ) >= startOfToday.getTime());
        }
        // showAll = no date restriction — show full history
        data.sort((a, b) => {
          const aTs = Math.max(getTs(a.createdAt), getTs(a.date), getTs((a as Expense & { expenseDate?: unknown }).expenseDate));
          const bTs = Math.max(getTs(b.createdAt), getTs(b.date), getTs((b as Expense & { expenseDate?: unknown }).expenseDate));
          return bTs - aTs;
        });
        setExpenses(data);
        setLoading(false);
      }, () => setLoading(false));
    return unsub;
  }, [user?.storeId, showAll]);

  useEffect(() => {
    if (!user?.storeId) { setLoading(false); return; }
    const unsub = loadExpenses();
    return () => { unsub?.(); };
  }, [user?.storeId, showAll, loadExpenses]);

  const totalToday = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  const saveExpense = async () => {
    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Invalid', 'Enter a valid amount');
      return;
    }
    setSaving(true);
    try {
      const createdAt = new Date().toISOString();
      await financeExpensesRef!.add({
        storeId: user!.storeId,
        name: description.trim() || category,
        category,
        description: description.trim() || null,
        amount: amountNum,
        currency: currency.trim() || 'USD',
        paymentMethod: 'cash',
        status: 'paid',
        expenseDate: createdAt,
        startDate: createdAt,
        date: createdAt,
        createdAt,
        updatedAt: createdAt,
      });
      setCategory('Other'); setDescription(''); setAmount(''); setCurrency('USD');
      setShowForm(false);
      Alert.alert('Saved', 'Expense recorded');
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const deleteExpense = (expense: Expense) => {
    Alert.alert('Delete Expense', 'Remove this expense record?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => financeExpensesRef?.doc(expense.id).delete(),
      },
    ]);
  };

  const resolveDate = (expense: Expense): Date | null => {
    const values = [expense.createdAt, expense.date, (expense as Expense & { expenseDate?: unknown }).expenseDate];
    for (const value of values) {
      if (!value) continue;
      if (typeof value === 'object' && value !== null && typeof (value as TimestampLike).toDate === 'function') {
        return (value as TimestampLike).toDate!();
      }
      if (typeof value === 'string' || typeof value === 'number') {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) return parsed;
      }
    }
    return null;
  };

  const CATEGORY_COLORS: Record<string, string> = {
    Rent: '#dbeafe', Utilities: '#fef3c7', Marketing: '#ede9fe',
    Salaries: '#d1fae5', Supplies: '#fce7f3', Transport: '#e0f2fe', Other: '#f3f4f6',
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}>
        {/* Header row — matches PurchasesScreen style */}
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Expenses</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={styles.periodBtn} onPress={() => setShowAll(!showAll)}>
              <Text style={styles.periodBtnText}>{showAll ? '📅 Last 30 days' : '📅 Today only'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(!showForm)}>
              <Text style={styles.addBtnText}>+ Add Expense</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Summary card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>{showAll ? 'Last 30 Days' : "Today's"} Total</Text>
          <Text style={styles.summaryAmount}>{expenses[0]?.currency || 'USD'} {totalToday.toFixed(2)}</Text>
        </View>

        {/* Add Expense Form */}
        {showForm && (
          <View style={styles.form}>
            <Text style={styles.formTitle}>New Expense</Text>

            {/* Category picker */}
            <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowCategoryPicker(true)}>
              <Text style={styles.pickerBtnText}>{category}</Text>
              <Text style={{ color: COLORS.textMuted }}>▼</Text>
            </TouchableOpacity>

            {/* Simple modal for category selection */}
            <Modal visible={showCategoryPicker} transparent animationType="fade">
              <Pressable style={styles.modalOverlay} onPress={() => setShowCategoryPicker(false)}>
                <View style={styles.modalBox}>
                  {CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={styles.modalOption}
                      onPress={() => { setCategory(cat); setShowCategoryPicker(false); }}
                    >
                      <Text style={[styles.modalOptionText, cat === category && { color: COLORS.primary, fontWeight: '700' }]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Pressable>
            </Modal>

            <TextInput
              style={styles.input}
              placeholder="Description (optional)"
              value={description}
              onChangeText={setDescription}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput
                style={[styles.input, { flex: 2 }]}
                placeholder="Amount"
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="USD"
                value={currency}
                onChangeText={setCurrency}
                autoCapitalize="characters"
              />
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={saveExpense} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowForm(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Expenses list */}
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 30 }} />
        ) : expenses.length === 0 ? (
          <Text style={styles.empty}>{showAll ? 'No expenses in last 30 days' : 'No expenses today'}</Text>
        ) : (
          expenses.map((expense) => {
            const date = resolveDate(expense);
            return (
              <View key={expense.id} style={[styles.expenseCard, { borderLeftColor: CATEGORY_COLORS[expense.category] || '#e5e7eb', borderLeftWidth: 4 }]}>
                <View style={styles.expenseRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.expenseCategory}>{expense.category}</Text>
                    {expense.description ? <Text style={styles.expenseDesc}>{expense.description}</Text> : null}
                    {date ? <Text style={styles.expenseDate}>{date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text> : null}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.expenseAmount}>{expense.currency || 'USD'} {(expense.amount || 0).toFixed(2)}</Text>
                    <TouchableOpacity onPress={() => deleteExpense(expense)} style={{ marginTop: 6 }}>
                      <Text style={{ color: COLORS.error, fontSize: 12 }}>🗑️ Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        )}

        {/* Load More */}
        <TouchableOpacity style={styles.loadMoreBtn} onPress={() => setShowAll(!showAll)}>
          <Text style={styles.loadMoreText}>
            {showAll ? '← Show Today Only' : '📅 Load Last 30 Days'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: COLORS.surface },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  periodBtn: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 8 },
  periodBtnText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  addBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  summaryCard: { backgroundColor: COLORS.primary, marginHorizontal: 12, marginTop: 12, marginBottom: 4, borderRadius: RADIUS.lg, padding: 16 },
  summaryLabel: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginBottom: 2 },
  summaryAmount: { fontSize: 24, fontWeight: '800', color: '#fff' },

  form: { backgroundColor: COLORS.surface, marginHorizontal: 12, borderRadius: RADIUS.lg, padding: 16, marginBottom: 12, ...SHADOW.sm },
  formTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  pickerBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 12, marginBottom: 10, backgroundColor: COLORS.background },
  pickerBtnText: { fontSize: 14, color: COLORS.textPrimary, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 12, fontSize: 14, backgroundColor: COLORS.background, marginBottom: 10, color: '#1A202C' },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 14, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelText: { color: COLORS.textMuted, textAlign: 'center', marginTop: 12, fontSize: 14 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 40 },
  modalBox: { backgroundColor: '#fff', borderRadius: RADIUS.lg, overflow: 'hidden' },
  modalOption: { padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalOptionText: { fontSize: 15, color: COLORS.textPrimary },

  expenseCard: { backgroundColor: COLORS.surface, marginHorizontal: 12, marginBottom: 8, borderRadius: RADIUS.lg, padding: 14, ...SHADOW.sm },
  expenseRow: { flexDirection: 'row', alignItems: 'flex-start' },
  expenseCategory: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  expenseDesc: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  expenseDate: { fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
  expenseAmount: { fontSize: 16, fontWeight: '700', color: COLORS.error },

  empty: { textAlign: 'center', color: COLORS.textMuted, paddingVertical: 24, paddingHorizontal: 16 },
  loadMoreBtn: { marginHorizontal: 12, marginTop: 12, padding: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  loadMoreText: { color: COLORS.primary, fontWeight: '600', fontSize: 14 },
});
