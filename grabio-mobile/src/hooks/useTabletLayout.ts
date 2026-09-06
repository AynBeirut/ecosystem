import { useWindowDimensions } from 'react-native';

const TABLET_MIN_WIDTH = 600;

export function useTabletLayout() {
  const { width, height } = useWindowDimensions();
  const isTablet = Math.min(width, height) >= TABLET_MIN_WIDTH;
  const contentMaxWidth = isTablet ? Math.min(920, width - 48) : width;
  const gridColumns = isTablet ? 3 : 2;
  const horizontalPadding = isTablet ? 24 : 16;

  return { isTablet, contentMaxWidth, gridColumns, horizontalPadding, screenWidth: width };
}
