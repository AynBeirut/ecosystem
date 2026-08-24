import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, Alert, Switch, Image,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Product } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { COLORS, RADIUS, SHADOW } from '../../theme';

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
  const isService = item.productType === 'service';
  const canQuickEdit = isSimple || isService || item.productType === 'finished_good';
  const canFullEdit = isSimple || isService;
    return (
      <View style={styles.card}>
      <View style={styles.cardRow}>
        {(item.image || item.imageUrl) ? (
          <Image source={{ uri: item.image || item.imageUrl }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Text style={{ fontSize: 20 }}>📦</Text>
          </View>
        )}
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
            trackColor={{ true: COLORS.primary }}
          />
        </View>
        {!item.inStock && <Text style={styles.outOfStock}>⚠️ Out of stock</Text>}
        {item.stock !== undefined && item.stock <= (item.lowStockThreshold ?? 5) && item.inStock && (
          <Text style={styles.lowStock}>📦 Low stock!</Text>
        )}

        <View style={styles.actions}>
          {canQuickEdit ? (
            <>
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => navigation.navigate('AddEditProduct', { productId: item.id })}
              >
                <Text style={styles.editBtnText}>{canFullEdit ? '✏️ Edit' : '✏️ Quick edit'}</Text>
              </TouchableOpacity>
              {isSimple ? (
                <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteProduct(item)}>
                  <Text style={styles.deleteBtnText}>🗑️ Delete</Text>
                </TouchableOpacity>
              ) : null}
            </>
          ) : (
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => navigation.navigate('AddEditProduct', { productId: item.id })}
            >
              <Text style={styles.editBtnText}>✏️ Price & stock</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('AddEditProduct', {})}
        >
          <Text style={styles.addBtnText}>+ Add Product</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
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
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary },
  addBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontWeight: '700' },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 14, marginBottom: 10, ...SHADOW.sm },
  cardRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  thumb: { width: 48, height: 48, borderRadius: RADIUS.md, resizeMode: 'cover', marginRight: 10 },
  thumbPlaceholder: { backgroundColor: COLORS.light, justifyContent: 'center', alignItems: 'center' },
  productName: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  productMeta: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  typeBadge: { backgroundColor: COLORS.light, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4, alignSelf: 'flex-start' },
  typeText: { fontSize: 11, color: COLORS.textSecondary },
  outOfStock: { fontSize: 12, color: COLORS.error, marginBottom: 6 },
  lowStock: { fontSize: 12, color: COLORS.warning, marginBottom: 6 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  editBtn: { flex: 1, backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, paddingVertical: 7, alignItems: 'center' },
  editBtnText: { color: COLORS.primary, fontWeight: '600', fontSize: 13 },
  deleteBtn: { flex: 1, backgroundColor: '#fee2e2', borderRadius: RADIUS.md, paddingVertical: 7, alignItems: 'center' },
  deleteBtnText: { color: COLORS.error, fontWeight: '600', fontSize: 13 },
  readOnlyNote: { fontSize: 12, color: COLORS.textMuted, fontStyle: 'italic' },
  empty: { textAlign: 'center', marginTop: 40, color: COLORS.textMuted, fontSize: 15 },
});
