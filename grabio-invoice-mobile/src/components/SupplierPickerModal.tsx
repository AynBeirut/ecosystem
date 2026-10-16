import React, { useEffect, useState } from 'react';
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
import type { FinanceSupplier } from '../types';
import { searchSuppliers } from '../lib/financeService';
import { COLORS, RADIUS } from '../theme';

type Props = {
  visible: boolean;
  storeId: string;
  onClose: () => void;
  onSelect: (supplier: FinanceSupplier) => void;
  onCreateNew?: () => void;
};

export default function SupplierPickerModal({ visible, storeId, onClose, onSelect, onCreateNew }: Props) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<FinanceSupplier[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) {
      setSearch('');
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      void searchSuppliers(storeId, search, 50)
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

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ScreenSafeArea edges={['top', 'bottom']} style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Choose freelancer</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.close}>Close</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={styles.search}
          placeholder="Search by name…"
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
          autoFocus
        />
        {onCreateNew ? (
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => {
              onClose();
              onCreateNew();
            }}
          >
            <Text style={styles.createBtnText}>+ New supplier</Text>
          </TouchableOpacity>
        ) : null}
        {loading ? <ActivityIndicator size="small" color={COLORS.primary} style={styles.loader} /> : null}
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            !loading ? <Text style={styles.empty}>No suppliers match. Type the name manually above.</Text> : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => {
                onSelect(item);
                onClose();
                setSearch('');
              }}
            >
              <Text style={styles.rowTitle}>{item.name}</Text>
            </TouchableOpacity>
          )}
        />
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
    marginBottom: 8,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.textPrimary,
  },
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
  row: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rowTitle: { fontWeight: '700', color: COLORS.textPrimary },
  empty: { textAlign: 'center', color: COLORS.textMuted, marginTop: 40, paddingHorizontal: 16 },
});
