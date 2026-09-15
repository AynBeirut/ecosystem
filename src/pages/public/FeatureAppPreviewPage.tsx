import React, { useEffect } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import PublicPageShell from '@/components/public/PublicPageShell';
import DemoPreviewViewer from '@/components/marketing/DemoPreviewViewer';
import {
  featureAppPreviewPath,
  getFeatureAppPreview,
} from '@/data/marketing/demoPreviewCatalog';
import { trackSEOEvent, trackUniqueVisit } from '@/lib/seoTracker';

const FeatureAppPreviewPage: React.FC = () => {
  const { moduleId } = useParams<{ moduleId: string }>();
  const preview = getFeatureAppPreview(moduleId);

  useEffect(() => {
    if (!preview) return;
    trackSEOEvent('page_view', { page_path: featureAppPreviewPath(preview.moduleId) });
    trackUniqueVisit();
  }, [preview]);

  if (!preview) {
    return <Navigate to="/features" replace />;
  }

  const signupHref = '/login?tab=signup';
  const pagePath = featureAppPreviewPath(preview.moduleId);

  return (
    <PublicPageShell
      title={preview.metaTitle}
      description={preview.metaDescription}
      url={pagePath}
      keywords={preview.keywords}
      eyebrow="Module preview"
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
            to="/features"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-teal-300 hover:text-teal-800"
          >
            All features
          </Link>
        </>
      }
    >
      <DemoPreviewViewer screens={preview.screens} signupHref={signupHref} />

      <section className="public-panel text-center">
        <h2 className="text-xl font-bold text-slate-900">Enable this module on your store</h2>
        <p className="mt-2 text-sm text-slate-600">
          Pick modules at signup or add them later from your admin dashboard.
        </p>
        <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            to={signupHref}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            Create free account
          </Link>
          <Link to="/pricing" className="text-sm font-medium text-slate-600 hover:text-teal-700">
            View pricing
          </Link>
        </div>
      </section>
    </PublicPageShell>
  );
};

export default FeatureAppPreviewPage;
