function norm(name: string): string {
  return String(name || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export type LittleHandsMiscCategoryId = 'DISPOSBLES';

export type LittleHandsMiscCategoryDef = {
  id: LittleHandsMiscCategoryId;
  label: string;
  /** Category shell on file — not a vendor AP card. */
  categorySupplierId: string;
};

export const LITTLE_HANDS_MISC_CATEGORIES: Record<LittleHandsMiscCategoryId, LittleHandsMiscCategoryDef> = {
  DISPOSBLES: {
    id: 'DISPOSBLES',
    label: 'Disposables',
    categorySupplierId: 'lh-sup-cat-disposables',
  },
};

/** Cash-book disposable lines (category DISPOSBLES; each row is still its own item label). */
export function littleHandsMiscCategoryIdForName(name: string): LittleHandsMiscCategoryId | null {
  const t = norm(name);
  if (!t) return null;
  if (/dispos/i.test(t)) return 'DISPOSBLES';
  return null;
}

export function isLittleHandsDisposablesMiscName(name: string): boolean {
  return littleHandsMiscCategoryIdForName(name) === 'DISPOSBLES';
}

export function littleHandsMiscItemLabel(name: string): string {
  return String(name || '').trim();
}
