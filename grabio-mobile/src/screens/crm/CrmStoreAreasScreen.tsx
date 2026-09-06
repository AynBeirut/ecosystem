import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import ScreenSafeArea from '../../components/ScreenSafeArea';
import { useAuth } from '../../context/AuthContext';
import { useResolvedStoreId } from '../../hooks/useResolvedStoreId';
import { canManageCrmStoreAreas } from '../../lib/crmRepResolve';
import { CRM_LEBANON_GOVERNORATE_NAMES } from '../../lib/crmLebanonLocations';
import {
  createCrmStoreArea,
  crmBuiltInAreaSuggestions,
  deleteCrmStoreArea,
  fetchCrmStoreAreas,
  updateCrmStoreArea,
  type CrmStoreArea,
} from '../../lib/crmStoreAreaService';
import { COLORS, RADIUS } from '../../theme';

export default function CrmStoreAreasScreen() {
  const { user } = useAuth();
  const { storeId, loading: storeLoading } = useResolvedStoreId();
  const canManage = canManageCrmStoreAreas(user?.userRole, user?.subAccountRole);

  const [district, setDistrict] = useState('Beirut');
  const [districtOpen, setDistrictOpen] = useState(false);
  const [customAreas, setCustomAreas] = useState<CrmStoreArea[]>([]);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [areasError, setAreasError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<CrmStoreArea | null>(null);
  const [areaNameInput, setAreaNameInput] = useState('');
  const [saving, setSaving] = useState(false);

  const suggestions = React.useMemo(() => {
    const have = new Set(customAreas.map((a) => a.name.toLowerCase()));
    return crmBuiltInAreaSuggestions(district).filter((name) => !have.has(name.toLowerCase()));
  }, [district, customAreas]);

  const loadAreas = useCallback(async () => {
    if (!storeId || !district) {
      setCustomAreas([]);
      return;
    }
    setLoadingAreas(true);
    setAreasError(null);
    try {
      setCustomAreas(await fetchCrmStoreAreas(storeId, district));
    } catch (e) {
      setCustomAreas([]);
      setAreasError(e instanceof Error ? e.message : 'Could not load areas');
    } finally {
      setLoadingAreas(false);
    }
  }, [storeId, district]);

  useEffect(() => {
    void loadAreas();
  }, [loadAreas]);

  const openAdd = () => {
    setEditingArea(null);
    setAreaNameInput('');
    setFormOpen(true);
  };

  const openEdit = (row: CrmStoreArea) => {
    setEditingArea(row);
    setAreaNameInput(row.name);
    setFormOpen(true);
  };

  const confirmDelete = (row: CrmStoreArea) => {
    Alert.alert(
      'Delete area?',
      `Remove "${row.name}" from ${district}? Existing clients keep the old name until you edit them.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setSaving(true);
              try {
                await deleteCrmStoreArea(row.id);
                await loadAreas();
              } catch (e) {
                Alert.alert('Error', e instanceof Error ? e.message : 'Could not delete area');
              } finally {
                setSaving(false);
              }
            })();
          },
        },
      ],
    );
  };

  const saveArea = async () => {
    if (!storeId || !canManage) return;
    const name = areaNameInput.trim();
    if (!name) {
      Alert.alert('Required', 'Enter an area name.');
      return;
    }
    setSaving(true);
    try {
      if (editingArea) {
        await updateCrmStoreArea(editingArea.id, { storeId, district, name });
      } else {
        await createCrmStoreArea({
          storeId,
          district,
          name,
          createdBy: user?.uid || 'mobile',
        });
      }
      setFormOpen(false);
      setEditingArea(null);
      setAreaNameInput('');
      await loadAreas();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save area');
    } finally {
      setSaving(false);
    }
  };

  if (!canManage) {
    return (
      <ScreenSafeArea style={styles.container}>
        <Text style={styles.denied}>Only store admin or sales manager can manage custom areas.</Text>
      </ScreenSafeArea>
    );
  }

  if (storeLoading) {
    return (
      <ScreenSafeArea style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      </ScreenSafeArea>
    );
  }

  return (
    <ScreenSafeArea style={styles.container}>
      <Text style={styles.hint}>
        You control the Area list. Add Achrafieh 1, Achrafieh 2, rename or delete anytime. Once you add areas
        here, only your list is used on client forms.
      </Text>

      <Text style={styles.label}>District</Text>
      <TouchableOpacity style={styles.pickerBtn} onPress={() => setDistrictOpen(true)}>
        <Text style={styles.pickerValue}>{district}</Text>
      </TouchableOpacity>

      <View style={styles.row}>
        <Text style={styles.sectionTitle}>Your store areas</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd} disabled={!storeId}>
          <Text style={styles.addBtnText}>＋ Add</Text>
        </TouchableOpacity>
      </View>

      {areasError ? (
        <TouchableOpacity style={styles.errorBox} onPress={() => void loadAreas()}>
          <Text style={styles.errorText}>{areasError} Tap to retry.</Text>
        </TouchableOpacity>
      ) : null}

      {loadingAreas ? (
        <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: 12 }} />
      ) : customAreas.length === 0 ? (
        <Text style={styles.empty}>No areas for {district} yet — add below or tap a suggestion.</Text>
      ) : (
        <ScrollView style={styles.list}>
          {customAreas.map((row) => (
            <View key={row.id} style={styles.areaRow}>
              <Text style={styles.areaName}>{row.name}</Text>
              <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(row)}>
                <Text style={styles.actionText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => confirmDelete(row)}>
                <Text style={[styles.actionText, styles.deleteText]}>Delete</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {suggestions.length > 0 ? (
        <View style={styles.suggestBlock}>
          <Text style={styles.suggestTitle}>Quick start (tap to add as Achrafieh 1, …)</Text>
          <View style={styles.suggestRow}>
            {suggestions.slice(0, 8).map((name) => (
              <TouchableOpacity
                key={name}
                style={styles.suggestChip}
                onPress={() => {
                  setEditingArea(null);
                  setAreaNameInput(`${name} 1`);
                  setFormOpen(true);
                }}
              >
                <Text style={styles.suggestChipText}>+ {name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      <Modal visible={districtOpen} transparent animationType="slide" onRequestClose={() => setDistrictOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setDistrictOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Select district</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {CRM_LEBANON_GOVERNORATE_NAMES.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.option, district === opt && styles.optionActive]}
                  onPress={() => {
                    setDistrict(opt);
                    setDistrictOpen(false);
                  }}
                >
                  <Text style={[styles.optionText, district === opt && styles.optionTextActive]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={formOpen} transparent animationType="fade" onRequestClose={() => setFormOpen(false)}>
        <Pressable style={styles.overlayCenter} onPress={() => setFormOpen(false)}>
          <Pressable style={styles.formBox} onPress={() => {}}>
            <Text style={styles.sheetTitle}>
              {editingArea ? 'Rename area' : 'New area'} · {district}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Area name"
              placeholderTextColor={COLORS.textMuted}
              value={areaNameInput}
              onChangeText={setAreaNameInput}
              autoFocus
            />
            <TouchableOpacity style={styles.saveBtn} onPress={() => void saveArea()} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>{editingArea ? 'Save changes' : 'Save area'}</Text>
              )}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  hint: { fontSize: 13, color: COLORS.textMuted, marginBottom: 16, lineHeight: 18 },
  denied: { padding: 16, color: COLORS.error, fontSize: 15 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  pickerBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: 14,
    backgroundColor: COLORS.surface,
    marginBottom: 16,
  },
  pickerValue: { fontSize: 16, color: COLORS.textPrimary },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  addBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
  },
  addBtnText: { color: COLORS.primary, fontWeight: '700' },
  empty: { color: COLORS.textMuted, fontSize: 14, marginTop: 8 },
  list: { flex: 1 },
  areaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    marginBottom: 8,
    paddingLeft: 12,
    paddingRight: 4,
  },
  areaName: { flex: 1, fontSize: 16, color: COLORS.textPrimary, paddingVertical: 14 },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 12 },
  actionText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  deleteText: { color: COLORS.error },
  errorBox: {
    padding: 10,
    borderRadius: RADIUS.md,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    marginBottom: 8,
  },
  errorText: { color: COLORS.error, fontSize: 12 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  overlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '70%' },
  formBox: { backgroundColor: '#fff', borderRadius: RADIUS.lg, padding: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12, color: COLORS.textPrimary },
  option: { paddingVertical: 14, paddingHorizontal: 8, borderRadius: 8 },
  optionActive: { backgroundColor: COLORS.primaryLight },
  optionText: { fontSize: 16, color: COLORS.textPrimary },
  optionTextActive: { color: COLORS.primary, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: 12,
    fontSize: 16,
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '700' },
  suggestBlock: { marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  suggestTitle: { fontSize: 12, color: COLORS.textMuted, marginBottom: 8 },
  suggestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  suggestChipText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
});
