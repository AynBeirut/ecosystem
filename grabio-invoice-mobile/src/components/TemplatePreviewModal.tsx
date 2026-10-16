import React, { useMemo } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import ScreenSafeArea from './ScreenSafeArea';
import type { DocumentCompany } from '../lib/documentBranding';
import { buildDocumentHtml } from '../lib/pdfDocumentHtml';
import { SAMPLE_PREVIEW_INVOICE } from '../lib/templateStyles';
import { COLORS, RADIUS } from '../theme';

type Props = {
  visible: boolean;
  company: DocumentCompany;
  onClose: () => void;
};

export default function TemplatePreviewModal({ visible, company, onClose }: Props) {
  const html = useMemo(() => {
    const docHtml = buildDocumentHtml('invoice', SAMPLE_PREVIEW_INVOICE, company);
    return docHtml.replace(
      '<head>',
      '<head><meta name="viewport" content="width=device-width, initial-scale=0.42, maximum-scale=2, user-scalable=yes">',
    );
  }, [company]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ScreenSafeArea edges={['top', 'bottom']} style={styles.safe}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Invoice preview</Text>
            <Text style={styles.subtitle}>Sample PDF — scroll to see full page</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.webWrap}>
          <WebView
            key={`${company.website || ''}|${company.country || ''}|${company.pageBackgroundColor || ''}|${company.primaryColor}|${company.invoiceTemplate}`}
            originWhitelist={['*']}
            source={{ html }}
            style={styles.web}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loading}>
                <ActivityIndicator color={COLORS.primary} size="large" />
              </View>
            )}
            scalesPageToFit
            setBuiltInZoomControls
            showsVerticalScrollIndicator
          />
        </View>
      </ScreenSafeArea>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  subtitle: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  closeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primary,
  },
  closeText: { color: '#fff', fontWeight: '700' },
  webWrap: { flex: 1, backgroundColor: '#e2e8f0' },
  web: { flex: 1, backgroundColor: '#e2e8f0' },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});
