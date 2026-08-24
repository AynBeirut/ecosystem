import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { useEntitlements } from '../hooks/useEntitlements';
import type { RootStackParamList } from '../types';
import { COLORS, RADIUS } from '../theme';
import WebAdminLink from '../components/WebAdminLink';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function MenuScreen() {
  const { user, signOut } = useAuth();
  const { canInvoice, canCrm } = useEntitlements();
  const navigation = useNavigation<Nav>();

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Signed in as</Text>
        <Text style={styles.value}>{user?.displayName || user?.email || 'User'}</Text>
        <Text style={styles.meta}>Role: {user?.userRole}</Text>
      </View>
      {canInvoice ? (
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('EstimatesList')}>
            <Text style={styles.rowText}>Estimates</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('ReceiptsList')}>
            <Text style={styles.rowText}>Receipts</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <View style={styles.card}>
        <Text style={styles.meta}>Invoice Manager: {canInvoice ? 'Yes' : 'No'}</Text>
        <Text style={styles.meta}>CRM: {canCrm ? 'Yes' : 'No'}</Text>
      </View>
      <TouchableOpacity style={styles.signOut} onPress={() => void signOut()}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
      <WebAdminLink />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: 16 },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 16 },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  label: { color: COLORS.textSecondary, marginBottom: 4 },
  value: { fontSize: 18, fontWeight: '600', color: COLORS.textPrimary },
  meta: { color: COLORS.textSecondary, marginTop: 4 },
  row: { paddingVertical: 10 },
  rowText: { fontSize: 16, fontWeight: '600', color: COLORS.primary },
  signOut: { marginTop: 12, backgroundColor: COLORS.error, borderRadius: RADIUS.md, padding: 16, alignItems: 'center' },
  signOutText: { color: '#fff', fontWeight: '700' },
});
