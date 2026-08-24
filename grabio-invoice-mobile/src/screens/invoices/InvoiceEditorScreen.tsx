import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Alert, ActivityIndicator,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { getInvoice, listClients, listProducts, productUnitPrice, saveInvoice } from '../../lib/financeService';
import type { FinanceClient, LineItem, RootStackParamList } from '../../types';
import { COLORS, RADIUS } from '../../theme';

type Route = RouteProp<RootStackParamList, 'InvoiceEditor'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function InvoiceEditorScreen() {
  const { user } = useAuth();
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const [loading, setLoading] = useState(!!route.params.invoiceId);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<FinanceClient[]>([]);
  const [products, setProducts] = useState<Awaited<ReturnType<typeof listProducts>>>([]);
  const [clientName, setClientName] = useState('');
  const [clientId, setClientId] = useState<string | undefined>();
  const [currency, setCurrency] = useState('USD');
  const [tax, setTax] = useState('0');
  const [discount, setDiscount] = useState('0');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([{ id: '1', description: '', quantity: 1, unitPrice: 0, subtotal: 0 }]);

  useEffect(() => {
    if (!user?.storeId) return;
    void (async () => {
      const [c, p] = await Promise.all([listClients(user.storeId!), listProducts(user.storeId!)]);
      setClients(c);
      setProducts(p);
      if (route.params.invoiceId) {
        const inv = await getInvoice(user.storeId!, route.params.invoiceId);
        if (inv) {
          setClientName(inv.clientName);
          setClientId(inv.clientId);
          setCurrency(inv.currency);
          setTax(String(inv.tax ?? 0));
          setDiscount(String(inv.discount ?? 0));
          setNotes(inv.notes || '');
          setLineItems(inv.items.length ? inv.items : lineItems);
        }
      }
      setLoading(false);
    })();
  }, [user?.storeId, route.params.invoiceId]);

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

  const addProductLine = (productId: string) => {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    const price = productUnitPrice(p);
    setLineItems((rows) => [...rows, { id: `p-${Date.now()}`, description: p.name, quantity: 1, unitPrice: price, subtotal: price }]);
  };

  const save = async () => {
    if (!user?.storeId || !clientName.trim()) {
      Alert.alert('Required', 'Select or enter a client name');
      return;
    }
    setSaving(true);
    try {
      const id = await saveInvoice(user.storeId, {
        id: route.params.invoiceId,
        clientId,
        clientName: clientName.trim(),
        items: lineItems.filter((i) => i.description.trim()),
        amount: 0,
        currency,
        tax: parseFloat(tax) || 0,
        discount: parseFloat(discount) || 0,
        notes,
        status: 'sent',
      });
      navigation.replace('InvoicePreview', { invoiceId: id });
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{route.params.invoiceId ? 'Edit invoice' : 'New invoice'}</Text>
        <Text style={styles.label}>Client</Text>
        <TextInput style={styles.input} placeholder="Client name" value={clientName} onChangeText={setClientName} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.clientRow}>
          {clients.slice(0, 12).map((c) => (
            <TouchableOpacity key={c.id} style={styles.clientChip} onPress={() => { setClientId(c.id); setClientName(c.name); }}>
              <Text style={styles.clientChipText}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Text style={styles.label}>Add product</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.clientRow}>
          {products.slice(0, 20).map((p) => (
            <TouchableOpacity key={p.id} style={styles.clientChip} onPress={() => addProductLine(p.id)}>
              <Text style={styles.clientChipText}>{p.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Text style={styles.label}>Line items</Text>
        {lineItems.map((line) => (
          <View key={line.id} style={styles.lineCard}>
            <TextInput style={styles.input} placeholder="Description" value={line.description} onChangeText={(v) => updateLine(line.id, 'description', v)} />
            <View style={styles.lineRow}>
              <TextInput style={[styles.input, styles.small]} placeholder="Qty" keyboardType="numeric" value={String(line.quantity)} onChangeText={(v) => updateLine(line.id, 'quantity', v)} />
              <TextInput style={[styles.input, styles.small]} placeholder="Price" keyboardType="numeric" value={String(line.unitPrice)} onChangeText={(v) => updateLine(line.id, 'unitPrice', v)} />
            </View>
          </View>
        ))}
        <TouchableOpacity onPress={() => setLineItems((r) => [...r, { id: `n-${Date.now()}`, description: '', quantity: 1, unitPrice: 0, subtotal: 0 }])}>
          <Text style={styles.link}>+ Add line</Text>
        </TouchableOpacity>
        <View style={styles.lineRow}>
          <TextInput style={[styles.input, styles.small]} placeholder="Tax %" keyboardType="numeric" value={tax} onChangeText={setTax} />
          <TextInput style={[styles.input, styles.small]} placeholder="Discount" keyboardType="numeric" value={discount} onChangeText={setDiscount} />
        </View>
        <TextInput style={styles.input} placeholder="Currency" value={currency} onChangeText={setCurrency} />
        <TextInput style={[styles.input, styles.notes]} placeholder="Notes" value={notes} onChangeText={setNotes} multiline />
        <TouchableOpacity style={styles.saveBtn} onPress={() => void save()} disabled={saving}>
          <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save & preview'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12, color: COLORS.textPrimary },
  label: { fontWeight: '600', color: COLORS.textSecondary, marginTop: 8, marginBottom: 6 },
  input: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 12, marginBottom: 8 },
  notes: { minHeight: 80, textAlignVertical: 'top' },
  lineCard: { marginBottom: 8 },
  lineRow: { flexDirection: 'row', gap: 8 },
  small: { flex: 1 },
  clientRow: { marginBottom: 8 },
  clientChip: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.full, marginRight: 8 },
  clientChipText: { color: COLORS.secondary, fontSize: 12 },
  link: { color: COLORS.primary, fontWeight: '600', marginBottom: 12 },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 16, alignItems: 'center', marginTop: 8 },
  saveText: { color: '#fff', fontWeight: '700' },
});
