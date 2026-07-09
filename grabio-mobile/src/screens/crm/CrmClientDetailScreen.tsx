import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
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
import { fetchClientActivities, logActivity, type CrmClient } from '../../lib/crmMobileService';

type Route = RouteProp<RootStackParamList, 'CrmClientDetail'>;

export default function CrmClientDetailScreen() {
  const route = useRoute<Route>();
  const { user } = useAuth();
  const { clientId, clientName } = route.params;
  const [client, setClient] = useState<CrmClient | null>(null);
  const [activities, setActivities] = useState<Array<Record<string, unknown> & { id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showLog, setShowLog] = useState(false);
  const [type, setType] = useState<CrmActivityType>('visit');
  const [result, setResult] = useState<CrmActivityResult>('follow_up');
  const [notes, setNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [gps, setGps] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user?.storeId) return;
    const doc = await firestore().collection('customers').doc(clientId).get();
    if (doc.exists) setClient({ id: doc.id, ...doc.data() } as CrmClient);
    const acts = await fetchClientActivities(user.storeId, clientId);
    setActivities(acts as Array<Record<string, unknown> & { id: string }>);
    setLoading(false);
  }, [user?.storeId, clientId]);

  useEffect(() => {
    load();
  }, [load]);

  const captureGps = async () => {
    const coords = await captureVisitGps();
    if (coords) setGps(coords);
  };

  useEffect(() => {
    if (showLog) {
      void captureGps();
      setType('visit');
      setResult('follow_up');
      setNotes('');
      setFollowUpDate('');
    }
  }, [showLog]);

  const submitLog = async () => {
    if (!user?.storeId || !user.crmRepId) return;
    if (result === 'follow_up' && !followUpDate.trim()) {
      Alert.alert('Required', 'Set a follow-up date when result is Follow-up needed.');
      return;
    }
    setSaving(true);
    try {
      const loggedAt = new Date().toISOString();
      const followUpAt = followUpDate
        ? new Date(followUpDate).toISOString()
        : null;
      await logActivity({
        storeId: user.storeId,
        customerId: clientId,
        repId: user.crmRepId,
        repName: user.displayName || user.email || 'Rep',
        type,
        loggedAt,
        result,
        notes,
        followUpAt,
        location: gps,
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

  if (loading) {
    return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{client?.name || clientName}</Text>
        {client?.phone ? <Text style={styles.meta}>{client.phone}</Text> : null}
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

        <TouchableOpacity style={styles.logBtn} onPress={() => setShowLog(true)}>
          <Text style={styles.logBtnText}>Log activity</Text>
        </TouchableOpacity>

        <Text style={styles.section}>Activity history</Text>
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

      <Modal visible={showLog} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
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
            <Text style={styles.label}>GPS</Text>
            <Text style={styles.gpsText}>
              {gps
                ? `${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}`
                : 'Capturing…'}
            </Text>
            <TouchableOpacity onPress={() => void captureGps()}>
              <Text style={styles.link}>Refresh GPS</Text>
            </TouchableOpacity>
            <Text style={styles.label}>Follow-up date {result === 'follow_up' ? '*' : ''}</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              value={followUpDate}
              onChangeText={setFollowUpDate}
            />
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              multiline
              value={notes}
              onChangeText={setNotes}
              placeholder="Details…"
            />
          </ScrollView>
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowLog(false)}>
              <Text>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={submitLog} disabled={saving}>
              <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  meta: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
  badge: { fontSize: 13, color: COLORS.primary, marginTop: 6, textTransform: 'capitalize' },
  logBtn: {
    marginTop: 16,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
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
  gpsText: { fontSize: 13, color: COLORS.textSecondary },
  link: { color: COLORS.primary, marginTop: 4, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: 10,
    backgroundColor: COLORS.surface,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 16, paddingBottom: Platform.OS === 'ios' ? 20 : 8 },
  cancelBtn: { flex: 1, padding: 14, alignItems: 'center', borderRadius: RADIUS.md, borderWidth: 1 },
  saveBtn: { flex: 1, padding: 14, alignItems: 'center', borderRadius: RADIUS.md, backgroundColor: COLORS.primary },
  saveBtnText: { color: '#fff', fontWeight: '700' },
});
