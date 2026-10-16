import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { adminUi } from '../../theme/adminUi';
import { COLORS } from '../../theme';

type Props = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export default function ScreenHeader({ eyebrow, title, subtitle, actionLabel, onAction }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.textCol}>
        {eyebrow ? <Text style={adminUi.eyebrow}>{eyebrow}</Text> : null}
        <Text style={adminUi.pageTitle}>{title}</Text>
        {subtitle ? <Text style={adminUi.pageSubtitle}>{subtitle}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <TouchableOpacity style={adminUi.primaryBtn} onPress={onAction}>
          <Text style={adminUi.primaryBtnText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  textCol: { flex: 1 },
});
