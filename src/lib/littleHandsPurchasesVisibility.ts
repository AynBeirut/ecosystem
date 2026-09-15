import type { Purchase, Supplier } from '@/types/inventory';
import type { StoreProfile } from '@/types/storeProfile';
import { belongsOnLittleHandsPurchasesPage } from '@/lib/littleHandsPurchasesEligibility';

const CASH_BOOK_SOT = 'littlehands-cash-book-2026-09-12';

export function littleHandsUsesCashBookPurchases(profile: StoreProfile | null | undefined): boolean {
  if (!profile) return false;
  const flag =
    (profile as StoreProfile & { littleHandsPurchasesSourceOfTruth?: string }).littleHandsPurchasesSourceOfTruth
    || (profile as StoreProfile & { littleHandsExpenseSourceOfTruth?: string }).littleHandsExpenseSourceOfTruth;
  return Boolean(flag && String(flag).includes('littlehands-cash-book'));
}

function isPosPurchase(p: Purchase): boolean {
  if (p.archivedForPurchasesUi) return true;
  const src = String((p as Purchase & { source?: string }).source || '');
  if (src === 'pos') return true;
  return p.id.startsWith('pos-');
}

function isCashBookPurchase(p: Purchase): boolean {
  if (p.archivedForPurchasesUi || p.purchasesPageEligible === false) return false;
  const isLhRow =
    p.importKey?.startsWith('lh-cashbook-')
    || p.isSourceOfTruth
    || String((p as Purchase & { source?: string }).source || '').includes('littlehands-cash-book');
  if (!isLhRow) return false;
  if (p.organizedCategory && p.organizedCategory !== 'production_input') return false;
  const item = p.items?.[0];
  const desc = item?.materialName || p.supplierName || '';
  return belongsOnLittleHandsPurchasesPage(desc, p.supplierName || '', p.organizedCategory);
}

function isLegacyPosNoise(p: Purchase): boolean {
  if (p.isSourceOfTruth || p.importKey?.startsWith('lh-cashbook-')) return false;
  const supplier = String(p.supplierName || '').toLowerCase();
  if (supplier === 'unknown' || supplier === '') return true;
  return p.id.startsWith('pos-');
}

export function filterPurchasesForStore(purchases: Purchase[], profile: StoreProfile | null | undefined): Purchase[] {
  if (!littleHandsUsesCashBookPurchases(profile)) {
    return purchases.filter((p) => !p.archivedForPurchasesUi);
  }
  return purchases.filter((p) => isCashBookPurchase(p) && !isPosPurchase(p) && !isLegacyPosNoise(p));
}

export function filterSuppliersForStore(suppliers: Supplier[], profile: StoreProfile | null | undefined): Supplier[] {
  if (!littleHandsUsesCashBookPurchases(profile)) {
    return suppliers.filter((s) => s.status !== 'inactive' && !s.archivedForPurchasesUi);
  }
  return suppliers.filter((s) => {
    if (s.archivedForPurchasesUi) return false;
    if (s.id.startsWith('pos-') || (s as Supplier & { source?: string }).source === 'pos') return false;
    if (s.isSourceOfTruth || s.id.startsWith('lh-sup-')) return true;
    const src = String(s.importSource || (s as Supplier & { importSource?: string }).importSource || '');
    return src.includes('littlehands-cash-book');
  });
}

export { CASH_BOOK_SOT };
