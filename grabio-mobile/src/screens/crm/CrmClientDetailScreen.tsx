import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { captureVisitGps } from '../../lib/geolocation';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../types';
import { COLORS, RADIUS, SHADOW } from '../../theme';
import {
  CRM_ACTIVITY_TYPES,
  CRM_ACTIVITY_RESULTS,
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_RESULT_LABELS,
  type CrmActivityType,
  type CrmActivityResult,
} from '../../lib/crmConstants';
import { fetchClientActivities, fetchCrmAssignableAgents, fetchCustomerOrders, logActivity, resolveRepDisplayName, updateCrmClient, type CrmAssignableAgent, type CrmClient } from '../../lib/crmMobileService';
import {
  canAssignClientGpsLocation,
  canFilterBySalesAgent,
  collectMobileCrmRepIds,
  hasStoreAdminAccess,
  isFieldSalesRep,
  resolveMobileCrmRepId,
} from '../../lib/crmRepResolve';
import { useResolvedStoreId } from '../../hooks/useResolvedStoreId';
import TabletScreen from '../../components/TabletScreen';
import DatePickerField from '../../components/DatePickerField';
import CrmVisitOutcomeModal, { type VisitOutcomeSubmit } from '../../components/CrmVisitOutcomeModal';
import ScreenSafeArea from '../../components/ScreenSafeArea';
import { formatLastVisit } from '../../lib/crmVisitMetrics';
import { callClient, whatsappClient, whatsappShareClientLocationForDriver, clientCanShareLocationForDriver } from '../../lib/crmMapUtils';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Route = RouteProp<RootStackParamList, 'CrmClientDetail'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function CrmClientDetailScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const { storeId } = useResolvedStoreId();
  const { clientId, clientName } = route.params;
  const [client, setClient] = useState<CrmClient | null>(null);
  const [activities, setActivities] = useState<Array<Record<string, unknown> & { id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showVisitOutcome, setShowVisitOutcome] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [type, setType] = useState<CrmActivityType>('visit');
  const [result, setResult] = useState<CrmActivityResult>('follow_up');
  const [notes, setNotes] = useState('');
  const [followUpAt, setFollowUpAt] = useState<Date | null>(null);
  const [gps, setGps] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [gpsCapturing, setGpsCapturing] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [clientOrders, setClientOrders] = useState<Array<Record<string, unknown> & { id: string }>>([]);
  const [activityRepFilter, setActivityRepFilter] = useState('all');
  const [agents, setAgents] = useState<CrmAssignableAgent[]>([]);
  const isManager = hasStoreAdminAccess(user?.userRole, user?.subAccountRole);
  const isSalesRep = isFieldSalesRep(user?.userRole);
  const canFilterActivity = canFilterBySalesAgent(user?.userRole, user?.subAccountRole);
  const canAssignGps = canAssignClientGpsLocation(user?.userRole, user?.subAccountRole);

  const load = useCallback(async () => {
    if (!storeId || !user) return;
    const doc = await firestore().collection('customers').doc(clientId).get();
    if (!doc.exists()) {
      setAccessDenied(true);
      setLoading(false);
      return;
    }
    const data = { id: doc.id, ...doc.data() } as CrmClient;
    if (isSalesRep) {
      const repIds = await collectMobileCrmRepIds({ ...user, storeId });
      if (!data.assignedRepId || !repIds.includes(data.assignedRepId)) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }
    }
    setClient(data);
    const [acts, orders, agentList] = await Promise.all([
      fetchClientActivities(storeId, clientId, canFilterActivity ? activityRepFilter : undefined),
      fetchCustomerOrders(storeId, clientId),
      canFilterActivity ? fetchCrmAssignableAgents(storeId) : Promise.resolve([]),
    ]);
    setActivities(acts as Array<Record<string, unknown> & { id: string }>);
    setClientOrders(orders as Array<Record<string, unknown> & { id: string }>);
    setAgents(agentList);
    setLoading(false);
  }, [storeId, clientId, user, isSalesRep, canFilterActivity, activityRepFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const captureGps = async (): Promise<{ lat: number; lng: number; accuracy?: number } | null> => {
    setGpsCapturing(true);
    try {
      const coords = await captureVisitGps(true);
      if (coords) {
        setGps(coords);
        return coords;
      }
      return null;
    } finally {
      setGpsCapturing(false);
    }
  };

  useEffect(() => {
    if (showLog) {
      void captureGps();
      setType('visit');
      setResult('follow_up');
      setNotes('');
      setGps(null);
      setFollowUpAt(null);
    }
  }, [showLog]);

  const submitVisitOutcome = async (outcome: VisitOutcomeSubmit) => {
    if (!storeId || !user) return;
    const repId = await resolveMobileCrmRepId({ ...user, storeId });
    if (!repId) {
      Alert.alert('CRM', 'Your account is not linked as a sales rep.');
      return;
    }
    const repName = await resolveRepDisplayName(
      user.uid,
      user.teamMemberName || user.displayName || user.email || 'Rep',
    );
    const loggedAt = new Date().toISOString();
    const result =
      outcome.choice === 'next_visit'
        ? 'follow_up'
        : 'interested';
    await logActivity({
      storeId,
      customerId: clientId,
      repId,
      repName,
      type: 'visit',
      loggedAt,
      result,
      notes: outcome.notes || 'Visit completed',
      followUpAt: outcome.followUpAt,
      location: outcome.location,
      visitCompleted: true,
      orderTaken: outcome.orderTaken,
      createdBy: user.uid,
    });
    if (outcome.choice === 'order') {
      navigation.navigate('CreateOrder', {
        customerId: clientId,
        customerName: client?.name || clientName,
        customerPhone: client?.phone || '',
      });
    }
    setShowVisitOutcome(false);
    await load();
  };

  const submitLog = async () => {
    if (!storeId || !user) return;
    const repId = await resolveMobileCrmRepId({ ...user, storeId });
    if (!repId) {
      Alert.alert('CRM', 'Your account is not linked as a sales rep. Ask your manager to assign you in CRM.');
      return;
    }
    let visitGps = gps;
    if (type === 'visit' && !visitGps) {
      visitGps = await captureGps();
      if (!visitGps) {
        Alert.alert(
          'GPS required',
          'Turn on location and tap Refresh GPS, or step outside for a signal, then try Save again.',
        );
        return;
      }
    }
    if (result === 'follow_up' && !followUpAt) {
      Alert.alert('Required', 'Select a follow-up date on the calendar.');
      return;
    }
    setSaving(true);
    try {
      const loggedAt = new Date().toISOString();
      const followUpIso = followUpAt ? followUpAt.toISOString() : null;
      const repName = await resolveRepDisplayName(
      user.uid,
      user.teamMemberName || user.displayName || user.email || 'Rep',
    );
      await logActivity({
        storeId,
        customerId: clientId,
        repId,
        repName,
        type,
        loggedAt,
        result,
        notes,
        followUpAt: followUpIso,
        location: visitGps,
        createdBy: user.uid,
      });
      setShowLog(false);
      await load();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const saveCurrentLocationToClient = async () => {
    if (!client) return;
    setSavingLocation(true);
    try {
      const coords = await captureVisitGps(true);
      if (!coords) return;
      const replace = client.location?.lat != null;
      Alert.alert(
        replace ? 'Update client GPS?' : 'Save client GPS?',
        replace
          ? `Replace saved location for ${client.name || 'this client'} with where you are standing now?`
          : `Save your current position as the location for ${client.name || 'this client'}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save',
            onPress: () => {
              void updateCrmClient(clientId, { location: coords })
                .then(() => {
                  Alert.alert('Saved', 'Client location updated.');
                  void load();
                })
                .catch((e) => {
                  Alert.alert('Error', e instanceof Error ? e.message : 'Could not save location');
                });
            },
          },
        ],
      );
    } finally {
      setSavingLocation(false);
    }
  };

  if (loading) {
    return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />;
  }

  if (accessDenied) {
    return (
      <ScreenSafeArea style={styles.container}>
        <Text style={styles.title}>Not your client</Text>
        <Text style={styles.meta}>This client is assigned to another sales agent. Ask your manager if you need access.</Text>
      </ScreenSafeArea>
    );
  }

  return (
    <ScreenSafeArea style={styles.container}>
      <TabletScreen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{client?.name || clientName}</Text>
        {client?.phone ? <Text style={styles.meta}>{client.phone}</Text> : null}
        {(client?.district || client?.area) ? (
          <Text style={styles.meta}>📍 {[client.district, client.area].filter(Boolean).join(' · ')}</Text>
        ) : null}
        {client?.address ? <Text style={styles.meta}>{client.address}</Text> : null}
        {client?.location?.lat != null ? (
          <Text style={styles.meta}>
            GPS: {client.location.lat.toFixed(5)}, {client.location.lng.toFixed(5)}
          </Text>
        ) : (
          <Text style={styles.meta}>GPS: not saved yet</Text>
        )}
        {canAssignGps ? (
          <TouchableOpacity
            style={styles.captureLocBtn}
            onPress={() => void saveCurrentLocationToClient()}
            disabled={savingLocation}
          >
            {savingLocation ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.captureLocBtnText}>
                📍 {client?.location?.lat != null ? 'Update location from here' : 'Capture my location here'}
              </Text>
            )}
          </TouchableOpacity>
        ) : null}
        <Text style={styles.meta}>Last visit: {formatLastVisit(client?.lastVisitDate || client?.lastActivityAt)}</Text>
        {client?.pipelineStage ? (
          <Text style={styles.badge}>Stage: {client.pipelineStage.replace(/_/g, ' ')}</Text>
        ) : null}
        {client?.dealValue != null ? (
          <Text style={styles.meta}>Deal: ${Number(client.dealValue).toFixed(2)}</Text>
        ) : null}
        {client?.nextFollowUpAt ? (
          <Text style={styles.meta}>
            Next follow-up: {new Date(client.nextFollowUpAt).toLocaleString()}
          </Text>
        ) : null}

        {clientCanShareLocationForDriver(client || { id: clientId, name: clientName }) ? (
          <TouchableOpacity
            style={styles.driverBtn}
            onPress={() => void whatsappShareClientLocationForDriver(client || { id: clientId, name: clientName })}
          >
            <Text style={styles.driverBtnText}>🚚 WhatsApp location to driver</Text>
          </TouchableOpacity>
        ) : null}

        {client?.phone ? (
          <View style={styles.contactRow}>
            <TouchableOpacity style={styles.contactBtn} onPress={() => void callClient(client.phone)}>
              <Text style={styles.contactBtnText}>📞 Call</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.contactBtn, styles.waBtn]}
              onPress={() => void whatsappClient(client.phone, `Hi ${client.name || ''}, `)}
            >
              <Text style={[styles.contactBtnText, styles.waText]}>💬 WhatsApp</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <TouchableOpacity style={styles.editBtn} onPress={() => navigation.navigate('CrmClientForm', { clientId })}>
          <Text style={styles.editBtnText}>
            {isManager ? 'Edit client / assign agent' : 'Edit client details'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.visitBtn} onPress={() => setShowVisitOutcome(true)}>
          <Text style={styles.visitBtnText}>Visit completed</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.logBtn} onPress={() => setShowLog(true)}>
          <Text style={styles.logBtnText}>Log other activity</Text>
        </TouchableOpacity>

        <Text style={styles.section}>Orders (payment status)</Text>
        {clientOrders.length === 0 ? (
          <Text style={styles.empty}>No orders for this client yet.</Text>
        ) : (
          clientOrders.map((o) => {
            const paid = o.paymentStatus === 'paid';
            const partial = o.paymentStatus === 'partial';
            const label = paid ? 'Paid' : partial ? 'Partially paid' : 'Unpaid';
            const color = paid ? COLORS.success : partial ? COLORS.warning : COLORS.error;
            return (
              <View key={o.id} style={styles.actCard}>
                <Text style={styles.actTitle}>
                  #{String(o.id).slice(-6).toUpperCase()} · {String(o.currency || 'USD')} {Number(o.total || 0).toFixed(2)}
                </Text>
                <Text style={[styles.paymentBadge, { color }]}>{label}</Text>
                <Text style={styles.actDate}>{String(o.status || 'pending')}</Text>
              </View>
            );
          })
        )}

        <Text style={styles.section}>Activity history</Text>
        {canFilterActivity ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            <TouchableOpacity
              style={[styles.chip, activityRepFilter === 'all' && styles.chipActive]}
              onPress={() => setActivityRepFilter('all')}
            >
              <Text style={[styles.chipText, activityRepFilter === 'all' && styles.chipTextActive]}>All reps</Text>
            </TouchableOpacity>
            {agents.map((a) => (
              <TouchableOpacity
                key={a.id}
                style={[styles.chip, activityRepFilter === a.id && styles.chipActive, { marginLeft: 8 }]}
                onPress={() => setActivityRepFilter(a.id)}
              >
                <Text style={[styles.chipText, activityRepFilter === a.id && styles.chipTextActive]}>{a.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}
        {activities.length === 0 ? (
          <Text style={styles.empty}>No activities yet.</Text>
        ) : (
          activities.map((a) => (
            <View key={a.id} style={styles.actCard}>
              <Text style={styles.actTitle}>
                {ACTIVITY_TYPE_LABELS[(a.type as CrmActivityType) || 'visit']} ·{' '}
                {ACTIVITY_RESULT_LABELS[(a.result as CrmActivityResult) || 'follow_up']}
              </Text>
              <Text style={styles.actDate}>
                {a.loggedAt ? new Date(String(a.loggedAt)).toLocaleString() : ''}
              </Text>
              {a.notes ? <Text style={styles.actNotes}>{String(a.notes)}</Text> : null}
            </View>
          ))
        )}
      </ScrollView>
      </TabletScreen>

      <CrmVisitOutcomeModal
        visible={showVisitOutcome}
        clientName={client?.name || clientName}
        onClose={() => setShowVisitOutcome(false)}
        onSubmit={submitVisitOutcome}
      />

      <Modal
        visible={showLog}
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
        onRequestClose={() => setShowLog(false)}
      >
        <ScreenSafeArea style={styles.modal} edges={['top', 'bottom']}>
          <Text style={styles.modalTitle}>Log activity</Text>
          <ScrollView>
            <Text style={styles.label}>Type</Text>
            <View style={styles.chips}>
              {CRM_ACTIVITY_TYPES.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.chip, type === t && styles.chipActive]}
                  onPress={() => setType(t)}
                >
                  <Text style={[styles.chipText, type === t && styles.chipTextActive]}>
                    {ACTIVITY_TYPE_LABELS[t]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>Result</Text>
            <View style={styles.chips}>
              {CRM_ACTIVITY_RESULTS.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.chip, result === r && styles.chipActive]}
                  onPress={() => setResult(r)}
                >
                  <Text style={[styles.chipText, result === r && styles.chipTextActive]}>
                    {ACTIVITY_RESULT_LABELS[r]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>GPS {type === 'visit' ? '(required for visits)' : ''}</Text>
            <View style={styles.gpsRow}>
              <Text style={styles.gpsText}>
                {gpsCapturing
                  ? 'Getting location…'
                  : gps
                    ? `${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}`
                    : 'No GPS yet — tap Refresh or Save to retry'}
              </Text>
              {gpsCapturing ? <ActivityIndicator size="small" color={COLORS.primary} /> : null}
            </View>
            <TouchableOpacity onPress={() => void captureGps()}>
              <Text style={styles.link}>Refresh GPS</Text>
            </TouchableOpacity>
            <DatePickerField
              label="Next visit / follow-up date"
              value={followUpAt}
              onChange={setFollowUpAt}
              required={result === 'follow_up'}
              placeholder="Tap to pick date…"
              minimumDate={new Date()}
            />
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              multiline
              value={notes}
              onChangeText={setNotes}
              placeholder="Details…"
              placeholderTextColor={COLORS.textMuted}
            />
          </ScrollView>
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowLog(false)}>
              <Text>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, (saving || gpsCapturing) && styles.saveBtnDisabled]}
              onPress={submitLog}
              disabled={saving || gpsCapturing}
            >
              <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </ScreenSafeArea>
      </Modal>
    </ScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  meta: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
  badge: { fontSize: 13, color: COLORS.primary, marginTop: 6, textTransform: 'capitalize' },
  contactRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  contactBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 12,
    alignItems: 'center',
  },
  waBtn: { borderColor: '#22c55e', backgroundColor: '#dcfce7' },
  driverBtn: {
    marginTop: 10,
    backgroundColor: '#fef3c7',
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  driverBtnText: { fontWeight: '700', color: '#b45309', fontSize: 15 },
  contactBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 15 },
  waText: { color: '#15803d' },
  captureLocBtn: {
    marginTop: 12,
    backgroundColor: '#059669',
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  captureLocBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  editBtn: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 12,
    alignItems: 'center',
  },
  editBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 15 },
  visitBtn: {
    marginTop: 12,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    alignItems: 'center',
    ...SHADOW.sm,
  },
  visitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  logBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    paddingVertical: 12,
    alignItems: 'center',
  },
  logBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 15 },
  section: { fontSize: 16, fontWeight: '700', marginTop: 24, marginBottom: 10 },
  empty: { color: COLORS.textMuted, fontStyle: 'italic' },
  actCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 12,
    marginBottom: 8,
    ...SHADOW.sm,
  },
  actTitle: { fontWeight: '600', color: COLORS.textPrimary },
  actDate: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  actNotes: { fontSize: 13, color: COLORS.textSecondary, marginTop: 6 },
  paymentBadge: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  modal: { flex: 1, padding: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { fontSize: 12, color: COLORS.textPrimary },
  chipTextActive: { color: '#fff' },
  gpsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  gpsText: { fontSize: 13, color: COLORS.textSecondary, flex: 1 },
  link: { color: COLORS.primary, marginTop: 4, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: 14,
    backgroundColor: COLORS.surface,
    color: COLORS.textPrimary,
    fontSize: 16,
    minHeight: 48,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 16, paddingBottom: Platform.OS === 'ios' ? 20 : 8 },
  cancelBtn: { flex: 1, padding: 14, alignItems: 'center', borderRadius: RADIUS.md, borderWidth: 1 },
  saveBtn: { flex: 1, padding: 14, alignItems: 'center', borderRadius: RADIUS.md, backgroundColor: COLORS.primary },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: { color: '#fff', fontWeight: '700' },
});
