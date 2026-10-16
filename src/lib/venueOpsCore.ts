import { recordsForStore } from '@/lib/hrCore';

export type VenueKnowledgeKind = 'allergen' | 'bible' | 'spec';
export type VenueKnowledgeType = 'allergen' | 'menu_bible' | 'spec';
export type VenueBriefingPeriod = 'daily' | 'monthly';
export type VenueBriefingStatus = 'draft' | 'published';
export type VenueAllergenStatus = 'draft' | 'reviewed';
export type VenueStandardStatus = 'draft' | 'active';
export type VenueSpecLine = { item: string; quantity: string; unit: string };
export type VenueSpecKind = 'cocktail' | 'batch';
export type VenueStandardKind = 'standard' | 'values' | 'sop' | 'audit' | 'training';

/** Column headers from the allergen matrix reference. Regulatory names, not a brand menu. */
export const VENUE_ALLERGEN_COLUMNS = [
  'Celery Celeriac',
  'Cereals (Gluten)',
  'Crustaceans (Shellfish)',
  'Eggs',
  'Fish',
  'Lupin',
  'Milk (Dairy)',
  'Molluscs',
  'Mustard',
  'Nuts',
  'Peanuts',
  'Sesame Seeds',
  'Soya',
  'Sulphur Dioxide',
] as const;

const MONEY_KEYS = ['price', 'cost', 'cogs', 'unitCost', 'salary', 'amount'] as const;

export type VenueKnowledgeView = {
  id: string;
  storeId: string;
  kind: string;
  title: string;
  category: string;
  detail: string;
  flags: string;
  guestWarning: boolean;
  crossContamination: boolean;
  reviewDate: string;
  reviewer: string;
  status: string;
  crossContaminationNote: string;
  allergens: string;
  presentAllergens: string[];
  ingredients: string;
  story: string;
  meaning: string;
  description: string;
  buzzWords: string;
  oneLiner: string;
  serviceNotes: string;
  glassware: string;
  vessel: string;
  garnish: string;
  method: string;
  par: string;
  batchQuantity: string;
  specKind: string;
  shelfLife: string;
  lines: VenueSpecLine[];
};

export type VenueBriefingView = {
  id: string;
  storeId: string;
  title: string;
  period: string;
  briefingDate: string;
  foodFocus: string;
  beverageFocus: string;
  buzzWords: string;
  drinkBuzzWords: string;
  oneLiner: string;
  prompt: string;
  status: string;
};

export type VenueFloorView = {
  id: string;
  storeId: string;
  title: string;
  sectionName: string;
  tableLabel: string;
  seats: string;
  station: string;
  capacity: string;
  notes: string;
  active: boolean;
};

export type VenueStandardView = {
  id: string;
  storeId: string;
  title: string;
  kind: string;
  category: string;
  roleTarget: string;
  content: string;
  checklist: string[];
  version: string;
  status: string;
  auditFrequency: string;
};

function requireStore(storeId: string) {
  const id = storeId.trim();
  if (!id) throw new Error('Store is required.');
  return id;
}

function requireTitle(value: string, label: string) {
  const title = value.trim();
  if (!title) throw new Error(`${label} is required.`);
  return title;
}

function stamp(storeId: string, now?: string) {
  const at = now || new Date().toISOString();
  return { storeId, createdAt: at, updatedAt: at };
}

function rejectMoney(payload: Record<string, unknown>) {
  for (const key of MONEY_KEYS) {
    if (key in payload) throw new Error('Cost and price are not stored here.');
  }
  return payload;
}

export function buildVenueRecordPatch(created: Record<string, unknown>) {
  const patch = { ...created };
  delete patch.createdAt;
  delete patch.storeId;
  return patch;
}

function specLines(lines?: VenueSpecLine[]) {
  return (lines || [])
    .map((line) => ({
      item: String(line.item || '').trim(),
      quantity: String(line.quantity || '').trim(),
      unit: String(line.unit || '').trim(),
    }))
    .filter((line) => line.item);
}

function knowledgeKind(row: { kind?: string; type?: string }) {
  if (row.type === 'menu_bible' || row.kind === 'bible') return 'bible';
  if (row.type === 'spec' || row.kind === 'spec') return 'spec';
  if (row.type === 'allergen' || row.kind === 'allergen') return 'allergen';
  return '';
}

