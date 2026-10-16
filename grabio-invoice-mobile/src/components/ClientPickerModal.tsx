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
import type { FinanceClient } from '../types';
import { listClients, searchClients } from '../lib/financeService';
import { COLORS, RADIUS } from '../theme';

type Props = {
  visible: boolean;
  storeId: string;
  onClose: () => void;
  onSelect: (client: FinanceClient) => void;
  onCreateNew: () => void;
};

export default function ClientPickerModal({ visible, storeId, onClose, onSelect, onCreateNew }: Props) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<FinanceClient[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) {
      setSearch('');
      setResults([]);
      return;
    }
    let cancelled = false;
    const term = search.trim();
    const timer = setTimeout(() => {
      setLoading(true);
      const load = term.length >= 2
        ? searchClients(storeId, term, 50)
        : listClients(storeId).then((rows) => rows.slice(0, 100));
      void load
        .then((rows) => {
          if (!cancelled) setResults(rows);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, term.length >= 2 ? 280 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [visible, storeId, search]);

  const handleSelect = (client: FinanceClient) => {
    onSelect(client);
    onClose();
    setSearch('');
  };

  const hint =
    search.trim().length >= 2
      ? 'Showing up to 50 matches — type more to narrow'
      : 'Showing your clients — type to search';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ScreenSafeArea edges={['top', 'bottom']} style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Choose client</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.close}>Close</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={styles.search}
          placeholder="Search by name, phone, email…"
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
          autoFocus
          autoCapitalize="none"
        />
        <Text style={styles.hint}>{hint}</Text>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => {
            onClose();
            onCreateNew();
          }}
        >
          <Text style={styles.createBtnText}>+ Create new client</Text>
        </TouchableOpacity>
        {loading ? <ActivityIndicator size="small" color={COLORS.primary} style={styles.loader} /> : null}
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            !loading ? (
              <Text style={styles.empty}>
                {search.trim().length >= 2 ? 'No clients match that search.' : 'No clients yet — tap + Create new client.'}
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => handleSelect(item)}>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                {item.phone || item.email ? (
                  <Text style={styles.rowMeta}>{[item.phone, item.email].filter(Boolean).join(' · ')}</Text>
                ) : null}
              </View>
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
  row: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rowBody: { flex: 1 },
  rowTitle: { fontWeight: '700', color: COLORS.textPrimary },
  rowMeta: { color: COLORS.textSecondary, marginTop: 4, fontSize: 12 },
  empty: { textAlign: 'center', color: COLORS.textMuted, marginTop: 40, paddingHorizontal: 16 },
});
