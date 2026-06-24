import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import SEOHead from '@/components/SEOHead';
import { trackSEOEvent, trackUniqueVisit } from '@/lib/seoTracker';
import PublicNav from '@/components/public/PublicNav';
import PublicFooter from '@/components/public/PublicFooter';
import AuthCTA from '@/components/public/AuthCTA';
import { PricingModule } from '@/lib/pricingDisplay';
import {
  getBillingLabel,
  getModulesByGroup,
  getStatusBadgeClass,
  getStatusLabel,
  MODULE_FEATURE_ITEMS,
  MODULE_GROUP_META,
  PLATFORM_CAPABILITIES,
} from '@/lib/publicModulesContent';

const GROUP_KEYS: PricingModule['group'][] = ['platform', 'apps', 'ai'];

const Features: React.FC = () => {
  useEffect(() => {
    trackSEOEvent('page_view');
    trackUniqueVisit();
  }, []);

  return (
    <>
      <SEOHead
        title="Grabio Features — Modular Platform, Apps, and AI Tools"
        description="Explore Grabio platform features, mobile apps, and AI growth tools. Core modules included on every plan; optional modules and add-ons available separately."
        url="/features"
        keywords={[
          'Grabio features',
          'modular business platform',
          'Sales CRM',
          'admin Android app',
          'inventory management software',
        ]}
      />

      <div className="flex flex-col min-h-screen bg-white">
        <PublicNav />

        <main>
          <section className="bg-gradient-to-br from-teal-600 to-cyan-800 text-white py-16 md:py-20">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
              <h1 className="text-4xl md:text-5xl font-extrabold mb-4">
                Modular Platform Features
              </h1>
              <p className="text-lg md:text-xl text-teal-100 max-w-2xl mx-auto mb-2">
                One sign-in — all your data in one place.
              </p>
              <p className="text-teal-200/90 max-w-2xl mx-auto">
                Core platform modules are included on your plan. Optional modules, apps, and add-ons
                activate when you need them — extras billed separately at checkout.
              </p>
              <div className="flex flex-wrap gap-3 justify-center mt-8">
                {GROUP_KEYS.map((key) => (
                  <a
                    key={key}
                    href={`#${key}-features`}
                    className="px-4 py-2 text-sm font-medium bg-white/15 hover:bg-white/25 rounded-full transition-colors"
                  >
                    {MODULE_GROUP_META[key].title}
                  </a>
                ))}
                <Link
                  to="/pricing"
                  className="px-4 py-2 text-sm font-medium bg-white text-teal-700 hover:bg-teal-50 rounded-full transition-colors"
                >
                  Build your package
                </Link>
              </div>
            </div>
          </section>

          {GROUP_KEYS.map((groupKey) => {
            const meta = MODULE_GROUP_META[groupKey];
            const modules = getModulesByGroup(groupKey);

            return (
              <section
                key={groupKey}
                id={`${groupKey}-features`}
                className={`py-16 scroll-mt-20 ${groupKey === 'apps' ? 'bg-gray-50 border-y border-gray-100' : ''}`}
              >
                <div className="max-w-6xl mx-auto px-4 sm:px-6">
                  <div className="mb-10 max-w-3xl">
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{meta.title}</h2>
                    <p className="text-gray-500">{meta.description}</p>
                  </div>

                  <div className="space-y-12">
                    {modules.map((mod) => {
                      const items = MODULE_FEATURE_ITEMS[mod.id] ?? [mod.summary];
                      return (
                        <div key={mod.id} id={mod.id} className="scroll-mt-24 grid md:grid-cols-5 gap-8 items-start">
                          <div className="md:col-span-2">
                            <div className="flex items-center gap-3 mb-3">
                              <span className="text-3xl" aria-hidden>
                                {mod.icon}
                              </span>
                              <span
                                className={`text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${getStatusBadgeClass(mod.status)}`}
                              >
                                {getStatusLabel(mod.status)}
                              </span>
                            </div>
                            <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">{mod.name}</h3>
                            <p className="text-sm font-medium text-teal-700 mb-3">{getBillingLabel(mod)}</p>
                            <p className="text-gray-500 leading-relaxed text-sm">{mod.summary}</p>
                            <Link
                              to="/pricing"
                              className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-teal-600 hover:text-teal-700"
                            >
                              See pricing for this module <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                          </div>
                          <ul className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {items.map((item) => (
                              <li
                                key={item}
                                className="flex items-start gap-2.5 text-sm text-gray-700 p-3 rounded-lg bg-white border border-gray-100"
                              >
                                <span className="w-1.5 h-1.5 bg-teal-500 rounded-full mt-1.5 flex-shrink-0" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            );
          })}

          <section className="py-16 border-t border-gray-100">
            <div className="max-w-6xl mx-auto px-4 sm:px-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Platform Capabilities</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {PLATFORM_CAPABILITIES.map(({ icon, title, desc }) => (
                  <div key={title} className="text-center p-5 bg-gray-50 rounded-2xl border border-gray-200">
                    <span className="text-2xl block mb-2" aria-hidden>
                      {icon}
                    </span>
                    <p className="font-semibold text-gray-900 text-sm mb-1">{title}</p>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="py-16 text-center max-w-3xl mx-auto px-4 sm:px-6">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Pick only what you need</h2>
            <p className="text-gray-500 mb-8">
              Toggle modules on the pricing page to preview your package. Core stays included; extras
              add to your plan total.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <AuthCTA className="px-8 py-4 font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors" />
              <Link
                to="/pricing"
                className="px-8 py-4 font-semibold text-gray-700 border border-gray-300 hover:border-gray-400 rounded-xl transition-colors"
              >
                Build your package
              </Link>
              <Link
                to="/home#modules"
                className="px-8 py-4 font-semibold text-teal-700 border border-teal-200 hover:bg-teal-50 rounded-xl transition-colors"
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
