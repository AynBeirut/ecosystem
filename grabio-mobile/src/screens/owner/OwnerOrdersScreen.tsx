import React, { useEffect, useState } from 'react';
import ScreenSafeArea from '../../components/ScreenSafeArea';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, TextInput, Modal, Pressable, ScrollView,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Order } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { COLORS, RADIUS, SHADOW } from '../../theme';
import {
  compareOrdersByCustomerDate,
  formatScheduledForDisplay,
  parseOrderCreatedAt,
} from '../../lib/orderDisplay';
import { canRecordOrderPayment, canChangeOrderStatus } from '../../lib/salesOrderPolicy';
import {
  getOrderAmountDue,
  PAYMENT_METHOD_OPTIONS,
  recordCustomerAccountPayment,
  type PaymentMethodKey,
} from '../../lib/accountPaymentService';
import { canFilterBySalesAgent, isFieldSalesRep } from '../../lib/crmRepResolve';
import { fetchAssignedClients, fetchTeamFilterAgents, agentsForFilterChips, type CrmAssignableAgent } from '../../lib/crmMobileService';
import DatePickerField from '../../components/DatePickerField';
import { toDateYmd } from '../../lib/crmVisitRouteService';
import { useResolvedStoreId } from '../../hooks/useResolvedStoreId';
import {
  getNextOrderStatus,
  getOrderStatusesForStore,
  getSuggestedOrderStatuses,
} from '../../lib/orderStatusFlow';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b', confirmed: '#3b82f6', processing: '#8b5cf6',
  ready: '#10b981', delivered: '#6b7280', returned: '#f97316', cancelled: '#ef4444',
};

const TERMINAL_STATUSES = new Set(['delivered', 'returned', 'cancelled']);

function capitalizeStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
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
  const { storeId } = useResolvedStoreId();
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [agents, setAgents] = useState<CrmAssignableAgent[]>([]);
  const [myCustomerIds, setMyCustomerIds] = useState<Set<string>>(new Set());
  const [statusModalOrder, setStatusModalOrder] = useState<Order | null>(null);
  const [showAllStatuses, setShowAllStatuses] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodKey>('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);
  const [skipKitchenStatuses, setSkipKitchenStatuses] = useState(false);
  const canMarkPaid = canRecordOrderPayment(user?.userRole);
  const canEditStatus = canChangeOrderStatus(user?.userRole);
  const isSalesRep = isFieldSalesRep(user?.userRole);
  const canFilterAgents = canFilterBySalesAgent(user?.userRole, user?.subAccountRole);
  type OrderDateMode = 'today' | 'yesterday' | 'pick';
  const [orderDateMode, setOrderDateMode] = useState<OrderDateMode>('today');
  const [pickOrderDate, setPickOrderDate] = useState<Date | null>(null);

  useEffect(() => {
    if (!storeId) return;
    void firestore()
      .collection('storeProfiles')
      .doc(storeId)
      .get()
      .then((snap) => {
        setSkipKitchenStatuses(snap.data()?.deliverySettings?.skipKitchenStatuses === true);
      })
      .catch(() => setSkipKitchenStatuses(false));
  }, [storeId]);

  const orderFlowSettings = { skipKitchenStatuses };
  const storeOrderStatuses = getOrderStatusesForStore(storeId, orderFlowSettings);

  useEffect(() => {
    if (!storeId || !user) return;
    if (isSalesRep) {
      void fetchAssignedClients(storeId, { ...user, storeId }, { managerView: false }).then((clients) => {
        setMyCustomerIds(new Set(clients.map((c) => c.id)));
      });
    }
    if (canFilterAgents) {
      void fetchTeamFilterAgents(storeId).then(setAgents);
    }
  }, [storeId, user, isSalesRep, canFilterAgents]);

  useEffect(() => {
    if (!storeId) { setLoading(false); return; }

    const orderLimit = canEditStatus ? 250 : 100;

    const queryRef = firestore()
      .collection('orders')
      .where('storeId', '==', storeId)
      .orderBy('createdAt', 'desc')
      .limit(orderLimit);

    const unsubRecent = queryRef.onSnapshot((snap) => {
      if (!snap) { setLoading(false); return; }
      setRecentOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order)));
      setLoading(false);
    });

    const unsubPending = canEditStatus
      ? firestore()
          .collection('orders')
          .where('storeId', '==', storeId)
          .where('status', '==', 'pending')
          .onSnapshot((snap) => {
            if (!snap) return;
            setPendingOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order)));
          })
      : () => {};

    return () => {
      unsubRecent();
      unsubPending();
    };
  }, [storeId, canEditStatus]);

  const filterAgentChips = React.useMemo(() => agentsForFilterChips(agents), [agents]);

  const selectedOrderYmd = React.useMemo(() => {
    if (orderDateMode === 'today') return toDateYmd(new Date());
    if (orderDateMode === 'yesterday') {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return toDateYmd(d);
    }
    return pickOrderDate ? toDateYmd(pickOrderDate) : toDateYmd(new Date());
  }, [orderDateMode, pickOrderDate]);

  const orderOnSelectedDate = (order: Order) => {
    const created = new Date(parseOrderCreatedAt(order.createdAt));
    const createdYmd = toDateYmd(created);
    const scheduledYmd = order.scheduledFor?.slice(0, 10);
    return createdYmd === selectedOrderYmd || scheduledYmd === selectedOrderYmd || order.status === 'pending';
  };

  const orders = React.useMemo(() => {
    const byId = new Map<string, Order>();
    [...pendingOrders, ...recentOrders].forEach((o) => byId.set(o.id, o));
    return [...byId.values()].sort(compareOrdersByCustomerDate);
  }, [pendingOrders, recentOrders]);

  const orderMatchesAgent = (order: Order & { createdBy?: string; assignedSalesPerson?: string; assignedSalesPersonRepId?: string }) => {
    if (agentFilter === 'all') return true;
    const agent = agents.find((a) => a.id === agentFilter);
    return (
      order.assignedSalesPersonRepId === agentFilter
      || (agent?.userId != null && (order.createdBy === agent.userId || order.assignedSalesPerson === agent.userId))
    );
  };

  const orderVisibleToSalesRep = (order: Order & { createdBy?: string; assignedSalesPerson?: string; customerId?: string }) => {
    if (!isSalesRep || !user) return true;
    return (
      order.createdBy === user.uid
      || order.assignedSalesPerson === user.uid
      || (order.customerId ? myCustomerIds.has(order.customerId) : false)
    );
  };

  const setStatus = async (order: Order, newStatus: string) => {
    try {
      const patch: Record<string, unknown> = {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      };
      if (newStatus === 'confirmed') patch.pendingApproval = false;
      await firestore().collection('orders').doc(order.id).update(patch);
      setStatusModalOrder(null);
      setShowAllStatuses(false);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const openPaymentModal = (order: Order) => {
    const due = getOrderAmountDue(order);
    setPaymentOrder(order);
    setPaymentAmount(due > 0 ? due.toFixed(2) : '');
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentMethod('cash');
    setPaymentNotes('');
  };

  const closePaymentModal = () => {
    if (savingPayment) return;
    setPaymentOrder(null);
  };

  const submitPayment = async () => {
    if (!paymentOrder || !storeId || !user) return;
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Invalid amount', 'Enter a payment amount greater than zero.');
      return;
    }
    if (!paymentOrder.customerName?.trim()) {
      Alert.alert('Missing customer', 'This order has no customer name — cannot credit account.');
      return;
    }

    setSavingPayment(true);
    try {
      const result = await recordCustomerAccountPayment({
        storeId,
        accountId: paymentOrder.customerId || paymentOrder.customerName.trim(),
        accountName: paymentOrder.customerName.trim(),
        amount,
        date: paymentDate,
        method: paymentMethod,
        notes: paymentNotes.trim() || undefined,
        createdBy: user.uid,
        createdByName: user.teamMemberName || user.displayName || user.email || 'Admin',
        sourceOrderId: paymentOrder.id,
      });

      const creditMsg = result.remainingCredit > 0
        ? ` ${paymentOrder.currency} ${result.remainingCredit.toFixed(2)} stays on customer account credit.`
        : '';
      const appliedMsg = result.appliedAmount > 0
        ? `Applied ${paymentOrder.currency} ${result.appliedAmount.toFixed(2)} to open invoices.${creditMsg}`
        : `Full amount credited to customer account (no open invoices to allocate).`;

      Alert.alert('Payment recorded', appliedMsg);
      setPaymentOrder(null);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setSavingPayment(false);
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

  const scopedOrders = orders
    .filter(orderVisibleToSalesRep)
    .filter((o) => orderMatchesAgent(o as Order & { assignedSalesPersonRepId?: string }))
    .filter(orderOnSelectedDate);

  const pendingApprovalOrders = canEditStatus
    ? scopedOrders.filter((o) => o.status === 'pending' && o.createdBy !== user?.uid)
    : [];
  const pendingApprovalIds = new Set(pendingApprovalOrders.map((o) => o.id));

  const displayed = scopedOrders.filter((o) => {
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    const q = search.toLowerCase();
    const matchesSearch = !q || (o.customerName || '').toLowerCase().includes(q) || (o.customerPhone || '').includes(q) || o.id.slice(-6).toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const renderOrder = ({ item }: { item: Order }) => {
    const needsApproval = pendingApprovalIds.has(item.id);
    const unpaid = isOrderUnpaid(item);
    const nextStatus = getNextOrderStatus(item.status, storeId, orderFlowSettings);
    const amountDue = getOrderAmountDue(item);
    const paidAmount = Number(item.amountPaid || 0);
    const isFullyPaid = item.paymentStatus === 'paid' || amountDue <= 0;
    const orderCurrency = item.currency || 'USD';

    return (
      <View style={[styles.card, needsApproval && styles.cardAwaitingApproval]}>
        <View style={styles.cardRow}>
          <Text style={styles.orderId}>#{item.id.slice(-6).toUpperCase()}</Text>
          {canEditStatus ? (
            <TouchableOpacity
              style={[styles.badge, { backgroundColor: STATUS_COLORS[item.status] + '22' }]}
              onPress={() => openStatusPicker(item)}
            >
              <Text style={[styles.badgeText, { color: STATUS_COLORS[item.status] }]}>
                {item.status} ✎
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.badge, { backgroundColor: STATUS_COLORS[item.status] + '22' }]}>
              <Text style={[styles.badgeText, { color: STATUS_COLORS[item.status] }]}>{item.status}</Text>
            </View>
          )}
        </View>
        <Text style={styles.customer}>{item.customerName} {item.customerPhone ? `· ${item.customerPhone}` : ''}</Text>
        {item.scheduledFor ? (
          <Text style={styles.scheduled}>Scheduled · {formatScheduledForDisplay(item.scheduledFor)}</Text>
        ) : null}
        <Text style={[styles.unpaid, isFullyPaid && { color: COLORS.success }]}>
          {isFullyPaid ? 'Paid' : item.paymentStatus === 'partial' || paidAmount > 0 ? 'Partially paid' : 'Unpaid'}
          {!isFullyPaid ? ` · ${orderCurrency} ${amountDue.toFixed(2)} due` : ''}
          {paidAmount > 0 && !isFullyPaid ? ` (${orderCurrency} ${paidAmount.toFixed(2)} paid)` : ''}
        </Text>
        <Text style={styles.items}>{item.items?.map((i) => `${i.name} ×${i.quantity}`).join(', ')}</Text>
        <Text style={styles.total}>{orderCurrency} {(item.total || 0).toFixed(2)}</Text>

        {canEditStatus ? (
          <View style={styles.actions}>
            {nextStatus ? (
              <TouchableOpacity style={styles.actionBtn} onPress={() => setStatus(item, nextStatus)}>
                <Text style={styles.actionBtnText}>→ {capitalizeStatus(nextStatus)}</Text>
              </TouchableOpacity>
            ) : null}
            {unpaid && canMarkPaid ? (
              <TouchableOpacity
                style={[styles.actionBtn, styles.paidBtn]}
                onPress={() => openPaymentModal(item)}
              >
                <Text style={styles.paidBtnText}>💵 Make payment</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.actionBtn, styles.moreBtn, !nextStatus && !unpaid && { flex: 1 }]}
              onPress={() => openStatusPicker(item)}
            >
              <Text style={[styles.actionBtnText, { color: COLORS.textSecondary }]}>⋯ More</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  };

  const modalOrder = statusModalOrder;
  const suggestedStatuses = modalOrder
    ? getSuggestedOrderStatuses(modalOrder.status, storeId, orderFlowSettings)
    : [];
  const otherStatuses = modalOrder
    ? storeOrderStatuses.filter((s) => s !== modalOrder.status && !suggestedStatuses.includes(s))
    : [];

  return (
    <ScreenSafeArea style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Search by name, phone or order #"
        value={search}
        onChangeText={setSearch}
      />

      {canFilterAgents ? (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ id: 'all', name: 'All agents' }, ...filterAgentChips]}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.filterRowContent}
          renderItem={({ item: a }) => (
            <TouchableOpacity
              style={[styles.chip, agentFilter === a.id && styles.chipActive]}
              onPress={() => setAgentFilter(a.id)}
            >
              <Text style={[styles.chipText, agentFilter === a.id && styles.chipTextActive]}>{a.name}</Text>
            </TouchableOpacity>
          )}
        />
      ) : null}

      <View style={styles.filterRowWrap}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={['today', 'yesterday', 'pick'] as OrderDateMode[]}
          keyExtractor={(s) => s}
          contentContainerStyle={styles.filterRowContent}
          renderItem={({ item: mode }) => (
            <TouchableOpacity
              style={[styles.chip, orderDateMode === mode && styles.chipActive]}
              onPress={() => {
                setOrderDateMode(mode);
                if (mode === 'pick' && !pickOrderDate) setPickOrderDate(new Date());
              }}
            >
              <Text style={[styles.chipText, orderDateMode === mode && styles.chipTextActive]}>
                {mode === 'today' ? 'Today' : mode === 'yesterday' ? 'Yesterday' : 'Pick date'}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>
      {orderDateMode === 'pick' ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <DatePickerField
            label="Order date"
            value={pickOrderDate}
            onChange={setPickOrderDate}
            placeholder="Tap to pick date…"
          />
        </View>
      ) : null}

      <View style={styles.filterRowWrap}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={['all', ...storeOrderStatuses]}
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
          Orders · {selectedOrderYmd} · {displayed.length}
        </Text>
      </View>

      {canEditStatus && pendingApprovalOrders.length > 0 ? (
        <View style={styles.approvalBanner}>
          <Text style={styles.approvalBannerTitle}>
            ⏳ {pendingApprovalOrders.length} order{pendingApprovalOrders.length === 1 ? '' : 's'} awaiting your approval
          </Text>
          <Text style={styles.approvalBannerHint}>Tap status → Confirmed to approve</Text>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={(o) => o.id}
          renderItem={renderOrder}
          contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {statusFilter !== 'all' || search.trim()
                ? 'No orders match your filters.'
                : `No orders for ${selectedOrderYmd}.`}
            </Text>
          }
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

      <Modal visible={Boolean(paymentOrder)} transparent animationType="fade" onRequestClose={closePaymentModal}>
        <Pressable style={styles.modalOverlay} onPress={closePaymentModal}>
          <Pressable style={styles.modalBox} onPress={(e) => e.stopPropagation()}>
            {paymentOrder ? (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Make payment</Text>
                  <TouchableOpacity onPress={closePaymentModal} hitSlop={12} disabled={savingPayment}>
                    <Text style={styles.modalClose}>✕</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.modalCurrent}>
                  Customer: <Text style={{ fontWeight: '700' }}>{paymentOrder.customerName}</Text>
                </Text>
                <Text style={styles.paymentHint}>
                  Payment credits the customer account (not one invoice only). Open invoices are paid oldest first.
                </Text>
                <View style={styles.paymentSummary}>
                  <Text style={styles.paymentSummaryText}>
                    This order due: {paymentOrder.currency} {getOrderAmountDue(paymentOrder).toFixed(2)}
                  </Text>
                  <Text style={styles.paymentSummaryText}>
                    Order total: {paymentOrder.currency} {(paymentOrder.total || 0).toFixed(2)}
                  </Text>
                </View>

                <Text style={styles.fieldLabel}>Amount *</Text>
                <TextInput
                  style={styles.paymentInput}
                  value={paymentAmount}
                  onChangeText={setPaymentAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  editable={!savingPayment}
                />

                <Text style={styles.fieldLabel}>Date</Text>
                <TextInput
                  style={styles.paymentInput}
                  value={paymentDate}
                  onChangeText={setPaymentDate}
                  placeholder="YYYY-MM-DD"
                  editable={!savingPayment}
                />

                <Text style={styles.fieldLabel}>Method</Text>
                <View style={styles.methodRow}>
                  {PAYMENT_METHOD_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.methodChip, paymentMethod === opt.key && styles.methodChipActive]}
                      onPress={() => setPaymentMethod(opt.key)}
                      disabled={savingPayment}
                    >
                      <Text style={[styles.methodChipText, paymentMethod === opt.key && styles.methodChipTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Notes (optional)</Text>
                <TextInput
                  style={[styles.paymentInput, { minHeight: 44 }]}
                  value={paymentNotes}
                  onChangeText={setPaymentNotes}
                  placeholder="Reference, cheque #, etc."
                  editable={!savingPayment}
                />

                <TouchableOpacity
                  style={[styles.submitPaymentBtn, savingPayment && { opacity: 0.7 }]}
                  onPress={() => void submitPayment()}
                  disabled={savingPayment}
                >
                  {savingPayment ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.submitPaymentText}>Record payment</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenSafeArea>
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
  approvalBanner: {
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: RADIUS.lg,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fdba74',
  },
  approvalBannerTitle: { fontSize: 14, fontWeight: '700', color: '#9a3412' },
  approvalBannerHint: { fontSize: 12, color: '#c2410c', marginTop: 4 },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 14, marginBottom: 10, ...SHADOW.sm },
  cardAwaitingApproval: { borderWidth: 2, borderColor: '#f59e0b', backgroundColor: '#fffbeb' },
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
  fieldLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, marginTop: 10, marginBottom: 4 },
  paymentHint: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 8, lineHeight: 17 },
  paymentSummary: { backgroundColor: COLORS.light, borderRadius: RADIUS.md, padding: 10, marginBottom: 4 },
  paymentSummaryText: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 2 },
  paymentInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 10, fontSize: 15, backgroundColor: COLORS.background },
  methodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  methodChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  methodChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  methodChipText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  methodChipTextActive: { color: '#fff' },
  submitPaymentBtn: { marginTop: 16, backgroundColor: COLORS.success, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center' },
  submitPaymentText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
