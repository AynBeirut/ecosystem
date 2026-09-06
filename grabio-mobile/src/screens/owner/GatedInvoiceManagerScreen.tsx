import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import ScreenSafeArea from '../../components/ScreenSafeArea';
import MobileModuleGate from '../../components/MobileModuleGate';
import { INVOICE_MANAGER_HOME, invoiceManagerUrl } from '../../lib/invoiceApp';
import { COLORS, RADIUS } from '../../theme';

/** Invoice Manager — opens grabio.space in the device browser (no in-app WebView). */
function InvoiceManagerNativeScreen() {
  const open = () => void Linking.openURL(invoiceManagerUrl(INVOICE_MANAGER_HOME));

  return (
    <ScreenSafeArea style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.icon}>🧾</Text>
        <Text style={styles.title}>Invoice Manager</Text>
        <Text style={styles.body}>
          Full invoicing, quotations, and finance tools run on grabio.space. The Grabio app stays native — we open your browser for this module.
        </Text>
        <TouchableOpacity style={styles.btn} onPress={open}>
          <Text style={styles.btnText}>Open Invoice Manager in browser</Text>
        </TouchableOpacity>
      </View>
    </ScreenSafeArea>
  );
}

export default function GatedInvoiceManagerScreen() {
  return (
    <MobileModuleGate moduleId="invoice_manager" title="Invoice Manager">
      <InvoiceManagerNativeScreen />
    </MobileModuleGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: 20, justifyContent: 'center' },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  icon: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 10 },
  body: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 21, marginBottom: 20 },
  btn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: 14, paddingHorizontal: 20, width: '100%', alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
