import React, { useCallback, useEffect, useRef, useState } from 'react';
import ScreenSafeArea from '../../components/ScreenSafeArea';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, TextInput, FlatList, ScrollView,
  KeyboardAvoidingView, Platform, useWindowDimensions,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { searchStoreCustomers } from '../../lib/crmMobileService';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList, Product } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { subscribePosProducts } from '../../lib/posCatalog';
import {
  isSalesOrderPlacer,
  isSalesRepPendingOrder,
  resolveMobileOrderStatus,
} from '../../lib/salesOrderPolicy';
import {
  agentsForOrderPicker,
  fetchTaskTeamAgents,
  ORDER_AGENT_UNASSIGNED,
  type CrmAssignableAgent,
} from '../../lib/crmMobileService';
import {
  clearCreateOrderDraft,
  loadCreateOrderDraft,
  saveCreateOrderDraft,
  type CreateOrderDraft,
} from '../../lib/createOrderDraft';
import DatePickerField from '../../components/DatePickerField';
import TimePickerField from '../../components/TimePickerField';
import { resolveStoreIdForMobile } from '../../lib/storeProfileSync';
import { resolveMobileCrmRepId } from '../../lib/crmRepResolve';
import { toDateYmd } from '../../lib/crmVisitRouteService';
import { useResolvedStoreId } from '../../hooks/useResolvedStoreId';
import { COLORS, RADIUS, SHADOW } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type OrderRoute = RouteProp<RootStackParamList, 'CreateOrder'>;

interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  currency: string;
}

interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
}

const PAYMENT_METHODS = ['Cash', 'Card', 'WhatsApp Pay', 'Bank Transfer', 'Other'];

