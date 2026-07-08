import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/useAuth';
import { Link, useNavigate } from 'react-router-dom';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { StoreProfile } from '@/types/storeProfile';
import { Button } from '@/components/ui/button';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AdminPanel from '@/components/admin/AdminPanel';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ECOSYSTEM_FLAGS } from '@/lib/ecosystemFlags';
import { resolveStoreEntitlements } from '@/lib/entitlements';
import { PRESET_LIST } from '@/lib/packagePresets';
import { calculateModularPrice, calculateCustomPrice, MODULE_PRICES } from '@/lib/modularPricing';
import type { StartingPackageKey } from '@/lib/moduleManifest';
import { MODULE_CATALOG, ADDON_PRICING, isRoadmapModule, tierMeetsMinimum } from '@/lib/pricingDisplay';
import type { AddOnKey as PricingAddOnKey, PaidTier as PricingPaidTier } from '@/lib/pricingDisplay';
import { getActualStoreId } from '@/lib/storeUtils';
import { getApiBaseUrl } from '@/lib/apiBase';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminModuleIcon from '@/components/admin/AdminModuleIcon';
import PoweredByEmoove from '@/components/PoweredByEmoove';

type Billing = 'monthly' | 'yearly';
type SubscriptionTier = 'trial' | 'starter' | 'pro' | 'business';
type PaidTier = Exclude<SubscriptionTier, 'trial'>;
type AddOnKey = 'domainPackage' | 'whatsappBusiness' | 'salesCrm' | 'extraStorage';

type AddOnSelection = {
  domainPackage: boolean;
  whatsappBusiness: boolean;
  salesCrm: boolean;
  extraStorageBlocks: number;
};

const TRIAL_DURATION_MONTHS = 3;

const PRICING = {
  starter: { monthly: 10, yearly: 100 },
  pro: { monthly: 20, yearly: 200 },
  business: { monthly: 30, yearly: 300 },
  addOns: {
    domainPackage: { monthly: 15, yearly: 150 },
    whatsappBusiness: { monthly: 10, yearly: 100 },
    extraStoragePer5Gb: { monthly: 2, yearly: 24 },
    salesCrm: { monthly: 15, yearly: 150 },
  },
};

const PLAN_ORDER: SubscriptionTier[] = ['trial', 'starter', 'pro', 'business'];

const PLAN_LABELS: Record<SubscriptionTier, string> = {
  trial: 'Trial',
  starter: 'Starter',
  pro: 'Pro',
  business: 'Business',
};

const PLAN_FEATURES: Record<SubscriptionTier, {
  description: string;
  monthlyLabel: string;
  yearlyLabel: string;
  badge?: string;
  limits: string[];
  features: string[];
  restrictions?: string[];
  cta: string;
}> = {
  trial: {
    description: 'Pay As You Go - Free to start',
    monthlyLabel: '$0 upfront + 20% of sales',
    yearlyLabel: 'Up to 3 months trial period',
    badge: 'FREE TO START',
    limits: [
      'Products: 10 maximum',
      'Product types: Simple products & services only',
      'Storage: 500MB',
      'Operations: 30/month',
      'Revenue share: 20%',
    ],
    features: [
      'yourstore.grabio.space subdomain',
      'Online storefront with OMT and Stripe',
      'Multi-currency checkout',
      'Basic inventory and analytics',
      'Email notifications + 3 basic themes',
    ],
    restrictions: [
      'No custom domain',
      'No composed or manufacturing features',
      'Powered by Grabio footer shown',
    ],
    cta: 'Start Free Trial',
  },
  starter: {
    description: 'Most chosen for growing stores',
    monthlyLabel: '$10/month',
    yearlyLabel: '$100/year (Save $20)',
    badge: 'POPULAR',
    limits: [
      'Products: 8 maximum',
      'Product types: All types',
      'Storage: 5GB',
      'Operations: Unlimited',
      'Revenue share: 0%',
    ],
    features: [
      'Everything in Trial',
      'Keep 100% of your revenue',
      'Discount codes and basic SEO tools',
      'Email marketing (200/month)',
      'Priority email support',
    ],
    cta: 'Choose Starter',
  },
  pro: {
    description: 'For advanced operations',
    monthlyLabel: '$20/month',
    yearlyLabel: '$200/year (Save $40)',
    limits: [
      'Products: 20 maximum',
      'Product types: All + Manufacturing',
      'Storage: 10GB',
      'Operations: Unlimited',
      'Revenue share: 0%',
    ],
    features: [
      'Everything in Starter',
      'Composed products and services',
      'Advanced analytics and reports',
      'Email marketing (1,000/month)',
      'Multi-location inventory + API access',
    ],
    cta: 'Choose Pro',
  },
  business: {
    description: 'Best value for scaling brands',
    monthlyLabel: '$30/month',
    yearlyLabel: '$300/year (Save $60)',
    badge: 'BEST VALUE',
    limits: [
      'Products: 50 maximum',
      'Product types: All + Manufacturing',
      'Storage: 20GB',
      'Operations: Unlimited',
      'Revenue share: 0%',
    ],
    features: [
      'Everything in Pro',
      'Email marketing (5,000/month)',
      'Multi-user access (up to 10 users)',
      'Meta shop integration + advanced SEO',
      'Dedicated account manager',
    ],
    cta: 'Choose Business',
  },
};

const PLAN_ELIGIBLE_ADDONS: Record<SubscriptionTier, AddOnKey[]> = {
  trial: ['whatsappBusiness'],
  starter: ['domainPackage', 'whatsappBusiness', 'salesCrm', 'extraStorage'],
  pro: ['domainPackage', 'whatsappBusiness', 'salesCrm', 'extraStorage'],
  business: ['domainPackage', 'whatsappBusiness', 'salesCrm', 'extraStorage'],
};

const COMPARISON_ROWS: Array<{ feature: string; values: Record<SubscriptionTier, string> }> = [
  { feature: 'Monthly Cost', values: { trial: '$0 + 20%', starter: '$10', pro: '$20', business: '$30' } },
  { feature: 'Yearly Cost', values: { trial: 'N/A', starter: '$100', pro: '$200', business: '$300' } },
  { feature: 'Products', values: { trial: '10', starter: '8', pro: '20', business: '50' } },
  { feature: 'Product Types', values: { trial: 'Simple', starter: 'All', pro: 'All', business: 'All' } },
  { feature: 'Storage', values: { trial: '500MB', starter: '5GB', pro: '10GB', business: '20GB' } },
  { feature: 'Operations/month', values: { trial: '30', starter: '∞', pro: '∞', business: '∞' } },
  { feature: 'Revenue Share', values: { trial: '20%', starter: '0%', pro: '0%', business: '0%' } },
  { feature: 'Custom Domain', values: { trial: 'No', starter: '+$15', pro: '+$15', business: '+$15' } },
  { feature: 'Premium Themes', values: { trial: '3 basic', starter: '10', pro: '20', business: '30+' } },
  { feature: 'Manufacturing', values: { trial: 'No', starter: 'No', pro: 'Included', business: 'Included' } },
  { feature: 'Email Marketing', values: { trial: 'No', starter: '200/mo', pro: '1K/mo', business: '5K/mo' } },
  { feature: 'Multi-user', values: { trial: 'No', starter: 'No', pro: 'No', business: '10 users' } },
  { feature: 'Support', values: { trial: 'Email', starter: 'Priority', pro: 'Phone', business: 'Dedicated' } },
];

const EMPTY_SELECTION: AddOnSelection = {
  domainPackage: false,
  whatsappBusiness: false,
  salesCrm: false,
  extraStorageBlocks: 0,
};

/** All live modules a store owner can toggle (core + tier + stock — not add-ons or roadmap). */
const MANAGEABLE_MODULES = MODULE_CATALOG.filter(
  (m) =>
    m.billing !== 'addon' &&
    m.billing !== 'included' &&
    m.status !== 'planned' &&
    m.status !== 'coming_soon' &&
    !isRoadmapModule(m),
);