export function venueOpsDashboardCounts(input: {
  knowledge: { kind?: string; type?: string }[];
  briefings: unknown[];
  floor: unknown[];
  standards: unknown[];
}) {
  return {
    allergens: input.knowledge.filter((row) => knowledgeKind(row) === 'allergen').length,
    bible: input.knowledge.filter((row) => knowledgeKind(row) === 'bible').length,
    specs: input.knowledge.filter((row) => knowledgeKind(row) === 'spec').length,
    briefings: input.briefings.length,
    floor: input.floor.length,
    standards: input.standards.length,
  };
}

export function buildAllergenWrite(input: {
  storeId: string;
  title: string;
  category?: string;
  allergens?: string;
  presentAllergens?: string[];
  crossContamination?: boolean;
  guestWarning?: boolean;
  notes?: string;
  reviewDate?: string;
  reviewer?: string;
  crossContaminationNote?: string;
  status?: VenueAllergenStatus;
  now?: string;
}) {
  const title = requireTitle(input.title, 'Item name');
  const crossContaminationNote = String(input.crossContaminationNote || '').trim();
  const presentAllergens = (input.presentAllergens || []).map((name) => String(name).trim()).filter(Boolean);
  const allergens = presentAllergens.length ? presentAllergens.join(', ') : String(input.allergens || '').trim();
  return rejectMoney({
    ...stamp(requireStore(input.storeId), input.now),
    kind: 'allergen' as VenueKnowledgeKind,
    type: 'allergen' as VenueKnowledgeType,
    title,
    category: String(input.category || '').trim(),
    allergens,
    presentAllergens,
    crossContamination: Boolean(input.crossContamination) || Boolean(crossContaminationNote),
    crossContaminationNote,
    guestWarning: Boolean(input.guestWarning),
    notes: String(input.notes || '').trim(),
    reviewDate: String(input.reviewDate || '').trim(),
    reviewer: String(input.reviewer || '').trim(),
    status: input.status || 'draft',
  });
}

export function buildBibleWrite(input: {
  storeId: string;
  title: string;
  category?: string;
  ingredients?: string;
  oneLiner?: string;
  buzzWords?: string;
  story?: string;
  meaning?: string;
  description?: string;
  serviceNotes?: string;
  pairing?: string;
  allergens?: string;
  now?: string;
}) {
  const title = requireTitle(input.title, 'Item name');
  const meaning = String(input.meaning || input.story || '').trim();
  return rejectMoney({
    ...stamp(requireStore(input.storeId), input.now),
    kind: 'bible' as VenueKnowledgeKind,
    type: 'menu_bible' as VenueKnowledgeType,
    title,
    category: String(input.category || '').trim(),
    ingredients: String(input.ingredients || '').trim(),
    allergens: String(input.allergens || '').trim(),
    oneLiner: String(input.oneLiner || '').trim(),
    buzzWords: String(input.buzzWords || '').trim(),
    meaning,
    description: String(input.description || '').trim(),
    story: meaning,
    serviceNotes: String(input.serviceNotes || '').trim(),
    pairing: String(input.pairing || '').trim(),
  });
}

export function buildSpecWrite(input: {
  storeId: string;
  title: string;
  glassware?: string;
  ingredients?: string;
  garnish?: string;
  method?: string;
  vessel?: string;
  par?: string;
  batchQuantity?: string;
  prepNotes?: string;
  lines?: VenueSpecLine[];
  specKind?: VenueSpecKind;
  shelfLife?: string;
  now?: string;
}) {
  const title = requireTitle(input.title, 'Spec name');
  const lines = specLines(input.lines);
  const ingredients = String(input.ingredients || '').trim() || lines.map((line) => line.item).join(', ');
  return rejectMoney({
    ...stamp(requireStore(input.storeId), input.now),
    kind: 'spec' as VenueKnowledgeKind,
    type: 'spec' as VenueKnowledgeType,
    title,
    glassware: String(input.glassware || '').trim(),
    vessel: String(input.vessel || '').trim(),
    ingredients,
    lines,
    garnish: String(input.garnish || '').trim(),
    method: String(input.method || '').trim(),
    par: String(input.par || '').trim(),
    batchQuantity: String(input.batchQuantity || '').trim(),
    specKind: input.specKind === 'batch' ? 'batch' : 'cocktail',
    shelfLife: String(input.shelfLife || '').trim(),
    prepNotes: String(input.prepNotes || input.shelfLife || '').trim(),
  });
}

