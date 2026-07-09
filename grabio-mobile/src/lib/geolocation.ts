import { Alert, Linking, Platform, PermissionsAndroid } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

export type GpsCoords = { lat: number; lng: number; accuracy?: number };

/** Request Android runtime location permission (required on API 23+). */
export async function ensureLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
  const coarse = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
  const hasFine = await PermissionsAndroid.check(fine);
  const hasCoarse = await PermissionsAndroid.check(coarse);
  if (hasFine || hasCoarse) return true;

  const result = await PermissionsAndroid.request(fine, {
    title: 'Location for field visits',
    message: 'Grabio Sales CRM records GPS when you log a visit. Allow location while using the app.',
    buttonPositive: 'Allow',
    buttonNegative: 'Deny',
  });

  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export function captureCurrentPosition(): Promise<GpsCoords> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => reject(new Error(err.message || 'GPS failed')),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 },
    );
  });
}

export async function captureVisitGps(): Promise<GpsCoords | null> {
  const allowed = await ensureLocationPermission();
  if (!allowed) {
    Alert.alert(
      'Location required',
      'Enable location permission in Settings to attach GPS to visit logs.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ],
    );
    return null;
  }
  try {
    return await captureCurrentPosition();
  } catch (e) {
    Alert.alert('GPS', e instanceof Error ? e.message : 'Could not get location. Try outdoors or enable high accuracy.');
    return null;
  }
}
