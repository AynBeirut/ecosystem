import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { googleMapsUrl } from '../lib/crmMapUtils';
import { COLORS, RADIUS } from '../theme';

type Props = {
  lat: number;
  lng: number;
  label?: string;
  subtitle?: string;
  height?: number;
};

/** Native map card — opens Google Maps app; no WebView. */
export default function NativeMapPreview({ lat, lng, label, subtitle, height = 140 }: Props) {
  const openMaps = () => void Linking.openURL(googleMapsUrl(lat, lng));
  return (
    <TouchableOpacity style={[styles.wrap, { minHeight: height }]} onPress={openMaps} activeOpacity={0.85}>
      <View style={styles.pinCircle}>
        <Text style={styles.pinIcon}>📍</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{label || 'Location'}</Text>
        {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
        <Text style={styles.coords}>{lat.toFixed(5)}, {lng.toFixed(5)}</Text>
        <Text style={styles.cta}>Open in Google Maps ↗</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#e0f2fe',
    borderRadius: RADIUS.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  pinCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinIcon: { fontSize: 26 },
  body: { flex: 1 },
  title: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
  sub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  coords: { fontSize: 12, color: COLORS.textMuted, marginTop: 4, fontVariant: ['tabular-nums'] },
  cta: { fontSize: 13, fontWeight: '700', color: COLORS.primary, marginTop: 8 },
});
