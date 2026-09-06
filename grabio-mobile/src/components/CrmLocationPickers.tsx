import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  CRM_LEBANON_GOVERNORATE_NAMES,
  crmDefaultLocation,
  type CrmLocationSelection,
} from '../lib/crmLebanonLocations';
import {
  createCrmStoreArea,
  deleteCrmStoreArea,
  fetchCrmStoreAreas,
  mergeCrmAreaOptions,
  updateCrmStoreArea,
  type CrmStoreArea,
} from '../lib/crmStoreAreaService';
import { COLORS, RADIUS } from '../theme';

type Props = {
  value: CrmLocationSelection;
  onChange: (next: CrmLocationSelection) => void;
  storeId?: string | null;
  /** Owner or sales manager — add, rename, delete store areas. */
  canAddAreas?: boolean;
  createdByUserId?: string;
  required?: boolean;
};

function DistrictPickerModal({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: string;
  onSelect: (v: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.sheetTitle}>Select district</Text>
          <ScrollView style={{ maxHeight: 360 }}>
            {CRM_LEBANON_GOVERNORATE_NAMES.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.option, selected === opt && styles.optionActive]}
                onPress={() => {
                  onSelect(opt);
                  onClose();
                }}
              >
                <Text style={[styles.optionText, selected === opt && styles.optionTextActive]}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function CrmLocationPickers({ value, onChange, storeId, canAddAreas, createdByUserId, required }: Props) {
  const canManageAreas = Boolean(canAddAreas);
  const [districtOpen, setDistrictOpen] = useState(false);
  const [areaOpen, setAreaOpen] = useState(false);
  const [areaFormOpen, setAreaFormOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<CrmStoreArea | null>(null);
  const [areaNameInput, setAreaNameInput] = useState('');
  const [savingArea, setSavingArea] = useState(false);
  const [customAreas, setCustomAreas] = useState<CrmStoreArea[]>([]);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [areasError, setAreasError] = useState<string | null>(null);

  const loc = value.district ? value : crmDefaultLocation();
  const areas = mergeCrmAreaOptions(loc.district, customAreas);

  const loadCustomAreas = useCallback(async () => {
    if (!storeId || !loc.district) {
      setCustomAreas([]);
      return;
    }
    setLoadingAreas(true);
    setAreasError(null);
    try {
      setCustomAreas(await fetchCrmStoreAreas(storeId, loc.district));
    } catch (e) {
      setCustomAreas([]);
      setAreasError(e instanceof Error ? e.message : 'Could not load store areas');
    } finally {
      setLoadingAreas(false);
    }
  }, [storeId, loc.district]);

  useEffect(() => {
    void loadCustomAreas();
  }, [loadCustomAreas]);

  const openAddArea = () => {
    setEditingArea(null);
    setAreaNameInput('');
    setAreaFormOpen(true);
  };

  const openEditArea = (row: CrmStoreArea) => {
    setEditingArea(row);
    setAreaNameInput(row.name);
    setAreaFormOpen(true);
  };

  const confirmDeleteArea = (row: CrmStoreArea) => {
    Alert.alert(
      'Delete area?',
      `Remove "${row.name}" from your store list? Existing clients keep the old name until you edit them.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setSavingArea(true);
              try {
                await deleteCrmStoreArea(row.id);
                if (loc.area === row.name) onChange({ ...loc, area: '' });
                await loadCustomAreas();
              } catch (e) {
                Alert.alert('Error', e instanceof Error ? e.message : 'Could not delete area');
              } finally {
                setSavingArea(false);
              }
            })();
          },
        },
      ],
    );
  };

  const saveAreaForm = async () => {
    if (!storeId || !canManageAreas) return;
    const name = areaNameInput.trim();
    if (!name) {
      Alert.alert('Required', 'Enter an area name.');
      return;
    }
    setSavingArea(true);
    try {
      if (editingArea) {
        await updateCrmStoreArea(editingArea.id, { storeId, district: loc.district, name });
        if (loc.area === editingArea.name) onChange({ ...loc, area: name });
      } else {
        await createCrmStoreArea({
          storeId,
          district: loc.district,
          name,
          createdBy: createdByUserId || 'mobile',
        });
        onChange({ ...loc, area: name });
        setAreaOpen(false);
      }
      setAreaNameInput('');
      setEditingArea(null);
      setAreaFormOpen(false);
      await loadCustomAreas();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save area');
    } finally {
      setSavingArea(false);
    }
  };

  const req = required ? ' *' : '';

  return (
    <View>
      <Text style={styles.label}>Country</Text>
      <Text style={styles.static}>Lebanon</Text>

      <Text style={styles.label}>District / Governorate{req}</Text>
      <TouchableOpacity style={styles.pickerBtn} onPress={() => setDistrictOpen(true)}>
        <Text style={loc.district ? styles.pickerValue : styles.pickerPlaceholder}>
          {loc.district || 'Select district (e.g. Beirut)'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.label}>Area{req}</Text>
      <TouchableOpacity
        style={[styles.pickerBtn, !loc.district && styles.pickerDisabled]}
        onPress={() => loc.district && setAreaOpen(true)}
        disabled={!loc.district}
      >
        <Text style={loc.area ? styles.pickerValue : styles.pickerPlaceholder}>
          {loc.area || 'Select area (e.g. Achrafieh, Sioufi)'}
        </Text>
      </TouchableOpacity>

      <DistrictPickerModal
        visible={districtOpen}
        selected={loc.district}
        onSelect={(district) => onChange({ country: 'Lebanon', district, area: '' })}
        onClose={() => setDistrictOpen(false)}
      />

      <Modal visible={areaOpen} transparent animationType="slide" onRequestClose={() => setAreaOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setAreaOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Select area · {loc.district}</Text>
            {areasError ? (
              <TouchableOpacity style={styles.areasError} onPress={() => void loadCustomAreas()}>
                <Text style={styles.areasErrorText}>{areasError} Tap to retry.</Text>
              </TouchableOpacity>
            ) : null}
            {loadingAreas ? (
              <ActivityIndicator size="small" color={COLORS.primary} style={{ marginBottom: 8 }} />
            ) : null}
            {canManageAreas ? (
              <>
                <TouchableOpacity style={styles.addAreaBtn} onPress={openAddArea}>
                  <Text style={styles.addAreaBtnText}>＋ Add area</Text>
                </TouchableOpacity>
                {customAreas.length > 0 ? (
                  <View style={styles.manageBlock}>
                    <Text style={styles.manageTitle}>Your areas — tap to pick, edit, or delete</Text>
                    {customAreas.map((row) => (
                      <View key={row.id} style={styles.manageRow}>
                        <TouchableOpacity
                          style={[styles.manageNameBtn, loc.area === row.name && styles.optionActive]}
                          onPress={() => {
                            onChange({ ...loc, area: row.name });
                            setAreaOpen(false);
                          }}
                        >
                          <Text style={[styles.optionText, loc.area === row.name && styles.optionTextActive]}>
                            {row.name}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.areaActionBtn} onPress={() => openEditArea(row)}>
                          <Text style={styles.areaActionText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.areaActionBtn} onPress={() => confirmDeleteArea(row)}>
                          <Text style={[styles.areaActionText, styles.areaDeleteText]}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : (
                  <>
                    <Text style={styles.builtInHint}>
                      No store areas yet — Lebanon defaults below. Use CRM → Areas to add Achrafieh 1, 2, etc.
                    </Text>
                    <ScrollView style={{ maxHeight: 360 }}>
                      {areas.map((opt) => (
                        <TouchableOpacity
                          key={opt}
                          style={[styles.option, loc.area === opt && styles.optionActive]}
                          onPress={() => {
                            onChange({ ...loc, area: opt });
                            setAreaOpen(false);
                          }}
                        >
                          <Text style={[styles.optionText, loc.area === opt && styles.optionTextActive]}>{opt}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </>
                )}
              </>
            ) : (
              <ScrollView style={{ maxHeight: 360 }}>
                {areas.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.option, loc.area === opt && styles.optionActive]}
                    onPress={() => {
                      onChange({ ...loc, area: opt });
                      setAreaOpen(false);
                    }}
                  >
                    <Text style={[styles.optionText, loc.area === opt && styles.optionTextActive]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={areaFormOpen} transparent animationType="fade" onRequestClose={() => setAreaFormOpen(false)}>
        <Pressable style={styles.overlayCenter} onPress={() => setAreaFormOpen(false)}>
          <Pressable style={styles.addBox} onPress={() => {}}>
            <Text style={styles.sheetTitle}>
              {editingArea ? 'Rename area' : 'New area'} · {loc.district}
            </Text>
            <TextInput
              style={styles.addInput}
              placeholder="e.g. Achrafieh 1"
              placeholderTextColor={COLORS.textMuted}
              value={areaNameInput}
              onChangeText={setAreaNameInput}
              autoFocus
            />
            <TouchableOpacity style={styles.saveAreaBtn} onPress={() => void saveAreaForm()} disabled={savingArea}>
              {savingArea ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveAreaBtnText}>{editingArea ? 'Save changes' : 'Save area'}</Text>
              )}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginTop: 12, marginBottom: 6 },
  static: { fontSize: 16, color: COLORS.textPrimary, paddingVertical: 8 },
  pickerBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: 14,
    backgroundColor: COLORS.surface,
    minHeight: 48,
    justifyContent: 'center',
  },
  pickerDisabled: { opacity: 0.5 },
  pickerValue: { fontSize: 16, color: COLORS.textPrimary },
  pickerPlaceholder: { fontSize: 16, color: COLORS.textMuted },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  overlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '70%' },
  addBox: { backgroundColor: '#fff', borderRadius: RADIUS.lg, padding: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12, color: COLORS.textPrimary },
  option: { paddingVertical: 14, paddingHorizontal: 8, borderRadius: 8 },
  optionActive: { backgroundColor: COLORS.primaryLight },
  optionText: { fontSize: 16, color: COLORS.textPrimary },
  optionTextActive: { color: COLORS.primary, fontWeight: '700' },
  areaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  areaOption: { flex: 1 },
  manageBlock: { marginBottom: 12 },
  manageTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  manageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingRight: 4,
  },
  manageNameBtn: { flex: 1, paddingVertical: 12, paddingHorizontal: 10 },
  areaActions: { flexDirection: 'row', gap: 4 },
  areaActionBtn: { paddingHorizontal: 8, paddingVertical: 10 },
  areaActionText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  areaDeleteText: { color: COLORS.error },
  addAreaBtn: {
    marginBottom: 10,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
  },
  addAreaBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 14 },
  addInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: 12,
    fontSize: 16,
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  saveAreaBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveAreaBtnText: { color: '#fff', fontWeight: '700' },
  areasError: {
    marginBottom: 8,
    padding: 10,
    borderRadius: RADIUS.md,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  areasErrorText: { color: COLORS.error, fontSize: 12 },
  builtInHint: { fontSize: 11, color: COLORS.textMuted, marginBottom: 8, paddingHorizontal: 4 },
});
