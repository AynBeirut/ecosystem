import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Alert, ActivityIndicator } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { saveClient } from '../../lib/financeService';
import type { RootStackParamList } from '../../types';
import { COLORS, RADIUS } from '../../theme';

type Route = RouteProp<RootStackParamList, 'ClientEditor'>;

export default function ClientEditorScreen() {
  const { user } = useAuth();
  const route = useRoute<Route>();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(!!route.params.clientId);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    if (!user?.storeId || !route.params.clientId) { setLoading(false); return; }
    void firestore().collection('customers').doc(route.params.clientId).get().then((snap) => {
      if (snap.exists()) {
        const d = snap.data()!;
        setName(String(d.name || ''));
        setPhone(String(d.phone || ''));
        setEmail(String(d.email || ''));
        setAddress(String(d.address || ''));
      }
      setLoading(false);
    });
  }, [user?.storeId, route.params.clientId]);

  const save = async () => {
    if (!user?.storeId || !name.trim()) {
      Alert.alert('Required', 'Client name is required');
      return;
    }
    await saveClient(user.storeId, { id: route.params.clientId, name: name.trim(), phone, email, address });
    navigation.goBack();
  };

  if (loading) return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{route.params.clientId ? 'Edit client' : 'New client'}</Text>
        <TextInput style={styles.input} placeholder="Name" value={name} onChangeText={setName} />
        <TextInput style={styles.input} placeholder="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
        <TextInput style={styles.input} placeholder="Address" value={address} onChangeText={setAddress} />
        <TouchableOpacity style={styles.saveBtn} onPress={() => void save()}>
          <Text style={styles.saveText}>Save client</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  input: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 12, marginBottom: 8 },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 16, alignItems: 'center', marginTop: 8 },
  saveText: { color: '#fff', fontWeight: '700' },
});
