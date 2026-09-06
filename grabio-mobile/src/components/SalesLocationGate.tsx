import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { useSalesLocation } from '../context/SalesLocationContext';
import { COLORS, RADIUS } from '../theme';

type Props = { children: React.ReactNode };

const CHECKING_TIMEOUT_MS = 12_000;

/** Blocks CRM until sales/manager enables location — no opt-out. */
export default function SalesLocationGate({ children }: Props) {
  const { required, ready, checking, retry } = useSalesLocation();
  const [checkingTimedOut, setCheckingTimedOut] = useState(false);

  useEffect(() => {
    if (!checking) {
      setCheckingTimedOut(false);
      return undefined;
    }
    const timer = setTimeout(() => setCheckingTimedOut(true), CHECKING_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [checking]);

  if (!required) return <>{children}</>;
  if (ready) return <View style={styles.ready}>{children}</View>;

  const showSpinner = checking && !checkingTimedOut;

  return (
    <View style={styles.blocker}>
      <Text style={styles.icon}>📍</Text>
      <Text style={styles.title}>Location required</Text>
      <Text style={styles.body}>
        This company device must share your location while Grabio is open. Your manager and admin need
        live team locations on the map — location cannot be turned off for sales accounts.
      </Text>
      {showSpinner ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 24 }} />
      ) : (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.primaryBtn} onPress={retry}>
            <Text style={styles.primaryText}>Enable location</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => Linking.openSettings()}>
            <Text style={styles.secondaryText}>Open Settings</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ready: { flex: 1 },
  blocker: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
    backgroundColor: COLORS.background,
  },
  icon: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center' },
  body: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 22,
    maxWidth: 400,
  },
  actions: { marginTop: 28, width: '100%', maxWidth: 320, gap: 12 },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryText: { color: COLORS.textPrimary, fontWeight: '600', fontSize: 16 },
});
