import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, Alert, TextInput, RefreshControl,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { COLORS, RADIUS, SHADOW } from '../../theme';

interface Statement {
  id: string;
  type: 'sale' | 'purchase' | 'payment' | 'expense' | 'other';
  description?: string;
  amount: number;
  direction: 'in' | 'out';
  date?: { toDate?: () => Date };
  createdAt?: { toDate?: () => Date };
  storeId: string;
}

type TimestampLike = {
  toDate?: () => Date;
};

const parseStatementDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (typeof value === 'object' && value !== null && typeof (value as TimestampLike).toDate === 'function') {
    return (value as TimestampLike).toDate!();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
};

const getStatementTime = (value: unknown): number => parseStatementDate(value)?.getTime() ?? 0;

export default function AccountStatementScreen() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'in' | 'out'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [description, setDescription] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerSuggestions, setCustomerSuggestions] = useState<string[]>([]);
  const [customerNames, setCustomerNames] = useState<string[]>([]);
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  // direction is always 'in' — out comes from expenses/purchases automatically
  const direction = 'in';

  useEffect(() => {
    if (!user?.storeId) { setLoading(false); return; }
    setLoading(true);
    const sid = user.storeId;

    // Load all 4 sources and merge client-side
    const loads = [
      firestore().collection('accountStatements').where('storeId', '==', sid).get(),
      firestore().collection('stores').doc(sid).collection('financeExpenses').get(),
      firestore().collection('purchases').where('storeId', '==', sid).get(),
      firestore().collection('orders').where('storeId', '==', sid).get(),
    ];

    // Use real-time listener for accountStatements so new entries appear instantly
    const unsubStatements = firestore()
      .collection('accountStatements')
      .where('storeId', '==', sid)
      .onSnapshot(() => {
        Promise.all(loads.map((_, i) => {
          const queries = [
            firestore().collection('accountStatements').where('storeId', '==', sid).get(),
            firestore().collection('stores').doc(sid).collection('financeExpenses').get(),
            firestore().collection('purchases').where('storeId', '==', sid).get(),
            firestore().collection('orders').where('storeId', '==', sid).get(),
          ];
          return queries[i];
        })).then(([statementsSnap, expensesSnap, purchasesSnap, ordersSnap]) => {
          const merged: Statement[] = [];

          // Manual payment entries
          statementsSnap.docs.forEach(d => {
            merged.push({ id: d.id, storeId: sid, ...d.data() } as Statement);
          });

          // Expenses → direction: out
          expensesSnap.docs.forEach(d => {
            const data = d.data();
            merged.push({
              id: `exp_${d.id}`,
              storeId: sid,
              type: 'expense',
              description: `${data.category || 'Expense'}${data.description ? ': ' + data.description : data.name ? ': ' + data.name : ''}`,
              amount: data.amount || 0,
              direction: 'out',
              createdAt: data.createdAt || data.expenseDate || data.startDate || data.date,
            });
          });

          // Purchases → direction: out
          purchasesSnap.docs.forEach(d => {
            const data = d.data();
            const total = data.total ?? data.totalAmount ?? data.totalCost ?? 0;
            merged.push({
              id: `pur_${d.id}`,
              storeId: sid,
              type: 'purchase',
              description: `Purchase: ${data.supplierName || 'Supplier'}`,
              amount: total,
              direction: 'out',
              createdAt: data.createdAt,
            });
          });

          // Orders (delivered/confirmed) → direction: in
          ordersSnap.docs.forEach(d => {
            const data = d.data();
            if (!['delivered', 'confirmed', 'completed'].includes(data.status)) return;
            const total = data.totalAmount ?? data.total ?? 0;
            merged.push({
              id: `ord_${d.id}`,
              storeId: sid,
              type: 'sale',
              description: `Order #${d.id.slice(-5).toUpperCase()}`,
              amount: total,
              direction: 'in',
              createdAt: data.createdAt,
            });
          });

          merged.sort((a, b) => {
            const da = getStatementTime(a.createdAt ?? a.date);
            const db2 = getStatementTime(b.createdAt ?? b.date);
            return db2 - da;
          });

          setEntries(merged);
          setLoading(false);
        }).catch(() => setLoading(false));
      }, () => setLoading(false));

    return () => unsubStatements?.();
  }, [user?.storeId]);

  // Load customer names for autocomplete
  useEffect(() => {
    if (!user?.storeId) return;
    firestore().collection('users')
      .where('storeId', '==', user.storeId)
      .get()
      .then(snap => {
        const names = snap.docs
          .map(d => d.data().displayName || d.data().name || '')
          .filter(Boolean);
        setCustomerNames(names);
      })
      .catch(() => {});
  }, [user?.storeId]);

  const onCustomerChange = (text: string) => {
    setCustomerName(text);
    if (text.trim().length > 0) {
      setCustomerSuggestions(customerNames.filter(n => n.toLowerCase().includes(text.toLowerCase())));
    } else {
      setCustomerSuggestions([]);
    }
  };

  const totalIn = entries.filter((e) => e.direction === 'in').reduce((s, e) => s + (e.amount || 0), 0);
  const totalOut = entries.filter((e) => e.direction === 'out').reduce((s, e) => s + (e.amount || 0), 0);
  const balance = totalIn - totalOut;

  const filteredEntries = activeFilter === 'all'
    ? entries
    : entries.filter(e => e.direction === activeFilter);

  const savePayment = async () => {
    const amtNum = parseFloat(amount);
    if (!description.trim() || isNaN(amtNum) || amtNum <= 0) {
      Alert.alert('Invalid', 'Description and valid amount are required.');
      return;
    }
    setSaving(true);
    try {
      await firestore().collection('accountStatements').add({
        storeId: user!.storeId,
        type: 'payment',
        description: description.trim(),
        customerName: customerName.trim() || null,
        amount: amtNum,
        direction,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
      setDescription(''); setCustomerName(''); setCustomerSuggestions([]); setAmount('');
      setShowPaymentForm(false);
      Alert.alert('Saved', 'Payment entry recorded.');
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const typeLabel = (type: Statement['type']) => {
    const map = { sale: '🛒 Sale', purchase: '📦 Purchase', payment: '💳 Payment', expense: '💸 Expense', other: '📄 Other' };
    return map[type] || type;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 1500); setEntries([]); setLoading(true); }} colors={[COLORS.primary]} />}>
        {/* Summary cards — tap to filter */}
        <View style={styles.summaryRow}>
          <TouchableOpacity
            style={[styles.summaryCard, { borderColor: '#22c55e' }, activeFilter === 'in' && styles.summaryCardActive]}
            onPress={() => setActiveFilter(activeFilter === 'in' ? 'all' : 'in')}
          >
            <Text style={styles.summaryLabel}>Total In</Text>
            <Text style={[styles.summaryAmount, { color: '#16a34a' }]}>${totalIn.toFixed(2)}</Text>
            {activeFilter === 'in' && <Text style={styles.filterIndicator}>Sales only</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.summaryCard, { borderColor: '#ef4444' }, activeFilter === 'out' && styles.summaryCardActive]}
            onPress={() => setActiveFilter(activeFilter === 'out' ? 'all' : 'out')}
          >
            <Text style={styles.summaryLabel}>Total Out</Text>
            <Text style={[styles.summaryAmount, { color: '#dc2626' }]}>${totalOut.toFixed(2)}</Text>
            {activeFilter === 'out' && <Text style={styles.filterIndicator}>Expenses+Purchases</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.summaryCard, { borderColor: COLORS.primary }, activeFilter === 'all' && styles.summaryCardActive]}
            onPress={() => setActiveFilter('all')}
          >
            <Text style={styles.summaryLabel}>Balance</Text>
            <Text style={[styles.summaryAmount, { color: balance >= 0 ? '#16a34a' : '#dc2626' }]}>${balance.toFixed(2)}</Text>
            {activeFilter === 'all' && <Text style={styles.filterIndicator}>All</Text>}
          </TouchableOpacity>
        </View>

        {/* Enter Payment button */}
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowPaymentForm(!showPaymentForm)}>
          <Text style={styles.addBtnText}>+ Enter Payment</Text>
        </TouchableOpacity>

        {/* Payment form */}
        {showPaymentForm && (
          <View style={styles.form}>
            <Text style={styles.formTitle}>💳 New Payment Received</Text>

            {/* Customer name with autocomplete */}
            <View style={{ marginBottom: 10 }}>
              <TextInput
                style={styles.input}
                placeholder="Customer name (optional)"
                placeholderTextColor="#9ca3af"
                value={customerName}
                onChangeText={onCustomerChange}
              />
              {customerSuggestions.length > 0 && (
                <View style={styles.suggestBox}>
                  {customerSuggestions.map((s) => (
                    <TouchableOpacity key={s} style={styles.suggestItem} onPress={() => { setCustomerName(s); setCustomerSuggestions([]); }}>
                      <Text style={styles.suggestText}>👤 {s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <TextInput
              style={styles.input}
              placeholder="Description (e.g. Invoice payment)"
              placeholderTextColor="#9ca3af"
              value={description}
              onChangeText={setDescription}
            />
            <TextInput
              style={styles.input}
              placeholder="Amount"
              placeholderTextColor="#9ca3af"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity style={styles.saveBtn} onPress={savePayment} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Payment (Money In)</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowPaymentForm(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Entries list */}
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : filteredEntries.length === 0 ? (
          <Text style={styles.empty}>{activeFilter === 'in' ? 'No sales yet.' : activeFilter === 'out' ? 'No expenses or purchases yet.' : 'No account entries yet.'}</Text>
        ) : (
          filteredEntries.map((e) => {
            const date = parseStatementDate(e.createdAt) || parseStatementDate(e.date);
            return (
              <View key={e.id} style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.entryType}>{typeLabel(e.type)}</Text>
                    {e.description && <Text style={styles.entryDesc}>{e.description}</Text>}
                    {date && <Text style={styles.entryDate}>{date.toLocaleDateString()}</Text>}
                  </View>
                  <Text style={[styles.entryAmount, { color: e.direction === 'in' ? '#16a34a' : '#dc2626' }]}>
                    {e.direction === 'in' ? '+' : '-'}${(e.amount || 0).toFixed(2)}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  summaryCard: { flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 12, alignItems: 'center', borderWidth: 1.5, ...SHADOW.sm },
  summaryCardActive: { backgroundColor: '#f0f4ff' },
  filterIndicator: { fontSize: 9, color: COLORS.primary, fontWeight: '700', marginTop: 2 },
  summaryLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600', marginBottom: 4 },
  summaryAmount: { fontSize: 16, fontWeight: '700' },
  addBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 12, alignItems: 'center', marginBottom: 16 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  empty: { textAlign: 'center', color: COLORS.textMuted, marginTop: 40, fontSize: 15 },
  form: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 16, marginBottom: 16, ...SHADOW.sm },
  formTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 12, fontSize: 14, color: '#1A202C', backgroundColor: '#f9fafb', marginBottom: 10 },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 14, alignItems: 'center', marginTop: 4 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelText: { color: COLORS.textMuted, textAlign: 'center', marginTop: 12, fontSize: 14 },
  suggestBox: { backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, marginTop: -8, overflow: 'hidden' },
  suggestItem: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  suggestText: { fontSize: 14, color: '#1A202C' },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 14, marginBottom: 10, ...SHADOW.sm },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  entryType: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  entryDesc: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  entryDate: { fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
  entryAmount: { fontSize: 16, fontWeight: '700', marginLeft: 8 },
});
