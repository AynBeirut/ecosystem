import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ScreenSafeArea from '../../components/ScreenSafeArea';
import CrmLocationPickers from '../../components/CrmLocationPickers';
import GpsInputField, { type GpsValue } from '../../components/GpsInputField';
import { useAuth } from '../../context/AuthContext';
import { useResolvedStoreId } from '../../hooks/useResolvedStoreId';
import { canManageCrmStoreAreas, resolveMobileCrmRepId } from '../../lib/crmRepResolve';
import {
  agentsForClientAssignment,
  createCrmClient,
  fetchCrmAssignableAgents,
  fetchCrmClient,
  updateCrmClient,
  type CrmAssignableAgent,
} from '../../lib/crmMobileService';
import { crmDefaultLocation, type CrmLocationSelection } from '../../lib/crmLebanonLocations';
import { RootStackParamList } from '../../types';
import { COLORS, RADIUS } from '../../theme';

type Route = RouteProp<RootStackParamList, 'CrmClientForm'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function CrmClientFormScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const { storeId } = useResolvedStoreId();
  const clientId = route.params?.clientId;
  const isEdit = Boolean(clientId);
  const isAdmin = canManageCrmStoreAreas(user?.userRole, user?.subAccountRole);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [agents, setAgents] = useState<CrmAssignableAgent[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState<CrmLocationSelection>(crmDefaultLocation());
  const [gps, setGps] = useState<GpsValue>(null);
  const [assignedRepId, setAssignedRepId] = useState<string>('');

  const load = useCallback(async () => {
    if (!storeId) return;
    const agentList = await fetchCrmAssignableAgents(storeId);
    setAgents(agentList);
    if (clientId) {
      const c = await fetchCrmClient(clientId);
      if (c) {
        setName(c.name || '');
        setPhone(c.phone || '');
        setEmail(c.email || '');
        setAddress(c.address || '');
        setNotes(c.notes || '');
        setLocation({
          country: c.country || 'Lebanon',
          district: c.district || '',
          area: c.area || '',
        });
        setGps(c.location || null);
        setAssignedRepId(c.assignedRepId || '');
      }
    } else if (user) {
      const myRep = await resolveMobileCrmRepId({ ...user, storeId });
      if (myRep) setAssignedRepId(myRep);
    }
    setLoading(false);
  }, [clientId, storeId, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!storeId || !user) return;
    if (!name.trim()) {
      Alert.alert('Required', 'Client name is required.');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Required', 'Phone number is required.');
      return;
    }
    if (!address.trim()) {
      Alert.alert('Required', 'Street address is required.');
      return;
    }
    if (!location.district.trim()) {
      Alert.alert('Required', 'Select a district / governorate.');
      return;
    }
    if (!location.area.trim()) {
      Alert.alert('Required', 'Select an area.');
      return;
    }
    setSaving(true);
    try {
      let repId = assignedRepId;
      if (!isEdit && !repId) {
        repId = (await resolveMobileCrmRepId({ ...user, storeId })) || '';
      }
      const payload = {
        name: name.trim(),
        phone,
        email,
        address,
        notes,
        country: location.country,
        district: location.district,
        area: location.area,
        location: gps,
        assignedRepId: repId || null,
      };
      if (isEdit && clientId) {
        const patch = { ...payload };
        if (!isAdmin) delete (patch as { assignedRepId?: string | null }).assignedRepId;
        await updateCrmClient(clientId, patch);
        navigation.goBack();
      } else {
        const id = await createCrmClient(storeId, payload);
        navigation.replace('CrmClientDetail', { clientId: id, clientName: name.trim() });
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save client');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />;
  }

  return (
    <ScreenSafeArea>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{isEdit ? 'Edit client' : 'New CRM client'}</Text>

        <Text style={styles.label}>Name *</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Client name" placeholderTextColor={COLORS.textMuted} />

        <Text style={styles.label}>Phone *</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="Required" placeholderTextColor={COLORS.textMuted} />

        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholderTextColor={COLORS.textMuted} />

        <Text style={styles.label}>Street address *</Text>
        <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Building, street… (required)" placeholderTextColor={COLORS.textMuted} />

        <CrmLocationPickers
          value={location}
          onChange={setLocation}
          storeId={storeId}
          canAddAreas={isAdmin}
          createdByUserId={user?.uid}
          required
        />
        <GpsInputField value={gps} onChange={setGps} />

        {isAdmin ? (
          <>
            <Text style={styles.label}>Assigned to</Text>
            <Text style={styles.hint}>Defaults to you — pick another agent or unassigned if needed</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.repRow}>
              <TouchableOpacity
                style={[styles.repChip, !assignedRepId && styles.repChipActive]}
                onPress={() => setAssignedRepId('')}
              >
                <Text style={[styles.repChipText, !assignedRepId && styles.repChipTextActive]}>Unassigned</Text>
              </TouchableOpacity>
              {agentsForClientAssignment(agents).map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.repChip, assignedRepId === r.id && styles.repChipActive]}
                  onPress={() => setAssignedRepId(r.id)}
                >
                  <Text style={[styles.repChipText, assignedRepId === r.id && styles.repChipTextActive]}>{r.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        ) : !isEdit && assignedRepId ? (
          <>
            <Text style={styles.label}>Assigned to</Text>
            <Text style={styles.assignedFixed}>
              {agentsForClientAssignment(agents).find((a) => a.id === assignedRepId)?.name || 'You'}
            </Text>
          </>
        ) : null}

        <Text style={styles.label}>Notes</Text>
        <TextInput style={[styles.input, styles.textArea]} multiline value={notes} onChangeText={setNotes} placeholderTextColor={COLORS.textMuted} />

        <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create client'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginTop: 12, marginBottom: 6 },
  hint: { fontSize: 12, color: COLORS.textMuted, marginBottom: 8 },
  assignedFixed: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: 14,
    backgroundColor: COLORS.surface,
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  repRow: { marginBottom: 8 },
  repChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.border,
    marginRight: 8,
  },
  repChipActive: { backgroundColor: COLORS.primary },
  repChipText: { fontSize: 13, color: COLORS.textPrimary },
  repChipTextActive: { color: '#fff', fontWeight: '700' },
  saveBtn: {
    marginTop: 24,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
