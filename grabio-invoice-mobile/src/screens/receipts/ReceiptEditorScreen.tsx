import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { saveReceipt } from '../../lib/financeService';
import { COLORS, RADIUS } from '../../theme';

export default function ReceiptEditorScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [clientName, setClientName] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [invoiceId, setInvoiceId] = useState('');

  const save = async () => {
    if (!user?.storeId || !clientName.trim() || !amount) {
      Alert.alert('Required', 'Client name and amount are required');
      return;
    }
    await saveReceipt(user.storeId, {
      clientName: clientName.trim(),
      amount: parseFloat(amount) || 0,
      paymentDate: new Date().toISOString(),
      paymentMethod,
      currency: 'USD',
      notes,
      invoiceId: invoiceId.trim() || undefined,
    });
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>New receipt</Text>
        <TextInput style={styles.input} placeholder="Client name" value={clientName} onChangeText={setClientName} />
        <TextInput style={styles.input} placeholder="Amount" keyboardType="numeric" value={amount} onChangeText={setAmount} />
        <TextInput style={styles.input} placeholder="Payment method" value={paymentMethod} onChangeText={setPaymentMethod} />
        <TextInput style={styles.input} placeholder="Linked invoice ID (optional)" value={invoiceId} onChangeText={setInvoiceId} />
        <TextInput style={styles.input} placeholder="Notes" value={notes} onChangeText={setNotes} />
        <TouchableOpacity style={styles.saveBtn} onPress={() => void save()}>
          <Text style={styles.saveText}>Save receipt</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  input: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 12, marginBottom: 8 },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 16, alignItems: 'center', marginTop: 8 },
  saveText: { color: '#fff', fontWeight: '700' },
});