export function buildBriefingWrite(input: {
  storeId: string;
  period: VenueBriefingPeriod;
  briefingDate: string;
  foodFocus?: string;
  beverageFocus?: string;
  buzzWords?: string;
  drinkBuzzWords?: string;
  oneLiner?: string;
  prompt?: string;
  status?: VenueBriefingStatus;
  now?: string;
}) {
  const storeId = requireStore(input.storeId);
  const briefingDate = input.briefingDate.trim();
  if (!briefingDate) throw new Error('Briefing date is required.');
  const foodFocus = String(input.foodFocus || '').trim();
  const beverageFocus = String(input.beverageFocus || '').trim();
  const title = [foodFocus, beverageFocus].filter(Boolean).join(' / ') || 'Briefing';
  return rejectMoney({
    ...stamp(storeId, input.now),
    period: input.period,
    briefingDate,
    title,
    foodFocus,
    beverageFocus,
    buzzWords: String(input.buzzWords || '').trim(),
    drinkBuzzWords: String(input.drinkBuzzWords || '').trim(),
    oneLiner: String(input.oneLiner || '').trim(),
    prompt: String(input.prompt || '').trim(),
    status: input.status || 'draft',
  });
}

export function buildFloorWrite(input: {
  storeId: string;
  sectionName: string;
  tableLabel: string;
  seats?: string;
  station?: string;
  capacity?: string;
  notes?: string;
  active?: boolean;
  now?: string;
}) {
  const sectionName = requireTitle(input.sectionName, 'Section');
  const tableLabel = requireTitle(input.tableLabel, 'Table');
  return rejectMoney({
    ...stamp(requireStore(input.storeId), input.now),
    sectionName,
    tableLabel,
    title: `${sectionName} · ${tableLabel}`,
    seats: String(input.seats || '').trim(),
    station: String(input.station || '').trim(),
    capacity: String(input.capacity || '').trim(),
    notes: String(input.notes || '').trim(),
    active: input.active !== false,
  });
}

export function buildStandardWrite(input: {
  storeId: string;
  title: string;
  category?: string;
  roleTarget?: string;
  content?: string;
  version?: string;
  status?: VenueStandardStatus;
  auditFrequency?: string;
  kind?: VenueStandardKind;
  checklist?: string[];
  now?: string;
}) {
  const title = requireTitle(input.title, 'Standard title');
  const checklist = (input.checklist || []).map((line) => String(line).trim()).filter(Boolean);
  const kind = input.kind || 'standard';
  return rejectMoney({
    ...stamp(requireStore(input.storeId), input.now),
    title,
    kind,
    checklist,
    category: String(input.category || '').trim(),
    roleTarget: String(input.roleTarget || '').trim(),
    content: String(input.content || '').trim(),
    version: String(input.version || '').trim(),
    status: input.status || 'draft',
    auditFrequency: String(input.auditFrequency || '').trim(),
  });
}

