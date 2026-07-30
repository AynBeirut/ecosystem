import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Boxes, Cpu, Smartphone } from 'lucide-react';
import SEOHead from '@/components/SEOHead';
import { trackSEOEvent, trackUniqueVisit } from '@/lib/seoTracker';
import PublicNav from '@/components/public/PublicNav';
import PublicFooter from '@/components/public/PublicFooter';
import AuthCTA from '@/components/public/AuthCTA';
import HomeModuleCard from '@/components/public/HomeModuleCard';
import HomeCapabilityTile from '@/components/public/HomeCapabilityTile';
import { useAuth } from '@/context/useAuth';
import { cn } from '@/lib/utils';
import {
  adminHeadingClass,
  adminPanel,
  adminSectionLabelClass,
  adminStatLabelClass,
  adminStatTileClass,
  adminStatValueClass,
  adminSubnavLink,
} from '@/lib/adminStyles';
import { MODULE_CATALOG, type PricingModule } from '@/lib/pricingDisplay';
import { CORE_MODULE_IDS } from '@/lib/moduleManifest';
import { PACKAGE_DRAFT_STORAGE_KEY } from '@/lib/packageDraft';
import { getPlatformCapabilityIcon } from '@/lib/moduleIcons';
import {
  getModulesByGroup,
  MODULE_FEATURE_ITEMS,
  MODULE_GROUP_META,
  PLATFORM_CAPABILITIES,
} from '@/lib/publicModulesContent';
import { BLOG_POSTS } from '@/data/blog-posts';
import PoweredByEmoove from '@/components/PoweredByEmoove';

type FilterKey = 'all' | PricingModule['group'];

const GROUP_KEYS: PricingModule['group'][] = ['platform', 'apps', 'ai'];
const FILTER_OPTIONS: { key: FilterKey; label: string; icon?: React.ComponentType<{ className?: string }> }[] = [
  { key: 'all', label: 'All Modules' },
  { key: 'platform', label: 'Platform', icon: Boxes },
  { key: 'apps', label: 'Apps', icon: Smartphone },
  { key: 'ai', label: 'AI Tools', icon: Cpu },
];

const STATS = [
  { value: '500+', label: 'Active Stores' },
  { value: '50K+', label: 'Orders Processed' },
  { value: '4.8 / 5', label: 'Average Rating' },
  { value: '< 2s', label: 'Page Load Time' },
];

const USE_CASES = [
  'Retail Stores',
  'Cafes & Restaurants',
  'Wholesale Distributors',
  'Service Businesses',
  'Manufacturers',
  'Multi-Branch Operations',
];

function buildInitialModules(): Record<string, boolean> {
  const modules: Record<string, boolean> = {};
  CORE_MODULE_IDS.forEach((id) => {
    modules[id] = true;
  });
  MODULE_CATALOG.forEach((m) => {
    if (!CORE_MODULE_IDS.includes(m.id as (typeof CORE_MODULE_IDS)[number])) {
      modules[m.id] = false;
    }
  });
  try {
    const raw = sessionStorage.getItem(PACKAGE_DRAFT_STORAGE_KEY);
    if (raw) {
      const draft = JSON.parse(raw) as { modules?: Record<string, boolean> };
      if (draft?.modules) {
        Object.entries(draft.modules).forEach(([id, on]) => {
          if (typeof on === 'boolean') modules[id] = on;
        });
      }
    }
  } catch {
    /* ignore */
  }
  CORE_MODULE_IDS.forEach((id) => {
    modules[id] = true;
  });
  return modules;
}

function persistDraft(modules: Record<string, boolean>) {
  try {
    sessionStorage.setItem(
      PACKAGE_DRAFT_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        savedAt: new Date().toISOString(),
        path: 'custom',
        modules,
      }),
    );
  } catch {
    /* ignore */
  }
}

