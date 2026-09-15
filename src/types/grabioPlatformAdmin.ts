import type { GrabioOpsSubscription } from '@/types/storeProfile';

export type { GrabioOpsSubscription, GrabioBillingChannel } from '@/types/storeProfile';

export type GrabioPlatformClientRow = {
  storeId: string;
  /** Human-facing label for ops dashboard (never a raw Firebase uid). */
  displayName: string;
  name: string;
  storeName?: string;
  email?: string;
  slug?: string;
  subscriptionStatus?: string;
  subscriptionTier?: string;
  subscriptionPlan?: string;
  subscriptionEndsAt?: string;
  startingPackage?: string;
  accountPackageLabel?: string;
  pricingVersion?: string;
  modularMonthlyUsd?: number;
  enabledModuleCount?: number;
  enabledModules?: Record<string, boolean>;
  grabioOps?: GrabioOpsSubscription;
  isTestAccount?: boolean;
  isTestClient?: boolean;
  /** Grabio dev team store — always on main list. */
  isTeamDev?: boolean;
  accountLabel?: string;
  statusReason?: string;
  storageUsedMb?: number;
  storageLimitMb?: number | null;
};

export type GrabioPlatformSubAccountRow = {
  id: string;
  storeId: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastLogin?: string;
};

export type GrabioPlatformRoleAccountRow = {
  uid: string;
  email: string;
  displayName: string;
  roleKind: 'builder' | 'accounting';
  accountLabel: string;
  clientStoreCount: number;
  clientStores: { storeId: string; storeName: string }[];
  builderAccessStartsAt?: string;
  builderAccessEndsAt?: string;
  hasOwnStoreProfile: boolean;
};
