import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { canAccessPurchasing } from '../lib/ownerAccess';
import { COLORS, RADIUS } from '../theme';
import ScreenSafeArea from './ScreenSafeArea';

type Props = {
  children: React.ReactNode;
  title?: string;
  /** Defaults to canAccessPurchasing (owner only). */
  isAllowed?: (userRole?: string, subAccountRole?: string) => boolean;
  denyMessage?: string;
};

/** Owner-only sections (purchasing, accounting, catalog admin, etc.). */
export default function OwnerOnlyGate({
  children,
  title = 'This section',
  isAllowed = canAccessPurchasing,
  denyMessage = 'Only the store owner can access this area.',
}: Props) {
  const { user } = useAuth();
  const navigation = useNavigation();
  const allowed = isAllowed(user?.userRole, user?.subAccountRole);

  useEffect(() => {
    if (!allowed) navigation.goBack();
  }, [allowed, navigation]);

  if (!allowed) {
    return (
      <ScreenSafeArea style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{denyMessage}</Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
          <Text style={styles.btnText}>Go back</Text>
        </TouchableOpacity>
      </ScreenSafeArea>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8 },
  body: { fontSize: 15, color: COLORS.textSecondary, marginBottom: 20 },
  btn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
});
