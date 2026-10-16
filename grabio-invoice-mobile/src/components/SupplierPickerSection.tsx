import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import SupplierPickerModal from './SupplierPickerModal';
import { saveSupplier, searchSuppliers } from '../lib/financeService';
import { findExactCounterpartyMatch } from '../lib/counterpartyMatch';
import type { FinanceSupplier } from '../types';
import { COLORS, RADIUS } from '../theme';

type Props = {
  storeId: string;
  supplierName: string;
  onChangeName: (name: string) => void;
  onSelect: (supplier: FinanceSupplier) => void;
  label?: string;
  newLabel?: string;
};

export default function SupplierPickerSection({
  storeId,
  supplierName,
  onChangeName,
  onSelect,
  label = 'Supplier',
  newLabel = '+ New supplier',
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState<FinanceSupplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [matchedId, setMatchedId] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);

  useEffect(() => {
    const term = supplierName.trim();
    if (!term) {
      setResults([]);
      setMatchedId(null);
      selectedRef.current = null;
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      void searchSuppliers(storeId, term, 15)
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
  }, [storeId, supplierName, onSelect]);

  const pick = (supplier: FinanceSupplier) => {
    selectedRef.current = supplier.id;
    setMatchedId(supplier.id);
    onChangeName(supplier.name);
    onSelect(supplier);
    setFocused(false);
    setResults([]);
  };

  const saveNew = async () => {
    const name = draftName.trim();
    if (!name) {
      Alert.alert('Required', 'Enter a name');
      return;
    }
    try {
      const id = await saveSupplier(storeId, { name });
      pick({ id, name, storeId });
      setAddOpen(false);
      setDraftName('');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save supplier');
    }
  };

  const showList = focused && supplierName.trim().length > 0 && results.length > 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <TouchableOpacity onPress={() => setAddOpen(true)}>
          <Text style={styles.newLink}>{newLabel}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.fieldWrap}>
        <View style={[styles.field, matchedId ? styles.fieldMatched : null]}>
          <TextInput
            style={styles.input}
            placeholder={`Type ${label.toLowerCase()} name…`}
            placeholderTextColor={COLORS.textMuted}
            value={supplierName}
            onChangeText={(text) => {
              onChangeName(text);
              if (matchedId) {
                setMatchedId(null);
                selectedRef.current = null;
              }
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
          />
          {loading ? (
            <ActivityIndicator size="small" color={COLORS.primary} style={styles.sideIcon} />
          ) : matchedId ? (
            <Text style={styles.matchedIcon}>✓</Text>
          ) : (
            <TouchableOpacity style={styles.searchHit} onPress={() => setModalOpen(true)} accessibilityLabel={`Search ${label}`}>
              <Text style={styles.searchIcon}>▾</Text>
            </TouchableOpacity>
          )}
        </View>
        {showList ? (
          <View style={styles.suggestions}>
            <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
              {results.map((supplier) => (
                <TouchableOpacity key={supplier.id} style={styles.suggestionRow} onPress={() => pick(supplier)}>
                  <Text style={styles.suggestionName}>{supplier.name}</Text>
                  {supplier.phone ? <Text style={styles.suggestionMeta}>{supplier.phone}</Text> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </View>
      <SupplierPickerModal
        visible={modalOpen}
        storeId={storeId}
        onClose={() => setModalOpen(false)}
        onSelect={pick}
        onCreateNew={() => {
          setModalOpen(false);
          setAddOpen(true);
        }}
      />
      <Modal visible={addOpen} transparent animationType="fade" onRequestClose={() => setAddOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setAddOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>New supplier</Text>
            <TextInput
              style={styles.sheetInput}
              placeholder="Name"
              placeholderTextColor={COLORS.textMuted}
              value={draftName}
              onChangeText={setDraftName}
              autoFocus
            />
            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setAddOpen(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={() => void saveNew()}>
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: '#fff', borderRadius: RADIUS.md, padding: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12, color: COLORS.textPrimary },
  sheetInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.surface,
  },
  sheetActions: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, padding: 12, alignItems: 'center', borderRadius: RADIUS.md, backgroundColor: '#f3f4f6' },
  cancelText: { fontWeight: '700', color: COLORS.textSecondary },
  saveBtn: { flex: 1, padding: 12, alignItems: 'center', borderRadius: RADIUS.md, backgroundColor: COLORS.primary },
  saveText: { fontWeight: '700', color: '#fff' },
});
