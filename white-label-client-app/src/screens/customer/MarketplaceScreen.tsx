import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput,
  Image, ActivityIndicator, Linking,
} from 'react-native';
import { getFirestore, collection, query, where, onSnapshot } from '@react-native-firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Store, Product } from '../../types';
import { useCart } from '../../context/CartContext';
import { useFavorites } from '../../context/FavoritesContext';
import { useAuth } from '../../context/AuthContext';
import { COLORS, RADIUS, SHADOW } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Tab = 'products' | 'stores';

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
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [storeMap, setStoreMap] = useState<Record<string, Store>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('products');
  const navigation = useNavigation<Nav>();
  const { addItem, itemCount } = useCart();
  const { isStoreFavorited, toggleStoreFavorite } = useFavorites();
  const { user, isGuest } = useAuth();

  useEffect(() => {
    let storesDone = false;
    let prodsDone = false;
    const checkDone = () => { if (storesDone && prodsDone) setLoading(false); };

    const db = getFirestore();
    const unsubStores = onSnapshot(collection(db, 'storeProfiles'), (snap) => {
      if (!snap) { storesDone = true; checkDone(); return; }
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Store));
      setStores(data);
      const map: Record<string, Store> = {};
      data.forEach((s) => { map[s.id] = s; });
      setStoreMap(map);
      storesDone = true;
      checkDone();
    });

    const unsubProd = onSnapshot(
      query(collection(db, 'products'), where('inStock', '==', true)),
      (snap) => {
        if (!snap) { prodsDone = true; checkDone(); return; }
        setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product)));
        prodsDone = true;
        checkDone();
      }
    );

    return () => { unsubStores(); unsubProd(); };
  }, []);

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (storeMap[p.storeId]?.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const filteredStores = stores.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const renderProduct = ({ item }: { item: Product }) => {
    const store = storeMap[item.storeId];
    const waUrl = store ? buildWhatsAppUrl(item, store) : null;
    const currency = item.currency || store?.mainCurrency || 'USD';
    return (
      <TouchableOpacity
        style={styles.productCard}
        onPress={() => navigation.navigate('StoreDetail', { storeId: item.storeId, storeName: store?.name || '' })}
      >
        {(item.image || item.imageUrl) ? (
          <Image source={{ uri: item.image || item.imageUrl }} style={styles.productImg} />
        ) : (
          <View style={[styles.productImg, styles.imgPlaceholder]}>
            <Text style={{ fontSize: 30 }}>🛍️</Text>
          </View>
        )}
        <Text style={styles.storeTag} numberOfLines={1}>🏪 {store?.name || ''}</Text>
        <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.productPrice}>{currency} {item.price.toFixed(2)}</Text>
        <View style={styles.productActions}>
          <TouchableOpacity
            style={styles.cartBtn}
            onPress={() => addItem(item, store?.name || '')}
          >
            <Text style={styles.cartBtnText}>+ Cart</Text>
          </TouchableOpacity>
          {waUrl ? (
            <TouchableOpacity
              style={styles.waBtn}
              onPress={() => Linking.openURL(waUrl)}
            >
              <Text style={styles.waBtnText}>💬</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const renderStore = ({ item }: { item: Store }) => (
    <TouchableOpacity
      style={styles.storeCard}
      onPress={() => navigation.navigate('StoreDetail', { storeId: item.id, storeName: item.name })}
    >
      {(item.logoUrl || item.logo) ? (
        <Image source={{ uri: (item.logoUrl || item.logo)! }} style={styles.logo} />
      ) : (
        <View style={[styles.logo, styles.logoPlaceholder]}>
          <Text style={styles.logoText}>{item.name[0]}</Text>
        </View>
      )}
      <View style={styles.storeCardBody}>
        <Text style={styles.storeName}>{item.name}</Text>
        {item.description ? (
          <Text style={styles.storeDesc} numberOfLines={2}>{item.description}</Text>
        ) : null}
        {item.rating ? (
          <Text style={styles.storeRating}>⭐ {item.rating.toFixed(1)} ({item.ratingCount ?? 0})</Text>
        ) : null}
      </View>
      <TouchableOpacity
        style={styles.heartBtn}
        onPress={() => toggleStoreFavorite({ id: item.id, name: item.name, logoUrl: item.logoUrl, description: item.description })}
      >
        <Text>{isStoreFavorited(item.id) ? '❤️' : '🤍'}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>grabio</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {!user && !isGuest && (
            <TouchableOpacity style={styles.signInBtn} onPress={() => navigation.navigate('Login' as never)}>
              <Text style={styles.signInBtnText}>Sign In</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => navigation.navigate('Cart')}>
            <Text style={styles.cartIcon}>🛒{itemCount > 0 ? ` ${itemCount}` : ''}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TextInput
        style={styles.search}
        placeholder={activeTab === 'products' ? 'Search products or stores…' : 'Search stores…'}
        value={search}
        onChangeText={setSearch}
      />

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'products' && styles.tabActive]}
          onPress={() => setActiveTab('products')}
        >
          <Text style={[styles.tabText, activeTab === 'products' && styles.tabTextActive]}>🛍️ Products</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'stores' && styles.tabActive]}
          onPress={() => setActiveTab('stores')}
        >
          <Text style={[styles.tabText, activeTab === 'stores' && styles.tabTextActive]}>🏪 Stores</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : activeTab === 'products' ? (
        <FlatList
          key="products"
          data={filteredProducts}
          keyExtractor={(p) => p.id}
          renderItem={renderProduct}
          numColumns={2}
          columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: 12 }}
          contentContainerStyle={{ paddingVertical: 12 }}
          ListEmptyComponent={<Text style={styles.empty}>No products found</Text>}
        />
      ) : (
        <FlatList
          key="stores"
          data={filteredStores}
          keyExtractor={(s) => s.id}
          renderItem={renderStore}
          contentContainerStyle={{ padding: 12 }}
          ListEmptyComponent={<Text style={styles.empty}>No stores found</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 22, backgroundColor: COLORS.primary },
  title: { fontSize: 30, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  cartIcon: { fontSize: 22, color: '#fff' },
  signInBtn: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.sm },
  signInBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  search: { margin: 12, marginBottom: 0, padding: 12, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, fontSize: 15 },
  tabs: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4, gap: 8 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: RADIUS.md, alignItems: 'center', backgroundColor: COLORS.light },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  tabTextActive: { color: '#fff' },
  productCard: { width: '48%', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 10, marginBottom: 12, ...SHADOW.sm },
  productImg: { width: '100%', aspectRatio: 1, borderRadius: RADIUS.md, resizeMode: 'cover', marginBottom: 6 },
  imgPlaceholder: { backgroundColor: COLORS.light, justifyContent: 'center', alignItems: 'center' },
  storeTag: { fontSize: 11, color: COLORS.textMuted, marginBottom: 2 },
  productName: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 3 },
  productPrice: { fontSize: 14, color: COLORS.primary, fontWeight: '700', marginBottom: 8 },
  productActions: { flexDirection: 'row', gap: 6 },
  cartBtn: { flex: 1, backgroundColor: COLORS.primary, borderRadius: RADIUS.sm, paddingVertical: 6, alignItems: 'center' },
  cartBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  waBtn: { backgroundColor: '#25D366', borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  waBtnText: { fontSize: 14 },
  storeCard: { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 12, marginBottom: 10, ...SHADOW.sm },
  logo: { width: 64, height: 64, borderRadius: RADIUS.full, borderWidth: 2, borderColor: COLORS.border, resizeMode: 'cover' },
  logoPlaceholder: { backgroundColor: COLORS.light, justifyContent: 'center', alignItems: 'center' },
  logoText: { fontSize: 26, color: COLORS.primary, fontWeight: '700' },
  storeCardBody: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  storeName: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  storeDesc: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  storeRating: { fontSize: 12, color: '#f59e0b', marginTop: 4 },
  heartBtn: { padding: 8 },
  empty: { textAlign: 'center', marginTop: 40, color: COLORS.textMuted },
});

