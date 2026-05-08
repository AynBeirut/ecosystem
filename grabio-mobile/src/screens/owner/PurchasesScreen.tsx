import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, Alert, TextInput, FlatList, RefreshControl,
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
  supplierId?: string;
  items?: PurchaseItem[];
  total?: number;
  totalAmount?: number;
  totalCost?: number;
  status?: string;
  createdAt?: unknown;
}

export default function PurchasesScreen() {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Supplier data: array of names (for autocomplete) + map id→name (to resolve webapp purchases)
  const [supplierNames, setSupplierNames] = useState<string[]>([]);
  const [supplierMap, setSupplierMap] = useState<Map<string, string>>(new Map());
  const [supplier, setSupplier] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const [itemName, setItemName] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [productSuggestions, setProductSuggestions] = useState<{ id: string; name: string }[]>([]);
  const [qty, setQty] = useState('');
  const [cost, setCost] = useState('');

  // Load products for item selection
  useEffect(() => {
    if (!user?.storeId) return;
    firestore().collection('products').where('storeId', '==', user.storeId).get()
      .then(snap => {
        setProducts(snap.docs.map(d => ({ id: d.id, name: (d.data().name as string) || '' })).filter(p => p.name));
      })
      .catch(() => {});
  }, [user?.storeId]);

  const onItemSearchChange = (text: string) => {
    setItemSearch(text);
    setItemName(text);
    if (text.trim().length > 0) {
      setProductSuggestions(products.filter(p => p.name.toLowerCase().includes(text.toLowerCase())));
    } else {
      setProductSuggestions(products.slice(0, 8));
    }
  };

  const onItemFocus = () => {
    if (!itemSearch.trim()) {
      setProductSuggestions(products.slice(0, 8));
    }
  };

  const onItemFocusBlur = () => {
    setTimeout(() => setProductSuggestions([]), 200);
  };
  useEffect(() => {
    if (!user?.storeId) return;
    firestore().collection('suppliers').where('storeId', '==', user.storeId).get()
      .then(snap => {
        const names: string[] = [];
        const map = new Map<string, string>();
        snap.docs.forEach(d => {
          const name = (d.data().name as string) || '';
          if (name) { names.push(name); map.set(d.id, name); }
        });
        setSupplierNames(names);
        setSupplierMap(map);
      })
      .catch(() => {});
  }, [user?.storeId]);

  const onSupplierChange = (text: string) => {
    setSupplier(text);
    if (text.trim().length > 0) {
      setSuggestions(supplierNames.filter(s => s.toLowerCase().includes(text.toLowerCase())));
    } else {
      setSuggestions([]);
    }
  };
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Helper: parse createdAt regardless of format (Firestore Timestamp OR ISO string)
  const getTs = (val: unknown): number => {
    if (!val) return 0;
    if (typeof (val as any).toDate === 'function') return (val as any).toDate().getTime();
    if (typeof val === 'string') return new Date(val).getTime();
    if (typeof val === 'number') return val;
    return 0;
  };

  // Load purchases — filter by storeId only, sort client-side
  const fetchPurchases = useCallback(() => {
    if (!user?.storeId) { setLoading(false); return; }
    setLoading(true);
    const unsub = firestore()
      .collection('purchases')
      .where('storeId', '==', user.storeId)
      .onSnapshot((snap) => {
        if (!snap) { setLoading(false); return; }
        let data: Purchase[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Purchase));
        // Sort newest first
        data.sort((a, b) => getTs(b.createdAt) - getTs(a.createdAt));
        // Filter: today-only toggle; showAll = full history
        if (!showAll) {
          const startOfToday = new Date();
          startOfToday.setHours(0, 0, 0, 0);
          data = data.filter(p => getTs(p.createdAt) >= startOfToday.getTime());
        }
        // showAll = no date restriction — show full history
        setPurchases(data);
        setLoading(false);
      }, () => setLoading(false));
    return unsub;
  }, [user?.storeId, showAll]);

  useEffect(() => {
    const unsub = fetchPurchases();
    return () => { unsub?.(); };
  }, [fetchPurchases]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1200);
  }, []);

  const savePurchase = async () => {
    if (!supplier.trim() || !itemName.trim() || !qty.trim()) {
      Alert.alert('Missing fields', 'Supplier name, item name, and quantity are required.');
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
      setSupplier(''); setSuggestions([]); setItemName(''); setItemSearch(''); setProductSuggestions([]); setQty(''); setCost('');
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
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}>
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

            {/* Supplier with autocomplete */}
            <View style={{ marginBottom: 10 }}>
              <TextInput
                style={styles.input}
                placeholder="Supplier name *"
                placeholderTextColor="#9ca3af"
                value={supplier}
                onChangeText={onSupplierChange}
              />
              {suggestions.length > 0 && (
                <View style={styles.suggestBox}>
                  {suggestions.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={styles.suggestItem}
                      onPress={() => { setSupplier(s); setSuggestions([]); }}
                    >
                      <Text style={styles.suggestText}>🏭 {s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View style={{ marginBottom: 10 }}>
              <TextInput
                style={styles.input}
                placeholder="Search product / item name *"
                placeholderTextColor="#9ca3af"
                value={itemSearch}
                onChangeText={onItemSearchChange}
                onFocus={onItemFocus}
                onBlur={onItemFocusBlur}
              />
              {productSuggestions.length > 0 && (
                <View style={styles.suggestBox}>
                  {productSuggestions.map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      style={styles.suggestItem}
                      onPress={() => { setItemName(p.name); setItemSearch(p.name); setProductSuggestions([]); }}
                    >
                      <Text style={styles.suggestText}>📦 {p.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="Quantity *" placeholderTextColor="#9ca3af" keyboardType="number-pad" value={qty} onChangeText={setQty} />
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="Unit cost (optional)" placeholderTextColor="#9ca3af" keyboardType="decimal-pad" value={cost} onChangeText={setCost} />
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
                  <Text style={styles.supplierName}>{p.supplierName || (p.supplierId ? supplierMap.get(p.supplierId) : undefined) || 'No supplier'}</Text>
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
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 12, fontSize: 14, backgroundColor: COLORS.background, marginBottom: 10, color: '#1A202C' },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 14, alignItems: 'center', marginTop: 4 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelText: { color: COLORS.textMuted, textAlign: 'center', marginTop: 12, fontSize: 14 },
  suggestBox: { backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, marginTop: -8, overflow: 'hidden' },
  suggestItem: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  suggestText: { fontSize: 14, color: COLORS.textPrimary },
});
