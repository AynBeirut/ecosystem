import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, Alert, Switch,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Product } from '../../types';
import { useAuth } from '../../context/AuthContext';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function OwnerProductsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.storeId) { setLoading(false); return; }
    const unsub = firestore()
      .collection('products')
      .where('storeId', '==', user.storeId)
      .onSnapshot((snap) => {
        setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product)));
        setLoading(false);
      });
    return unsub;
  }, [user?.storeId]);

  const toggleStock = async (product: Product) => {
    await firestore()
      .collection('products')
      .doc(product.id)
      .update({ inStock: !product.inStock });
  };

  const deleteProduct = (product: Product) => {
    // Only allow deleting simple products
    if (product.productType !== 'simple') {
      Alert.alert('Not allowed', 'Only simple products can be deleted from the mobile app.');
      return;
    }
    Alert.alert('Delete Product', `Delete "${product.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => firestore().collection('products').doc(product.id).delete(),
      },
    ]);
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const isSimple = item.productType === 'simple';
    return (
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.productName}>{item.name}</Text>
            <Text style={styles.productMeta}>
              {item.currency || 'USD'} {item.price.toFixed(2)}
              {item.stock !== undefined ? ` · Stock: ${item.stock}` : ''}
            </Text>
            <View style={styles.typeBadge}>
              <Text style={styles.typeText}>{item.productType}</Text>
            </View>
          </View>
          <Switch
            value={item.inStock}
            onValueChange={() => toggleStock(item)}
            trackColor={{ true: '#6366f1' }}
          />
        </View>
        {!item.inStock && <Text style={styles.outOfStock}>⚠️ Out of stock</Text>}
        {item.stock !== undefined && item.stock <= (item.lowStockThreshold ?? 5) && item.inStock && (
          <Text style={styles.lowStock}>📦 Low stock!</Text>
        )}

        <View style={styles.actions}>
          {isSimple ? (
            <>
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => navigation.navigate('AddEditProduct', { productId: item.id })}
              >
                <Text style={styles.editBtnText}>✏️ Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteProduct(item)}>
                <Text style={styles.deleteBtnText}>🗑️ Delete</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.readOnlyNote}>Read-only on mobile</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Products</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('AddEditProduct', {})}
        >
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          renderItem={renderProduct}
          contentContainerStyle={{ padding: 12 }}
          ListEmptyComponent={<Text style={styles.empty}>No products yet</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#111827' },
  addBtn: { backgroundColor: '#6366f1', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  productName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  productMeta: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  typeBadge: { backgroundColor: '#f3f4f6', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4, alignSelf: 'flex-start' },
  typeText: { fontSize: 11, color: '#6b7280' },
  outOfStock: { fontSize: 12, color: '#ef4444', marginBottom: 6 },
  lowStock: { fontSize: 12, color: '#f59e0b', marginBottom: 6 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  editBtn: { flex: 1, backgroundColor: '#e0e7ff', borderRadius: 8, paddingVertical: 7, alignItems: 'center' },
  editBtnText: { color: '#6366f1', fontWeight: '600', fontSize: 13 },
  deleteBtn: { flex: 1, backgroundColor: '#fee2e2', borderRadius: 8, paddingVertical: 7, alignItems: 'center' },
  deleteBtnText: { color: '#ef4444', fontWeight: '600', fontSize: 13 },
  readOnlyNote: { fontSize: 12, color: '#9ca3af', fontStyle: 'italic' },
  empty: { textAlign: 'center', marginTop: 40, color: '#9ca3af', fontSize: 15 },
});
