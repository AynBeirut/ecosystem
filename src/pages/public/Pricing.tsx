import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle, X } from 'lucide-react';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import SEOHead from '@/components/SEOHead';
import { trackSEOEvent, trackUniqueVisit } from '@/lib/seoTracker';
import PublicNav from '@/components/public/PublicNav';
import PublicFooter from '@/components/public/PublicFooter';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/context/useAuth';
import { StoreProfile } from '@/types/storeProfile';
import {
  ADDON_PRICING,
  BillingCycle,
  calculatePackageTotal,
  EMPTY_ADDON_SELECTION,
  getModulePriceLabel,
  MODULE_CATALOG,
  isRoadmapModule,
  modulesFromSelection,
  normalizeAddOnsFromProfile,
  normalizeTier,
  PaidTier,
  PLAN_ELIGIBLE_ADDONS,
  SubscriptionTier,
  PricingModule,
  tierMeetsMinimum,
} from '@/lib/pricingDisplay';
import { ECOSYSTEM_FLAGS } from '@/lib/ecosystemFlags';
import { PRESET_LIST } from '@/lib/packagePresets';
import { calculateModularPrice } from '@/lib/modularPricing';
import { getStatusBadgeClass, getStatusLabel } from '@/lib/publicModulesContent';

const PLANS = [
  {
    tier: 'trial' as const,
    name: 'Trial',
    monthly: null,
    yearly: null,
    description: 'Pay As You Go — Free to start',
    badge: 'FREE TO START',
    highlight: false,
    cta: 'Start Free Trial',
    features: [
      'Up to 10 products',
      'Simple products & services only',
      '500 MB storage',
      '30 operations/month',
      'Core platform features',
      '20% revenue share',
    ],
    restrictions: ['No custom domain', 'No manufacturing', 'Powered by Grabio footer'],
  },
  {
    tier: 'starter' as const,
    name: 'Starter',
    monthly: 10,
    yearly: 100,
    description: 'Most chosen for growing stores',
    badge: 'POPULAR',
    highlight: true,
    cta: 'Choose Starter',
    features: [
      'Up to 8 products',
      'All product types',
      '5 GB storage',
      'Unlimited operations',
      '0% revenue share',
      'Discount codes & basic SEO',
      'Email marketing (200/month)',
    ],
    restrictions: [],
  },
  {
    tier: 'pro' as const,
    name: 'Pro',
    monthly: 20,
    yearly: 200,
    description: 'For advanced operations',
    badge: undefined,
    highlight: false,
    cta: 'Choose Pro',
    features: [
      'Up to 20 products',
      'Manufacturing included',
      '10 GB storage',
      'Advanced analytics',
      'Email marketing (1,000/month)',
      'Multi-location inventory',
    ],
    restrictions: [],
  },
  {
    tier: 'business' as const,
    name: 'Business',
    monthly: 30,
    yearly: 300,
    description: 'Best value for scaling brands',
    badge: 'BEST VALUE',
    highlight: false,
    cta: 'Choose Business',
    features: [
      'Up to 50 products',
      'Multi-user (up to 10)',
      '20 GB storage',
      'Email marketing (5,000/month)',
      'Meta shop & advanced SEO',
      'Dedicated account manager',
    ],
    restrictions: [],
  },
];

const COMPARISON_ROWS = [
  { feature: 'Monthly Cost', trial: '$0 + 20%', starter: '$10', pro: '$20', business: '$30' },
  { feature: 'Yearly Cost', trial: 'N/A', starter: '$100', pro: '$200', business: '$300' },
  { feature: 'Products', trial: '10', starter: '8', pro: '20', business: '50' },
  { feature: 'Storage', trial: '500 MB', starter: '5 GB', pro: '10 GB', business: '20 GB' },
  { feature: 'Revenue Share', trial: '20%', starter: '0%', pro: '0%', business: '0%' },
  { feature: 'Manufacturing', trial: 'No', starter: 'No', pro: 'Included', business: 'Included' },
  { feature: 'Sales CRM add-on', trial: 'No', starter: '+$15', pro: '+$15', business: '+$15' },
  { feature: 'Custom Domain add-on', trial: 'No', starter: '+$15', pro: '+$15', business: '+$15' },
];

const GROUP_LABELS: Record<PricingModule['group'], string> = {
  platform: 'Platform Features',
  apps: 'Mobile & Desktop Apps',
  ai: 'AI & Growth Tools',
};

