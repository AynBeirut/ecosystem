import React, { useEffect } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import SEOHead from '@/components/SEOHead';
import PublicNav from '@/components/public/PublicNav';
import PublicFooter from '@/components/public/PublicFooter';
import DemoOsLayout from '@/components/marketing/DemoOsLayout';
import DemoOsGate from '@/components/marketing/DemoOsGate';
import DemoPreviewMockScreen from '@/components/marketing/DemoPreviewMockScreen';
import TryDemoButton from '@/components/marketing/TryDemoButton';
import {
  getDemoOsModule,
  verticalDemoOsPath,
  type DemoOsModuleId,
} from '@/data/marketing/demoOsCatalog';
import { getMarketingPackage, PACKAGE_INDUSTRY_SUBNAV } from '@/lib/marketingPackages';
import { trackSEOEvent, trackUniqueVisit } from '@/lib/seoTracker';

const DemoVerticalOsPage: React.FC = () => {
  const { slug, moduleId } = useParams<{ slug: string; moduleId: string }>();
  const pkg = getMarketingPackage(slug);
  const mod = getDemoOsModule(moduleId);

  useEffect(() => {
    if (!pkg || !mod) return;
    trackSEOEvent('page_view', { page_path: verticalDemoOsPath(pkg.slug, mod.id) });
    trackUniqueVisit();
  }, [pkg, mod]);

  if (!pkg || !mod) {
    return <Navigate to="/demo-os" replace />;
  }

  if (!mod.verticals.includes(pkg.slug)) {
    return <Navigate to={verticalDemoOsPath(pkg.slug, 'dashboard')} replace />;
  }

  const signupHref = `/login?tab=signup&preset=${pkg.presetKey}`;
  const pagePath = verticalDemoOsPath(pkg.slug, mod.id);

  return (
    <>
      <SEOHead
        title={`${mod.label} Admin Demo — ${pkg.label} | Grabio`}
        description={mod.metaDescription}
        url={pagePath}
        keywords={[...mod.keywords, pkg.label, `Grabio ${pkg.label.toLowerCase()} demo`]}
      />
      <div className="flex min-h-screen flex-col bg-slate-100">
        <PublicNav />
        <main className="flex-1">
          <section className="border-b border-slate-200 bg-white px-4 py-6 sm:px-6">
            <div className="mx-auto max-w-6xl">
              <div className="flex flex-wrap gap-2 mb-4">
                {PACKAGE_INDUSTRY_SUBNAV.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={`public-subnav-link${item.href === `/demo/${pkg.slug}` ? ' public-subnav-link-active' : ''}`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">{pkg.label} · Admin preview</p>
              <h1 className="mt-2 text-2xl font-bold text-slate-900 md:text-3xl">{mod.heroTitle}</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600 md:text-base">{mod.heroDescription}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link to={signupHref} className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">
                  Sign in with {pkg.label.toLowerCase()} preset
                </Link>
                <TryDemoButton pkg={pkg} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-teal-300" />
              </div>
            </div>
          </section>

          <div className="mx-auto max-w-[1400px] px-2 py-4 sm:px-4 sm:py-6">
            <DemoOsLayout
              activeModuleId={mod.id as DemoOsModuleId}
              signupHref={signupHref}
              moduleLinkBuilder={(id) => verticalDemoOsPath(pkg.slug, id)}
            >
              <DemoOsGate signupHref={signupHref} signupLabel={`Sign in — ${pkg.label} preset`}>
                <DemoPreviewMockScreen type={mod.screenType} label={mod.label} />
              </DemoOsGate>
            </DemoOsLayout>
          </div>
        </main>
        <PublicFooter />
      </div>
    </>
  );
};

export default DemoVerticalOsPage;
