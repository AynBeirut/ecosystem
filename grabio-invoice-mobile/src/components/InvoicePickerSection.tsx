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
import { invoiceDisplayLabel, searchOpenInvoices } from '../lib/invoiceReceiptHelpers';
import type { FinanceInvoice } from '../types';
import { COLORS, RADIUS } from '../theme';

type Props = {
  storeId: string;
  query: string;
  selectedInvoice: FinanceInvoice | null;
  onChangeQuery: (value: string) => void;
  onSelect: (invoice: FinanceInvoice) => void;
  onClear: () => void;
};

export default function InvoicePickerSection({
  storeId,
  query,
  selectedInvoice,
  onChangeQuery,
  onSelect,
  onClear,
}: Props) {
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState<FinanceInvoice[]>([]);
  const [loading, setLoading] = useState(false);
  const selectedRef = useRef<string | null>(null);

  useEffect(() => {
    if (selectedInvoice) {
      selectedRef.current = selectedInvoice.id;
      return;
    }
    selectedRef.current = null;
  }, [selectedInvoice]);

  useEffect(() => {
    if (selectedInvoice) {
      setResults([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      void searchOpenInvoices(storeId, query, 20)
        .then((rows) => {
          if (!cancelled) setResults(rows);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [storeId, query, selectedInvoice]);

  const pick = (invoice: FinanceInvoice) => {
    selectedRef.current = invoice.id;
    onSelect(invoice);
    setFocused(false);
    setResults([]);
  };

  const showList = focused && !selectedInvoice && results.length > 0;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Search invoice</Text>
      {selectedInvoice ? (
        <View style={styles.selectedCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.selectedTitle}>{invoiceDisplayLabel(selectedInvoice)}</Text>
            <Text style={styles.selectedMeta}>Tap change to pick another invoice</Text>
          </View>
          <TouchableOpacity onPress={onClear}>
            <Text style={styles.changeLink}>Change</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.fieldWrap}>
          <View style={styles.field}>
            <TextInput
              style={styles.input}
              placeholder="Invoice # or client name…"
              placeholderTextColor={COLORS.textMuted}
              value={query}
              onChangeText={onChangeQuery}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 150)}
              autoCapitalize="characters"
            />
            {loading ? <ActivityIndicator size="small" color={COLORS.primary} style={styles.sideIcon} /> : null}
          </View>
          {showList ? (
            <View style={styles.suggestions}>
              <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                {results.map((invoice) => (
                  <TouchableOpacity key={invoice.id} style={styles.suggestionRow} onPress={() => pick(invoice)}>
                    <Text style={styles.suggestionName}>{invoiceDisplayLabel(invoice)}</Text>
                    <Text style={styles.suggestionMeta}>{invoice.date.slice(0, 10)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12, zIndex: 30 },
  label: { fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  fieldWrap: { position: 'relative' },
  field: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    minHeight: 48,
  },
  input: { paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: COLORS.textPrimary },
  sideIcon: { position: 'absolute', right: 12, top: 14 },
  suggestions: {
    marginTop: 4,
    maxHeight: 200,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  suggestionRow: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  suggestionName: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  suggestionMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  selectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.md,
    padding: 12,
  },
  selectedTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  selectedMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  changeLink: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
});
