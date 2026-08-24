import React from 'react';
import { Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { COLORS } from '../theme';

const WEB_INVOICE = 'https://grabio.space/invoice';

export default function WebAdminLink() {
  return (
    <TouchableOpacity onPress={() => void Linking.openURL(WEB_INVOICE)} style={styles.wrap}>
      <Text style={styles.text}>More tools on grabio.space/invoice</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: 16, alignItems: 'center' },
  text: { fontSize: 12, color: COLORS.textMuted, textDecorationLine: 'underline' },
});
