import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Alert, ActivityIndicator } from 'react-native';
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
  const productId = route.params?.productId;
  const [loading, setLoading] = useState(!!productId);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [sku, setSku] = useState('');
  const [kind, setKind] = useState<'raw_material' | 'item' | 'service' | ''>('');

  useEffect(() => {
    if (!user?.storeId || !productId) {
      setLoading(false);
      return;
    }
    void getProduct(user.storeId, productId).then((p) => {
      if (p) {
        setName(p.name);
        setPrice(String(productUnitPrice(p) || ''));
        setSku(p.sku || '');
        setKind(p.productType || '');
      }
      setLoading(false);
    });
  }, [user?.storeId, productId]);

  const save = async () => {
    if (!user?.storeId || !name.trim() || !kind) {
      Alert.alert('Required', !kind ? 'Select raw material, item, or service' : 'Product name is required');
      return;
    }
    setSaving(true);
    try {
      await saveProduct(user.storeId, {
        id: productId,
        name: name.trim(),
        sellingPrice: parseFloat(price) || 0,
        sku: sku.trim(),
        productType: kind,
      });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Could not save product', e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{productId ? 'Edit product' : 'New product'}</Text>
        <Text style={styles.label}>Type</Text>
        <View style={styles.row}>
          {([
            ['raw_material', 'Raw material'],
            ['item', 'Item'],
            ['service', 'Service'],
          ] as const).map(([id, label]) => (
            <TouchableOpacity key={id} style={[styles.chip, kind === id && styles.chipOn]} onPress={() => setKind(id)}>
              <Text style={[styles.chipText, kind === id && styles.chipTextOn]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} placeholder="Product name" placeholderTextColor={COLORS.textMuted} value={name} onChangeText={setName} />
        <Text style={styles.label}>Price</Text>
        <TextInput style={styles.input} placeholder="0.00" placeholderTextColor={COLORS.textMuted} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
        <Text style={styles.label}>SKU</Text>
        <TextInput style={styles.input} placeholder="Optional" placeholderTextColor={COLORS.textMuted} value={sku} onChangeText={setSku} />
        <TouchableOpacity style={styles.saveBtn} onPress={() => void save()} disabled={saving}>
          <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save product'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12, color: COLORS.textPrimary },
  label: { fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: COLORS.surface },
  chipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { color: COLORS.textPrimary, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  input: { backgroundColor: COLORS.surface, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: 14, marginBottom: 12, fontSize: 16 },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 16, alignItems: 'center', marginTop: 8 },
  saveText: { color: '#fff', fontWeight: '700' },
});
