import React, { useEffect, useState, useCallback } from 'react';
import ScreenSafeArea from '../../components/ScreenSafeArea';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, FlatList, RefreshControl } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import { COLORS, RADIUS, SHADOW } from '../../theme';
import { useMobileEntitlements } from '../../hooks/useMobileEntitlements';
import TabletScreen from '../../components/TabletScreen';
import { useTabletLayout } from '../../hooks/useTabletLayout';
import { canAccessPurchasing, canAccessAccounting, canManageProducts, canViewClientBalances } from '../../lib/ownerAccess';
import { loadFinishedGoodsStockMap, resolveDisplayStock } from '../../lib/inventoryStock';

function parseFirestoreDate(value: unknown): Date {
  if (!value) return new Date(0);
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? d : new Date(0);
  }
  return new Date(0);
}

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Stats {
  totalOrders: number;
  pendingOrders: number;
  newOrders: Array<{ id: string; customerName: string; total: number; currency: string }>;
  todayRevenue: number;
  yesterdayRevenue: number;
  todayCount: number;
  currency: string;
  lowStockItems: Array<{ id: string; name: string; stock: number; unit?: string }>;
}

export default function OwnerDashboardScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const { canUse, loading: entitlementsLoading } = useMobileEntitlements();
  const { gridColumns, isTablet } = useTabletLayout();
  const actionMinWidth = isTablet ? '30%' : '45%';
  const salesCrmEnabled = !entitlementsLoading && canUse('crm');
  const isSalesTeam = user && ['sub_seller', 'sub_manager', 'crm_rep'].includes(user.userRole);
  const isStoreAdmin = user?.userRole === 'owner';
  const isSalesRepOnly = user?.userRole === 'sub_seller';
  const showPurchasing = canAccessPurchasing(user?.userRole);
  const showAccounting = canAccessAccounting(user?.userRole);
  const showClientBalances = canViewClientBalances(user?.userRole, user?.subAccountRole);
  const showProductAdmin = canManageProducts(user?.userRole);
  const [stats, setStats] = useState<Stats>({
    totalOrders: 0, pendingOrders: 0, newOrders: [], todayRevenue: 0,
    yesterdayRevenue: 0, todayCount: 0, currency: 'USD', lowStockItems: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey(k => k + 1);
  }, []);

  useEffect(() => {
    if (!user?.storeId) { setLoading(false); return; }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    // Fetch store currency setting first
    let storeCurrency = 'USD';
    firestore().collection('storeProfiles').doc(user.storeId).get().then((storeDoc) => {
      if (storeDoc.exists()) {
        storeCurrency = storeDoc.data()?.mainCurrency || 'USD';
      }
    });

    // Recent orders for today's sales — one fetch, no live listener on dashboard
    void firestore()
      .collection('orders')
      .where('storeId', '==', user.storeId)
      .orderBy('createdAt', 'desc')
      .limit(80)
      .get()
      .then((snap) => {
        let pending = 0;
        let todayRev = 0;
        let todayCount = 0;
        let yesterdayRev = 0;
        const currency = storeCurrency;
        const newOrders: Stats['newOrders'] = [];

        snap.docs.forEach((d) => {
          const data = d.data();
          const createdAt = parseFirestoreDate(data.createdAt);
          const isToday = createdAt >= startOfToday;
          const isYesterday = createdAt >= startOfYesterday && createdAt < startOfToday;

          if (data.status === 'pending') {
            pending++;
            if (isToday) newOrders.push({ id: d.id, customerName: data.customerName || 'Guest', total: data.total || 0, currency });
          }
          if (isToday && data.status !== 'cancelled') { todayRev += data.total || 0; todayCount++; }
          if (isYesterday && data.status !== 'cancelled') yesterdayRev += data.total || 0;
        });

        setStats((prev) => ({
          ...prev,
          totalOrders: snap.size,
          pendingOrders: pending,
          newOrders: newOrders.slice(0, 3),
          todayRevenue: todayRev,
          yesterdayRevenue: yesterdayRev,
          todayCount,
          currency,
        }));
        setLoading(false);
        setRefreshing(false);
      })
      .catch(() => {
        setLoading(false);
        setRefreshing(false);
      });

    const unsubProducts = Promise.all([
      firestore()
        .collection('products')
        .where('storeId', '==', user.storeId)
        .where('inStock', '==', true)
        .limit(40)
        .get(),
      loadFinishedGoodsStockMap(user.storeId),
    ])
      .then(([prodSnap, fgMap]) => {
        if (!prodSnap) return;
        const low: Stats['lowStockItems'] = [];
        prodSnap.docs.forEach((p) => {
          const d = p.data();
          const stock = resolveDisplayStock(
            { id: p.id, productType: d.productType, stock: d.stock },
            fgMap,
          );
          if (stock != null && stock > 0 && stock <= (d.lowStockThreshold || 10)) {
            low.push({ id: p.id, name: d.name, stock, unit: d.unit });
          }
        });
        setStats((prev) => ({ ...prev, lowStockItems: low.slice(0, 5) }));
      })
      .catch(() => {});

    return () => {};
  }, [user?.storeId, refreshKey]);

  const trend = stats.yesterdayRevenue > 0
    ? Math.round((stats.todayRevenue - stats.yesterdayRevenue) / stats.yesterdayRevenue * 100)
    : 0;

  if (loading) return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />;

  return (
    <ScreenSafeArea style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}>
        <TabletScreen>
          {salesCrmEnabled && (isStoreAdmin || isSalesTeam) && (
            <TouchableOpacity
              style={[styles.widget, styles.crmBanner, { borderLeftColor: COLORS.primary }]}
              onPress={() => navigation.navigate('CrmMyClients')}
            >
              <Text style={styles.widgetTitle}>
                {isStoreAdmin ? '📍 All CRM Clients' : '📍 My CRM Clients'}
              </Text>
              <Text style={styles.salesSub}>
                {isStoreAdmin
                  ? 'Full client list, visits, follow-ups — all reps'
                  : 'Log visits, set follow-ups, view visit schedule'}
              </Text>
            </TouchableOpacity>
          )}
        {/* Widget: Pending orders */}
        {stats.pendingOrders > 0 ? (
          <TouchableOpacity
            style={[styles.widget, { borderLeftColor: COLORS.warning }]}
            onPress={() => navigation.navigate('OwnerTab')}
            activeOpacity={0.85}
          >
            <View style={styles.widgetHeader}>
              <Text style={styles.widgetTitle}>⏳ Pending orders</Text>
              <View style={[styles.badge, { backgroundColor: COLORS.warning }]}>
                <Text style={styles.badgeText}>{stats.pendingOrders}</Text>
              </View>
            </View>
            {stats.newOrders.length > 0 ? stats.newOrders.map((o) => (
              <View key={o.id} style={styles.orderRow}>
                <Text style={styles.orderCustomer}>{o.customerName}</Text>
                <Text style={styles.orderTotal}>{o.currency} {o.total.toFixed(0)}</Text>
              </View>
            )) : (
              <Text style={styles.noData}>Tap to review in Orders</Text>
            )}
          </TouchableOpacity>
        ) : null}
        {/* Widget: Today's Sales */}
        <View style={[styles.widget, { borderLeftColor: COLORS.success }]}>
          <Text style={styles.widgetTitle}>💰 Today's Sales</Text>
          <Text style={styles.salesAmount}>{stats.currency} {stats.todayRevenue.toFixed(0)}</Text>
          <Text style={styles.salesSub}>
            {stats.todayCount} orders {trend !== 0 ? `${trend > 0 ? '↗' : '↘'} ${Math.abs(trend)}% vs yesterday` : ''}
          </Text>
        </View>

        {/* Widget 3: Stock Alerts */}
        {stats.lowStockItems.length > 0 && (
          <TouchableOpacity style={[styles.widget, { borderLeftColor: COLORS.warning }]} onPress={() => navigation.navigate('Inventory')} activeOpacity={0.85}>
            <View style={styles.widgetHeader}>
              <Text style={styles.widgetTitle}>⚠️ Stock Alerts</Text>
              <View style={[styles.badge, { backgroundColor: COLORS.warning }]}><Text style={styles.badgeText}>{stats.lowStockItems.length}</Text></View>
            </View>
            {stats.lowStockItems.map((item) => (
              <View key={item.id} style={styles.orderRow}>
                <Text style={styles.orderCustomer}>{item.name}</Text>
                <Text style={[styles.orderTotal, { color: item.stock <= 5 ? COLORS.error : COLORS.warning }]}>
                  {item.stock} {item.unit || 'units'}
                </Text>
              </View>
            ))}
          </TouchableOpacity>
        )}

        {/* Widget 4: Quick Actions */}
        <Text style={[styles.widgetTitle, { marginBottom: 10, marginTop: 4 }]}>⚡ Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {salesCrmEnabled && (isStoreAdmin || isSalesTeam) ? (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#059669', minWidth: '100%' }]}
              onPress={() => navigation.navigate('CrmMyClients', { openAssignLocation: true })}
            >
              <Text style={styles.actionIcon}>📍</Text>
              <Text style={[styles.actionLabel, { color: '#fff' }]}>Capture location → assign to client</Text>
            </TouchableOpacity>
          ) : null}
          {salesCrmEnabled && isSalesTeam && !isStoreAdmin && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#d1fae5', minWidth: '100%' }]}
              onPress={() => navigation.navigate('CrmMyClients')}
            >
              <Text style={styles.actionIcon}>📍</Text>
              <Text style={[styles.actionLabel, { color: '#047857' }]}>My CRM Clients</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.actionBtn, { minWidth: actionMinWidth }]} onPress={() => navigation.navigate('OwnerProducts')}>
            <Text style={styles.actionIcon}>📋</Text>
            <Text style={styles.actionLabel}>Products</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('CreateOrder')}>
            <Text style={styles.actionIcon}>➕</Text>
            <Text style={styles.actionLabel}>New Order</Text>
          </TouchableOpacity>
          {showProductAdmin ? (
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#d1fae5' }]} onPress={() => navigation.navigate('AddEditProduct', {})}>
              <Text style={styles.actionIcon}>📦</Text>
              <Text style={[styles.actionLabel, { color: '#065f46' }]}>Add Product</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.primaryLight }]} onPress={() => navigation.navigate('Inventory')}>
            <Text style={styles.actionIcon}>🏭</Text>
            <Text style={[styles.actionLabel, { color: COLORS.secondary }]}>Inventory</Text>
          </TouchableOpacity>
          {showPurchasing ? (
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#fef3c7' }]} onPress={() => navigation.navigate('Purchases')}>
              <Text style={styles.actionIcon}>🛒</Text>
              <Text style={[styles.actionLabel, { color: '#92400e' }]}>Purchases</Text>
            </TouchableOpacity>
          ) : null}
          {showPurchasing ? (
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#ede9fe' }]} onPress={() => navigation.navigate('Suppliers')}>
              <Text style={styles.actionIcon}>🤝</Text>
              <Text style={[styles.actionLabel, { color: '#5b21b6' }]}>Suppliers</Text>
            </TouchableOpacity>
          ) : null}
          {showAccounting ? (
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#fce7f3' }]} onPress={() => navigation.navigate('AccountStatement')}>
              <Text style={styles.actionIcon}>📒</Text>
              <Text style={[styles.actionLabel, { color: '#9d174d' }]}>Accounts</Text>
            </TouchableOpacity>
          ) : null}
          {showPurchasing ? (
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#e0e7ff' }]} onPress={() => navigation.navigate('Expenses')}>
              <Text style={styles.actionIcon}>💸</Text>
              <Text style={[styles.actionLabel, { color: '#3730a3' }]}>Expenses</Text>
            </TouchableOpacity>
          ) : null}
          {showClientBalances ? (
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#fff7ed', minWidth: actionMinWidth }]} onPress={() => navigation.navigate('ClientBalances')}>
              <Text style={styles.actionIcon}>💰</Text>
              <Text style={[styles.actionLabel, { color: '#c2410c' }]}>Client balances</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#dcfce7' }]} onPress={() => navigation.navigate(isSalesRepOnly ? 'CrmMyClients' : 'Customers')}>
            <Text style={styles.actionIcon}>👥</Text>
            <Text style={[styles.actionLabel, { color: '#166534' }]}>{isSalesRepOnly ? 'My CRM Clients' : 'Customers'}</Text>
          </TouchableOpacity>
        </View>
        </TabletScreen>
      </ScrollView>
    </ScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16, paddingBottom: 40 },
  widget: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 16, marginBottom: 14, borderLeftWidth: 4, ...SHADOW.sm },
  crmBanner: { marginBottom: 14 },
  widgetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  widgetTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  badge: { backgroundColor: COLORS.primary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  orderRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderTopWidth: 1, borderTopColor: COLORS.border },
  orderCustomer: { fontSize: 13, color: COLORS.textPrimary, fontWeight: '500' },
  orderTotal: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  noData: { fontSize: 13, color: COLORS.textMuted, fontStyle: 'italic', paddingTop: 4 },

  salesAmount: { fontSize: 30, fontWeight: '800', color: COLORS.success, marginVertical: 4 },
  salesSub: { fontSize: 13, color: COLORS.textSecondary },

  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  actionBtn: { flex: 1, minWidth: '45%', backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.lg, paddingVertical: 18, alignItems: 'center', minHeight: 88 },
  actionIcon: { fontSize: 22, marginBottom: 4 },
  actionLabel: { fontSize: 12, fontWeight: '600', color: COLORS.primary, textAlign: 'center' },
});
