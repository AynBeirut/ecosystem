import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTabletLayout } from '../hooks/useTabletLayout';

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
  centered?: boolean;
};

/** Centers content on tablets with a readable max width. */
export default function TabletScreen({ children, style, centered = true }: Props) {
  const { contentMaxWidth, horizontalPadding } = useTabletLayout();

  return (
    <View style={[styles.outer, style]}>
      <View
        style={[
          styles.inner,
          { maxWidth: contentMaxWidth, paddingHorizontal: horizontalPadding },
          centered && styles.centered,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, width: '100%' },
  inner: { flex: 1, width: '100%' },
  centered: { alignSelf: 'center' },
});
