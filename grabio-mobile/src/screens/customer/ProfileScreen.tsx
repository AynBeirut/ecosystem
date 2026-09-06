import React, { useCallback, useState } from 'react';
import ScreenSafeArea from '../../components/ScreenSafeArea';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, TextInput, ScrollView, ActivityIndicator, RefreshControl, Switch,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../types';
import { COLORS } from '../../theme';
import { registerPushNotifications } from '../../lib/pushNotifications';
import TabletScreen from '../../components/TabletScreen';
import {
  loadGrabioStoreProfile,
  loadGrabioUserProfile,
  resolveStoreIdForMobile,
  isStoreTeamMember,
  notifPrefForUser,
  type GrabioStoreProfile,
  type NotifPref,
} from '../../lib/storeProfileSync';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const PAYMENT_OPTIONS = [
  { key: 'cashOnDelivery', label: '💵 Cash on Delivery' },
  { key: 'creditCard', label: '💳 Credit Card' },
  { key: 'bankTransfer', label: '🏦 Bank Transfer' },
  { key: 'whatsapp', label: '💬 WhatsApp' },
];

function canEditStoreProfile(userRole?: string): boolean {
  return userRole === 'owner';
}

function ReadOnlyField({ label, value, placeholder = '—' }: { label: string; value: string; placeholder?: string }) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.readOnly}>{value.trim() || placeholder}</Text>
    </>
  );
}

