import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput,
  Image, ActivityIndicator, Linking,
} from 'react-native';
import { getFirestore, collection, doc, query, where, onSnapshot } from '@react-native-firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Store, Product } from '../../types';
import { useCart } from '../../context/CartContext';
import { CLIENT_CONFIG } from '../../config/clientConfig';
import { mapStoreProfile } from '../../lib/storeProfile';
import { COLORS, RADIUS, SHADOW } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function buildWhatsAppUrl(product: Product, store: Store): string | null {
  const rawPhone = store.whatsappBusiness || store.whatsappNumber;
  if (!rawPhone) return null;
  const phone = rawPhone.replace(/\D/g, '');
  if (!phone) return null;
  const currency = product.currency || store.mainCurrency || 'USD';
  const msg = `Hi, I'd like to order from ${store.name}:\n- 1x ${product.name} — ${currency} ${product.price.toFixed(2)}\n\nTotal: ${currency} ${product.price.toFixed(2)}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

export default function MarketplaceScreen() {
  const storeId = CLIENT_CONFIG.storeId;
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigation = useNavigation<Nav>();
  const { addItem, itemCount } = useCart();

  useEffect(() => {
    if (!storeId) {
      setLoading(false);
      return;
    }

    const db = getFirestore();
    const unsubStore = onSnapshot(doc(db, 'storeProfiles', storeId), (snap) => {
      if (snap.exists()) {
        setStore(mapStoreProfile(snap.id, snap.data() as Record<string, unknown>));
      }
    });

    const unsubProd = onSnapshot(
      query(
        collection(db, 'products'),
        where('storeId', '==', storeId),
        where('inStock', '==', true),
      ),
      (snap) => {
        setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product)));
        setLoading(false);
      },
    );

    return () => {
      unsubStore();
      unsubProd();
    };
  }, [storeId]);

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  const renderProduct = ({ item }: { item: Product }) => {
    const waUrl = store ? buildWhatsAppUrl(item, store) : null;
    const currency = item.currency || store?.mainCurrency || 'USD';
    return (
      <TouchableOpacity
        style={styles.productCard}
        onPress={() => navigation.navigate('ProductDetail', { product: item, storeName: store?.name || CLIENT_CONFIG.appName })}
      >
        {(item.image || item.imageUrl) ? (
          <Image source={{ uri: item.image || item.imageUrl }} style={styles.productImg} />
        ) : (
          <View style={[styles.productImg, styles.imgPlaceholder]}>
            <Text style={{ fontSize: 30 }}>🛍️</Text>
          </View>
        )}
        <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.productPrice}>{currency} {item.price.toFixed(2)}</Text>
        <View style={styles.productActions}>
          <TouchableOpacity
            style={styles.cartBtn}
            onPress={() => addItem(item, store?.name || CLIENT_CONFIG.appName)}
          >
            <Text style={styles.cartBtnText}>+ Cart</Text>
          </TouchableOpacity>
          {waUrl ? (
            <TouchableOpacity style={styles.waBtn} onPress={() => Linking.openURL(waUrl)}>
              <Text style={styles.waBtnText}>💬</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  if (!storeId) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>App not configured</Text>
        <Text style={styles.errorBody}>Set storeId in app.json extra before building this white-label app.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerBrand}>
          {(store?.logoUrl || store?.logo) ? (
            <Image source={{ uri: (store.logoUrl || store.logo)! }} style={styles.headerLogo} />
          ) : null}
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{store?.name || CLIENT_CONFIG.appName}</Text>
            {store?.description ? (
              <Text style={styles.tagline} numberOfLines={1}>{store.description}</Text>
            ) : null}
          </View>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Cart')}>
          <Text style={styles.cartIcon}>🛒{itemCount > 0 ? ` ${itemCount}` : ''}</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.search}
        placeholder="Search products…"
        value={search}
        onChangeText={setSearch}
      />

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(p) => p.id}
          renderItem={renderProduct}
          numColumns={2}
          columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: 12 }}
          contentContainerStyle={{ paddingVertical: 12 }}
          ListEmptyComponent={<Text style={styles.empty}>No products in stock</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorTitle: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8 },
  errorBody: { textAlign: 'center', color: COLORS.textSecondary, lineHeight: 22 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 18, backgroundColor: COLORS.primary },
  headerBrand: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, marginRight: 12 },
  headerLogo: { width: 44, height: 44, borderRadius: RADIUS.full, borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)' },
  title: { fontSize: 22, fontWeight: '800', color: '#fff' },
  tagline: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  cartIcon: { fontSize: 22, color: '#fff' },
  search: { margin: 12, padding: 12, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, fontSize: 15 },
  productCard: { width: '48%', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 10, marginBottom: 12, ...SHADOW.sm },
  productImg: { width: '100%', aspectRatio: 1, borderRadius: RADIUS.md, resizeMode: 'cover', marginBottom: 6 },
  imgPlaceholder: { backgroundColor: COLORS.light, justifyContent: 'center', alignItems: 'center' },
  productName: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 3 },
  productPrice: { fontSize: 14, color: COLORS.primary, fontWeight: '700', marginBottom: 8 },
  productActions: { flexDirection: 'row', gap: 6 },
  cartBtn: { flex: 1, backgroundColor: COLORS.primary, borderRadius: RADIUS.sm, paddingVertical: 6, alignItems: 'center' },
  cartBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  waBtn: { backgroundColor: '#25D366', borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  waBtnText: { fontSize: 14 },
  empty: { textAlign: 'center', marginTop: 40, color: COLORS.textMuted },
});
