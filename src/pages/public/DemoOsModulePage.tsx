import React, { useEffect } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import SEOHead from '@/components/SEOHead';
import PublicNav from '@/components/public/PublicNav';
import PublicFooter from '@/components/public/PublicFooter';
import DemoOsLayout from '@/components/marketing/DemoOsLayout';
import DemoOsGate from '@/components/marketing/DemoOsGate';
import DemoPreviewMockScreen from '@/components/marketing/DemoPreviewMockScreen';
import {
  demoOsIndexPath,
  demoOsModulePath,
  getDemoOsModule,
  type DemoOsModuleId,
} from '@/data/marketing/demoOsCatalog';
import { trackSEOEvent, trackUniqueVisit } from '@/lib/seoTracker';

const DemoOsModulePage: React.FC = () => {
  const { moduleId } = useParams<{ moduleId: string }>();
  const mod = getDemoOsModule(moduleId);

  useEffect(() => {
    if (!mod) return;
    trackSEOEvent('page_view', { page_path: demoOsModulePath(mod.id) });
    trackUniqueVisit();
  }, [mod]);

  if (!mod) {
    return <Navigate to={demoOsIndexPath()} replace />;
  }

  const signupHref = '/login?tab=signup';
  const pagePath = demoOsModulePath(mod.id);

  return (
    <>
      <SEOHead
        title={mod.metaTitle}
        description={mod.metaDescription}
        url={pagePath}
        keywords={mod.keywords}
      />
      <div className="flex min-h-screen flex-col bg-slate-100">
        <PublicNav />
        <main className="flex-1">
          <section className="border-b border-slate-200 bg-white px-4 py-6 sm:px-6">
            <div className="mx-auto max-w-6xl">
              <Link to={demoOsIndexPath()} className="text-sm font-medium text-slate-600 hover:text-teal-700">
                ← All demo screens
              </Link>
              <h1 className="mt-3 text-2xl font-bold text-slate-900 md:text-3xl">{mod.heroTitle}</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600 md:text-base">{mod.heroDescription}</p>
            </div>
          </section>

          <div className="mx-auto max-w-[1400px] px-2 py-4 sm:px-4 sm:py-6">
            <DemoOsLayout activeModuleId={mod.id as DemoOsModuleId} signupHref={signupHref}>
              <DemoOsGate signupHref={signupHref}>
                <DemoPreviewMockScreen type={mod.screenType} label={mod.label} />
              </DemoOsGate>
              <p className="demo-os-module-footnote">
                Preview uses sample data.{' '}
                <Link to={signupHref} className="font-semibold text-teal-700 hover:text-teal-800">
                  Sign in free
                </Link>{' '}
                to open your own {mod.label.toLowerCase()} workspace with live data.
              </p>
            </DemoOsLayout>
          </div>
        </main>
        <PublicFooter />
      </div>
    </>
  );
};

export default DemoOsModulePage;