export default function ProfileScreen() {
  const { user, signOut, isGuest, exitGuestMode } = useAuth();
  const navigation = useNavigation<Nav>();

  const [resolvedStoreId, setResolvedStoreId] = useState<string | null>(null);
  const [storeProfile, setStoreProfile] = useState<GrabioStoreProfile | null>(null);
  const [memberName, setMemberName] = useState('');
  const [roleLabel, setRoleLabel] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [website, setWebsite] = useState('');
  const [description, setDescription] = useState('');
  const [preferredPayment, setPreferredPayment] = useState('cashOnDelivery');
  const [notifPref, setNotifPref] = useState<NotifPref>('all');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoAcceptOrders, setAutoAcceptOrders] = useState(false);
  const [savingStoreSettings, setSavingStoreSettings] = useState(false);

  const isStoreTeam = Boolean(resolvedStoreId && storeProfile);
  const teamMember = isStoreTeamMember(user?.userRole);
  const canEditStore = canEditStoreProfile(user?.userRole);
  const canEditFields = canEditStore || !isStoreTeam;

  const reloadProfile = useCallback(async () => {
    if (!user || isGuest) {
      setLoading(false);
      return;
    }
    try {
      const storeId = await resolveStoreIdForMobile(user.uid, user.storeId);
      const isTeam = isStoreTeamMember(user.userRole);
      setResolvedStoreId(storeId);

      const [grabioStore, grabioUser] = await Promise.all([
        loadGrabioStoreProfile(storeId),
        loadGrabioUserProfile(user.uid, user.email, storeId),
      ]);

      setStoreProfile(grabioStore);
      setMemberName(grabioUser.name);
      setRoleLabel(grabioUser.roleLabel);
      const pref = notifPrefForUser(user.userRole, grabioUser.notifPref);
      setNotifPref(pref);
      setPreferredPayment(grabioUser.preferredPayment);

      if (isTeam) {
        void registerPushNotifications(user.uid, storeId);
        void firestore().collection('users').doc(user.uid).set({ notifPref: 'all' }, { merge: true });
      }

      if (grabioStore) {
        setPhone(grabioStore.phone);
        setEmail(grabioStore.email || grabioUser.email || user.email || '');
        setAddress(grabioStore.location);
        setWebsite(grabioStore.website);
        setDescription(grabioStore.description);
        setAutoAcceptOrders(grabioStore.autoAcceptOrders);
        setCity('');
      } else {
        setPhone(grabioUser.phone);
        setEmail(grabioUser.email || user.email || '');
        setAddress(grabioUser.address);
        setCity(grabioUser.city);
      }
    } catch (err) {
      console.warn('[ProfileScreen] reloadProfile failed', err);
      Alert.alert('Profile', 'Could not load profile from Grabio. Pull to refresh.');
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

  const handleNotifPref = async (pref: NotifPref) => {
    if (teamMember) return;
    setNotifPref(pref);
    if (!user) return;
    try {
      if (pref !== 'off') {
        await registerPushNotifications(user.uid, resolvedStoreId || user.storeId);
      }
      await firestore().collection('users').doc(user.uid).set({ notifPref: pref }, { merge: true });
    } catch {
      Alert.alert('Notifications', 'Could not save preference. Try again.');
      void reloadProfile();
    }
  };

  const handleSaveStoreSettings = async (nextAutoAccept: boolean) => {
    if (!resolvedStoreId || !canEditStore) return;
    setAutoAcceptOrders(nextAutoAccept);
    setSavingStoreSettings(true);
    try {
      await firestore().collection('storeProfiles').doc(resolvedStoreId).update({
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
    if (!user || (isStoreTeam && !canEditStore && !canEditFields)) return;
    setSaving(true);
    try {
      if (resolvedStoreId && canEditStore) {
        await firestore().collection('storeProfiles').doc(resolvedStoreId).set({
          phone: phone.trim(),
          email: email.trim(),
          location: address.trim(),
          website: website.trim(),
          description: description.trim(),
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      }

      await firestore().collection('users').doc(user.uid).set({
        phone: phone.trim(),
        address: address.trim(),
        city: city.trim(),
        preferredPayment,
        notifPref,
        email: email.trim() || user.email,
        name: memberName.trim() || user.displayName,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      Alert.alert('Saved', isStoreTeam ? 'Synced with grabio.space' : 'Your profile has been updated.');
      void reloadProfile();
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

  const storeDisplayName = storeProfile?.storeName || storeProfile?.name || '';
  const headerName = isStoreTeam
    ? (memberName || user?.teamMemberName || user?.email?.split('@')[0] || 'Team member')
    : (isGuest ? 'Guest' : (memberName || user?.displayName || 'User'));
  const headerSubtitle = isStoreTeam
    ? `${roleLabel}${storeDisplayName ? ` · ${storeDisplayName}` : ''}`
    : (isGuest ? 'Browsing as guest' : (email || user?.email));

  return (
    <ScreenSafeArea style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}>
        <TabletScreen>
        <View style={styles.card}>
          <Text style={styles.avatar}>{isStoreTeam ? '🏪' : '👤'}</Text>
          <Text style={styles.name}>{headerName}</Text>
          <Text style={styles.email}>{headerSubtitle}</Text>
          {isStoreTeam ? (
            <Text style={styles.syncHint}>Loaded from grabio.space · pull to refresh</Text>
          ) : null}
        </View>

        {!isGuest && (
          <>
            {isStoreTeam ? (
              <>
                <Text style={styles.sectionTitle}>Store (grabio.space)</Text>
                {storeDisplayName ? (
                  <>
                    <Text style={styles.label}>Business name</Text>
                    <Text style={styles.readOnly}>{storeDisplayName}</Text>
                  </>
                ) : null}
                {description ? (
                  <>
                    <Text style={styles.label}>About</Text>
                    <Text style={styles.readOnly}>{description}</Text>
                  </>
                ) : null}
              </>
            ) : null}

            <Text style={styles.sectionTitle}>
              {isStoreTeam ? 'Contact (synced with Grabio)' : 'My Details'}
            </Text>

            {canEditFields ? (
              <>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="email@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor={COLORS.textMuted}
                />
                <Text style={styles.label}>Phone</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+961 3 123 456"
                  keyboardType="phone-pad"
                  placeholderTextColor={COLORS.textMuted}
                />
                <Text style={styles.label}>{isStoreTeam ? 'Business location' : 'Delivery address'}</Text>
                <TextInput
                  style={styles.input}
                  value={address}
                  onChangeText={setAddress}
                  placeholder={isStoreTeam ? 'Street, city, country…' : 'Street, building, floor…'}
                  placeholderTextColor={COLORS.textMuted}
                />
                {canEditStore && isStoreTeam ? (
                  <>
                    <Text style={styles.label}>Website</Text>
                    <TextInput
                      style={styles.input}
                      value={website}
                      onChangeText={setWebsite}
                      placeholder="https://…"
                      autoCapitalize="none"
                      placeholderTextColor={COLORS.textMuted}
                    />
                  </>
                ) : null}
              </>
            ) : (
              <>
                <ReadOnlyField label="Email" value={email} />
                <ReadOnlyField label="Phone" value={phone} />
                <ReadOnlyField label="Business location" value={address} />
                {website ? <ReadOnlyField label="Website" value={website} /> : null}
              </>
            )}

            {!isStoreTeam ? (
              <>
                <Text style={styles.label}>City</Text>
                <TextInput
                  style={styles.input}
                  value={city}
                  onChangeText={setCity}
                  placeholder="Beirut, Tripoli…"
                  placeholderTextColor={COLORS.textMuted}
                />

                <Text style={styles.label}>Preferred payment</Text>
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

            {canEditFields ? (
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save & sync to Grabio'}</Text>
              </TouchableOpacity>
            ) : isStoreTeam ? (
              <Text style={styles.readOnlyHint}>View only — store admin can edit this profile.</Text>
            ) : null}

            {!isStoreTeam && (
              <>
                <Text style={styles.sectionTitle}>My Account</Text>
                <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate('Favorites' as never)}>
                  <Text style={styles.linkBtnText}>❤️  My Favorites</Text>
                </TouchableOpacity>
              </>
            )}

            <Text style={styles.sectionTitle}>🔔 Notifications</Text>
            {teamMember ? (
              <View style={styles.notifLocked}>
                <Text style={styles.notifLockedLabel}>🔔 All — every update</Text>
                <Text style={styles.readOnlyHint}>
                  Store team always receives order and CRM visit alerts (Mon–Sat, 8am–7pm Beirut).
                </Text>
              </View>
            ) : (
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
            )}

            {resolvedStoreId && canEditStore ? (
              <>
                <Text style={styles.sectionTitle}>🏪 Store settings</Text>
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
        </TabletScreen>
      </ScrollView>
    </ScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3, marginBottom: 24 },
  avatar: { fontSize: 48, marginBottom: 12 },
  name: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 4, textAlign: 'center' },
  email: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
  syncHint: { fontSize: 11, color: '#9ca3af', marginTop: 6, textAlign: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  readOnly: { fontSize: 14, color: '#374151', backgroundColor: '#f3f4f6', borderRadius: 10, padding: 12, marginBottom: 14 },
  readOnlyHint: { fontSize: 12, color: '#6b7280', marginBottom: 16, fontStyle: 'italic' },
  input: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, color: '#111827', marginBottom: 16, minHeight: 52 },
  paymentOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  paymentBtn: { borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#fff' },
  paymentBtnActive: { borderColor: COLORS.primary, backgroundColor: '#e0e7ff' },
  paymentBtnText: { fontSize: 13, color: '#6b7280' },
  paymentBtnTextActive: { color: COLORS.primary, fontWeight: '700' },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12, minHeight: 52 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  linkBtn: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1.5, borderColor: '#e5e7eb', padding: 14, alignItems: 'center', marginBottom: 10 },
  linkBtnText: { color: '#374151', fontWeight: '600', fontSize: 15 },
  signOutBtn: { borderWidth: 1.5, borderColor: '#ef4444', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8, minHeight: 52 },
  signOutText: { color: '#ef4444', fontWeight: '700', fontSize: 15 },
  notifRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  notifLocked: { backgroundColor: '#f0fdf4', borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: '#bbf7d0' },
  notifLockedLabel: { fontSize: 15, fontWeight: '700', color: '#166534', marginBottom: 4 },
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
