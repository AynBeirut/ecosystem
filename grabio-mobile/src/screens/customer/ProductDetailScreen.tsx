import React from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import { useCart } from '../../context/CartContext';
import { useFavorites } from '../../context/FavoritesContext';

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
      {product.imageUrl ? (
        <Image source={{ uri: product.imageUrl }} style={styles.image} />
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
              imageUrl: product.imageUrl,
              unit: product.unit,
            })}
          >
            <Text style={{ fontSize: 26 }}>{isProductFavorited(product.id) ? '❤️' : '🤍'}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.price}>{product.currency || 'USD'} {product.price.toFixed(2)}</Text>
        {product.unit ? <Text style={styles.meta}>Unit: {product.unit}</Text> : null}
        {product.stock !== undefined ? (
          <Text style={[styles.meta, product.stock <= (product.lowStockThreshold ?? 5) ? styles.lowStock : null]}>
            {product.stock > 0 ? `In stock: ${product.stock}` : 'Out of stock'}
          </Text>
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
  container: { flex: 1, backgroundColor: '#fff' },
  image: { width: '100%', height: 280, resizeMode: 'cover' },
  imagePlaceholder: { width: '100%', height: 280, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' },
  body: { padding: 20 },
  name: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 8 },
  price: { fontSize: 24, color: '#6366f1', fontWeight: '800', marginBottom: 8 },
  meta: { fontSize: 14, color: '#6b7280', marginBottom: 4 },
  lowStock: { color: '#ef4444' },
  description: { fontSize: 15, color: '#374151', marginTop: 12, lineHeight: 22 },
  addBtn: { backgroundColor: '#6366f1', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  disabledBtn: { backgroundColor: '#d1d5db' },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  viewCartBtn: { borderWidth: 1, borderColor: '#6366f1', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 10 },
  viewCartText: { color: '#6366f1', fontSize: 15, fontWeight: '600' },
  nameRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
});
