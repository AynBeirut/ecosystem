import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Alert, Linking, PermissionsAndroid, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import firestore from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';
import { RootStackParamList } from '../../types';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../config/firebase';
import { COLORS, RADIUS } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type PaymentKey = 'cashOnDelivery' | 'creditCard' | 'debitCard' | 'bankTransfer' | 'paypal' | 'applePay' | 'whatsapp';

const PAYMENT_LABELS: Record<PaymentKey, string> = {
  cashOnDelivery: '💵 Cash on Delivery',
  creditCard: '💳 Credit Card',
  debitCard: '💳 Debit Card',
  bankTransfer: '🏦 Bank Transfer',
  paypal: '🅿️ PayPal',
  applePay: '🍎 Apple Pay',
  whatsapp: '💬 Order via WhatsApp',
};

export default function CheckoutScreen() {
  const navigation = useNavigation<Nav>();
  const { items, total, clearCart } = useCart();
  const { user, isGuest } = useAuth();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [notes, setNotes] = useState('');

  // Load saved delivery info on mount
  // Logged-in users: load from Firestore profile (overrides AsyncStorage)
  // Guests: load from AsyncStorage only
  useEffect(() => {
    if (user && !isGuest) {
      // Pre-fill from auth + Firestore profile
      setName(user.displayName || '');
      setEmail(user.email || '');
      firestore().collection('users').doc(user.uid).get().then((snap) => {
        if (snap.exists()) {
          const d = snap.data()!;
          if (d.phone) setPhone(d.phone);
          if (d.address) setAddress(d.address);
          if (d.city) setCity(d.city);
          // Pre-select preferred payment if available
          if (d.preferredPayment) {
            setPaymentMethod(d.preferredPayment as PaymentKey);
          }
        }
      }).catch(() => {});
    } else {
      // Guest: load from AsyncStorage
      AsyncStorage.getItem('checkout_info').then((raw) => {
        if (!raw) return;
        try {
          const saved = JSON.parse(raw);
          if (saved.name) setName(saved.name);
          if (saved.phone) setPhone(saved.phone);
          if (saved.email) setEmail(saved.email);
          if (saved.address) setAddress(saved.address);
          if (saved.city) setCity(saved.city);
        } catch { /* ignore */ }
      }).catch(() => {});
    }
  }, [user, isGuest]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentKey>('cashOnDelivery');
  const [availableMethods, setAvailableMethods] = useState<PaymentKey[]>(['cashOnDelivery']);
  const [whatsappNumber, setWhatsappNumber] = useState<string | null>(null);
  const [loadingMethods, setLoadingMethods] = useState(true);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);

  const currency = items.length > 0 ? (items[0].product.currency || 'USD') : 'USD';
  const storeId = items.length > 0 ? items[0].storeId : '';
  const storeName = items.length > 0 ? items[0].storeName : '';

  useEffect(() => {
    if (!storeId) { setLoadingMethods(false); return; }
    firestore().collection('storeProfiles').doc(storeId).get().then((docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data()!;
        const pm = data.paymentMethods || {};
        const methods: PaymentKey[] = [];
        if (pm.cashOnDelivery !== false) methods.push('cashOnDelivery');
        if (pm.creditCard) methods.push('creditCard');
        if (pm.debitCard) methods.push('debitCard');
        if (pm.bankTransfer) methods.push('bankTransfer');
        if (pm.paypal) methods.push('paypal');
        if (pm.applePay) methods.push('applePay');
        const waNumber = data.whatsappBusiness || data.whatsappNumber || null;
        if (waNumber) {
          setWhatsappNumber(waNumber);
          methods.push('whatsapp');
        }
        if (methods.length === 0) methods.push('cashOnDelivery');
        setAvailableMethods(methods);
        setPaymentMethod(methods[0]);
      }
    }).catch(() => {}).finally(() => setLoadingMethods(false));
  }, [storeId]);

  const detectLocation = async () => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          { title: 'Location Permission', message: 'We need your location to fill in your delivery address.', buttonPositive: 'Allow' },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permission denied', 'Location permission is required to detect your address.');
          return;
        }
      }
      setLocating(true);
      Geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
              { headers: { 'User-Agent': 'GrabioApp/1.0' } },
            );
            const data = await res.json();
            const addr = data.address || {};
            const road = addr.road || addr.street || '';
            const house = addr.house_number ? `${addr.house_number} ` : '';
            const quarter = addr.quarter || addr.suburb || addr.neighbourhood || '';
            const full = [house + road, quarter].filter(Boolean).join(', ');
            if (full) setAddress(full);
            const cityVal = addr.city || addr.town || addr.village || addr.county || '';
            if (cityVal) setCity(cityVal);
          } catch {
            // fallback: just set coords if reverse geocoding fails
            setAddress(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
          } finally {
            setLocating(false);
          }
        },
        (err) => {
          // GPS timed out — retry with low accuracy (network/cell) which is much faster
          if (err.code === 3 /* TIMEOUT */ || err.code === 2 /* POSITION_UNAVAILABLE */) {
            Geolocation.getCurrentPosition(
              async (pos) => {
                const { latitude, longitude } = pos.coords;
                try {
                  const res = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
                    { headers: { 'User-Agent': 'GrabioApp/1.0' } },
                  );
                  const data = await res.json();
                  const addr = data.address || {};
                  const road = addr.road || addr.street || '';
                  const house = addr.house_number ? `${addr.house_number} ` : '';
                  const quarter = addr.quarter || addr.suburb || addr.neighbourhood || '';
                  const full = [house + road, quarter].filter(Boolean).join(', ');
                  if (full) setAddress(full);
                  const cityVal = addr.city || addr.town || addr.village || addr.county || '';
                  if (cityVal) setCity(cityVal);
                } catch {
                  setAddress(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
                } finally {
                  setLocating(false);
                }
              },
              (err2) => {
                setLocating(false);
                Alert.alert('Location error', 'Could not detect your location. Please enable GPS or enter your address manually.');
              },
              { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
            );
          } else {
            setLocating(false);
            Alert.alert('Location error', err.message || 'Could not get your location. Please enter your address manually.');
          }
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 },
      );
    } catch (e: unknown) {
      setLocating(false);
      Alert.alert('Error', e instanceof Error ? e.message : 'Unknown error');
    }
  };

  const buildWhatsAppUrl = () => {
    if (!whatsappNumber) return null;
    const p = whatsappNumber.replace(/\D/g, '');
    const lines = items.map((i) => `- ${i.quantity}x ${i.product.name} \u2014 ${currency} ${(i.product.price * i.quantity).toFixed(2)}`).join('\n');
    const msg = `Hi, I'd like to place an order from ${storeName}:\n\n${lines}\n\nTotal: ${currency} ${total.toFixed(2)}`;
    return `https://wa.me/${p}?text=${encodeURIComponent(msg)}`;
  };

  const handlePlaceOrder = async () => {
    if (items.length === 0) return;
    if (!name.trim()) { Alert.alert('Required', 'Please enter your name'); return; }
    if (!phone.trim()) { Alert.alert('Required', 'Please enter your phone number'); return; }
    // email and address are optional — not required

    if (paymentMethod === 'whatsapp') {
      const waUrl = buildWhatsAppUrl();
      if (!waUrl) { Alert.alert('Error', 'This store does not have WhatsApp configured'); return; }
      clearCart();
      Linking.openURL(waUrl);
      return;
    }

    setLoading(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (user) {
        const currentUser = getAuth().currentUser;
        if (currentUser) {
          const token = await currentUser.getIdToken();
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const payload = {
        items: items.map((i) => ({
          productId: i.product.id,
          storeId: i.storeId,
          quantity: i.quantity,
        })),
        deliveryInfo: {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || (user?.email ?? ''),
          address: address.trim(),
          city: city.trim(),
          notes: notes.trim() || undefined,
        },
        paymentMethod,
      };

      const res = await fetch(`${API_BASE}/checkout`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        let errMsg = `Error ${res.status}`;
        try {
          errMsg = JSON.parse(errText).error || JSON.parse(errText).message || errMsg;
        } catch {
          // Ignore malformed error payload and keep fallback message
        }
        console.error('Checkout failed:', res.status, errText);
        throw new Error(errMsg);
      }

      const data = await res.json();
      // Save delivery info for next order
      if (user && !isGuest) {
        // Logged-in: save to Firestore profile
        firestore().collection('users').doc(user.uid).set({
          phone: phone.trim(),
          address: address.trim(),
          city: city.trim(),
          preferredPayment: paymentMethod,
          email: user.email,
          displayName: user.displayName,
          updatedAt: new Date().toISOString(),
        }, { merge: true }).catch(() => {});
      } else {
        // Guest: save to AsyncStorage
        AsyncStorage.setItem('checkout_info', JSON.stringify({
          name: name.trim(), phone: phone.trim(), email: email.trim(),
          address: address.trim(), city: city.trim(),
        })).catch(() => {});
      }
      clearCart();
      const orderId = (data.orderIds && data.orderIds[0]) || data.orderId;
      if (orderId) {
        navigation.replace('OrderTracking', { orderId, storeId });
      } else {
        Alert.alert('Order placed!', 'Your order was submitted successfully.');
        navigation.goBack();
      }
    } catch (err: unknown) {
      Alert.alert('Checkout failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (items.length === 0) {
      navigation.goBack();
    }
  }, [items.length, navigation]);

  if (items.length === 0) {
    return null;
  }

  if (loadingMethods) {
    return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 80 }} />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.section}>Order Summary</Text>
      {items.map((i) => (
        <View key={i.product.id} style={styles.summaryRow}>
          <Text style={styles.summaryName}>{i.product.name} × {i.quantity}</Text>
          <Text style={styles.summaryAmt}>{currency} {(i.product.price * i.quantity).toFixed(2)}</Text>
        </View>
      ))}
      <View style={[styles.summaryRow, { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: COLORS.border }]}>
        <Text style={[styles.summaryName, { fontWeight: '700' }]}>Total</Text>
        <Text style={[styles.summaryAmt, { fontSize: 17, fontWeight: '800' }]}>{currency} {total.toFixed(2)}</Text>
      </View>

      <Text style={[styles.section, { marginTop: 20 }]}>Your Details</Text>
      <TextInput style={styles.input} placeholder="Your name *" placeholderTextColor={COLORS.textMuted} value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder="Phone number *" placeholderTextColor={COLORS.textMuted} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <TextInput style={styles.input} placeholder="Email (optional)" placeholderTextColor={COLORS.textMuted} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

      <Text style={[styles.section, { marginTop: 20 }]}>Delivery Address</Text>
      <TouchableOpacity style={styles.locateBtn} onPress={detectLocation} disabled={locating}>
        {locating
          ? <ActivityIndicator size="small" color={COLORS.primary} />
          : <Text style={styles.locateBtnText}>📍 Detect my location</Text>}
      </TouchableOpacity>
      <TextInput style={styles.input} placeholder="Street address (optional)" placeholderTextColor={COLORS.textMuted} value={address} onChangeText={setAddress} />
      <TextInput style={styles.input} placeholder="City" placeholderTextColor={COLORS.textMuted} value={city} onChangeText={setCity} />
      <TextInput style={[styles.input, { height: 72 }]} placeholder="Delivery notes (optional)" placeholderTextColor={COLORS.textMuted} value={notes} onChangeText={setNotes} multiline />

      <Text style={[styles.section, { marginTop: 20 }]}>Payment Method</Text>
      <View style={styles.pillsWrap}>
        {availableMethods.map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.pill, paymentMethod === m && styles.pillActive]}
            onPress={() => setPaymentMethod(m)}
          >
            <Text style={[styles.pillText, paymentMethod === m && styles.pillTextActive]}>
              {PAYMENT_LABELS[m]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.placeBtn} onPress={handlePlaceOrder} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : (
          <Text style={styles.placeBtnText}>
            {paymentMethod === 'whatsapp' ? '💬 Send via WhatsApp' : 'Place Order'}
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  section: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: COLORS.light },
  summaryName: { fontSize: 14, color: COLORS.textSecondary, flex: 1 },
  summaryAmt: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: 13, fontSize: 15, marginBottom: 10, backgroundColor: COLORS.background, color: COLORS.textPrimary },
  pillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  pill: { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 8 },
  pillActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  pillText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  pillTextActive: { color: COLORS.primary, fontWeight: '700' },
  placeBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, padding: 16, alignItems: 'center', marginBottom: 40, height: 54, justifyContent: 'center' },
  placeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  locateBtn: { borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: RADIUS.lg, padding: 12, alignItems: 'center', marginBottom: 10, flexDirection: 'row', justifyContent: 'center', gap: 6, height: 46 },
  locateBtnText: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
});

