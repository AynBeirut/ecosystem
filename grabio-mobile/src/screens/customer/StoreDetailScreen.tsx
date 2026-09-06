import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Image,
  ActivityIndicator, Linking,
} from 'react-native';
import { getFirestore, collection, doc, query, where, onSnapshot } from '@react-native-firebase/firestore';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Product, Store } from '../../types';
import { useCart } from '../../context/CartContext';
import { formatPrice, formatRating, toNumber } from '../../lib/formatCommerce';
import { COLORS, RADIUS, SHADOW } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'StoreDetail'>;

function ProductImage({ uri, style }: { uri: string; style: object }) {
  const [error, setError] = React.useState(false);
  if (error) {
    return (
      <View style={[style, { backgroundColor: '#f0f4f8', justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ fontSize: 28 }}>🛍️</Text>
      </View>
    );
  }
  return <Image source={{ uri }} style={style} resizeMode="cover" onError={() => setError(true)} />;
}

export default function StoreDetailScreen() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const storeId = params?.storeId?.trim() || '';
  const storeName = params?.storeName?.trim() || 'Store';
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { addItem, itemCount } = useCart();

  useEffect(() => {
    navigation.setOptions({ title: storeName });
    if (!storeId) {
      setLoadError('Store not found.');
      setLoading(false);
      return;
    }

    const db = getFirestore();
    setLoading(true);
    setLoadError(null);

    const unsubStore = onSnapshot(
      doc(db, 'storeProfiles', storeId),
      (d) => {
        if (!d.exists()) {
          setStore(null);
          return;
        }
        const data = d.data();
        setStore({ id: d.id, ...(data || {}) } as Store);
      },
      () => setLoadError('Could not load store.'),
    );

    const unsubProd = onSnapshot(
      query(
        collection(db, 'products'),
        where('storeId', '==', storeId),
        where('inStock', '==', true),
      ),
      (snap) => {
        const rows = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() || {}) } as Product))
          .filter((p) => p.id && p.name);
        setProducts(rows);
        setLoading(false);
      },
      () => {
        setLoadError('Could not load products.');
        setLoading(false);
      },
    );

    return () => {
      unsubStore();
      unsubProd();
    };
  }, [navigation, storeId, storeName]);

  const waPhone = (store?.whatsappBusiness || store?.whatsappNumber || '').replace(/\D/g, '');
  const ratingLabel = formatRating(store?.rating);

  const buildWaUrl = (item: Product) => {
    if (!waPhone) return null;
    const price = toNumber(item.price);
    if (price == null) return null;
    const currency = item.currency || store?.mainCurrency || 'USD';
    const msg = `Hi, I'd like to order from ${storeName}:\n- 1x ${item.name || 'Item'} — ${currency} ${price.toFixed(2)}\n\nTotal: ${currency} ${price.toFixed(2)}`;
    return `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`;
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const waUrl = buildWaUrl(item);
    const priceLabel = formatPrice(item.price, item.currency || store?.mainCurrency || 'USD');
    return (
      <TouchableOpacity
        style={styles.productCard}
        onPress={() => navigation.navigate('ProductDetail', { product: item, storeName })}
      >
        {(item.image || item.imageUrl) ? (
          <ProductImage uri={item.image || item.imageUrl!} style={styles.productImg} />
        ) : (
          <View style={[styles.productImg, styles.imgPlaceholder]}>
            <Text style={{ fontSize: 28 }}>🛍️</Text>
          </View>
        )}
        <Text style={styles.productName} numberOfLines={2}>{item.name || 'Product'}</Text>
        <Text style={styles.productPrice}>{priceLabel}</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            addItem(item, storeName);
          }}
        >
          <Text style={styles.addBtnText}>+ Add to Cart</Text>
        </TouchableOpacity>
        {waUrl ? (
          <TouchableOpacity
            style={styles.waBtn}
            onPress={() => Linking.openURL(waUrl)}
          >
            <Text style={styles.waBtnText}>💬 Buy via WhatsApp</Text>
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>
    );
  };

  if (!storeId) {
    return (
      <View style={styles.container}>
        <Text style={styles.empty}>Store not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {store ? (
        <View style={styles.storeHeader}>
          {store.logoUrl ? <Image source={{ uri: store.logoUrl }} style={styles.storeLogo} /> : null}
          <View style={{ flex: 1, marginLeft: store.logoUrl ? 12 : 0 }}>
            <Text style={styles.storeName}>{store.name || storeName}</Text>
            {store.description ? <Text style={styles.storeDesc}>{store.description}</Text> : null}
            {ratingLabel ? (
              <Text style={styles.rating}>⭐ {ratingLabel} ({store.ratingCount ?? 0})</Text>
            ) : null}
          </View>
          {itemCount > 0 ? (
            <TouchableOpacity onPress={() => navigation.navigate('Cart')}>
              <Text style={styles.cartBadge}>🛒 {itemCount}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
      {loadError ? <Text style={styles.error}>{loadError}</Text> : null}
      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          renderItem={renderProduct}
          numColumns={2}
          columnWrapperStyle={products.length > 1 ? { justifyContent: 'space-between' } : undefined}
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
  error: { textAlign: 'center', marginTop: 12, color: COLORS.error, paddingHorizontal: 16 },
});
