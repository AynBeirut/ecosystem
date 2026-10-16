import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import ClientPickerModal from './ClientPickerModal';
import { searchClients } from '../lib/financeService';
import { findExactCounterpartyMatch } from '../lib/counterpartyMatch';
import type { FinanceClient } from '../types';
import { COLORS, RADIUS } from '../theme';

type Props = {
  storeId: string;
  clientName: string;
  onChangeName: (name: string) => void;
  onSelect: (client: FinanceClient) => void;
  onCreateNew: () => void;
};

export default function ClientPickerSection({
  storeId,
  clientName,
  onChangeName,
  onSelect,
  onCreateNew,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState<FinanceClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [matchedId, setMatchedId] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);

  useEffect(() => {
    const term = clientName.trim();
    if (!term) {
      setResults([]);
      setMatchedId(null);
      selectedRef.current = null;
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      void searchClients(storeId, term, 15)
        .then((rows) => {
          if (cancelled) return;
          setResults(rows);
          const exact = findExactCounterpartyMatch(rows, term);
          if (exact && exact.id !== selectedRef.current) {
            selectedRef.current = exact.id;
            setMatchedId(exact.id);
            onSelect(exact);
          } else if (!exact) {
            setMatchedId(null);
            selectedRef.current = null;
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [storeId, clientName, onSelect]);

  const pick = (client: FinanceClient) => {
    selectedRef.current = client.id;
    setMatchedId(client.id);
    onChangeName(client.name);
    onSelect(client);
    setFocused(false);
    setResults([]);
  };

  const showList = focused && clientName.trim().length > 0 && results.length > 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Client</Text>
        <TouchableOpacity onPress={onCreateNew}>
          <Text style={styles.newLink}>+ New client</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.fieldWrap}>
        <View style={[styles.field, matchedId ? styles.fieldMatched : null]}>
          <TextInput
            style={styles.input}
            placeholder="Type client name…"
            placeholderTextColor={COLORS.textMuted}
            value={clientName}
            onChangeText={(text) => {
              onChangeName(text);
              setMatchedId(null);
              selectedRef.current = null;
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
          />
          {loading ? (
            <ActivityIndicator size="small" color={COLORS.primary} style={styles.sideIcon} />
          ) : matchedId ? (
            <Text style={styles.matchedIcon}>✓</Text>
          ) : (
            <TouchableOpacity style={styles.searchHit} onPress={() => setModalOpen(true)} accessibilityLabel="Search clients">
              <Text style={styles.searchIcon}>▾</Text>
            </TouchableOpacity>
          )}
        </View>
        {showList ? (
          <View style={styles.suggestions}>
            <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
              {results.map((client) => (
                <TouchableOpacity key={client.id} style={styles.suggestionRow} onPress={() => pick(client)}>
                  <Text style={styles.suggestionName}>{client.name}</Text>
                  {client.phone ? <Text style={styles.suggestionMeta}>{client.phone}</Text> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </View>
      <ClientPickerModal
        visible={modalOpen}
        storeId={storeId}
        onClose={() => setModalOpen(false)}
        onSelect={(client) => pick(client)}
        onCreateNew={onCreateNew}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 4, zIndex: 20 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  label: { fontWeight: '600', color: COLORS.textSecondary },
  newLink: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
  fieldWrap: { position: 'relative' },
  field: {
    position: 'relative',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    minHeight: 48,
  },
  fieldMatched: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  input: { paddingHorizontal: 12, paddingVertical: 12, paddingRight: 40, fontSize: 16, color: COLORS.textPrimary },
  searchHit: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchIcon: { fontSize: 16, color: COLORS.primary, fontWeight: '700' },
  sideIcon: { position: 'absolute', right: 12, top: 14 },
  matchedIcon: { position: 'absolute', right: 14, top: 13, fontSize: 16, color: COLORS.primary, fontWeight: '800' },
  suggestions: {
    marginTop: 4,
    maxHeight: 180,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  suggestionRow: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  suggestionName: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  suggestionMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
});
