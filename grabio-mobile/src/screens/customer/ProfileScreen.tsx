import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  Alert, TextInput, ScrollView, ActivityIndicator,
} from 'react-native';
import { getFirestore, doc, getDoc, setDoc } from '@react-native-firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../theme';

const PAYMENT_OPTIONS = [
  { key: 'cashOnDelivery', label: '💵 Cash on Delivery' },
  { key: 'creditCard', label: '💳 Credit Card' },
  { key: 'bankTransfer', label: '🏦 Bank Transfer' },
  { key: 'whatsapp', label: '💬 WhatsApp' },
];

type ProfileDoc = {
  phone?: string;
  location?: string;
  preferredPayment?: string;
};

export default function ProfileScreen() {
  const { user, signOut, isGuest, exitGuestMode } = useAuth();

  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [preferredPayment, setPreferredPayment] = useState('cashOnDelivery');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const db = getFirestore();
    getDoc(doc(db, 'users', user.uid)).then((snap) => {
      if (snap.exists()) {
        const d = snap.data() as ProfileDoc;
        if (d.phone) setPhone(d.phone);
        if (d.location) setLocation(d.location);
        if (d.preferredPayment) setPreferredPayment(d.preferredPayment);
      }
    }).finally(() => setLoading(false));
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const db = getFirestore();
      await setDoc(doc(db, 'users', user.uid), {
        phone: phone.trim(),
        location: location.trim(),
        preferredPayment,
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
      <ScrollView contentContainerStyle={{ padding: 20 }}>
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

            <Text style={styles.label}>Delivery Location</Text>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="Street, city, area..."
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
  signOutBtn: { borderWidth: 1.5, borderColor: '#ef4444', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8 },
  signOutText: { color: '#ef4444', fontWeight: '700', fontSize: 15 },
});
