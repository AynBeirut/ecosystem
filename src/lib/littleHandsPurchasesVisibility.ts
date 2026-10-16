import type { Purchase, Supplier } from '@/types/inventory';
import type { StoreProfile } from '@/types/storeProfile';
import { belongsOnLittleHandsPurchasesPage } from '@/lib/littleHandsPurchasesEligibility';
import { shouldShowOnLittleHandsSupplierList } from '@/lib/littleHandsSupplierListEligibility';
import { dedupeLittleHandsSuppliersByDisplayName } from '@/lib/littleHandsSupplierDedupe';

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

/** PO created in admin (not cash-book import). */
function isLittleHandsManualPurchase(p: Purchase): boolean {
  if (p.archivedForPurchasesUi || p.purchasesPageEligible === false) return false;
  if (p.importKey?.startsWith('lh-cashbook-') || p.isSourceOfTruth) return false;
  const src = String((p as Purchase & { source?: string }).source || '');
  if (src.includes('littlehands-cash-book') || src === 'pos') return false;
  if (p.id.startsWith('pos-')) return false;
  if (p.organizedCategory && p.organizedCategory !== 'production_input') return false;
  return true;
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
  return purchases.filter((p) => {
    if (isPosPurchase(p) || isLegacyPosNoise(p)) return false;
    return isCashBookPurchase(p) || isLittleHandsManualPurchase(p);
  });
}

/** Admin / menu-created vendors (not cash-book import, not POS sync). */
export function isAdminManagedSupplier(s: Supplier): boolean {
  const ext = s as Supplier & { purchasesPageEligible?: boolean };
  if (ext.purchasesPageEligible === true) return true;
  const source = String(s.source || '').toLowerCase();
  if (source === 'admin_manual' || source === 'admin' || source === 'ocr') return true;
  if (s.id.startsWith('pos-') || source === 'pos') return false;
  if (s.isSourceOfTruth || s.id.startsWith('lh-sup-')) return false;
  const importSrc = String(s.importSource || '');
  if (importSrc.includes('littlehands-cash-book')) return false;
  return Boolean(s.supplierCode || s.name);
}

export function filterSuppliersForStore(suppliers: Supplier[], profile: StoreProfile | null | undefined): Supplier[] {
  const lhCashBook = littleHandsUsesCashBookPurchases(profile);
  const filtered = suppliers.filter((s) => {
    if (s.status === 'inactive' || s.archivedForPurchasesUi) return false;
    if (s.id.startsWith('lh-sup-') && !shouldShowOnLittleHandsSupplierList(s.name || '')) return false;
    if (!lhCashBook) return true;
    if (s.id.startsWith('pos-') || (s as Supplier & { source?: string }).source === 'pos') return false;
    if (isAdminManagedSupplier(s)) return true;
    if (s.isSourceOfTruth || s.id.startsWith('lh-sup-')) return true;
    const src = String(s.importSource || (s as Supplier & { importSource?: string }).importSource || '');
    return src.includes('littlehands-cash-book');
  });
  if (!lhCashBook) return filtered;
  return dedupeLittleHandsSuppliersByDisplayName(filtered);
}

export { CASH_BOOK_SOT };
