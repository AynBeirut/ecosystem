/** No-op: service worker is kept active for asset caching performance. */
export async function disableServiceWorkerInAppShell(): Promise<void> {
  // Previously disabled SW in app shell — removed because it caused slow navigation.
  // SW now uses NetworkFirst for HTML and CacheFirst for hashed assets.
}
