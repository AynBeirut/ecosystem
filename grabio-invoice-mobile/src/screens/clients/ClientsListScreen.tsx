import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, TextInput, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { deleteClient, listClients } from '../../lib/financeService';
import type { FinanceClient, RootStackParamList } from '../../types';
import { COLORS, RADIUS, SHADOW } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ClientsListScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const [items, setItems] = useState<FinanceClient[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.storeId) { setLoading(false); return; }
    setItems(await listClients(user.storeId));
    setLoading(false);
    setRefreshing(false);
  }, [user?.storeId]);

  useEffect(() => { void load(); }, [load]);

  const filtered = items.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [c.name, c.phone, c.email].some((v) => String(v || '').toLowerCase().includes(q));
  });

  if (loading) return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Clients</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('ClientEditor', {})}>
          <Text style={styles.addText}>+ New</Text>
        </TouchableOpacity>
      </View>
      <TextInput style={styles.search} placeholder="Search clients…" placeholderTextColor={COLORS.textMuted} value={search} onChangeText={setSearch} />
      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
        ListEmptyComponent={<Text style={styles.empty}>No clients yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <TouchableOpacity onPress={() => navigation.navigate('ClientEditor', { clientId: item.id })}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              {item.phone ? <Text style={styles.meta}>{item.phone}</Text> : null}
              {item.email ? <Text style={styles.meta}>{item.email}</Text> : null}
            </TouchableOpacity>
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => navigation.navigate('ClientEditor', { clientId: item.id })}>
                <Text style={styles.edit}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
              onPress={() => {
                if (!user?.storeId) return;
                Alert.alert('Delete client', `Remove ${item.name}?`, [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                      void deleteClient(user.storeId, item.id)
                        .then(() => load())
                        .catch((e) => Alert.alert('Could not delete', e instanceof Error ? e.message : 'Try again'));
                    },
                  },
                ]);
              }}
            >
              <Text style={styles.delete}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.textPrimary },
  addBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.md },
  addText: { color: '#fff', fontWeight: '700' },
  search: { marginHorizontal: 16, marginBottom: 8, backgroundColor: COLORS.surface, color: COLORS.textPrimary, borderRadius: RADIUS.md, padding: 12, borderWidth: 1, borderColor: COLORS.border },
  card: { marginHorizontal: 16, marginBottom: 10, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 14, ...SHADOW.sm },
  cardTitle: { fontWeight: '700', color: COLORS.textPrimary },
  meta: { color: COLORS.textSecondary, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 16, marginTop: 10 },
  edit: { color: COLORS.primary, fontWeight: '700' },
  delete: { color: COLORS.error, fontWeight: '700' },
  empty: { textAlign: 'center', color: COLORS.textMuted, marginTop: 40 },
});
