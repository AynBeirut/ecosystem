import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, Alert, TextInput, Modal, Pressable, ScrollView,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Order } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { COLORS, RADIUS, SHADOW } from '../../theme';
import { formatScheduledForDisplay, isOrderRelevantToday } from '../../lib/orderDisplay';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const ALL_STATUSES = ['pending', 'confirmed', 'processing', 'ready', 'delivered', 'returned', 'cancelled'] as const;

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

const TERMINAL_STATUSES = new Set(['delivered', 'returned', 'cancelled']);

function capitalizeStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/** Suggested statuses first; full list available in modal for edge cases. */
function getSuggestedStatuses(current: string): string[] {
  const next = NEXT_STATUS[current];
  if (next) return [next];

  if (current === 'delivered') return ['returned', 'cancelled'];
  if (current === 'returned') return ['delivered', 'cancelled'];
  if (current === 'cancelled') return ['pending'];

  return ALL_STATUSES.filter((s) => s !== current);
}

function isOrderUnpaid(order: Order) {
  const status = order.paymentStatus || '';
  if (status === 'paid') return false;
  if (status === 'unpaid' || status === 'partial') return true;
  const total = Number(order.total || 0);
  const paid = Number(order.amountPaid || 0);
  return total > 0 && paid < total;
}

