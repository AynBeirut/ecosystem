import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Image,
  ActivityIndicator, ScrollView,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Product, Store } from '../../types';
import { useCart } from '../../context/CartContext';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'StoreDetail'>;

export default function StoreDetailScreen() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { addItem, itemCount } = useCart();

  useEffect(() => {
    navigation.setOptions({ title: params.storeName });

    const unsubStore = firestore()
      .collection('storeProfiles')
      .doc(params.storeId)
      .onSnapshot((d) => setStore({ id: d.id, ...d.data() } as Store));

    const unsubProd = firestore()
      .collection('products')
      .where('storeId', '==', params.storeId)
      .where('inStock', '==', true)
      .onSnapshot((snap) => {
        setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product)));
        setLoading(false);
      });

    return () => { unsubStore(); unsubProd(); };
  }, [params.storeId]);

  const renderProduct = ({ item }: { item: Product }) => (
    <TouchableOpacity
      style={styles.productCard}
      onPress={() => navigation.navigate('ProductDetail', { product: item, storeName: params.storeName })}
    >
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.productImg} />
      ) : (
        <View style={[styles.productImg, styles.imgPlaceholder]}>
          <Text style={{ fontSize: 28 }}>🛍️</Text>
        </View>
      )}
      <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
      <Text style={styles.productPrice}>{(item.currency || 'USD')} {item.price.toFixed(2)}</Text>
      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => { addItem(item, params.storeName); }}
      >
        <Text style={styles.addBtnText}>+ Add</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {store && (
        <View style={styles.storeHeader}>
          {store.logoUrl ? <Image source={{ uri: store.logoUrl }} style={styles.storeLogo} /> : null}
          <View style={{ flex: 1, marginLeft: store.logoUrl ? 12 : 0 }}>
            <Text style={styles.storeName}>{store.name}</Text>
            {store.description ? <Text style={styles.storeDesc}>{store.description}</Text> : null}
            {store.rating ? <Text style={styles.rating}>⭐ {store.rating.toFixed(1)} ({store.ratingCount ?? 0})</Text> : null}
          </View>
          {itemCount > 0 && (
            <TouchableOpacity onPress={() => navigation.navigate('Cart')}>
              <Text style={styles.cartBadge}>🛒 {itemCount}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      {loading ? (
        <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          renderItem={renderProduct}
          numColumns={2}
          columnWrapperStyle={{ justifyContent: 'space-between' }}
          contentContainerStyle={{ padding: 12 }}
          ListEmptyComponent={<Text style={styles.empty}>No products available</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  storeHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  storeLogo: { width: 52, height: 52, borderRadius: 8, resizeMode: 'cover' },
  storeName: { fontSize: 18, fontWeight: '700', color: '#111827' },
  storeDesc: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  rating: { fontSize: 12, color: '#f59e0b', marginTop: 2 },
  cartBadge: { fontSize: 18, backgroundColor: '#e0e7ff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, overflow: 'hidden' },
  productCard: { width: '48%', backgroundColor: '#fff', borderRadius: 12, padding: 10, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  productImg: { width: '100%', aspectRatio: 1, borderRadius: 8, resizeMode: 'cover', marginBottom: 8 },
  imgPlaceholder: { backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' },
  productName: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 4 },
  productPrice: { fontSize: 14, color: '#6366f1', fontWeight: '700', marginBottom: 8 },
  addBtn: { backgroundColor: '#6366f1', borderRadius: 8, paddingVertical: 6, alignItems: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  empty: { textAlign: 'center', marginTop: 40, color: '#9ca3af' },
});
