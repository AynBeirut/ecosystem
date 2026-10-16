import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import ScreenSafeArea from '../components/ScreenSafeArea';
import ScreenHeader from '../components/ui/ScreenHeader';
import { useAuth } from '../context/AuthContext';
import { useEntitlements } from '../hooks/useEntitlements';
import type { RootStackParamList } from '../types';
import { adminUi } from '../theme/adminUi';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function Row({
  label,
  hint,
  last,
  onPress,
}: {
  label: string;
  hint?: string;
  last?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[adminUi.rowLink, last ? adminUi.rowLinkLast : null]} onPress={onPress}>
      <Text style={adminUi.rowLinkText}>{label}</Text>
      {hint ? <Text style={adminUi.rowLinkHint}>{hint}</Text> : null}
    </TouchableOpacity>
  );
}

export default function MenuScreen() {
  const { user, signOut } = useAuth();
  const { canInvoice } = useEntitlements();
  const navigation = useNavigation<Nav>();
  const version = Constants.expoConfig?.version ?? '?';
  const code = Constants.expoConfig?.android?.versionCode ?? '?';

  return (
    <ScreenSafeArea edges={['top']} style={adminUi.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenHeader eyebrow="Invoice Manager" title="Settings" subtitle="Account and document preferences" />
        <View style={[adminUi.panelHero, styles.hero]}>
          <Text style={adminUi.panelHeroTitle}>{user?.displayName || user?.email || 'User'}</Text>
          <Text style={adminUi.panelHeroMeta}>Role: {user?.userRole}</Text>
          <Text style={adminUi.panelHeroMeta}>Invoice Manager: {canInvoice ? 'Enabled' : 'Off'}</Text>
          <Text style={adminUi.panelHeroMeta}>Build {version} ({code})</Text>
        </View>
        {canInvoice ? (
          <>
            <Text style={adminUi.sectionLabel}>Documents</Text>
            <View style={[adminUi.panel, styles.section]}>
              <Row label="Estimates" onPress={() => navigation.navigate('EstimatesList')} />
              <Row label="Receipts" onPress={() => navigation.navigate('ReceiptsList')} />
              <Row label="Purchase orders" onPress={() => navigation.navigate('PurchasesList')} />
              <Row
                label="Invoice template"
                hint="Columns, words, and preview"
                onPress={() => navigation.navigate('InvoiceDocumentSettings')}
              />
              <Row
                label="Invoice header"
                hint="Logo, address, signature"
                last
                onPress={() => navigation.navigate('InvoiceHeaderSettings')}
              />
            </View>
          </>
        ) : null}
        <Text style={adminUi.sectionLabel}>Directory</Text>
        <View style={[adminUi.panel, styles.section]}>
          <Row label="Clients" onPress={() => navigation.navigate('ClientsList')} />
          <Row label="Team to-do" hint="Assign work to agents (no billing)" onPress={() => navigation.navigate('TeamTodos')} />
          <Row label="Products" last onPress={() => navigation.navigate('ProductsList')} />
        </View>
        <TouchableOpacity style={styles.signOut} onPress={() => void signOut()}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 24 },
  hero: { marginHorizontal: 16 },
  section: { marginHorizontal: 16, paddingVertical: 4 },
  signOut: { marginHorizontal: 16, marginTop: 8, backgroundColor: '#b91c1c', borderRadius: 12, padding: 16, alignItems: 'center' },
  signOutText: { color: '#fff', fontWeight: '700' },
});
