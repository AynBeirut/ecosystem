import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import { useCart } from '../../context/CartContext';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function CartScreen() {
  const navigation = useNavigation<Nav>();
  const { items, removeItem, updateQuantity, total } = useCart();

  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>🛒</Text>
        <Text style={styles.emptyText}>Your cart is empty</Text>
        <TouchableOpacity style={styles.shopBtn} onPress={() => navigation.navigate('MainTabs')}>
          <Text style={styles.shopBtnText}>Browse Stores</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currency = items[0]?.product.currency || 'USD';

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.product.id}
        contentContainerStyle={{ padding: 12 }}
        renderItem={({ item }) => (
          <View style={styles.item}>
            {item.product.imageUrl ? (
              <Image source={{ uri: item.product.imageUrl }} style={styles.img} />
            ) : (
              <View style={[styles.img, styles.imgPlaceholder]}>
                <Text>🛍️</Text>
              </View>
            )}
            <View style={styles.itemBody}>
              <Text style={styles.itemName}>{item.product.name}</Text>
              <Text style={styles.itemStore}>{item.storeName}</Text>
              <Text style={styles.itemPrice}>{currency} {item.product.price.toFixed(2)}</Text>
            </View>
            <View style={styles.qtyControls}>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item.product.id, item.quantity - 1)}>
                <Text style={styles.qtyBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.qty}>{item.quantity}</Text>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item.product.id, item.quantity + 1)}>
                <Text style={styles.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <View style={styles.footer}>
        <Text style={styles.total}>Total: {currency} {total.toFixed(2)}</Text>
        <TouchableOpacity style={styles.checkoutBtn} onPress={() => navigation.navigate('Checkout')}>
          <Text style={styles.checkoutBtnText}>Proceed to Checkout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: '#fff' },
  emptyIcon: { fontSize: 60 },
  emptyText: { fontSize: 18, color: '#6b7280' },
  shopBtn: { backgroundColor: '#6366f1', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12, marginTop: 16 },
  shopBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  item: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 10, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  img: { width: 56, height: 56, borderRadius: 8, resizeMode: 'cover' },
  imgPlaceholder: { backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' },
  itemBody: { flex: 1, marginLeft: 10 },
  itemName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  itemStore: { fontSize: 12, color: '#9ca3af' },
  itemPrice: { fontSize: 14, color: '#6366f1', fontWeight: '700', marginTop: 2 },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#e0e7ff', justifyContent: 'center', alignItems: 'center' },
  qtyBtnText: { fontSize: 18, color: '#6366f1', fontWeight: '700' },
  qty: { fontSize: 16, fontWeight: '700', minWidth: 20, textAlign: 'center' },
  footer: { backgroundColor: '#fff', padding: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  total: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 12 },
  checkoutBtn: { backgroundColor: '#6366f1', borderRadius: 12, padding: 16, alignItems: 'center' },
  checkoutBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
