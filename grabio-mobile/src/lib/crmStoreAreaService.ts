import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { crmAreasForGovernorate } from './crmLebanonLocations';

export type CrmStoreArea = {
  id: string;
  district: string;
  name: string;
};

export function mergeCrmAreaOptions(district: string, customAreas: CrmStoreArea[]): string[] {
  if (customAreas.length > 0) {
    return customAreas.map((row) => row.name).sort((a, b) => a.localeCompare(b));
  }
  const builtIn = district ? crmAreasForGovernorate(district) : [];
  return [...builtIn].sort((a, b) => a.localeCompare(b));
}

/** Lebanon defaults — import from Areas screen. */
export function crmBuiltInAreaSuggestions(district: string): string[] {
  return district ? crmAreasForGovernorate(district) : [];
}

export async function fetchAllCrmStoreAreaNames(storeId: string): Promise<string[]> {
  if (!storeId) return [];
  try {
    const snap = await firestore()
      .collection('crmStoreAreas')
      .where('storeId', '==', storeId)
      .get();
    const names = new Set<string>();
    snap.docs.forEach((d) => {
      const name = String(d.data().name || '').trim();
      if (name) names.add(name);
    });
    return [...names].sort((a, b) => a.localeCompare(b));
  } catch (e) {
    console.warn('[fetchAllCrmStoreAreaNames] failed', e);
    return [];
  }
}

export async function fetchCrmStoreAreas(storeId: string, district: string): Promise<CrmStoreArea[]> {
  if (!storeId || !district.trim()) return [];
  const districtKey = district.trim().toLowerCase();
  try {
    const snap = await firestore()
      .collection('crmStoreAreas')
      .where('storeId', '==', storeId)
      .get();
    return snap.docs
      .map((d) => {
        const data = d.data();
        return { id: d.id, district: String(data.district || ''), name: String(data.name || '').trim() };
      })
      .filter((r) => r.name.length > 0 && r.district.trim().toLowerCase() === districtKey)
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (e) {
    console.warn('[fetchCrmStoreAreas] failed', e);
    throw e instanceof Error ? e : new Error('Could not load store areas');
  }
}

export async function createCrmStoreArea(input: {
  storeId: string;
  district: string;
  name: string;
  createdBy: string;
}): Promise<string> {
  const district = input.district.trim();
  const name = input.name.trim();
  if (!district || !name) throw new Error('District and area name are required.');

  await assertAreaNameAvailable(input.storeId, district, name);
  const uid = auth().currentUser?.uid || input.createdBy;
  if (!uid) throw new Error('Sign in required to add areas.');
  const ref = await firestore().collection('crmStoreAreas').add({
    storeId: input.storeId,
    district,
    name,
    createdBy: uid,
    createdAt: new Date().toISOString(),
  });
  return ref.id;
}

async function assertAreaNameAvailable(
  storeId: string,
  district: string,
  name: string,
  excludeAreaId?: string,
): Promise<void> {
  const existing = await fetchCrmStoreAreas(storeId, district);
  if (existing.some((a) => a.id !== excludeAreaId && a.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('This area already exists for this district.');
  }
}

export function isBuiltInCrmArea(district: string, name: string): boolean {
  return crmBuiltInAreaSuggestions(district).some((a) => a.toLowerCase() === name.trim().toLowerCase());
}

export async function updateCrmStoreArea(
  areaId: string,
  input: { storeId: string; district: string; name: string },
): Promise<void> {
  const district = input.district.trim();
  const name = input.name.trim();
  if (!district || !name) throw new Error('District and area name are required.');
  await assertAreaNameAvailable(input.storeId, district, name, areaId);
  await firestore().collection('crmStoreAreas').doc(areaId).update({
    name,
    district,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteCrmStoreArea(areaId: string): Promise<void> {
  await firestore().collection('crmStoreAreas').doc(areaId).delete();
}
