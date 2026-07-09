import type { Store } from '../types';

/** Normalize Grabio Firestore storeProfiles doc → Store shape used in screens. */
export function mapStoreProfile(id: string, data: Record<string, unknown>): Store {
  return {
    id,
    name: String(data.storeName || data.name || 'Store'),
    description: data.description ? String(data.description) : undefined,
    logoUrl: (data.logoUrl || data.logo) ? String(data.logoUrl || data.logo) : undefined,
    logo: data.logo ? String(data.logo) : undefined,
    slug: data.storeSlug ? String(data.storeSlug) : undefined,
    rating: typeof data.rating === 'number' ? data.rating : undefined,
    ratingCount: typeof data.ratingCount === 'number' ? data.ratingCount : undefined,
    ownerId: String(data.ownerId || ''),
    whatsappNumber: data.whatsappNumber ? String(data.whatsappNumber) : undefined,
    whatsappBusiness: data.whatsappBusiness ? String(data.whatsappBusiness) : undefined,
    location: data.location ? String(data.location) : undefined,
    mainCurrency: data.mainCurrency ? String(data.mainCurrency) : undefined,
    paymentMethods: data.paymentMethods as Store['paymentMethods'],
  };
}
