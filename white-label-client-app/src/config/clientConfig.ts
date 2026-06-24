import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;

/** Per-client build config — set via app.json extra or EAS env at build time. */
export const CLIENT_CONFIG = {
  storeId: extra.storeId?.trim() || '',
  appName: extra.appName?.trim() || 'My Store',
  deepLinkHost: extra.deepLinkHost?.trim() || 'grabio.space',
};

export function assertClientStoreId(): string {
  if (!CLIENT_CONFIG.storeId) {
    throw new Error('Missing storeId in app.json extra — required for white-label builds.');
  }
  return CLIENT_CONFIG.storeId;
}
