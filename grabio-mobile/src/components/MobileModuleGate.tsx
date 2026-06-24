import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useMobileEntitlements } from '../hooks/useMobileEntitlements';
import { COLORS } from '../theme';

type Props = {
  moduleId: string;
  children: React.ReactNode;
  title?: string;
};

export default function MobileModuleGate({ moduleId, children, title }: Props) {
  const { canUse, loading } = useMobileEntitlements();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (!canUse(moduleId)) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>{title ?? 'Module not enabled'}</Text>
        <Text style={styles.body}>This feature is not on your Grabio package.</Text>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8, color: '#111' },
  body: { fontSize: 14, color: '#666', textAlign: 'center' },
});