function isToggleDisabled(mod: PricingModule, tier: PaidTier): boolean {
  if (isRoadmapModule(mod)) return true;
  if (mod.billing === 'core' || mod.billing === 'included') return true;
  if (mod.billing === 'tier' && mod.minTier && tierMeetsMinimum(tier, mod.minTier)) return true;
  return false;
}

function isModuleOn(
  mod: PricingModule,
  tier: PaidTier,
  addOns: typeof EMPTY_ADDON_SELECTION,
  extras: Record<string, boolean>,
): boolean {
  if (mod.billing === 'core' || mod.billing === 'included') return true;
  if (mod.billing === 'tier' && mod.minTier) return tierMeetsMinimum(tier, mod.minTier);
  if (mod.billing === 'addon' && mod.addOnKey) {
    if (mod.addOnKey === 'extraStorage') return addOns.extraStorageBlocks > 0;
    return addOns[mod.addOnKey];
  }
  return Boolean(extras[mod.id]);
}

const Pricing: React.FC = () => {
  const { user } = useAuth();
  const [billing, setBilling] = useState<BillingCycle>('monthly');
  const [selectedTier, setSelectedTier] = useState<PaidTier>('starter');
  const [addOns, setAddOns] = useState(EMPTY_ADDON_SELECTION);
  const [extraModules, setExtraModules] = useState<Record<string, boolean>>({});
  const [profile, setProfile] = useState<StoreProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    trackSEOEvent('page_view');
    trackUniqueVisit();
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.id) {
        setProfile(null);
        setProfileLoaded(true);
        return;
      }
      const db = getFirestore();
      const snap = await getDoc(doc(db, 'storeProfiles', user.id));
      if (snap.exists()) {
        const data = snap.data() as StoreProfile;
        setProfile(data);
        const tier = normalizeTier(data.subscriptionTier);
        if (tier === 'starter' || tier === 'pro' || tier === 'business') {
          setSelectedTier(tier);
        }
        const normalizedAddOns = normalizeAddOnsFromProfile(data.addOnsMeta ?? data.addOns);
        setAddOns(normalizedAddOns);
        if (tier === 'starter' || tier === 'pro' || tier === 'business') {
          setExtraModules((prev) => ({ ...prev, ...modulesFromSelection(tier, normalizedAddOns) }));
        }
      }
      setProfileLoaded(true);
    };
    loadProfile();
  }, [user?.id]);

  const profileTier: SubscriptionTier | null = profile
    ? normalizeTier(profile.subscriptionTier)
    : null;

  const packageTotal = useMemo(
    () => calculatePackageTotal(selectedTier, billing, addOns),
    [selectedTier, billing, addOns],
  );

  const selectedModuleIds = useMemo(() => {
    return MODULE_CATALOG.filter((mod) => isModuleOn(mod, selectedTier, addOns, extraModules)).map(
      (mod) => mod.id,
    );
  }, [selectedTier, addOns, extraModules]);

  const setModuleEnabled = (mod: PricingModule, enabled: boolean) => {
    if (mod.billing === 'addon' && mod.addOnKey) {
      if (mod.addOnKey === 'extraStorage') {
        setAddOns((prev) => ({ ...prev, extraStorageBlocks: enabled ? Math.max(prev.extraStorageBlocks, 1) : 0 }));
        return;
      }
      setAddOns((prev) => ({ ...prev, [mod.addOnKey!]: enabled }));
      return;
    }
    if (mod.billing === 'planned' || mod.billing === 'tier') {
      setExtraModules((prev) => ({ ...prev, [mod.id]: enabled }));
    }
  };

  const groupedModules = useMemo(() => {
    const groups: Record<PricingModule['group'], PricingModule[]> = {
      platform: [],
      apps: [],
      ai: [],
    };
    MODULE_CATALOG.forEach((mod) => groups[mod.group].push(mod));
    return groups;
  }, []);

  const manageHref = user ? '/admin/subscription' : '/login?tab=signup';

  return (
    <>
      <SEOHead
        title="Grabio Pricing — Build Your Modular Package"
        description="Choose a base plan and toggle platform modules and add-ons. Core features included; extras billed separately. Same pricing logic as checkout."
        url="/pricing"
        keywords={[
          'Grabio pricing',
          'modular business software pricing',
          'Sales CRM add-on',
          'small business platform cost',
        ]}
      />

      <div className="flex flex-col min-h-screen bg-white">
        <PublicNav />

        <main>
          <section className="bg-gray-50 border-b border-gray-100 py-14 text-center">
            <div className="max-w-3xl mx-auto px-4 sm:px-6">
              <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-3">
                Build Your Package
              </h1>
              <p className="text-lg text-gray-500 mb-2">
                One sign-in — all your data in one place. Pick a base plan, then toggle what you need.
              </p>
              <p className="text-sm text-gray-400 mb-8">
                Core platform features are included. Anything not on your plan is an extra charge at checkout.
              </p>
              <div className="inline-flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-1.5">
                <button
                  type="button"
                  onClick={() => setBilling('monthly')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    billing === 'monthly' ? 'bg-teal-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBilling('yearly')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    billing === 'yearly' ? 'bg-teal-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Yearly
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                      billing === 'yearly' ? 'bg-white/20 text-white' : 'bg-teal-100 text-teal-700'
                    }`}
                  >
                    Save ~$20–60
                  </span>
                </button>
              </div>
            </div>
          </section>

          {ECOSYSTEM_FLAGS.modularEntitlements && (
            <section className="py-10 border-b border-gray-100 bg-white">
              <div className="max-w-5xl mx-auto px-4">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Modular packages (rev. 5)</h2>
                <p className="text-gray-500 mb-6 text-sm">
                  Preset + $24/extra user + $15/extra POS — e.g. 3-user Kitchen ≈ $75/mo vs Odoo $93.
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {PRESET_LIST.map((p) => {
                    const price = calculateModularPrice({
                      preset: p.key,
                      seatCount: 1,
                      posLocationCount: p.defaultModules.includes('pos') ? 1 : 0,
                      billing: 'monthly',
                    });
                    return (
                      <Link
                        key={p.key}
                        to={`/login?tab=signup&preset=${p.key}`}
                        className="border rounded-xl p-4 hover:border-teal-500 transition-colors"
                      >
                        <p className="font-semibold text-gray-900">{p.label}</p>
                        <p className="text-teal-600 font-bold mt-1">${price.totalUsd}/mo</p>
                        <p className="text-xs text-gray-400 mt-2">1 user included</p>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {user && profileLoaded && (
            <section className="border-b border-teal-100 bg-teal-50/60">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-sm text-teal-900">
                  <span className="font-semibold">Signed in</span>
                  {profileTier ? (
                    <>
                      {' '}
                      — current plan:{' '}
                      <span className="capitalize font-bold">{profileTier}</span>
                      {profile?.subscriptionStatus ? ` (${profile.subscriptionStatus})` : ''}
                    </>
                  ) : (
                    ' — no active store profile found'
                  )}
                </div>
                <Link
                  to="/admin/subscription"
                  className="text-sm font-semibold text-teal-700 hover:text-teal-900"
                >
                  Manage subscription in dashboard →
                </Link>
              </div>
            </section>
          )}

          <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Base plans</h2>
            <p className="text-center text-gray-500 text-sm mb-8 max-w-2xl mx-auto">
              Select a plan for your package estimate. Trial stays pay-as-you-go until you upgrade.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              {PLANS.map((plan) => {
                const isPaid = plan.tier !== 'trial';
                const isSelected = isPaid && selectedTier === plan.tier;
                return (
                  <button
                    key={plan.name}
                    type="button"
                    onClick={() => {
                      if (isPaid) setSelectedTier(plan.tier);
                    }}
                    disabled={!isPaid}
                    className={`rounded-2xl border p-6 flex flex-col relative text-left transition-all ${
                      isSelected
                        ? 'border-teal-500 ring-2 ring-teal-500/20 bg-gradient-to-b from-teal-50/50 to-white'
                        : plan.highlight
                          ? 'border-teal-200 bg-white hover:border-teal-400'
                          : 'border-gray-200 bg-white'
                    } ${!isPaid ? 'cursor-default' : 'cursor-pointer hover:shadow-md'}`}
                  >
                    {plan.badge && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span
                          className={`text-xs font-bold px-3 py-1 rounded-full ${
                            plan.highlight ? 'bg-teal-600 text-white' : 'bg-gray-800 text-white'
                          }`}
                        >
                          {plan.badge}
                        </span>
                      </div>
                    )}
                    <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                    <p className="text-xs text-gray-500 mt-1 mb-4">{plan.description}</p>
                    {plan.monthly === null ? (
                      <p className="text-2xl font-extrabold text-gray-900 mb-4">Free + 20% sales</p>
                    ) : (
                      <p className="text-3xl font-extrabold text-gray-900 mb-4">
                        ${billing === 'yearly' ? plan.yearly : plan.monthly}
                        <span className="text-sm font-normal text-gray-500">
                          /{billing === 'yearly' ? 'yr' : 'mo'}
                        </span>
                      </p>
                    )}
                    <ul className="space-y-2 text-sm text-gray-600 flex-1">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-teal-500 mt-0.5 flex-shrink-0" />
                          {f}
                        </li>
                      ))}
                      {plan.restrictions.map((r) => (
                        <li key={r} className="flex items-start gap-2 text-gray-400">
                          <X className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          {r}
                        </li>
                      ))}
                    </ul>
                    {isSelected && (
                      <p className="mt-4 text-xs font-bold text-teal-600 uppercase tracking-wide">
                        Selected for estimate
                      </p>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="grid lg:grid-cols-[1fr_320px] gap-8 items-start">
              <div className="space-y-8">
                {(Object.keys(groupedModules) as PricingModule['group'][]).map((groupKey) => (
                  <div key={groupKey}>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{GROUP_LABELS[groupKey]}</h3>
                    <p className="text-sm text-gray-500 mb-4">
                      {groupKey === 'platform' &&
                        'Web admin modules — core included on all paid plans; extras billed separately.'}
                      {groupKey === 'apps' &&
                        'Native apps — Admin Android included with your account; others in development.'}
                      {groupKey === 'ai' &&
                        'In-account AI tools — email limits vary by plan; full AI billing alignment coming.'}
                    </p>
                    <div className="space-y-3">
                      {groupedModules[groupKey].map((mod) => {
                        const on = isModuleOn(mod, selectedTier, addOns, extraModules);
                        const disabled = isToggleDisabled(mod, selectedTier);
                        const priceLabel = getModulePriceLabel(mod, billing, selectedTier);
                        const addonBlocked =
                          mod.billing === 'addon' &&
                          mod.addOnKey &&
                          mod.addOnKey !== 'extraStorage' &&
                          !PLAN_ELIGIBLE_ADDONS[selectedTier].includes(mod.addOnKey);

                        return (
                          <div
                            key={mod.id}
                            className={`flex items-start gap-4 rounded-xl border p-4 ${
                              on ? 'border-teal-200 bg-teal-50/30' : 'border-gray-200 bg-white'
                            }`}
                          >
                            <span className="text-2xl leading-none" aria-hidden>
                              {mod.icon}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-gray-900">{mod.name}</p>
                                <span
                                  className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${getStatusBadgeClass(mod.status)}`}
                                >
                                  {getStatusLabel(mod.status)}
                                </span>
                              </div>
                              <p className="text-sm text-gray-500 mt-0.5">{mod.summary}</p>
                              <p className="text-xs font-medium text-teal-700 mt-1">{priceLabel}</p>
                              {addonBlocked && (
                                <p className="text-xs text-amber-700 mt-1">Not available on Trial — select a paid plan.</p>
                              )}
                            </div>
                            <Switch
                              checked={on}
                              disabled={disabled || addonBlocked}
                              onCheckedChange={(checked) => setModuleEnabled(mod, checked)}
                              aria-label={`Toggle ${mod.name}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <aside className="lg:sticky lg:top-24 rounded-2xl border border-gray-200 bg-gray-50 p-5">
                <h3 className="text-lg font-bold text-gray-900 mb-1">Your estimate</h3>
                <p className="text-xs text-gray-500 mb-4">
                  {user
                    ? 'Based on your toggles — checkout uses the same add-on prices in Subscription.'
                    : 'Sign in to pre-fill your current package.'}
                </p>

                <div className="mb-4 rounded-xl bg-white border border-gray-200 p-3">
                  <p className="text-xs text-gray-500 mb-1">Base plan</p>
                  <p className="font-semibold capitalize text-gray-900">{selectedTier}</p>
                </div>

                <ul className="space-y-2 text-sm mb-4">
                  {packageTotal.lineItems.map((line) => (
                    <li key={line.label} className="flex justify-between gap-2 text-gray-700">
                      <span>{line.label}</span>
                      <span className="font-medium">${line.amount}</span>
                    </li>
                  ))}
                </ul>

                <div className="flex justify-between items-baseline border-t border-gray-200 pt-3 mb-4">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="text-2xl font-extrabold text-teal-700">
                    ${packageTotal.total}
                    <span className="text-sm font-normal text-gray-500">{packageTotal.periodLabel}</span>
                  </span>
                </div>

                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-700 mb-2">
                    Selected modules ({selectedModuleIds.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {selectedModuleIds.map((id) => (
                      <span
                        key={id}
                        className="text-[10px] font-mono bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-600"
                      >
                        grabio_{id}
                      </span>
                    ))}
                  </div>
                </div>

                <p className="text-[11px] text-gray-400 mb-4 leading-relaxed">
                  Modules marked &quot;In development&quot; or &quot;billing TBA&quot; are shown for planning only —
                  not added to total until billing goes live.
                </p>

                <Link
                  to={manageHref}
                  className="block w-full text-center py-2.5 rounded-xl font-semibold text-sm bg-teal-600 text-white hover:bg-teal-700 transition-colors"
                >
                  {user ? 'Continue in Subscription' : 'Sign up to activate'}{' '}
                  <ArrowRight className="inline ml-1 h-3.5 w-3.5" />
                </Link>
                <Link
                  to="/home#modules"
                  className="block w-full text-center mt-2 text-xs text-teal-700 hover:text-teal-900 font-medium"
                >
                  Compare all modules on home →
                </Link>
              </aside>
            </div>
          </section>

          <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-12">
            <h2 className="text-xl font-bold text-gray-900 mb-4 text-center">Billed add-ons (extra charge)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {(Object.keys(ADDON_PRICING) as (keyof typeof ADDON_PRICING)[]).map((key) => (
                <div key={key} className="border border-gray-200 rounded-xl p-4 bg-white">
                  <p className="font-semibold text-gray-900 text-sm mb-1">{ADDON_PRICING[key].label}</p>
                  <p className="text-teal-600 font-bold">
                    ${ADDON_PRICING[key][billing]}/{billing === 'yearly' ? 'yr' : 'mo'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {key === 'extraStorage' ? 'Per 5 GB block · Starter+' : 'Toggle above to include in estimate'}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Plan comparison</h2>
            <div className="overflow-x-auto rounded-2xl border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-6 py-4 font-semibold text-gray-700 w-2/5">Feature</th>
                    <th className="px-4 py-4 text-center font-semibold text-gray-700">Trial</th>
                    <th className="px-4 py-4 text-center font-semibold text-teal-600">Starter</th>
                    <th className="px-4 py-4 text-center font-semibold text-gray-700">Pro</th>
                    <th className="px-4 py-4 text-center font-semibold text-gray-700">Business</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((row, i) => (
                    <tr key={row.feature} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="px-6 py-3 text-gray-700">{row.feature}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{row.trial}</td>
                      <td className="px-4 py-3 text-center font-medium text-teal-700">{row.starter}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{row.pro}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{row.business}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-gray-50 py-16 border-t border-gray-100">
            <div className="max-w-3xl mx-auto px-4 sm:px-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Frequently Asked Questions</h2>
              <dl className="space-y-6">
                {[
                  {
                    q: 'How does modular pricing work?',
                    a: 'Every store gets core platform features on a base plan. Optional modules and add-ons (like Sales CRM or custom domain) are extra charges — toggle them on this page to preview your total before checkout.',
                  },
                  {
                    q: 'What is the Trial plan?',
                    a: 'Trial is free to start with 20% revenue share for up to 3 months. Upgrade to a paid plan for 0% revenue share and access to paid add-ons.',
                  },
                  {
                    q: 'Can I get CRM and PSA together?',
                    a: 'Sales CRM is a live billed add-on ($15/mo). Projects (PSA) is in development — you can select it here to plan your stack; billing will be added when the module launches.',
                  },
                  {
                    q: 'Does this page charge my card?',
                    a: 'No. This page is an estimate. Activate or change your package from Subscription in your admin dashboard.',
                  },
                ].map(({ q, a }) => (
                  <div key={q}>
                    <dt className="font-semibold text-gray-900 mb-2">{q}</dt>
                    <dd className="text-gray-500 leading-relaxed">{a}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          <section className="py-14 text-center max-w-2xl mx-auto px-4 sm:px-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Still have questions?</h2>
            <p className="text-gray-500 mb-6">Our team will help you choose the right plan and modules.</p>
            <Link
              to="/contact"
              className="px-6 py-3 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 transition-colors"
            >
              Talk to Us
            </Link>
          </section>
        </main>

        <PublicFooter />
      </div>
    </>
  );
};

export default Pricing;
