import type { MarketingPackageSlug } from './packageTypes';

export type UseCaseClientStore = {
  /** Related industry package (secondary link only) */
  packageSlug: MarketingPackageSlug;
  storeSlug: string;
  storeName: string;
  /** Short line under the store name — real client context */
  clientNote?: string;
  /** Optional — loaded from Firestore when omitted */
  logoUrl?: string;
};

/** Real Grabio client stores on /use-cases — live storefronts, not demo sandboxes */
export const USE_CASE_CLIENT_STORES: Record<string, UseCaseClientStore> = {
  retail: {
    packageSlug: 'shop',
    storeSlug: 'lilyshop',
    storeName: 'lilyshop',
    clientNote: 'Retail storefront on Grabio',
  },
  food: {
    packageSlug: 'restaurant',
    storeSlug: 'jinans-kitchen',
    storeName: "Jinan's Kitchen",
    clientNote: 'Restaurant & kitchen operations',
    logoUrl:
      'https://storage.googleapis.com/market-flow-7b074.firebasestorage.app/store-media/ujff7blWYvUvlekQOrybvNCnn9V2/logo/jinans-kitchen-logo.png',
  },
  wholesale: {
    packageSlug: 'shop',
    storeSlug: 'nipco',
    storeName: 'Nipco',
    clientNote: 'Wholesale & distribution',
  },
  manufacturing: {
    packageSlug: 'manufacturing',
    storeSlug: 'go-grow',
    storeName: 'Go Grow',
    clientNote: 'Production & finished goods',
  },
  services: {
    packageSlug: 'ecommerce',
    storeSlug: 'ayn-beirut',
    storeName: 'Ayn Beirut',
    clientNote: 'Services & online presence',
  },
};

export function getUseCaseClientStore(useCaseId: string): UseCaseClientStore | undefined {
  return USE_CASE_CLIENT_STORES[useCaseId];
}

/** @deprecated use getUseCaseClientStore */
export function getUseCaseShowcase(useCaseId: string): UseCaseClientStore | undefined {
  return getUseCaseClientStore(useCaseId);
}

export const USE_CASE_SHOWCASES = USE_CASE_CLIENT_STORES;
