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
import { COLORS, RADIUS } from '../theme';

type TimeValue = { hour: number; minute: number };

type Props = {
  label: string;
  value: TimeValue | null;
  onChange: (time: TimeValue | null) => void;
  placeholder?: string;
};

function formatTime(value: TimeValue): string {
  return `${String(value.hour).padStart(2, '0')}:${String(value.minute).padStart(2, '0')}`;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

export default function TimePickerField({
  label,
  value,
  onChange,
  placeholder = 'Select time…',
}: Props) {
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState<TimeValue>(value || { hour: 9, minute: 0 });

  const openPicker = () => {
    setTemp(value || { hour: 9, minute: 0 });
    setOpen(true);
  };

  const confirm = () => {
    onChange(temp);
    setOpen(false);
  };

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.btn} onPress={openPicker}>
        <Text style={[styles.btnText, !value && styles.placeholder]}>
          {value ? `🕐 ${formatTime(value)}` : `🕐 ${placeholder}`}
        </Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.box} onPress={() => {}}>
            <Text style={styles.title}>Select time</Text>
            <View style={styles.wheels}>
              <View style={styles.col}>
                <Text style={styles.colLabel}>Hour</Text>
                <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                  {HOURS.map((hour) => (
                    <TouchableOpacity
                      key={hour}
                      style={[styles.cell, temp.hour === hour && styles.cellActive]}
                      onPress={() => setTemp({ ...temp, hour })}
                    >
                      <Text style={[styles.cellText, temp.hour === hour && styles.cellTextActive]}>
                        {String(hour).padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.col}>
                <Text style={styles.colLabel}>Min</Text>
                <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                  {MINUTES.map((minute) => (
                    <TouchableOpacity
                      key={minute}
                      style={[styles.cell, temp.minute === minute && styles.cellActive]}
                      onPress={() => setTemp({ ...temp, minute })}
                    >
                      <Text style={[styles.cellText, temp.minute === minute && styles.cellTextActive]}>
                        {String(minute).padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.actionBtn, styles.cancelBtn]} onPress={() => setOpen(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.confirmBtn]} onPress={confirm}>
                <Text style={styles.confirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 6, color: COLORS.textSecondary },
  btn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: 14,
    backgroundColor: COLORS.surface,
    minHeight: 48,
    justifyContent: 'center',
  },
  btnText: { fontSize: 16, color: COLORS.textPrimary },
  placeholder: { color: COLORS.textMuted },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  box: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 28,
  },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 12, color: COLORS.textPrimary },
  wheels: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  col: { flex: 1, alignItems: 'center', maxWidth: 120 },
  colLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted, marginBottom: 6 },
  scroll: { maxHeight: 180 },
  cell: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, marginVertical: 2 },
  cellActive: { backgroundColor: COLORS.primary },
  cellText: { fontSize: 15, color: COLORS.textPrimary, textAlign: 'center' },
  cellTextActive: { color: '#fff', fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  actionBtn: { flex: 1, paddingVertical: 14, borderRadius: RADIUS.md, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#f3f4f6' },
  confirmBtn: { backgroundColor: COLORS.primary, flex: 2 },
  cancelText: { color: COLORS.textSecondary, fontWeight: '700' },
  confirmText: { color: '#fff', fontWeight: '700' },
});
