import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Switch,
} from 'react-native';
import ScreenSafeArea from '../../components/ScreenSafeArea';
import ClientPickerSection from '../../components/ClientPickerSection';
import ProductPickerSection from '../../components/ProductPickerSection';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { fetchStoreProfile, getInvoice, getProduct, productUnitPrice, saveInvoice } from '../../lib/financeService';
import { resolveDiscountAmount } from '../../lib/invoiceDiscount';
import type { LineItem, RootStackParamList } from '../../types';
import { COLORS, RADIUS } from '../../theme';

type Route = RouteProp<RootStackParamList, 'InvoiceEditor'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;
type DiscountType = 'fixed' | 'percent';

function storeCurrencies(profile: Record<string, unknown> | null): string[] {
  const main = String(profile?.mainCurrency || 'USD').trim().toUpperCase() || 'USD';
  const secondary = String(profile?.secondaryCurrency || '').trim().toUpperCase();
  return secondary && secondary !== main ? [main, secondary] : [main];
}

export default function InvoiceEditorScreen() {
  const { user } = useAuth();
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const invoiceId = route.params?.invoiceId;
  const [loading, setLoading] = useState(!!invoiceId);
  const [saving, setSaving] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientId, setClientId] = useState<string | undefined>();
  const [currencies, setCurrencies] = useState<string[]>(['USD']);
  const [currency, setCurrency] = useState('USD');
  const [addVat, setAddVat] = useState(false);
  const [tax, setTax] = useState('');
  const [discountType, setDiscountType] = useState<DiscountType>('fixed');
  const [discount, setDiscount] = useState('');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([{ id: '1', description: '', quantity: 1, unitPrice: 0, subtotal: 0 }]);

  useEffect(() => {
    if (!user?.storeId) return;
    void (async () => {
      const profile = await fetchStoreProfile(user.storeId!);
      const allowed = storeCurrencies(profile as Record<string, unknown> | null);
      setCurrencies(allowed);
      setCurrency(allowed[0]);
      if (invoiceId) {
        const inv = await getInvoice(user.storeId!, invoiceId);
        if (inv) {
          setClientName(inv.clientName);
          setClientId(inv.clientId);
          const saved = (inv.currency || allowed[0]).toUpperCase();
          setCurrency(allowed.includes(saved) ? saved : allowed[0]);
          const savedTax = Number(inv.tax) || 0;
          setAddVat(savedTax > 0);
          setTax(savedTax > 0 ? String(savedTax) : '');
          const type: DiscountType = inv.discountType === 'percent' ? 'percent' : 'fixed';
          setDiscountType(type);
          const shown = inv.discountValue ?? inv.discount;
          setDiscount(shown ? String(shown) : '');
          setNotes(inv.notes || '');
          setLineItems(inv.items.length ? inv.items : lineItems);
        }
      }
      setLoading(false);
    })();
  }, [user?.storeId, invoiceId]);

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

  const subtotal = lineItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const discountValue = parseFloat(discount) || 0;
  const discountAmount = resolveDiscountAmount(subtotal, discountType, discountValue);
  const vatAmount = addVat ? subtotal * ((parseFloat(tax) || 0) / 100) : 0;
  const total = Math.max(0, subtotal + vatAmount - discountAmount);
  const discountLabel = useMemo(
    () => (discountType === 'percent' ? `${discountValue || 0}%` : `${currency} ${discountAmount.toFixed(2)}`),
    [discountType, discountValue, discountAmount, currency],
  );

  const save = async () => {
    if (!user?.storeId || !clientName.trim()) {
      Alert.alert('Required', 'Choose a client');
      return;
    }
    const items = lineItems.filter((i) => i.description.trim());
    if (!items.length) {
      Alert.alert('Required', 'Add at least one line');
      return;
    }
    setSaving(true);
    try {
      const id = await saveInvoice(user.storeId, {
        id: invoiceId,
        clientId,
        clientName: clientName.trim(),
        items,
        amount: 0,
        currency,
        tax: addVat ? parseFloat(tax) || 0 : 0,
        discount: discountAmount,
        discountType,
        discountValue,
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

  if (loading || !user?.storeId) return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />;

  return (
    <ScreenSafeArea edges={['bottom']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{invoiceId ? 'Edit invoice' : 'New invoice'}</Text>
        <ClientPickerSection
          storeId={user.storeId}
          clientName={clientName}
          onChangeName={(name) => {
            setClientName(name);
            setClientId(undefined);
          }}
          onSelect={(client) => {
            setClientId(client.id);
            setClientName(client.name);
          }}
          onCreateNew={() => navigation.navigate('ClientEditor', {})}
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
                placeholder="Qty"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numeric"
                value={String(line.quantity)}
                onChangeText={(v) => updateLine(line.id, 'quantity', v)}
              />
              <TextInput
                style={[styles.input, styles.half]}
                placeholder="Price"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numeric"
                value={String(line.unitPrice)}
                onChangeText={(v) => updateLine(line.id, 'unitPrice', v)}
              />
            </View>
          </View>
        ))}
        <TouchableOpacity
          onPress={() =>
            setLineItems((r) => [...r, { id: `n-${Date.now()}`, description: '', quantity: 1, unitPrice: 0, subtotal: 0 }])
          }
        >
          <Text style={styles.link}>+ Add line</Text>
        </TouchableOpacity>
        <View style={styles.vatRow}>
          <View>
            <Text style={styles.label}>VAT</Text>
            <Text style={styles.hint}>{addVat ? 'Percent on the subtotal' : 'Off'}</Text>
          </View>
          <Switch value={addVat} onValueChange={setAddVat} trackColor={{ false: COLORS.border, true: COLORS.primary }} thumbColor="#fff" />
        </View>
        {addVat ? (
          <TextInput style={styles.input} placeholder="VAT %" placeholderTextColor={COLORS.textMuted} keyboardType="numeric" value={tax} onChangeText={setTax} />
        ) : null}
        <Text style={styles.label}>Discount</Text>
        <View style={styles.row}>
          {(['fixed', 'percent'] as const).map((type) => (
            <TouchableOpacity key={type} style={[styles.choice, discountType === type && styles.choiceOn]} onPress={() => setDiscountType(type)}>
              <Text style={[styles.choiceText, discountType === type && styles.choiceTextOn]}>{type === 'fixed' ? 'Amount' : '%'}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          style={styles.input}
          placeholder={discountType === 'percent' ? 'Percent off' : 'Amount off'}
          placeholderTextColor={COLORS.textMuted}
          keyboardType="numeric"
          value={discount}
          onChangeText={setDiscount}
        />
        <Text style={styles.hint}>Discount {discountLabel}</Text>
        <Text style={styles.label}>Currency</Text>
        <View style={styles.row}>
          {currencies.map((code) => (
            <TouchableOpacity key={code} style={[styles.choice, currency === code && styles.choiceOn]} onPress={() => setCurrency(code)}>
              <Text style={[styles.choiceText, currency === code && styles.choiceTextOn]}>{code}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.hint}>Set in accounting for this business</Text>
        <TextInput style={[styles.input, styles.notes]} placeholder="Notes" placeholderTextColor={COLORS.textMuted} value={notes} onChangeText={setNotes} multiline />
        <Text style={styles.total}>Total: {currency} {total.toFixed(2)}</Text>
        <TouchableOpacity style={styles.saveBtn} onPress={() => void save()} disabled={saving}>
          <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save & preview'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12, color: COLORS.textPrimary },
  label: { fontWeight: '600', color: COLORS.textSecondary, marginTop: 8, marginBottom: 6 },
  hint: { color: COLORS.textMuted, fontSize: 12, marginBottom: 8 },
  input: {
    backgroundColor: COLORS.surface,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 8,
    fontSize: 16,
  },
  notes: { minHeight: 80, textAlignVertical: 'top' },
  line: { marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  half: { flex: 1 },
  link: { color: COLORS.primary, fontWeight: '600', marginBottom: 12 },
  vatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 8,
  },
  choice: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  choiceOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  choiceText: { fontWeight: '700', color: COLORS.textPrimary },
  choiceTextOn: { color: '#fff' },
  total: { fontWeight: '700', fontSize: 16, marginVertical: 8, color: COLORS.textPrimary },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 16, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '700' },
});
