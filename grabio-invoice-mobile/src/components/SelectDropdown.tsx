import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  Pressable,
  StyleSheet,
} from 'react-native';
import { COLORS, RADIUS } from '../theme';

export type DropdownOption<T extends string = string> = {
  value: T;
  label: string;
  subtitle?: string;
};

type Props<T extends string = string> = {
  label?: string;
  placeholder: string;
  value: T | null | undefined;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  footerAction?: { label: string; onPress: () => void };
  disabled?: boolean;
};

export default function SelectDropdown<T extends string = string>({
  label,
  placeholder,
  value,
  options,
  onChange,
  searchable,
  searchPlaceholder = 'Search…',
  emptyText = 'No options',
  footerAction,
  disabled,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selected = options.find((o) => o.value === value);
  const display = selected?.label ?? placeholder;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!searchable || !q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.subtitle ? o.subtitle.toLowerCase().includes(q) : false),
    );
  }, [options, search, searchable]);

  const close = () => {
    setOpen(false);
    setSearch('');
  };

  const pick = (next: T) => {
    onChange(next);
    close();
  };

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TouchableOpacity
        style={[styles.field, disabled && styles.fieldDisabled]}
        onPress={() => !disabled && setOpen(true)}
        activeOpacity={0.8}
      >
        <Text style={[styles.fieldText, !selected && styles.placeholder]} numberOfLines={1}>
          {selected ? display : placeholder}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <Pressable style={styles.overlay} onPress={close}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label || placeholder}</Text>
              <TouchableOpacity onPress={close}>
                <Text style={styles.close}>Close</Text>
              </TouchableOpacity>
            </View>
            {searchable ? (
              <TextInput
                style={styles.search}
                placeholder={searchPlaceholder}
                placeholderTextColor={COLORS.textMuted}
                value={search}
                onChangeText={setSearch}
                autoFocus
              />
            ) : null}
            {footerAction ? (
              <TouchableOpacity
                style={styles.footerBtn}
                onPress={() => {
                  close();
                  footerAction.onPress();
                }}
              >
                <Text style={styles.footerBtnText}>{footerAction.label}</Text>
              </TouchableOpacity>
            ) : null}
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.value}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              ListEmptyComponent={<Text style={styles.empty}>{emptyText}</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.row, item.value === value && styles.rowActive]}
                  onPress={() => pick(item.value)}
                >
                  <View style={styles.rowBody}>
                    <Text style={[styles.rowLabel, item.value === value && styles.rowLabelActive]}>{item.label}</Text>
                    {item.subtitle ? <Text style={styles.rowSubtitle}>{item.subtitle}</Text> : null}
                  </View>
                  {item.value === value ? <Text style={styles.check}>✓</Text> : null}
                </TouchableOpacity>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 4 },
  label: { fontWeight: '600', color: COLORS.textSecondary, marginTop: 8, marginBottom: 6 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 48,
  },
  fieldDisabled: { opacity: 0.55 },
  fieldText: { flex: 1, fontSize: 16, color: COLORS.textPrimary, paddingRight: 8 },
  placeholder: { color: COLORS.textMuted },
  chevron: { fontSize: 16, color: COLORS.textMuted, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '78%',
    paddingBottom: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  close: { color: COLORS.primary, fontWeight: '700', fontSize: 16 },
  search: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.textPrimary,
  },
  footerBtn: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
    padding: 14,
    alignItems: 'center',
  },
  footerBtnText: { color: COLORS.secondary, fontWeight: '700' },
  list: { paddingHorizontal: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  rowActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  rowBody: { flex: 1, paddingRight: 8 },
  rowLabel: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
  rowLabelActive: { color: COLORS.secondary },
  rowSubtitle: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  check: { color: COLORS.primary, fontWeight: '800', fontSize: 16 },
  empty: { textAlign: 'center', color: COLORS.textMuted, paddingVertical: 24 },
});
