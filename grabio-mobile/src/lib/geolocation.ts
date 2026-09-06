import { Alert, Linking, Platform, PermissionsAndroid } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { requestAndroidPermission } from './androidPermissions';

export type GpsCoords = { lat: number; lng: number; accuracy?: number };

let locationPermissionRequest: Promise<boolean> | null = null;

/** Check if coarse or fine location permission is granted (no prompt). */
export async function hasLocationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
    const coarse = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
    const hasFine = await PermissionsAndroid.check(fine);
    const hasCoarse = await PermissionsAndroid.check(coarse);
    return hasFine || hasCoarse;
  }
  return true;
}

/** Request runtime location permission. */
export async function ensureLocationPermission(mandatory = false): Promise<boolean> {
  if (await hasLocationPermission()) return true;

  if (locationPermissionRequest) return locationPermissionRequest;

  locationPermissionRequest = (async () => {
    if (Platform.OS !== 'android') {
      try {
        await captureCurrentPosition();
        return true;
      } catch {
        if (mandatory) promptOpenLocationSettings();
        return false;
      }
    }

    const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
    const result = await requestAndroidPermission(fine, {
      title: mandatory ? 'Location required — company device' : 'Location for field visits',
      message: mandatory
        ? 'This company device must share location while Grabio is open. Admin and managers need live team locations — you cannot turn this off.'
        : 'Grabio Sales CRM records GPS when you log a visit. Allow location while using the app.',
      buttonPositive: 'Allow',
      buttonNegative: mandatory ? undefined : 'Deny',
    });

    if (result === PermissionsAndroid.RESULTS.GRANTED) return true;
    // OEM timing: system may grant before RN check updates
    await new Promise((resolve) => setTimeout(resolve, 300));
    return await hasLocationPermission();
  })();

  try {
    return await locationPermissionRequest;
  } finally {
    locationPermissionRequest = null;
  }
}

/** Mandatory CRM flow — only Settings escape, no dismiss. */
export function promptOpenLocationSettings(): void {
  Alert.alert(
    'Location required',
    'Location is required on company sales devices. Enable it in Settings — you cannot use Grabio with location off.',
    [{ text: 'Open Settings', onPress: () => Linking.openSettings() }],
    { cancelable: false },
  );
}

function getPosition(options: {
  enableHighAccuracy: boolean;
  timeout: number;
  maximumAge: number;
}): Promise<GpsCoords> {
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
      options,
    );
  });
}

/** Fast for buttons: cached/network first, then refine with GPS chip if needed. */
export async function captureCurrentPosition(): Promise<GpsCoords> {
  // 1) Instant when location was recently used (CRM gate / prior capture)
  try {
    return await getPosition({ enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 });
  } catch {
    // continue
  }

  // 2) Race quick network fix vs high-accuracy — return whichever answers first
  try {
    return await Promise.race([
      getPosition({ enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }),
      getPosition({ enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 }),
    ]);
  } catch {
    // continue
  }

  // 3) Last resort — any stale fix
  return getPosition({ enableHighAccuracy: false, timeout: 10000, maximumAge: 900000 });
}

export async function captureVisitGps(mandatory = false): Promise<GpsCoords | null> {
  const allowed = await ensureLocationPermission(mandatory);
  if (!allowed) {
    if (mandatory) promptOpenLocationSettings();
    else {
      Alert.alert(
        'Location required',
        'Enable location permission in Settings to attach GPS to visit logs.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
    }
    return null;
  }
  try {
    return await captureCurrentPosition();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not get location. Try outdoors or enable high accuracy.';
    if (mandatory) Alert.alert('GPS required', msg);
    else Alert.alert('GPS', msg);
    return null;
  }
}

/** Live rep tracking while app is open — returns unsubscribe. */
export function watchRepPosition(
  onPosition: (coords: GpsCoords) => void,
  onError?: (message: string) => void,
  opts?: { distanceFilter?: number },
): () => void {
  const watchId = Geolocation.watchPosition(
    (pos) => {
      onPosition({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      });
    },
    (err) => onError?.(err.message || 'GPS watch failed'),
    {
      enableHighAccuracy: true,
      distanceFilter: opts?.distanceFilter ?? 15,
      interval: 20_000,
      fastestInterval: 8_000,
    },
  );
  return () => Geolocation.clearWatch(watchId);
}
