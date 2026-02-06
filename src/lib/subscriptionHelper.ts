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
  
  // Only 'pro' tier has access to composed products/services
  return storeProfile.subscriptionTier === 'pro';
};

/**
 * Check if store has specific add-on
 */
export const hasAddOn = (storeProfile: StoreProfile | null | undefined, addOn: 'pos' | 'storage'): boolean => {
  if (!storeProfile || !storeProfile.addOns) return false;
  return storeProfile.addOns.includes(addOn);
};

/**
 * Get user-friendly subscription tier name
 */
export const getSubscriptionTierName = (storeProfile: StoreProfile | null | undefined): string => {
  if (!storeProfile) return 'Free';
  
  // For backward compatibility, treat undefined as 'pro'
  if (!storeProfile.subscriptionTier) return 'Pro';
  
  return storeProfile.subscriptionTier === 'pro' ? 'Pro' : 'Premium';
};
