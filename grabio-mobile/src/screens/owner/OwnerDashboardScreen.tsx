import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator, TouchableOpacity, FlatList, RefreshControl } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import { COLORS, RADIUS, SHADOW } from '../../theme';

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

    // Real-time orders
    const unsubOrders = firestore()
      .collection('orders')
      .where('storeId', '==', user.storeId)
      .onSnapshot((snap) => {
        if (!snap) return;
        let pending = 0;
        let todayRev = 0;
        let todayCount = 0;
        let yesterdayRev = 0;
        const currency = storeCurrency;
        const newOrders: Stats['newOrders'] = [];

        snap.docs.forEach((d) => {
          const data = d.data();
          const createdAt = data.createdAt?.toDate?.() || new Date(0);
          const isToday = createdAt >= startOfToday;
          const isYesterday = createdAt >= startOfYesterday && createdAt < startOfToday;

          if (data.status === 'pending') {
            pending++;
            if (isToday) newOrders.push({ id: d.id, customerName: data.customerName || 'Guest', total: data.total || 0, currency });
          }
          if (isToday && data.status !== 'cancelled') { todayRev += data.total || 0; todayCount++; }
          if (isYesterday && data.status !== 'cancelled') yesterdayRev += data.total || 0;
        });

        // Real-time low stock
        firestore().collection('products')
          .where('storeId', '==', user.storeId)
          .where('inStock', '==', true)
          .get()
          .then((prodSnap) => {
            const low: Stats['lowStockItems'] = [];
            prodSnap.docs.forEach((p) => {
              const d = p.data();
              if (d.stock != null && d.stock > 0 && d.stock <= (d.lowStockThreshold || 10)) {
                low.push({ id: p.id, name: d.name, stock: d.stock, unit: d.unit });
              }
            });
            setStats({ totalOrders: snap.size, pendingOrders: pending, newOrders: newOrders.slice(0, 3),
              todayRevenue: todayRev, yesterdayRevenue: yesterdayRev, todayCount, currency, lowStockItems: low.slice(0, 5) });
            setLoading(false);
            setRefreshing(false);
          });
      });

    return unsubOrders;
  }, [user?.storeId, refreshKey]);

  const trend = stats.yesterdayRevenue > 0
    ? Math.round((stats.todayRevenue - stats.yesterdayRevenue) / stats.yesterdayRevenue * 100)
    : 0;

  if (loading) return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}>
        {/* Widget 2: Today's Sales */}
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
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('CreateOrder')}>
            <Text style={styles.actionIcon}>➕</Text>
            <Text style={styles.actionLabel}>New Order</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#d1fae5' }]} onPress={() => navigation.navigate('AddEditProduct', {})}>
            <Text style={styles.actionIcon}>📦</Text>
            <Text style={[styles.actionLabel, { color: '#065f46' }]}>Add Product</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.primaryLight }]} onPress={() => navigation.navigate('Inventory')}>
            <Text style={styles.actionIcon}>🏭</Text>
            <Text style={[styles.actionLabel, { color: COLORS.secondary }]}>Inventory</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#fef3c7' }]} onPress={() => navigation.navigate('Purchases')}>
            <Text style={styles.actionIcon}>🛒</Text>
            <Text style={[styles.actionLabel, { color: '#92400e' }]}>Purchases</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#ede9fe' }]} onPress={() => navigation.navigate('Suppliers')}>
            <Text style={styles.actionIcon}>🤝</Text>
            <Text style={[styles.actionLabel, { color: '#5b21b6' }]}>Suppliers</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#fce7f3' }]} onPress={() => navigation.navigate('AccountStatement')}>
            <Text style={styles.actionIcon}>📒</Text>
            <Text style={[styles.actionLabel, { color: '#9d174d' }]}>Accounts</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#e0e7ff' }]} onPress={() => navigation.navigate('Expenses')}>
            <Text style={styles.actionIcon}>💸</Text>
            <Text style={[styles.actionLabel, { color: '#3730a3' }]}>Expenses</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#dcfce7' }]} onPress={() => navigation.navigate('Customers')}>
            <Text style={styles.actionIcon}>👥</Text>
            <Text style={[styles.actionLabel, { color: '#166534' }]}>Customers</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16, paddingBottom: 40 },
  widget: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 16, marginBottom: 14, borderLeftWidth: 4, ...SHADOW.sm },
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

  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  actionBtn: { flex: 1, minWidth: '45%', backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.lg, paddingVertical: 14, alignItems: 'center' },
  actionIcon: { fontSize: 22, marginBottom: 4 },
  actionLabel: { fontSize: 12, fontWeight: '600', color: COLORS.primary, textAlign: 'center' },
});
