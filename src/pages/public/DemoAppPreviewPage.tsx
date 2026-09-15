import React, { useEffect } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import PublicPageShell from '@/components/public/PublicPageShell';
import DemoPreviewViewer from '@/components/marketing/DemoPreviewViewer';
import TryDemoButton from '@/components/marketing/TryDemoButton';
import {
  getVerticalAppPreview,
  verticalAppPreviewPath,
} from '@/data/marketing/demoPreviewCatalog';
import { verticalDemoOsPath } from '@/data/marketing/demoOsCatalog';
import { getMarketingPackage, PACKAGE_INDUSTRY_SUBNAV } from '@/lib/marketingPackages';
import { trackSEOEvent, trackUniqueVisit } from '@/lib/seoTracker';

const DemoAppPreviewPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const preview = getVerticalAppPreview(slug);
  const pkg = getMarketingPackage(slug);

  useEffect(() => {
    if (!preview || !pkg) return;
    trackSEOEvent('page_view', { page_path: verticalAppPreviewPath(pkg.slug) });
    trackUniqueVisit();
  }, [preview, pkg]);

  if (!preview || !pkg) {
    return <Navigate to="/#industries" replace />;
  }

  const signupHref = `/login?tab=signup&preset=${pkg.presetKey}`;
  const pagePath = verticalAppPreviewPath(pkg.slug);

  return (
    <PublicPageShell
      title={preview.metaTitle}
      description={preview.metaDescription}
      url={pagePath}
      keywords={preview.keywords}
      eyebrow="Interactive preview"
      heroTitle={preview.heroTitle}
      heroDescription={preview.heroDescription}
      heroActions={
        <>
          <Link
            to={signupHref}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700"
          >
            Sign in free
          </Link>
          <Link
            to={verticalDemoOsPath(pkg.slug, 'dashboard')}
            className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-5 py-2.5 text-sm font-semibold text-teal-800 transition-colors hover:bg-teal-100"
          >
            Full admin tour
          </Link>
          <Link
            to={`/demo/${pkg.slug}`}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-teal-300 hover:text-teal-800"
          >
            Industry overview
          </Link>
        </>
      }
      subnav={PACKAGE_INDUSTRY_SUBNAV}
    >
      <DemoPreviewViewer screens={preview.screens} signupHref={signupHref} />

      <section className="public-panel text-center">
        <h2 className="text-xl font-bold text-slate-900">Ready for the live demo?</h2>
        <p className="mt-2 text-sm text-slate-600">
          Open the {pkg.label.toLowerCase()} preset with sample products, orders, and reports you can edit.
        </p>
        <div className="mt-5 flex flex-col items-center gap-3">
          <TryDemoButton pkg={pkg} />
          <Link to="/pricing" className="text-sm font-medium text-slate-600 hover:text-teal-700">
            View pricing
          </Link>
        </div>
      </section>
    </PublicPageShell>
  );
};

export default DemoAppPreviewPage;
