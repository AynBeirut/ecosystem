import { doc, getDoc, setDoc, collection, getDocs, deleteDoc, addDoc, serverTimestamp, type Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type GeoCityId = 'beirut' | 'tripoli' | 'sidon' | 'other';

export type GeoCityMetric = {
  cityId: GeoCityId;
  label: string;
  activePages: number;
  keywordCount: number;
  estimatedTrafficShare: number;
  updatedAt?: Timestamp;
};

export type OfficialNap = {
  name: string;
  streetAddress: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  phone: string;
  phoneDisplay?: string;
  whatsappUrl?: string;
  email?: string;
  url: string;
  gbpOpeningDate?: string;
  gbpActiveSince?: string;
};

export type NapComparisonEntry = {
  id: string;
  label: string;
  name: string;
  streetAddress: string;
  city: string;
  phone: string;
};

export type CitationStatus = 'listed' | 'not_listed' | 'needs_update';

export type GeoCitationRecord = {
  id: string;
  directory: string;
  directoryUrl: string;
  status: CitationStatus;
  notes: string;
  updatedAt?: Timestamp;
};

export type GbpTask = {
  id: string;
  label: string;
  completed: boolean;
};

export type EntityChecklist = {
  wikipediaMention: boolean;
  knowledgePanelTriggered: boolean;
  notes: string;
};

const CONFIG_DOC = 'seo_geo/config';
const CITIES_COL = 'seo_geo_cities';
const CITATIONS_COL = 'seo_geo_citations';
const NAP_COMPARE_COL = 'seo_geo_nap_comparisons';

export const GEO_CITY_DEFS: Array<{ cityId: GeoCityId; label: string }> = [
  { cityId: 'beirut', label: 'Beirut' },
  { cityId: 'tripoli', label: 'Tripoli' },
  { cityId: 'sidon', label: 'Sidon' },
  { cityId: 'other', label: 'Other' },
];

export const CITATION_STATUSES: CitationStatus[] = ['listed', 'not_listed', 'needs_update'];

export const DEFAULT_GBP_TASKS: GbpTask[] = [
  { id: 'verify', label: 'Verify business on Google Business Profile', completed: true },
  { id: 'photos', label: 'Upload storefront and team photos', completed: true },
  { id: 'services', label: 'Add core services (POS, inventory, accounting)', completed: true },
  { id: 'website', label: 'Link website https://grabio.space', completed: true },
  { id: 'contact', label: 'Phone + WhatsApp on GBP Contact tab', completed: true },
  { id: 'reviews', label: 'Respond to all Google reviews', completed: true },
  { id: 'posts', label: 'Publish weekly GBP post', completed: true },
  { id: 'hours', label: 'Confirm business hours are accurate', completed: true },
  { id: 'maps', label: 'Google Maps listing live', completed: true },
];

export const DEFAULT_CITATION_SEEDS: Array<Omit<GeoCitationRecord, 'id' | 'updatedAt'>> = [
  { directory: 'Google Business Profile', directoryUrl: 'https://maps.app.goo.gl/2RRAu3gfUNLZTw118', status: 'listed', notes: 'Active since 2013' },
  { directory: 'Google Maps', directoryUrl: 'https://maps.app.goo.gl/2RRAu3gfUNLZTw118', status: 'listed', notes: 'Public listing' },
  { directory: 'LinkedIn Company', directoryUrl: 'https://linkedin.com/company/grabio', status: 'listed', notes: '' },
  { directory: 'WhatsApp Business', directoryUrl: 'https://wa.me/96171110952', status: 'listed', notes: 'PRIMARY on GBP' },
  { directory: 'Facebook Business Page', directoryUrl: 'https://facebook.com', status: 'needs_update', notes: '' },
];

const DEFAULT_NAP: OfficialNap = {
  name: 'Grabio',
  streetAddress: 'VGMG+H8J',
  city: 'Beirut',
  region: 'Beirut Governorate',
  postalCode: '',
  country: 'LB',
  phone: '+96171110952',
  phoneDisplay: '+961 71 110 952',
  whatsappUrl: 'https://wa.me/96171110952',
  email: 'hello@grabio.space',
  url: 'https://grabio.space',
  gbpOpeningDate: '2013-01-01',
  gbpActiveSince: '2013',
};

const DEFAULT_ENTITY: EntityChecklist = {
  wikipediaMention: false,
  knowledgePanelTriggered: false,
  notes: '',
};

export type GeoConfig = {
  officialNap: OfficialNap;
  gbpTasks: GbpTask[];
  entityChecklist: EntityChecklist;
  googleMapsUrl?: string;
  googleMapsPlaceUrl?: string;
  gbpManageUrl?: string;
};

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function napMismatchFields(official: OfficialNap, entry: Omit<NapComparisonEntry, 'id' | 'label'>): string[] {
  const fields: string[] = [];
  if (entry.name && normalize(entry.name) !== normalize(official.name)) fields.push('name');
  if (entry.streetAddress && normalize(entry.streetAddress) !== normalize(official.streetAddress)) fields.push('address');
  if (entry.city && normalize(entry.city) !== normalize(official.city)) fields.push('city');
  if (entry.phone && normalize(entry.phone.replace(/\D/g, '')) !== normalize(official.phone.replace(/\D/g, ''))) fields.push('phone');
  return fields;
}

export function buildLocalBusinessJsonLd(nap: OfficialNap): string {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: nap.name,
    url: nap.url,
    telephone: nap.phone,
    address: {
      '@type': 'PostalAddress',
      streetAddress: nap.streetAddress,
      addressLocality: nap.city,
      addressRegion: nap.region,
      postalCode: nap.postalCode || undefined,
      addressCountry: nap.country,
    },
  };
  return JSON.stringify(schema, null, 2);
}

