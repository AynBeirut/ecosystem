import React, { useEffect, useState } from 'react';
import { Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Alert, ActivityIndicator } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { getProduct, productUnitPrice, saveProduct } from '../../lib/financeService';
import type { RootStackParamList } from '../../types';
import { COLORS, RADIUS } from '../../theme';

type Route = RouteProp<RootStackParamList, 'ProductEditor'>;

export default function ProductEditorScreen() {
  const { user } = useAuth();
  const route = useRoute<Route>();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(!!route.params.productId);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [sku, setSku] = useState('');

  useEffect(() => {
    if (!user?.storeId || !route.params.productId) {
      setLoading(false);
      return;
    }
    void getProduct(user.storeId, route.params.productId).then((p) => {
      if (p) {
        setName(p.name);
        setPrice(String(productUnitPrice(p) || ''));
        setSku(p.sku || '');
      }
      setLoading(false);
    });
  }, [user?.storeId, route.params.productId]);

  const save = async () => {
    if (!user?.storeId || !name.trim()) {
      Alert.alert('Required', 'Product name is required');
      return;
    }
    await saveProduct(user.storeId, {
      id: route.params.productId,
      name: name.trim(),
      sellingPrice: parseFloat(price) || 0,
      sku,
    });
    navigation.goBack();
  };

  if (loading) return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{route.params.productId ? 'Edit product' : 'New product'}</Text>
        <TextInput style={styles.input} placeholder="Name" value={name} onChangeText={setName} />
        <TextInput style={styles.input} placeholder="Price" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
        <TextInput style={styles.input} placeholder="SKU (optional)" value={sku} onChangeText={setSku} />
        <TouchableOpacity style={styles.saveBtn} onPress={() => void save()}>
          <Text style={styles.saveText}>Save product</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  input: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 12, marginBottom: 8 },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 16, alignItems: 'center', marginTop: 8 },
  saveText: { color: '#fff', fontWeight: '700' },
});
