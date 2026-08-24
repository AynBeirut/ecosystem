import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, Alert, TextInput, RefreshControl, KeyboardAvoidingView, Platform,
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
  paymentStatus?: string;
  amountPaid?: number;
  remainingAmount?: number;
  createdAt?: unknown;
}

export default function PurchasesScreen() {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(true);
  const [showForm, setShowForm] = useState(false);

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
  const [markPaid, setMarkPaid] = useState(true);
  const [saving, setSaving] = useState(false);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user?.storeId) return;
    firestore().collection('products').where('storeId', '==', user.storeId).get()
      .then(snap => {
        setProducts(snap.docs.map(d => ({ id: d.id, name: (d.data().name as string) || '' })).filter(p => p.name));
      })
      .catch(() => {});
  }, [user?.storeId]);

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

  const getTs = (val: unknown): number => {
    if (!val) return 0;
    if (typeof (val as { toDate?: () => Date }).toDate === 'function') return (val as { toDate: () => Date }).toDate().getTime();
    if (typeof val === 'string') return new Date(val).getTime();
    if (typeof val === 'number') return val;
    return 0;
  };

  const fetchPurchases = useCallback(() => {
    if (!user?.storeId) { setLoading(false); return; }
    setLoading(true);
    const unsub = firestore()
      .collection('purchases')
      .where('storeId', '==', user.storeId)
      .onSnapshot((snap) => {
        if (!snap) { setLoading(false); return; }
        let data: Purchase[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Purchase));
        data.sort((a, b) => getTs(b.createdAt) - getTs(a.createdAt));
        if (!showAll) {
          const startOfToday = new Date();
          startOfToday.setHours(0, 0, 0, 0);
          data = data.filter(p => getTs(p.createdAt) >= startOfToday.getTime());
        }
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

  const onSupplierChange = (text: string) => {
    setSupplier(text);
    if (text.trim().length > 0) {
      setSuggestions(supplierNames.filter(s => s.toLowerCase().includes(text.toLowerCase())));
    } else {
      setSuggestions([]);
    }
  };

  const onItemSearchChange = (text: string) => {
    setItemSearch(text);
    setItemName(text);
    if (text.trim().length > 0) {
      setProductSuggestions(products.filter(p => p.name.toLowerCase().includes(text.toLowerCase())));
    } else {
      setProductSuggestions(products.slice(0, 8));
    }
  };

  const resetForm = () => {
    setSupplier('');
    setSuggestions([]);
    setItemName('');
    setItemSearch('');
    setProductSuggestions([]);
    setQty('');
    setCost('');
    setMarkPaid(true);
    setShowForm(false);
  };

  const savePurchase = async (paid: boolean) => {
    if (!supplier.trim() || !itemName.trim() || !qty.trim()) {
      Alert.alert('Missing fields', 'Supplier name, item name, and quantity are required.');
      return;
    }
    setSaving(true);
    try {
      const qtyNum = parseInt(qty, 10);
      const costNum = parseFloat(cost) || 0;
      const total = qtyNum * costNum;
      const now = new Date().toISOString();
      const today = now.slice(0, 10);
      await firestore().collection('purchases').add({
        storeId: user!.storeId,
        supplierName: supplier.trim(),
        items: [{ name: itemName.trim(), quantity: qtyNum, unitCost: costNum }],
        total,
        totalAmount: total,
        status: paid ? 'received' : 'draft',
        receivedDate: paid ? now : null,
        paymentStatus: paid ? 'paid' : 'unpaid',
        amountPaid: paid ? total : 0,
        remainingAmount: paid ? 0 : total,
        paymentMethod: paid ? 'cash' : '',
        paymentDate: paid ? today : null,
        paymentNotes: paid ? 'Mobile purchase — paid' : 'Mobile purchase — unpaid',
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: now,
      });
      resetForm();
      Alert.alert('Saved', paid ? 'Purchase recorded and marked paid.' : 'Purchase saved (unpaid).');
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const markPurchasePaid = async (purchase: Purchase) => {
    const total = purchase.total ?? purchase.totalAmount ?? purchase.totalCost ?? 0;
    if (total <= 0) return;
    setMarkingPaidId(purchase.id);
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    try {
      await firestore().collection('purchases').doc(purchase.id).update({
        status: 'received',
        receivedDate: now,
        paymentStatus: 'paid',
        amountPaid: total,
        remainingAmount: 0,
        paymentMethod: 'cash',
        paymentDate: today,
        paymentNotes: 'Marked paid from mobile',
        updatedAt: now,
      });
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to mark as paid');
    } finally {
      setMarkingPaidId(null);
    }
  };

  const isPurchaseUnpaid = (purchase: Purchase) => {
    if (purchase.paymentStatus === 'paid') return false;
    if (purchase.paymentStatus === 'unpaid') return true;
    const total = purchase.total ?? purchase.totalAmount ?? purchase.totalCost ?? 0;
    const paid = Number(purchase.amountPaid || 0);
    return total > 0 && paid < total;
  };

  const totalAmount = purchases.reduce((sum, p) => sum + (p.total ?? p.totalAmount ?? p.totalCost ?? 0), 0);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        >
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Purchases</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.periodBtn} onPress={() => setShowAll(!showAll)}>
                <Text style={styles.periodBtnText}>{showAll ? '📅 All history' : '📅 Today only'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(!showForm)}>
                <Text style={styles.addBtnText}>+ New</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{showAll ? 'All Purchases Total' : "Today's Purchases"}</Text>
            <Text style={styles.summaryAmount}>${totalAmount.toFixed(2)}</Text>
            <Text style={styles.summaryMeta}>{purchases.length} record{purchases.length === 1 ? '' : 's'}</Text>
          </View>

          {showForm && (
            <View style={styles.form}>
              <Text style={styles.formTitle}>Record Purchase</Text>

              <Text style={styles.fieldLabel}>Supplier *</Text>
              <TextInput
                style={styles.input}
                placeholder="Supplier name"
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

              <Text style={styles.fieldLabel}>Item *</Text>
              <TextInput
                style={styles.input}
                placeholder="Search product / item name"
                placeholderTextColor="#9ca3af"
                value={itemSearch}
                onChangeText={onItemSearchChange}
                onFocus={() => {
                  if (!itemSearch.trim()) setProductSuggestions(products.slice(0, 8));
                }}
                onBlur={() => setTimeout(() => setProductSuggestions([]), 200)}
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

              <View style={styles.rowInputs}>
                <View style={styles.rowField}>
                  <Text style={styles.fieldLabel}>Quantity *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor="#9ca3af"
                    keyboardType="number-pad"
                    value={qty}
                    onChangeText={setQty}
                  />
                </View>
                <View style={styles.rowField}>
                  <Text style={styles.fieldLabel}>Unit cost</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0.00"
                    placeholderTextColor="#9ca3af"
                    keyboardType="decimal-pad"
                    value={cost}
                    onChangeText={setCost}
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>Payment</Text>
              <View style={styles.paymentRow}>
                <TouchableOpacity
                  style={[styles.paymentChip, markPaid && styles.paymentChipActive]}
                  onPress={() => setMarkPaid(true)}
                >
                  <Text style={[styles.paymentChipText, markPaid && styles.paymentChipTextActive]}>Paid</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.paymentChip, !markPaid && styles.paymentChipActive]}
                  onPress={() => setMarkPaid(false)}
                >
                  <Text style={[styles.paymentChipText, !markPaid && styles.paymentChipTextActive]}>Unpaid</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={() => void savePurchase(markPaid)} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>
                    {markPaid ? 'Save & mark paid' : 'Save unpaid'}
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={resetForm}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {loading ? (
            <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 30 }} />
          ) : purchases.length === 0 ? (
            <Text style={styles.empty}>{showAll ? 'No purchases yet.' : 'No purchases today.'}</Text>
          ) : (
            purchases.map((p) => {
              const total = p.total ?? p.totalAmount ?? p.totalCost ?? 0;
              const date = typeof (p.createdAt as { toDate?: () => Date })?.toDate === 'function'
                ? (p.createdAt as { toDate: () => Date }).toDate()
                : null;
              const supplierLabel = p.supplierName || (p.supplierId ? supplierMap.get(p.supplierId) : undefined) || 'No supplier';
              const unpaid = isPurchaseUnpaid(p);
              return (
                <View key={p.id} style={styles.card}>
                  <View style={styles.cardRow}>
                    <Text style={styles.supplierName} numberOfLines={2}>{supplierLabel}</Text>
                    <Text style={styles.totalText}>{total > 0 ? `$${total.toFixed(2)}` : '—'}</Text>
                  </View>
                  {unpaid ? <Text style={styles.unpaidBadge}>Unpaid</Text> : null}
                  {p.items?.map((i, idx) => (
                    <Text key={idx} style={styles.itemText} numberOfLines={2}>
                      • {i.name} × {i.quantity}{i.unitCost ? ` @ $${i.unitCost}` : ''}
                    </Text>
                  ))}
                  {date && <Text style={styles.dateText}>{date.toLocaleDateString()}</Text>}
                  {unpaid ? (
                    <TouchableOpacity
                      style={styles.markPaidBtn}
                      onPress={() => void markPurchasePaid(p)}
                      disabled={markingPaidId === p.id}
                    >
                      {markingPaidId === p.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.markPaidBtnText}>✓ Mark paid</Text>
                      )}
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })
          )}

          <TouchableOpacity style={styles.loadMoreBtn} onPress={() => setShowAll(!showAll)}>
            <Text style={styles.loadMoreText}>
              {showAll ? '← Show Today Only' : '📅 Show All History'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.surface,
    flexWrap: 'wrap',
    gap: 10,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, flexShrink: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', flexShrink: 0 },
  periodBtn: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 10, paddingVertical: 8, marginRight: 8 },
  periodBtnText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  addBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  summaryCard: {
    backgroundColor: COLORS.primary,
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: RADIUS.lg,
    padding: 16,
  },
  summaryLabel: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginBottom: 2 },
  summaryAmount: { fontSize: 24, fontWeight: '800', color: '#fff' },
  summaryMeta: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  empty: { textAlign: 'center', color: COLORS.textMuted, paddingVertical: 24, paddingHorizontal: 16 },
  card: { backgroundColor: COLORS.surface, marginHorizontal: 12, marginBottom: 8, borderRadius: RADIUS.lg, padding: 14, ...SHADOW.sm },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 12 },
  supplierName: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, flex: 1 },
  totalText: { fontSize: 15, fontWeight: '700', color: COLORS.primary },
  itemText: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  dateText: { fontSize: 11, color: COLORS.textMuted, marginTop: 6 },
  unpaidBadge: { fontSize: 12, fontWeight: '700', color: COLORS.warning, marginBottom: 4 },
  markPaidBtn: { marginTop: 10, backgroundColor: COLORS.success, borderRadius: RADIUS.md, paddingVertical: 8, alignItems: 'center' },
  markPaidBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  form: { backgroundColor: COLORS.surface, marginHorizontal: 12, borderRadius: RADIUS.lg, padding: 16, marginBottom: 12, ...SHADOW.sm },
  formTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: 12,
    fontSize: 14,
    backgroundColor: COLORS.background,
    marginBottom: 10,
    color: '#1A202C',
  },
  rowInputs: { flexDirection: 'row', gap: 10 },
  rowField: { flex: 1 },
  paymentRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  paymentChip: { flex: 1, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingVertical: 10, alignItems: 'center', backgroundColor: COLORS.background },
  paymentChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  paymentChipText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  paymentChipTextActive: { color: COLORS.primary },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 14, alignItems: 'center', marginTop: 4 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelText: { color: COLORS.textMuted, textAlign: 'center', marginTop: 12, fontSize: 14 },
  suggestBox: { backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, marginTop: -4, marginBottom: 10, overflow: 'hidden' },
  suggestItem: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  suggestText: { fontSize: 14, color: COLORS.textPrimary },
  loadMoreBtn: { marginHorizontal: 12, marginTop: 12, padding: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  loadMoreText: { color: COLORS.primary, fontWeight: '600', fontSize: 14 },
});
