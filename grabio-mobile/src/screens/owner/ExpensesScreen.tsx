import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, Alert, TextInput, ScrollView, Modal, Pressable,
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
  date?: any;
  createdAt?: any;
  storeId: string;
}

export default function ExpensesScreen() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState('Other');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.storeId) { setLoading(false); return; }
    loadExpenses();
  }, [user?.storeId, showAll]);

  const loadExpenses = useCallback(() => {
    if (!user?.storeId) return;
    setLoading(true);
    const now = new Date();
    let query = firestore().collection('expenses').where('storeId', '==', user.storeId);

    if (!showAll) {
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      query = query.where('createdAt', '>=', firestore.Timestamp.fromDate(startOfToday));
    } else {
      const since30 = new Date(now);
      since30.setDate(since30.getDate() - 30);
      query = query.where('createdAt', '>=', firestore.Timestamp.fromDate(since30));
    }

    const unsub = query.orderBy('createdAt', 'desc').onSnapshot((snap) => {
      if (!snap) { setLoading(false); return; }
      setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Expense)));
      setLoading(false);
    });
    return unsub;
  }, [user?.storeId, showAll]);

  const totalToday = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  const saveExpense = async () => {
    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Invalid', 'Enter a valid amount');
      return;
    }
    setSaving(true);
    try {
      await firestore().collection('expenses').add({
        storeId: user!.storeId,
        category,
        description: description.trim() || null,
        amount: amountNum,
        currency: currency.trim() || 'USD',
        date: firestore.FieldValue.serverTimestamp(),
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
      setCategory('Other'); setDescription(''); setAmount(''); setCurrency('USD');
      setShowForm(false);
      Alert.alert('Saved', 'Expense recorded');
    } catch (err: any) {
      Alert.alert('Error', err.message);
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
        onPress: () => firestore().collection('expenses').doc(expense.id).delete(),
      },
    ]);
  };

  const CATEGORY_COLORS: Record<string, string> = {
    Rent: '#dbeafe', Utilities: '#fef3c7', Marketing: '#ede9fe',
    Salaries: '#d1fae5', Supplies: '#fce7f3', Transport: '#e0f2fe', Other: '#f3f4f6',
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Summary bar */}
        <View style={styles.summaryBar}>
          <View>
            <Text style={styles.summaryLabel}>{showAll ? 'Last 30 Days' : "Today's"} Expenses</Text>
            <Text style={styles.summaryAmount}>{expenses[0]?.currency || 'USD'} {totalToday.toFixed(2)}</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(!showForm)}>
            <Text style={styles.addBtnText}>+ Add Expense</Text>
          </TouchableOpacity>
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
            const date = expense.createdAt?.toDate?.() || expense.date?.toDate?.();
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
  summaryBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.primary, padding: 16, marginBottom: 12,
  },
  summaryLabel: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginBottom: 2 },
  summaryAmount: { fontSize: 24, fontWeight: '800', color: '#fff' },
  addBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  form: { backgroundColor: COLORS.surface, marginHorizontal: 12, borderRadius: RADIUS.lg, padding: 16, marginBottom: 12, ...SHADOW.sm },
  formTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  pickerBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 12, marginBottom: 10, backgroundColor: COLORS.background },
  pickerBtnText: { fontSize: 14, color: COLORS.textPrimary, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 12, fontSize: 14, backgroundColor: COLORS.background, marginBottom: 10 },
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
