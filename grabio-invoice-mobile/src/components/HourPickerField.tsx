import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { HOUR_OPTIONS, hourLabel } from '../lib/serviceTaskSchedule';
import { COLORS, RADIUS } from '../theme';

type Props = {
  label?: string;
  value: number;
  onChange: (hour: number) => void;
};

export default function HourPickerField({ label = 'Time', value, onChange }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TouchableOpacity style={styles.btn} onPress={() => setOpen(true)}>
        <Text style={styles.icon}>🕘</Text>
        <Text style={styles.btnText}>{hourLabel(value)}</Text>
        <Text style={styles.chevron}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.box} onPress={() => {}}>
            <Text style={styles.title}>Pick time</Text>
            <Text style={styles.sub}>Reminder 1 hour before</Text>
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {HOUR_OPTIONS.map((hour) => (
                <TouchableOpacity
                  key={hour.value}
                  style={[styles.row, value === hour.value && styles.rowActive]}
                  onPress={() => {
                    onChange(hour.value);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.rowText, value === hour.value && styles.rowTextActive]}>
                    {hour.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.cancel} onPress={() => setOpen(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, color: COLORS.textSecondary },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: 14,
    backgroundColor: COLORS.surface,
    minHeight: 48,
  },
  icon: { fontSize: 18, marginRight: 10 },
  btnText: { flex: 1, fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
  chevron: { fontSize: 14, color: COLORS.textMuted, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  box: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 28,
    maxHeight: '70%',
  },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  sub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4, marginBottom: 12 },
  list: { maxHeight: 320 },
  row: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: RADIUS.md, marginBottom: 4 },
  rowActive: { backgroundColor: COLORS.primaryLight },
  rowText: { fontSize: 16, color: COLORS.textPrimary },
  rowTextActive: { color: COLORS.secondary, fontWeight: '700' },
  cancel: { marginTop: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: RADIUS.md },
  cancelText: { fontWeight: '700', color: COLORS.textSecondary },
});
