import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, SafeAreaView, TextInput, Alert } from 'react-native';
import { getFirestore, collection, query, where, onSnapshot, doc, getDoc } from '@react-native-firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Order } from '../../types';
import { useAuth } from '../../context/AuthContext';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b', confirmed: '#3b82f6', preparing: '#8b5cf6',
  ready: '#10b981', delivered: '#6b7280', cancelled: '#ef4444',
};

export default function MyOrdersScreen() {
  const { user, isGuest } = useAuth();
  const navigation = useNavigation<Nav>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Guest lookup state
  const [code, setCode] = useState('');
  const [looking, setLooking] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const db = getFirestore();
    // No orderBy — sorting client-side avoids needing a Firestore composite index
    const q = query(
      collection(db, 'orders'),
      where('customerId', '==', user.uid),
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order));
      // Sort newest-first by createdAt timestamp
      docs.sort((a, b) => {
        const aTs = (a.createdAt as unknown as { seconds?: number })?.seconds || 0;
        const bTs = (b.createdAt as unknown as { seconds?: number })?.seconds || 0;
        return bTs - aTs;
      });
      setOrders(docs);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [user]);

  const handleLookup = useCallback(async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      Alert.alert('Required', 'Please enter your order code from the confirmation email.');
      return;
    }
    setLooking(true);
    try {
      const db = getFirestore();
      // The short code is the last 8 chars of the orderId
      // Try searching by orderId suffix via a snapshot query
      const q = query(
        collection(db, 'orders'),
      );
      // We can't query by suffix in Firestore — instead we'll treat it as full orderId first, then match suffix
      // Try full id first:
      const direct = await getDoc(doc(db, 'orders', trimmed));
      if (direct.exists()) {
        navigation.navigate('OrderTracking', { orderId: trimmed });
        setCode('');
        return;
      }
      // Search by last 8 chars match — Firestore can't do suffix search, so we query all
      // and filter. For guests this is a one-time operation so it's acceptable.
      const snap = await new Promise<Order[]>((resolve, reject) => {
        const unsub = onSnapshot(q, (s) => {
          unsub();
          resolve(s.docs.map((d) => ({ id: d.id, ...d.data() } as Order)));
        }, reject);
      });
      const match = snap.find((o) => o.id.slice(-8).toUpperCase() === trimmed);
      if (match) {
        navigation.navigate('OrderTracking', { orderId: match.id });
        setCode('');
      } else {
        Alert.alert('Not found', 'No order found with that code. Check the email and try again.');
      }
    } catch {
      Alert.alert('Error', 'Could not look up order. Please check your connection.');
    } finally {
      setLooking(false);
    }
  }, [code, navigation]);

  const renderOrder = ({ item }: { item: Order }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('OrderTracking', { orderId: item.id })}
    >
      <View style={styles.cardRow}>
        <Text style={styles.orderId}>#{item.id.slice(-6).toUpperCase()}</Text>
        <View style={[styles.badge, { backgroundColor: (STATUS_COLORS[item.status] || '#9ca3af') + '22' }]}>
          <Text style={[styles.badgeText, { color: STATUS_COLORS[item.status] || '#9ca3af' }]}>
            {item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : 'Unknown'}
          </Text>
        </View>
      </View>
      <Text style={styles.storeName}>{item.storeName || 'Order'}</Text>
      <Text style={styles.itemCount}>
        {(item.items || []).length} item(s) · {item.currency || ''} {typeof item.total === 'number' ? item.total.toFixed(2) : '—'}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#38B2AC" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (isGuest || !user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.guestBox}>
          <Text style={styles.guestIcon}>📦</Text>
          <Text style={styles.guestTitle}>Track your order</Text>
          <Text style={styles.guestSub}>Enter the 8-character code from your confirmation email.</Text>
          <TextInput
            style={styles.codeInput}
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            placeholder="e.g. AB12CD34"
            placeholderTextColor="#9ca3af"
            autoCapitalize="characters"
            maxLength={8}
            returnKeyType="go"
            onSubmitEditing={handleLookup}
          />
          <TouchableOpacity style={styles.guestBtn} onPress={handleLookup} disabled={looking}>
            {looking
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.guestBtnText}>Track Order</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.signInLink} onPress={() => navigation.navigate('Login' as never)}>
            <Text style={styles.signInLinkText}>Sign in to see all orders</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        renderItem={renderOrder}
        contentContainerStyle={{ padding: 12 }}
        ListEmptyComponent={<Text style={styles.empty}>No orders yet</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  orderId: { fontSize: 15, fontWeight: '700', color: '#111827' },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  storeName: { fontSize: 14, color: '#6b7280', marginBottom: 4 },
  itemCount: { fontSize: 13, color: '#9ca3af' },
  empty: { textAlign: 'center', marginTop: 40, color: '#9ca3af', fontSize: 15 },
  guestBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  guestIcon: { fontSize: 52, marginBottom: 16 },
  guestTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 8, textAlign: 'center' },
  guestSub: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 20 },
  codeInput: {
    width: '100%', backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e5e7eb',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 22,
    fontWeight: '700', color: '#111827', letterSpacing: 6, textAlign: 'center', marginBottom: 14,
  },
  guestBtn: { backgroundColor: '#38B2AC', borderRadius: 12, paddingHorizontal: 28, paddingVertical: 13, width: '100%', alignItems: 'center', marginBottom: 16 },
  guestBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  signInLink: { paddingVertical: 8 },
  signInLinkText: { color: '#38B2AC', fontSize: 14, fontWeight: '600' },
});
