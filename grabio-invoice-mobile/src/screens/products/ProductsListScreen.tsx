import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { listProducts, productUnitPrice } from '../../lib/financeService';
import type { FinanceProduct, RootStackParamList } from '../../types';
import { COLORS, RADIUS, SHADOW } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ProductsListScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const [items, setItems] = useState<FinanceProduct[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.storeId) { setLoading(false); return; }
    setItems(await listProducts(user.storeId));
    setLoading(false);
    setRefreshing(false);
  }, [user?.storeId]);

  useEffect(() => { void load(); }, [load]);

  const filtered = items.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()));

  if (loading) return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Products</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('ProductEditor', {})}>
          <Text style={styles.addText}>+ New</Text>
        </TouchableOpacity>
      </View>
      <TextInput style={styles.search} placeholder="Search products…" value={search} onChangeText={setSearch} />
      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
        ListEmptyComponent={<Text style={styles.empty}>No products yet.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ProductEditor', { productId: item.id })}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.price}>USD {productUnitPrice(item).toFixed(2)}</Text>
            {item.sku ? <Text style={styles.meta}>SKU: {item.sku}</Text> : null}
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingTop: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '700' },
  addBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.md },
  addText: { color: '#fff', fontWeight: '700' },
  search: { marginHorizontal: 16, marginBottom: 8, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 12, borderWidth: 1, borderColor: COLORS.border },
  card: { marginHorizontal: 16, marginBottom: 10, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 14, ...SHADOW.sm },
  cardTitle: { fontWeight: '700' },
  price: { color: COLORS.primary, fontWeight: '700', marginTop: 4 },
  meta: { color: COLORS.textSecondary, marginTop: 4 },
  empty: { textAlign: 'center', color: COLORS.textMuted, marginTop: 40 },
});
