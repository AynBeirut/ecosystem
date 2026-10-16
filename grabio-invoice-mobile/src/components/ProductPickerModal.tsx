import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import ScreenSafeArea from './ScreenSafeArea';
import type { FinanceProduct } from '../types';
import { productUnitPrice, searchProducts } from '../lib/financeService';
import { COLORS, RADIUS } from '../theme';

type Props = {
  visible: boolean;
  storeId: string;
  multiSelect?: boolean;
  onClose: () => void;
  onSelect: (productIds: string[]) => void;
  onCreateNew: () => void;
};

export default function ProductPickerModal({
  visible,
  storeId,
  multiSelect = true,
  onClose,
  onSelect,
  onCreateNew,
}: Props) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<FinanceProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible) {
      setSearch('');
      setResults([]);
      setSelected(new Set());
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      void searchProducts(storeId, search, 50)
        .then((rows) => {
          if (!cancelled) setResults(rows);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, search.trim().length >= 2 ? 280 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [visible, storeId, search]);

  const selectedCount = selected.size;

  const toggle = (productId: string) => {
    if (!multiSelect) {
      onSelect([productId]);
      onClose();
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const addSelected = () => {
    if (!selectedCount) return;
    onSelect(Array.from(selected));
    onClose();
  };

  const hint = useMemo(() => {
    if (multiSelect) {
      return search.trim().length >= 2
        ? 'Tap products to select — add several, then tap Add selected'
        : 'Type 2+ letters to search, then select multiple products';
    }
    return search.trim().length >= 2
      ? 'Showing up to 50 matches — type more to narrow'
      : 'Type 2+ letters to search your full catalog';
  }, [multiSelect, search]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ScreenSafeArea edges={['top', 'bottom']} style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{multiSelect ? 'Add products' : 'Choose product'}</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.close}>Close</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={styles.search}
          placeholder="Search by name or SKU…"
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.hint}>{hint}</Text>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => {
            onClose();
            onCreateNew();
          }}
        >
          <Text style={styles.createBtnText}>+ Create new product</Text>
        </TouchableOpacity>
        {loading ? <ActivityIndicator size="small" color={COLORS.primary} style={styles.loader} /> : null}
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={multiSelect ? styles.listPad : undefined}
          ListEmptyComponent={
            !loading ? (
              <Text style={styles.empty}>
                {search.trim().length >= 2 ? 'No products match that search.' : 'No products yet.'}
              </Text>
            ) : null
          }
          renderItem={({ item }) => {
            const picked = selected.has(item.id);
            return (
              <TouchableOpacity
                style={[styles.row, picked && styles.rowPicked]}
                onPress={() => toggle(item.id)}
              >
                {multiSelect ? (
                  <View style={[styles.check, picked && styles.checkPicked]}>
                    <Text style={styles.checkMark}>{picked ? '✓' : ''}</Text>
                  </View>
                ) : null}
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{item.name}</Text>
                  {item.sku ? <Text style={styles.rowMeta}>SKU: {item.sku}</Text> : null}
                </View>
                <Text style={styles.rowPrice}>USD {productUnitPrice(item).toFixed(2)}</Text>
              </TouchableOpacity>
            );
          }}
        />
        {multiSelect ? (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.addBtn, selectedCount === 0 && styles.addBtnDisabled]}
              onPress={addSelected}
              disabled={selectedCount === 0}
            >
              <Text style={styles.addBtnText}>
                {selectedCount ? `Add ${selectedCount} product${selectedCount === 1 ? '' : 's'}` : 'Select products'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScreenSafeArea>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary },
  close: { color: COLORS.primary, fontWeight: '700', fontSize: 16 },
  search: {
    marginHorizontal: 16,
    marginBottom: 6,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.textPrimary,
  },
  hint: { marginHorizontal: 16, marginBottom: 8, fontSize: 12, color: COLORS.textSecondary },
  createBtn: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
    padding: 14,
    alignItems: 'center',
  },
  createBtnText: { color: COLORS.secondary, fontWeight: '700' },
  loader: { marginBottom: 8 },
  listPad: { paddingBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rowPicked: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkPicked: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  checkMark: { color: '#fff', fontWeight: '800', fontSize: 12 },
  rowBody: { flex: 1, paddingRight: 12 },
  rowTitle: { fontWeight: '700', color: COLORS.textPrimary },
  rowMeta: { color: COLORS.textSecondary, marginTop: 4, fontSize: 12 },
  rowPrice: { color: COLORS.primary, fontWeight: '700' },
  empty: { textAlign: 'center', color: COLORS.textMuted, marginTop: 40, paddingHorizontal: 16 },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  addBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addBtnDisabled: { opacity: 0.45 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
