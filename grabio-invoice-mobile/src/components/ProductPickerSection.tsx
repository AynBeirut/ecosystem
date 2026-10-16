import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import ProductPickerModal from './ProductPickerModal';
import { COLORS, RADIUS } from '../theme';

type Props = {
  storeId: string;
  onAdd: (productIds: string[]) => void | Promise<void>;
  onCreateNew: () => void;
  multiSelect?: boolean;
};

export default function ProductPickerSection({ storeId, onAdd, onCreateNew, multiSelect = true }: Props) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Product</Text>
        <TouchableOpacity onPress={onCreateNew}>
          <Text style={styles.newLink}>+ New product</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.field} onPress={() => setModalOpen(true)}>
        <Text style={styles.fieldText}>{multiSelect ? 'Search & add products…' : 'Search & add product…'}</Text>
        <Text style={styles.searchIcon}>▾</Text>
      </TouchableOpacity>
      <ProductPickerModal
        visible={modalOpen}
        storeId={storeId}
        multiSelect={multiSelect}
        onClose={() => setModalOpen(false)}
        onSelect={(ids) => void onAdd(ids)}
        onCreateNew={onCreateNew}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 4 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 6 },
  label: { fontWeight: '600', color: COLORS.textSecondary },
  newLink: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 14,
    minHeight: 48,
  },
  fieldText: { flex: 1, fontSize: 16, color: COLORS.textMuted },
  searchIcon: { fontSize: 16, color: COLORS.primary, fontWeight: '700' },
});
