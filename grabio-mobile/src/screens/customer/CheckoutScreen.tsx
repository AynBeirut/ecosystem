import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import auth from '@react-native-firebase/auth';
import { RootStackParamList } from '../../types';
import { useCart } from '../../context/CartContext';
import { API_BASE } from '../../config/firebase';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function CheckoutScreen() {
  const navigation = useNavigation<Nav>();
  const { items, total, clearCart } = useCart();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  if (items.length === 0) {
    navigation.goBack();
    return null;
  }

  const currency = items[0].product.currency || 'USD';
  const storeId = items[0].storeId;

  const handlePlaceOrder = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    setLoading(true);
    try {
      const user = auth().currentUser;
      if (!user) throw new Error('Not authenticated');

      const token = await user.getIdToken();

      const payload = {
        storeId,
        items: items.map((i) => ({
          productId: i.product.id,
          name: i.product.name,
          price: i.product.price,
          quantity: i.quantity,
        })),
        customerName: name.trim(),
        customerPhone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
        paymentMethod: 'cash',
        customerId: user.uid,
        total,
        currency,
      };

      const res = await fetch(`${API_BASE}/payment/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Failed: ${res.status}`);
      }

      const data = await res.json();
      clearCart();
      navigation.replace('OrderTracking', { orderId: data.orderId });
    } catch (err: any) {
      Alert.alert('Checkout failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.sectionTitle}>Order Summary</Text>
      {items.map((i) => (
        <View key={i.product.id} style={styles.summaryItem}>
          <Text style={styles.summaryName}>{i.product.name} × {i.quantity}</Text>
          <Text style={styles.summaryPrice}>{currency} {(i.product.price * i.quantity).toFixed(2)}</Text>
        </View>
      ))}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalAmount}>{currency} {total.toFixed(2)}</Text>
      </View>

      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Your Details</Text>
      <TextInput
        style={styles.input}
        placeholder="Your name *"
        value={name}
        onChangeText={setName}
      />
      <TextInput
        style={styles.input}
        placeholder="Phone number"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />
      <TextInput
        style={[styles.input, { height: 80 }]}
        placeholder="Notes / delivery instructions"
        value={notes}
        onChangeText={setNotes}
        multiline
      />

      <TouchableOpacity style={styles.placeBtn} onPress={handlePlaceOrder} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.placeBtnText}>Place Order · Cash on Delivery</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  summaryItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  summaryName: { fontSize: 14, color: '#374151' },
  summaryPrice: { fontSize: 14, color: '#6366f1', fontWeight: '600' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8 },
  totalLabel: { fontSize: 16, fontWeight: '700', color: '#111827' },
  totalAmount: { fontSize: 16, fontWeight: '800', color: '#6366f1' },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, padding: 13, fontSize: 15, marginBottom: 10, backgroundColor: '#f9fafb' },
  placeBtn: { backgroundColor: '#6366f1', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20, height: 52, justifyContent: 'center' },
  placeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
