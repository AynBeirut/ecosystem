import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import ScreenSafeArea from '../../components/ScreenSafeArea';
import SupplierPickerSection from '../../components/SupplierPickerSection';
import ProductPickerSection from '../../components/ProductPickerSection';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { getProduct, getPurchaseOrder, productUnitPrice, savePurchaseOrder } from '../../lib/financeService';
import type { LineItem, RootStackParamList } from '../../types';
import { COLORS, RADIUS } from '../../theme';

type Route = RouteProp<RootStackParamList, 'PurchaseEditor'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function PurchaseEditorScreen() {
  const { user } = useAuth();
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const [loading, setLoading] = useState(!!route.params.purchaseId);
  const [saving, setSaving] = useState(false);
  const [supplierName, setSupplierName] = useState('');
  const [supplierId, setSupplierId] = useState<string>();
  const [currency, setCurrency] = useState('USD');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: '1', description: '', quantity: 1, unitPrice: 0, subtotal: 0 },
  ]);

  useEffect(() => {
    if (!user?.storeId) return;
    void (async () => {
      if (route.params.purchaseId) {
        const po = await getPurchaseOrder(user.storeId!, route.params.purchaseId);
        if (po) {
          setSupplierName(po.supplierName);
          setSupplierId(po.supplierId);
          setCurrency(po.currency);
          setNotes(po.notes || '');
          setLineItems(po.items.length ? po.items : lineItems);
        }
      }
      setLoading(false);
    })();
  }, [user?.storeId, route.params.purchaseId]);

  const updateLine = (id: string, field: keyof LineItem, value: string) => {
    setLineItems((rows) =>
      rows.map((row) => {
        if (row.id !== id) return row;
        const next = { ...row };
        if (field === 'description') next.description = value;
        else {
          const n = parseFloat(value) || 0;
          if (field === 'quantity') next.quantity = n;
          if (field === 'unitPrice') next.unitPrice = n;
          next.subtotal = next.quantity * next.unitPrice;
        }
        return next;
      }),
    );
  };

  const addProductLines = async (productIds: string[]) => {
    if (!user?.storeId || !productIds.length) return;
    const lines: LineItem[] = [];
    for (const productId of productIds) {
      const p = await getProduct(user.storeId, productId);
      if (!p) continue;
      const price = productUnitPrice(p);
      lines.push({
        id: `p-${Date.now()}-${productId}`,
        description: p.name,
        quantity: 1,
        unitPrice: price,
        subtotal: price,
      });
    }
    if (lines.length) setLineItems((rows) => [...rows, ...lines]);
  };

  const save = async () => {
    if (!user?.storeId || !supplierName.trim()) {
      Alert.alert('Required', 'Enter a supplier name');
      return;
    }
    const items = lineItems.filter((i) => i.description.trim());
    if (!items.length) {
      Alert.alert('Required', 'Add at least one line item');
      return;
    }
    setSaving(true);
    try {
      await savePurchaseOrder(user.storeId, {
        id: route.params.purchaseId,
        supplierId,
        supplierName: supplierName.trim(),
        items,
        amount: 0,
        currency,
        notes,
        status: 'sent',
      });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user?.storeId) return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />;

  const total = lineItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  return (
    <ScreenSafeArea edges={['bottom']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{route.params.purchaseId ? 'Edit purchase order' : 'New purchase order'}</Text>
        <SupplierPickerSection
          storeId={user.storeId}
          supplierName={supplierName}
          onChangeName={setSupplierName}
          onSelect={(s) => {
            setSupplierId(s.id);
            setSupplierName(s.name);
          }}
        />
        <ProductPickerSection
          storeId={user.storeId}
          onAdd={(ids) => void addProductLines(ids)}
          onCreateNew={() => navigation.navigate('ProductEditor', {})}
        />
        <Text style={styles.label}>Line items</Text>
        {lineItems.map((line) => (
          <View key={line.id} style={styles.line}>
            <TextInput
              style={styles.input}
              placeholder="Description"
              placeholderTextColor={COLORS.textMuted}
              value={line.description}
              onChangeText={(v) => updateLine(line.id, 'description', v)}
            />
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.half]}
                keyboardType="numeric"
                value={String(line.quantity)}
                onChangeText={(v) => updateLine(line.id, 'quantity', v)}
              />
              <TextInput
                style={[styles.input, styles.half]}
                keyboardType="numeric"
                value={String(line.unitPrice)}
                onChangeText={(v) => updateLine(line.id, 'unitPrice', v)}
              />
            </View>
          </View>
        ))}
        <TouchableOpacity
          onPress={() =>
            setLineItems((r) => [
              ...r,
              { id: `n-${Date.now()}`, description: '', quantity: 1, unitPrice: 0, subtotal: 0 },
            ])
          }
        >
          <Text style={styles.link}>+ Add line</Text>
        </TouchableOpacity>
        <TextInput style={styles.input} placeholder="Currency (USD)" placeholderTextColor={COLORS.textMuted} value={currency} onChangeText={setCurrency} />
        <TextInput style={styles.input} placeholder="Notes" placeholderTextColor={COLORS.textMuted} value={notes} onChangeText={setNotes} multiline />
        <Text style={styles.total}>Total: {currency} {total.toFixed(2)}</Text>
        <TouchableOpacity style={styles.saveBtn} onPress={() => void save()} disabled={saving}>
          <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save purchase order'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12, color: COLORS.textPrimary },
  label: { fontWeight: '600', color: COLORS.textSecondary, marginTop: 8, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 8,
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  line: { marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8 },
  half: { flex: 1 },
  link: { color: COLORS.primary, fontWeight: '600', marginBottom: 12 },
  total: { fontWeight: '700', fontSize: 16, marginVertical: 8, color: COLORS.textPrimary },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 16, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '700' },
});
