import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../types';
import { COLORS, RADIUS, SHADOW } from '../../theme';
import { fetchAssignedClients, type CrmClient } from '../../lib/crmMobileService';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function isOverdue(c: CrmClient) {
  if (!c.nextFollowUpAt) return false;
  return new Date(c.nextFollowUpAt).getTime() < Date.now();
}

export default function CrmMyClientsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const [clients, setClients] = useState<CrmClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!user?.storeId || !user.crmRepId) {
      setLoading(false);
      return;
    }
    const list = await fetchAssignedClients(user.storeId, user.crmRepId);
    setClients(list);
    setLoading(false);
    setRefreshing(false);
  }, [user?.storeId, user?.crmRepId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = search
    ? clients.filter(
        (c) =>
          (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
          (c.phone || '').includes(search),
      )
    : clients;

  const sorted = [...filtered].sort((a, b) => {
    const ao = isOverdue(a) ? 0 : 1;
    const bo = isOverdue(b) ? 0 : 1;
    if (ao !== bo) return ao - bo;
    const af = a.nextFollowUpAt ? new Date(a.nextFollowUpAt).getTime() : Infinity;
    const bf = b.nextFollowUpAt ? new Date(b.nextFollowUpAt).getTime() : Infinity;
    return af - bf;
  });

  if (loading) {
    return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Search clients…"
        value={search}
        onChangeText={setSearch}
      />
      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[COLORS.primary]} />
        }
        ListEmptyComponent={<Text style={styles.empty}>No assigned clients yet.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, isOverdue(item) && styles.cardOverdue]}
            onPress={() => navigation.navigate('CrmClientDetail', { clientId: item.id, clientName: item.name || 'Client' })}
          >
            <Text style={styles.name}>{item.name || 'Unnamed'}</Text>
            {item.phone ? <Text style={styles.meta}>{item.phone}</Text> : null}
            {item.pipelineStage ? <Text style={styles.stage}>{item.pipelineStage.replace(/_/g, ' ')}</Text> : null}
            {item.nextFollowUpAt ? (
              <Text style={[styles.followUp, isOverdue(item) && styles.followUpOverdue]}>
                Follow-up: {new Date(item.nextFollowUpAt).toLocaleDateString()}
              </Text>
            ) : null}
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  search: {
    margin: 12,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  card: {
    marginHorizontal: 12,
    marginBottom: 10,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 14,
    ...SHADOW.sm,
  },
  cardOverdue: { borderLeftWidth: 4, borderLeftColor: COLORS.error },
  name: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  meta: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  stage: { fontSize: 12, color: COLORS.primary, marginTop: 4, textTransform: 'capitalize' },
  followUp: { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
  followUpOverdue: { color: COLORS.error, fontWeight: '600' },
  empty: { textAlign: 'center', marginTop: 40, color: COLORS.textMuted },
});
