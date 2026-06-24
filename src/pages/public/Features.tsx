import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Boxes, Cpu, Smartphone } from 'lucide-react';
import SEOHead from '@/components/SEOHead';
import { trackSEOEvent, trackUniqueVisit } from '@/lib/seoTracker';
import PublicNav from '@/components/public/PublicNav';
import PublicFooter from '@/components/public/PublicFooter';
import AuthCTA from '@/components/public/AuthCTA';
import FeatureModuleCard from '@/components/public/FeatureModuleCard';
import { PricingModule } from '@/lib/pricingDisplay';
import { getPlatformCapabilityIcon } from '@/lib/moduleIcons';
import {
  getModulesByGroup,
  MODULE_FEATURE_ITEMS,
  MODULE_GROUP_META,
  PLATFORM_CAPABILITIES,
} from '@/lib/publicModulesContent';

const GROUP_KEYS: PricingModule['group'][] = ['platform', 'apps', 'ai'];

const GROUP_NAV_ICONS = {
  platform: Boxes,
  apps: Smartphone,
  ai: Cpu,
} as const;

const Features: React.FC = () => {
  useEffect(() => {
    trackSEOEvent('page_view');
    trackUniqueVisit();
  }, []);

  return (
    <>
      <SEOHead
        title="Grabio Features — Modular Business Ecosystem"
        description="Explore the Grabio modular platform — inventory, CRM, POS, finance, and AI tools in one professional ecosystem. Built for modern operators in MENA and beyond."
        url="/features"
        keywords={[
          'Grabio features',
          'modular business platform',
          'Sales CRM',
          'inventory management software',
          'business ecosystem software',
        ]}
      />

      <div className="flex flex-col min-h-screen bg-slate-50">
        <PublicNav />

        <main className="overflow-x-hidden">
          {/* Hero — dark mesh, Odoo-enterprise tone */}
          <section className="relative bg-[#0b1220] text-white py-20 md:py-28 overflow-hidden">
            <div
              className="absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 20% 20%, rgba(20,184,166,0.35) 0%, transparent 45%), radial-gradient(circle at 80% 0%, rgba(99,102,241,0.25) 0%, transparent 40%), radial-gradient(circle at 50% 100%, rgba(14,165,233,0.15) 0%, transparent 50%)',
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
            <div className="absolute -top-32 left-1/4 w-72 h-72 bg-teal-500/20 rounded-full blur-3xl animate-pulse" aria-hidden />
            <div
              className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl"
              style={{ animation: 'pulse 4s ease-in-out infinite' }}
              aria-hidden
            />

            <div className="relative max-w-5xl mx-auto px-4 sm:px-6 text-center">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-teal-300/90 mb-6">
                <span className="h-px w-8 bg-teal-400/50" />
                Grabio Ecosystem
                <span className="h-px w-8 bg-teal-400/50" />
              </p>
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-5 bg-gradient-to-b from-white to-slate-300 bg-clip-text text-transparent">
                One platform. Every module you need.
              </h1>
              <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto mb-3 font-light">
                Professional tools for commerce, operations, and growth — unified under a single account.
              </p>
              <p className="text-sm text-slate-400 max-w-xl mx-auto mb-10">
                Core modules ship live today. Roadmap capabilities are marked clearly — no surprises at checkout.
              </p>

              <div className="flex flex-wrap gap-2 justify-center">
                {GROUP_KEYS.map((key) => {
                  const NavIcon = GROUP_NAV_ICONS[key];
                  return (
                    <a
                      key={key}
                      href={`#${key}-features`}
                      className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5"
                    >
                      <NavIcon className="h-4 w-4 text-teal-400" strokeWidth={1.75} />
                      {MODULE_GROUP_META[key].title}
                    </a>
                  );
                })}
                <Link
                  to="/pricing"
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-teal-500 text-white hover:bg-teal-400 shadow-lg shadow-teal-500/25 transition-all duration-300 hover:-translate-y-0.5"
                >
                  Build your package
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </section>

          {/* Module groups — 3D card grid */}
          {GROUP_KEYS.map((groupKey, groupIndex) => {
            const meta = MODULE_GROUP_META[groupKey];
            const modules = getModulesByGroup(groupKey);
            const isAlt = groupIndex % 2 === 1;

            return (
              <section
                key={groupKey}
                id={`${groupKey}-features`}
                className={`py-16 md:py-20 scroll-mt-20 ${isAlt ? 'bg-white' : 'bg-slate-50'}`}
              >
                <div className="max-w-7xl mx-auto px-4 sm:px-6">
                  <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-12">
                    <div className="max-w-2xl">
                      <p className="text-xs font-bold uppercase tracking-[0.15em] text-teal-600 mb-2">
                        {groupKey === 'platform' ? 'Core stack' : groupKey === 'apps' ? 'Native apps' : 'Intelligence'}
                      </p>
                      <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight mb-3">
                        {meta.title}
                      </h2>
                      <p className="text-slate-500 text-base leading-relaxed">{meta.description}</p>
                    </div>
                    <div className="hidden md:block h-px flex-1 max-w-xs bg-gradient-to-r from-slate-200 to-transparent mb-2" />
                  </div>

                  <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-7">
                    {modules.map((mod, index) => (
                      <FeatureModuleCard
                        key={mod.id}
                        mod={mod}
                        items={MODULE_FEATURE_ITEMS[mod.id] ?? [mod.summary]}
                        index={index}
                      />
                    ))}
                  </div>
                </div>
              </section>
            );
          })}

          {/* Platform capabilities — compact 3D tiles */}
          <section className="py-16 md:py-20 bg-[#0b1220] text-white relative overflow-hidden">
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(20,184,166,0.2) 0%, transparent 60%)',
              }}
              aria-hidden
            />
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
              <div className="text-center max-w-2xl mx-auto mb-12">
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">
                  Built as an ecosystem, not a patchwork
                </h2>
                <p className="text-slate-400 text-sm md:text-base">
                  Shared auth, real-time data, and consistent UX across every module you enable.
                </p>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
                {PLATFORM_CAPABILITIES.map(({ title, desc }) => {
                  const { Icon, accent } = getPlatformCapabilityIcon(title);
                  return (
                    <div
                      key={title}
                      className={`group text-center p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm transition-all duration-300 hover:bg-white/10 hover:-translate-y-1 hover:shadow-xl ${accent.glow}`}
                    >
                      <div
                        className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${accent.gradient} shadow-lg shadow-black/20 transition-transform duration-300 group-hover:scale-110`}
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

          {/* CTA */}
          <section className="py-20 text-center max-w-3xl mx-auto px-4 sm:px-6 bg-white border-t border-slate-100">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight mb-4">
              Compose your stack
            </h2>
            <p className="text-slate-500 mb-10 text-base">
              Enable only what your business needs. Core stays included; extras add transparently at checkout.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <AuthCTA className="px-8 py-4 font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-lg shadow-slate-900/20 transition-all hover:-translate-y-0.5" />
              <Link
                to="/pricing"
                className="px-8 py-4 font-semibold text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-xl transition-all"
              >
                Build your package
              </Link>
              <Link
                to="/home#modules"
                className="px-8 py-4 font-semibold text-teal-700 border border-teal-200 hover:bg-teal-50 rounded-xl transition-all"
              >
                Explore on home
              </Link>
            </div>
          </section>
        </main>

        <PublicFooter />
      </div>
    </>
  );
};

export default Features;
