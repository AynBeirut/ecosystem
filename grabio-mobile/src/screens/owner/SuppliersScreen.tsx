import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, Alert, TextInput, Modal, ScrollView,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { COLORS, RADIUS, SHADOW } from '../../theme';

interface Supplier {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  storeId: string;
}

const EMPTY_FORM = { name: '', phone: '', email: '', address: '', notes: '' };

export default function SuppliersScreen() {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.storeId) { setLoading(false); return; }
    const unsub = firestore()
      .collection('suppliers')
      .where('storeId', '==', user.storeId)
      .onSnapshot((snap) => {
        if (!snap) { setLoading(false); return; }
        const data = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Supplier))
          .sort((a, b) => a.name.localeCompare(b.name));
        setSuppliers(data);
        setLoading(false);
      }, () => setLoading(false));
    return unsub;
  }, [user?.storeId]);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm({ name: s.name || '', phone: s.phone || '', email: s.email || '', address: s.address || '', notes: s.notes || '' });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name.trim()) { Alert.alert('Required', 'Supplier name is required'); return; }
    setSaving(true);
    try {
      const data = {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
        storeId: user!.storeId,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };
      if (editing) {
        await firestore().collection('suppliers').doc(editing.id).update(data);
      } else {
        await firestore().collection('suppliers').add({ ...data, createdAt: firestore.FieldValue.serverTimestamp() });
      }
      setShowForm(false);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const deleteSupplier = (s: Supplier) => {
    Alert.alert('Delete Supplier', `Delete "${s.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await firestore().collection('suppliers').doc(s.id).delete();
        },
      },
    ]);
  };

  const filtered = search.trim()
    ? suppliers.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()) || s.phone?.includes(search))
    : suppliers;

  return (
    <SafeAreaView style={styles.container}>
      {/* Search + Add */}
      <View style={styles.topBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search suppliers..."
          value={search}
          onChangeText={setSearch}
        />
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : filtered.length === 0 ? (
        <Text style={styles.empty}>{search ? 'No matches.' : 'No suppliers yet. Tap + Add to create one.'}</Text>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item: s }) => (
            <View style={styles.card}>
              <View style={styles.cardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{s.name}</Text>
                  {s.phone && <Text style={styles.meta}>📞 {s.phone}</Text>}
                  {s.email && <Text style={styles.meta}>✉️ {s.email}</Text>}
                  {s.address && <Text style={styles.meta}>📍 {s.address}</Text>}
                  {s.notes && <Text style={styles.notes}>{s.notes}</Text>}
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity onPress={() => openEdit(s)} style={styles.editBtn}>
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteSupplier(s)} style={styles.delBtn}>
                    <Text style={styles.delBtnText}>🗑</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        />
      )}

      {/* Add/Edit Modal */}
      <Modal visible={showForm} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalBox} contentContainerStyle={{ padding: 20 }}>
            <Text style={styles.modalTitle}>{editing ? 'Edit Supplier' : 'New Supplier'}</Text>

            <Text style={styles.label}>Name *</Text>
            <TextInput style={styles.input} value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="Supplier name" />

            <Text style={styles.label}>Phone</Text>
            <TextInput style={styles.input} value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} placeholder="+1 555 0000" keyboardType="phone-pad" />

            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} placeholder="supplier@email.com" keyboardType="email-address" autoCapitalize="none" />

            <Text style={styles.label}>Address</Text>
            <TextInput style={styles.input} value={form.address} onChangeText={(v) => setForm({ ...form, address: v })} placeholder="Street, City" />

            <Text style={styles.label}>Notes</Text>
            <TextInput style={[styles.input, { height: 70 }]} value={form.notes} onChangeText={(v) => setForm({ ...form, notes: v })} placeholder="Payment terms, lead time..." multiline />

            <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{editing ? 'Save Changes' : 'Add Supplier'}</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowForm(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topBar: { flexDirection: 'row', padding: 12, gap: 10, alignItems: 'center' },
  searchInput: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 10, fontSize: 14, backgroundColor: COLORS.surface },
  addBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: 16, paddingVertical: 10 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  empty: { textAlign: 'center', color: COLORS.textMuted, marginTop: 60, fontSize: 15, paddingHorizontal: 20 },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 14, marginBottom: 10, ...SHADOW.sm },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start' },
  name: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  meta: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  notes: { fontSize: 12, color: COLORS.textMuted, marginTop: 4, fontStyle: 'italic' },
  actions: { gap: 6, alignItems: 'flex-end' },
  editBtn: { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 4 },
  editBtnText: { color: COLORS.primary, fontWeight: '600', fontSize: 12 },
  delBtn: { padding: 4 },
  delBtnText: { fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4, marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: RADIUS.md, padding: 12, fontSize: 14, backgroundColor: '#f9fafb', color: '#1A202C' },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, padding: 16, alignItems: 'center', marginTop: 20, marginBottom: 8 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelText: { color: COLORS.textMuted, textAlign: 'center', marginTop: 8, fontSize: 14, paddingBottom: 20 },
});
