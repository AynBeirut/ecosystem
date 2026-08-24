import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Alert, ActivityIndicator } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { getEstimate, listClients, saveEstimate } from '../../lib/financeService';
import type { LineItem, RootStackParamList } from '../../types';
import { COLORS, RADIUS } from '../../theme';

type Route = RouteProp<RootStackParamList, 'EstimateEditor'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function EstimateEditorScreen() {
  const { user } = useAuth();
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const [loading, setLoading] = useState(!!route.params.estimateId);
  const [clientName, setClientName] = useState('');
  const [clientId, setClientId] = useState<string>();
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([{ id: '1', description: '', quantity: 1, unitPrice: 0, subtotal: 0 }]);
  const [clients, setClients] = useState<Awaited<ReturnType<typeof listClients>>>([]);

  useEffect(() => {
    if (!user?.storeId) return;
    void (async () => {
      setClients(await listClients(user.storeId!));
      if (route.params.estimateId) {
        const est = await getEstimate(user.storeId!, route.params.estimateId);
        if (est) {
          setClientName(est.clientName);
          setClientId(est.clientId);
          setNotes(est.notes || '');
          setLineItems(est.items);
        }
      }
      setLoading(false);
    })();
  }, [user?.storeId, route.params.estimateId]);

  const save = async () => {
    if (!user?.storeId || !clientName.trim()) {
      Alert.alert('Required', 'Enter client name');
      return;
    }
    await saveEstimate(user.storeId, {
      id: route.params.estimateId,
      clientId,
      clientName,
      items: lineItems.filter((i) => i.description.trim()),
      amount: 0,
      currency: 'USD',
      notes,
      status: 'pending',
    });
    navigation.goBack();
  };

  if (loading) return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{route.params.estimateId ? 'Edit estimate' : 'New estimate'}</Text>
        <TextInput style={styles.input} placeholder="Client name" value={clientName} onChangeText={setClientName} />
        {clients.slice(0, 8).map((c) => (
          <TouchableOpacity key={c.id} onPress={() => { setClientId(c.id); setClientName(c.name); }}>
            <Text style={styles.pick}>{c.name}</Text>
          </TouchableOpacity>
        ))}
        {lineItems.map((line) => (
          <View key={line.id} style={styles.line}>
            <TextInput style={styles.input} placeholder="Description" value={line.description} onChangeText={(v) => setLineItems((rows) => rows.map((r) => r.id === line.id ? { ...r, description: v } : r))} />
            <View style={styles.row}>
              <TextInput style={[styles.input, styles.half]} keyboardType="numeric" value={String(line.quantity)} onChangeText={(v) => setLineItems((rows) => rows.map((r) => r.id === line.id ? { ...r, quantity: parseFloat(v) || 0, subtotal: (parseFloat(v) || 0) * r.unitPrice } : r))} />
              <TextInput style={[styles.input, styles.half]} keyboardType="numeric" value={String(line.unitPrice)} onChangeText={(v) => setLineItems((rows) => rows.map((r) => r.id === line.id ? { ...r, unitPrice: parseFloat(v) || 0, subtotal: r.quantity * (parseFloat(v) || 0) } : r))} />
            </View>
          </View>
        ))}
        <TouchableOpacity onPress={() => setLineItems((r) => [...r, { id: `n-${Date.now()}`, description: '', quantity: 1, unitPrice: 0, subtotal: 0 }])}>
          <Text style={styles.link}>+ Add line</Text>
        </TouchableOpacity>
        <TextInput style={styles.input} placeholder="Notes" value={notes} onChangeText={setNotes} />
        <TouchableOpacity style={styles.saveBtn} onPress={() => void save()}>
          <Text style={styles.saveText}>Save estimate</Text>
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
  pick: { color: COLORS.primary, marginBottom: 6 },
  line: { marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8 },
  half: { flex: 1 },
  link: { color: COLORS.primary, fontWeight: '600', marginBottom: 12 },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 16, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '700' },
});
