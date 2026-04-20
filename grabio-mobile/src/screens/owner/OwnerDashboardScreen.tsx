import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '../../context/AuthContext';

interface Stats {
  totalOrders: number;
  pendingOrders: number;
  todayRevenue: number;
  currency: string;
}

export default function OwnerDashboardScreen() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({ totalOrders: 0, pendingOrders: 0, todayRevenue: 0, currency: 'USD' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.storeId) { setLoading(false); return; }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const unsub = firestore()
      .collection('storeProfiles')
      .doc(user.storeId)
      .collection('orders')
      .onSnapshot((snap) => {
        let pending = 0;
        let todayRev = 0;
        let currency = 'USD';

        snap.docs.forEach((d) => {
          const data = d.data();
          currency = data.currency || 'USD';
          if (['pending', 'confirmed', 'preparing'].includes(data.status)) pending++;
          const createdAt = data.createdAt?.toDate?.();
          if (createdAt && createdAt >= startOfDay && data.status !== 'cancelled') {
            todayRev += data.total || 0;
          }
        });

        setStats({ totalOrders: snap.size, pendingOrders: pending, todayRevenue: todayRev, currency });
        setLoading(false);
      });

    return unsub;
  }, [user?.storeId]);

  if (loading) return <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.title}>Dashboard</Text>

        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: '#e0e7ff' }]}>
            <Text style={styles.statIcon}>🛒</Text>
            <Text style={styles.statValue}>{stats.pendingOrders}</Text>
            <Text style={styles.statLabel}>Active Orders</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#d1fae5' }]}>
            <Text style={styles.statIcon}>💰</Text>
            <Text style={styles.statValue}>{stats.currency} {stats.todayRevenue.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Today's Revenue</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#fef3c7' }]}>
            <Text style={styles.statIcon}>📦</Text>
            <Text style={styles.statValue}>{stats.totalOrders}</Text>
            <Text style={styles.statLabel}>Total Orders</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  title: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 20 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { flex: 1, minWidth: '45%', borderRadius: 14, padding: 16, alignItems: 'center' },
  statIcon: { fontSize: 28, marginBottom: 6 },
  statValue: { fontSize: 20, fontWeight: '800', color: '#111827' },
  statLabel: { fontSize: 12, color: '#6b7280', marginTop: 2, textAlign: 'center' },
});
