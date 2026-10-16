import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Switch,
} from 'react-native';
import ScreenSafeArea from '../../components/ScreenSafeArea';
import ScreenHeader from '../../components/ui/ScreenHeader';
import { useAuth } from '../../context/AuthContext';
import {
  isNipcoCompany,
  loadFinanceDocumentSettings,
  updateFinanceDocumentSettings,
  type FinanceDocumentSettings,
} from '../../lib/documentBranding';
import {
  isNipcoProductionStore,
  NIPCO_TEMPLATE_LOCK_MESSAGE,
} from '../../lib/nipcoInvoiceTemplateLock';
import { DEFAULT_INVOICE_DUE_DAYS } from '../../lib/financeDueDates';
import {
  mapGrabioInvoiceTemplateToFinance,
  type FinanceInvoiceTemplate,
} from '../../lib/invoiceTemplateMap';
import { pickAndUploadDocumentImage, uploadSignatureDataUrl } from '../../lib/documentImageUpload';
import SignaturePadModal from '../../components/SignaturePadModal';
import TemplatePreviewModal from '../../components/TemplatePreviewModal';
import {
  LAYOUT_OPTIONS,
  LINE_WEIGHT_OPTIONS,
  normalizeDocumentLayout,
  normalizeDocumentLineWeight,
  type DocumentLayoutStyle,
  type DocumentLineWeight,
} from '../../lib/templateStyles';
import type { DocumentCompany } from '../../lib/documentBranding';
import { adminUi } from '../../theme/adminUi';
import { COLORS, RADIUS } from '../../theme';

const TEMPLATE_OPTIONS: {
  value: FinanceInvoiceTemplate;
  label: string;
  desc: string;
  primary: string;
  accent: string;
}[] = [
  { value: 'modern', label: 'Modern', desc: 'Clean teal header — best for most businesses', primary: '#38B2AC', accent: '#2C5282' },
  { value: 'basic', label: 'Classic', desc: 'Black & gold — formal invoices', primary: '#1A202C', accent: '#B7791F' },
  { value: 'professional', label: 'Vibrant', desc: 'Purple & orange — bold branding', primary: '#6B46C1', accent: '#DD6B20' },
];

const COLOR_THEMES = [
  { label: 'Grabio Teal', primary: '#38B2AC', secondary: '#2C5282' },
  { label: 'Ocean Blue', primary: '#3182CE', secondary: '#2B6CB0' },
  { label: 'Forest', primary: '#38A169', secondary: '#276749' },
  { label: 'Royal', primary: '#805AD5', secondary: '#6B46C1' },
  { label: 'Slate & Gold', primary: '#334155', secondary: '#B7791F' },
];

const DUE_DAY_OPTIONS = [7, 14, 30, 45, 60, 90];

const PAGE_BG_PRESETS = [
  { label: 'Template default', value: '' },
  { label: 'White', value: '#FFFFFF' },
  { label: 'Light teal', value: '#F0FDFA' },
  { label: 'Light gray', value: '#F8FAFC' },
  { label: 'Cream', value: '#FFFAF0' },
  { label: 'Lavender', value: '#FAF5FF' },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={adminUi.sectionLabel}>{title}</Text>
      <View style={[adminUi.panel, { marginHorizontal: 0 }]}>{children}</View>
    </View>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

function imagePreviewUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed.startsWith('http') && !trimmed.startsWith('data:image') && !trimmed.startsWith('file://')) {
    return null;
  }
  return trimmed;
}

