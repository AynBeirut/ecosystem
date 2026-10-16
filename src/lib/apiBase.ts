/** Cloud Functions API base URL (same rules as Subscription page). */
export function getApiBaseUrl(): string {
  const explicitApiUrl = String(
    import.meta.env.VITE_API_BASE ||
      import.meta.env.VITE_FIREBASE_FUNCTION_URL ||
      '',
  ).trim();
  const fallbackApiUrl = 'https://us-central1-market-flow-7b074.cloudfunctions.net/api';

  if (!explicitApiUrl) {
    return fallbackApiUrl;
  }

  const isLocalhostUrl = /localhost:5001|127\.0\.0\.1:5001/i.test(explicitApiUrl);
  if (isLocalhostUrl && !import.meta.env.DEV) {
    return fallbackApiUrl;
  }

  return explicitApiUrl.replace(/\/$/, '');
}

/** Meta Commerce CSV feed — always grabio.space (hosting rewrites /api → Cloud Function). */
export function getMetaCatalogFeedUrl(storeId: string): string {
  const id = String(storeId || '').trim();
  if (!id) return '';
  return `https://grabio.space/api/meta/catalog/feed.csv?storeId=${encodeURIComponent(id)}`;
}

/** Grabio SaaS packages catalog for Meta ads (not tenant store products). */
export function getGrabioPackagesCatalogFeedUrl(): string {
  return 'https://grabio.space/meta/catalog/grabio-packages-feed.csv';
}
