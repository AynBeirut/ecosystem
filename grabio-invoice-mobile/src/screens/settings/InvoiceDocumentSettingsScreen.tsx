import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Switch, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { fetchStoreProfile, saveFinanceDocumentFields } from '../../lib/financeService';
import type { RootStackParamList } from '../../types';
import { COLORS } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Flags = {
  colorPdf: boolean;
  sr: boolean;
  quantity: boolean;
  rate: boolean;
  discount: boolean;
  tax: boolean;
  incTax: boolean;
  header: boolean;
  productTotal: boolean;
  balance: boolean;
  datewise: boolean;
  outstanding: boolean;
  words: boolean;
  signature: boolean;
  invoiceImage: boolean;
  estimateImage: boolean;
};

const DEFAULT_FLAGS: Flags = {
  colorPdf: true,
  sr: true,
  quantity: true,
  rate: true,
  discount: true,
  tax: true,
  incTax: true,
  header: true,
  productTotal: true,
  balance: true,
  datewise: true,
  outstanding: true,
  words: true,
  signature: true,
  invoiceImage: true,
  estimateImage: true,
};

function CheckRow({
  title,
  hint,
  value,
  onChange,
}: {
  title: string;
  hint: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <TouchableOpacity style={styles.checkRow} onPress={() => onChange(!value)}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={styles.checkTitle}>{title}</Text>
        <Text style={styles.checkHint}>{hint}</Text>
      </View>
      <View style={[styles.box, value && styles.boxOn]}>
        {value ? <Text style={styles.tick}>✓</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

export default function InvoiceDocumentSettingsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flags, setFlags] = useState<Flags>(DEFAULT_FLAGS);
  const [wordScale, setWordScale] = useState('Millions');
  const [currencyWord, setCurrencyWord] = useState('Dollar');
  const [fractionWord, setFractionWord] = useState('Cent');

  useEffect(() => {
    if (!user?.storeId) return;
    void fetchStoreProfile(user.storeId).then((data) => {
      const doc = (data?.financeDocumentSettings ?? {}) as Record<string, unknown>;
      const on = (key: string, fallback = true) => (typeof doc[key] === 'boolean' ? Boolean(doc[key]) : fallback);
      setFlags({
        colorPdf: doc.documentColorMode !== 'bw',
        sr: on('documentShowSr'),
        quantity: on('documentShowQuantity'),
        rate: on('documentShowRate'),
        discount: on('documentShowDiscount'),
        tax: on('documentShowTaxColumn', doc.documentShowTax !== false),
        incTax: on('documentShowIncTax'),
        header: on('documentShowBusinessHeader'),
        productTotal: on('documentShowProductTotal'),
        balance: on('documentShowBalancePaid'),
        datewise: on('documentShowDatewisePaid'),
        outstanding: on('documentShowOutstanding'),
        words: on('documentShowAmountWords'),
        signature: on('documentShowSignature'),
        invoiceImage: on('documentShowInvoiceImage'),
        estimateImage: on('documentShowEstimateImage'),
      });
      if (typeof doc.documentAmountWordScale === 'string') setWordScale(doc.documentAmountWordScale);
      if (typeof doc.documentCurrencyWord === 'string') setCurrencyWord(doc.documentCurrencyWord);
      if (typeof doc.documentFractionWord === 'string') setFractionWord(doc.documentFractionWord);
      setLoading(false);
    });
  }, [user?.storeId]);

  const setFlag = (key: keyof Flags, value: boolean) => setFlags((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    if (!user?.storeId) return;
    setSaving(true);
    try {
      await saveFinanceDocumentFields(user.storeId, {
        documentColorMode: flags.colorPdf ? 'colored' : 'bw',
        documentPdfPageSize: 'ISO A4',
        documentShowSr: flags.sr,
        documentShowQuantity: flags.quantity,
        documentShowRate: flags.rate,
        documentShowDiscount: flags.discount,
        documentShowTaxColumn: flags.tax,
        documentShowTax: flags.tax,
        documentShowIncTax: flags.incTax,
        documentShowBusinessHeader: flags.header,
        documentShowProductTotal: flags.productTotal,
        documentShowBalancePaid: flags.balance,
        documentShowDatewisePaid: flags.datewise,
        documentShowOutstanding: flags.outstanding,
        documentShowAmountWords: flags.words,
        documentAmountWordScale: wordScale,
        documentCurrencyWord: currencyWord,
        documentFractionWord: fractionWord,
        documentShowSignature: flags.signature,
        documentShowInvoiceImage: flags.invoiceImage,
        documentShowEstimateImage: flags.estimateImage,
      });
      Alert.alert('Saved', 'Invoice template settings saved.');
    } catch (e) {
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Could not save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />;

  return (
    <View style={styles.screen}>
      <View style={styles.tabs}>
        <View style={styles.tabOn}>
          <Text style={styles.tabOnText}>Settings</Text>
        </View>
        <TouchableOpacity style={styles.tab} onPress={() => navigation.navigate('InvoiceTemplate')}>
          <Text style={styles.tabText}>Preview</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.section}>Theme settings</Text>
        <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('InvoiceTemplate')}>
          <Text style={styles.linkTitle}>Invoice theme</Text>
          <Text style={styles.linkHint}>Open the A4 designer</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('InvoiceHeaderSettings')}>
          <Text style={styles.linkTitle}>Invoice header</Text>
          <Text style={styles.linkHint}>Logo, address, signature, paid stamp</Text>
        </TouchableOpacity>

        <Text style={styles.section}>PDF generation</Text>
        <View style={styles.line}>
          <Text style={styles.lineTitle}>Document PDF page size</Text>
          <Text style={styles.lineValue}>ISO A4</Text>
        </View>
        <View style={styles.line}>
          <View style={{ flex: 1 }}>
            <Text style={styles.lineTitle}>Generate report PDF in colour</Text>
            <Text style={styles.checkHint}>Off prints the same layout in black and white</Text>
          </View>
          <Switch value={flags.colorPdf} onValueChange={(v) => setFlag('colorPdf', v)} trackColor={{ false: '#E5E7EB', true: COLORS.primary }} thumbColor="#fff" />
        </View>
        <View style={styles.line}>
          <Text style={styles.lineTitle}>Report page size</Text>
          <Text style={styles.lineValue}>ISO A4</Text>
        </View>

        <Text style={styles.section}>Columns to show on PDF</Text>
        <CheckRow title="Sr no." hint="Serial number column" value={flags.sr} onChange={(v) => setFlag('sr', v)} />
        <CheckRow title="Quantity" hint="Quantity column" value={flags.quantity} onChange={(v) => setFlag('quantity', v)} />
        <CheckRow title="Rate" hint="Unit rate column" value={flags.rate} onChange={(v) => setFlag('rate', v)} />
        <CheckRow title="Discount" hint="Discount column" value={flags.discount} onChange={(v) => setFlag('discount', v)} />
        <CheckRow title="Tax" hint="Tax column" value={flags.tax} onChange={(v) => setFlag('tax', v)} />
        <CheckRow title="Inc. tax" hint="Amount including tax" value={flags.incTax} onChange={(v) => setFlag('incTax', v)} />

        <Text style={styles.section}>Items to show on PDF</Text>
        <CheckRow title="Header (business name and address)" hint="Company block at the top" value={flags.header} onChange={(v) => setFlag('header', v)} />
        <CheckRow title="Total product quantity and amount" hint="Quantity and amount totals" value={flags.productTotal} onChange={(v) => setFlag('productTotal', v)} />
        <CheckRow title="Balance and paid amount" hint="Paid and balance lines" value={flags.balance} onChange={(v) => setFlag('balance', v)} />
        <CheckRow title="Datewise details for paid amount" hint="Payment dates on the invoice" value={flags.datewise} onChange={(v) => setFlag('datewise', v)} />
        <CheckRow title="Total outstanding payment" hint="Outstanding balance" value={flags.outstanding} onChange={(v) => setFlag('outstanding', v)} />
        <CheckRow title="Total amount in words" hint="Amount written out in words" value={flags.words} onChange={(v) => setFlag('words', v)} />

        <Choice label="Amount in words format" value={wordScale} options={['Millions', 'Lakhs']} onChange={setWordScale} />
        <Choice label="Currency name in words" value={currencyWord} options={['Dollar', 'Lira']} onChange={setCurrencyWord} />
        <Choice label="Fractional part in words" value={fractionWord} options={['Cent', 'Piastre']} onChange={setFractionWord} />

        <CheckRow title="Signature" hint="Signature block on the document" value={flags.signature} onChange={(v) => setFlag('signature', v)} />
        <CheckRow title="Show attached image on invoice" hint="Image under the invoice" value={flags.invoiceImage} onChange={(v) => setFlag('invoiceImage', v)} />
        <CheckRow title="Show attached image on estimate" hint="Image under the estimate" value={flags.estimateImage} onChange={(v) => setFlag('estimateImage', v)} />

        <TouchableOpacity style={styles.save} onPress={() => void save()} disabled={saving}>
          <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (next: string) => void;
}) {
  return (
    <View style={styles.choiceBlock}>
      <Text style={styles.lineTitle}>{label}</Text>
      <View style={styles.choiceRow}>
        {options.map((option) => (
          <TouchableOpacity key={option} style={[styles.choice, value === option && styles.choiceOn]} onPress={() => onChange(option)}>
            <Text style={[styles.choiceText, value === option && styles.choiceTextOn]}>{option}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  tabOn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: COLORS.primary },
  tabText: { color: '#64748b', fontWeight: '600' },
  tabOnText: { color: COLORS.primary, fontWeight: '700' },
  scroll: { padding: 16, paddingBottom: 32 },
  section: { marginTop: 18, marginBottom: 8, fontSize: 13, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4 },
  linkRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  linkTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  linkHint: { marginTop: 2, color: '#64748b', fontSize: 13 },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  lineTitle: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  lineValue: { fontSize: 15, color: '#64748b' },
  checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  checkTitle: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  checkHint: { marginTop: 2, fontSize: 12, color: '#94A3B8' },
  box: { width: 22, height: 22, borderRadius: 4, borderWidth: 1.5, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tick: { color: '#fff', fontWeight: '800', fontSize: 14 },
  choiceBlock: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  choiceRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  choice: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  choiceOn: { backgroundColor: '#E6FFFA', borderColor: COLORS.primary },
  choiceText: { color: COLORS.textPrimary, fontWeight: '600' },
  choiceTextOn: { color: COLORS.secondary },
  save: { marginTop: 20, backgroundColor: '#1C2333', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