function paidTierFromProfile(tier?: string): PricingPaidTier {
  const normalized = normalizeTier(tier);
  if (normalized === 'trial' || !normalized) return 'starter';
  return normalized;
}

function normalizeTier(tier?: string): SubscriptionTier | null {
  if (!tier) return null;
  if (tier === 'premium') return 'starter';
  if (tier === 'trial' || tier === 'starter' || tier === 'pro' || tier === 'business') return tier;
  return null;
}

function getDefaultSelectionByTier(tier: PaidTier): Record<PaidTier, AddOnSelection> {
  return {
    starter: { ...EMPTY_SELECTION },
    pro: { ...EMPTY_SELECTION },
    business: { ...EMPTY_SELECTION },
    [tier]: { ...EMPTY_SELECTION },
  };
}

function getSubscriptionApiBase(): string {
  const explicitApiUrl = String(import.meta.env.VITE_FIREBASE_FUNCTION_URL || '').trim();
  const fallbackApiUrl = 'https://us-central1-market-flow-7b074.cloudfunctions.net/api';

  if (!explicitApiUrl) {
    return fallbackApiUrl;
  }

  const isLocalhostUrl = /localhost:5001|127\.0\.0\.1:5001/i.test(explicitApiUrl);
  if (isLocalhostUrl && !import.meta.env.DEV) {
    return fallbackApiUrl;
  }

  return explicitApiUrl;
}

