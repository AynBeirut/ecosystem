import React, { useEffect, useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import AssignClientLocationModal from './AssignClientLocationModal';
import type { CrmClient } from '../lib/crmMobileService';
import { COLORS, RADIUS } from '../theme';

type Props = {
  clients: CrmClient[];
  onSaved?: (clientId: string, clientName: string) => void;
  style?: ViewStyle;
  /** Full-width bar above another bottom button */
  variant?: 'fab' | 'bar';
  /** Open the picker immediately (e.g. from dashboard shortcut) */
  autoOpen?: boolean;
};

export default function AssignClientLocationFab({
  clients,
  onSaved,
  style,
  variant = 'fab',
  autoOpen = false,
}: Props) {
  const [open, setOpen] = useState(autoOpen);

  useEffect(() => {
    if (autoOpen) setOpen(true);
  }, [autoOpen]);

  return (
    <>
      <TouchableOpacity
        style={[variant === 'bar' ? styles.barBtn : styles.fabBtn, style]}
        onPress={() => setOpen(true)}
        activeOpacity={0.85}
      >
        <Text style={variant === 'bar' ? styles.barText : styles.fabText}>📍 Capture location</Text>
        {variant === 'bar' ? (
          <Text style={styles.barHint}>Pick client · save GPS</Text>
        ) : null}
      </TouchableOpacity>
      <AssignClientLocationModal
        visible={open}
        clients={clients}
        onClose={() => setOpen(false)}
        onSaved={onSaved}
      />
    </>
  );
}

const styles = StyleSheet.create({
  fabBtn: {
    backgroundColor: '#059669',
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  fabText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  barBtn: {
    flex: 1,
    backgroundColor: '#059669',
    borderRadius: RADIUS.lg,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  barText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  barHint: { color: '#d1fae5', fontSize: 11, marginTop: 2, fontWeight: '600' },
});
