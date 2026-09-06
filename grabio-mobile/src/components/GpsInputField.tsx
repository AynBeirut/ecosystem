import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { captureVisitGps } from '../lib/geolocation';
import { COLORS, RADIUS } from '../theme';

export type GpsValue = { lat: number; lng: number; accuracy?: number } | null;

type Props = {
  value: GpsValue;
  onChange: (next: GpsValue) => void;
};

function parseCoord(raw: string): number | null {
  const n = Number(raw.trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export default function GpsInputField({ value, onChange }: Props) {
  const [latText, setLatText] = useState('');
  const [lngText, setLngText] = useState('');
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    if (value?.lat != null && value?.lng != null) {
      setLatText(String(value.lat));
      setLngText(String(value.lng));
    }
  }, [value?.lat, value?.lng]);

  const applyManual = () => {
    const lat = parseCoord(latText);
    const lng = parseCoord(lngText);
    if (lat == null || lng == null || lat < -90 || lat > 90 || lng < -180 || lng > 180) return;
    onChange({ lat, lng });
  };

  const capture = async () => {
    setCapturing(true);
    try {
      const coords = await captureVisitGps(true);
      if (coords) onChange(coords);
    } finally {
      setCapturing(false);
    }
  };

  return (
    <View style={styles.box}>
      <Text style={styles.title}>GPS coordinates</Text>
      <Text style={styles.hint}>Paste from Google Maps (e.g. 33.8886, 35.4955) or capture now.</Text>
      <View style={styles.row}>
        <View style={styles.field}>
          <Text style={styles.label}>Latitude</Text>
          <TextInput
            style={styles.input}
            value={latText}
            onChangeText={setLatText}
            onBlur={applyManual}
            placeholder="33.56"
            keyboardType="decimal-pad"
            placeholderTextColor={COLORS.textMuted}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Longitude</Text>
          <TextInput
            style={styles.input}
            value={lngText}
            onChangeText={setLngText}
            onBlur={applyManual}
            placeholder="35.377"
            keyboardType="decimal-pad"
            placeholderTextColor={COLORS.textMuted}
          />
        </View>
      </View>
      <TouchableOpacity style={[styles.btn, capturing && styles.btnDisabled]} onPress={() => void capture()} disabled={capturing}>
        {capturing ? (
          <ActivityIndicator color={COLORS.primary} />
        ) : (
          <Text style={styles.btnText}>📍 Capture GPS now</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 12, marginTop: 8 },
  title: { fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  hint: { fontSize: 12, color: COLORS.textMuted, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 10 },
  field: { flex: 1 },
  label: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: 10,
    backgroundColor: COLORS.surface,
    color: COLORS.textPrimary,
  },
  btn: { marginTop: 10, padding: 12, backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: COLORS.primary, fontWeight: '700' },
});