const ModularHome: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [enabledModules, setEnabledModules] = useState<Record<string, boolean>>(buildInitialModules);

  const dashboardPath =
    user?.role === 'crm_rep'
      ? '/team/crm'
      : user?.role === 'sub_account'
        ? '/team/dashboard'
        : '/admin/dashboard';

  useEffect(() => {
    trackSEOEvent('page_view');
    trackUniqueVisit();
  }, []);

  useEffect(() => {
    persistDraft(enabledModules);
  }, [enabledModules]);

  const visibleModules = useMemo(() => {
    const all = GROUP_KEYS.flatMap((g) => getModulesByGroup(g));
    if (filter === 'all') return all;
    return getModulesByGroup(filter);
  }, [filter]);

  const manifestIds = useMemo(() => {
    return MODULE_CATALOG.filter((m) => enabledModules[m.id]).map((m) => `grabio_${m.id}`);
  }, [enabledModules]);

  const toggleModule = (id: string, on: boolean) => {
    if (CORE_MODULE_IDS.includes(id as (typeof CORE_MODULE_IDS)[number])) return;
    setEnabledModules((prev) => ({ ...prev, [id]: on }));
  };

  const recentPosts = BLOG_POSTS.slice(0, 3);

  return (
    <>
      <SEOHead
        title="Grabio — Modular Business Platform"
        description="Grabio modular ecosystem: POS, inventory, invoicing, marketplace, CRM, and more — activate only what your business needs."
        url="/home"
        keywords={[
          'modular business platform',
          'Grabio ecosystem',
          'business management software',
          'installable modules',
        ]}
      />

      <div className="home-dashboard flex min-h-screen flex-col" data-admin-theme="dark">
        <PublicNav />

        <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-6 md:py-8">
          <section className="admin-page-hero">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-300/90">
                  Grabio ecosystem
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-white md:text-3xl">
                  Your modular business stack
                </h1>
                <p className="mt-2 max-w-xl text-sm text-slate-300">
                  One sign-in, shared data — toggle modules below to preview what your store runs on.
                </p>
                <p className="mt-3">
                  <PoweredByEmoove variant="onDark" />
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {isLoading ? (
                  <div className="h-10 w-40 animate-pulse rounded-xl bg-white/10" aria-hidden />
                ) : user ? (
                  <Link
                    to={dashboardPath}
                    className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-500/20 transition hover:bg-teal-400"
                  >
                    Go to Dashboard
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <Link
                    to="/login?tab=signup&onboarding=custom"
                    className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-500/20 transition hover:bg-teal-400"
                  >
                    Get Started Free
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
                <Link
                  to="/pricing"
                  className="inline-flex items-center rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  Customize package
                </Link>
                <a
                  href="#modules"
                  className="inline-flex items-center rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  Explore modules
                </a>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {STATS.map((s) => (
              <div key={s.label} className={cn(adminStatTileClass, 'p-4 md:p-5')}>
                <p className={adminStatValueClass}>{s.value}</p>
                <p className={cn(adminStatLabelClass, 'mt-1')}>{s.label}</p>
              </div>
            ))}
          </section>

          <section id="modules" className={cn(adminPanel(), 'scroll-mt-24 p-4 md:p-6')}>
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className={adminSectionLabelClass}>Module catalog</p>
                <h2 className={adminHeadingClass}>Installable modules</h2>
                <p className="mt-1 max-w-xl text-sm text-slate-500">
                  Shared core with tenant-level flags — toggle to preview your setup.
                </p>
              </div>
              <Link
                to="/pricing"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-600 hover:text-teal-700"
              >
                Customize your package
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mb-6 flex flex-wrap gap-2">
              {FILTER_OPTIONS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={cn(
                    adminSubnavLink(filter === key),
                    'inline-flex items-center gap-2 !rounded-xl px-3 py-2',
                    filter === key && '!border-teal-500/30 !bg-teal-500 !text-white',
                  )}
                >
                  {Icon && <Icon className="h-4 w-4" strokeWidth={1.75} />}
                  {label}
                </button>
              ))}
            </div>

            {filter !== 'all' && (
              <div className="mb-6 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                <p className={adminSectionLabelClass}>
                  {filter === 'platform' ? 'Core stack' : filter === 'apps' ? 'Native apps' : 'Intelligence'}
                </p>
                <h3 className="text-base font-semibold text-slate-900">{MODULE_GROUP_META[filter].title}</h3>
                <p className="mt-1 text-sm text-slate-500">{MODULE_GROUP_META[filter].description}</p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleModules.map((mod) => (
                <HomeModuleCard
                  key={mod.id}
                  mod={mod}
                  items={MODULE_FEATURE_ITEMS[mod.id] ?? [mod.summary]}
                  enabled={Boolean(enabledModules[mod.id])}
                  coreLocked={CORE_MODULE_IDS.includes(mod.id as (typeof CORE_MODULE_IDS)[number])}
                  onToggle={(on) => toggleModule(mod.id, on)}
                />
              ))}
            </div>

            <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50/90 p-4 md:p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <h3 className="text-sm font-semibold text-slate-900">Simulated tenant feature flags</h3>
                <span className="text-xs text-slate-500">Live manifest preview</span>
              </div>
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                {manifestIds.map((id) => {
                  const isCore = CORE_MODULE_IDS.some((c) => id === `grabio_${c}`);
                  return (
                    <li
                      key={id}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-xs font-medium',
                        isCore
                          ? 'border-blue-200 bg-blue-50 text-blue-700'
                          : 'border-teal-200 bg-teal-50 text-teal-700',
                      )}
                    >
                      {id}
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>

          <section id="platform-features" className={cn(adminPanel(), 'scroll-mt-24 p-4 md:p-6')}>
            <div className="mb-5">
              <p className={adminSectionLabelClass}>Platform</p>
              <h2 className={adminHeadingClass}>Capabilities</h2>
              <p className="mt-1 text-sm text-slate-500">
                Secure, mobile-first, synced in real time across web and Android.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {PLATFORM_CAPABILITIES.map(({ title, desc }) => {
                const { Icon, accent } = getPlatformCapabilityIcon(title);
                return <HomeCapabilityTile key={title} title={title} desc={desc} Icon={Icon} accent={accent} />;
              })}
            </div>
          </section>

          <section id="industries" className={cn(adminPanel(), 'scroll-mt-24 p-4 md:p-6')}>
            <div className="mb-5 text-center">
              <p className={adminSectionLabelClass}>Industries</p>
              <h2 className={adminHeadingClass}>Built for your business</h2>
              <p className="mx-auto mt-1 max-w-xl text-sm text-slate-500">
                Retail, F&amp;B, wholesale, services, manufacturing, and multi-branch ops.
              </p>
            </div>
            <div className="mx-auto grid max-w-3xl gap-2 sm:grid-cols-2 md:grid-cols-3">
              {USE_CASES.map((label) => (
                <div
                  key={label}
                  className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-sm font-medium text-slate-700"
                >
                  <span className="font-bold text-teal-600">✓</span>
                  {label}
                </div>
              ))}
            </div>
            <div className="mt-6 text-center">
              <Link to="/use-cases" className="text-sm font-semibold text-teal-600 hover:text-teal-700">
                See all use cases →
              </Link>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className={cn(adminPanel(), 'p-5 md:p-6')}>
              <p className={adminSectionLabelClass}>Why Grabio</p>
              <h2 className={adminHeadingClass}>One platform. No juggling.</h2>
              <p className="mt-2 text-sm text-slate-500">
                POS, inventory, invoices, and analytics share the same data — no more disconnected tools.
              </p>
              <ul className="mb-5 mt-4 space-y-2 text-sm text-slate-600">
                {[
                  'Sales automatically update inventory',
                  'Orders auto-generate professional invoices',
                  'Reports update in real time',
                  'AI tools inside your account',
                ].map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-teal-600">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                See pricing
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className={cn(adminPanel(), 'space-y-4 p-5 md:p-6')}>
              <div>
                <p className="mb-2 text-xs font-bold uppercase text-slate-500">Before Grabio</p>
                <ul className="space-y-1 rounded-xl border border-red-100 bg-red-50/80 p-4 text-sm text-red-900/80">
                  <li>WhatsApp orders → lost in chat</li>
                  <li>Excel inventory → always outdated</li>
                  <li>Word invoices → slow &amp; inconsistent</li>
                </ul>
              </div>
              <div>
                <p className="mb-2 text-xs font-bold uppercase text-slate-500">With Grabio</p>
                <ul className="space-y-1 rounded-xl border border-teal-100 bg-teal-50/80 p-4 text-sm text-teal-900/90">
                  <li>Unified order queue → nothing missed</li>
                  <li>Live inventory → updated on every sale</li>
                  <li>Instant invoices → shareable in seconds</li>
                </ul>
              </div>
            </div>
          </section>

          <section className={cn(adminPanel(), 'p-4 md:p-6')}>
            <div className="mb-5 text-center">
              <p className={adminSectionLabelClass}>Resources</p>
              <h2 className={adminHeadingClass}>For business owners</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {recentPosts.map((post) => (
                <Link
                  key={post.slug}
                  to={`/blog/${post.slug}`}
                  className="block rounded-xl border border-slate-100 bg-slate-50/50 p-4 transition hover:border-teal-200 hover:bg-white hover:shadow-sm"
                >
                  <span className="rounded-full bg-teal-50 px-2 py-1 text-[10px] font-bold uppercase text-teal-600">
                    {post.category}
                  </span>
                  <h3 className="mt-3 line-clamp-2 text-sm font-semibold text-slate-900">{post.title}</h3>
                  <p className="mt-2 line-clamp-2 text-xs text-slate-500">{post.excerpt}</p>
                </Link>
              ))}
            </div>
          </section>

          <section className="admin-page-hero text-center">
            <h2 className="text-xl font-bold text-white md:text-2xl">Start running your business on data</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-slate-300">
              Replace disconnected tools with one modular platform. Free to start.
            </p>
            <div className="mt-5 flex min-h-[44px] flex-col justify-center gap-2 sm:flex-row">
              {isLoading ? (
                <div className="mx-auto h-11 w-48 animate-pulse rounded-xl bg-white/10" aria-hidden />
              ) : user ? (
                <Link
                  to={dashboardPath}
                  className="rounded-xl bg-teal-500 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-400"
                >
                  Go to Dashboard →
                </Link>
              ) : (
                <AuthCTA className="rounded-xl bg-teal-500 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-400" />
              )}
              <Link
                to="/contact"
                className="rounded-xl border border-white/20 px-6 py-3 text-sm font-semibold text-white hover:bg-white/5"
              >
                Talk to us
              </Link>
            </div>
          </section>
        </main>

        <PublicFooter />
      </div>
    </>
  );
};

export default ModularHome;
