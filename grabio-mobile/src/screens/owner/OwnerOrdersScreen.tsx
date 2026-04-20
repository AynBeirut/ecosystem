import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, Alert,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Order } from '../../types';
import { useAuth } from '../../context/AuthContext';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const NEXT_STATUS: Record<string, string> = {
  pending: 'confirmed',
  confirmed: 'preparing',
  preparing: 'ready',
  ready: 'delivered',
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b', confirmed: '#3b82f6', preparing: '#8b5cf6',
  ready: '#10b981', delivered: '#6b7280', cancelled: '#ef4444',
};

export default function OwnerOrdersScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.storeId) { setLoading(false); return; }
    const unsub = firestore()
      .collection('storeProfiles')
      .doc(user.storeId)
      .collection('orders')
      .orderBy('createdAt', 'desc')
      .onSnapshot((snap) => {
        setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order)));
        setLoading(false);
      });
    return unsub;
  }, [user?.storeId]);

  const updateStatus = async (order: Order) => {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    Alert.alert('Update Status', `Mark order as "${next}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          await firestore()
            .collection('storeProfiles')
            .doc(user!.storeId!)
            .collection('orders')
            .doc(order.id)
            .update({ status: next });
        },
      },
    ]);
  };

  const renderOrder = ({ item }: { item: Order }) => (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <Text style={styles.orderId}>#{item.id.slice(-6).toUpperCase()}</Text>
        <View style={[styles.badge, { backgroundColor: STATUS_COLORS[item.status] + '22' }]}>
          <Text style={[styles.badgeText, { color: STATUS_COLORS[item.status] }]}>
            {item.status}
          </Text>
        </View>
      </View>
      <Text style={styles.customer}>{item.customerName} {item.customerPhone ? `· ${item.customerPhone}` : ''}</Text>
      <Text style={styles.items}>{item.items.map((i) => `${i.name} ×${i.quantity}`).join(', ')}</Text>
      <Text style={styles.total}>{item.currency} {item.total.toFixed(2)}</Text>

      <View style={styles.actions}>
        {NEXT_STATUS[item.status] && (
          <TouchableOpacity style={styles.actionBtn} onPress={() => updateStatus(item)}>
            <Text style={styles.actionBtnText}>→ {NEXT_STATUS[item.status]}</Text>
          </TouchableOpacity>
        )}
        {item.status === 'pending' && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.cancelBtn]}
            onPress={() =>
              Alert.alert('Cancel Order', 'Are you sure?', [
                { text: 'No', style: 'cancel' },
                {
                  text: 'Cancel Order',
                  style: 'destructive',
                  onPress: () =>
                    firestore()
                      .collection('storeProfiles')
                      .doc(user!.storeId!)
                      .collection('orders')
                      .doc(item.id)
                      .update({ status: 'cancelled' }),
                },
              ])
            }
          >
            <Text style={[styles.actionBtnText, { color: '#ef4444' }]}>✕ Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Orders</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          renderItem={renderOrder}
          contentContainerStyle={{ padding: 12 }}
          ListEmptyComponent={<Text style={styles.empty}>No orders yet</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  title: { fontSize: 22, fontWeight: '700', color: '#111827', padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  orderId: { fontSize: 15, fontWeight: '700', color: '#111827' },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  customer: { fontSize: 14, color: '#374151', marginBottom: 4 },
  items: { fontSize: 13, color: '#6b7280', marginBottom: 4 },
  total: { fontSize: 15, color: '#6366f1', fontWeight: '700', marginBottom: 10 },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, backgroundColor: '#e0e7ff', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#fee2e2' },
  actionBtnText: { color: '#6366f1', fontWeight: '600', fontSize: 13 },
  empty: { textAlign: 'center', marginTop: 40, color: '#9ca3af', fontSize: 15 },
});
