import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, Alert, TextInput, Image, ScrollView, SectionList, RefreshControl,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Product } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { COLORS, RADIUS, SHADOW } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Purchase {
  id: string;
  supplierName?: string;
  supplierId?: string;
  items?: Array<{ name?: string; quantity?: number; unitCost?: number }>;
  total?: number;
  totalAmount?: number;
  totalCost?: number;
  status?: string;
  orderDate?: unknown;
  createdAt?: unknown;
  storeId: string;
}

export default function InventoryScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const [products, setProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingPurchases, setLoadingPurchases] = useState(true);
  const [showAllPurchases, setShowAllPurchases] = useState(false);

  // New purchase form
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [supplier, setSupplier] = useState('');
  const [supplierNames, setSupplierNames] = useState<string[]>([]);
  const [supplierMap, setSupplierMap] = useState<Map<string, string>>(new Map());
  const [supplierSuggestions, setSupplierSuggestions] = useState<string[]>([]);
  const [itemName, setItemName] = useState('');
  const [qty, setQty] = useState('');
  const [cost, setCost] = useState('');
  const [savingPurchase, setSavingPurchase] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user?.storeId) { setLoadingProducts(false); setLoadingPurchases(false); return; }

    // Real-time products
    const unsubProd = firestore()
      .collection('products')
      .where('storeId', '==', user.storeId)
      .onSnapshot((snap) => {
        if (!snap) { setLoadingProducts(false); return; }
        setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product)));
        setLoadingProducts(false);
      });

    return () => { unsubProd(); };
  }, [user?.storeId]);

  useEffect(() => {
    if (!user?.storeId) return;
    // Load supplier names for autocomplete + id→name map
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
    fetchPurchases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.storeId, showAllPurchases]);

  const onSupplierChange = (text: string) => {
    setSupplier(text);
    if (text.trim().length > 0) {
      setSupplierSuggestions(supplierNames.filter(s => s.toLowerCase().includes(text.toLowerCase())));
    } else {
      setSupplierSuggestions([]);
    }
  };

  const fetchPurchases = useCallback(() => {
    if (!user?.storeId) return;
    setLoadingPurchases(true);
    // Query by storeId only — sort/filter client-side to avoid composite index
    const unsub = firestore()
      .collection('purchases')
      .where('storeId', '==', user.storeId)
      .onSnapshot((snap) => {
        if (!snap) { setLoadingPurchases(false); return; }
        let data: Purchase[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Purchase));
        const now = new Date();
        if (!showAllPurchases) {
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          data = data.filter(p => {
            const ts = (p.createdAt as any)?.toDate?.()?.getTime() ?? (p.orderDate as any)?.toDate?.()?.getTime() ?? 0;
            return ts >= startOfToday.getTime();
          });
        } else {
          const since30 = new Date(now);
          since30.setDate(since30.getDate() - 30);
          data = data.filter(p => {
            const ts = (p.createdAt as any)?.toDate?.()?.getTime() ?? (p.orderDate as any)?.toDate?.()?.getTime() ?? 0;
            return ts >= since30.getTime();
          });
        }
        data.sort((a, b) => {
          const ta = (a.createdAt as any)?.toDate?.()?.getTime() ?? 0;
          const tb = (b.createdAt as any)?.toDate?.()?.getTime() ?? 0;
          return tb - ta;
        });
        setPurchases(data);
        setLoadingPurchases(false);
      }, () => setLoadingPurchases(false));
    return unsub;
  }, [user?.storeId, showAllPurchases]);

  const addPurchase = async () => {
    if (!supplier.trim() || !itemName.trim() || !qty.trim()) {
      Alert.alert('Missing fields', 'Supplier, item name and quantity are required');
      return;
    }
    setSavingPurchase(true);
    try {
      await firestore().collection('purchases').add({
        storeId: user!.storeId,
        supplierName: supplier.trim(),
        items: [{ name: itemName.trim(), quantity: parseInt(qty, 10), unitCost: parseFloat(cost) || 0 }],
        total: (parseInt(qty, 10) * (parseFloat(cost) || 0)),
        status: 'received',
        createdAt: firestore.FieldValue.serverTimestamp(),
        orderDate: firestore.FieldValue.serverTimestamp(),
      });
      setSupplier(''); setSupplierSuggestions([]); setItemName(''); setQty(''); setCost('');
      setShowPurchaseForm(false);
      Alert.alert('Saved', 'Purchase recorded successfully');
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSavingPurchase(false);
    }
  };

  const renderProduct = ({ item }: { item: Product }) => (
    <View style={styles.productCard}>
      <View style={styles.productRow}>
        {(item.image || item.imageUrl) ? (
          <Image source={{ uri: item.image || item.imageUrl }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Text style={{ fontSize: 18 }}>📦</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.productName}>{item.name}</Text>
          <Text style={styles.productMeta}>
            Stock: <Text style={{ color: item.stock != null && item.stock <= (item.lowStockThreshold ?? 5) ? COLORS.error : COLORS.success, fontWeight: '700' }}>
              {item.stock ?? '—'} {item.unit || 'units'}
            </Text>
          </Text>
          {item.stock != null && item.stock <= (item.lowStockThreshold ?? 5) && (
            <Text style={styles.lowAlert}>⚠️ Low stock</Text>
          )}
        </View>
      </View>


    </View>
  );

  const renderPurchase = ({ item }: { item: Purchase }) => {
    const total = item.total ?? item.totalAmount ?? item.totalCost ?? 0;
    const date = item.createdAt?.toDate?.() || item.orderDate?.toDate?.();
    return (
      <View style={styles.purchaseCard}>
        <View style={styles.purchaseRow}>
          <Text style={styles.supplierName}>{item.supplierName || (item.supplierId ? supplierMap.get(item.supplierId) : undefined) || 'No supplier'}</Text>
          <Text style={styles.purchaseTotal}>{total > 0 ? `$${total.toFixed(2)}` : '—'}</Text>
        </View>
        {item.items?.map((i, idx) => (
          <Text key={idx} style={styles.purchaseItem}>
            {i.name} × {i.quantity} {i.unitCost ? `@ $${i.unitCost}` : ''}
          </Text>
        ))}
        {date && <Text style={styles.purchaseDate}>{date.toLocaleDateString()}</Text>}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPurchases(); setTimeout(() => setRefreshing(false), 1500); }} colors={[COLORS.primary]} />}>
        {/* Section: Stock */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>📦 Stock</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => navigation.navigate('AddEditProduct', {})}
          >
            <Text style={styles.addBtnText}>+ Add Product</Text>
          </TouchableOpacity>
        </View>

        {loadingProducts ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginVertical: 20 }} />
        ) : products.length === 0 ? (
          <Text style={styles.empty}>No products yet</Text>
        ) : (
          products.map((p) => <View key={p.id}>{renderProduct({ item: p })}</View>)
        )}

        {/* Section: Purchases */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🛒 Purchases</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setShowPurchaseForm(!showPurchaseForm)}
          >
            <Text style={styles.addBtnText}>+ New</Text>
          </TouchableOpacity>
        </View>

        {/* New Purchase Form */}
        {showPurchaseForm && (
          <View style={styles.form}>
            <Text style={styles.formTitle}>Record Purchase</Text>
            <View style={{ marginBottom: 10 }}>
              <TextInput style={styles.input} placeholder="Supplier name *" placeholderTextColor="#9ca3af" value={supplier} onChangeText={onSupplierChange} />
              {supplierSuggestions.length > 0 && (
                <View style={styles.suggestBox}>
                  {supplierSuggestions.map((s) => (
                    <TouchableOpacity key={s} style={styles.suggestItem} onPress={() => { setSupplier(s); setSupplierSuggestions([]); }}>
                      <Text style={styles.suggestText}>🏭 {s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            <TextInput style={styles.input} placeholder="Item / Material name *" placeholderTextColor="#9ca3af" value={itemName} onChangeText={setItemName} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="Quantity *" placeholderTextColor="#9ca3af" keyboardType="number-pad" value={qty} onChangeText={setQty} />
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="Unit cost (optional)" placeholderTextColor="#9ca3af" keyboardType="decimal-pad" value={cost} onChangeText={setCost} />
            </View>
            <TouchableOpacity style={styles.saveBtn} onPress={addPurchase} disabled={savingPurchase}>
              {savingPurchase ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Purchase</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowPurchaseForm(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {loadingPurchases ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginVertical: 20 }} />
        ) : purchases.length === 0 ? (
          <Text style={styles.empty}>{showAllPurchases ? 'No purchases in last 30 days' : 'No purchases today'}</Text>
        ) : (
          purchases.map((p) => <View key={p.id}>{renderPurchase({ item: p })}</View>)
        )}

        <TouchableOpacity style={styles.loadMoreBtn} onPress={() => setShowAllPurchases(!showAllPurchases)}>
          <Text style={styles.loadMoreText}>
            {showAllPurchases ? '← Show Today Only' : '📅 Load Last 30 Days'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  addBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 6 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  empty: { textAlign: 'center', color: COLORS.textMuted, paddingVertical: 16, paddingHorizontal: 16 },

  productCard: { backgroundColor: COLORS.surface, marginHorizontal: 12, marginBottom: 8, borderRadius: RADIUS.lg, padding: 12, ...SHADOW.sm },
  productRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  thumb: { width: 48, height: 48, borderRadius: RADIUS.md, resizeMode: 'cover', marginRight: 10 },
  thumbPlaceholder: { backgroundColor: COLORS.light, justifyContent: 'center', alignItems: 'center' },
  productName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  productMeta: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  lowAlert: { fontSize: 11, color: COLORS.error, marginTop: 2 },

  purchaseCard: { backgroundColor: COLORS.surface, marginHorizontal: 12, marginBottom: 8, borderRadius: RADIUS.lg, padding: 12, ...SHADOW.sm },
  purchaseRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  supplierName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  purchaseTotal: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  purchaseItem: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  purchaseDate: { fontSize: 11, color: COLORS.textMuted, marginTop: 4 },

  form: { backgroundColor: COLORS.surface, marginHorizontal: 12, borderRadius: RADIUS.lg, padding: 16, marginBottom: 12, ...SHADOW.sm },
  formTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 12, fontSize: 14, color: '#1A202C', backgroundColor: COLORS.background, marginBottom: 10 },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 14, alignItems: 'center', marginTop: 4 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelText: { color: COLORS.textMuted, textAlign: 'center', marginTop: 12, fontSize: 14 },

  loadMoreBtn: { marginHorizontal: 12, marginTop: 12, padding: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  loadMoreText: { color: COLORS.primary, fontWeight: '600', fontSize: 14 },
  suggestBox: { backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, marginTop: -8, overflow: 'hidden' },
  suggestItem: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  suggestText: { fontSize: 14, color: COLORS.textPrimary },
});