export default function OwnerOrdersScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [statusModalOrder, setStatusModalOrder] = useState<Order | null>(null);
  const [showAllStatuses, setShowAllStatuses] = useState(false);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.storeId) { setLoading(false); return; }

    const queryRef = firestore()
      .collection('orders')
      .where('storeId', '==', user.storeId)
      .orderBy('createdAt', 'desc')
      .limit(200);

    const unsub = queryRef.onSnapshot((snap) => {
      if (!snap) { setLoading(false); return; }
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order)));
      setLoading(false);
    });
    return unsub;
  }, [user?.storeId, showAll]);

  const setStatus = async (order: Order, newStatus: string) => {
    try {
      await firestore().collection('orders').doc(order.id).update({
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });
      setStatusModalOrder(null);
      setShowAllStatuses(false);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const markAsPaid = async (order: Order) => {
    const total = Number(order.total || 0);
    if (total <= 0) return;
    setMarkingPaidId(order.id);
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();
    try {
      await firestore().collection('orders').doc(order.id).update({
        paymentStatus: 'paid',
        amountPaid: total,
        remainingAmount: 0,
        paymentDate: today,
        paymentMethod: order.paymentMethod || 'cash',
        paymentNotes: 'Marked paid from mobile Orders',
        updatedAt: now,
      });
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to mark as paid');
    } finally {
      setMarkingPaidId(null);
    }
  };

  const openStatusPicker = (order: Order) => {
    setShowAllStatuses(false);
    setStatusModalOrder(order);
  };

  const closeStatusPicker = () => {
    setStatusModalOrder(null);
    setShowAllStatuses(false);
  };

  const scopedOrders = showAll ? orders : orders.filter(isOrderRelevantToday);

  const displayed = scopedOrders.filter((o) => {
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    const q = search.toLowerCase();
    const matchesSearch = !q || (o.customerName || '').toLowerCase().includes(q) || (o.customerPhone || '').includes(q) || o.id.slice(-6).toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const renderOrder = ({ item }: { item: Order }) => {
    const unpaid = isOrderUnpaid(item);
    const nextStatus = NEXT_STATUS[item.status];

    return (
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <Text style={styles.orderId}>#{item.id.slice(-6).toUpperCase()}</Text>
          <TouchableOpacity
            style={[styles.badge, { backgroundColor: STATUS_COLORS[item.status] + '22' }]}
            onPress={() => openStatusPicker(item)}
          >
            <Text style={[styles.badgeText, { color: STATUS_COLORS[item.status] }]}>
              {item.status} ✎
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.customer}>{item.customerName} {item.customerPhone ? `· ${item.customerPhone}` : ''}</Text>
        {item.scheduledFor ? (
          <Text style={styles.scheduled}>Scheduled · {formatScheduledForDisplay(item.scheduledFor)}</Text>
        ) : null}
        {unpaid ? (
          <Text style={styles.unpaid}>
            {item.paymentStatus === 'partial' ? 'Partially paid' : 'Unpaid'}
            {item.remainingAmount != null ? ` · ${item.currency} ${item.remainingAmount.toFixed(2)} due` : ''}
          </Text>
        ) : null}
        <Text style={styles.items}>{item.items?.map((i) => `${i.name} ×${i.quantity}`).join(', ')}</Text>
        <Text style={styles.total}>{item.currency} {(item.total || 0).toFixed(2)}</Text>

        <View style={styles.actions}>
          {nextStatus ? (
            <TouchableOpacity style={styles.actionBtn} onPress={() => setStatus(item, nextStatus)}>
              <Text style={styles.actionBtnText}>→ {capitalizeStatus(nextStatus)}</Text>
            </TouchableOpacity>
          ) : null}
          {unpaid ? (
            <TouchableOpacity
              style={[styles.actionBtn, styles.paidBtn]}
              onPress={() => void markAsPaid(item)}
              disabled={markingPaidId === item.id}
            >
              {markingPaidId === item.id ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.paidBtnText}>✓ Mark paid</Text>
              )}
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[styles.actionBtn, styles.moreBtn, !nextStatus && !unpaid && { flex: 1 }]}
            onPress={() => openStatusPicker(item)}
          >
            <Text style={[styles.actionBtnText, { color: COLORS.textSecondary }]}>⋯ More</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const modalOrder = statusModalOrder;
  const suggestedStatuses = modalOrder ? getSuggestedStatuses(modalOrder.status) : [];
  const otherStatuses = modalOrder
    ? ALL_STATUSES.filter((s) => s !== modalOrder.status && !suggestedStatuses.includes(s))
    : [];

  return (
    <SafeAreaView style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Search by name, phone or order #"
        value={search}
        onChangeText={setSearch}
      />

      <View style={styles.filterRowWrap}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={['all', ...ALL_STATUSES]}
          keyExtractor={(s) => s}
          contentContainerStyle={styles.filterRowContent}
          renderItem={({ item: s }) => (
            <TouchableOpacity
              style={[styles.chip, statusFilter === s && styles.chipActive]}
              onPress={() => setStatusFilter(s)}
            >
              <Text style={[styles.chipText, statusFilter === s && styles.chipTextActive]}>
                {s === 'all' ? 'All' : capitalizeStatus(s)}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

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

      <Modal visible={Boolean(modalOrder)} transparent animationType="fade" onRequestClose={closeStatusPicker}>
        <Pressable style={styles.modalOverlay} onPress={closeStatusPicker}>
          <Pressable style={styles.modalBox} onPress={(e) => e.stopPropagation()}>
            {modalOrder ? (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Order #{modalOrder.id.slice(-6).toUpperCase()}</Text>
                  <TouchableOpacity onPress={closeStatusPicker} hitSlop={12}>
                    <Text style={styles.modalClose}>✕</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.modalCurrent}>
                  Current: <Text style={{ fontWeight: '700' }}>{modalOrder.status}</Text>
                </Text>

                <Text style={styles.modalSectionLabel}>
                  {TERMINAL_STATUSES.has(modalOrder.status) ? 'Update order' : 'Move forward'}
                </Text>
                <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
                  {suggestedStatuses.map((status) => (
                    <TouchableOpacity
                      key={status}
                      style={styles.modalOption}
                      onPress={() => void setStatus(modalOrder, status)}
                    >
                      <View style={[styles.modalDot, { backgroundColor: STATUS_COLORS[status] }]} />
                      <Text style={styles.modalOptionText}>{capitalizeStatus(status)}</Text>
                    </TouchableOpacity>
                  ))}

                  {otherStatuses.length > 0 ? (
                    <>
                      <TouchableOpacity
                        style={styles.modalToggle}
                        onPress={() => setShowAllStatuses((v) => !v)}
                      >
                        <Text style={styles.modalToggleText}>
                          {showAllStatuses ? '▲ Hide other statuses' : '▼ Other statuses'}
                        </Text>
                      </TouchableOpacity>
                      {showAllStatuses ? otherStatuses.map((status) => (
                        <TouchableOpacity
                          key={status}
                          style={[styles.modalOption, styles.modalOptionMuted]}
                          onPress={() => void setStatus(modalOrder, status)}
                        >
                          <View style={[styles.modalDot, { backgroundColor: STATUS_COLORS[status] }]} />
                          <Text style={styles.modalOptionText}>{capitalizeStatus(status)}</Text>
                        </TouchableOpacity>
                      )) : null}
                    </>
                  ) : null}
                </ScrollView>

                <TouchableOpacity style={styles.modalCancelBtn} onPress={closeStatusPicker}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  search: { margin: 12, marginBottom: 4, padding: 10, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, fontSize: 14 },
  filterRowWrap: { paddingVertical: 8 },
  filterRowContent: { paddingHorizontal: 12, gap: 8, alignItems: 'center' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, minHeight: 36, justifyContent: 'center' },
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
  scheduled: { fontSize: 12, color: COLORS.info, fontWeight: '600', marginBottom: 4 },
  unpaid: { fontSize: 12, color: COLORS.warning, fontWeight: '600', marginBottom: 4 },
  items: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 4 },
  total: { fontSize: 15, color: COLORS.primary, fontWeight: '700', marginBottom: 8 },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionBtn: { flex: 1, minWidth: 90, backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, paddingVertical: 8, alignItems: 'center' },
  moreBtn: { backgroundColor: COLORS.light, flex: 0, minWidth: 72, paddingHorizontal: 10 },
  paidBtn: { backgroundColor: COLORS.success },
  actionBtnText: { color: COLORS.primary, fontWeight: '600', fontSize: 13 },
  paidBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  empty: { textAlign: 'center', marginTop: 40, color: COLORS.textMuted, fontSize: 15 },
  fab: {
    position: 'absolute', bottom: 24, right: 20, left: 20,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.lg,
    paddingVertical: 15, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  modalBox: { backgroundColor: '#fff', borderRadius: RADIUS.lg, padding: 16, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  modalClose: { fontSize: 20, color: COLORS.textMuted, padding: 4 },
  modalCurrent: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 12 },
  modalSectionLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', marginBottom: 8 },
  modalScroll: { maxHeight: 280 },
  modalOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalOptionMuted: { opacity: 0.85 },
  modalDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  modalOptionText: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
  modalToggle: { paddingVertical: 12, alignItems: 'center' },
  modalToggleText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  modalCancelBtn: { marginTop: 12, paddingVertical: 14, alignItems: 'center', borderRadius: RADIUS.md, backgroundColor: COLORS.light },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
});
