import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput,
  Image, ActivityIndicator, SafeAreaView,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Store } from '../../types';
import { useCart } from '../../context/CartContext';
import { useFavorites } from '../../context/FavoritesContext';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function MarketplaceScreen() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigation = useNavigation<Nav>();
  const { itemCount } = useCart();
  const { isStoreFavorited, toggleStoreFavorite } = useFavorites();

  useEffect(() => {
    const unsub = firestore()
      .collection('storeProfiles')
      .onSnapshot((snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Store));
        setStores(data);
        setLoading(false);
      });
    return unsub;
  }, []);

  const filtered = stores.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const renderStore = ({ item }: { item: Store }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('StoreDetail', { storeId: item.id, storeName: item.name })}
    >
      {item.logoUrl ? (
        <Image source={{ uri: item.logoUrl }} style={styles.logo} />
      ) : (
        <View style={[styles.logo, styles.logoPlaceholder]}>
          <Text style={styles.logoText}>{item.name[0]}</Text>
        </View>
      )}
      <View style={styles.cardBody}>
        <Text style={styles.storeName}>{item.name}</Text>
        {item.description ? (
          <Text style={styles.storeDesc} numberOfLines={2}>{item.description}</Text>
        ) : null}
        {item.rating ? (
          <Text style={styles.rating}>⭐ {item.rating.toFixed(1)} ({item.ratingCount ?? 0})</Text>
        ) : null}
      </View>
      <TouchableOpacity
        style={styles.heartBtn}
        onPress={() => toggleStoreFavorite({ id: item.id, name: item.name, logoUrl: item.logoUrl, description: item.description })}
      >
        <Text style={styles.heart}>{isStoreFavorited(item.id) ? '❤️' : '🤍'}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>grabio</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Cart')}>
          <Text style={styles.cartIcon}>🛒{itemCount > 0 ? ` ${itemCount}` : ''}</Text>
        </TouchableOpacity>
      </View>
      <TextInput
        style={styles.search}
        placeholder="Search stores…"
        value={search}
        onChangeText={setSearch}
      />
      {loading ? (
        <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(s) => s.id}
          renderItem={renderStore}
          contentContainerStyle={{ padding: 12 }}
          ListEmptyComponent={<Text style={styles.empty}>No stores found</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  title: { fontSize: 24, fontWeight: '800', color: '#6366f1' },
  cartIcon: { fontSize: 22 },
  search: { margin: 12, padding: 12, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', fontSize: 15 },
  card: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  logo: { width: 64, height: 64, borderRadius: 10, resizeMode: 'cover' },
  logoPlaceholder: { backgroundColor: '#e0e7ff', justifyContent: 'center', alignItems: 'center' },
  logoText: { fontSize: 26, color: '#6366f1', fontWeight: '700' },
  cardBody: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  storeName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  storeDesc: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  rating: { fontSize: 12, color: '#f59e0b', marginTop: 4 },
  heartBtn: { padding: 8 },
  heart: { fontSize: 22 },
  empty: { textAlign: 'center', marginTop: 40, color: '#9ca3af' },
});
