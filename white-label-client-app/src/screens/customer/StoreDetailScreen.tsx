import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Image,
  ActivityIndicator, ScrollView, Linking,
} from 'react-native';
import { getFirestore, collection, doc, query, where, onSnapshot } from '@react-native-firebase/firestore';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Product, Store } from '../../types';
import { useCart } from '../../context/CartContext';
import { mapStoreProfile } from '../../lib/storeProfile';
import { COLORS, RADIUS, SHADOW } from '../../theme';

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

    const db = getFirestore();

    const unsubStore = onSnapshot(doc(db, 'storeProfiles', params.storeId),
      (d) => setStore(mapStoreProfile(d.id, (d.data() || {}) as Record<string, unknown>)));

    const unsubProd = onSnapshot(
      query(collection(db, 'products'),
        where('storeId', '==', params.storeId),
        where('inStock', '==', true)),
      (snap) => {
        setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product)));
        setLoading(false);
      });

    return () => { unsubStore(); unsubProd(); };
  }, [navigation, params.storeId, params.storeName]);

  const waPhone = (store?.whatsappBusiness || store?.whatsappNumber || '').replace(/\D/g, '');

  const buildWaUrl = (item: Product) => {
    if (!waPhone) return null;
    const currency = item.currency || store?.mainCurrency || 'USD';
    const msg = `Hi, I'd like to order from ${params.storeName}:\n- 1x ${item.name} \u2014 ${currency} ${item.price.toFixed(2)}\n\nTotal: ${currency} ${item.price.toFixed(2)}`;
    return `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`;
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const waUrl = buildWaUrl(item);
    return (
      <TouchableOpacity
        style={styles.productCard}
        onPress={() => navigation.navigate('ProductDetail', { product: item, storeName: params.storeName })}
      >
        {(item.image || item.imageUrl) ? (
          <Image source={{ uri: item.image || item.imageUrl }} style={styles.productImg} />
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
          <Text style={styles.addBtnText}>+ Add to Cart</Text>
        </TouchableOpacity>
        {waUrl && (
          <TouchableOpacity
            style={styles.waBtn}
            onPress={() => Linking.openURL(waUrl)}
          >
            <Text style={styles.waBtnText}>💬 Buy via WhatsApp</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

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
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
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
  container: { flex: 1, backgroundColor: COLORS.background },
  storeHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  storeLogo: { width: 56, height: 56, borderRadius: RADIUS.full, borderWidth: 2, borderColor: COLORS.border, resizeMode: 'cover' },
  storeName: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  storeDesc: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  rating: { fontSize: 12, color: '#f59e0b', marginTop: 2 },
  cartBadge: { fontSize: 16, backgroundColor: COLORS.primaryLight, color: COLORS.secondary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.full, overflow: 'hidden' },
  productCard: { width: '48%', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 10, marginBottom: 12, ...SHADOW.sm },
  productImg: { width: '100%', aspectRatio: 1, borderRadius: RADIUS.md, resizeMode: 'cover', marginBottom: 8 },
  imgPlaceholder: { backgroundColor: COLORS.light, justifyContent: 'center', alignItems: 'center' },
  productName: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 4 },
  productPrice: { fontSize: 14, color: COLORS.primary, fontWeight: '700', marginBottom: 8 },
  addBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 6, alignItems: 'center', marginBottom: 6 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  waBtn: { backgroundColor: '#25D366', borderRadius: RADIUS.md, paddingVertical: 6, alignItems: 'center' },
  waBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  empty: { textAlign: 'center', marginTop: 40, color: COLORS.textMuted },
});
