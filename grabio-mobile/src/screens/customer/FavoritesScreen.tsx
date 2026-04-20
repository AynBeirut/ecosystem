import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Image,
  SafeAreaView, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import { useFavorites } from '../../context/FavoritesContext';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function FavoritesScreen() {
  const [tab, setTab] = useState<'stores' | 'products'>('stores');
  const { favoriteStores, favoriteProducts, toggleStoreFavorite, toggleProductFavorite } = useFavorites();
  const navigation = useNavigation<Nav>();

  const renderEmptyStores = () => (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>🏪</Text>
      <Text style={styles.emptyTitle}>No favorite stores yet</Text>
      <Text style={styles.emptySub}>Tap the heart on any store to save it here</Text>
    </View>
  );

  const renderEmptyProducts = () => (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>🛍️</Text>
      <Text style={styles.emptyTitle}>No favorite products yet</Text>
      <Text style={styles.emptySub}>Tap the heart on any product to save it here</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Favorites</Text>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'stores' && styles.activeTab]}
          onPress={() => setTab('stores')}
        >
          <Text style={[styles.tabText, tab === 'stores' && styles.activeTabText]}>
            Stores {favoriteStores.length > 0 ? `(${favoriteStores.length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'products' && styles.activeTab]}
          onPress={() => setTab('products')}
        >
          <Text style={[styles.tabText, tab === 'products' && styles.activeTabText]}>
            Products {favoriteProducts.length > 0 ? `(${favoriteProducts.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Stores tab */}
      {tab === 'stores' && (
        <FlatList
          data={favoriteStores}
          keyExtractor={(s) => s.storeId}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          ListEmptyComponent={renderEmptyStores}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('StoreDetail', { storeId: item.storeId, storeName: item.name })}
            >
              {item.logoUrl ? (
                <Image source={{ uri: item.logoUrl }} style={styles.logo} />
              ) : (
                <View style={[styles.logo, styles.logoPlaceholder]}>
                  <Text style={styles.logoText}>{item.name[0]}</Text>
                </View>
              )}
              <View style={styles.cardBody}>
                <Text style={styles.name}>{item.name}</Text>
                {item.description ? (
                  <Text style={styles.sub} numberOfLines={1}>{item.description}</Text>
                ) : null}
              </View>
              <TouchableOpacity
                style={styles.heartBtn}
                onPress={() => toggleStoreFavorite({ id: item.storeId, name: item.name, logoUrl: item.logoUrl ?? undefined, description: item.description ?? undefined })}
              >
                <Text style={styles.heart}>❤️</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Products tab */}
      {tab === 'products' && (
        <FlatList
          data={favoriteProducts}
          keyExtractor={(p) => p.productId}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          ListEmptyComponent={renderEmptyProducts}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card}>
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.productImg} />
              ) : (
                <View style={[styles.productImg, styles.logoPlaceholder]}>
                  <Text style={{ fontSize: 24 }}>🛍️</Text>
                </View>
              )}
              <View style={styles.cardBody}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.price}>{item.currency || 'USD'} {item.price.toFixed(2)}</Text>
                <Text style={styles.sub}>{item.storeName}</Text>
              </View>
              <TouchableOpacity
                style={styles.heartBtn}
                onPress={() => toggleProductFavorite({
                  id: item.productId,
                  storeId: item.storeId,
                  storeName: item.storeName,
                  name: item.name,
                  price: item.price,
                  currency: item.currency ?? undefined,
                  imageUrl: item.imageUrl ?? undefined,
                  unit: item.unit ?? undefined,
                })}
              >
                <Text style={styles.heart}>❤️</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { fontSize: 22, fontWeight: '700', color: '#111827', padding: 16, paddingBottom: 8 },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 4 },
  tab: {
    flex: 1, paddingVertical: 10, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  activeTab: { borderBottomColor: '#6366f1' },
  tabText: { fontSize: 15, color: '#6b7280', fontWeight: '600' },
  activeTabText: { color: '#6366f1' },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 12, padding: 12, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  logo: { width: 52, height: 52, borderRadius: 10 },
  productImg: { width: 52, height: 52, borderRadius: 8 },
  logoPlaceholder: { backgroundColor: '#e0e7ff', justifyContent: 'center', alignItems: 'center' },
  logoText: { color: '#6366f1', fontWeight: '700', fontSize: 20 },
  cardBody: { flex: 1, marginLeft: 12 },
  name: { fontSize: 15, fontWeight: '600', color: '#111827' },
  sub: { fontSize: 13, color: '#9ca3af', marginTop: 2 },
  price: { fontSize: 14, color: '#6366f1', fontWeight: '700', marginTop: 2 },
  heartBtn: { padding: 8 },
  heart: { fontSize: 20 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#374151', marginBottom: 6 },
  emptySub: { fontSize: 14, color: '#9ca3af', textAlign: 'center' },
});
