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

export type FilterSelectOption = { id: string; name: string };

type Props = {
  label: string;
  value: string;
  options: FilterSelectOption[];
  onChange: (id: string) => void;
  placeholder?: string;
};

export default function FilterSelectField({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select…',
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);
  const display = selected?.name || placeholder;

  if (options.length === 0) return null;

  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.trigger} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <Text style={styles.triggerText} numberOfLines={2}>{display}</Text>
        <Text style={styles.chevron}>▾</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {options.map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.option, value === opt.id && styles.optionActive]}
                  onPress={() => {
                    onChange(opt.id);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.optionText, value === opt.id && styles.optionTextActive]}>
                    {opt.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: 12 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  triggerText: { flex: 1, fontSize: 15, color: COLORS.textPrimary, fontWeight: '600' },
  chevron: { fontSize: 14, color: COLORS.textMuted },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingTop: 16,
    paddingBottom: 24,
    maxHeight: '70%',
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textPrimary,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  list: { paddingHorizontal: 8 },
  option: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    marginBottom: 2,
  },
  optionActive: { backgroundColor: COLORS.primary + '18' },
  optionText: { fontSize: 16, color: COLORS.textPrimary },
  optionTextActive: { color: COLORS.primary, fontWeight: '700' },
});
