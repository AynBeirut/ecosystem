import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  Alert, TextInput, ScrollView, ActivityIndicator, RefreshControl, Switch,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../types';
import { COLORS } from '../../theme';
import { registerPushNotifications } from '../../lib/pushNotifications';

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
  notifPref?: 'all' | 'gentle' | 'off';
};

type StoreProfileDoc = {
  name?: string;
  storeName?: string;
  phone?: string;
  email?: string;
  location?: string;
  deliverySettings?: { autoAcceptOrders?: boolean };
};

export default function ProfileScreen() {
  const { user, signOut, isGuest, exitGuestMode } = useAuth();
  const navigation = useNavigation<Nav>();

  const [storeName, setStoreName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [preferredPayment, setPreferredPayment] = useState('cashOnDelivery');
  const [notifPref, setNotifPref] = useState<'all' | 'gentle' | 'off'>('all');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoAcceptOrders, setAutoAcceptOrders] = useState(false);
  const [savingStoreSettings, setSavingStoreSettings] = useState(false);
  const [isStoreProfile, setIsStoreProfile] = useState(false);

  const loadUserProfile = async (uid: string) => {
    const snap = await firestore().collection('users').doc(uid).get();
    if (!snap.exists()) return;
    const d = snap.data() as ProfileDoc;
    setNotifPref(d.notifPref || 'all');
    if (!user?.storeId) {
      setPhone(d.phone || '');
      setAddress(d.address || '');
      setCity(d.city || '');
      setPreferredPayment(d.preferredPayment || 'cashOnDelivery');
    }
  };

  const loadStoreProfile = async (storeId: string) => {
    const snap = await firestore().collection('storeProfiles').doc(storeId).get();
    if (!snap.exists()) return;
    const d = snap.data() as StoreProfileDoc;
    setIsStoreProfile(true);
    setStoreName(String(d.storeName || d.name || '').trim());
    setPhone(String(d.phone || '').trim());
    setEmail(String(d.email || '').trim());
    const location = String(d.location || '').trim();
    setAddress(location);
    setCity('');
    setAutoAcceptOrders(d.deliverySettings?.autoAcceptOrders === true);
  };

  const reloadProfile = useCallback(async () => {
    if (!user || isGuest) {
      setLoading(false);
      return;
    }
    try {
      if (user.storeId) {
        await Promise.all([
          loadStoreProfile(user.storeId),
          loadUserProfile(user.uid),
        ]);
      } else {
        setIsStoreProfile(false);
        setStoreName('');
        await loadUserProfile(user.uid);
      }
    } catch {
      // keep last loaded values
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, isGuest]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void reloadProfile();
    }, [reloadProfile]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    void reloadProfile();
  };

  const handleNotifPref = async (pref: 'all' | 'gentle' | 'off') => {
    setNotifPref(pref);
    if (pref !== 'off' && user) {
      await registerPushNotifications(user.uid, user.storeId);
    }
    if (user) {
      await firestore().collection('users').doc(user.uid).set({ notifPref: pref }, { merge: true });
    }
  };

  const handleSaveStoreSettings = async (nextAutoAccept: boolean) => {
    if (!user?.storeId) return;
    setAutoAcceptOrders(nextAutoAccept);
    setSavingStoreSettings(true);
    try {
      await firestore().collection('storeProfiles').doc(user.storeId).update({
        'deliverySettings.autoAcceptOrders': nextAutoAccept,
      });
    } catch {
      setAutoAcceptOrders(!nextAutoAccept);
      Alert.alert('Error', 'Failed to save store settings.');
    } finally {
      setSavingStoreSettings(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      if (user.storeId && user.isStoreOwner) {
        const location = [address.trim(), city.trim()].filter(Boolean).join(', ');
        await firestore().collection('storeProfiles').doc(user.storeId).set({
          phone: phone.trim(),
          email: email.trim(),
          location,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      }

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

      Alert.alert('Saved', user.storeId ? 'Store contact synced with Grabio.' : 'Your profile has been updated.');
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

  const headerName = isStoreProfile && storeName
    ? storeName
    : (isGuest ? 'Guest' : (user?.displayName || 'User'));
  const headerSubtitle = isStoreProfile
    ? (user?.email || 'Store owner')
    : (isGuest ? 'Browsing as guest' : user?.email);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}>
        <View style={styles.card}>
          <Text style={styles.avatar}>{isStoreProfile ? '🏪' : '👤'}</Text>
          <Text style={styles.name}>{headerName}</Text>
          <Text style={styles.email}>{headerSubtitle}</Text>
          {isStoreProfile ? (
            <Text style={styles.syncHint}>Synced from grabio.space admin profile</Text>
          ) : null}
        </View>

        {!isGuest && (
          <>
            <Text style={styles.sectionTitle}>
              {isStoreProfile ? 'Store contact (from Grabio)' : 'My Details'}
            </Text>

            {isStoreProfile ? (
              <>
                <Text style={styles.label}>Business email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="store@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor="#9ca3af"
                  editable={user?.isStoreOwner}
                />
              </>
            ) : null}

            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+961 3 123 456"
              keyboardType="phone-pad"
              placeholderTextColor="#9ca3af"
              editable={!isStoreProfile || user?.isStoreOwner}
            />

            <Text style={styles.label}>{isStoreProfile ? 'Business location' : 'Delivery Address'}</Text>
            <TextInput
              style={styles.input}
              value={address}
              onChangeText={setAddress}
              placeholder={isStoreProfile ? 'Street, city, country…' : 'Street, building, floor…'}
              placeholderTextColor="#9ca3af"
              editable={!isStoreProfile || user?.isStoreOwner}
            />

            {!isStoreProfile ? (
              <>
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
              </>
            ) : null}

            {(user?.isStoreOwner || !isStoreProfile) ? (
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
              </TouchableOpacity>
            ) : null}

            {!user?.storeId && (
              <>
                <Text style={styles.sectionTitle}>My Account</Text>
                <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate('Favorites' as never)}>
                  <Text style={styles.linkBtnText}>❤️  My Favorites</Text>
                </TouchableOpacity>
              </>
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
                  onPress={() => void handleNotifPref(opt.key)}
                >
                  <Text style={[styles.notifBtnLabel, notifPref === opt.key && styles.notifBtnLabelActive]}>{opt.label}</Text>
                  <Text style={styles.notifBtnDesc}>{opt.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {user?.storeId && user.isStoreOwner ? (
              <>
                <Text style={styles.sectionTitle}>🏪 Store Settings</Text>
                <View style={styles.storeSettingRow}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={styles.storeSettingLabel}>Auto-accept orders</Text>
                    <Text style={styles.storeSettingDesc}>
                      New online orders skip Pending and go straight to Confirmed
                    </Text>
                  </View>
                  <Switch
                    value={autoAcceptOrders}
                    onValueChange={(v) => void handleSaveStoreSettings(v)}
                    disabled={savingStoreSettings}
                    trackColor={{ false: '#e5e7eb', true: COLORS.primary }}
                  />
                </View>
              </>
            ) : null}
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
  syncHint: { fontSize: 11, color: '#9ca3af', marginTop: 6, textAlign: 'center' },
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
  storeSettingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    marginBottom: 20,
  },
  storeSettingLabel: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 4 },
  storeSettingDesc: { fontSize: 12, color: '#6b7280', lineHeight: 17 },
});
