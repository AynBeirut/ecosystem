import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, Alert } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { fetchStoreProfile, getInvoice, updateInvoiceStatus } from '../../lib/financeService';
import { shareInvoicePdf } from '../../lib/pdfShare';
import type { FinanceInvoice, RootStackParamList } from '../../types';
import { COLORS, RADIUS } from '../../theme';

type Route = RouteProp<RootStackParamList, 'InvoicePreview'>;

export default function InvoicePreviewScreen() {
  const { user } = useAuth();
  const route = useRoute<Route>();
  const [invoice, setInvoice] = useState<FinanceInvoice | null>(null);
  const [companyName, setCompanyName] = useState('Grabio Store');
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);

  const reload = async () => {
    if (!user?.storeId) return;
    const [inv, profile] = await Promise.all([
      getInvoice(user.storeId, route.params.invoiceId),
      fetchStoreProfile(user.storeId),
    ]);
    setInvoice(inv);
    setCompanyName(String((profile as { storeName?: string; name?: string; businessName?: string } | null)?.storeName || (profile as { name?: string } | null)?.name || 'Grabio Store'));
    setLoading(false);
  };

  useEffect(() => { void reload(); }, [user?.storeId, route.params.invoiceId]);

  const markPaid = async () => {
    if (!user?.storeId || !invoice) return;
    const total = invoice.total ?? invoice.amount;
    await updateInvoiceStatus(user.storeId, invoice.id, 'paid', total);
    await reload();
  };

  const share = async () => {
    if (!invoice) return;
    setSharing(true);
    try {
      await shareInvoicePdf(invoice, companyName);
    } catch (e) {
      Alert.alert('Share failed', e instanceof Error ? e.message : 'Could not share PDF');
    } finally {
      setSharing(false);
    }
  };

  if (loading || !invoice) return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />;

  const total = invoice.total ?? invoice.amount;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.company}>{companyName}</Text>
        <Text style={styles.title}>Invoice #{invoice.invoiceNumber || invoice.id.slice(0, 8)}</Text>
        <Text style={styles.meta}>Client: {invoice.clientName}</Text>
        <Text style={styles.meta}>Date: {new Date(invoice.date).toLocaleString()}</Text>
        <Text style={styles.meta}>Status: {invoice.status}</Text>
        {invoice.items.map((item) => (
          <View key={item.id} style={styles.line}>
            <Text style={styles.lineTitle}>{item.description}</Text>
            <Text style={styles.lineMeta}>{item.quantity} × {item.unitPrice.toFixed(2)} = {item.subtotal.toFixed(2)}</Text>
          </View>
        ))}
        <Text style={styles.total}>{invoice.currency} {total.toFixed(2)}</Text>
        {invoice.notes ? <Text style={styles.notes}>{invoice.notes}</Text> : null}
        <TouchableOpacity style={styles.btn} onPress={() => void share()} disabled={sharing}>
          <Text style={styles.btnText}>{sharing ? 'Preparing PDF…' : 'Share PDF'}</Text>
        </TouchableOpacity>
        {invoice.status !== 'paid' ? (
          <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => void markPaid()}>
            <Text style={styles.btnTextSecondary}>Mark paid</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16 },
  company: { fontSize: 14, color: COLORS.textSecondary },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.primary, marginVertical: 8 },
  meta: { color: COLORS.textSecondary, marginBottom: 4 },
  line: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 12, marginTop: 8, borderWidth: 1, borderColor: COLORS.border },
  lineTitle: { fontWeight: '600', color: COLORS.textPrimary },
  lineMeta: { color: COLORS.textSecondary, marginTop: 4 },
  total: { fontSize: 22, fontWeight: '800', color: COLORS.primary, marginTop: 16 },
  notes: { marginTop: 12, color: COLORS.textSecondary },
  btn: { marginTop: 16, backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 16, alignItems: 'center' },
  btnSecondary: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.primary },
  btnText: { color: '#fff', fontWeight: '700' },
  btnTextSecondary: { color: COLORS.primary, fontWeight: '700' },
});