export default function CreateOrderScreen() {
  const { user } = useAuth();
  const { storeId: resolvedStoreId } = useResolvedStoreId();
  const navigation = useNavigation<Nav>();
  const orderRoute = useRoute<OrderRoute>();
  const { height: windowHeight } = useWindowDimensions();
  const salesPlaceOnly = isSalesOrderPlacer(user?.userRole);
  const salesRepPending = isSalesRepPendingOrder(user?.userRole);
  const [salesAgents, setSalesAgents] = useState<CrmAssignableAgent[]>([]);
  const [selectedSalesAgentId, setSelectedSalesAgentId] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>();
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [markPaid, setMarkPaid] = useState(true);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null);
  const [scheduledTime, setScheduledTime] = useState<{ hour: number; minute: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  // Customer autocomplete
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const customerSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [defaultAgentReady, setDefaultAgentReady] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storeId = resolvedStoreId || user?.storeId;

  useEffect(() => {
    if (!user?.storeId || !user.uid) {
      setDraftReady(true);
      return;
    }
    let cancelled = false;
    void loadCreateOrderDraft(user.storeId, user.uid).then((draft) => {
      if (cancelled || !draft) {
        setDraftReady(true);
        return;
      }
      setCustomerName(draft.customerName);
      setCustomerPhone(draft.customerPhone);
      setCustomerSearch(draft.customerSearch);
      setSelectedCustomerId(draft.selectedCustomerId);
      setOrderItems(draft.orderItems);
      setPaymentMethod(draft.paymentMethod);
      setMarkPaid(draft.markPaid);
      setScheduleEnabled(draft.scheduleEnabled);
      setScheduledDate(draft.scheduledDateIso ? new Date(draft.scheduledDateIso) : null);
      setScheduledTime(draft.scheduledTime);
      setSearch(draft.productSearch);
      setDraftRestored(
        Boolean(
          draft.customerName.trim()
          || draft.customerPhone.trim()
          || draft.orderItems.length > 0
          || draft.scheduleEnabled,
        ),
      );
      setDraftReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.storeId, user?.uid]);

  useEffect(() => {
    if (!draftReady || draftRestored) return;
    const prefill = orderRoute.params;
    if (!prefill?.customerId && !prefill?.customerName) return;
    setCustomerName(prefill.customerName || '');
    setCustomerSearch(prefill.customerName || '');
    setCustomerPhone(prefill.customerPhone || '');
    setSelectedCustomerId(prefill.customerId);
  }, [draftReady, draftRestored, orderRoute.params]);

  const persistDraft = useCallback(() => {
    if (!draftReady || !user?.storeId || !user.uid) return;
    const payload: CreateOrderDraft = {
      customerName,
      customerPhone,
      customerSearch,
      selectedCustomerId,
      orderItems,
      paymentMethod,
      markPaid,
      scheduleEnabled,
      scheduledDateIso: scheduledDate ? scheduledDate.toISOString() : null,
      scheduledTime,
      productSearch: search,
      savedAt: new Date().toISOString(),
    };
    void saveCreateOrderDraft(user.storeId, user.uid, payload);
  }, [
    customerName,
    customerPhone,
    customerSearch,
    draftReady,
    markPaid,
    orderItems,
    paymentMethod,
    scheduleEnabled,
    scheduledDate,
    scheduledTime,
    search,
    selectedCustomerId,
    user?.storeId,
    user?.uid,
  ]);

  useEffect(() => {
    if (!draftReady) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      persistDraft();
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [draftReady, persistDraft]);

  const clearDraft = () => {
    if (!user?.storeId || !user?.uid) return;
    setCustomerName('');
    setCustomerPhone('');
    setCustomerSearch('');
    setSelectedCustomerId(undefined);
    setOrderItems([]);
    setPaymentMethod('Cash');
    setMarkPaid(true);
    setScheduleEnabled(false);
    setScheduledDate(null);
    setScheduledTime(null);
    setSearch('');
    setDraftRestored(false);
    void clearCreateOrderDraft(user.storeId, user.uid);
  };

  useEffect(() => {
    if (!storeId || !user?.uid || !draftReady || defaultAgentReady) return;
    let cancelled = false;
    void (async () => {
      const repId = await resolveMobileCrmRepId({ ...user, storeId });
      const list = await fetchTaskTeamAgents(storeId);
      const selfName = user.teamMemberName || user.displayName || user.email?.split('@')[0] || 'You';
      const role = user.userRole === 'owner'
        ? 'owner'
        : user.userRole === 'sub_manager' || user.subAccountRole === 'manager'
          ? 'manager'
          : user.userRole === 'crm_rep'
            ? 'crm_rep'
            : 'sales';
      let agents = agentsForOrderPicker(list, user.uid);
      if (repId && !agents.some((a) => a.id === repId)) {
        agents = [{ id: repId, name: selfName, userId: user.uid, role }, ...agents];
      }
      if (!cancelled) {
        setSalesAgents(agents);
        setSelectedSalesAgentId(repId || agents.find((a) => a.userId === user.uid)?.id || ORDER_AGENT_UNASSIGNED);
        setDefaultAgentReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId, user, draftReady, defaultAgentReady]);

  useEffect(() => {
    if (!user?.storeId) { setLoading(false); return; }
    const unsub = subscribePosProducts(
      user.storeId,
      (rows) => {
        setProducts(rows);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [user?.storeId]);

  useEffect(() => {
    if (!user?.storeId) return;
    if (customerSearchTimer.current) clearTimeout(customerSearchTimer.current);
    if (customerSearch.trim().length < 2) {
      setCustomers([]);
      setCustomerSearchLoading(false);
      return;
    }
    setCustomerSearchLoading(true);
    customerSearchTimer.current = setTimeout(() => {
      void searchStoreCustomers(user.storeId!, customerSearch, 25)
        .then((rows) => {
          setCustomers(rows.map((c) => ({
            id: c.id,
            name: c.name || 'Customer',
            phone: c.phone,
            email: c.email,
          })));
        })
        .catch(() => setCustomers([]))
        .finally(() => setCustomerSearchLoading(false));
    }, 300);
    return () => {
      if (customerSearchTimer.current) clearTimeout(customerSearchTimer.current);
    };
  }, [user?.storeId, customerSearch]);

  const filteredCustomers = customerSearch.length >= 2 ? customers : [];

  const selectCustomer = (c: Customer) => {
    setCustomerName(c.name);
    setCustomerPhone(c.phone || '');
    setSelectedCustomerId(c.id);
    setCustomerSearch(c.name);
    setShowSuggestions(false);
  };

  const filtered = search
    ? products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : products;

  const addToOrder = (product: Product) => {
    setOrderItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        currency: product.currency || 'USD',
      }];
    });
  };

  const removeFromOrder = (productId: string) => {
    setOrderItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  const adjustQty = (productId: string, delta: number) => {
    setOrderItems((prev) => prev
      .map((i) => i.productId === productId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i)
      .filter((i) => i.quantity > 0)
    );
  };

  const total = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const currency = orderItems[0]?.currency || 'USD';

  const selectedAgent = selectedSalesAgentId && selectedSalesAgentId !== ORDER_AGENT_UNASSIGNED
    ? salesAgents.find((a) => a.id === selectedSalesAgentId)
    : null;

  const renderProduct = useCallback(({ item: product }: { item: Product }) => {
    const inOrder = orderItems.find((i) => i.productId === product.id);
    return (
      <View style={[styles.productRow, !product.inStock && styles.productRowMuted]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={styles.productPrice}>
            {product.currency || 'USD'} {product.price.toFixed(2)}
            {!product.inStock ? ' · out of stock' : ''}
          </Text>
        </View>
        {inOrder ? (
          <View style={styles.qtyControls}>
            <TouchableOpacity style={styles.qtyBtn} onPress={() => adjustQty(product.id, -1)}>
              <Text style={styles.qtyBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.qtyValue}>{inOrder.quantity}</Text>
            <TouchableOpacity style={styles.qtyBtn} onPress={() => adjustQty(product.id, 1)}>
              <Text style={styles.qtyBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.addBtn} onPress={() => addToOrder(product)}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [orderItems]);

  const formatScheduledFor = (): string | null => {
    if (!scheduledDate || !scheduledTime) return null;
    const y = scheduledDate.getFullYear();
    const m = String(scheduledDate.getMonth() + 1).padStart(2, '0');
    const d = String(scheduledDate.getDate()).padStart(2, '0');
    const hh = String(scheduledTime.hour).padStart(2, '0');
    const mm = String(scheduledTime.minute).padStart(2, '0');
    return `${y}-${m}-${d}T${hh}:${mm}`;
  };

  const submitOrder = async (paid: boolean) => {
    if (!customerName.trim()) {
      Alert.alert('Missing', 'Customer name is required.');
      return;
    }
    if (!customerPhone.trim()) {
      Alert.alert('Missing', 'Customer phone is required.');
      return;
    }
    if (orderItems.length === 0) {
      Alert.alert('Empty order', 'Add at least one product');
      return;
    }
    if (!salesPlaceOnly && scheduleEnabled && (!scheduledDate || !scheduledTime)) {
      Alert.alert('Schedule', 'Pick a date and time.');
      return;
    }
    setSaving(true);
    try {
      const storeId = await resolveStoreIdForMobile(user!.uid, user!.storeId);
      if (!storeId) {
        Alert.alert('Store not linked', 'Your account is not linked to a store. Ask your manager to fix your team login.');
        return;
      }

      const nowIso = new Date().toISOString();
      const today = nowIso.split('T')[0];
      const scheduledFor = !salesPlaceOnly && scheduleEnabled
        ? formatScheduledFor()
        : salesPlaceOnly && scheduledDate
          ? `${toDateYmd(scheduledDate)}T12:00`
          : null;
      const isPaid = !salesPlaceOnly && paid && !scheduleEnabled;
      const isOwner = user?.userRole === 'owner';
      const orderStatus = resolveMobileOrderStatus(user?.userRole, {
        paid: isPaid,
        scheduled: Boolean(scheduledFor),
      });
      const needsManagerApproval = isSalesRepPendingOrder(user?.userRole);

      let customerId = selectedCustomerId;
      if (!customerId) {
        const phone = customerPhone.trim();
        if (phone) {
          const byPhone = await firestore()
            .collection('customers')
            .where('storeId', '==', storeId)
            .where('phone', '==', phone)
            .limit(1)
            .get();
          if (!byPhone.empty) customerId = byPhone.docs[0].id;
        }
        if (!customerId && !salesPlaceOnly) {
          const created = await firestore().collection('customers').add({
            storeId,
            name: customerName.trim(),
            phone: phone || '',
            email: '',
            createdAt: nowIso,
            notes: 'Created from mobile POS',
          });
          customerId = created.id;
        }
      }

      const pickedAgent = selectedAgent
        || (selectedSalesAgentId && selectedSalesAgentId !== ORDER_AGENT_UNASSIGNED
          ? salesAgents.find((a) => a.id === selectedSalesAgentId)
          : null);

      const assignment = pickedAgent?.id
        ? {
            assignedSalesPerson: pickedAgent.userId || user!.uid,
            assignedSalesPersonRepId: pickedAgent.id,
            assignedSalesPersonName: pickedAgent.name.replace(' (Sales manager)', ''),
          }
        : {};

      await firestore().collection('orders').add({
        storeId,
        ...(customerId ? { customerId } : {}),
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || null,
        items: orderItems.map(({ productId, name, price, quantity }) => ({ productId, name, price, quantity })),
        subtotal: total,
        total,
        currency,
        status: orderStatus,
        paymentStatus: isPaid ? 'paid' : 'unpaid',
        amountPaid: isPaid ? total : 0,
        remainingAmount: isPaid ? 0 : total,
        paymentDate: isPaid ? today : null,
        paymentMethod: isPaid ? paymentMethod.toLowerCase() : '',
        paymentNotes: isPaid ? 'Mobile POS sale' : 'Mobile POS unpaid sale',
        scheduledFor,
        deliveryMethod: scheduledFor ? 'pickup' : 'pickup',
        orderChannel: 'mobile_pos',
        pendingApproval: needsManagerApproval,
        createdAt: nowIso,
        updatedAt: nowIso,
        createdByOwner: isOwner,
        createdBy: user!.uid,
        submittedByRole: user!.userRole,
        ...assignment,
      });
      if (user?.storeId && user.uid) {
        await clearCreateOrderDraft(user.storeId, user.uid);
      }
      setDraftRestored(false);
      Alert.alert(
        salesPlaceOnly ? 'Order placed' : 'Order Created',
        salesPlaceOnly
          ? needsManagerApproval
            ? `Order for ${customerName} saved as pending. Your manager will confirm it.`
            : `Order for ${customerName} placed and confirmed.`
          : scheduledFor
            ? `Scheduled for ${scheduledDate?.toLocaleDateString()} ${scheduledTime ? `${String(scheduledTime.hour).padStart(2, '0')}:${String(scheduledTime.minute).padStart(2, '0')}` : ''}${isPaid ? '' : ' · unpaid'}`
            : isPaid
              ? `Order for ${customerName} placed and marked paid.`
              : `Unpaid order saved for ${customerName}.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (msg.toLowerCase().includes('permission')) {
        Alert.alert(
          'Could not place order',
          salesPlaceOnly
            ? 'Your account cannot save orders yet. Ask your manager — Firestore rules may need updating on the server.'
            : 'You do not have permission to create this order.',
        );
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const formHeightCap = windowHeight * (!salesPlaceOnly ? 0.42 : 0.32);
  const [formContentHeight, setFormContentHeight] = useState(0);
  const formScrollEnabled = formContentHeight > formHeightCap + 4;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 4 : 0}
    >
      <ScreenSafeArea style={styles.flex}>
        <View style={[styles.formWrap, { maxHeight: formHeightCap }]}>
          <ScrollView
            style={styles.formSection}
            contentContainerStyle={styles.formSectionContent}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            scrollEnabled={formScrollEnabled}
            showsVerticalScrollIndicator={formScrollEnabled}
            onContentSizeChange={(_, height) => setFormContentHeight(height)}
          >
          {draftRestored ? (
            <View style={styles.draftBanner}>
              <Text style={styles.draftBannerText}>Draft restored — your last order entry is saved on this device.</Text>
              <TouchableOpacity onPress={clearDraft}>
                <Text style={styles.draftClear}>Clear</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>👤 Customer *</Text>
            <TextInput
              style={styles.input}
              placeholder="Search customer by name or phone…"
              placeholderTextColor="#9ca3af"
              value={customerSearch}
              onChangeText={(v) => {
                setCustomerSearch(v);
                setCustomerName(v);
                setSelectedCustomerId(undefined);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
            />
            {showSuggestions && filteredCustomers.length > 0 ? (
              <View style={styles.suggestions}>
                {filteredCustomers.slice(0, 5).map((c) => (
                  <TouchableOpacity key={c.id} style={styles.suggestionRow} onPress={() => selectCustomer(c)}>
                    <Text style={styles.suggestionName}>{c.name}</Text>
                    {c.phone ? <Text style={styles.suggestionPhone}>{c.phone}</Text> : null}
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            <TextInput
              style={[styles.input, styles.inputLast]}
              placeholder="Phone number *"
              placeholderTextColor="#9ca3af"
              keyboardType="phone-pad"
              value={customerPhone}
              onChangeText={setCustomerPhone}
            />

            <View style={styles.agentBlock}>
              <Text style={styles.agentLabel}>Sales agent</Text>
              {!defaultAgentReady ? (
                <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 8 }} />
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.agentChipScroll}
                  contentContainerStyle={styles.paymentRow}
                  keyboardShouldPersistTaps="handled"
                >
                  <TouchableOpacity
                    style={[styles.paymentBtn, selectedSalesAgentId === ORDER_AGENT_UNASSIGNED && styles.paymentBtnActive]}
                    onPress={() => setSelectedSalesAgentId(ORDER_AGENT_UNASSIGNED)}
                  >
                    <Text
                      style={[styles.paymentBtnText, selectedSalesAgentId === ORDER_AGENT_UNASSIGNED && styles.paymentBtnTextActive]}
                    >
                      Unassigned
                    </Text>
                  </TouchableOpacity>
                  {salesAgents.map((agent) => (
                    <TouchableOpacity
                      key={agent.id}
                      style={[styles.paymentBtn, selectedSalesAgentId === agent.id && styles.paymentBtnActive]}
                      onPress={() => setSelectedSalesAgentId(agent.id)}
                    >
                      <Text
                        style={[styles.paymentBtnText, selectedSalesAgentId === agent.id && styles.paymentBtnTextActive]}
                        numberOfLines={1}
                      >
                        {agent.userId === user?.uid ? `${agent.name.replace(' (Sales manager)', '')} (you)` : agent.name.replace(' (Sales manager)', '')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            {salesPlaceOnly ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Delivery date</Text>
                <DatePickerField
                  label="Pick date"
                  value={scheduledDate}
                  onChange={setScheduledDate}
                  placeholder="Tap to pick date…"
                  minimumDate={new Date()}
                />
                <Text style={styles.inlineHint}>
                  {salesRepPending
                    ? 'Saves as pending — manager confirms in Orders.'
                    : 'Auto-confirmed when you place it.'}
                </Text>
              </View>
            ) : (
              <Text style={styles.inlineHint}>
                {salesRepPending
                  ? 'Saves as pending — manager confirms in Orders.'
                  : 'Auto-confirmed when you place it.'}
              </Text>
            )}
          </View>

          {!salesPlaceOnly ? (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Payment</Text>
                <View style={styles.paymentRow}>
                  <TouchableOpacity
                    style={[styles.paymentBtn, markPaid && !scheduleEnabled && styles.paymentBtnActive]}
                    onPress={() => { setMarkPaid(true); setScheduleEnabled(false); }}
                  >
                    <Text style={[styles.paymentBtnText, markPaid && !scheduleEnabled && styles.paymentBtnTextActive]}>Paid now</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.paymentBtn, !markPaid && !scheduleEnabled && styles.paymentBtnActive]}
                    onPress={() => { setMarkPaid(false); setScheduleEnabled(false); }}
                  >
                    <Text style={[styles.paymentBtnText, !markPaid && !scheduleEnabled && styles.paymentBtnTextActive]}>Unpaid</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.paymentBtn, scheduleEnabled && styles.paymentBtnActive]}
                    onPress={() => { setScheduleEnabled(true); setMarkPaid(false); }}
                  >
                    <Text style={[styles.paymentBtnText, scheduleEnabled && styles.paymentBtnTextActive]}>Schedule</Text>
                  </TouchableOpacity>
                </View>
                {markPaid && !scheduleEnabled ? (
                  <View style={[styles.paymentRow, { marginTop: 10 }]}>
                    {PAYMENT_METHODS.map((pm) => (
                      <TouchableOpacity
                        key={pm}
                        style={[styles.paymentBtn, paymentMethod === pm && styles.paymentBtnActive]}
                        onPress={() => setPaymentMethod(pm)}
                      >
                        <Text style={[styles.paymentBtnText, paymentMethod === pm && styles.paymentBtnTextActive]}>
                          {pm}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </View>
              {scheduleEnabled ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Schedule for later</Text>
                  <DatePickerField
                    label="Date"
                    value={scheduledDate}
                    onChange={setScheduledDate}
                    required
                    placeholder="Tap to pick date…"
                    minimumDate={new Date()}
                  />
                  <TimePickerField
                    label="Time"
                    value={scheduledTime}
                    onChange={setScheduledTime}
                    placeholder="Tap to pick time…"
                  />
                  <Text style={styles.hint}>Shows on Orders with a scheduled badge. Payment can be collected later.</Text>
                </View>
              ) : null}
            </>
          ) : null}
          </ScrollView>
        </View>

        <View style={styles.productSection}>
          <View style={styles.productSearchBox}>
            <Text style={styles.sectionTitle}>🛍️ Products ({filtered.length})</Text>
            <TextInput
              style={[styles.input, styles.productSearchInput]}
              placeholder="Search products…"
              placeholderTextColor="#9ca3af"
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
            {orderItems.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectedRow} keyboardShouldPersistTaps="handled">
                {orderItems.map((item) => (
                  <View key={item.productId} style={styles.selectedChip}>
                    <Text style={styles.selectedChipText}>{item.name} ×{item.quantity}</Text>
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </View>
          {loading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: 12 }} />
          ) : (
            <FlatList
              style={styles.productList}
              data={filtered}
              keyExtractor={(p) => p.id}
              renderItem={renderProduct}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              automaticallyAdjustKeyboardInsets
              initialNumToRender={16}
              maxToRenderPerBatch={20}
              windowSize={8}
              ListEmptyComponent={<Text style={styles.emptyProducts}>No products match your search.</Text>}
            />
          )}
        </View>

        <View style={styles.footer}>
          {orderItems.length > 0 ? (
            <View style={styles.footerSummary}>
              <Text style={styles.footerTotalLabel}>Total</Text>
              <Text style={styles.footerTotalAmount}>{currency} {total.toFixed(2)}</Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={[styles.submitBtn, orderItems.length === 0 && { opacity: 0.5 }]}
            onPress={() => void submitOrder(salesPlaceOnly ? false : scheduleEnabled ? false : markPaid)}
            disabled={saving || orderItems.length === 0}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>
                {salesPlaceOnly
                  ? `Place order ${orderItems.length > 0 ? `· ${currency} ${total.toFixed(2)}` : ''}`
                  : scheduleEnabled
                    ? `Schedule order ${orderItems.length > 0 ? `· ${currency} ${total.toFixed(2)}` : ''}`
                    : markPaid
                      ? `Create & mark paid ${orderItems.length > 0 ? `· ${currency} ${total.toFixed(2)}` : ''}`
                      : `Save unpaid ${orderItems.length > 0 ? `· ${currency} ${total.toFixed(2)}` : ''}`}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScreenSafeArea>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  formWrap: { flexGrow: 0, flexShrink: 1 },
  formSection: { flexGrow: 0 },
  formSectionContent: { paddingBottom: 8 },
  agentChipScroll: { flexGrow: 0 },
  productSection: { flex: 1, minHeight: 220 },
  productSearchBox: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 12,
    marginBottom: 6,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    ...SHADOW.sm,
  },
  productSearchInput: { marginBottom: 0 },
  productList: { flex: 1, marginHorizontal: 12, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, paddingHorizontal: 16 },
  footer: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  footerSummary: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  footerTotalLabel: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  footerTotalAmount: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  selectedRow: { marginBottom: 4, maxHeight: 36 },
  selectedChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight,
    marginRight: 8,
  },
  selectedChipText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  emptyProducts: { color: COLORS.textMuted, fontStyle: 'italic', paddingVertical: 16, textAlign: 'center' },
  draftBanner: {
    marginHorizontal: 12,
    marginBottom: 10,
    marginTop: 4,
    padding: 12,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  draftBannerText: { flex: 1, fontSize: 12, color: COLORS.textSecondary },
  draftClear: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  section: { backgroundColor: COLORS.surface, marginHorizontal: 12, marginBottom: 8, borderRadius: RADIUS.lg, padding: 12, ...SHADOW.sm },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 10, fontSize: 14, backgroundColor: COLORS.background, marginBottom: 8, color: '#1A202C' },
  inputLast: { marginBottom: 0 },
  agentBlock: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  agentLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6 },
  inlineHint: { fontSize: 11, color: COLORS.textSecondary, marginTop: 8 },
  suggestions: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, marginTop: -8, marginBottom: 10, overflow: 'hidden' },
  suggestionRow: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  suggestionName: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  suggestionPhone: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },

  paymentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  paymentBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.background },
  paymentBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  paymentBtnText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  paymentBtnTextActive: { color: '#fff', fontWeight: '700' },

  productRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  productRowMuted: { opacity: 0.72 },
  productName: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  productPrice: { fontSize: 13, color: COLORS.primary, marginTop: 1 },
  addBtn: { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },

  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyBtn: { width: 30, height: 30, borderRadius: RADIUS.full, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  qtyBtnText: { color: '#fff', fontSize: 18, fontWeight: '700', lineHeight: 22 },
  qtyValue: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, minWidth: 20, textAlign: 'center' },

  summary: { backgroundColor: COLORS.surface, marginHorizontal: 12, marginBottom: 12, borderRadius: RADIUS.lg, padding: 16, ...SHADOW.sm },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  summaryItem: { fontSize: 13, color: COLORS.textSecondary },
  summaryPrice: { fontSize: 13, color: COLORS.textPrimary, fontWeight: '600' },
  totalLabel: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  totalAmount: { fontSize: 15, fontWeight: '800', color: COLORS.primary },

  submitBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  hint: { fontSize: 12, color: COLORS.textSecondary, marginTop: -4 },
  sectionRequired: { borderColor: COLORS.warning, borderWidth: 1.5 },
  agentError: { fontSize: 12, color: COLORS.error, fontWeight: '600' },
});