export function toVenueKnowledgeView(id: string, data: Record<string, unknown>): VenueKnowledgeView | null {
  const storeId = String(data.storeId || '').trim();
  const title = String(data.title || '').trim();
  if (!storeId || !title) return null;
  const presentAllergens = Array.isArray(data.presentAllergens)
    ? data.presentAllergens.map((name) => String(name).trim()).filter(Boolean)
    : String(data.allergens || '').split(',').map((name) => name.trim()).filter(Boolean);
  const allergens = presentAllergens.join(', ') || String(data.allergens || '').trim();
  const oneLiner = String(data.oneLiner || '').trim();
  const method = String(data.method || '').trim();
  const lines = Array.isArray(data.lines)
    ? data.lines.map((line) => {
        const row = line as Record<string, unknown>;
        return {
          item: String(row.item || '').trim(),
          quantity: String(row.quantity || '').trim(),
          unit: String(row.unit || '').trim(),
        };
      }).filter((line) => line.item)
    : [];
  const type = String(data.type || '');
  const kind = String(data.kind || (type === 'menu_bible' ? 'bible' : type));
  return {
    id,
    storeId,
    kind,
    title,
    category: String(data.category || data.glassware || '').trim(),
    detail: allergens || oneLiner || method || String(data.notes || data.prepNotes || '').trim(),
    flags: allergens,
    guestWarning: data.guestWarning === true,
    crossContamination: data.crossContamination === true,
    reviewDate: String(data.reviewDate || '').trim(),
    reviewer: String(data.reviewer || '').trim(),
    status: String(data.status || 'draft'),
    crossContaminationNote: String(data.crossContaminationNote || '').trim(),
    allergens,
    presentAllergens,
    ingredients: String(data.ingredients || '').trim(),
    story: String(data.story || data.meaning || '').trim(),
    meaning: String(data.meaning || data.story || '').trim(),
    description: String(data.description || '').trim(),
    buzzWords: String(data.buzzWords || '').trim(),
    oneLiner,
    serviceNotes: String(data.serviceNotes || '').trim(),
    glassware: String(data.glassware || '').trim(),
    vessel: String(data.vessel || '').trim(),
    garnish: String(data.garnish || '').trim(),
    method,
    par: String(data.par || '').trim(),
    batchQuantity: String(data.batchQuantity || '').trim(),
    specKind: String(data.specKind || 'cocktail'),
    shelfLife: String(data.shelfLife || data.prepNotes || '').trim(),
    lines,
  };
}

export function toVenueBriefingView(id: string, data: Record<string, unknown>): VenueBriefingView | null {
  const storeId = String(data.storeId || '').trim();
  if (!storeId) return null;
  const foodFocus = String(data.foodFocus || '').trim();
  const beverageFocus = String(data.beverageFocus || '').trim();
  const title = String(data.title || '').trim() || [foodFocus, beverageFocus].filter(Boolean).join(' / ') || 'Briefing';
  return {
    id,
    storeId,
    title,
    period: String(data.period || 'daily'),
    briefingDate: String(data.briefingDate || '').trim(),
    foodFocus,
    beverageFocus,
    buzzWords: String(data.buzzWords || '').trim(),
    drinkBuzzWords: String(data.drinkBuzzWords || '').trim(),
    oneLiner: String(data.oneLiner || '').trim(),
    prompt: String(data.prompt || '').trim(),
    status: String(data.status || 'draft'),
  };
}

export function toVenueFloorView(id: string, data: Record<string, unknown>): VenueFloorView | null {
  const storeId = String(data.storeId || '').trim();
  const sectionName = String(data.sectionName || '').trim();
  const tableLabel = String(data.tableLabel || '').trim();
  if (!storeId || !sectionName || !tableLabel) return null;
  return {
    id,
    storeId,
    title: `${sectionName} · ${tableLabel}`,
    sectionName,
    tableLabel,
    seats: String(data.seats || '').trim(),
    station: String(data.station || '').trim(),
    capacity: String(data.capacity || '').trim(),
    notes: String(data.notes || '').trim(),
    active: data.active !== false,
  };
}

export function toVenueStandardView(id: string, data: Record<string, unknown>): VenueStandardView | null {
  const storeId = String(data.storeId || '').trim();
  const title = String(data.title || '').trim();
  if (!storeId || !title) return null;
  return {
    id,
    storeId,
    title,
    kind: String(data.kind || 'standard'),
    category: String(data.category || '').trim(),
    roleTarget: String(data.roleTarget || '').trim(),
    content: String(data.content || '').trim(),
    checklist: Array.isArray(data.checklist)
      ? data.checklist.map((line) => String(line).trim()).filter(Boolean)
      : String(data.content || '').split('\n').map((line) => line.trim()).filter(Boolean),
    version: String(data.version || '').trim(),
    status: String(data.status || 'draft'),
    auditFrequency: String(data.auditFrequency || '').trim(),
  };
}

export { recordsForStore };
