import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import SEOHead from '@/components/SEOHead';
import PublicNav from '@/components/public/PublicNav';
import PublicFooter from '@/components/public/PublicFooter';
import {
  demoOsIndexPath,
  demoOsModulePath,
  modulesByGroup,
} from '@/data/marketing/demoOsCatalog';
import { trackSEOEvent, trackUniqueVisit } from '@/lib/seoTracker';

const DemoOsIndexPage: React.FC = () => {
  useEffect(() => {
    trackSEOEvent('page_view', { page_path: demoOsIndexPath() });
    trackUniqueVisit();
  }, []);

  const grouped = modulesByGroup();

  return (
    <>
      <SEOHead
        title="Grabio Admin Demo | Dashboard, POS, Inventory & Finance Preview"
        description="Tour Grabio internal admin screens — dashboard, POS, orders, inventory, invoicing, accounting, CRM, and AI. Read-only previews; sign in to run your store."
        url={demoOsIndexPath()}
        keywords={[
          'ERP admin demo',
          'POS software preview',
          'inventory dashboard tour',
          'Grabio demo OS',
          'Shopify alternative demo',
          'Odoo alternative preview',
        ]}
      />
      <div className="flex min-h-screen flex-col bg-slate-50">
        <PublicNav />
        <main className="flex-1">
          <section className="border-b border-slate-200 bg-[#0b1220] py-14 text-white">
            <div className="mx-auto max-w-5xl px-4 sm:px-6 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-300/90">Internal demo mode</p>
              <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-5xl">
                See the Grabio operating system
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-base text-slate-300 md:text-lg">
                Walk through dashboard, POS, inventory, finance, CRM, and AI screens — the same admin your team uses daily.
                Every page is read-only until you sign in.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link
                  to={demoOsModulePath('dashboard')}
                  className="rounded-xl bg-teal-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-400"
                >
                  Start at dashboard
                </Link>
                <Link
                  to="/login?tab=signup"
                  className="rounded-xl border border-white/20 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Sign in free
                </Link>
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 space-y-10">
            {grouped.map(({ group, meta, modules }) => (
              <div key={group}>
                <h2 className="text-xl font-bold text-slate-900">{meta.title}</h2>
                <p className="mt-1 text-sm text-slate-600">{meta.description}</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {modules.map((mod) => (
                    <Link
                      key={mod.id}
                      to={demoOsModulePath(mod.id)}
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-300 hover:shadow-md"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">{mod.adminLabel}</p>
                      <h3 className="mt-2 text-lg font-bold text-slate-900">{mod.label}</h3>
                      <p className="mt-2 text-sm text-slate-600 line-clamp-2">{mod.heroDescription}</p>
                      <span className="mt-4 inline-flex text-sm font-semibold text-teal-700">Open preview →</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </section>
        </main>
        <PublicFooter />
      </div>
    </>
  );
};

export default DemoOsIndexPage;
