import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CLIENT_CONFIG } from '../../config/clientConfig';
import { COLORS, RADIUS } from '../../theme';

const STORAGE_KEY = `@whitelabel_profile_${CLIENT_CONFIG.storeId || 'default'}`;

type SavedProfile = {
  name: string;
  phone: string;
  address: string;
  city: string;
};

export default function ProfileScreen() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const d = JSON.parse(raw) as SavedProfile;
        setName(d.name || '');
        setPhone(d.phone || '');
        setAddress(d.address || '');
        setCity(d.city || '');
      } catch {
        // ignore corrupt storage
      }
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ name, phone, address, city }));
      Alert.alert('Saved', 'Your delivery details are saved on this device.');
    } catch {
      Alert.alert('Error', 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{CLIENT_CONFIG.appName}</Text>
      <Text style={styles.subtitle}>Guest checkout — no account required</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Your name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Full name" />
        <Text style={styles.label}>Phone</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+961…" keyboardType="phone-pad" />
        <Text style={styles.label}>Address</Text>
        <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Street, building" />
        <Text style={styles.label}>City</Text>
        <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="City" />
        <TouchableOpacity style={styles.saveBtn} onPress={() => void handleSave()} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save for checkout'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.hint}>
        Orders and tracking use Firebase — the same backend as your Grabio store dashboard.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary },
  subtitle: { color: COLORS.textSecondary, marginTop: 4, marginBottom: 20 },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 12, fontSize: 15, backgroundColor: COLORS.background },
  saveBtn: { marginTop: 20, backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  hint: { marginTop: 20, fontSize: 12, color: COLORS.textMuted, textAlign: 'center', lineHeight: 18 },
});
