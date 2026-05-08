import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  Alert, TextInput, ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { getMessaging, requestPermission, AuthorizationStatus } from '@react-native-firebase/messaging';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../types';
import { COLORS } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const PAYMENT_OPTIONS = [
  { key: 'cashOnDelivery', label: '💵 Cash on Delivery' },
  { key: 'creditCard', label: '💳 Credit Card' },
  { key: 'bankTransfer', label: '🏦 Bank Transfer' },
  { key: 'whatsapp', label: '💬 WhatsApp' },
];

type ProfileDoc = {
  phone?: string;
  address?: string;
  city?: string;
  preferredPayment?: string;
};

export default function ProfileScreen() {
  const { user, signOut, isGuest, exitGuestMode } = useAuth();
  const navigation = useNavigation<Nav>();

  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [preferredPayment, setPreferredPayment] = useState('cashOnDelivery');
  const [notifPref, setNotifPref] = useState<'all' | 'gentle' | 'off'>('all');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadProfile = (uid: string) => {
    return firestore().collection('users').doc(uid).get().then((snap) => {
      if (snap.exists()) {
        const d = snap.data() as ProfileDoc & { notifPref?: 'all' | 'gentle' | 'off' };
        if (d.phone) setPhone(d.phone);
        if (d.address) setAddress(d.address);
        if (d.city) setCity(d.city);
        if (d.preferredPayment) setPreferredPayment(d.preferredPayment);
        if (d.notifPref) setNotifPref(d.notifPref);
      }
    }).catch(() => {});
  };

  const onRefresh = () => {
    if (!user) return;
    setRefreshing(true);
    loadProfile(user.uid).finally(() => setRefreshing(false));
  };

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    loadProfile(user.uid).finally(() => setLoading(false));
  }, [user]);

  const handleNotifPref = async (pref: 'all' | 'gentle' | 'off') => {
    setNotifPref(pref);
    if (pref !== 'off') {
      try {
        const status = await requestPermission(getMessaging());
        const enabled = status === AuthorizationStatus.AUTHORIZED
          || status === AuthorizationStatus.PROVISIONAL;
        if (!enabled) {
          Alert.alert('Permission Denied', 'Enable notifications in your phone Settings to receive alerts.');
          setNotifPref('off');
          return;
        }
      } catch {
        // Silently ignore permission errors
      }
    }
    if (user) {
      await firestore().collection('users').doc(user.uid).set({ notifPref: pref }, { merge: true });
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await firestore().collection('users').doc(user.uid).set({
        phone: phone.trim(),
        address: address.trim(),
        city: city.trim(),
        preferredPayment,
        notifPref,
        email: user.email,
        displayName: user.displayName,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch {
      Alert.alert('Error', 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    if (isGuest) { exitGuestMode(); return; }
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  if (loading) return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 60 }} />;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}>
        {/* Info card */}
        <View style={styles.card}>
          <Text style={styles.avatar}>👤</Text>
          <Text style={styles.name}>{isGuest ? 'Guest' : (user?.displayName || 'User')}</Text>
          <Text style={styles.email}>{isGuest ? 'Browsing as guest' : user?.email}</Text>
        </View>

        {!isGuest && (
          <>
            <Text style={styles.sectionTitle}>My Details</Text>

            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+1 234 567 8900"
              keyboardType="phone-pad"
              placeholderTextColor="#9ca3af"
            />

            <Text style={styles.label}>Delivery Address</Text>
            <TextInput
              style={styles.input}
              value={address}
              onChangeText={setAddress}
              placeholder="Street, building, floor…"
              placeholderTextColor="#9ca3af"
            />

            <Text style={styles.label}>City</Text>
            <TextInput
              style={styles.input}
              value={city}
              onChangeText={setCity}
              placeholder="Beirut, Tripoli…"
              placeholderTextColor="#9ca3af"
            />

            <Text style={styles.label}>Preferred Payment Method</Text>
            <View style={styles.paymentOptions}>
              {PAYMENT_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.paymentBtn, preferredPayment === opt.key && styles.paymentBtnActive]}
                  onPress={() => setPreferredPayment(opt.key)}
                >
                  <Text style={[styles.paymentBtnText, preferredPayment === opt.key && styles.paymentBtnTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>My Account</Text>
            {!user?.storeId && (
              <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate('Favorites' as never)}>
                <Text style={styles.linkBtnText}>❤️  My Favorites</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.sectionTitle}>🔔 Notifications</Text>
            <View style={styles.notifRow}>
              {([
                { key: 'all', label: '🔔 All', desc: 'Every update' },
                { key: 'gentle', label: '🔕 Gentle', desc: 'Orders only' },
                { key: 'off', label: '❌ Off', desc: 'No alerts' },
              ] as const).map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.notifBtn, notifPref === opt.key && styles.notifBtnActive]}
                  onPress={() => handleNotifPref(opt.key)}
                >
                  <Text style={[styles.notifBtnLabel, notifPref === opt.key && styles.notifBtnLabelActive]}>{opt.label}</Text>
                  <Text style={styles.notifBtnDesc}>{opt.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>{isGuest ? 'Sign In' : 'Sign Out'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3, marginBottom: 24 },
  avatar: { fontSize: 48, marginBottom: 12 },
  name: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 4 },
  email: { fontSize: 14, color: '#6b7280' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: '#111827', marginBottom: 16 },
  paymentOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  paymentBtn: { borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#fff' },
  paymentBtnActive: { borderColor: COLORS.primary, backgroundColor: '#e0e7ff' },
  paymentBtnText: { fontSize: 13, color: '#6b7280' },
  paymentBtnTextActive: { color: COLORS.primary, fontWeight: '700' },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 12 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  linkBtn: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1.5, borderColor: '#e5e7eb', padding: 14, alignItems: 'center', marginBottom: 10 },
  linkBtnText: { color: '#374151', fontWeight: '600', fontSize: 15 },
  signOutBtn: { borderWidth: 1.5, borderColor: '#ef4444', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8 },
  signOutText: { color: '#ef4444', fontWeight: '700', fontSize: 15 },
  notifRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  notifBtn: { flex: 1, borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12, padding: 10, alignItems: 'center', backgroundColor: '#fff' },
  notifBtnActive: { borderColor: COLORS.primary, backgroundColor: '#e0e7ff' },
  notifBtnLabel: { fontSize: 13, fontWeight: '700', color: '#6b7280', marginBottom: 2 },
  notifBtnLabelActive: { color: COLORS.primary },
  notifBtnDesc: { fontSize: 10, color: '#9ca3af' },
});
