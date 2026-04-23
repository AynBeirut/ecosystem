import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { getFirestore, doc, onSnapshot } from '@react-native-firebase/firestore';
import { useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList, Order } from '../../types';

type Route = RouteProp<RootStackParamList, 'OrderTracking'>;

const STATUS_STEPS = ['pending', 'confirmed', 'preparing', 'ready', 'delivered'];
const STATUS_LABELS: Record<string, string> = {
  pending: 'Order Placed',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready for Pickup',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};
const STATUS_ICONS: Record<string, string> = {
  pending: '⏳', confirmed: '✅', preparing: '👨‍🍳', ready: '📦', delivered: '🎉', cancelled: '❌',
};

export default function OrderTrackingScreen() {
  const { params } = useRoute<Route>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = getFirestore();
    const orderRef = doc(db, 'orders', params.orderId);
    const unsub = onSnapshot(orderRef, (snap) => {
      if (snap.exists()) {
        setOrder({ id: snap.id, ...snap.data() } as Order);
      }
      setLoading(false);
    });
    return unsub;
  }, [params.orderId, params.storeId]);

  if (loading) return <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />;
  if (!order) return <View style={styles.center}><Text>Order not found</Text></View>;

  const currentStep = order.status === 'cancelled' ? -1 : STATUS_STEPS.indexOf(order.status);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.orderId}>Order #{order.id.slice(-6).toUpperCase()}</Text>
      <Text style={styles.storeName}>{order.storeName}</Text>

      {order.status === 'cancelled' ? (
        <View style={styles.cancelledBox}>
          <Text style={styles.cancelledText}>❌ Order Cancelled</Text>
        </View>
      ) : (
        <View style={styles.steps}>
          {STATUS_STEPS.map((step, idx) => (
            <View key={step} style={styles.step}>
              <View style={[styles.stepDot, idx <= currentStep ? styles.stepDotActive : {}]}>
                <Text style={styles.stepIcon}>
                  {idx <= currentStep ? STATUS_ICONS[step] : '○'}
                </Text>
              </View>
              {idx < STATUS_STEPS.length - 1 && (
                <View style={[styles.stepLine, idx < currentStep ? styles.stepLineActive : {}]} />
              )}
              <Text style={[styles.stepLabel, idx <= currentStep ? styles.stepLabelActive : {}]}>
                {STATUS_LABELS[step]}
              </Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.sectionTitle}>Items</Text>
      {order.items.map((item, idx) => (
        <View key={idx} style={styles.itemRow}>
          <Text style={styles.itemName}>{item.name} × {item.quantity}</Text>
          <Text style={styles.itemPrice}>{order.currency} {(item.price * item.quantity).toFixed(2)}</Text>
        </View>
      ))}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalAmount}>{order.currency} {order.total.toFixed(2)}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  orderId: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 4 },
  storeName: { fontSize: 14, color: '#6b7280', marginBottom: 24 },
  steps: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 28, justifyContent: 'space-between' },
  step: { alignItems: 'center', flex: 1 },
  stepDot: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center' },
  stepDotActive: { backgroundColor: '#e0e7ff' },
  stepLine: { position: 'absolute', top: 18, left: '50%', right: '-50%', height: 2, backgroundColor: '#e5e7eb' },
  stepLineActive: { backgroundColor: '#6366f1' },
  stepIcon: { fontSize: 16 },
  stepLabel: { fontSize: 9, color: '#9ca3af', textAlign: 'center', marginTop: 4 },
  stepLabelActive: { color: '#6366f1', fontWeight: '600' },
  cancelledBox: { backgroundColor: '#fee2e2', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 20 },
  cancelledText: { fontSize: 16, fontWeight: '600', color: '#ef4444' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 10 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  itemName: { fontSize: 14, color: '#374151' },
  itemPrice: { fontSize: 14, color: '#6366f1', fontWeight: '600' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  totalLabel: { fontSize: 15, fontWeight: '700', color: '#111827' },
  totalAmount: { fontSize: 15, fontWeight: '800', color: '#6366f1' },
});
