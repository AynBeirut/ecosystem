import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { fetchStoreProfile } from '../lib/financeService';
import { activeStorePaymentMethods, type StorePaymentChoice } from '../lib/storePaymentMethods';
import { COLORS, RADIUS } from '../theme';

type Props = {
  storeId: string;
  value: string;
  onChange: (id: string) => void;
};

export default function PaymentMethodChips({ storeId, value, onChange }: Props) {
  const [methods, setMethods] = useState<StorePaymentChoice[]>([
    { id: 'cash', label: 'Cash' },
    { id: 'bank', label: 'Bank' },
    { id: 'card', label: 'Card' },
    { id: 'omt', label: 'OMT' },
  ]);

  useEffect(() => {
    let alive = true;
    void fetchStoreProfile(storeId).then((profile) => {
      if (!alive) return;
      setMethods(activeStorePaymentMethods((profile as Record<string, unknown>) || null));
    });
    return () => {
      alive = false;
    };
  }, [storeId]);

  useEffect(() => {
    if (value && methods.length && !methods.some((method) => method.id === value) && methods[0]) {
      onChange(methods[0].id);
    }
  }, [methods, value, onChange]);

  const choices = methods.some((method) => method.id === value) || !value
    ? methods
    : [...methods, { id: value, label: value }];

  return (
    <View style={styles.row}>
      {choices.map((method) => {
        const selected = value === method.id;
        return (
          <TouchableOpacity key={method.id} style={[styles.chip, selected && styles.chipOn]} onPress={() => onChange(method.id)}>
            <Text style={[styles.text, selected && styles.textOn]}>{method.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  chipOn: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  text: { fontSize: 13, color: COLORS.textPrimary, fontWeight: '600' },
  textOn: { color: COLORS.secondary },
});
