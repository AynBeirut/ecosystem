import React from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { COLORS } from '../theme';

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
  edges?: Edge[];
};

/** Respects status bar / notch on Android edge-to-edge. */
export default function ScreenSafeArea({ children, style, edges = ['top', 'bottom'] }: Props) {
  return (
    <SafeAreaView style={[styles.root, style]} edges={edges}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
});
