import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Boxes, Cpu, Smartphone } from 'lucide-react';
import SEOHead from '@/components/SEOHead';
import { trackSEOEvent, trackUniqueVisit } from '@/lib/seoTracker';
import PublicNav from '@/components/public/PublicNav';
import PublicFooter from '@/components/public/PublicFooter';
import AuthCTA from '@/components/public/AuthCTA';
import HomeModuleCard from '@/components/public/HomeModuleCard';
import { useAuth } from '@/context/useAuth';
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

      <div className="flex flex-col min-h-screen bg-slate-50">
        <PublicNav />

        <main className="overflow-x-hidden">
          <section className="relative bg-[#0b1220] text-white py-20 md:py-28 overflow-hidden">
            <div
              className="absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 20% 20%, rgba(20,184,166,0.35) 0%, transparent 45%), radial-gradient(circle at 80% 0%, rgba(99,102,241,0.25) 0%, transparent 40%)',
              }}
              aria-hidden
            />
            <div
              className="absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
                backgroundSize: '48px 48px',
              }}
              aria-hidden
            />

            <div className="relative max-w-5xl mx-auto px-4 sm:px-6 text-center">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-teal-300/90 mb-6">
                <span className="h-px w-8 bg-teal-400/50" />
                Grabio Ecosystem
                <span className="h-px w-8 bg-teal-400/50" />
              </p>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-5 bg-gradient-to-b from-white to-slate-300 bg-clip-text text-transparent">
                Manage your business.<br className="hidden sm:block" /> Grow your commerce.
              </h1>
              <p className="text-lg text-slate-300 max-w-2xl mx-auto mb-2 font-light">
                One sign-in — all your data in one place.
              </p>
              <p className="text-sm text-slate-400 max-w-xl mx-auto mb-4">
                Installable modules for web admin, mobile apps, and in-account AI — toggle below to preview your stack.
              </p>
              <p className="mb-8">
                <PoweredByEmoove variant="onDark" />
              </p>

              <div className="flex flex-wrap gap-2 justify-center min-h-[44px]">
                {isLoading ? (
                  <div className="h-11 w-48 rounded-xl bg-white/10 animate-pulse" aria-hidden />
                ) : user ? (
                  <Link
                    to={dashboardPath}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-teal-500 text-white hover:bg-teal-400 shadow-lg shadow-teal-500/25 transition-all"
                  >
                    Go to Dashboard
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <Link
                    to="/login?tab=signup&onboarding=custom"
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-teal-500 text-white hover:bg-teal-400 shadow-lg shadow-teal-500/25 transition-all"
                  >
                    Get Started Free
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
                <Link
                  to="/pricing"
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl bg-white/5 border border-white/10 hover:bg-white/10"
                >
                  Customize Your Package
                </Link>
                <a
                  href="#modules"
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl bg-white/5 border border-white/10 hover:bg-white/10"
                >
                  Explore Modules
                </a>
              </div>
            </div>
          </section>

          <section className="py-10 border-b border-slate-200 bg-white">
            <div className="max-w-5xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              {STATS.map((s) => (
                <div key={s.label}>
                  <p className="text-2xl md:text-3xl font-bold text-slate-900">{s.value}</p>
                  <p className="text-sm text-slate-500 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="modules" className="py-16 md:py-20 scroll-mt-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              <div className="text-center max-w-2xl mx-auto mb-10">
                <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight mb-3">
                  Installable Modules
                </h2>
                <p className="text-slate-500">
                  One shared core with tenant-level feature flags. Toggle modules to preview your store setup.
                </p>
                <Link
                  to="/pricing"
                  className="inline-flex items-center gap-1.5 mt-5 text-sm font-semibold text-teal-600 hover:text-teal-700"
                >
                  Customize Your Package
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="flex flex-wrap justify-center gap-2 mb-10">
                {FILTER_OPTIONS.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                      filter === key
                        ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {Icon && <Icon className="h-4 w-4" strokeWidth={1.75} />}
                    {label}
                  </button>
                ))}
              </div>

              {filter !== 'all' && (
                <div className="mb-8 max-w-3xl">
                  <p className="text-xs font-bold uppercase tracking-wider text-teal-600 mb-1">
                    {filter === 'platform' ? 'Core stack' : filter === 'apps' ? 'Native apps' : 'Intelligence'}
                  </p>
                  <h3 className="text-xl font-bold text-slate-900">{MODULE_GROUP_META[filter].title}</h3>
                  <p className="text-sm text-slate-500 mt-1">{MODULE_GROUP_META[filter].description}</p>
                </div>
              )}

              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5 md:gap-6">
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

              <div className="mt-12 rounded-2xl bg-slate-900 text-slate-200 p-6 md:p-8 border border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700 pb-4 mb-4">
                  <h3 className="text-lg font-semibold text-white">Simulated Tenant Feature Flags</h3>
                  <span className="text-xs text-slate-400">Live module manifest preview</span>
                </div>
                <ul className="flex flex-wrap gap-2 list-none p-0 m-0">
                  {manifestIds.map((id) => {
                    const isCore = CORE_MODULE_IDS.some((c) => id === `grabio_${c}`);
                    return (
                      <li
                        key={id}
                        className={`text-xs font-medium px-3 py-1.5 rounded-full border ${
                          isCore
                            ? 'border-blue-400/50 bg-blue-500/10 text-blue-200'
                            : 'border-teal-500/50 bg-teal-500/10 text-teal-200'
                        }`}
                      >
                        {id}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </section>

          <section id="platform-features" className="py-16 md:py-20 bg-[#0b1220] text-white relative overflow-hidden scroll-mt-20">
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(20,184,166,0.2) 0%, transparent 60%)',
              }}
              aria-hidden
            />
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
              <div className="text-center max-w-2xl mx-auto mb-12">
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">Platform Capabilities</h2>
                <p className="text-slate-400 text-sm md:text-base">
                  Built for real business environments — secure, mobile-first, and synced in real time across web and Android.
                </p>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
                {PLATFORM_CAPABILITIES.map(({ title, desc }) => {
                  const { Icon, accent } = getPlatformCapabilityIcon(title);
                  return (
                    <div
                      key={title}
                      className={`group text-center p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm transition-all duration-300 hover:bg-white/10 hover:-translate-y-1 ${accent.glow}`}
                    >
                      <div
                        className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${accent.gradient} shadow-lg`}
                      >
                        <Icon className={`h-6 w-6 ${accent.iconClass}`} strokeWidth={1.75} />
                      </div>
                      <p className="font-semibold text-white text-sm mb-1.5">{title}</p>
                      <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section id="industries" className="py-16 bg-white scroll-mt-20">
            <div className="max-w-5xl mx-auto px-4 text-center">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-3">Built for Your Industry</h2>
              <p className="text-slate-500 mb-8 max-w-xl mx-auto">
                Whether you run a retail store, cafe, wholesale operation, or agency — Grabio adapts to how your business works.
              </p>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 max-w-3xl mx-auto">
                {USE_CASES.map((label) => (
                  <div
                    key={label}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-700"
                  >
                    <span className="text-teal-600 font-bold">✓</span>
                    {label}
                  </div>
                ))}
              </div>
              <Link to="/use-cases" className="inline-block mt-8 text-sm font-semibold text-teal-600 hover:text-teal-700">
                See all use cases →
              </Link>
            </div>
          </section>

          <section className="py-16 bg-slate-50">
            <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-2 gap-10 items-center">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-4">
                  One platform.<br />No more juggling.
                </h2>
                <p className="text-slate-500 mb-4">
                  Most small businesses run on 4–6 disconnected tools. Grabio replaces the stack — POS, inventory, invoices, and analytics share the same data.
                </p>
                <ul className="space-y-2 text-sm text-slate-600 mb-6">
                  {[
                    'Sales automatically update inventory',
                    'Orders auto-generate professional invoices',
                    'Reports update in real time',
                    'AI tools inside your account — no extra apps',
                  ].map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="text-teal-600">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/pricing"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
                >
                  See Pricing
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-cyan-50 p-6 space-y-4">
                <div>
                  <p className="text-xs font-bold uppercase text-slate-500 mb-2">Before Grabio</p>
                  <ul className="text-sm text-red-900/80 space-y-1 bg-red-50 border border-red-100 rounded-xl p-4">
                    <li>WhatsApp orders → lost in chat</li>
                    <li>Excel inventory → always outdated</li>
                    <li>Word invoices → slow & inconsistent</li>
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-slate-500 mb-2">With Grabio</p>
                  <ul className="text-sm text-teal-900/90 space-y-1 bg-teal-50 border border-teal-100 rounded-xl p-4">
                    <li>Unified order queue → nothing missed</li>
                    <li>Live inventory → updated on every sale</li>
                    <li>Instant invoices → shareable in seconds</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section className="py-16 bg-white">
            <div className="max-w-6xl mx-auto px-4">
              <div className="text-center mb-10">
                <h2 className="text-2xl font-bold text-slate-900">Resources for Business Owners</h2>
                <p className="text-slate-500 text-sm mt-2">Practical guides — no filler.</p>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                {recentPosts.map((post) => (
                  <Link
                    key={post.slug}
                    to={`/blog/${post.slug}`}
                    className="block p-5 rounded-xl border border-slate-200 hover:border-teal-300 hover:shadow-md transition-all bg-white"
                  >
                    <span className="text-[10px] font-bold uppercase text-teal-600 bg-teal-50 px-2 py-1 rounded-full">
                      {post.category}
                    </span>
                    <h3 className="text-sm font-semibold text-slate-900 mt-3 mb-2 line-clamp-2">{post.title}</h3>
                    <p className="text-xs text-slate-500 line-clamp-2">{post.excerpt}</p>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <section className="py-20 bg-[#0b1220] text-white text-center">
            <div className="max-w-2xl mx-auto px-4">
              <h2 className="text-3xl font-bold mb-4">Start running your business on data</h2>
              <p className="text-slate-400 mb-8">
                Join businesses that replaced disconnected tools with one modular platform. Free to start.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center min-h-[52px]">
                {isLoading ? (
                  <div className="h-12 w-56 mx-auto rounded-xl bg-white/10 animate-pulse" aria-hidden />
                ) : user ? (
                  <Link
                    to={dashboardPath}
                    className="px-8 py-4 font-semibold bg-teal-500 hover:bg-teal-400 rounded-xl"
                  >
                    Go to Dashboard →
                  </Link>
                ) : (
                  <AuthCTA className="px-8 py-4 font-semibold text-white bg-teal-500 hover:bg-teal-400 rounded-xl" />
                )}
                <Link to="/contact" className="px-8 py-4 font-semibold border border-white/20 rounded-xl hover:bg-white/5">
                  Talk to Us
                </Link>
              </div>
            </div>
          </section>
        </main>

        <PublicFooter />
      </div>
    </>
  );
};

export default ModularHome;
