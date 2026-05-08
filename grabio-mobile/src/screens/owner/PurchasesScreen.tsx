import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, Alert, TextInput,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { COLORS, RADIUS, SHADOW } from '../../theme';

interface PurchaseItem {
  name?: string;
  quantity?: number;
  unitCost?: number;
}

interface Purchase {
  id: string;
  supplierName?: string;
  items?: PurchaseItem[];
  total?: number;
  totalAmount?: number;
  totalCost?: number;
  status?: string;
  createdAt?: { toDate?: () => Date };
}

export default function PurchasesScreen() {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [supplier, setSupplier] = useState('');
  const [itemName, setItemName] = useState('');
  const [qty, setQty] = useState('');
  const [cost, setCost] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchPurchases = useCallback(() => {
    if (!user?.storeId) { setLoading(false); return; }
    setLoading(true);
    const now = new Date();
    let query = firestore().collection('purchases').where('storeId', '==', user.storeId);

    if (showAll) {
      const since30 = new Date(now);
      since30.setDate(since30.getDate() - 30);
      query = (query as typeof query).where('createdAt', '>=', firestore.Timestamp.fromDate(since30));
    } else {
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      query = (query as typeof query).where('createdAt', '>=', firestore.Timestamp.fromDate(startOfToday));
    }

    const unsub = (query as typeof query).orderBy('createdAt', 'desc').onSnapshot((snap) => {
      if (!snap) { setLoading(false); return; }
      setPurchases(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Purchase)));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [user?.storeId, showAll]);

  useEffect(() => {
    const unsub = fetchPurchases();
    return unsub;
  }, [fetchPurchases]);

  const savePurchase = async () => {
    if (!supplier.trim() || !itemName.trim() || !qty.trim()) {
      Alert.alert('Missing fields', 'Supplier, item name, and quantity are required.');
      return;
    }
    setSaving(true);
    try {
      const qtyNum = parseInt(qty, 10);
      const costNum = parseFloat(cost) || 0;
      await firestore().collection('purchases').add({
        storeId: user!.storeId,
        supplierName: supplier.trim(),
        items: [{ name: itemName.trim(), quantity: qtyNum, unitCost: costNum }],
        total: qtyNum * costNum,
        status: 'received',
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
      setSupplier(''); setItemName(''); setQty(''); setCost('');
      setShowForm(false);
      Alert.alert('Saved', 'Purchase recorded.');
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Header row */}
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.periodBtn} onPress={() => setShowAll(!showAll)}>
            <Text style={styles.periodText}>{showAll ? '📅 Last 30 days' : '📅 Today only'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(!showForm)}>
            <Text style={styles.addBtnText}>+ New Purchase</Text>
          </TouchableOpacity>
        </View>

        {/* New Purchase Form */}
        {showForm && (
          <View style={styles.form}>
            <Text style={styles.formTitle}>Record Purchase</Text>
            <TextInput style={styles.input} placeholder="Supplier name" value={supplier} onChangeText={setSupplier} />
            <TextInput style={styles.input} placeholder="Item / Material name" value={itemName} onChangeText={setItemName} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="Quantity" keyboardType="number-pad" value={qty} onChangeText={setQty} />
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="Unit cost (optional)" keyboardType="decimal-pad" value={cost} onChangeText={setCost} />
            </View>
            <TouchableOpacity style={styles.saveBtn} onPress={savePurchase} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Purchase</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowForm(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : purchases.length === 0 ? (
          <Text style={styles.empty}>{showAll ? 'No purchases in last 30 days.' : 'No purchases today.'}</Text>
        ) : (
          purchases.map((p) => {
            const total = p.total ?? p.totalAmount ?? p.totalCost ?? 0;
            const date = p.createdAt?.toDate?.();
            return (
              <View key={p.id} style={styles.card}>
                <View style={styles.cardRow}>
                  <Text style={styles.supplierName}>{p.supplierName || 'Unknown supplier'}</Text>
                  <Text style={styles.totalText}>{total > 0 ? `$${total.toFixed(2)}` : '—'}</Text>
                </View>
                {p.items?.map((i, idx) => (
                  <Text key={idx} style={styles.itemText}>
                    • {i.name} × {i.quantity}{i.unitCost ? ` @ $${i.unitCost}` : ''}
                  </Text>
                ))}
                {date && <Text style={styles.dateText}>{date.toLocaleDateString()}</Text>}
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  periodBtn: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 8 },
  periodText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  addBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  empty: { textAlign: 'center', color: COLORS.textMuted, marginTop: 40, fontSize: 15 },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 14, marginBottom: 10, ...SHADOW.sm },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  supplierName: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  totalText: { fontSize: 15, fontWeight: '700', color: COLORS.primary },
  itemText: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  dateText: { fontSize: 11, color: COLORS.textMuted, marginTop: 6 },
  form: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 16, marginBottom: 16, ...SHADOW.sm },
  formTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 12, fontSize: 14, backgroundColor: COLORS.background, marginBottom: 10 },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 14, alignItems: 'center', marginTop: 4 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelText: { color: COLORS.textMuted, textAlign: 'center', marginTop: 12, fontSize: 14 },
});
