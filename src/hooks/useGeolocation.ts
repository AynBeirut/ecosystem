import { useCallback, useState } from 'react';
import type { CrmGeoLocation } from '@/types/crm';

export function useGeolocation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const capture = useCallback(async (): Promise<CrmGeoLocation | null> => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported in this browser.');
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 60000,
        });
      });
      return {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      };
    } catch (e) {
      const msg = e instanceof GeolocationPositionError
        ? e.message
        : e instanceof Error
          ? e.message
          : 'Could not get location';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { capture, loading, error };
}
