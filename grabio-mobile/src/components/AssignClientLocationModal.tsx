import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { captureVisitGps, type GpsCoords } from '../lib/geolocation';
import { updateCrmClient, type CrmClient } from '../lib/crmMobileService';
import { COLORS, RADIUS } from '../theme';

type Props = {
  visible: boolean;
  clients: CrmClient[];
  onClose: () => void;
  onSaved?: (clientId: string, clientName: string) => void;
};

function clientHasGps(c: CrmClient): boolean {
  return typeof c.location?.lat === 'number' && typeof c.location?.lng === 'number';
}

export default function AssignClientLocationModal({ visible, clients, onClose, onSaved }: Props) {
  const [search, setSearch] = useState('');
  const [gps, setGps] = useState<GpsCoords | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const capture = useCallback(async () => {
    setCapturing(true);
    try {
      const coords = await captureVisitGps(true);
      setGps(coords);
      if (!coords) {
        Alert.alert('Location', 'Could not get GPS. Step outside or enable location, then tap Refresh.');
      }
    } finally {
      setCapturing(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) {
      setSearch('');
      setGps(null);
      setSavingId(null);
      return;
    }
    void capture();
  }, [visible, capture]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = clients;
    if (q) {
      list = list.filter(
        (c) =>
          (c.name || '').toLowerCase().includes(q)
          || (c.phone || '').includes(q)
          || (c.area || '').toLowerCase().includes(q)
          || (c.district || '').toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      const aHas = clientHasGps(a);
      const bHas = clientHasGps(b);
      if (aHas !== bHas) return aHas ? 1 : -1;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [clients, search]);

  const saveToClient = (client: CrmClient) => {
    if (!gps) {
      Alert.alert('Location', 'Wait for GPS or tap Refresh location.');
      return;
    }
    const name = client.name || 'Client';
    const replace = clientHasGps(client);
    Alert.alert(
      replace ? 'Update client location?' : 'Save location?',
      replace
        ? `Replace saved GPS for ${name} with your current position?`
        : `Save your current position as the location for ${name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: () => {
            setSavingId(client.id);
            void updateCrmClient(client.id, { location: gps })
              .then(() => {
                Alert.alert('Saved', `Location updated for ${name}.`);
                onSaved?.(client.id, name);
                onClose();
              })
              .catch((e) => {
                Alert.alert('Error', e instanceof Error ? e.message : 'Could not save location');
              })
              .finally(() => setSavingId(null));
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>Assign location to client</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>
            We use your live GPS. Pick the client you are standing at — their map pin updates instantly.
          </Text>

          <View style={styles.gpsBox}>
            {capturing && !gps ? (
              <View style={styles.gpsRow}>
                <ActivityIndicator color={COLORS.primary} />
                <Text style={styles.gpsText}>Getting your location…</Text>
              </View>
            ) : gps ? (
              <Text style={styles.gpsText}>
                📍 {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}
                {gps.accuracy != null ? ` · ±${Math.round(gps.accuracy)}m` : ''}
              </Text>
            ) : (
              <Text style={styles.gpsWarn}>No GPS yet — tap refresh</Text>
            )}
            <TouchableOpacity style={styles.refreshBtn} onPress={() => void capture()} disabled={capturing}>
              <Text style={styles.refreshText}>{capturing ? '…' : '↻ Refresh location'}</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.search}
            placeholder="Search client name, phone, area…"
            placeholderTextColor={COLORS.textMuted}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
          />

          <FlatList
            data={filtered}
            keyExtractor={(c) => c.id}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.empty}>No clients match your search.</Text>}
            renderItem={({ item }) => {
              const busy = savingId === item.id;
              return (
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => saveToClient(item)}
                  disabled={Boolean(savingId)}
                >
                  <View style={styles.rowMain}>
                    <Text style={styles.rowName}>{item.name || 'Unnamed'}</Text>
                    <Text style={styles.rowMeta}>
                      {[item.phone, item.area, item.district].filter(Boolean).join(' · ') || '—'}
                    </Text>
                    {clientHasGps(item) ? (
                      <Text style={styles.rowTag}>Has GPS — tap to replace</Text>
                    ) : (
                      <Text style={styles.rowTagNew}>No GPS yet</Text>
                    )}
                  </View>
                  {busy ? <ActivityIndicator size="small" color={COLORS.primary} /> : (
                    <Text style={styles.rowChevron}>›</Text>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    maxHeight: '88%',
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  close: { fontSize: 22, color: COLORS.textMuted, padding: 4 },
  hint: { fontSize: 13, color: COLORS.textSecondary, paddingHorizontal: 16, lineHeight: 19, marginBottom: 12 },
  gpsBox: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  gpsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  gpsText: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  gpsWarn: { fontSize: 14, color: COLORS.warning },
  refreshBtn: { marginTop: 8, alignSelf: 'flex-start' },
  refreshText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  search: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  list: { paddingHorizontal: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rowMain: { flex: 1, paddingRight: 8 },
  rowName: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  rowMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  rowTag: { fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
  rowTagNew: { fontSize: 11, color: COLORS.info, fontWeight: '600', marginTop: 4 },
  rowChevron: { fontSize: 22, color: COLORS.textMuted },
  empty: { textAlign: 'center', color: COLORS.textMuted, marginTop: 24, fontSize: 14 },
});
