import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, Alert, TextInput,
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

export default function AccountStatementScreen() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.storeId) { setLoading(false); return; }
    const unsub = firestore()
      .collection('accountStatements')
      .where('storeId', '==', user.storeId)
      .onSnapshot((snap) => {
        if (!snap) { setLoading(false); return; }
        const data = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Statement))
          .sort((a, b) => {
            const da = a.createdAt?.toDate?.() || a.date?.toDate?.() || new Date(0);
            const db2 = b.createdAt?.toDate?.() || b.date?.toDate?.() || new Date(0);
            return db2.getTime() - da.getTime();
          });
        setEntries(data);
        setLoading(false);
      }, () => setLoading(false));
    return unsub;
  }, [user?.storeId]);

  const totalIn = entries.filter((e) => e.direction === 'in').reduce((s, e) => s + (e.amount || 0), 0);
  const totalOut = entries.filter((e) => e.direction === 'out').reduce((s, e) => s + (e.amount || 0), 0);
  const balance = totalIn - totalOut;

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
        amount: amtNum,
        direction,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
      setDescription(''); setAmount(''); setDirection('in');
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
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Summary cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderColor: '#22c55e' }]}>
            <Text style={styles.summaryLabel}>Total In</Text>
            <Text style={[styles.summaryAmount, { color: '#16a34a' }]}>${totalIn.toFixed(2)}</Text>
          </View>
          <View style={[styles.summaryCard, { borderColor: '#ef4444' }]}>
            <Text style={styles.summaryLabel}>Total Out</Text>
            <Text style={[styles.summaryAmount, { color: '#dc2626' }]}>${totalOut.toFixed(2)}</Text>
          </View>
          <View style={[styles.summaryCard, { borderColor: COLORS.primary }]}>
            <Text style={styles.summaryLabel}>Balance</Text>
            <Text style={[styles.summaryAmount, { color: balance >= 0 ? '#16a34a' : '#dc2626' }]}>${balance.toFixed(2)}</Text>
          </View>
        </View>

        {/* Enter Payment button */}
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowPaymentForm(!showPaymentForm)}>
          <Text style={styles.addBtnText}>+ Enter Payment</Text>
        </TouchableOpacity>

        {/* Payment form */}
        {showPaymentForm && (
          <View style={styles.form}>
            <Text style={styles.formTitle}>New Payment Entry</Text>

            {/* Direction toggle */}
            <View style={styles.dirRow}>
              <TouchableOpacity
                style={[styles.dirBtn, direction === 'in' && styles.dirBtnIn]}
                onPress={() => setDirection('in')}
              >
                <Text style={[styles.dirBtnText, direction === 'in' && { color: '#fff' }]}>⬇️ Money In</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dirBtn, direction === 'out' && styles.dirBtnOut]}
                onPress={() => setDirection('out')}
              >
                <Text style={[styles.dirBtnText, direction === 'out' && { color: '#fff' }]}>⬆️ Money Out</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Description (e.g. Supplier payment)"
              value={description}
              onChangeText={setDescription}
            />
            <TextInput
              style={styles.input}
              placeholder="Amount"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity style={styles.saveBtn} onPress={savePayment} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Entry</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowPaymentForm(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Entries list */}
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : entries.length === 0 ? (
          <Text style={styles.empty}>No account entries yet.</Text>
        ) : (
          entries.map((e) => {
            const date = e.createdAt?.toDate?.() || e.date?.toDate?.();
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
  summaryLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600', marginBottom: 4 },
  summaryAmount: { fontSize: 16, fontWeight: '700' },
  addBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 12, alignItems: 'center', marginBottom: 16 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  empty: { textAlign: 'center', color: COLORS.textMuted, marginTop: 40, fontSize: 15 },
  form: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 16, marginBottom: 16, ...SHADOW.sm },
  formTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  dirRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  dirBtn: { flex: 1, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 12, alignItems: 'center' },
  dirBtnIn: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  dirBtnOut: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  dirBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 12, fontSize: 14, backgroundColor: COLORS.background, marginBottom: 10 },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 14, alignItems: 'center', marginTop: 4 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelText: { color: COLORS.textMuted, textAlign: 'center', marginTop: 12, fontSize: 14 },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 14, marginBottom: 10, ...SHADOW.sm },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  entryType: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  entryDesc: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  entryDate: { fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
  entryAmount: { fontSize: 16, fontWeight: '700', marginLeft: 8 },
});
