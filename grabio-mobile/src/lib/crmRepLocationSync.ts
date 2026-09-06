import firestore from '@react-native-firebase/firestore';
import type { GpsCoords } from './geolocation';

export type CrmRepLiveLocation = {
  storeId: string;
  repId: string;
  userId: string;
  repName: string;
  role: string;
  lat: number;
  lng: number;
  accuracy?: number;
  updatedAt: string;
};

export async function syncRepLiveLocation(input: CrmRepLiveLocation): Promise<void> {
  await firestore()
    .collection('crmRepLocations')
    .doc(input.userId)
    .set(
      {
        ...input,
        updatedAt: firestore.FieldValue.serverTimestamp(),
        updatedAtIso: input.updatedAt,
      },
      { merge: true },
    );
}

export function repLocationFromCoords(
  base: Omit<CrmRepLiveLocation, 'lat' | 'lng' | 'accuracy' | 'updatedAt'>,
  coords: GpsCoords,
): CrmRepLiveLocation {
  return {
    ...base,
    lat: coords.lat,
    lng: coords.lng,
    accuracy: coords.accuracy,
    updatedAt: new Date().toISOString(),
  };
}
