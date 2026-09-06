import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import ScreenSafeArea from './ScreenSafeArea';
import DatePickerField from './DatePickerField';
import { captureVisitGps } from '../lib/geolocation';
import { COLORS, RADIUS } from '../theme';

export type VisitOutcomeChoice = 'order' | 'next_visit' | 'feedback';

export type VisitOutcomeSubmit = {
  choice: VisitOutcomeChoice;
  notes: string;
  followUpAt: string | null;
  orderTaken: boolean;
  location: { lat: number; lng: number; accuracy?: number } | null;
};

type Props = {
  visible: boolean;
  clientName: string;
  onClose: () => void;
  onSubmit: (outcome: VisitOutcomeSubmit) => Promise<void>;
};

export default function CrmVisitOutcomeModal({ visible, clientName, onClose, onSubmit }: Props) {
  const [step, setStep] = useState<VisitOutcomeChoice | null>(null);
  const [notes, setNotes] = useState('');
  const [followUpAt, setFollowUpAt] = useState<Date | null>(null);
  const [gps, setGps] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      setStep(null);
      setNotes('');
      setFollowUpAt(null);
      setGps(null);
      return;
    }
    setGpsLoading(true);
    void captureVisitGps(true)
      .then((coords) => setGps(coords))
      .finally(() => setGpsLoading(false));
  }, [visible]);

  const reset = () => {
    setStep(null);
    setNotes('');
    setFollowUpAt(null);
  };

  const finish = async (choice: VisitOutcomeChoice) => {
    if (choice === 'feedback' && !notes.trim()) return;
    if (choice === 'next_visit' && !followUpAt) return;
    setGpsLoading(true);
    const coords = gps || (await captureVisitGps(true));
    setGpsLoading(false);
    if (!coords) return;
    setGps(coords);
    setSaving(true);
    try {
      await onSubmit({
        choice,
        notes: notes.trim(),
        followUpAt: followUpAt ? followUpAt.toISOString() : null,
        orderTaken: choice === 'order',
        location: coords,
      });
      onClose();
      reset();
    } finally {
      setSaving(false);
    }
  };

  const renderChoices = () => (
    <>
      <Text style={styles.subtitle}>What happened at {clientName}?</Text>
      <TouchableOpacity style={styles.choiceBtn} onPress={() => setStep('order')}>
        <Text style={styles.choiceIcon}>🛒</Text>
        <View style={styles.choiceTextWrap}>
          <Text style={styles.choiceTitle}>Create order</Text>
          <Text style={styles.choiceHint}>Open POS with this client</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={styles.choiceBtn} onPress={() => setStep('next_visit')}>
        <Text style={styles.choiceIcon}>📅</Text>
        <View style={styles.choiceTextWrap}>
          <Text style={styles.choiceTitle}>Next visit date</Text>
          <Text style={styles.choiceHint}>Schedule the follow-up</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={styles.choiceBtn} onPress={() => setStep('feedback')}>
        <Text style={styles.choiceIcon}>💬</Text>
        <View style={styles.choiceTextWrap}>
          <Text style={styles.choiceTitle}>Feedback</Text>
          <Text style={styles.choiceHint}>Notes only — no order yet</Text>
        </View>
      </TouchableOpacity>
    </>
  );

  const renderStep = () => {
    if (step === 'order') {
      return (
        <>
          <Text style={styles.subtitle}>Mark visit done and create an order for {clientName}.</Text>
          <TextInput
            style={styles.input}
            multiline
            placeholder="Optional note…"
            placeholderTextColor={COLORS.textMuted}
            value={notes}
            onChangeText={setNotes}
          />
        </>
      );
    }
    if (step === 'next_visit') {
      return (
        <>
          <DatePickerField
            label="Next visit date"
            value={followUpAt}
            onChange={setFollowUpAt}
            required
            placeholder="Pick date…"
            minimumDate={new Date()}
          />
          <TextInput
            style={styles.input}
            multiline
            placeholder="Optional note…"
            placeholderTextColor={COLORS.textMuted}
            value={notes}
            onChangeText={setNotes}
          />
        </>
      );
    }
    if (step === 'feedback') {
      return (
        <>
          <Text style={styles.subtitle}>Feedback from the visit</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            multiline
            placeholder="What did the client say? Required."
            placeholderTextColor={COLORS.textMuted}
            value={notes}
            onChangeText={setNotes}
          />
        </>
      );
    }
    return null;
  };

  const canSave =
    step === 'order'
      || (step === 'next_visit' && followUpAt)
      || (step === 'feedback' && notes.trim().length > 0);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onClose}
    >
      <ScreenSafeArea style={styles.modal} edges={['top', 'bottom']}>
        <Text style={styles.title}>Visit completed</Text>
        <ScrollView keyboardShouldPersistTaps="handled">
          {gpsLoading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginBottom: 12 }} />
          ) : gps ? (
            <Text style={styles.gps}>GPS attached</Text>
          ) : (
            <Text style={styles.gpsWarn}>Waiting for GPS…</Text>
          )}
          {step ? renderStep() : renderChoices()}
        </ScrollView>
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => {
              if (step) reset();
              else onClose();
            }}
          >
            <Text>{step ? 'Back' : 'Cancel'}</Text>
          </TouchableOpacity>
          {step ? (
            <TouchableOpacity
              style={[styles.saveBtn, (!canSave || saving) && styles.saveBtnDisabled]}
              onPress={() => void finish(step)}
              disabled={!canSave || saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>
                  {step === 'order' ? 'Done & create order' : 'Save visit'}
                </Text>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      </ScreenSafeArea>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, padding: 16, backgroundColor: COLORS.background },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 16, lineHeight: 20 },
  gps: { fontSize: 12, color: COLORS.success, marginBottom: 8 },
  gpsWarn: { fontSize: 12, color: COLORS.warning, marginBottom: 8 },
  choiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  choiceIcon: { fontSize: 28 },
  choiceTextWrap: { flex: 1 },
  choiceTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  choiceHint: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: 12,
    fontSize: 14,
    backgroundColor: COLORS.surface,
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  saveBtn: {
    flex: 2,
    padding: 14,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: { color: '#fff', fontWeight: '700' },
});