function ImageUploadField({
  label,
  hint,
  imageUrl,
  uploading,
  onPick,
  onRemove,
  previewStyle,
}: {
  label: string;
  hint?: string;
  imageUrl: string;
  uploading: boolean;
  onPick: () => void;
  onRemove: () => void;
  previewStyle?: 'logo' | 'signature';
}) {
  const preview = imagePreviewUrl(imageUrl);
  const isSignature = previewStyle === 'signature';

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.uploadCard}>
        <View style={[styles.uploadPreview, isSignature && styles.uploadPreviewSignature]}>
          {preview ? (
            <Image source={{ uri: preview }} style={isSignature ? styles.signaturePreviewImg : styles.logoPreviewImg} resizeMode="contain" />
          ) : (
            <Text style={styles.uploadPlaceholder}>{isSignature ? 'No signature' : 'No logo'}</Text>
          )}
        </View>
        <View style={styles.uploadActions}>
          <TouchableOpacity style={styles.uploadBtn} onPress={onPick} disabled={uploading}>
            {uploading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.uploadBtnText}>Choose from gallery</Text>
            )}
          </TouchableOpacity>
          {preview ? (
            <TouchableOpacity style={styles.removeBtn} onPress={onRemove} disabled={uploading}>
              <Text style={styles.removeBtnText}>Remove</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

function LayoutMiniPreview({
  layout,
  headerColor,
  accentColor,
  lineWeight,
}: {
  layout: DocumentLayoutStyle;
  headerColor: string;
  accentColor: string;
  lineWeight: DocumentLineWeight;
}) {
  const borderW = lineWeight === 'bold' ? 2 : lineWeight === 'fine' ? 0.5 : 1;
  if (layout === 'accent-line') {
    return (
      <View style={[miniStyles.box, { borderTopWidth: 3, borderTopColor: headerColor }]}>
        <View style={miniStyles.row}><View style={[miniStyles.bar, { backgroundColor: accentColor, height: 3 }]} /></View>
        <View style={[miniStyles.line, { borderBottomWidth: borderW }]} />
        <View style={[miniStyles.line, { width: '70%', borderBottomWidth: borderW }]} />
      </View>
    );
  }
  if (layout === 'minimal') {
    return (
      <View style={miniStyles.box}>
        <View style={[miniStyles.line, { width: '55%', borderBottomWidth: borderW }]} />
        <View style={[miniStyles.line, { width: '80%', borderBottomWidth: borderW }]} />
        <View style={[miniStyles.line, { width: '65%', borderBottomWidth: borderW }]} />
      </View>
    );
  }
  if (layout === 'sidebar') {
    return (
      <View style={[miniStyles.box, { flexDirection: 'row' }]}>
        <View style={{ width: 5, backgroundColor: headerColor, borderRadius: 2 }} />
        <View style={{ flex: 1, paddingLeft: 4 }}>
          <View style={[miniStyles.line, { width: '70%', borderBottomWidth: borderW }]} />
          <View style={[miniStyles.line, { width: '90%', borderBottomWidth: borderW }]} />
        </View>
      </View>
    );
  }
  return (
    <View style={miniStyles.box}>
      <View style={[miniStyles.headerBand, { backgroundColor: headerColor }]} />
      <View style={[miniStyles.line, { width: '75%', borderBottomWidth: borderW }]} />
      <View style={[miniStyles.line, { width: '55%', borderBottomWidth: borderW }]} />
    </View>
  );
}

const miniStyles = StyleSheet.create({
  box: { width: 52, height: 44, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#fff', padding: 4, overflow: 'hidden' },
  headerBand: { height: 12, borderRadius: 2, marginBottom: 4 },
  line: { height: 6, borderBottomColor: '#cbd5e1', marginBottom: 3 },
  row: { marginBottom: 4 },
  bar: { width: '100%' },
});

export default function InvoiceTemplateSettingsScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nipcoLocked, setNipcoLocked] = useState(false);
  const [storeDefaults, setStoreDefaults] = useState({ name: '', address: '', taxId: '', email: '' });

  const [companyName, setCompanyName] = useState('');
  const [showCompanyName, setShowCompanyName] = useState(true);
  const [address, setAddress] = useState('');
  const [taxId, setTaxId] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [country, setCountry] = useState('Lebanon');
  const [logoUrl, setLogoUrl] = useState('');
  const [signatureUrl, setSignatureUrl] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [signaturePadOpen, setSignaturePadOpen] = useState(false);
  const [footerNote, setFooterNote] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#38B2AC');
  const [secondaryColor, setSecondaryColor] = useState('#2C5282');
  const [pageBackground, setPageBackground] = useState('');
  const [invoiceTemplate, setInvoiceTemplate] = useState<FinanceInvoiceTemplate>('modern');
  const [invoiceDueDays, setInvoiceDueDays] = useState(DEFAULT_INVOICE_DUE_DAYS);
  const [documentLayout, setDocumentLayout] = useState<DocumentLayoutStyle>('classic');
  const [documentLineWeight, setDocumentLineWeight] = useState<DocumentLineWeight>('regular');
  const [previewOpen, setPreviewOpen] = useState(false);

  const applyLoaded = useCallback((profile: Record<string, unknown> | null, doc: FinanceDocumentSettings) => {
    const companyNameDefault = String(profile?.name || profile?.storeName || '');
    const contactInfo = (profile?.contactInfo ?? {}) as { phone?: string; email?: string };
    const profileEmail = String(profile?.email || contactInfo.email || '');
    const profilePhone = String(profile?.phone || contactInfo.phone || '');
    const profileTaxId = String(profile?.taxId || profile?.taxNumber || '');
    const profileAddress = String(profile?.location || '');
    setStoreDefaults({
      name: companyNameDefault,
      address: profileAddress,
      taxId: profileTaxId,
      email: profileEmail,
    });
    setCompanyName(doc.documentCompanyName?.trim() || companyNameDefault);
    setShowCompanyName(doc.documentShowCompanyName !== false);
    setAddress(doc.documentAddress?.trim() || profileAddress);
    setTaxId(doc.documentTaxId?.trim() || profileTaxId);
    setPhone(doc.documentPhone?.trim() || profilePhone);
    setEmail(doc.documentEmail?.trim() || profileEmail);
    setWebsite(doc.documentWebsite?.trim() || String(profile?.website || ''));
    setCountry(doc.documentCountry?.trim() || 'Lebanon');
    setLogoUrl(doc.documentLogo ?? '');
    setSignatureUrl(doc.signature ?? '');
    setFooterNote(doc.documentFooterNote ?? '');
    setPrimaryColor(doc.primaryColor || '#38B2AC');
    setSecondaryColor(doc.secondaryColor || '#2C5282');
    setPageBackground(doc.documentPageBackground?.trim() || '');
    setInvoiceTemplate(
      mapGrabioInvoiceTemplateToFinance(
        profile?.invoiceTemplate ? String(profile.invoiceTemplate) : null,
        doc.invoiceTemplate,
      ),
    );
    setInvoiceDueDays(doc.invoiceDueDays ?? DEFAULT_INVOICE_DUE_DAYS);
    setDocumentLayout(normalizeDocumentLayout(doc.documentLayout));
    setDocumentLineWeight(normalizeDocumentLineWeight(doc.documentLineWeight));
    setNipcoLocked(isNipcoCompany({
      name: doc.documentCompanyName || companyNameDefault,
      taxId: doc.documentTaxId || String(profile?.taxId || ''),
    }));
  }, []);

  const reload = useCallback(async () => {
    if (!user?.storeId) {
      setLoading(false);
      return;
    }
    const { profile, doc } = await loadFinanceDocumentSettings(user.storeId);
    applyLoaded(profile, doc);
    setNipcoLocked(isNipcoProductionStore(user.storeId));
    setLoading(false);
  }, [applyLoaded, user?.storeId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const previewName = companyName.trim() || storeDefaults.name || 'Your Company';
  const previewHeader = nipcoLocked ? '#1e3a5f' : primaryColor;
  const previewAccent = nipcoLocked ? '#2563eb' : secondaryColor;

  const previewCompany = useMemo<DocumentCompany>(
    () => ({
      name: previewName,
      showCompanyName,
      address: address.trim() || storeDefaults.address || 'Company address',
      phone: phone.trim(),
      email: email.trim(),
      website: website.trim() || undefined,
      country: country.trim() || 'Lebanon',
      logo: logoUrl.trim(),
      taxId: taxId.trim() || storeDefaults.taxId || undefined,
      primaryColor,
      secondaryColor,
      pageBackgroundColor: pageBackground.trim() || undefined,
      invoiceTemplate,
      signature: signatureUrl.trim() || undefined,
      footerNote: footerNote.trim() || undefined,
      documentLayout,
      documentLineWeight,
    }),
    [
      previewName,
      showCompanyName,
      address,
      storeDefaults,
      phone,
      email,
      website,
      country,
      logoUrl,
      taxId,
      primaryColor,
      secondaryColor,
      pageBackground,
      invoiceTemplate,
      signatureUrl,
      footerNote,
      documentLayout,
      documentLineWeight,
    ],
  );

  const save = async () => {
    if (!user?.storeId) return;
    if (isNipcoProductionStore(user.storeId)) {
      Alert.alert('Template locked', NIPCO_TEMPLATE_LOCK_MESSAGE);
      return;
    }
    const dueDays = Math.max(1, Math.min(365, Number(invoiceDueDays) || DEFAULT_INVOICE_DUE_DAYS));
    setSaving(true);
    try {
      const patch: Partial<FinanceDocumentSettings> = {
        documentCompanyName: companyName.trim(),
        documentShowCompanyName: showCompanyName,
        documentAddress: address.trim(),
        documentTaxId: taxId.trim(),
        documentPhone: phone.trim(),
        documentEmail: email.trim(),
        documentWebsite: website.trim(),
        documentCountry: country.trim() || 'Lebanon',
        documentLogo: logoUrl.trim(),
        signature: signatureUrl.trim(),
        documentFooterNote: footerNote.trim(),
        primaryColor: primaryColor.trim() || '#38B2AC',
        secondaryColor: secondaryColor.trim() || '#2C5282',
        documentPageBackground: pageBackground.trim(),
        invoiceDueDays: dueDays,
        documentLayout,
        documentLineWeight,
        ...(nipcoLocked ? {} : { invoiceTemplate }),
      };
      await updateFinanceDocumentSettings(user.storeId, patch);
      const { profile, doc } = await loadFinanceDocumentSettings(user.storeId);
      applyLoaded(profile, doc);
      Alert.alert('Saved', 'Document template settings saved to your store profile.');
    } catch (e) {
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Could not save settings');
    } finally {
      setSaving(false);
    }
  };

  const logoPreview = useMemo(() => imagePreviewUrl(logoUrl), [logoUrl]);
  const signaturePreview = useMemo(() => imagePreviewUrl(signatureUrl), [signatureUrl]);

  const pickLogo = async () => {
    setUploadingLogo(true);
    try {
      const url = await pickAndUploadDocumentImage('logo');
      if (url) setLogoUrl(url);
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Could not upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const pickSignature = async () => {
    setUploadingSignature(true);
    try {
      const url = await pickAndUploadDocumentImage('signature');
      if (url) setSignatureUrl(url);
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Could not upload signature');
    } finally {
      setUploadingSignature(false);
    }
  };

  const saveDrawnSignature = async (dataUrl: string) => {
    setUploadingSignature(true);
    try {
      const url = await uploadSignatureDataUrl(dataUrl);
      setSignatureUrl(url);
      setSignaturePadOpen(false);
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Could not save drawn signature');
    } finally {
      setUploadingSignature(false);
    }
  };

  if (loading) return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />;

  return (
    <ScreenSafeArea edges={['top', 'bottom']} style={adminUi.screen}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ScreenHeader
          eyebrow="PDF branding"
          title="Invoice template"
          subtitle="Logo, colors, and layout for all exported documents"
        />

        <View style={[adminUi.panelHero, styles.previewHero]}>
          <View style={[documentLayout === 'classic' ? styles.previewBar : styles.previewBarLight, documentLayout === 'classic' ? { backgroundColor: previewHeader } : documentLayout === 'accent-line' ? { borderTopWidth: 4, borderTopColor: previewHeader } : null]}>
            <View style={styles.previewHeaderRow}>
              <View style={styles.previewHeaderLeft}>
                {documentLayout === 'sidebar' ? <View style={[styles.previewSidebar, { backgroundColor: previewHeader }]} /> : null}
                <View style={{ flex: 1 }}>
                  {logoPreview ? (
                    <Image source={{ uri: logoPreview }} style={documentLayout === 'classic' ? styles.previewLogo : styles.previewLogoDark} resizeMode="contain" />
                  ) : null}
                  {showCompanyName ? (
                    <Text style={documentLayout === 'classic' ? styles.previewCompany : styles.previewCompanyDark}>{previewName}</Text>
                  ) : null}
                  <Text style={documentLayout === 'classic' ? styles.previewMeta : styles.previewMetaDark}>
                    {email.trim() || storeDefaults.email || 'Add billing email'}
                  </Text>
                </View>
              </View>
              <View style={styles.previewHeaderRight}>
                <Text style={[styles.previewDocBadge, documentLayout === 'classic' ? styles.previewDocBadgeLight : { color: previewAccent }]}>INVOICE</Text>
                <Text style={documentLayout === 'classic' ? styles.previewMeta : styles.previewMetaDark}>INV-0001</Text>
              </View>
            </View>
          </View>
          <View style={[
            styles.previewBody,
            {
              borderColor: previewAccent,
              borderWidth: documentLineWeight === 'bold' ? 2 : documentLineWeight === 'fine' ? 0.5 : 1,
              backgroundColor: pageBackground.trim() || '#F0FDFA',
            },
          ]}>
            <Text style={[styles.previewDocTitle, { color: previewAccent, fontWeight: documentLineWeight === 'bold' ? '900' : documentLineWeight === 'fine' ? '600' : '800' }]}>INVOICE</Text>
            <Text style={styles.previewLine}>Line item preview · USD 0.00</Text>
            {signaturePreview ? (
              <Image source={{ uri: signaturePreview }} style={styles.previewSignature} resizeMode="contain" />
            ) : null}
            {footerNote.trim() ? <Text style={styles.previewFooter}>{footerNote.trim()}</Text> : null}
          </View>
          <TouchableOpacity style={styles.previewBtn} onPress={() => setPreviewOpen(true)}>
            <Text style={styles.previewBtnText}>Preview full invoice PDF</Text>
          </TouchableOpacity>
          <Text style={styles.previewCaption}>Tap preview to compare layouts before saving</Text>
          <Text style={styles.previewDomain}>
            {country.trim() || 'Lebanon'}
          </Text>
          {website.trim() ? (
            <Text style={styles.previewDomainBottom}>
              {website.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '')}
            </Text>
          ) : null}
        </View>

        {nipcoLocked ? (
          <View style={styles.nipcoBox}>
            <Text style={styles.nipcoTitle}>Production template locked</Text>
            <Text style={styles.nipcoText}>
              Nipco invoices use a fixed Grabio template for legal and branding consistency. Settings cannot be
              changed here — contact ecosystem owner Anwar for any update.
            </Text>
          </View>
        ) : null}

        {!nipcoLocked ? (
        <>
        <Section title="Branding">
          <ImageUploadField
            label="Company logo"
            hint="Shown at the top of invoices and PDFs"
            imageUrl={logoUrl}
            uploading={uploadingLogo}
            onPick={() => void pickLogo()}
            onRemove={() => setLogoUrl('')}
            previewStyle="logo"
          />
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Signature</Text>
            <View style={styles.uploadCard}>
              <View style={[styles.uploadPreview, styles.uploadPreviewSignature]}>
                {signaturePreview ? (
                  <Image source={{ uri: signaturePreview }} style={styles.signaturePreviewImg} resizeMode="contain" />
                ) : (
                  <Text style={styles.uploadPlaceholder}>No signature</Text>
                )}
              </View>
              <View style={styles.uploadActions}>
                <TouchableOpacity
                  style={styles.uploadBtn}
                  onPress={() => setSignaturePadOpen(true)}
                  disabled={uploadingSignature}
                >
                  {uploadingSignature ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.uploadBtnText}>Draw on screen</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => void pickSignature()}
                  disabled={uploadingSignature}
                >
                  <Text style={styles.secondaryBtnText}>Upload from gallery</Text>
                </TouchableOpacity>
                {signaturePreview ? (
                  <TouchableOpacity style={styles.removeBtn} onPress={() => setSignatureUrl('')} disabled={uploadingSignature}>
                    <Text style={styles.removeBtnText}>Remove</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
            <Text style={styles.fieldHint}>Draw with your finger or upload an image — shown at the bottom of PDFs</Text>
          </View>
        </Section>

        {!nipcoLocked ? (
          <>
            <Section title="Layout style">
              <Text style={styles.fieldHint}>Pick a document structure — preview updates above and in full PDF preview.</Text>
              <View style={styles.layoutGrid}>
                {LAYOUT_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.layoutCard, documentLayout === opt.value && styles.layoutCardActive]}
                    onPress={() => setDocumentLayout(opt.value)}
                  >
                    <LayoutMiniPreview
                      layout={opt.value}
                      headerColor={primaryColor}
                      accentColor={secondaryColor}
                      lineWeight={documentLineWeight}
                    />
                    <Text style={styles.layoutTitle}>{opt.label}</Text>
                    <Text style={styles.layoutDesc}>{opt.desc}</Text>
                    {documentLayout === opt.value ? <Text style={styles.check}>✓</Text> : null}
                  </TouchableOpacity>
                ))}
              </View>
            </Section>

            <Section title="Line weight">
              <View style={styles.chipRow}>
                {LINE_WEIGHT_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[adminUi.chip, documentLineWeight === opt.value && adminUi.chipActive, { flexGrow: 1, minWidth: '30%' }]}
                    onPress={() => setDocumentLineWeight(opt.value)}
                  >
                    <Text style={[adminUi.chipText, documentLineWeight === opt.value && adminUi.chipTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.fieldHint}>
                {LINE_WEIGHT_OPTIONS.find((o) => o.value === documentLineWeight)?.desc}
              </Text>
            </Section>

            <Section title="Color theme">
              <View style={styles.chipRow}>
                {COLOR_THEMES.map((theme) => (
                  <TouchableOpacity
                    key={theme.label}
                    style={[
                      styles.colorChip,
                      primaryColor === theme.primary && secondaryColor === theme.secondary && styles.colorChipActive,
                    ]}
                    onPress={() => {
                      setPrimaryColor(theme.primary);
                      setSecondaryColor(theme.secondary);
                    }}
                  >
                    <View style={[styles.colorDot, { backgroundColor: theme.primary }]} />
                    <View style={[styles.colorDot, { backgroundColor: theme.secondary }]} />
                    <Text style={styles.colorChipText}>{theme.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.colorRow}>
                <View style={styles.colorField}>
                  <Text style={styles.miniLabel}>Primary</Text>
                  <TextInput style={styles.input} value={primaryColor} onChangeText={setPrimaryColor} autoCapitalize="none" />
                </View>
                <View style={styles.colorField}>
                  <Text style={styles.miniLabel}>Accent</Text>
                  <TextInput style={styles.input} value={secondaryColor} onChangeText={setSecondaryColor} autoCapitalize="none" />
                </View>
              </View>
            </Section>

            <Section title="Page background">
              <Text style={styles.fieldHint}>Light tint behind invoice line items on the A4 PDF (the green area in preview).</Text>
              <View style={styles.chipRow}>
                {PAGE_BG_PRESETS.map((preset) => (
                  <TouchableOpacity
                    key={preset.label}
                    style={[
                      styles.colorChip,
                      pageBackground === preset.value && styles.colorChipActive,
                    ]}
                    onPress={() => setPageBackground(preset.value)}
                  >
                    <View
                      style={[
                        styles.pageBgSwatch,
                        { backgroundColor: preset.value || '#F0FDFA', borderWidth: preset.value ? 0 : 1, borderColor: COLORS.border },
                      ]}
                    />
                    <Text style={styles.colorChipText}>{preset.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Field label="Custom page color" hint="Hex color e.g. #F0FDFA — leave empty for template default">
                <TextInput
                  style={styles.input}
                  value={pageBackground}
                  onChangeText={setPageBackground}
                  placeholder="#F0FDFA"
                  autoCapitalize="none"
                />
              </Field>
            </Section>
          </>
        ) : null}

        <Section title="Company on documents">
          <Field label="Company name" hint={storeDefaults.name ? `Store default: ${storeDefaults.name}` : undefined}>
            <TextInput style={styles.input} value={companyName} onChangeText={setCompanyName} placeholder={storeDefaults.name || 'Company name'} />
            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <Text style={styles.toggleLabel}>Show business name on invoice</Text>
                <Text style={styles.fieldHint}>Turn off if your logo already shows the company name</Text>
              </View>
              <Switch
                value={showCompanyName}
                onValueChange={setShowCompanyName}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
              />
            </View>
          </Field>
          <Field label="Address">
            <TextInput style={[styles.input, styles.multiline]} value={address} onChangeText={setAddress} placeholder={storeDefaults.address || 'Address'} multiline />
          </Field>
          <Field label="Tax ID" hint={storeDefaults.taxId ? `Store default: ${storeDefaults.taxId}` : undefined}>
            <TextInput style={styles.input} value={taxId} onChangeText={setTaxId} placeholder={storeDefaults.taxId || 'Tax ID'} />
          </Field>
          <Field label="Phone">
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+961 …" keyboardType="phone-pad" />
          </Field>
          <Field label="Email" hint={storeDefaults.email ? `Store default: ${storeDefaults.email}` : undefined}>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder={storeDefaults.email || 'Billing email'} autoCapitalize="none" keyboardType="email-address" />
          </Field>
          <Field label="Website" hint="Shown at the bottom of every PDF footer">
            <TextInput style={styles.input} value={website} onChangeText={setWebsite} placeholder="www.yoursite.com" autoCapitalize="none" />
          </Field>
          <Field label="Country on PDF footer" hint="Shown above your website at the bottom of every document">
            <TextInput style={styles.input} value={country} onChangeText={setCountry} placeholder="Lebanon" />
          </Field>
        </Section>

        {!nipcoLocked ? (
          <Section title="Template style">
            {TEMPLATE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.templateCard, invoiceTemplate === opt.value && styles.templateCardActive]}
                onPress={() => {
                  setInvoiceTemplate(opt.value);
                  if (opt.value === 'modern') {
                    setPrimaryColor('#38B2AC');
                    setSecondaryColor('#2C5282');
                  } else if (opt.value === 'basic') {
                    setPrimaryColor('#1A202C');
                    setSecondaryColor('#B7791F');
                  } else {
                    setPrimaryColor('#6B46C1');
                    setSecondaryColor('#DD6B20');
                  }
                }}
              >
                <View style={styles.templateSwatch}>
                  <View style={[styles.swatchBar, { backgroundColor: opt.primary }]} />
                  <View style={[styles.swatchAccent, { backgroundColor: opt.accent }]} />
                </View>
                <View style={styles.templateCopy}>
                  <Text style={styles.templateTitle}>{opt.label}</Text>
                  <Text style={styles.templateDesc}>{opt.desc}</Text>
                </View>
                {invoiceTemplate === opt.value ? <Text style={styles.check}>✓</Text> : null}
              </TouchableOpacity>
            ))}
          </Section>
        ) : null}

        <Section title="Payment terms">
          <Text style={styles.fieldHint}>Unpaid invoices are due this many days after the invoice date.</Text>
          <View style={styles.chipRow}>
            {DUE_DAY_OPTIONS.map((days) => (
              <TouchableOpacity
                key={days}
                style={[adminUi.chip, invoiceDueDays === days && adminUi.chipActive]}
                onPress={() => setInvoiceDueDays(days)}
              >
                <Text style={[adminUi.chipText, invoiceDueDays === days && adminUi.chipTextActive]}>{days} days</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Field label="Custom due days">
            <TextInput
              style={styles.input}
              value={String(invoiceDueDays)}
              onChangeText={(v) => setInvoiceDueDays(Math.max(1, parseInt(v, 10) || DEFAULT_INVOICE_DUE_DAYS))}
              keyboardType="number-pad"
            />
          </Field>
        </Section>

        <Section title="Footer">
          <Field label="Footer note on PDFs" hint="Payment instructions, bank details, thank-you message…">
            <TextInput
              style={[styles.input, styles.multiline]}
              value={footerNote}
              onChangeText={setFooterNote}
              placeholder="e.g. Payment due within 30 days. Bank: …"
              multiline
            />
          </Field>
        </Section>

        <TouchableOpacity style={styles.saveBtn} onPress={() => void save()} disabled={saving}>
          <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save template settings'}</Text>
        </TouchableOpacity>
        </>
        ) : null}
      </ScrollView>

      <TemplatePreviewModal
        visible={previewOpen}
        company={previewCompany}
        onClose={() => setPreviewOpen(false)}
      />
      <SignaturePadModal
        visible={signaturePadOpen}
        saving={uploadingSignature}
        onClose={() => setSignaturePadOpen(false)}
        onSave={(dataUrl) => void saveDrawnSignature(dataUrl)}
      />
    </ScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 32 },
  section: { marginBottom: 8, paddingHorizontal: 16 },
  field: { marginBottom: 14 },
  fieldLabel: { fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6, fontSize: 14 },
  fieldHint: { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
  miniLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted, marginBottom: 4 },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: 12,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  previewHero: { marginHorizontal: 16, marginBottom: 12 },
  previewBar: { borderRadius: RADIUS.lg, padding: 14, marginBottom: 8 },
  previewBarLight: { borderRadius: RADIUS.lg, padding: 14, marginBottom: 8, backgroundColor: '#fff', overflow: 'hidden' },
  previewHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  previewHeaderLeft: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', minWidth: 0 },
  previewHeaderRight: { alignItems: 'flex-end', minWidth: 88 },
  previewDocBadge: { fontWeight: '800', fontSize: 16 },
  previewDocBadgeLight: { color: '#fff' },
  previewLogo: { width: 120, height: 40, marginBottom: 8 },
  previewCompany: { color: '#fff', fontWeight: '800', fontSize: 18 },
  previewMeta: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 4 },
  previewBody: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 14,
    borderWidth: 2,
  },
  previewDocTitle: { fontWeight: '800', fontSize: 16, marginBottom: 8 },
  previewLine: { fontSize: 13, color: COLORS.textSecondary },
  previewFooter: { fontSize: 11, color: COLORS.textMuted, marginTop: 10 },
  previewCaption: { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 8, textAlign: 'center' },
  previewDomain: { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 6, textAlign: 'center' },
  previewDomainBottom: { fontSize: 12, color: 'rgba(255,255,255,0.95)', marginTop: 2, textAlign: 'center', fontWeight: '700' },
  previewBtn: {
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: RADIUS.lg,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  previewBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 12,
    padding: 12,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  toggleCopy: { flex: 1 },
  toggleLabel: { fontWeight: '700', color: COLORS.textPrimary, fontSize: 14 },
  previewSidebar: { width: 6, borderRadius: 3, marginRight: 10 },
  previewLogoDark: { width: 100, height: 32, marginBottom: 6 },
  previewCompanyDark: { color: COLORS.textPrimary, fontWeight: '800', fontSize: 18, flex: 1 },
  previewMetaDark: { color: COLORS.textMuted, fontSize: 12, marginTop: 4, flex: 1 },
  layoutGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  layoutCard: {
    width: '47%',
    padding: 10,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    minHeight: 130,
  },
  layoutCardActive: { borderColor: COLORS.primary, backgroundColor: '#E6FFFA' },
  layoutTitle: { fontWeight: '800', color: COLORS.textPrimary, marginTop: 8, fontSize: 13 },
  layoutDesc: { fontSize: 11, color: COLORS.textMuted, marginTop: 2, lineHeight: 15 },
  nipcoBox: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: RADIUS.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  nipcoTitle: { fontWeight: '700', color: '#1E40AF' },
  nipcoText: { color: '#1E3A8A', marginTop: 4, fontSize: 13 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  colorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  colorChipActive: { borderColor: COLORS.primary, backgroundColor: '#E6FFFA' },
  colorDot: { width: 12, height: 12, borderRadius: 6 },
  colorChipText: { fontSize: 11, fontWeight: '600', color: COLORS.textPrimary, marginLeft: 4 },
  pageBgSwatch: { width: 18, height: 18, borderRadius: 4, marginRight: 4 },
  colorRow: { flexDirection: 'row', gap: 10 },
  colorField: { flex: 1 },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    marginBottom: 8,
  },
  templateCardActive: { borderColor: COLORS.primary, backgroundColor: '#E6FFFA' },
  templateSwatch: { width: 44, height: 44, borderRadius: 8, overflow: 'hidden' },
  swatchBar: { flex: 2 },
  swatchAccent: { flex: 1 },
  templateCopy: { flex: 1 },
  templateTitle: { fontWeight: '800', color: COLORS.textPrimary },
  templateDesc: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  check: { fontSize: 18, color: COLORS.primary, fontWeight: '800' },
  saveBtn: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    padding: 16,
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  uploadCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.background,
    padding: 12,
    gap: 12,
  },
  uploadPreview: {
    height: 88,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  uploadPreviewSignature: { height: 72 },
  uploadPlaceholder: { fontSize: 12, color: COLORS.textMuted },
  logoPreviewImg: { width: '100%', height: '100%' },
  signaturePreviewImg: { width: '100%', height: '100%' },
  uploadActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  uploadBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: 160,
    alignItems: 'center',
  },
  uploadBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  secondaryBtn: {
    borderRadius: RADIUS.lg,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surface,
    minWidth: 160,
    alignItems: 'center',
  },
  secondaryBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 14 },
  removeBtn: {
    borderRadius: RADIUS.lg,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  removeBtnText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: 14 },
  previewSignature: { width: 120, height: 40, alignSelf: 'flex-end', marginTop: 10 },
});
