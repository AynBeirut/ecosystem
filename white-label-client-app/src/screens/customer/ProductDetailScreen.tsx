import React from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import { useCart } from '../../context/CartContext';
import { useFavorites } from '../../context/FavoritesContext';
import { COLORS, RADIUS, SHADOW } from '../../theme';

type Route = RouteProp<RootStackParamList, 'ProductDetail'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ProductDetailScreen() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { addItem, itemCount } = useCart();
  const { isProductFavorited, toggleProductFavorite } = useFavorites();
  const { product, storeName } = params;

  const handleAddToCart = () => {
    addItem(product, storeName);
    Alert.alert('Added to cart', `${product.name} added!`, [
      { text: 'Continue Shopping' },
      { text: 'View Cart', onPress: () => navigation.navigate('Cart') },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      {(product.image || product.imageUrl) ? (
        <Image source={{ uri: product.image || product.imageUrl }} style={styles.image} />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Text style={{ fontSize: 60 }}>🛍️</Text>
        </View>
      )}

      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { flex: 1 }]}>{product.name}</Text>
          <TouchableOpacity
            onPress={() => toggleProductFavorite({
              id: product.id,
              storeId: product.storeId,
              storeName,
              name: product.name,
              price: product.price,
              currency: product.currency,
              imageUrl: product.imageUrl || product.image,
              unit: product.unit,
            })}
          >
            <Text style={{ fontSize: 26 }}>{isProductFavorited(product.id) ? '❤️' : '🤍'}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.price}>{product.currency || 'USD'} {product.price.toFixed(2)}</Text>
        {product.unit ? <Text style={styles.meta}>Unit: {product.unit}</Text> : null}
        {product.stock !== undefined ? (
          <View style={styles.stockRow}>
            {product.stock <= 0 ? (
              <Text style={styles.stockOut}>❌ Out of Stock</Text>
            ) : product.stock <= (product.lowStockThreshold ?? 10) ? (
              <>
                <Text style={styles.stockLow}>⚠ Low Stock</Text>
                <Text style={styles.stockQty}>{product.stock} {product.unit || 'units'} left</Text>
              </>
            ) : (
              <>
                <Text style={styles.stockIn}>✓ In Stock</Text>
                <Text style={styles.stockQty}>{product.stock} {product.unit || 'units'} available</Text>
              </>
            )}
          </View>
        ) : null}
        {product.description ? <Text style={styles.description}>{product.description}</Text> : null}

        <TouchableOpacity
          style={[styles.addBtn, !product.inStock && styles.disabledBtn]}
          onPress={handleAddToCart}
          disabled={!product.inStock}
        >
          <Text style={styles.addBtnText}>
            {product.inStock ? 'Add to Cart' : 'Out of Stock'}
          </Text>
        </TouchableOpacity>

        {itemCount > 0 && (
          <TouchableOpacity style={styles.viewCartBtn} onPress={() => navigation.navigate('Cart')}>
            <Text style={styles.viewCartText}>View Cart ({itemCount})</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  image: { width: '100%', height: 280, resizeMode: 'cover' },
  imagePlaceholder: { width: '100%', height: 280, backgroundColor: COLORS.light, justifyContent: 'center', alignItems: 'center' },
  body: { padding: 20 },
  name: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8 },
  price: { fontSize: 26, color: COLORS.primary, fontWeight: '800', marginBottom: 8 },
  meta: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 4 },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  stockIn: { fontSize: 13, fontWeight: '600', color: COLORS.success },
  stockLow: { fontSize: 13, fontWeight: '600', color: COLORS.warning },
  stockOut: { fontSize: 13, fontWeight: '600', color: COLORS.error },
  stockQty: { fontSize: 12, color: COLORS.textSecondary },
  description: { fontSize: 15, color: '#374151', marginTop: 12, lineHeight: 22 },
  addBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, padding: 16, alignItems: 'center', marginTop: 24 },
  disabledBtn: { backgroundColor: '#d1d5db' },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  viewCartBtn: { borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: RADIUS.lg, padding: 14, alignItems: 'center', marginTop: 10 },
  viewCartText: { color: COLORS.primary, fontSize: 15, fontWeight: '600' },
  nameRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
});
