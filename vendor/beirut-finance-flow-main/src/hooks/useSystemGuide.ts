import { useEffect, useState } from 'react';
import { useGrabioStore } from '@/hooks/useGrabioStore';
import {
  readSystemGuidePreference,
  syncSystemGuideFromProfile,
  SYSTEM_GUIDE_UPDATED_EVENT,
} from '@/lib/systemGuide';

export function useSystemGuide() {
  const { profile } = useGrabioStore();
  const [enabled, setEnabled] = useState<boolean>(() => readSystemGuidePreference());

  useEffect(() => {
    syncSystemGuideFromProfile(profile?.systemGuideEnabled);
  }, [profile?.systemGuideEnabled]);

  useEffect(() => {
    const sync = () => setEnabled(readSystemGuidePreference());
    window.addEventListener('storage', sync);
    window.addEventListener(SYSTEM_GUIDE_UPDATED_EVENT, sync as EventListener);
    window.addEventListener('grabio:store-profile-updated', sync as EventListener);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(SYSTEM_GUIDE_UPDATED_EVENT, sync as EventListener);
      window.removeEventListener('grabio:store-profile-updated', sync as EventListener);
    };
  }, []);

  return { enabled };
}
