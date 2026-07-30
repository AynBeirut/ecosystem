export const SYSTEM_GUIDE_STORAGE_KEY = 'grabio.systemGuide.enabled';
export const SYSTEM_GUIDE_UPDATED_EVENT = 'grabio:system-guide-updated';

export function readSystemGuidePreference(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(SYSTEM_GUIDE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeSystemGuidePreference(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SYSTEM_GUIDE_STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // Ignore localStorage write issues and still emit the in-tab update event.
  }

  window.dispatchEvent(
    new CustomEvent(SYSTEM_GUIDE_UPDATED_EVENT, {
      detail: { enabled },
    }),
  );
}

/** Keep localStorage aligned with Firestore store profile when the field is present. */
export function syncSystemGuideFromProfile(systemGuideEnabled: boolean | undefined): void {
  if (typeof systemGuideEnabled !== 'boolean') return;
  writeSystemGuidePreference(systemGuideEnabled);
}
