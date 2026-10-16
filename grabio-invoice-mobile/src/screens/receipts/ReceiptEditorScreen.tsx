import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import ScreenSafeArea from '../../components/ScreenSafeArea';
import ClientPickerSection from '../../components/ClientPickerSection';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { fetchStoreProfile, saveReceipt } from '../../lib/financeService';
import PaymentMethodChips from '../../components/PaymentMethodChips';
import type { RootStackParamList } from '../../types';
import { COLORS, RADIUS } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function storeCurrencies(profile: Record<string, unknown> | null): string[] {
  const main = String(profile?.mainCurrency || 'USD').trim().toUpperCase() || 'USD';
  const secondary = String(profile?.secondaryCurrency || '').trim().toUpperCase();
  return secondary && secondary !== main ? [main, secondary] : [main];
}

export default function ReceiptEditorScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientId, setClientId] = useState<string>();
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [notes, setNotes] = useState('');
  const [currencies, setCurrencies] = useState<string[]>(['USD']);
  const [currency, setCurrency] = useState('USD');

  useEffect(() => {
    if (!user?.storeId) return;
    void fetchStoreProfile(user.storeId).then((profile) => {
      const allowed = storeCurrencies(profile as Record<string, unknown> | null);
      setCurrencies(allowed);
      setCurrency(allowed[0]);
      setLoading(false);
    });
  }, [user?.storeId]);

  const save = async () => {
    if (!user?.storeId || !clientName.trim() || !amount) {
      Alert.alert('Required', 'Choose a client and enter an amount');
      return;
    }
    setSaving(true);
    try {
      await saveReceipt(user.storeId, {
        clientId,
        clientName: clientName.trim(),
        amount: parseFloat(amount) || 0,
        paymentDate: new Date().toISOString(),
        paymentMethod,
        currency,
        notes,
      });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user?.storeId) return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />;

  return (
    <ScreenSafeArea edges={['bottom']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>New receipt</Text>
        <ClientPickerSection
          storeId={user.storeId}
          clientName={clientName}
          onChangeName={(name) => {
            setClientName(name);
            setClientId(undefined);
          }}
          onSelect={(client) => {
            setClientId(client.id);
            setClientName(client.name);
          }}
          onCreateNew={() => navigation.navigate('ClientEditor', {})}
        />
        <Text style={styles.label}>Amount</Text>
        <TextInput style={styles.input} placeholder="0.00" placeholderTextColor={COLORS.textMuted} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
        <Text style={styles.label}>Payment</Text>
        <PaymentMethodChips storeId={user.storeId} value={paymentMethod} onChange={setPaymentMethod} />
        <Text style={styles.label}>Currency</Text>
        <View style={styles.row}>
          {currencies.map((code) => (
            <TouchableOpacity key={code} style={[styles.choice, currency === code && styles.choiceOn]} onPress={() => setCurrency(code)}>
              <Text style={[styles.choiceText, currency === code && styles.choiceTextOn]}>{code}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput style={[styles.input, styles.notes]} placeholder="Notes" placeholderTextColor={COLORS.textMuted} value={notes} onChangeText={setNotes} multiline />
        <TouchableOpacity style={styles.saveBtn} onPress={() => void save()} disabled={saving}>
          <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save receipt'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12, color: COLORS.textPrimary },
  label: { fontWeight: '600', color: COLORS.textSecondary, marginTop: 8, marginBottom: 6 },
  input: { backgroundColor: COLORS.surface, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: 14, marginBottom: 8, fontSize: 16 },
  notes: { minHeight: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  choice: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  choiceOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  choiceText: { fontWeight: '700', color: COLORS.textPrimary, textTransform: 'capitalize' },
  choiceTextOn: { color: '#fff' },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 16, alignItems: 'center', marginTop: 8 },
  saveText: { color: '#fff', fontWeight: '700' },
});
