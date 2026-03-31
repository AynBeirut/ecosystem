import { StoreProfile } from '@/types/storeProfile';

/**
 * Check if store has access to composed products/services
 * For backward compatibility, accounts without subscriptionTier field are treated as 'pro'
 * This ensures existing accounts (like nipco) continue working without disruption
 */
export const hasComposedAccess = (storeProfile: StoreProfile | null | undefined): boolean => {
  if (!storeProfile) return false;
  
  // If subscriptionTier is not set (old accounts), default to 'pro' for backward compatibility
  if (!storeProfile.subscriptionTier) return true;

  const tier = storeProfile.subscriptionTier;
  if (tier === 'premium') return true; // legacy premium behaved like full access

  // Trial cannot use composed products; Starter/Pro/Business can
  return tier !== 'trial';
};

/**
 * Check if store has specific add-on
 */
export const hasAddOn = (
  storeProfile: StoreProfile | null | undefined,
  addOn: 'domainPackage' | 'whatsappBusiness' | 'manufacturingBom' | 'extraStorage'
): boolean => {
  if (!storeProfile || !storeProfile.addOns) return false;

  if (Array.isArray(storeProfile.addOns)) {
    return storeProfile.addOns.includes(addOn);
  }

  if (addOn === 'extraStorage') {
    return Number((storeProfile.addOns as Record<string, unknown>).extraStorageBlocks || 0) > 0;
  }

  return Boolean((storeProfile.addOns as Record<string, unknown>)[addOn]);
};

/**
 * Get user-friendly subscription tier name
 */
export const getSubscriptionTierName = (storeProfile: StoreProfile | null | undefined): string => {
  if (!storeProfile) return 'Free';
  
  // For backward compatibility, treat undefined as 'pro'
  if (!storeProfile.subscriptionTier) return 'Pro';

  switch (storeProfile.subscriptionTier) {
    case 'trial':
      return 'Trial';
    case 'starter':
    case 'premium':
      return 'Starter';
    case 'pro':
      return 'Pro';
    case 'business':
      return 'Business';
    default:
      return 'Pro';
  }
};
