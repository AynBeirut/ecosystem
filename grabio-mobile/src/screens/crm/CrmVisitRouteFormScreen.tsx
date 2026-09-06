import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import ScreenSafeArea from '../../components/ScreenSafeArea';
import DatePickerField from '../../components/DatePickerField';
import { useAuth } from '../../context/AuthContext';
import { useResolvedStoreId } from '../../hooks/useResolvedStoreId';
import {
  canAssignCrmClients,
  isFieldSalesRep,
  resolveMobileCrmRepId,
} from '../../lib/crmRepResolve';
import {
  agentDisplayName,
  fetchAssignedClients,
  fetchCrmAssignableAgents,
  type CrmAssignableAgent,
  type CrmClient,
} from '../../lib/crmMobileService';
import {
  buildStopsFromClients,
  createVisitRoute,
  fetchVisitRoute,
  REPEAT_LABELS,
  toDateYmd,
  updateVisitRoute,
  type VisitRouteRepeat,
} from '../../lib/crmVisitRouteService';
import { RootStackParamList } from '../../types';
import { COLORS, RADIUS } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type FormRoute = RouteProp<RootStackParamList, 'CrmVisitRouteForm'>;

const REPEAT_OPTIONS: VisitRouteRepeat[] = ['none', 'weekly', 'every_15_days', 'monthly'];

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export default function CrmVisitRouteFormScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const formRoute = useRoute<FormRoute>();
  const editingRouteId = formRoute.params?.routeId;
  const isEdit = Boolean(editingRouteId);
  const { storeId } = useResolvedStoreId();
  const isManager = canAssignCrmClients(user?.userRole, user?.subAccountRole);
  const isSalesRep = isFieldSalesRep(user?.userRole);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agents, setAgents] = useState<CrmAssignableAgent[]>([]);
  const [clients, setClients] = useState<CrmClient[]>([]);
  const [myRepId, setMyRepId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [dateMode, setDateMode] = useState<'today' | 'tomorrow' | 'pick'>('today');
  const [pickDate, setPickDate] = useState<Date | null>(null);
  const [repeatRule, setRepeatRule] = useState<VisitRouteRepeat>('none');
  const [assignedRepId, setAssignedRepId] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const visitDate = useMemo(() => {
    if (dateMode === 'today') return toDateYmd(new Date());
    if (dateMode === 'tomorrow') return toDateYmd(addDays(new Date(), 1));
    return pickDate ? toDateYmd(pickDate) : toDateYmd(new Date());
  }, [dateMode, pickDate]);

  const load = useCallback(async () => {
    if (!storeId || !user) {
      setLoading(false);
      return;
    }
    const repId = await resolveMobileCrmRepId({ ...user, storeId });
    setMyRepId(repId);
    const [agentList, clientList] = await Promise.all([
      isManager ? fetchCrmAssignableAgents(storeId) : Promise.resolve([]),
      fetchAssignedClients(storeId, { ...user, storeId }, {
        managerView: isManager && !isSalesRep,
      }),
    ]);
    setAgents(agentList);
    setClients(clientList.filter((c) => c.status !== 'inactive'));

    if (isEdit && editingRouteId) {
      const existing = await fetchVisitRoute(editingRouteId);
      if (!existing || existing.storeId !== storeId) {
        Alert.alert('Route not found', 'This route may have been removed.');
        navigation.goBack();
        setLoading(false);
        return;
      }
      if (!isManager) {
        Alert.alert('Not allowed', 'Only admin or sales manager can edit routes.');
        navigation.goBack();
        setLoading(false);
        return;
      }
      setTitle(existing.title);
      setRepeatRule(existing.repeatRule);
      setAssignedRepId(existing.assignedRepId);
      setSelectedIds(new Set(existing.stops.map((s) => s.clientId)));
      const today = toDateYmd(new Date());
      if (existing.visitDate === today) setDateMode('today');
      else if (existing.visitDate === toDateYmd(addDays(new Date(), 1))) setDateMode('tomorrow');
      else {
        setDateMode('pick');
        setPickDate(new Date(`${existing.visitDate}T12:00:00`));
      }
    } else {
      const defaultRep = isManager
        ? (agentList.find((a) => a.role !== 'owner')?.id || repId || '')
        : (repId || (user.subAccountId ? `sub:${user.subAccountId}` : ''));
      setAssignedRepId(defaultRep);
    }
    setLoading(false);
  }, [storeId, user, isManager, isSalesRep, isEdit, editingRouteId, navigation]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (isEdit) {
      navigation.setOptions({ title: 'Edit Route' });
    }
  }, [isEdit, navigation]);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        (c.name || '').toLowerCase().includes(q)
        || (c.phone || '').includes(q)
        || (c.district || '').toLowerCase().includes(q)
        || (c.area || '').toLowerCase().includes(q),
    );
  }, [clients, search]);

  const toggleClient = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectVisible = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredClients.forEach((c) => next.add(c.id));
      return next;
    });
  }, [filteredClients]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const save = async () => {
    if (!storeId || !user || !assignedRepId) {
      Alert.alert('Missing info', 'Select a sales agent for this route.');
      return;
    }
    if (selectedIds.size === 0) {
      Alert.alert('No clients', 'Select at least one client to visit.');
      return;
    }
    if (dateMode === 'pick' && !pickDate) {
      Alert.alert('Date', 'Pick a visit date.');
      return;
    }

    const routeRepId = isSalesRep
      ? (myRepId || (user.subAccountId ? `sub:${user.subAccountId}` : assignedRepId))
      : assignedRepId;

    const chosen = clients.filter((c) => selectedIds.has(c.id));
    setSaving(true);
    try {
      const routeRepId = isSalesRep
        ? (myRepId || (user.subAccountId ? `sub:${user.subAccountId}` : assignedRepId))
        : assignedRepId;
      const assignedUserId = isManager
        ? (agents.find((a) => a.id === routeRepId)?.userId || undefined)
        : user.uid;
      const payload = {
        storeId,
        title: title.trim() || `Route · ${visitDate}`,
        assignedRepId: routeRepId,
        assignedRepName: agentDisplayName(agents, routeRepId) || user.teamMemberName || user.displayName || 'Sales',
        visitDate,
        repeatRule,
        stops: buildStopsFromClients(chosen),
        assignedUserId,
      };
      if (isEdit && editingRouteId) {
        await updateVisitRoute({ routeId: editingRouteId, ...payload });
        navigation.replace('CrmVisitRouteDetail', { routeId: editingRouteId, occurrenceDate: visitDate });
      } else {
        const routeId = await createVisitRoute({
          ...payload,
          createdBy: user.uid,
        });
        navigation.replace('CrmVisitRouteDetail', { routeId, occurrenceDate: visitDate });
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not create route');
    } finally {
      setSaving(false);
    }
  };

  const routeForm = (
    <View>
      <Text style={styles.heading}>{isEdit ? 'Edit visit route' : 'Create visit route'}</Text>
      <Text style={styles.sub}>Set date and agent below · search clients in the next section</Text>

      <Text style={styles.label}>Route name (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Beirut east · Tuesday"
        value={title}
        onChangeText={setTitle}
      />

      <Text style={styles.label}>Visit date</Text>
      <View style={styles.chipRow}>
        {(['today', 'tomorrow', 'pick'] as const).map((mode) => (
          <TouchableOpacity
            key={mode}
            style={[styles.chip, dateMode === mode && styles.chipActive]}
            onPress={() => setDateMode(mode)}
          >
            <Text style={[styles.chipText, dateMode === mode && styles.chipTextActive]}>
              {mode === 'today' ? 'Today' : mode === 'tomorrow' ? 'Tomorrow' : 'Pick date'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {dateMode === 'pick' ? (
        <DatePickerField
          label="Date"
          value={pickDate}
          onChange={setPickDate}
          minimumDate={new Date()}
        />
      ) : (
        <Text style={styles.datePreview}>📅 {visitDate}</Text>
      )}

      <Text style={styles.label}>Repeat</Text>
      <View style={styles.chipWrap}>
        {REPEAT_OPTIONS.map((r) => (
          <TouchableOpacity
            key={r}
            style={[styles.chip, repeatRule === r && styles.chipActive]}
            onPress={() => setRepeatRule(r)}
          >
            <Text style={[styles.chipText, repeatRule === r && styles.chipTextActive]}>
              {REPEAT_LABELS[r]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Sales agent</Text>
      {isManager ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.agentRow}>
          {agents.map((a) => (
            <TouchableOpacity
              key={a.id}
              style={[styles.chip, assignedRepId === a.id && styles.chipActive]}
              onPress={() => setAssignedRepId(a.id)}
            >
              <Text style={[styles.chipText, assignedRepId === a.id && styles.chipTextActive]}>{a.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <Text style={styles.agentFixed}>{agentDisplayName(agents, myRepId || assignedRepId)}</Text>
      )}
    </View>
  );

  const selectedClients = useMemo(
    () => clients.filter((c) => selectedIds.has(c.id)),
    [clients, selectedIds],
  );

  const renderClient = useCallback(({ item: c }: { item: CrmClient }) => {
    const checked = selectedIds.has(c.id);
    return (
      <TouchableOpacity
        style={[styles.clientRow, checked && styles.clientRowOn]}
        onPress={() => toggleClient(c.id)}
      >
        <Text style={styles.check}>{checked ? '☑' : '☐'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.clientName}>{c.name || 'Unnamed'}</Text>
          <Text style={styles.clientMeta}>
            {[c.district, c.area].filter(Boolean).join(' · ') || '—'}
            {c.location?.lat != null ? '' : ' · No GPS'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [selectedIds, toggleClient]);

  if (loading) {
    return (
      <ScreenSafeArea style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </ScreenSafeArea>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 4 : 0}
    >
      <ScreenSafeArea style={styles.flex}>
        <ScrollView
          style={styles.formSection}
          contentContainerStyle={styles.formSectionContent}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          {routeForm}
        </ScrollView>

        <View style={styles.clientSection}>
          <View style={styles.clientHeaderRow}>
            <Text style={styles.labelInline}>
              Clients ({selectedIds.size} selected · {filteredClients.length} shown)
            </Text>
            <View style={styles.quickRow}>
              <TouchableOpacity onPress={selectVisible}>
                <Text style={styles.quickLink}>Select shown</Text>
              </TouchableOpacity>
              <Text style={styles.quickSep}>·</Text>
              <TouchableOpacity onPress={clearSelection}>
                <Text style={styles.quickLink}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Search name, phone, district…"
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
            returnKeyType="search"
          />

          {selectedClients.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.selectedRow}
              keyboardShouldPersistTaps="handled"
            >
              {selectedClients.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.selectedChip}
                  onPress={() => toggleClient(c.id)}
                >
                  <Text style={styles.selectedChipText}>{c.name || 'Unnamed'} ×</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}

          <FlatList
            style={styles.clientList}
            data={filteredClients}
            keyExtractor={(c) => c.id}
            renderItem={renderClient}
            contentContainerStyle={styles.clientListContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets
            initialNumToRender={20}
            maxToRenderPerBatch={24}
            windowSize={8}
            ListEmptyComponent={
              <Text style={styles.empty}>No clients match your search.</Text>
            }
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerHint}>
            {selectedIds.size === 0 ? 'Select clients above' : `${selectedIds.size} client(s) on route`}
          </Text>
          <TouchableOpacity style={styles.saveBtn} onPress={() => void save()} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : (
              <Text style={styles.saveText}>{isEdit ? 'Save route' : 'Create route'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScreenSafeArea>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  formSection: { flexGrow: 0, flexShrink: 1, maxHeight: '40%' },
  formSectionContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  clientSection: { flex: 1, minHeight: 200, paddingHorizontal: 16 },
  clientList: { flex: 1 },
  clientListContent: { paddingBottom: 8 },
  heading: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  sub: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, marginTop: 14, marginBottom: 8 },
  labelInline: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, flex: 1 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: 14,
    backgroundColor: COLORS.surface,
    fontSize: 16,
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.border,
    marginBottom: 4,
  },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { fontSize: 13, color: COLORS.textPrimary },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  datePreview: { fontSize: 16, color: COLORS.textPrimary, marginTop: 4 },
  agentRow: { marginBottom: 4 },
  agentFixed: { fontSize: 16, fontWeight: '600', color: COLORS.primary },
  clientHeaderRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, marginBottom: 8, gap: 8 },
  quickRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  quickLink: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  quickSep: { color: COLORS.textMuted },
  selectedRow: { marginBottom: 8, maxHeight: 40 },
  selectedChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primary,
    marginRight: 8,
  },
  selectedChipText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
  },
  clientRowOn: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  check: { fontSize: 20 },
  clientName: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  clientMeta: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  empty: { color: COLORS.textMuted, fontStyle: 'italic', marginVertical: 12, textAlign: 'center' },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  footerHint: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 8, textAlign: 'center' },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
