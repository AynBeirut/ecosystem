import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import { useCart } from '../../context/CartContext';
import { COLORS, RADIUS, SHADOW } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function CartScreen() {
  const navigation = useNavigation<Nav>();
  const { items, removeItem, updateQuantity, total } = useCart();

  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>🛒</Text>
        <Text style={styles.emptyText}>Your cart is empty</Text>
        <TouchableOpacity style={styles.shopBtn} onPress={() => navigation.navigate('MainTabs', { screen: 'Marketplace' })}>
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
  container: { flex: 1, backgroundColor: COLORS.background },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: COLORS.surface },
  emptyIcon: { fontSize: 60 },
  emptyText: { fontSize: 18, color: COLORS.textSecondary },
  shopBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingHorizontal: 24, paddingVertical: 12, marginTop: 16 },
  shopBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  item: { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 12, marginBottom: 10, alignItems: 'center', ...SHADOW.sm },
  img: { width: 56, height: 56, borderRadius: RADIUS.md, resizeMode: 'cover' },
  imgPlaceholder: { backgroundColor: COLORS.light, justifyContent: 'center', alignItems: 'center' },
  itemBody: { flex: 1, marginLeft: 10 },
  itemName: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  itemStore: { fontSize: 12, color: COLORS.textMuted },
  itemPrice: { fontSize: 14, color: COLORS.primary, fontWeight: '700', marginTop: 2 },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center' },
  qtyBtnText: { fontSize: 18, color: COLORS.primary, fontWeight: '700' },
  qty: { fontSize: 16, fontWeight: '700', minWidth: 20, textAlign: 'center' },
  footer: { backgroundColor: COLORS.surface, padding: 16, borderTopWidth: 1, borderTopColor: COLORS.border },
  total: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  checkoutBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, padding: 16, alignItems: 'center' },
  checkoutBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
