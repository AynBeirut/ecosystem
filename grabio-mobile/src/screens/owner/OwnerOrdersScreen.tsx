import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, Alert, TextInput,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Order } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { COLORS, RADIUS, SHADOW } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const ALL_STATUSES = ['pending', 'confirmed', 'processing', 'ready', 'delivered', 'returned', 'cancelled'];

const NEXT_STATUS: Record<string, string> = {
  pending: 'confirmed',
  confirmed: 'processing',
  processing: 'ready',
  ready: 'delivered',
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b', confirmed: '#3b82f6', processing: '#8b5cf6',
  ready: '#10b981', delivered: '#6b7280', returned: '#f97316', cancelled: '#ef4444',
};

export default function OwnerOrdersScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (!user?.storeId) { setLoading(false); return; }

    // Use top-level orders collection where storeId matches
    let queryRef = firestore()
      .collection('orders')
      .where('storeId', '==', user.storeId)
      .orderBy('createdAt', 'desc');

    if (!showAll) {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      queryRef = firestore()
        .collection('orders')
        .where('storeId', '==', user.storeId)
        .where('createdAt', '>=', firestore.Timestamp.fromDate(startOfToday))
        .orderBy('createdAt', 'desc');
    }

    const unsub = queryRef.onSnapshot((snap) => {
      if (!snap) { setLoading(false); return; }
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order)));
      setLoading(false);
    });
    return unsub;
  }, [user?.storeId, showAll]);

  const setStatus = async (order: Order, newStatus: string) => {
    try {
      await firestore().collection('orders').doc(order.id).update({ status: newStatus });
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const showStatusPicker = (order: Order) => {
    const options = ALL_STATUSES.filter((s) => s !== order.status).map((s) => ({
      text: s.charAt(0).toUpperCase() + s.slice(1),
      onPress: () => setStatus(order, s),
    }));
    Alert.alert(
      `Order #${order.id.slice(-6).toUpperCase()}`,
      `Current: ${order.status}\nSelect new status:`,
      [...options, { text: 'Cancel', style: 'cancel' as const }],
    );
  };

  const displayed = orders.filter((o) => {
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    const q = search.toLowerCase();
    const matchesSearch = !q || (o.customerName || '').toLowerCase().includes(q) || (o.customerPhone || '').includes(q) || o.id.slice(-6).toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const renderOrder = ({ item }: { item: Order }) => (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <Text style={styles.orderId}>#{item.id.slice(-6).toUpperCase()}</Text>
        <TouchableOpacity
          style={[styles.badge, { backgroundColor: STATUS_COLORS[item.status] + '22' }]}
          onPress={() => showStatusPicker(item)}
        >
          <Text style={[styles.badgeText, { color: STATUS_COLORS[item.status] }]}>
            {item.status} ✎
          </Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.customer}>{item.customerName} {item.customerPhone ? `· ${item.customerPhone}` : ''}</Text>
      <Text style={styles.items}>{item.items?.map((i) => `${i.name} ×${i.quantity}`).join(', ')}</Text>
      <Text style={styles.total}>{item.currency} {(item.total || 0).toFixed(2)}</Text>

      {NEXT_STATUS[item.status] && (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setStatus(item, NEXT_STATUS[item.status])}>
            <Text style={styles.actionBtnText}>→ {NEXT_STATUS[item.status]}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.moreBtn]} onPress={() => showStatusPicker(item)}>
            <Text style={[styles.actionBtnText, { color: COLORS.textSecondary }]}>⋯ More</Text>
          </TouchableOpacity>
        </View>
      )}
      {!NEXT_STATUS[item.status] && !['cancelled', 'returned'].includes(item.status) && (
        <TouchableOpacity style={[styles.actions, { marginTop: 4 }]} onPress={() => showStatusPicker(item)}>
          <View style={[styles.actionBtn, styles.moreBtn, { flex: 1 }]}>
            <Text style={[styles.actionBtnText, { color: COLORS.textSecondary }]}>⋯ Change Status</Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Search */}
      <TextInput
        style={styles.search}
        placeholder="Search by name, phone or order #"
        value={search}
        onChangeText={setSearch}
      />

      {/* Status filter chips */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={['all', ...ALL_STATUSES]}
        keyExtractor={(s) => s}
        style={styles.filterRow}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
        renderItem={({ item: s }) => (
          <TouchableOpacity
            style={[styles.chip, statusFilter === s && styles.chipActive]}
            onPress={() => setStatusFilter(s)}
          >
            <Text style={[styles.chipText, statusFilter === s && styles.chipTextActive]}>
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Toggle today/all */}
      <View style={styles.filterBar}>
        <Text style={styles.filterLabel}>
          {showAll ? 'All Orders' : "Today's Orders"} · {displayed.length}
        </Text>
        <TouchableOpacity onPress={() => setShowAll(!showAll)}>
          <Text style={styles.filterToggle}>{showAll ? '← Today' : '📅 All Orders'}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={(o) => o.id}
          renderItem={renderOrder}
          contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
          ListEmptyComponent={<Text style={styles.empty}>{showAll ? 'No orders' : 'No orders today'}</Text>}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('CreateOrder')}>
        <Text style={styles.fabText}>＋ Create Order</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  search: { margin: 12, marginBottom: 4, padding: 10, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, fontSize: 14 },
  filterRow: { marginVertical: 8, maxHeight: 40 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  chipTextActive: { color: '#fff' },
  filterBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  filterLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  filterToggle: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 14, marginBottom: 10, ...SHADOW.sm },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  orderId: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: RADIUS.full },
  badgeText: { fontSize: 12, fontWeight: '600' },
  customer: { fontSize: 14, color: '#374151', marginBottom: 4 },
  items: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 4 },
  total: { fontSize: 15, color: COLORS.primary, fontWeight: '700', marginBottom: 8 },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, paddingVertical: 8, alignItems: 'center' },
  moreBtn: { backgroundColor: COLORS.light },
  actionBtnText: { color: COLORS.primary, fontWeight: '600', fontSize: 13 },
  empty: { textAlign: 'center', marginTop: 40, color: COLORS.textMuted, fontSize: 15 },
  fab: {
    position: 'absolute', bottom: 24, right: 20, left: 20,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.lg,
    paddingVertical: 15, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
