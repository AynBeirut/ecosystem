import { addDoc, collection, doc, getDocs, getFirestore, query, updateDoc, where, type Firestore } from 'firebase/firestore';
import {
  buildAllergenWrite,
  buildBibleWrite,
  buildBriefingWrite,
  buildFloorWrite,
  buildSpecWrite,
  buildStandardWrite,
  buildVenueRecordPatch,
  recordsForStore,
  toVenueBriefingView,
  toVenueFloorView,
  toVenueKnowledgeView,
  toVenueStandardView,
  type VenueBriefingPeriod,
  type VenueBriefingView,
  type VenueFloorView,
  type VenueKnowledgeView,
  type VenueStandardStatus,
  type VenueStandardView,
} from '@/lib/venueOpsCore';

export type VenueOpsBundle = {
  knowledge: VenueKnowledgeView[];
  briefings: VenueBriefingView[];
  floor: VenueFloorView[];
  standards: VenueStandardView[];
};

async function listByStore(db: Firestore, name: string, storeId: string) {
  const snap = await getDocs(query(collection(db, name), where('storeId', '==', storeId)));
  return snap.docs.map((row) => ({ id: row.id, data: row.data() as Record<string, unknown> }));
}

export async function loadVenueOps(storeId: string): Promise<VenueOpsBundle> {
  const db = getFirestore();
  const [knowledgeRows, briefingRows, floorRows, standardRows] = await Promise.all([
    listByStore(db, 'venueKnowledgeItems', storeId),
    listByStore(db, 'venueBriefings', storeId),
    listByStore(db, 'venueFloorMaps', storeId),
    listByStore(db, 'venueStandards', storeId),
  ]);
  return {
    knowledge: recordsForStore(
      knowledgeRows
        .map((row) => toVenueKnowledgeView(row.id, row.data))
        .filter((row): row is VenueKnowledgeView => Boolean(row)),
      storeId,
    ),
    briefings: recordsForStore(
      briefingRows
        .map((row) => toVenueBriefingView(row.id, row.data))
        .filter((row): row is VenueBriefingView => Boolean(row)),
      storeId,
    ),
    floor: recordsForStore(
      floorRows
        .map((row) => toVenueFloorView(row.id, row.data))
        .filter((row): row is VenueFloorView => Boolean(row)),
      storeId,
    ),
    standards: recordsForStore(
      standardRows
        .map((row) => toVenueStandardView(row.id, row.data))
        .filter((row): row is VenueStandardView => Boolean(row)),
      storeId,
    ),
  };
}

async function add(name: string, payload: Record<string, unknown>) {
  await addDoc(collection(getFirestore(), name), payload);
}

async function saveKnowledge(id: string | null, payload: Record<string, unknown>) {
  const db = getFirestore();
  if (id) await updateDoc(doc(db, 'venueKnowledgeItems', id), buildVenueRecordPatch(payload));
  else await addDoc(collection(db, 'venueKnowledgeItems'), payload);
}

export async function saveVenueAllergen(id: string | null, input: Parameters<typeof buildAllergenWrite>[0]) {
  await saveKnowledge(id, buildAllergenWrite(input));
}
export async function saveVenueBible(id: string | null, input: Parameters<typeof buildBibleWrite>[0]) {
  await saveKnowledge(id, buildBibleWrite(input));
}
export async function saveVenueSpec(id: string | null, input: Parameters<typeof buildSpecWrite>[0]) {
  await saveKnowledge(id, buildSpecWrite(input));
}
export async function saveVenueBriefing(id: string | null, input: Parameters<typeof buildBriefingWrite>[0]) {
  const payload = buildBriefingWrite(input);
  const db = getFirestore();
  if (id) await updateDoc(doc(db, 'venueBriefings', id), buildVenueRecordPatch(payload));
  else await addDoc(collection(db, 'venueBriefings'), payload);
}
export const createVenueAllergen = (input: Parameters<typeof buildAllergenWrite>[0]) => saveVenueAllergen(null, input);
export const createVenueBible = (input: Parameters<typeof buildBibleWrite>[0]) => saveVenueBible(null, input);
export const createVenueSpec = (input: Parameters<typeof buildSpecWrite>[0]) => saveVenueSpec(null, input);
export const createVenueBriefing = (input: Parameters<typeof buildBriefingWrite>[0]) => saveVenueBriefing(null, input);
export async function saveVenueFloor(id: string | null, input: Parameters<typeof buildFloorWrite>[0]) {
  const payload = buildFloorWrite(input);
  const db = getFirestore();
  if (id) await updateDoc(doc(db, 'venueFloorMaps', id), buildVenueRecordPatch(payload));
  else await addDoc(collection(db, 'venueFloorMaps'), payload);
}
export async function saveVenueStandard(id: string | null, input: Parameters<typeof buildStandardWrite>[0]) {
  const payload = buildStandardWrite(input);
  const db = getFirestore();
  if (id) await updateDoc(doc(db, 'venueStandards', id), buildVenueRecordPatch(payload));
  else await addDoc(collection(db, 'venueStandards'), payload);
}
export const createVenueFloor = (input: Parameters<typeof buildFloorWrite>[0]) => saveVenueFloor(null, input);
export const createVenueStandard = (input: Parameters<typeof buildStandardWrite>[0]) => saveVenueStandard(null, input);

export type { VenueBriefingPeriod, VenueStandardStatus };