export default function Subscription() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<StoreProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [subscriptionInfo, setSubscriptionInfo] = useState<{ billingHistory?: Array<{ paymentId: string; amount: number; status: string; type: string; createdAt: string }> } | null>(null);
  const [loadingInfo, setLoadingInfo] =useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [selectedMobilePlan, setSelectedMobilePlan] = useState<SubscriptionTier>('trial');
  const [compareWithPlan, setCompareWithPlan] = useState<SubscriptionTier>('starter');
  const [showMobileCompare, setShowMobileCompare] = useState(false);
  const [planSelections, setPlanSelections] = useState<Record<PaidTier, AddOnSelection>>(getDefaultSelectionByTier('starter'));
  const [addOnExtraStorageBlocks, setAddOnExtraStorageBlocks] = useState(1);
  const [pendingPayment, setPendingPayment] = useState<{ tier: PaidTier; billing: Billing; addOns: Record<string, unknown>; label: string } | null>(null);
  const [modularPreset, setModularPreset] = useState<StartingPackageKey | 'custom'>('pkg_shop');
  const [modularBilling, setModularBilling] = useState<Billing>('monthly');
  const [modularSeats, setModularSeats] = useState(1);
  const [modularPos, setModularPos] = useState(0);
  const [modularAddOns, setModularAddOns] = useState<Record<string, boolean>>({});
  // Always tracks the exact set of selected modules — presets just pre-fill this
  const defaultShopModules = PRESET_LIST.find(p => p.key === 'pkg_shop')?.defaultModules ?? [];
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set(defaultShopModules));
  const [liveModuleToggles, setLiveModuleToggles] = useState<Record<string, boolean>>({});
  const [savingLiveModules, setSavingLiveModules] = useState(false);
  const firebaseAuth = getAuth();

  const selectedPresetData = modularPreset !== 'custom'
    ? PRESET_LIST.find(p => p.key === modularPreset)
    : null;

  // Presets are shortcuts that pre-fill the module selection — not fixed prices
  function handlePresetChange(key: StartingPackageKey | 'custom') {
    setModularPreset(key);
    if (key === 'custom') {
      setSelectedModules(new Set()); // start empty
    } else {
      const preset = PRESET_LIST.find(p => p.key === key);
      setSelectedModules(new Set(preset?.defaultModules ?? []));
    }
  }

  function toggleModule(modId: string) {
    setSelectedModules(prev => {
      const next = new Set(prev);
      if (next.has(modId)) {
        next.delete(modId);
        // Reset POS locations when POS is turned off
        if (modId === 'pos') setModularPos(0);
      } else {
        next.add(modId);
        // Default to 1 location when POS is turned on
        if (modId === 'pos') setModularPos(1);
      }
      setModularPreset('custom');
      return next;
    });
  }

  // Keep alias for compatibility with subscribe handler
  const activeModuleIds = selectedModules;

  // Price is ALWAYS per-module — presets just pre-select a starting set
  const priceBreakdown = calculateCustomPrice({
    moduleIds: Array.from(selectedModules),
    addOnKeys: Object.keys(modularAddOns).filter(k => modularAddOns[k]),
    seatCount: modularSeats,
    posLocationCount: modularPos,
    billing: modularBilling,
  });

  const grandTotal = priceBreakdown.totalUsd;
  const modularCheckoutEnabled = ECOSYSTEM_FLAGS.modularCheckout;

  function toggleLiveModule(modId: string) {
    setLiveModuleToggles((prev) => ({ ...prev, [modId]: !prev[modId] }));
  }

  const handleSaveLiveModules = async () => {
    if (!user) return;
    const storeId = getActualStoreId(user) ?? user.id;
    setSavingLiveModules(true);
    try {
      const db = getFirestore();
      const profileRef = doc(db, 'storeProfiles', storeId);
      const existing = (await getDoc(profileRef)).data() as StoreProfile | undefined;
      const enabledModules = { ...(existing?.enabledModules ?? {}) };
      for (const mod of MANAGEABLE_MODULES) {
        enabledModules[mod.id] = Boolean(liveModuleToggles[mod.id]);
      }
      await setDoc(
        profileRef,
        {
          enabledModules,
          pricingVersion: existing?.pricingVersion ?? 'modular-v2',
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
      const refreshed = await getDoc(profileRef);
      if (refreshed.exists()) {
        setProfile(refreshed.data() as StoreProfile);
      }
      toast({
        title: 'Modules updated',
        description: 'Your live module settings were saved. Refresh admin pages if a module gate still shows.',
      });
    } catch (err) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Could not save modules',
        variant: 'destructive',
      });
    } finally {
      setSavingLiveModules(false);
    }
  };

  const handleModularSubscribe = async () => {
    if (!user || !modularCheckoutEnabled) return;
    setProcessingPayment(true);
    try {
      const token = await firebaseAuth.currentUser?.getIdToken();
      const res = await fetch(`${getApiBaseUrl()}/subscription/subscribe-modular`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          name: user.name,
          preset: modularPreset === 'custom' ? null : modularPreset,
          billing: modularBilling,
          seatCount: modularSeats,
          posLocationCount: modularPos,
          enabledModuleIds: Array.from(selectedModules),
          addOnKeys: Object.keys(modularAddOns).filter(k => modularAddOns[k]),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout failed');
      if (data.paymentUrl) window.location.href = data.paymentUrl;
    } catch (err) {
      toast({
        title: 'Payment failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setProcessingPayment(false);
    }
  };

  const loadSubscriptionInfo = useCallback(async () => {
    if (!user) return;

    try {
      setLoadingInfo(true);
      const currentUser = firebaseAuth.currentUser;
      if (!currentUser) return;
      
      const token = await currentUser.getIdToken();
      const apiUrl = getSubscriptionApiBase();
      
      const response = await fetch(`${apiUrl}/subscription/info`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load subscription info');
      }

      const data = await response.json();
      setSubscriptionInfo(data);
    } catch (error) {
      console.error('Error loading subscription:', error);
      toast({
        title: 'Error',
        description: 'Failed to load subscription information',
        variant: 'destructive',
      });
    } finally {
      setLoadingInfo(false);
    }
  }, [firebaseAuth, user, toast]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }
      const db = getFirestore();
      const storeId = getActualStoreId(user) ?? user.id;
      const profileRef = doc(db, 'storeProfiles', storeId);
      const profileSnap = await getDoc(profileRef);
      if (profileSnap.exists()) {
        setProfile(profileSnap.data() as StoreProfile);
      }
      setIsLoading(false);
    };
    fetchProfile();
    loadSubscriptionInfo();
  }, [user, loadSubscriptionInfo]);

  useEffect(() => {
    if (!profile) return;
    const ent = resolveStoreEntitlements(profile);
    if (!ent) return;
    const toggles: Record<string, boolean> = {};
    for (const mod of MANAGEABLE_MODULES) {
      toggles[mod.id] = Boolean(ent.modules[mod.id]);
    }
    setLiveModuleToggles(toggles);
  }, [profile]);

  const handleStartTrial = async () => {
    const currentUser = firebaseAuth.currentUser;
    if (!currentUser) return;

    try {
      setProcessingPayment(true);
      const token = await currentUser.getIdToken();
      const apiUrl = getSubscriptionApiBase();
      
      const response = await fetch(`${apiUrl}/subscription/trial`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tier: 'trial',
          email: user?.email,
          userId: user?.id,
          name: user?.name,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start trial');
      }

      const data = await response.json();

      if (data.activated) {
        toast({
          title: 'Trial Started',
          description: 'Trial is active for up to 3 months with pay-as-you-go revenue share.',
        });
        await loadSubscriptionInfo();
        return;
      }
      
      // Redirect to payment page
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      }
    } catch (error) {
      console.error('Error starting trial:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to start trial',
        variant: 'destructive',
      });
    } finally {
      setProcessingPayment(false);
    }
  };

  // Opens the payment method picker dialog instead of going straight to a provider
  const openPaymentDialog = (
    tier: PaidTier,
    billing: Billing,
    addOns: {
      domainPackage?: boolean;
      whatsappBusiness?: boolean;
      salesCrm?: boolean;
      extraStorageBlocks?: number;
    } = {}
  ) => {
    const total = (() => {
      const base = PRICING[tier][billing];
      let t = base;
      if (addOns.domainPackage) t += PRICING.addOns.domainPackage[billing];
      if (addOns.whatsappBusiness) t += PRICING.addOns.whatsappBusiness[billing];
      if (addOns.salesCrm) t += PRICING.addOns.salesCrm[billing];
      if ((addOns.extraStorageBlocks ?? 0) > 0)
        t += (addOns.extraStorageBlocks ?? 0) * PRICING.addOns.extraStoragePer5Gb[billing];
      return t;
    })();
    setPendingPayment({
      tier,
      billing,
      addOns: addOns as Record<string, unknown>,
      label: `${PLAN_LABELS[tier]} – ${billing === 'monthly' ? 'Monthly' : 'Yearly'} ($${total})`,
    });
  };

  const handleSubscribeWhish = async () => {
    if (!pendingPayment) return;
    const { tier, billing, addOns } = pendingPayment;
    const currentUser = firebaseAuth.currentUser;
    if (!currentUser) return;

    setPendingPayment(null);
    try {
      setProcessingPayment(true);
      const token = await currentUser.getIdToken();
      const apiUrl = getSubscriptionApiBase();
      
      const response = await fetch(`${apiUrl}/subscription/subscribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tier,
          billing,
          addOns,
          email: user?.email,
          userId: user?.id,
          name: user?.name,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to subscribe');
      }

      const data = await response.json();
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      }
    } catch (error) {
      console.error('Error subscribing (Whish):', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to subscribe',
        variant: 'destructive',
      });
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleSubscribeStripe = async () => {
    if (!pendingPayment) return;
    const { tier, billing, addOns } = pendingPayment;
    const currentUser = firebaseAuth.currentUser;
    if (!currentUser) return;

    setPendingPayment(null);
    try {
      setProcessingPayment(true);
      const token = await currentUser.getIdToken();
      const apiUrl = getSubscriptionApiBase();
      
      const response = await fetch(`${apiUrl}/subscription/subscribe-stripe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tier,
          billing,
          addOns,
          email: user?.email,
          userId: user?.id,
          name: user?.name,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start card payment');
      }

      const data = await response.json();
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      }
    } catch (error) {
      console.error('Error subscribing (Stripe):', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to start card payment',
        variant: 'destructive',
      });
    } finally {
      setProcessingPayment(false);
    }
  };

  const updatePlanSelection = (tier: PaidTier, update: Partial<AddOnSelection>) => {
    setPlanSelections((prev) => ({
      ...prev,
      [tier]: {
        ...prev[tier],
        ...update,
      },
    }));
  };

  const getEligibleAddOns = (tier: SubscriptionTier): AddOnKey[] => PLAN_ELIGIBLE_ADDONS[tier];

  const calculatePlanTotal = (tier: PaidTier, billing: Billing) => {
    const selection = planSelections[tier];
    const base = PRICING[tier][billing];
    let total = base;

    if (selection.domainPackage) {
      total += PRICING.addOns.domainPackage[billing];
    }
    if (selection.whatsappBusiness) {
      total += PRICING.addOns.whatsappBusiness[billing];
    }
    if (selection.salesCrm) {
      total += PRICING.addOns.salesCrm[billing];
    }
    if (selection.extraStorageBlocks > 0) {
      total += selection.extraStorageBlocks * PRICING.addOns.extraStoragePer5Gb[billing];
    }

    return total;
  };

  const getCheckoutAddOns = (tier: SubscriptionTier) => {
    if (tier === 'trial') return {};
    const selection = planSelections[tier];
    return {
      domainPackage: selection.domainPackage,
      whatsappBusiness: selection.whatsappBusiness,
      salesCrm: selection.salesCrm,
      extraStorageBlocks: selection.extraStorageBlocks,
    };
  };

  const handleCancelSubscription = async () => {
    const currentUser = firebaseAuth.currentUser;
    if (!currentUser) return;

    try {
      const token = await currentUser.getIdToken();
      const apiUrl = getSubscriptionApiBase();
      
      const response = await fetch(`${apiUrl}/subscription/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to cancel subscription');
      }

      toast({
        title: 'Success',
        description: 'Your subscription has been cancelled. You will retain access until the end of your current billing period.',
      });

      // Reload subscription info and redirect to dashboard
      await loadSubscriptionInfo();
      
      setTimeout(() => {
        navigate('/admin/dashboard');
      }, 2000);
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      toast({
        title: 'Error',
        description: 'Failed to cancel subscription',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'trial':
        return <Badge variant="secondary">Trial</Badge>;
      case 'active':
        return <Badge variant="default">Active</Badge>;
      case 'grace':
        return <Badge variant="destructive">Grace Period</Badge>;
      case 'expired':
        return <Badge variant="outline">Expired</Badge>;
      case 'blocked':
        return <Badge variant="destructive">Blocked</Badge>;
      default:
        return <Badge variant="outline">No Subscription</Badge>;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatAmount = (amount: number) => {
    return `$${(amount / 100).toFixed(2)}`;
  };

  const normalizeAddOns = (addOns: unknown): string[] => {
    if (Array.isArray(addOns)) return addOns.filter((value): value is string => typeof value === 'string');
    if (!addOns || typeof addOns !== 'object') return [];

    const addOnObject = addOns as Record<string, unknown>;
    return Object.entries(addOnObject)
      .filter(([key, value]) => {
        if (key === 'extraStorageBlocks') return Number(value) > 0;
        return Boolean(value);
      })
      .map(([key]) => key);
  };

  if (isLoading || loadingInfo) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading subscription...</p>
        </div>
      </div>
    );
  }

  const isLegacyUser = profile?.isLegacyUser && profile?.legacyExpiresAt;
  const hasActiveSubscription = profile?.subscriptionStatus === 'active' || profile?.subscriptionStatus === 'trial';
  const entitlements = resolveStoreEntitlements(profile);
  const isModularV2WithModules =
    profile?.pricingVersion === 'modular-v2' &&
    Boolean(profile?.enabledModules && Object.keys(profile.enabledModules).length > 0);
  const showModularPackageBuilder =
    ECOSYSTEM_FLAGS.modularEntitlements &&
    !isLegacyUser &&
    !hasActiveSubscription;
  /** Active subscribers: full module library + save (no checkout). Always shown when subscribed. */
  const showLiveModuleManager = Boolean(profile) && hasActiveSubscription && !isLegacyUser;
  const canStartTrial = !profile?.hasUsedTrial && !hasActiveSubscription && !isLegacyUser;
  const activeTier = normalizeTier(profile?.subscriptionTier);
  const activeAddOns = normalizeAddOns(profile?.addOns);
  const isCurrentTrial = activeTier === 'trial' || profile?.subscriptionStatus === 'trial';
  const canManageAddOns = hasActiveSubscription && !!activeTier && activeTier !== 'trial';

  return (
    <AdminPageShell
      title="Subscription Management"
      description="Build your modular package, manage billing, and control which modules are live in your store."
      backTo="/admin/profile"
      backLabel="Back to Store Profile"
      className="max-w-6xl"
    >

      {showLiveModuleManager && (
        <AdminPanel className="mb-8 border-primary/30 shadow-md bg-white">
          <CardHeader>
            <CardTitle>Manage modules</CardTitle>
            <CardDescription>
              Add or remove any module for your store — Web Builder, Blog, CRM, POS, AI tools, inventory, and more. Changes apply immediately after save (no new checkout).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(['platform', 'apps', 'ai'] as const).map((group) => {
              const groupModules = MANAGEABLE_MODULES.filter((m) => m.group === group);
              if (!groupModules.length) return null;
              const groupLabel = group === 'platform' ? 'Platform' : group === 'apps' ? 'Apps' : 'AI tools';
              return (
                <div key={group}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{groupLabel}</p>
                  <div className="grid sm:grid-cols-2 gap-y-1 gap-x-4">
                    {groupModules.map((mod) => {
                      const paidTier = paidTierFromProfile(profile?.subscriptionTier);
                      const tierEligible =
                        mod.billing === 'core' || !mod.minTier || tierMeetsMinimum(paidTier, mod.minTier);
                      const isOn = Boolean(liveModuleToggles[mod.id]);
                      const modPrice = MODULE_PRICES[mod.id];
                      const priceLabel =
                        mod.billing === 'core'
                          ? 'Core'
                          : modPrice && modPrice.monthly > 0
                            ? `$${modPrice.monthly}/mo`
                            : 'Included';
                      return (
                        <div
                          key={mod.id}
                          className={`flex items-start gap-3 p-2.5 rounded-xl transition-all cursor-pointer ${
                            !tierEligible
                              ? 'opacity-40'
                              : isOn
                                ? 'bg-green-50 dark:bg-green-950/20 ring-1 ring-green-200/60'
                                : 'opacity-70 hover:opacity-100 hover:bg-muted/40'
                          }`}
                          onClick={() => tierEligible && toggleLiveModule(mod.id)}
                        >
                          <Checkbox
                            checked={isOn}
                            disabled={!tierEligible}
                            onCheckedChange={() => tierEligible && toggleLiveModule(mod.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-2 shrink-0"
                          />
                          <AdminModuleIcon moduleId={mod.id} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium leading-tight">{mod.name}</p>
                            <p className="text-xs text-muted-foreground line-clamp-2">{mod.summary}</p>
                            {!tierEligible && mod.minTier && (
                              <p className="text-xs text-amber-600 mt-1">
                                Requires {mod.minTier === 'business' ? 'Business' : 'Pro'}+ plan
                              </p>
                            )}
                          </div>
                          <Badge variant={isOn ? 'default' : 'outline'} className="shrink-0 text-xs">
                            {tierEligible ? priceLabel : 'Upgrade'}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <div className="flex flex-wrap gap-3 pt-2 border-t">
              <Button onClick={handleSaveLiveModules} disabled={savingLiveModules} size="lg">
                {savingLiveModules ? 'Saving…' : 'Save module changes'}
              </Button>
              {liveModuleToggles.builder && (
                <Button variant="outline" asChild>
                  <Link to="/admin/builder">Open Store Builder</Link>
                </Button>
              )}
              {liveModuleToggles.blog_publisher && (
                <Button variant="outline" asChild>
                  <Link to="/admin/blog">Open Blog Publisher</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </AdminPanel>
      )}

      {profile?.nextPlanPreset && (
        <AdminPanel className="mb-8 border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle>Next renewal plan</CardTitle>
            <CardDescription>
              Your price stays the same until{' '}
              {profile.scheduledPlanMigrationAt
                ? new Date(profile.scheduledPlanMigrationAt).toLocaleDateString()
                : profile.subscriptionEndsAt
                  ? new Date(profile.subscriptionEndsAt).toLocaleDateString()
                  : 'renewal'}
              . Then you move to modular pricing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-medium capitalize">Preset: {String(profile.nextPlanPreset).replace('pkg_', '').replace(/_/g, ' ')}</p>
            {profile.nextSeatCount && profile.nextSeatCount > 1 && (
              <p className="text-sm text-muted-foreground">{profile.nextSeatCount} users included in mapping</p>
            )}
          </CardContent>
        </AdminPanel>
      )}

      {showModularPackageBuilder && (
        <AdminPanel className="mb-8 border-slate-200/80 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.08)] bg-white/90 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Custom Package Builder</CardTitle>
            <CardDescription>
              Pick a base preset, see what's included, then add extras.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* Step 1: Base preset */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">1 — Choose your base</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {PRESET_LIST.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => handlePresetChange(p.key)}
                    className={`text-left rounded-xl border-2 p-3 transition-all shadow-sm hover:shadow-md ${
                      modularPreset === p.key
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <p className="font-semibold">{p.label}</p>
                    <p className="text-sm text-muted-foreground">${p.monthlyUsd}/mo · ${p.yearlyUsd}/yr</p>
                  </button>
                ))}
                {/* Custom / build from scratch */}
                <button
                  type="button"
                  onClick={() => handlePresetChange('custom')}
                  className={`text-left rounded-xl border-2 p-3 transition-all shadow-sm hover:shadow-md ${
                    modularPreset === 'custom'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <p className="font-semibold">Custom</p>
                  <p className="text-sm text-muted-foreground">Pay per module — from $7/mo</p>
                </button>
              </div>
            </div>

            {/* Step 2: Module selector */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  2 — {modularPreset === 'custom' ? 'Pick your modules' : `${selectedPresetData?.label ?? ''} — adjust as needed`}
                </p>
                {modularPreset !== 'custom' && selectedPresetData && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline"
                    onClick={() => setSelectedModules(new Set(selectedPresetData.defaultModules))}
                  >
                    Reset to preset defaults
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-2 italic">
                Price updates live as you toggle. Presets are just quick-start suggestions.
              </p>
              <div className="grid sm:grid-cols-2 gap-y-1 gap-x-4">
                {MODULE_CATALOG
                  .filter(m => m.billing !== 'addon' && m.status !== 'planned' && m.billing !== 'included')
                  .map((mod) => {
                    const isActive = selectedModules.has(mod.id);
                    const modPrice = MODULE_PRICES[mod.id];
                    const priceLabel = modPrice && modPrice[modularBilling] > 0
                      ? `$${modPrice[modularBilling]}/${modularBilling === 'yearly' ? 'yr' : 'mo'}`
                      : 'Free';
                    return (
                      <div key={mod.id} className="col-span-1">
                        <div
                          className={`flex items-start gap-3 p-2.5 rounded-xl cursor-pointer transition-all ${
                            isActive ? 'bg-green-50 dark:bg-green-950/20 ring-1 ring-green-200/60' : 'opacity-50 hover:opacity-80'
                          }`}
                          onClick={() => toggleModule(mod.id)}
                        >
                          <Checkbox
                            checked={isActive}
                            onCheckedChange={() => toggleModule(mod.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-2 shrink-0"
                          />
                          <AdminModuleIcon moduleId={mod.id} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium leading-tight">{mod.name}</p>
                            <p className="text-xs text-muted-foreground">{mod.summary}</p>
                          </div>
                          <Badge variant={isActive ? 'default' : 'outline'} className="shrink-0 text-xs">
                            {priceLabel}
                          </Badge>
                        </div>
                        {/* Inline POS location selector */}
                        {mod.id === 'pos' && isActive && (
                          <div className="ml-7 mt-1 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <span className="text-xs text-muted-foreground">Locations:</span>
                            {[1, 2, 3, 5].map(n => (
                              <button
                                key={n}
                                type="button"
                                onClick={() => setModularPos(n)}
                                className={`w-7 h-7 text-xs rounded-md border transition-colors ${
                                  modularPos === n
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'border-border hover:border-primary/50'
                                }`}
                              >
                                {n}
                              </button>
                            ))}
                            <span className="text-xs text-muted-foreground">
                              {modularPos > 1 ? `+$${(modularPos - 1) * (modularBilling === 'yearly' ? 10 : 10)}/mo each` : '1st free'}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                {/* Always-included (mobile app etc.) */}
                {MODULE_CATALOG.filter(m => m.billing === 'included').map(mod => (
                  <div key={mod.id} className="flex items-start gap-3 p-2.5 rounded-xl bg-green-50 dark:bg-green-950/20 ring-1 ring-green-200/60">
                    <span className="text-green-600 font-bold mt-2 text-sm shrink-0">✓</span>
                    <AdminModuleIcon moduleId={mod.id} />
                    <div>
                      <p className="text-sm font-medium leading-tight">{mod.name}</p>
                      <p className="text-xs text-muted-foreground">{mod.summary} · Always included</p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-xs">Free</Badge>
                  </div>
                ))}
              </div>
              {selectedModules.size === 0 && (
                <p className="text-xs text-amber-600 mt-2">Select at least one module to continue.</p>
              )}
            </div>

            {/* Step 3: Add-on modules */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">3 — Available add-ons</p>
              <div className="space-y-2">
                {MODULE_CATALOG.filter(m => m.billing === 'addon' && m.addOnKey).map((mod) => {
                  const key = mod.addOnKey as PricingAddOnKey;
                  const pricing = ADDON_PRICING[key];
                  const price = pricing ? pricing[modularBilling] : 0;
                  const isChecked = !!modularAddOns[key];
                  return (
                    <div
                      key={mod.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer shadow-sm hover:shadow-md ${
                        isChecked ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                      }`}
                      onClick={() => setModularAddOns(prev => ({ ...prev, [key]: !prev[key] }))}
                    >
                      <Checkbox
                        id={`addon-${mod.id}`}
                        checked={isChecked}
                        onCheckedChange={(v) => setModularAddOns(prev => ({ ...prev, [key]: !!v }))}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <AdminModuleIcon moduleId={mod.id} />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{mod.name}</p>
                        <p className="text-xs text-muted-foreground">{mod.summary}</p>
                      </div>
                      <Badge variant={isChecked ? 'default' : 'secondary'}>
                        +${price}/{modularBilling === 'yearly' ? 'yr' : 'mo'}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Coming soon */}
            {(() => {
              const comingSoon = MODULE_CATALOG.filter(
                (m) =>
                  isRoadmapModule(m) &&
                  m.billing !== 'addon' &&
                  !selectedPresetData?.defaultModules.includes(m.id),
              );
              if (!comingSoon.length) return null;
              return (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Coming soon</p>
                  <div className="grid sm:grid-cols-2 gap-y-2 gap-x-4 opacity-50">
                    {comingSoon.map(mod => (
                      <div key={mod.id} className="flex items-start gap-3 p-2 rounded-lg border border-dashed border-slate-200">
                        <AdminModuleIcon moduleId={mod.id} />
                        <div>
                          <p className="text-sm font-medium">{mod.name}</p>
                          <p className="text-xs text-muted-foreground">In development</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Step 4: Scale */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">4 — Team & scale</p>
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="text-sm font-medium block mb-1">Billing</label>
                  <Select value={modularBilling} onValueChange={(v) => setModularBilling(v as Billing)}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly (save ~17%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Users</label>
                  <Select value={String(modularSeats)} onValueChange={(v) => setModularSeats(Number(v))}>
                    <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 5, 10].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedModules.has('pos') && (
                  <div>
                    <label className="text-sm font-medium block mb-1">POS locations</label>
                    <Select value={String(modularPos)} onValueChange={(v) => setModularPos(Number(v))}>
                      <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 5].map((n) => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>

            {/* Total + Subscribe */}
            <div className="flex items-center justify-between pt-4 border-t gap-4">
              <div>
                <p className="text-3xl font-bold">
                  ${grandTotal}<span className="text-base font-normal text-muted-foreground">/{modularBilling === 'yearly' ? 'yr' : 'mo'}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedModules.size} module{selectedModules.size !== 1 ? 's' : ''} ${priceBreakdown.modulesUsd}
                  {priceBreakdown.extraSeatsUsd > 0 && ` + ${modularSeats - 1} extra user${modularSeats > 2 ? 's' : ''} $${priceBreakdown.extraSeatsUsd}`}
                  {priceBreakdown.extraPosUsd > 0 && ` + ${modularPos} POS $${priceBreakdown.extraPosUsd}`}
                  {priceBreakdown.addOnsUsd > 0 && ` + add-ons $${priceBreakdown.addOnsUsd}`}
                </p>
                {!modularCheckoutEnabled && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5 mt-2">
                    Modular checkout is temporarily disabled while billing is being verified. You can still preview your package.{' '}
                    <Link to="/onboarding/package?onboarding=custom" className="font-semibold underline">
                      Save your package here (no payment)
                    </Link>
                    {' '}— pick modules, then click <strong>Save &amp; continue</strong>.
                  </p>
                )}
                {grandTotal === 0 && selectedModules.size > 0 && (
                  <p className="text-xs text-amber-600 mt-1">Selected modules have no price yet — in development.</p>
                )}
              </div>
              <Button
                size="lg"
                onClick={() => void handleModularSubscribe()}
                disabled={processingPayment || activeModuleIds.size === 0 || !modularCheckoutEnabled}
                className="shrink-0"
              >
                {processingPayment ? 'Processing…' : modularCheckoutEnabled ? 'Subscribe' : 'Checkout paused'}
              </Button>
            </div>

          </CardContent>
        </AdminPanel>
      )}

      {/* Current Subscription Status */}
      <AdminPanel className="mb-8">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Current Plan</CardTitle>
              <CardDescription>Manage your subscription and billing</CardDescription>
            </div>
            {getStatusBadge(profile?.subscriptionStatus)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              {ECOSYSTEM_FLAGS.modularEntitlements && !hasActiveSubscription && !isLegacyUser ? (
                <p className="text-sm text-muted-foreground">
                  No active plan. Use the Custom Package Builder above to subscribe.
                </p>
              ) : ECOSYSTEM_FLAGS.modularEntitlements && hasActiveSubscription && isModularV2WithModules ? (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    {profile?.startingPackage && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Package</p>
                        <p className="font-semibold capitalize text-lg">
                          {String(profile.startingPackage).replace('pkg_', '').replace(/_/g, ' ')}
                        </p>
                      </div>
                    )}
                    {profile?.subscriptionPlan && (
                      <div className="ml-auto text-right">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Billing</p>
                        <p className="font-medium capitalize">{profile.subscriptionPlan}</p>
                      </div>
                    )}
                  </div>
                  {profile?.subscriptionEndsAt && (
                    <p className="text-xs text-muted-foreground mb-3">
                      {profile.subscriptionStatus === 'trial' ? 'Trial ends' : 'Next billing'}: {formatDate(profile.subscriptionEndsAt)}
                    </p>
                  )}
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Enabled modules</p>
                  <div className="grid grid-cols-1 gap-1">
                    {MODULE_CATALOG.filter(m => entitlements?.modules[m.id]).map(m => (
                      <div key={m.id} className="flex items-center gap-3 text-sm py-1">
                        <span className="text-green-600 font-bold">✓</span>
                        <AdminModuleIcon moduleId={m.id} size="sm" />
                        <span>{m.name}</span>
                      </div>
                    ))}
                    {!MODULE_CATALOG.some(m => entitlements?.modules[m.id]) && (
                      <p className="text-xs text-muted-foreground">No modules configured yet.</p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <h3 className="font-semibold mb-2">Plan Details</h3>
                  <dl className="space-y-2">
                    {isLegacyUser && (
                      <>
                        <div>
                          <dt className="text-sm text-gray-600">Status</dt>
                          <dd className="font-medium flex items-center gap-2">
                            <Badge variant="secondary">Legacy User - Free Access</Badge>
                          </dd>
                        </div>
                        <div>
                          <dt className="text-sm text-gray-600">Free Access Until</dt>
                          <dd className="font-medium">{formatDate(profile?.legacyExpiresAt)}</dd>
                        </div>
                      </>
                    )}
                    <div>
                      <dt className="text-sm text-gray-600">Tier</dt>
                      <dd className="font-medium capitalize">{activeTier || 'None'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-600">Billing Cycle</dt>
                      <dd className="font-medium capitalize">{profile?.subscriptionPlan || 'N/A'}</dd>
                    </div>
                    {profile?.subscriptionEndsAt && (
                      <div>
                        <dt className="text-sm text-gray-600">
                          {profile?.subscriptionStatus === 'trial' ? 'Trial Ends' : 'Next Billing Date'}
                        </dt>
                        <dd className="font-medium">{formatDate(profile?.subscriptionEndsAt)}</dd>
                      </div>
                    )}
                    {profile?.addOns && profile.addOns.length > 0 && (
                      <div>
                        <dt className="text-sm text-gray-600">Add-ons</dt>
                        <dd className="font-medium">
                          {activeAddOns.map((addon: string) => (
                            <Badge key={addon} variant="outline" className="mr-2">
                              {addon}
                            </Badge>
                          ))}
                        </dd>
                      </div>
                    )}
                    <div className="pt-2">
                      <dt className="text-sm text-gray-600 mb-2">Included modules</dt>
                      <dd>
                        <div className="grid grid-cols-1 gap-1">
                          {MODULE_CATALOG.filter((m) => entitlements?.modules[m.id]).map((m) => (
                            <div key={m.id} className="flex items-center gap-3 text-sm py-1">
                              <span className="text-green-600 font-bold">✓</span>
                              <AdminModuleIcon moduleId={m.id} size="sm" />
                              <span>{m.name}</span>
                            </div>
                          ))}
                          {!MODULE_CATALOG.some((m) => entitlements?.modules[m.id]) && (
                            <p className="text-xs text-muted-foreground">No modules resolved for this plan.</p>
                          )}
                        </div>
                      </dd>
                    </div>
                  </dl>
                </>
              )}
            </div>
            
            {(!ECOSYSTEM_FLAGS.modularEntitlements || hasActiveSubscription || isLegacyUser) && (
            <div>
              <h3 className="font-semibold mb-2">Actions</h3>
              <div className="space-y-2">
                {canStartTrial && !ECOSYSTEM_FLAGS.modularEntitlements && (
                  <div className="space-y-2">
                    <Button
                      onClick={handleStartTrial}
                      disabled={processingPayment}
                      variant="outline"
                      className="w-full"
                    >
                      {processingPayment ? 'Processing...' : 'Start Free Trial'}
                    </Button>
                  </div>
                )}
                
                {hasActiveSubscription && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="w-full">
                        Cancel Subscription
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Your subscription will be cancelled, but you'll retain access until{' '}
                          {formatDate(profile?.subscriptionEndsAt)}. You can resubscribe at any time.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                        <AlertDialogAction onClick={handleCancelSubscription}>
                          Cancel Subscription
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
            )}
          </div>
        </CardContent>
      </AdminPanel>

      {!ECOSYSTEM_FLAGS.modularEntitlements && (
        <>
      {/* Available Plans */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Available Plans</h2>
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6">
          {PLAN_ORDER.map((tier) => {
            const plan = PLAN_FEATURES[tier];
            const isTrial = tier === 'trial';
            const paidTier = tier as PaidTier;
            const eligibleAddOns = getEligibleAddOns(tier);
            const isHighlighted = tier === 'starter' || tier === 'business';

            return (
              <AdminPanel key={tier} className={isHighlighted ? 'border-primary' : ''}>
                <CardHeader>
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <CardTitle>{PLAN_LABELS[tier]}</CardTitle>
                      <CardDescription>{plan.description}</CardDescription>
                    </div>
                    {plan.badge && <Badge>{plan.badge}</Badge>}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <div className="text-2xl font-bold">{plan.monthlyLabel}</div>
                    <div className="text-sm text-gray-600">{plan.yearlyLabel}</div>
                  </div>

                  <div className="mb-4">
                    <h4 className="text-sm font-semibold mb-2">Limits</h4>
                    <ul className="space-y-1">
                      {plan.limits.map((limit) => (
                        <li key={limit} className="text-sm flex items-start">
                          <span className="mr-2 text-green-500">✓</span>
                          <span>{limit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mb-4">
                    <h4 className="text-sm font-semibold mb-2">Features</h4>
                    <ul className="space-y-1">
                      {plan.features.map((feature) => (
                        <li key={feature} className="text-sm flex items-start">
                          <span className="mr-2 text-green-500">✓</span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {plan.restrictions && (
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold mb-2">Restrictions</h4>
                      <ul className="space-y-1">
                        {plan.restrictions.map((restriction) => (
                          <li key={restriction} className="text-sm flex items-start text-gray-600">
                            <span className="mr-2">✗</span>
                            <span>{restriction}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {isTrial && (
                    <details className="mb-4 border rounded-lg p-3 text-sm">
                      <summary className="font-medium cursor-pointer">Learn more about Trial requirements</summary>
                      <div className="mt-3 space-y-2 text-gray-700">
                        <p><strong>What are operations?</strong> Invoices, purchases, recipes, and sales count toward your 30 monthly operations.</p>
                        <p><strong>What happens after 3 months?</strong> You must upgrade. A 15-day grace period applies, then data deletion workflow starts.</p>
                        <p><strong>Why card verification?</strong> Verification enables payment gateway activation; no upfront subscription charge is taken.</p>
                        <p><strong>How is 20% collected?</strong> Revenue share is deducted automatically from each paid sale before payout.</p>
                      </div>
                    </details>
                  )}

                  {!isTrial && (
                    <div className="mb-4 border rounded-lg p-3 space-y-3">
                      <h4 className="text-sm font-semibold">Add-ons at checkout</h4>
                      {eligibleAddOns.includes('domainPackage') && (
                        <label className="flex items-center justify-between text-sm gap-2">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={planSelections[paidTier].domainPackage}
                              onCheckedChange={(checked) => updatePlanSelection(paidTier, { domainPackage: Boolean(checked) })}
                            />
                            <span>Domain + Hosting + 10 Themes</span>
                          </div>
                          <span>$15/mo</span>
                        </label>
                      )}


                      {eligibleAddOns.includes('salesCrm') && (
                        <label className="flex items-center justify-between text-sm gap-2">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={planSelections[paidTier].salesCrm}
                              onCheckedChange={(checked) => updatePlanSelection(paidTier, { salesCrm: Boolean(checked) })}
                            />
                            <span>Sales CRM</span>
                          </div>
                          <span>$15/mo</span>
                        </label>
                      )}

                      {eligibleAddOns.includes('whatsappBusiness') && (
                        <label className="flex items-center justify-between text-sm gap-2">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={planSelections[paidTier].whatsappBusiness}
                              onCheckedChange={(checked) => updatePlanSelection(paidTier, { whatsappBusiness: Boolean(checked) })}
                            />
                            <span>WhatsApp Business API <span className="text-xs text-amber-600">(Coming Soon)</span></span>
                          </div>
                          <span>$10/mo</span>
                        </label>
                      )}

                      {eligibleAddOns.includes('extraStorage') && (
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span>Extra Storage (5GB blocks)</span>
                            <span>$2/mo each</span>
                          </div>
                          <input
                            type="number"
                            min={0}
                            value={planSelections[paidTier].extraStorageBlocks}
                            onChange={(event) => updatePlanSelection(paidTier, { extraStorageBlocks: Math.max(0, Number(event.target.value) || 0) })}
                            className="w-full border rounded px-3 py-2"
                          />
                        </div>
                      )}

                      <p className="text-xs text-gray-500">
                        Monthly total: ${calculatePlanTotal(paidTier, 'monthly')} • Yearly total: ${calculatePlanTotal(paidTier, 'yearly')}
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    {isTrial ? (
                      <Button onClick={handleStartTrial} disabled={processingPayment || !canStartTrial} className="w-full">
                        {processingPayment ? 'Processing...' : plan.cta}
                      </Button>
                    ) : (
                      <>
                        <Button
                          onClick={() => openPaymentDialog(paidTier, 'monthly', getCheckoutAddOns(paidTier))}
                          disabled={processingPayment}
                          variant="outline"
                          className="w-full"
                        >
                          {plan.cta} Monthly (${calculatePlanTotal(paidTier, 'monthly')})
                        </Button>
                        <Button
                          onClick={() => openPaymentDialog(paidTier, 'yearly', getCheckoutAddOns(paidTier))}
                          disabled={processingPayment}
                          className="w-full"
                        >
                          {plan.cta} Yearly (${calculatePlanTotal(paidTier, 'yearly')})
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </AdminPanel>
            );
          })}
        </div>

        {/* Enterprise Plan */}
        <div className="mt-6 rounded-xl border-2 border-indigo-300 bg-gradient-to-r from-indigo-50 to-purple-50 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl font-bold text-indigo-800">Enterprise</span>
              <Badge className="bg-indigo-600 text-white">CUSTOM</Badge>
            </div>
            <p className="text-gray-600 mb-3">For large-scale operations, franchises, and multi-branch businesses.</p>
            <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-1 text-sm text-gray-700">
              <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">✓</span> Unlimited products &amp; storage</li>
              <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">✓</span> Unlimited staff accounts</li>
              <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">✓</span> Multi-branch inventory management</li>
              <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">✓</span> Dedicated account manager</li>
              <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">✓</span> Custom integrations &amp; API priority</li>
              <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">✓</span> SLA-backed uptime guarantee</li>
              <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">✓</span> White-label option available</li>
              <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">✓</span> All add-ons included</li>
            </ul>
          </div>
          <div className="flex flex-col items-center gap-3 min-w-[200px]">
            <div className="text-center">
              <div className="text-3xl font-bold text-indigo-700">Custom</div>
              <div className="text-sm text-gray-500">Pricing</div>
            </div>
            <a
              href="mailto:enterprise@grabio.space?subject=Enterprise Plan Inquiry"
              className="w-full text-center px-6 py-3 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition"
            >
              📞 Contact Us for an Offer
            </a>
            <p className="text-xs text-gray-500 text-center">We'll get back to you within 24 hours</p>
          </div>
        </div>
      </div>

      {/* Comparison Table */}
      <AdminPanel className="mb-8">
        <CardHeader>
          <CardTitle>Plan Comparison</CardTitle>
          <CardDescription>Compare limits and features across all plans</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4">Feature</th>
                  <th className="text-left py-2 px-4">Trial</th>
                  <th className="text-left py-2 px-4">Starter</th>
                  <th className="text-left py-2 px-4">Pro</th>
                  <th className="text-left py-2 px-4">Business</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.feature} className="border-b">
                    <td className="py-2 px-4 font-medium">{row.feature}</td>
                    <td className="py-2 px-4">{row.values.trial}</td>
                    <td className="py-2 px-4">{row.values.starter}</td>
                    <td className="py-2 px-4">{row.values.pro}</td>
                    <td className="py-2 px-4">{row.values.business}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Select plan</p>
              <Select value={selectedMobilePlan} onValueChange={(value) => setSelectedMobilePlan(value as SubscriptionTier)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent>
                  {PLAN_ORDER.map((tier) => (
                    <SelectItem key={tier} value={tier}>{PLAN_LABELS[tier]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button variant="outline" className="w-full" onClick={() => setShowMobileCompare((prev) => !prev)}>
              {showMobileCompare ? 'Hide comparison' : 'Compare with...'}
            </Button>

            {showMobileCompare && (
              <div className="space-y-2">
                <Select value={compareWithPlan} onValueChange={(value) => setCompareWithPlan(value as SubscriptionTier)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose comparison plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLAN_ORDER.filter((tier) => tier !== selectedMobilePlan).map((tier) => (
                      <SelectItem key={tier} value={tier}>{PLAN_LABELS[tier]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="border rounded-lg">
              {COMPARISON_ROWS.map((row) => {
                const currentValue = row.values[selectedMobilePlan];
                const compareValue = row.values[compareWithPlan];
                const different = showMobileCompare && selectedMobilePlan !== compareWithPlan && currentValue !== compareValue;

                return (
                  <div key={row.feature} className={`p-3 border-b last:border-b-0 ${different ? 'bg-yellow-50' : ''}`}>
                    <p className="text-xs text-gray-500">{row.feature}</p>
                    <p className="font-medium">{PLAN_LABELS[selectedMobilePlan]}: {currentValue}</p>
                    {showMobileCompare && (
                      <p className={`text-sm ${different ? 'text-yellow-700 font-medium' : 'text-gray-600'}`}>
                        {PLAN_LABELS[compareWithPlan]}: {compareValue}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </AdminPanel>

      {/* Add-ons */}
      <AdminPanel className="mb-8">
        <CardHeader>
          <CardTitle>Add-ons & Upgrades</CardTitle>
          <CardDescription>Enhance your plan with additional features</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-2 px-3 font-semibold">Add-on</th>
                  <th className="text-left py-2 px-3 font-semibold">Price</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b"><td className="py-2 px-3">Sales CRM</td><td className="py-2 px-3">$15/mo · $150/yr</td></tr>
                <tr className="border-b"><td className="py-2 px-3">WhatsApp Business API</td><td className="py-2 px-3">$10/mo · $100/yr</td></tr>
                <tr className="border-b"><td className="py-2 px-3">AI Credits</td><td className="py-2 px-3 text-muted-foreground">Pay per use</td></tr>
                <tr className="border-b"><td className="py-2 px-3">Meta Advanced</td><td className="py-2 px-3 text-muted-foreground">~$12/mo (coming soon)</td></tr>
                <tr className="border-b"><td className="py-2 px-3">SEO Advanced</td><td className="py-2 px-3 text-muted-foreground">~$12/mo (coming soon)</td></tr>
                <tr><td className="py-2 px-3">Extra Storage</td><td className="py-2 px-3">$2/mo per 5GB</td></tr>
              </tbody>
            </table>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="border-2 rounded-lg p-6 hover:border-primary transition-colors">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-lg">Custom Domain + Hosting + Premium Themes</h3>
                <div className="flex gap-2">
                  <Badge>MOST POPULAR</Badge>
                  {activeAddOns.includes('domainPackage') && <Badge variant="default">Active</Badge>}
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-1">Custom domain support, premium hosting, SSL, CDN, and 10 exclusive themes</p>
              <p className="text-xs text-gray-500 mb-4">Value: worth $40+ for only $15/month (save up to $330 yearly)</p>
              <div className="text-2xl font-bold mb-4">
                ${PRICING.addOns.domainPackage.monthly}<span className="text-base text-gray-600">/month</span>
              </div>
              <div className="text-sm text-gray-600 mb-4">
                or ${PRICING.addOns.domainPackage.yearly}/year <Badge variant="secondary" className="ml-1">Save $30</Badge>
              </div>
              <div className="space-y-2">
                <Button
                  onClick={() => openPaymentDialog((activeTier as PaidTier) || 'starter', 'monthly', { domainPackage: true })}
                  disabled={processingPayment || !canManageAddOns}
                  variant="outline"
                  className="w-full"
                >
                  Add Monthly ($15/mo)
                </Button>
                <Button
                  onClick={() => openPaymentDialog((activeTier as PaidTier) || 'starter', 'yearly', { domainPackage: true })}
                  disabled={processingPayment || !canManageAddOns}
                  className="w-full"
                >
                  Add Yearly ($150/yr)
                </Button>
                {!canManageAddOns && (
                  <p className="text-xs text-red-600 mt-2">* Requires active Starter, Pro, or Business subscription</p>
                )}
              </div>
            </div>

            <div className="border-2 rounded-lg p-6 hover:border-primary transition-colors">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-lg">WhatsApp Business API</h3>
                {activeAddOns.includes('whatsappBusiness') ? (
                  <Badge variant="default">Active</Badge>
                ) : (
                  <Badge variant="secondary">Coming Soon</Badge>
                )}
              </div>
              <p className="text-sm text-gray-600 mb-1">Automated notifications, chatbot, campaigns, and abandoned cart recovery via WhatsApp Business API</p>
              <p className="text-xs text-gray-500 mb-1">Requires a Meta Business account + approved BSP (e.g. Twilio, 360dialog). Enables real automation and catalog syncing.</p>
              <p className="text-xs text-amber-600 font-medium mb-4">⚠ This feature is not yet available. Reserve your spot — billing starts when it launches.</p>
              <div className="text-2xl font-bold mb-4">
                ${PRICING.addOns.whatsappBusiness.monthly}<span className="text-base text-gray-600">/month</span>
              </div>
              <div className="text-sm text-gray-600 mb-4">
                or ${PRICING.addOns.whatsappBusiness.yearly}/year <Badge variant="secondary" className="ml-1">Save $20</Badge>
              </div>
              <div className="space-y-2">
                <Button
                  onClick={() => openPaymentDialog((activeTier as PaidTier) || 'starter', 'monthly', { whatsappBusiness: true })}
                  disabled={processingPayment || !hasActiveSubscription}
                  variant="outline"
                  className="w-full"
                >
                  Add Monthly ($10/mo)
                </Button>
                <Button
                  onClick={() => openPaymentDialog((activeTier as PaidTier) || 'starter', 'yearly', { whatsappBusiness: true })}
                  disabled={processingPayment || !hasActiveSubscription}
                  className="w-full"
                >
                  Add Yearly ($100/yr)
                </Button>
                {!hasActiveSubscription && (
                  <p className="text-xs text-red-600 mt-2">* Requires active subscription</p>
                )}
              </div>
            </div>

            <div className="border-2 rounded-lg p-6 hover:border-primary transition-colors">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-lg">Sales CRM</h3>
                {activeAddOns.includes('salesCrm') ? (
                  <Badge variant="default">Active</Badge>
                ) : null}
              </div>
              <p className="text-sm text-gray-600 mb-1">
                Field sales: rep activity logging with GPS, pipeline kanban, admin feed, visit map, performance, exports.
              </p>
              <p className="text-xs text-gray-500 mb-4">All paid plans (Starter, Pro, Business).</p>
              <div className="text-2xl font-bold mb-4">
                ${PRICING.addOns.salesCrm.monthly}<span className="text-base text-gray-600">/month</span>
              </div>
              <div className="text-sm text-gray-600 mb-4">
                or ${PRICING.addOns.salesCrm.yearly}/year <Badge variant="secondary" className="ml-1">Save $30</Badge>
              </div>
              <div className="space-y-2">
                <Button
                  onClick={() => openPaymentDialog((activeTier as PaidTier) || 'starter', 'monthly', { salesCrm: true })}
                  disabled={processingPayment || !canManageAddOns}
                  variant="outline"
                  className="w-full"
                >
                  Add Monthly ($15/mo)
                </Button>
                <Button
                  onClick={() => openPaymentDialog((activeTier as PaidTier) || 'starter', 'yearly', { salesCrm: true })}
                  disabled={processingPayment || !canManageAddOns}
                  className="w-full"
                >
                  Add Yearly ($150/yr)
                </Button>
                {!canManageAddOns && (
                  <p className="text-xs text-red-600 mt-2">* Requires active Starter, Pro, or Business subscription</p>
                )}
              </div>
            </div>

            <div className="border-2 rounded-lg p-6 hover:border-primary transition-colors">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-lg">Extra Storage</h3>
              </div>
              <p className="text-sm text-gray-600 mb-1">Additional 5GB blocks auto-billed when you exceed your base plan storage</p>
              <p className="text-xs text-gray-500 mb-2">Only charged when needed; unlimited blocks available</p>
              <div className="text-2xl font-bold mb-2">
                ${PRICING.addOns.extraStoragePer5Gb.monthly}<span className="text-base text-gray-600">/month per 5GB</span>
              </div>
              <div className="mb-4">
                <label className="text-sm text-gray-600">Blocks to add</label>
                <input
                  type="number"
                  min={1}
                  value={addOnExtraStorageBlocks}
                  onChange={(event) => setAddOnExtraStorageBlocks(Math.max(1, Number(event.target.value) || 1))}
                  className="w-full border rounded px-3 py-2 mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">Estimated monthly add-on total: ${addOnExtraStorageBlocks * PRICING.addOns.extraStoragePer5Gb.monthly}</p>
              </div>
              <Button
                onClick={() => openPaymentDialog((activeTier as PaidTier) || 'starter', 'monthly', { extraStorageBlocks: addOnExtraStorageBlocks })}
                disabled={processingPayment || !canManageAddOns}
                className="w-full"
              >
                Add Storage Blocks
              </Button>
              {!canManageAddOns && (
                <p className="text-xs text-red-600 mt-2">* Available for Starter, Pro, and Business plans</p>
              )}
            </div>
          </div>
        </CardContent>
      </AdminPanel>

        </>
      )}

      {/* Payment History */}
      {subscriptionInfo?.billingHistory && subscriptionInfo.billingHistory.length > 0 && (
        <AdminPanel>
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
            <CardDescription>Your recent transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4">Date</th>
                    <th className="text-left py-2 px-4">Type</th>
                    <th className="text-left py-2 px-4">Amount</th>
                    <th className="text-left py-2 px-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptionInfo.billingHistory.map((payment, index: number) => (
                    <tr key={index} className="border-b">
                      <td className="py-2 px-4">{formatDate(payment.createdAt)}</td>
                      <td className="py-2 px-4 capitalize">{payment.type}</td>
                      <td className="py-2 px-4">{formatAmount(payment.amount)}</td>
                      <td className="py-2 px-4">
                        <Badge
                          variant={
                            payment.status === 'success' 
                              ? 'default' 
                              : payment.status === 'failed' 
                              ? 'destructive' 
                              : 'outline'
                          }
                        >
                          {payment.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </AdminPanel>
      )}

      {/* Premium Support - Only for Premium and Pro users */}
      {(activeTier === 'pro' || activeTier === 'business' || isCurrentTrial) && hasActiveSubscription && (
        <AdminPanel className="mt-8 border-2 border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Premium WhatsApp Support
            </CardTitle>
            <CardDescription>Get direct support via WhatsApp</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 mb-4">
              As a {activeTier?.toUpperCase() || 'TRIAL'} member, you have access to our dedicated WhatsApp support line.
            </p>
            <a 
              href="https://wa.me/96179190116" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Chat on WhatsApp: +961 79 190 116
            </a>
          </CardContent>
        </AdminPanel>
      )}

      {/* Payment method picker dialog */}
      <Dialog open={!!pendingPayment} onOpenChange={(open) => { if (!open) setPendingPayment(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Payment</DialogTitle>
            <DialogDescription>
              {pendingPayment?.label} via Whish Money
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <button
              onClick={handleSubscribeWhish}
              disabled={processingPayment}
              className="flex items-center gap-4 border-2 rounded-lg p-4 hover:border-primary hover:bg-primary/5 transition-colors text-left w-full disabled:opacity-50"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <span className="text-orange-600 font-bold text-sm">W</span>
              </div>
              <div>
                <p className="font-semibold">Whish Money</p>
                <p className="text-sm text-gray-500">Pay with your Whish wallet or phone</p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <div className="mt-10 pt-6 border-t border-slate-200 text-center">
        <PoweredByEmoove />
      </div>
    </AdminPageShell>
  );
}
