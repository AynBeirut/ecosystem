import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';
import ScreenSafeArea from '../../components/ScreenSafeArea';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { fetchStoreProfile, saveDocumentTemplateSettings } from '../../lib/financeService';
import { TEMPLATE_PREVIEW_DOC, buildFinanceDocumentHtml } from '../../lib/documentPdfHtml';
import { FONT_SCALE_OPTIONS, PDF_LAYOUT_TEMPLATES } from '../../../../src/lib/invoiceDocumentSetupConfig';

type Align = 'left' | 'center' | 'right';
type Tab = 'templates' | 'size' | 'border' | 'header';

const NAVY = '#1C2333';
const BLUE = '#3B82F6';
const CANVAS = '#F3F4F6';
const SCALES = FONT_SCALE_OPTIONS;

function hslToHex(h: number, s = 72, l = 46): string {
  const sat = s / 100;
  const light = l / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = light - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const hex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`.toUpperCase();
}

function hexToHue(hex: string): number {
  const raw = hex.replace('#', '');
  if (raw.length < 6) return 200;
  const r = parseInt(raw.slice(0, 2), 16) / 255;
  const g = parseInt(raw.slice(2, 4), 16) / 255;
  const b = parseInt(raw.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let hue = 0;
  if (max === r) hue = ((g - b) / d) % 6;
  else if (max === g) hue = (b - r) / d + 2;
  else hue = (r - g) / d + 4;
  hue *= 60;
  return Math.round(hue < 0 ? hue + 360 : hue);
}

const PAGE_W = 794;
const PAGE_H = 1123;
const THUMB_W = 56;
const THUMB_H = Math.round((THUMB_W * PAGE_H) / PAGE_W);

function PagePreview({ html, frameWidth, frameHeight }: { html: string; frameWidth: number; frameHeight: number }) {
  const scale = frameWidth / PAGE_W;
  return (
    <View collapsable={false} style={{ width: frameWidth, height: frameHeight, overflow: 'hidden', backgroundColor: '#fff' }}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={{
          width: PAGE_W,
          height: PAGE_H,
          backgroundColor: '#fff',
          opacity: 0.99,
          transform: [{ scale }],
          transformOrigin: 'left top',
        }}
        scrollEnabled={false}
        scalesPageToFit={false}
        showsVerticalScrollIndicator={false}
        setBuiltInZoomControls={false}
        androidLayerType="hardware"
        pointerEvents="none"
      />
    </View>
  );
}

function DocIcon({ color }: { color: string }) {
  return (
    <View style={[styles.docIcon, { borderColor: color }]}>
      <View style={[styles.docLine, { backgroundColor: color, width: 12 }]} />
      <View style={[styles.docLine, { backgroundColor: color, width: 14, opacity: 0.7 }]} />
      <View style={[styles.docLine, { backgroundColor: color, width: 9, opacity: 0.7 }]} />
    </View>
  );
}

function BorderIcon({ color }: { color: string }) {
  return (
    <View style={[styles.borderIcon, { borderColor: color }]}>
      <View style={[styles.borderIconInner, { borderColor: color }]} />
    </View>
  );
}

function HeaderIcon({ color }: { color: string }) {
  return (
    <View style={[styles.headerIcon, { borderColor: color }]}>
      <View style={[styles.headerIconBar, { backgroundColor: color }]} />
    </View>
  );
}

function AlignIcon({ align, color }: { align: Align; color: string }) {
  const widths = align === 'center' ? [14, 10, 14] : align === 'right' ? [10, 14, 8] : [14, 10, 12];
  return (
    <View style={styles.alignIcon}>
      {widths.map((width, index) => (
        <View
          key={index}
          style={{
            height: 2,
            width,
            borderRadius: 1,
            backgroundColor: color,
            alignSelf: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
          }}
        />
      ))}
    </View>
  );
}

function TrackSlider({
  value,
  max,
  onChange,
  rainbow,
  knobColor,
}: {
  value: number;
  max: number;
  onChange: (value: number) => void;
  rainbow?: boolean;
  knobColor?: string;
}) {
  const [width, setWidth] = useState(1);
  const setFromX = (x: number) => {
    const ratio = Math.max(0, Math.min(1, x / Math.max(width, 1)));
    onChange(Math.round(ratio * max));
  };
  const left = (value / Math.max(max, 1)) * Math.max(width - 26, 0);
  return (
    <View
      style={styles.trackHit}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(event) => setFromX(event.nativeEvent.locationX)}
      onResponderMove={(event) => setFromX(event.nativeEvent.locationX)}
    >
      <View style={[styles.track, rainbow ? styles.trackRainbow : null]}>
        {rainbow
          ? Array.from({ length: 20 }, (_, index) => (
              <View key={index} style={{ flex: 1, backgroundColor: hslToHex((index / 19) * 340) }} />
            ))
          : null}
      </View>
      <View style={[styles.knob, { left, backgroundColor: rainbow ? knobColor || '#fff' : '#fff' }]} />
    </View>
  );
}

export default function InvoiceTemplateScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [tab, setTab] = useState<Tab>('templates');
  const [templateNumber, setTemplateNumber] = useState(2);
  const [colorMode, setColorMode] = useState<'colored' | 'bw'>('colored');
  const [fontScale, setFontScale] = useState('m');
  const [borderColor, setBorderColor] = useState('#3182CE');
  const [headerSpace, setHeaderSpace] = useState(16);
  const [orgAlign, setOrgAlign] = useState<Align>('left');
  const [logoAlign, setLogoAlign] = useState<Align>('left');
  const [primaryColor, setPrimaryColor] = useState('#3182CE');
  const [hue, setHue] = useState(200);
  const [borderHue, setBorderHue] = useState(200);
  const [showCompany, setShowCompany] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyTaxId, setCompanyTaxId] = useState('');
  const [showColor, setShowColor] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      title: 'Invoice template',
      headerTintColor: '#111827',
      headerStyle: { backgroundColor: '#FFFFFF' },
      headerTitleStyle: { fontWeight: '600', color: '#111827', fontSize: 17 },
    });
  }, [navigation]);

  useEffect(() => {
    if (!user?.storeId) return;
    void fetchStoreProfile(user.storeId).then((data) => {
      const doc = (data?.financeDocumentSettings ?? {}) as Record<string, unknown>;
      setProfile((data as Record<string, unknown>) || null);
      const n = Number(doc.documentTemplateNumber);
      if (n >= 1 && n <= 10) setTemplateNumber(n);
      if (doc.documentColorMode === 'bw') setColorMode('bw');
      if (typeof doc.documentFontScale === 'string') setFontScale(doc.documentFontScale);
      if (typeof doc.documentBorderColor === 'string' && doc.documentBorderColor) {
        setBorderColor(doc.documentBorderColor);
        setBorderHue(hexToHue(doc.documentBorderColor));
      }
      if (typeof doc.documentHeaderSpace === 'number') setHeaderSpace(doc.documentHeaderSpace);
      if (doc.documentOrgAlign === 'center' || doc.documentOrgAlign === 'right') setOrgAlign(doc.documentOrgAlign);
      if (doc.documentLogoAlign === 'center' || doc.documentLogoAlign === 'right') setLogoAlign(doc.documentLogoAlign);
      if (typeof doc.primaryColor === 'string' && doc.primaryColor) {
        setPrimaryColor(doc.primaryColor);
        setHue(hexToHue(doc.primaryColor));
      }
      setCompanyName(String(doc.documentCompanyName || data?.name || ''));
      setCompanyPhone(String(doc.documentPhone || data?.phone || ''));
      setCompanyEmail(String(doc.documentEmail || data?.email || ''));
      setCompanyAddress(String(doc.documentAddress || data?.location || ''));
      setCompanyTaxId(String(doc.documentTaxId || data?.taxNumber || ''));
      setLoading(false);
    });
  }, [user?.storeId]);

  const settings = useMemo(
    () => ({
      documentColorMode: colorMode,
      documentFontScale: fontScale,
      documentBorderColor: borderColor,
      documentHeaderSpace: headerSpace,
      documentOrgAlign: orgAlign,
      documentLogoAlign: logoAlign,
      primaryColor,
      documentCompanyName: companyName,
      documentPhone: companyPhone,
      documentEmail: companyEmail,
      documentAddress: companyAddress,
      documentTaxId: companyTaxId,
    }),
    [colorMode, fontScale, borderColor, headerSpace, orgAlign, logoAlign, primaryColor, companyName, companyPhone, companyEmail, companyAddress, companyTaxId],
  );

  const previewHtml = useMemo(() => {
    const baseSettings = (profile?.financeDocumentSettings ?? {}) as Record<string, unknown>;
    return buildFinanceDocumentHtml('invoice', TEMPLATE_PREVIEW_DOC, {
      ...(profile || {}),
      financeDocumentSettings: { ...baseSettings, ...settings, documentTemplateNumber: templateNumber },
    });
  }, [profile, settings, templateNumber]);

  const thumbPages = useMemo(() => {
    const baseSettings = (profile?.financeDocumentSettings ?? {}) as Record<string, unknown>;
    return PDF_LAYOUT_TEMPLATES.map((tpl) => ({
      id: tpl.id,
      html: buildFinanceDocumentHtml('invoice', TEMPLATE_PREVIEW_DOC, {
        ...(profile || {}),
        financeDocumentSettings: { ...baseSettings, ...settings, documentTemplateNumber: tpl.id },
      }),
    }));
  }, [profile, settings]);

  const useThis = async () => {
    if (!user?.storeId) return;
    setSaving(true);
    try {
      await saveDocumentTemplateSettings(user.storeId, {
        documentTemplateNumber: templateNumber,
        ...settings,
      });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Could not save the template');
    } finally {
      setSaving(false);
    }
  };

  const setAccent = (nextHue: number) => {
    setHue(nextHue);
    setPrimaryColor(hslToHex(nextHue));
  };

  const setBorder = (nextHue: number) => {
    setBorderHue(nextHue);
    setBorderColor(hslToHex(nextHue));
  };

  if (loading) {
    return <ActivityIndicator size="large" color={NAVY} style={{ marginTop: 48 }} />;
  }

  const fontIndex = Math.max(0, SCALES.indexOf(fontScale as (typeof SCALES)[number]));

  return (
    <ScreenSafeArea edges={['top', 'bottom']} style={styles.screen}>
      <View style={styles.tabs}>
        {(
          [
            { id: 'templates' as const, label: 'Templates', icon: <DocIcon color={tab === 'templates' ? BLUE : '#9CA3AF'} /> },
            { id: 'size' as const, label: 'Overall size', icon: <Text style={[styles.tt, tab === 'size' && styles.ttOn]}>Tt</Text> },
            { id: 'border' as const, label: 'Border', icon: <BorderIcon color={tab === 'border' ? BLUE : '#9CA3AF'} /> },
            { id: 'header' as const, label: 'Header', icon: <HeaderIcon color={tab === 'header' ? BLUE : '#9CA3AF'} /> },
          ]
        ).map((item) => (
          <TouchableOpacity key={item.id} style={styles.tab} onPress={() => setTab(item.id)}>
            <View style={[styles.tabIcon, tab === item.id && styles.tabIconOn]}>{item.icon}</View>
            <Text style={[styles.tabLabel, tab === item.id && styles.tabLabelOn]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.stage}>
        <View style={[styles.paper, { width: width - 20 }]}>
          <WebView
            originWhitelist={['*']}
            source={{ html: previewHtml }}
            style={styles.previewWeb}
            scalesPageToFit
            showsVerticalScrollIndicator={false}
            setBuiltInZoomControls={false}
          />
        </View>
      </View>

      <View style={styles.sheet}>
        {tab === 'templates' ? (
          <>
            <TouchableOpacity style={styles.companyBtn} onPress={() => setShowCompany((open) => !open)}>
              <Text style={styles.companyBtnText}>{showCompany ? 'Back to templates' : 'Company details'}</Text>
            </TouchableOpacity>
            {showCompany ? (
              <View style={styles.companyFields}>
                <TextInput style={styles.companyInput} placeholder="Company name" placeholderTextColor="#9CA3AF" value={companyName} onChangeText={setCompanyName} />
                <TextInput style={styles.companyInput} placeholder="Phone" placeholderTextColor="#9CA3AF" value={companyPhone} onChangeText={setCompanyPhone} />
                <TextInput style={styles.companyInput} placeholder="Email" placeholderTextColor="#9CA3AF" value={companyEmail} onChangeText={setCompanyEmail} autoCapitalize="none" />
                <TextInput style={styles.companyInput} placeholder="Address" placeholderTextColor="#9CA3AF" value={companyAddress} onChangeText={setCompanyAddress} />
                <TextInput style={styles.companyInput} placeholder="Tax ID" placeholderTextColor="#9CA3AF" value={companyTaxId} onChangeText={setCompanyTaxId} />
              </View>
            ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbRow}>
              {thumbPages.map((tpl) => {
                const selected = templateNumber === tpl.id;
                return (
                  <TouchableOpacity key={tpl.id} style={styles.thumbWrap} onPress={() => setTemplateNumber(tpl.id)}>
                    <View style={[styles.thumbFrame, selected && styles.thumbOn]}>
                      <PagePreview html={tpl.html} frameWidth={THUMB_W - 4} frameHeight={THUMB_H - 4} />
                    </View>
                    <Text style={[styles.thumbNum, selected && styles.thumbNumOn]}>{tpl.id}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            )}
            {showCompany ? null : (
            <>
            <View style={styles.colorRow}>
              <Text style={styles.colorLabel}>Select color</Text>
              <View style={styles.colorTools}>
                <TouchableOpacity style={styles.tool} onPress={() => setShowColor((open) => !open)}>
                  <View style={[styles.toolCircle, { backgroundColor: primaryColor }]}>
                    <View style={styles.pencil} />
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.tool} onPress={() => setColorMode('colored')}>
                  <View style={[styles.toolCircle, styles.toolWhite, colorMode === 'colored' && styles.toolOn]}>
                    <View style={styles.palette}>
                      <View style={[styles.dot, { backgroundColor: '#F97316' }]} />
                      <View style={[styles.dot, { backgroundColor: '#3B82F6' }]} />
                      <View style={[styles.dot, { backgroundColor: '#22C55E' }]} />
                    </View>
                  </View>
                  <Text style={styles.toolCaption}>colored</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.tool} onPress={() => setColorMode('bw')}>
                  <View style={[styles.toolCircle, styles.bwCircle, colorMode === 'bw' && styles.toolOn]}>
                    <View style={styles.bwLeft} />
                    <View style={styles.bwRight} />
                  </View>
                  <Text style={styles.toolCaption}>B/W</Text>
                </TouchableOpacity>
              </View>
            </View>
            {showColor ? <TrackSlider value={hue} max={340} rainbow knobColor={primaryColor} onChange={setAccent} /> : null}
            </>
            )}
          </>
        ) : null}

        {tab === 'size' ? (
          <>
            <Text style={styles.sheetTitle}>Overall font size</Text>
            <TrackSlider
              value={fontIndex}
              max={SCALES.length - 1}
              onChange={(index) => setFontScale(SCALES[index] || 'm')}
            />
            <View style={styles.scaleLabels}>
              {SCALES.map((size) => (
                <Text key={size} style={[styles.scaleLabel, fontScale === size && styles.scaleLabelOn]}>
                  {size.toUpperCase()}
                </Text>
              ))}
            </View>
          </>
        ) : null}

        {tab === 'border' ? (
          <>
            <Text style={styles.sheetTitle}>Border color</Text>
            <TrackSlider value={borderHue} max={340} rainbow knobColor={borderColor} onChange={setBorder} />
          </>
        ) : null}

        {tab === 'header' ? (
          <>
            <Text style={styles.sheetTitle}>Space from top</Text>
            <TrackSlider value={headerSpace} max={64} onChange={setHeaderSpace} />
            <View style={styles.alignRow}>
              <View style={styles.alignGroup}>
                <Text style={styles.alignTitle}>Organization details</Text>
                <View style={styles.alignButtons}>
                  {(['left', 'center', 'right'] as const).map((align) => (
                    <TouchableOpacity
                      key={align}
                      style={[styles.alignBtn, orgAlign === align && styles.alignBtnOn]}
                      onPress={() => setOrgAlign(align)}
                    >
                      <AlignIcon align={align} color={orgAlign === align ? BLUE : '#6B7280'} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.alignGroup}>
                <Text style={styles.alignTitle}>Logo</Text>
                <View style={styles.alignButtons}>
                  {(['left', 'center', 'right'] as const).map((align) => (
                    <TouchableOpacity
                      key={align}
                      style={[styles.alignBtn, logoAlign === align && styles.alignBtnOn]}
                      onPress={() => setLogoAlign(align)}
                    >
                      <AlignIcon align={align} color={logoAlign === align ? BLUE : '#6B7280'} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </>
        ) : null}

        <View style={styles.actions}>
          {tab === 'templates' ? (
            <>
              <TouchableOpacity style={styles.cancel} onPress={() => navigation.goBack()}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.use} onPress={() => void useThis()} disabled={saving}>
                <Text style={styles.useText}>{saving ? 'Saving…' : 'Use This'}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.cancel}
                onPress={() => {
                  if (tab === 'size') setFontScale('m');
                  if (tab === 'border') setBorder(200);
                  if (tab === 'header') {
                    setHeaderSpace(16);
                    setOrgAlign('left');
                    setLogoAlign('left');
                  }
                }}
              >
                <Text style={styles.cancelText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.use} onPress={() => setTab('templates')}>
                <Text style={styles.useText}>Done</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </ScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: CANVAS },
  tabs: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 6,
    paddingBottom: 4,
    paddingHorizontal: 8,
    backgroundColor: '#fff',
  },
  tab: { alignItems: 'center', width: 78 },
  tabIcon: {
    width: 54,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconOn: { backgroundColor: '#E8F1FF' },
  tabLabel: { marginTop: 4, fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  tabLabelOn: { color: BLUE, fontWeight: '600' },
  tt: { fontSize: 18, fontWeight: '500', color: '#9CA3AF' },
  ttOn: { color: BLUE },
  docIcon: { width: 18, height: 22, borderWidth: 1.5, borderRadius: 3, paddingTop: 4, paddingLeft: 2, gap: 2 },
  docLine: { height: 1.5, borderRadius: 1 },
  borderIcon: { width: 20, height: 20, borderWidth: 1.5, borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
  borderIconInner: { width: 10, height: 10, borderWidth: 1.5 },
  headerIcon: { width: 22, height: 16, borderWidth: 1.5, borderRadius: 2, overflow: 'hidden' },
  headerIconBar: { height: 5 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  paper: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 2,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  previewWeb: { flex: 1, backgroundColor: '#fff' },
  sheet: { backgroundColor: CANVAS, paddingHorizontal: 16, paddingTop: 2, paddingBottom: 4, gap: 4 },
  thumbRow: { gap: 10, paddingVertical: 4, paddingHorizontal: 2 },
  thumbWrap: { width: THUMB_W + 8, alignItems: 'center' },
  thumbFrame: {
    width: THUMB_W,
    height: THUMB_H,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  thumbOn: { borderColor: BLUE, borderWidth: 2 },
  thumbWeb: { width: 74, height: 96, backgroundColor: '#fff' },
  mini: { flex: 1, backgroundColor: '#fff', padding: 4, overflow: 'hidden' },
  companyBtn: { alignSelf: 'flex-start', paddingVertical: 4 },
  companyBtnText: { color: BLUE, fontWeight: '700', fontSize: 14 },
  companyFields: { gap: 8 },
  companyInput: {
    backgroundColor: '#fff',
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  thumbNum: { marginTop: 6, fontSize: 13, color: '#6B7280', fontWeight: '500' },
  thumbNumOn: { color: BLUE, fontWeight: '700' },
  colorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  colorLabel: { fontSize: 14, color: '#4B5563', fontWeight: '500' },
  colorTools: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  tool: { alignItems: 'center', width: 58 },
  toolCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  toolWhite: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  toolOn: { borderWidth: 2, borderColor: BLUE },
  toolCaption: { marginTop: 4, fontSize: 11, color: '#6B7280' },
  pencil: {
    width: 14,
    height: 3,
    borderRadius: 1,
    backgroundColor: '#fff',
    transform: [{ rotate: '-40deg' }],
  },
  palette: { flexDirection: 'row', gap: 3 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  bwCircle: { flexDirection: 'row', borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#fff' },
  bwLeft: { flex: 1, alignSelf: 'stretch', backgroundColor: '#111827' },
  bwRight: { flex: 1, alignSelf: 'stretch', backgroundColor: '#fff' },
  sheetTitle: { fontSize: 15, fontWeight: '600', color: '#111827', textAlign: 'center' },
  trackHit: { height: 36, justifyContent: 'center' },
  track: { height: 8, borderRadius: 4, backgroundColor: '#E5E7EB', overflow: 'hidden', flexDirection: 'row' },
  trackRainbow: { backgroundColor: 'transparent' },
  knob: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  scaleLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 },
  scaleLabel: { fontSize: 12, color: '#9CA3AF', fontWeight: '600', width: 28, textAlign: 'center' },
  scaleLabelOn: { color: NAVY },
  alignRow: { flexDirection: 'row', gap: 16 },
  alignGroup: { flex: 1, gap: 8 },
  alignTitle: { fontSize: 13, fontWeight: '600', color: '#374151' },
  alignButtons: { flexDirection: 'row', gap: 8 },
  alignBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  alignBtnOn: { backgroundColor: '#E8F1FF', borderColor: BLUE },
  alignIcon: { width: 16, height: 12, justifyContent: 'space-between' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 2 },
  cancel: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: { fontWeight: '600', color: '#111827', fontSize: 16 },
  use: { flex: 1, backgroundColor: NAVY, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  useText: { fontWeight: '600', color: '#fff', fontSize: 16 },
});
