import type { VenueSpecLine } from '@/lib/venueOpsCore';

/** Column headers that must never become stored fields. */
const MONEY_HEADERS = ['price', 'cost', 'cogs', 'unit cost', 'salary', 'amount'];

export type PreviewSpec = {
  title: string;
  glassware: string;
  vessel: string;
  garnish: string;
  method: string;
  par: string;
  batchQuantity: string;
  prepNotes: string;
  lines: VenueSpecLine[];
};

export type PreviewBriefing = {
  day: string;
  foodFocus: string;
  beverageFocus: string;
  buzzWords: string;
  oneLiner: string;
  status: 'draft';
};

export type PreviewBible = {
  title: string;
  buzzWords: string;
  oneLiner: string;
};

export type PreviewAllergen = {
  title: string;
  allergens: string;
  notes: string;
};

export type VenueSourcePreview = {
  specs: PreviewSpec[];
  briefings: PreviewBriefing[];
  bible: PreviewBible[];
  allergens: PreviewAllergen[];
  skippedSheets: string[];
  saved: false;
};

type Sheet = { name: string; rows: string[][] };

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function norm(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function rowCells(row: unknown[]): string[] {
  return row.map((cell) => text(cell));
}

function isBlank(row: string[]): boolean {
  return row.every((cell) => !cell);
}

function headerKind(row: string[]): 'serve' | 'batch' | 'briefing' | 'allergen' | null {
  const cells = row.map(norm).filter(Boolean);
  const has = (name: string) => cells.includes(name);
  if (cells.some((cell) => MONEY_HEADERS.includes(cell))) {
    // Money columns are ignored later. Kind still comes from the operational headers.
  }
  if (has('cocktail') && has('glassware') && has('ingredient')) return 'serve';
  if (has('cocktail') && has('storage vessel') && has('ingredient')) return 'batch';
  if (has('day') && has('food item') && has('beverage item')) return 'briefing';
  if ((has('item') || has('item name')) && cells.some((cell) => cell.includes('allergen'))) return 'allergen';
  return null;
}

function indexOf(row: string[], name: string, start = 0): number {
  const target = norm(name);
  for (let i = start; i < row.length; i += 1) {
    if (norm(row[i]) === target) return i;
  }
  return -1;
}

function pushMethod(current: string, extra: string): string {
  const next = extra.trim();
  if (!next) return current;
  return current ? `${current} ${next}` : next;
}

function parseServe(rows: string[][], headerAt: number): PreviewSpec[] {
  const header = rows[headerAt];
  const nameAt = indexOf(header, 'cocktail');
  const glassAt = indexOf(header, 'glassware');
  const qtyAt = indexOf(header, 'quantity');
  const ingredientAt = indexOf(header, 'ingredient');
  const garnishAt = indexOf(header, 'garnish');
  const methodAt = indexOf(header, 'method');
  const unitAt = qtyAt >= 0 ? qtyAt + 1 : -1;
  const specs: PreviewSpec[] = [];
  let current: PreviewSpec | null = null;

  for (const row of rows.slice(headerAt + 1)) {
    if (isBlank(row) || headerKind(row)) {
      current = null;
      continue;
    }
    const title = text(row[nameAt]);
    if (title) {
      current = {
        title,
        glassware: glassAt >= 0 ? text(row[glassAt]) : '',
        vessel: '',
        garnish: garnishAt >= 0 ? text(row[garnishAt]) : '',
        method: methodAt >= 0 ? text(row[methodAt]) : '',
        par: '',
        batchQuantity: '',
        prepNotes: '',
        lines: [],
      };
      specs.push(current);
    }
    if (!current) continue;
    const item = ingredientAt >= 0 ? text(row[ingredientAt]) : '';
    const quantity = qtyAt >= 0 ? text(row[qtyAt]) : '';
    const unit = unitAt >= 0 && unitAt !== ingredientAt ? text(row[unitAt]) : '';
    if (item || quantity) current.lines.push({ item, quantity, unit });
    if (!title && methodAt >= 0) current.method = pushMethod(current.method, text(row[methodAt]));
    if (!title && garnishAt >= 0 && !current.garnish) current.garnish = text(row[garnishAt]);
  }
  return specs.filter((spec) => spec.title);
}

function parseBatch(rows: string[][], headerAt: number): PreviewSpec[] {
  const header = rows[headerAt];
  const nameAt = indexOf(header, 'cocktail');
  const vesselAt = indexOf(header, 'storage vessel');
  const measureAt = indexOf(header, 'measure');
  const litreAt = indexOf(header, '1 litre');
  const parAt = indexOf(header, 'par');
  const parQtyAt = indexOf(header, 'par qty');
  const ingredientAt = indexOf(header, 'ingredient');
  const lifeAt = indexOf(header, 'shelf life');
  const specs: PreviewSpec[] = [];
  let current: PreviewSpec | null = null;

  for (const row of rows.slice(headerAt + 1)) {
    if (isBlank(row) || headerKind(row)) {
      current = null;
      continue;
    }
    const title = text(row[nameAt]);
    if (title) {
      current = {
        title,
        glassware: '',
        vessel: vesselAt >= 0 ? text(row[vesselAt]) : '',
        garnish: '',
        method: '',
        par: parAt >= 0 ? text(row[parAt]) : '',
        batchQuantity: parQtyAt >= 0 ? text(row[parQtyAt]) : '',
        prepNotes: lifeAt >= 0 ? text(row[lifeAt]) : '',
        lines: [],
      };
      specs.push(current);
    }
    if (!current) continue;
    const item = ingredientAt >= 0 ? text(row[ingredientAt]) : '';
    const quantity = litreAt >= 0 ? text(row[litreAt]) : '';
    const unit = measureAt >= 0 ? text(row[measureAt]) : '';
    if (item || quantity) current.lines.push({ item, quantity, unit });
  }
  return specs.filter((spec) => spec.title);
}

function parseBriefing(rows: string[][], headerAt: number): { briefings: PreviewBriefing[]; bible: PreviewBible[] } {
  const header = rows[headerAt];
  const dayAt = indexOf(header, 'day');
  const foodAt = indexOf(header, 'food item');
  const drinkAt = indexOf(header, 'beverage item');
  const lineAt = indexOf(header, 'one liner');
  const foodBuzzAt = indexOf(header, 'buzz words');
  const drinkBuzzAt = indexOf(header, 'buzz words', foodBuzzAt + 1);
  const briefings: PreviewBriefing[] = [];
  const bible: PreviewBible[] = [];

  for (const row of rows.slice(headerAt + 1)) {
    if (isBlank(row) || headerKind(row)) continue;
    const foodFocus = foodAt >= 0 ? text(row[foodAt]) : '';
    const beverageFocus = drinkAt >= 0 ? text(row[drinkAt]) : '';
    if (!foodFocus && !beverageFocus) continue;
    const foodBuzz = foodBuzzAt >= 0 ? text(row[foodBuzzAt]) : '';
    const drinkBuzz = drinkBuzzAt >= 0 ? text(row[drinkBuzzAt]) : '';
    const oneLiner = lineAt >= 0 ? text(row[lineAt]) : '';
    const day = dayAt >= 0 ? text(row[dayAt]) : '';
    briefings.push({
      day: day ? `Day ${day}` : '',
      foodFocus,
      beverageFocus,
      buzzWords: [foodBuzz, drinkBuzz].filter(Boolean).join(' / '),
      oneLiner,
      status: 'draft',
    });
    if (foodFocus) bible.push({ title: foodFocus, buzzWords: foodBuzz, oneLiner });
    if (beverageFocus) bible.push({ title: beverageFocus, buzzWords: drinkBuzz, oneLiner: '' });
  }
  return { briefings, bible };
}

function parseAllergen(rows: string[][], headerAt: number): PreviewAllergen[] {
  const header = rows[headerAt];
  const titleAt = indexOf(header, 'item') >= 0 ? indexOf(header, 'item') : indexOf(header, 'item name');
  const allergenAt = header.findIndex((cell) => norm(cell).includes('allergen'));
  const notesAt = indexOf(header, 'notes');
  const items: PreviewAllergen[] = [];
  for (const row of rows.slice(headerAt + 1)) {
    if (isBlank(row) || headerKind(row)) continue;
    const title = titleAt >= 0 ? text(row[titleAt]) : '';
    if (!title) continue;
    items.push({
      title,
      allergens: allergenAt >= 0 ? text(row[allergenAt]) : '',
      notes: notesAt >= 0 ? text(row[notesAt]) : '',
    });
  }
  return items;
}

/** Maps spreadsheet rows into venue fields. Does not write. */
export function previewVenueSource(sheets: Sheet[]): VenueSourcePreview {
  const preview: VenueSourcePreview = {
    specs: [],
    briefings: [],
    bible: [],
    allergens: [],
    skippedSheets: [],
    saved: false,
  };

  for (const sheet of sheets) {
    const rows = sheet.rows.map((row) => rowCells(row));
    let matched = false;
    rows.forEach((row, index) => {
      const kind = headerKind(row);
      if (!kind) return;
      matched = true;
      if (kind === 'serve') preview.specs.push(...parseServe(rows, index));
      if (kind === 'batch') preview.specs.push(...parseBatch(rows, index));
      if (kind === 'briefing') {
        const parsed = parseBriefing(rows, index);
        preview.briefings.push(...parsed.briefings);
        preview.bible.push(...parsed.bible);
      }
      if (kind === 'allergen') preview.allergens.push(...parseAllergen(rows, index));
    });
    if (!matched) preview.skippedSheets.push(sheet.name || 'Sheet');
  }

  preview.saved = false;
  return preview;
}
