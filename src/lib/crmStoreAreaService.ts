import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
  getFirestore,
} from 'firebase/firestore';
import { crmAreasForGovernorate } from '@/lib/crmLebanonLocations';

export type CrmStoreArea = {
  id: string;
  district: string;
  name: string;
};

/** Lebanon defaults — import into your store list from the Areas page. */
export function crmBuiltInAreaSuggestions(district: string): string[] {
  return district ? crmAreasForGovernorate(district) : [];
}

/** Store list when set; otherwise Lebanon defaults until admin adds their own areas. */
export function mergeCrmAreaOptions(district: string, customAreas: CrmStoreArea[]): string[] {
  if (customAreas.length > 0) {
    return customAreas.map((row) => row.name).sort((a, b) => a.localeCompare(b));
  }
  return crmBuiltInAreaSuggestions(district);
}

export async function fetchAllCrmStoreAreaNames(storeId: string): Promise<string[]> {
  if (!storeId) return [];
  try {
    const snap = await getDocs(
      query(collection(getFirestore(), 'crmStoreAreas'), where('storeId', '==', storeId)),
    );
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
    const snap = await getDocs(
      query(collection(getFirestore(), 'crmStoreAreas'), where('storeId', '==', storeId)),
    );
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          district: String(data.district || ''),
          name: String(data.name || '').trim(),
        };
      })
      .filter((r) => r.name.length > 0 && r.district.trim().toLowerCase() === districtKey)
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (e) {
    console.warn('[fetchCrmStoreAreas] failed', e);
    throw e instanceof Error ? e : new Error('Could not load store areas');
  }
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
  const ref = await addDoc(collection(getFirestore(), 'crmStoreAreas'), {
    storeId: input.storeId,
    district,
    name,
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
  });
  return ref.id;
}

export function isBuiltInCrmArea(district: string, name: string): boolean {
  return crmBuiltInAreaSuggestions(district).some(
    (a) => a.toLowerCase() === name.trim().toLowerCase(),
  );
}

export async function updateCrmStoreArea(
  areaId: string,
  input: { storeId: string; district: string; name: string },
): Promise<void> {
  const district = input.district.trim();
  const name = input.name.trim();
  if (!district || !name) throw new Error('District and area name are required.');
  await assertAreaNameAvailable(input.storeId, district, name, areaId);
  await updateDoc(doc(getFirestore(), 'crmStoreAreas', areaId), {
    name,
    district,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteCrmStoreArea(areaId: string): Promise<void> {
  await deleteDoc(doc(getFirestore(), 'crmStoreAreas', areaId));
}
