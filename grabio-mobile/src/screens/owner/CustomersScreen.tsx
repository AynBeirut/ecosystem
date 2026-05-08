import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, Alert, TextInput, Modal, ScrollView,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { COLORS, RADIUS, SHADOW } from '../../theme';

interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  notes?: string;
  storeId: string;
  createdAt?: unknown;
}

const EMPTY_FORM = { name: '', phone: '', email: '', address: '', city: '', notes: '' };

export default function CustomersScreen() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.storeId) { setLoading(false); return; }
    const unsub = firestore()
      .collection('customers')
      .where('storeId', '==', user.storeId)
      .onSnapshot((snap) => {
        if (!snap) { setLoading(false); return; }
        const data = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Customer))
          .sort((a, b) => a.name.localeCompare(b.name));
        setCustomers(data);
        setLoading(false);
      }, () => setLoading(false));
    return unsub;
  }, [user?.storeId]);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({ name: c.name || '', phone: c.phone || '', email: c.email || '', address: c.address || '', city: c.city || '', notes: c.notes || '' });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      Alert.alert('Required', 'Customer name is required');
      return;
    }
    setSaving(true);
    try {
      const data = {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        notes: form.notes.trim() || null,
        storeId: user!.storeId,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };
      if (editing) {
        await firestore().collection('customers').doc(editing.id).update(data);
      } else {
        await firestore().collection('customers').add({ ...data, createdAt: firestore.FieldValue.serverTimestamp() });
      }
      setShowForm(false);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const filtered = search
    ? customers.filter((c) =>
        (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.phone || '').includes(search) ||
        (c.email || '').toLowerCase().includes(search.toLowerCase()),
      )
    : customers;

  const renderCustomer = ({ item }: { item: Customer }) => (
    <TouchableOpacity style={styles.card} onPress={() => openEdit(item)}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{(item.name || '?')[0].toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{item.name}</Text>
        {item.phone ? <Text style={styles.meta}>📞 {item.phone}</Text> : null}
        {item.email ? <Text style={styles.meta}>✉️ {item.email}</Text> : null}
        {item.city ? <Text style={styles.meta}>📍 {item.city}</Text> : null}
      </View>
      <Text style={styles.editIcon}>✎</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Search customers…"
        value={search}
        onChangeText={setSearch}
      />

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          renderItem={renderCustomer}
          contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
          ListEmptyComponent={<Text style={styles.empty}>No customers yet</Text>}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={openAdd}>
        <Text style={styles.fabText}>＋ Add Customer</Text>
      </TouchableOpacity>

      {/* Add / Edit Modal */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowForm(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editing ? 'Edit Customer' : 'New Customer'}</Text>
            <TouchableOpacity onPress={save} disabled={saving}>
              <Text style={[styles.modalSave, saving && { opacity: 0.5 }]}>Save</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            {(['name', 'phone', 'email', 'address', 'city', 'notes'] as const).map((field) => (
              <View key={field} style={{ marginBottom: 14 }}>
                <Text style={styles.label}>{field.charAt(0).toUpperCase() + field.slice(1)}</Text>
                <TextInput
                  style={styles.input}
                  value={form[field]}
                  onChangeText={(v) => setForm((p) => ({ ...p, [field]: v }))}
                  placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                  keyboardType={field === 'phone' ? 'phone-pad' : field === 'email' ? 'email-address' : 'default'}
                  autoCapitalize={field === 'email' ? 'none' : 'sentences'}
                  multiline={field === 'notes'}
                  numberOfLines={field === 'notes' ? 3 : 1}
                />
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  search: { margin: 12, padding: 10, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, fontSize: 14 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 14, marginBottom: 10, ...SHADOW.sm, gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700', color: COLORS.primary },
  name: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 2 },
  meta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  editIcon: { fontSize: 18, color: COLORS.textMuted },
  empty: { textAlign: 'center', marginTop: 40, color: COLORS.textMuted, fontSize: 15 },
  fab: {
    position: 'absolute', bottom: 24, right: 20, left: 20,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.lg,
    paddingVertical: 15, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalCancel: { fontSize: 16, color: COLORS.textSecondary },
  modalTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  modalSave: { fontSize: 16, color: COLORS.primary, fontWeight: '700' },
  modalBody: { padding: 20 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 12, fontSize: 14, backgroundColor: COLORS.surface },
});
