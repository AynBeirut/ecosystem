import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, Alert, TextInput, FlatList, ScrollView,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Product } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { COLORS, RADIUS, SHADOW } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  currency: string;
}

interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
}

const PAYMENT_METHODS = ['Cash', 'Card', 'WhatsApp Pay', 'Bank Transfer', 'Other'];

export default function CreateOrderScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  // Customer autocomplete
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (!user?.storeId) { setLoading(false); return; }
    const unsub = firestore()
      .collection('products')
      .where('storeId', '==', user.storeId)
      .where('inStock', '==', true)
      .onSnapshot((snap) => {
        if (!snap) { setLoading(false); return; }
        setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product)));
        setLoading(false);
      });
    return unsub;
  }, [user?.storeId]);

  useEffect(() => {
    if (!user?.storeId) return;
    // Load customers for autocomplete
    firestore()
      .collection('customers')
      .where('storeId', '==', user.storeId)
      .get()
      .then((snap) => {
        setCustomers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Customer)));
      })
      .catch(() => {});
  }, [user?.storeId]);

  const filteredCustomers = customerSearch.length > 0
    ? customers.filter((c) =>
        (c.name || '').toLowerCase().includes(customerSearch.toLowerCase()) ||
        (c.phone || '').includes(customerSearch),
      )
    : [];

  const selectCustomer = (c: Customer) => {
    setCustomerName(c.name);
    setCustomerPhone(c.phone || '');
    setCustomerSearch(c.name);
    setShowSuggestions(false);
  };

  const filtered = search
    ? products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : products;

  const addToOrder = (product: Product) => {
    setOrderItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        currency: product.currency || 'USD',
      }];
    });
  };

  const removeFromOrder = (productId: string) => {
    setOrderItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  const adjustQty = (productId: string, delta: number) => {
    setOrderItems((prev) => prev
      .map((i) => i.productId === productId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i)
      .filter((i) => i.quantity > 0)
    );
  };

  const total = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const currency = orderItems[0]?.currency || 'USD';

  const submitOrder = async () => {
    if (!customerName.trim()) {
      Alert.alert('Missing', 'Customer name is required.');
      return;
    }
    if (orderItems.length === 0) {
      Alert.alert('Empty order', 'Add at least one product');
      return;
    }
    setSaving(true);
    try {
      // Write to top-level orders collection (matches Firestore rules)
      await firestore().collection('orders').add({
        storeId: user!.storeId,
        customerId: user!.uid,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || null,
        items: orderItems.map(({ productId, name, price, quantity }) => ({ productId, name, price, quantity })),
        total,
        currency,
        status: 'confirmed',
        paymentMethod,
        createdAt: firestore.FieldValue.serverTimestamp(),
        createdByOwner: true,
      });
          Alert.alert('Order Created', `Order for ${customerName} placed successfully.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Customer Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👤 Customer *</Text>
          <TextInput
            style={styles.input}
            placeholder="Search customer by name or phone…"
            placeholderTextColor="#9ca3af"
            value={customerSearch}
            onChangeText={(v) => {
              setCustomerSearch(v);
              setCustomerName(v);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
          />
          {showSuggestions && filteredCustomers.length > 0 && (
            <View style={styles.suggestions}>
              {filteredCustomers.slice(0, 5).map((c) => (
                <TouchableOpacity key={c.id} style={styles.suggestionRow} onPress={() => selectCustomer(c)}>
                  <Text style={styles.suggestionName}>{c.name}</Text>
                  {c.phone ? <Text style={styles.suggestionPhone}>{c.phone}</Text> : null}
                </TouchableOpacity>
              ))}
            </View>
          )}
          <TextInput
            style={styles.input}
            placeholder="Phone number (optional)"
            placeholderTextColor="#9ca3af"
            keyboardType="phone-pad"
            value={customerPhone}
            onChangeText={setCustomerPhone}
          />
        </View>

        {/* Payment Method */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💳 Payment Method</Text>
          <View style={styles.paymentRow}>
            {PAYMENT_METHODS.map((pm) => (
              <TouchableOpacity
                key={pm}
                style={[styles.paymentBtn, paymentMethod === pm && styles.paymentBtnActive]}
                onPress={() => setPaymentMethod(pm)}
              >
                <Text style={[styles.paymentBtnText, paymentMethod === pm && styles.paymentBtnTextActive]}>
                  {pm}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Product Search */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🛍️ Select Products</Text>
          <TextInput
            style={styles.input}
            placeholder="Search products…"
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={setSearch}
          />
          {loading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: 10 }} />
          ) : (
            filtered.map((product) => {
              const inOrder = orderItems.find((i) => i.productId === product.id);
              return (
                <View key={product.id} style={styles.productRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.productName}>{product.name}</Text>
                    <Text style={styles.productPrice}>{product.currency || 'USD'} {product.price.toFixed(2)}</Text>
                  </View>
                  {inOrder ? (
                    <View style={styles.qtyControls}>
                      <TouchableOpacity style={styles.qtyBtn} onPress={() => adjustQty(product.id, -1)}>
                        <Text style={styles.qtyBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.qtyValue}>{inOrder.quantity}</Text>
                      <TouchableOpacity style={styles.qtyBtn} onPress={() => adjustQty(product.id, 1)}>
                        <Text style={styles.qtyBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.addBtn} onPress={() => addToOrder(product)}>
                      <Text style={styles.addBtnText}>+ Add</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* Order Summary */}
        {orderItems.length > 0 && (
          <View style={styles.summary}>
            <Text style={styles.sectionTitle}>📋 Order Summary</Text>
            {orderItems.map((item) => (
              <View key={item.productId} style={styles.summaryRow}>
                <Text style={styles.summaryItem}>{item.name} × {item.quantity}</Text>
                <Text style={styles.summaryPrice}>{item.currency} {(item.price * item.quantity).toFixed(2)}</Text>
              </View>
            ))}
            <View style={[styles.summaryRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border }]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalAmount}>{currency} {total.toFixed(2)}</Text>
            </View>
          </View>
        )}

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, orderItems.length === 0 && { opacity: 0.5 }]}
          onPress={submitOrder}
          disabled={saving || orderItems.length === 0}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>
              Create Order {orderItems.length > 0 ? `· ${currency} ${total.toFixed(2)}` : ''}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  section: { backgroundColor: COLORS.surface, marginHorizontal: 12, marginBottom: 12, borderRadius: RADIUS.lg, padding: 16, ...SHADOW.sm },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 10 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 12, fontSize: 14, backgroundColor: COLORS.background, marginBottom: 10, color: '#1A202C' },
  suggestions: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, marginTop: -8, marginBottom: 10, overflow: 'hidden' },
  suggestionRow: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  suggestionName: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  suggestionPhone: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },

  paymentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  paymentBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.background },
  paymentBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  paymentBtnText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  paymentBtnTextActive: { color: '#fff', fontWeight: '700' },

  productRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  productName: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  productPrice: { fontSize: 13, color: COLORS.primary, marginTop: 1 },
  addBtn: { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },

  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyBtn: { width: 30, height: 30, borderRadius: RADIUS.full, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  qtyBtnText: { color: '#fff', fontSize: 18, fontWeight: '700', lineHeight: 22 },
  qtyValue: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, minWidth: 20, textAlign: 'center' },

  summary: { backgroundColor: COLORS.surface, marginHorizontal: 12, marginBottom: 12, borderRadius: RADIUS.lg, padding: 16, ...SHADOW.sm },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  summaryItem: { fontSize: 13, color: COLORS.textSecondary },
  summaryPrice: { fontSize: 13, color: COLORS.textPrimary, fontWeight: '600' },
  totalLabel: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  totalAmount: { fontSize: 15, fontWeight: '800', color: COLORS.primary },

  submitBtn: { backgroundColor: COLORS.primary, marginHorizontal: 12, borderRadius: RADIUS.lg, padding: 16, alignItems: 'center', marginTop: 4 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
