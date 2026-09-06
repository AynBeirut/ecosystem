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

type Props = {
  label: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  required?: boolean;
  placeholder?: string;
  minimumDate?: Date;
};

function formatDisplay(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return d;
}

export default function DatePickerField({
  label,
  value,
  onChange,
  required,
  placeholder = 'Select date…',
  minimumDate,
}: Props) {
  const [open, setOpen] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(value || minimumDate || new Date());

  const min = minimumDate ? startOfDay(minimumDate) : null;

  const openPicker = () => {
    const initial = value || minimumDate || new Date();
    setTempDate(startOfDay(initial));
    setOpen(true);
  };

  const confirm = () => {
    if (min && startOfDay(tempDate).getTime() < min.getTime()) {
      onChange(new Date(min));
    } else {
      onChange(startOfDay(tempDate));
    }
    setOpen(false);
  };

  const years = Array.from({ length: 5 }, (_, i) => (minimumDate || new Date()).getFullYear() + i);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <View>
      <Text style={styles.label}>
        {label}
        {required ? ' *' : ''}
      </Text>
      <TouchableOpacity style={styles.btn} onPress={openPicker}>
        <Text style={[styles.btnText, !value && styles.placeholder]}>
          {value ? `📅 ${formatDisplay(value)}` : `📅 ${placeholder}`}
        </Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.box} onPress={() => {}}>
            <Text style={styles.title}>Select date</Text>
            <View style={styles.wheels}>
              <View style={styles.col}>
                <Text style={styles.colLabel}>Day</Text>
                <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <TouchableOpacity
                      key={day}
                      style={[styles.cell, tempDate.getDate() === day && styles.cellActive]}
                      onPress={() => {
                        const next = new Date(tempDate);
                        next.setDate(day);
                        setTempDate(startOfDay(next));
                      }}
                    >
                      <Text style={[styles.cellText, tempDate.getDate() === day && styles.cellTextActive]}>
                        {String(day).padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.col}>
                <Text style={styles.colLabel}>Month</Text>
                <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                  {months.map((mo, idx) => (
                    <TouchableOpacity
                      key={mo}
                      style={[styles.cell, tempDate.getMonth() === idx && styles.cellActive]}
                      onPress={() => {
                        const next = new Date(tempDate);
                        next.setMonth(idx);
                        setTempDate(startOfDay(next));
                      }}
                    >
                      <Text style={[styles.cellText, tempDate.getMonth() === idx && styles.cellTextActive]}>{mo}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={[styles.col, { flex: 1.2 }]}>
                <Text style={styles.colLabel}>Year</Text>
                <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                  {years.map((yr) => (
                    <TouchableOpacity
                      key={yr}
                      style={[styles.cell, tempDate.getFullYear() === yr && styles.cellActive]}
                      onPress={() => {
                        const next = new Date(tempDate);
                        next.setFullYear(yr);
                        setTempDate(startOfDay(next));
                      }}
                    >
                      <Text style={[styles.cellText, tempDate.getFullYear() === yr && styles.cellTextActive]}>{yr}</Text>
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
  wheels: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  col: { flex: 1, alignItems: 'center' },
  colLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted, marginBottom: 6 },
  scroll: { maxHeight: 180 },
  cell: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginVertical: 2 },
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