export async function loadGeoConfig(): Promise<GeoConfig> {
  const snap = await getDoc(doc(db, ...CONFIG_DOC.split('/')));
  if (!snap.exists()) {
    return {
      officialNap: DEFAULT_NAP,
      gbpTasks: DEFAULT_GBP_TASKS,
      entityChecklist: DEFAULT_ENTITY,
    };
  }
  const data = snap.data();
  return {
    officialNap: { ...DEFAULT_NAP, ...(data.officialNap as Partial<OfficialNap>) },
    gbpTasks: Array.isArray(data.gbpTasks) && data.gbpTasks.length ? (data.gbpTasks as GbpTask[]) : DEFAULT_GBP_TASKS,
    entityChecklist: { ...DEFAULT_ENTITY, ...(data.entityChecklist as Partial<EntityChecklist>) },
    googleMapsUrl: data.googleMapsUrl ? String(data.googleMapsUrl) : undefined,
    googleMapsPlaceUrl: data.googleMapsPlaceUrl ? String(data.googleMapsPlaceUrl) : undefined,
    gbpManageUrl: data.gbpManageUrl ? String(data.gbpManageUrl) : undefined,
  };
}

export async function saveGeoConfig(partial: Partial<GeoConfig>): Promise<void> {
  await setDoc(
    doc(db, ...CONFIG_DOC.split('/')),
    { ...partial, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function loadCityMetrics(): Promise<GeoCityMetric[]> {
  const snap = await getDocs(collection(db, CITIES_COL));
  const map = new Map<string, GeoCityMetric>();
  snap.forEach((d) => {
    const data = d.data();
    map.set(d.id, {
      cityId: d.id as GeoCityId,
      label: String(data.label ?? d.id),
      activePages: Number(data.activePages ?? 0),
      keywordCount: Number(data.keywordCount ?? 0),
      estimatedTrafficShare: Number(data.estimatedTrafficShare ?? 0),
      updatedAt: data.updatedAt as Timestamp | undefined,
    });
  });

  return GEO_CITY_DEFS.map(({ cityId, label }) =>
    map.get(cityId) ?? {
      cityId,
      label,
      activePages: 0,
      keywordCount: 0,
      estimatedTrafficShare: 0,
    },
  );
}

export async function saveCityMetric(metric: GeoCityMetric): Promise<void> {
  await setDoc(
    doc(db, CITIES_COL, metric.cityId),
    {
      label: metric.label,
      activePages: metric.activePages,
      keywordCount: metric.keywordCount,
      estimatedTrafficShare: metric.estimatedTrafficShare,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function listGeoCitations(): Promise<GeoCitationRecord[]> {
  const snap = await getDocs(collection(db, CITATIONS_COL));
  if (snap.empty) return [];
  return snap.docs
    .map((d) => ({
      id: d.id,
      directory: String(d.data().directory ?? ''),
      directoryUrl: String(d.data().directoryUrl ?? ''),
      status: (String(d.data().status ?? 'not_listed') as CitationStatus),
      notes: String(d.data().notes ?? ''),
      updatedAt: d.data().updatedAt as Timestamp | undefined,
    }))
    .sort((a, b) => a.directory.localeCompare(b.directory));
}

export async function seedGeoCitationsIfEmpty(): Promise<void> {
  const existing = await listGeoCitations();
  if (existing.length > 0) return;
  for (const seed of DEFAULT_CITATION_SEEDS) {
    await addDoc(collection(db, CITATIONS_COL), {
      ...seed,
      updatedAt: serverTimestamp(),
    });
  }
}

export async function saveGeoCitation(id: string, data: Omit<GeoCitationRecord, 'id' | 'updatedAt'>): Promise<void> {
  await setDoc(
    doc(db, CITATIONS_COL, id),
    { ...data, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function createGeoCitation(data: Omit<GeoCitationRecord, 'id' | 'updatedAt'>): Promise<void> {
  await addDoc(collection(db, CITATIONS_COL), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteGeoCitation(id: string): Promise<void> {
  await deleteDoc(doc(db, CITATIONS_COL, id));
}

export async function listNapComparisons(): Promise<NapComparisonEntry[]> {
  const snap = await getDocs(collection(db, NAP_COMPARE_COL));
  return snap.docs.map((d) => ({
    id: d.id,
    label: String(d.data().label ?? ''),
    name: String(d.data().name ?? ''),
    streetAddress: String(d.data().streetAddress ?? ''),
    city: String(d.data().city ?? ''),
    phone: String(d.data().phone ?? ''),
  }));
}

export async function createNapComparison(entry: Omit<NapComparisonEntry, 'id'>): Promise<void> {
  await addDoc(collection(db, NAP_COMPARE_COL), entry);
}

export async function deleteNapComparison(id: string): Promise<void> {
  await deleteDoc(doc(db, NAP_COMPARE_COL, id));
}

export function gbpCompletionPercent(tasks: GbpTask[]): number {
  if (!tasks.length) return 0;
  return Math.round((tasks.filter((t) => t.completed).length / tasks.length) * 100);
}
