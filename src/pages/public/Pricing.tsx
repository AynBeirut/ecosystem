import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import PublicPageShell from '@/components/public/PublicPageShell';
import { cn } from '@/lib/utils';
import { trackSEOEvent, trackUniqueVisit } from '@/lib/seoTracker';
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
import { ORDERED_PRESET_LIST } from '@/lib/packagePresets';
import { CORE_ENTRY_PACKAGES, INDUSTRY_PACKAGES } from '@/lib/modularPackageLimits';
import { calculateModularPrice } from '@/lib/modularPricing';
import { getStatusBadgeClass, getStatusLabel } from '@/lib/publicModulesContent';

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
    <PublicPageShell
      title="Grabio Pricing — Modular Packages"
      description="Industry presets from $5/mo, modular seats and add-ons. Toggle modules to preview your package before checkout."
      url="/pricing"
      keywords={[
        'Grabio pricing',
        'modular business software pricing',
        'Sales CRM add-on',
        'small business platform cost',
      ]}
      eyebrow="Pricing"
      heroTitle="Modular packages"
      heroDescription="Choose a preset for your industry, then toggle modules and add-ons. Same pricing logic as checkout."
      heroActions={
        <div className="public-segment">
          <button
            type="button"
            onClick={() => setBilling('monthly')}
            className={cn('public-segment-btn', billing === 'monthly' && 'public-segment-btn-active')}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBilling('yearly')}
            className={cn('public-segment-btn flex items-center gap-2', billing === 'yearly' && 'public-segment-btn-active')}
          >
            Yearly
            <span
              className={cn(
                'text-xs px-1.5 py-0.5 rounded-full font-semibold',
                billing === 'yearly' ? 'bg-white/20 text-white' : 'bg-teal-100 text-teal-700',
              )}
            >
              Save ~$20–60
            </span>
          </button>
        </div>
      }
      subnav={[
        { label: 'Use Cases', href: '/use-cases' },
        { label: 'Features', href: '/features' },
        { label: 'Contact', href: '/contact' },
      ]}
    >

          {ECOSYSTEM_FLAGS.modularEntitlements && (
            <section className="py-10 border-b border-gray-100 bg-white">
              <div className="max-w-5xl mx-auto px-4">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Modular packages</h2>
                <p className="text-gray-500 mb-6 text-sm">
                  Start small and scale — Shop adds +10 products per extra $10/mo above $27.
                </p>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Core plans</h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  {ORDERED_PRESET_LIST.filter((p) => CORE_ENTRY_PACKAGES.includes(p.key)).map((p) => {
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
                        className="border rounded-xl p-4 hover:border-teal-500 transition-colors flex flex-col"
                      >
                        <p className="font-semibold text-gray-900">{p.label}</p>
                        <p className="text-teal-600 font-bold mt-1">${price.totalUsd}/mo</p>
                        <ul className="mt-3 space-y-1 text-xs text-gray-500 flex-1">
                          {p.limitLines.map((line) => (
                            <li key={line}>• {line}</li>
                          ))}
                        </ul>
                        <p className="text-xs text-gray-400 mt-3">1 user included</p>
                      </Link>
                    );
                  })}
                </div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Industry workflows</h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {ORDERED_PRESET_LIST.filter((p) => INDUSTRY_PACKAGES.includes(p.key)).map((p) => {
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
                        className="border rounded-xl p-4 hover:border-teal-500 transition-colors flex flex-col"
                      >
                        <p className="font-semibold text-gray-900">{p.label}</p>
                        <p className="text-teal-600 font-bold mt-1">${price.totalUsd}/mo</p>
                        <ul className="mt-3 space-y-1 text-xs text-gray-500 flex-1">
                          {p.limitLines.map((line) => (
                            <li key={line}>• {line}</li>
                          ))}
                        </ul>
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
                  <label htmlFor="estimate-tier" className="text-xs text-gray-500 mb-1 block">
                    Estimate tier (add-ons)
                  </label>
                  <select
                    id="estimate-tier"
                    value={selectedTier}
                    onChange={(e) => setSelectedTier(e.target.value as PaidTier)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold capitalize text-gray-900"
                  >
                    <option value="starter">Starter</option>
                    <option value="pro">Pro</option>
                    <option value="business">Business</option>
                  </select>
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
                  to="/features"
                  className="block w-full text-center mt-2 text-xs text-teal-700 hover:text-teal-900 font-medium"
                >
                  Compare all modules →
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

          <section className="public-panel">
            <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">Frequently asked questions</h2>
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
          </section>

          <section className="public-panel text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-3">Still have questions?</h2>
            <p className="text-slate-600 mb-6">Our team will help you choose the right plan and modules.</p>
            <Link
              to="/contact"
              className="inline-flex px-6 py-3 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 transition-colors"
            >
              Talk to Us
            </Link>
          </section>
    </PublicPageShell>
  );
};

export default Pricing;
