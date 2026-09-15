import React, { useEffect } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import PublicPageShell from '@/components/public/PublicPageShell';
import TryDemoButton from '@/components/marketing/TryDemoButton';
import PackageModuleStrip from '@/components/marketing/PackageModuleStrip';
import {
  getMarketingPackage,
  PACKAGE_INDUSTRY_SUBNAV,
} from '@/lib/marketingPackages';
import { getComparisonPage } from '@/data/marketing/comparisonPages';
import { verticalAppPreviewPath } from '@/data/marketing/demoPreviewCatalog';
import { verticalDemoOsPath } from '@/data/marketing/demoOsCatalog';
import { buildSolutionSchema } from '@/lib/grabioBrandSchema';
import { trackSEOEvent, trackUniqueVisit } from '@/lib/seoTracker';

const PackageLandingPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const pkg = getMarketingPackage(slug);

  useEffect(() => {
    if (!pkg) return;
    trackSEOEvent('page_view', { page_path: `/demo/${pkg.slug}` });
    trackUniqueVisit();
  }, [pkg]);

  if (!pkg) {
    return <Navigate to="/#industries" replace />;
  }

  const comparison = pkg.comparisonPageSlug ? getComparisonPage(pkg.comparisonPageSlug) : undefined;

  const pageUrl = `https://grabio.space/demo/${pkg.slug}`;
  const structuredData = buildSolutionSchema({
    name: `Grabio for ${pkg.label}`,
    description: pkg.metaDescription,
    url: pageUrl,
    faqs: pkg.faqs,
  });

  return (
    <PublicPageShell
      title={pkg.metaTitle ?? `Grabio for ${pkg.label}`}
      description={pkg.metaDescription}
      url={`/demo/${pkg.slug}`}
      keywords={pkg.keywords}
      structuredData={structuredData}
      eyebrow={pkg.tagline}
      heroTitle={pkg.heroTitle}
      heroDescription={pkg.heroDescription}
      heroActions={<TryDemoButton pkg={pkg} />}
      subnav={PACKAGE_INDUSTRY_SUBNAV.map((item) => ({
        ...item,
        href: item.href,
      }))}
    >
      <section className="public-panel">
        <h2 className="text-xl font-bold text-slate-900 mb-4">What breaks today</h2>
        <ul className="grid sm:grid-cols-1 gap-3 list-none m-0 p-0">
          {pkg.pains.map((item) => (
            <li key={item} className="flex gap-2 text-sm text-slate-700">
              <span className="text-red-500 shrink-0 mt-0.5" aria-hidden>✕</span>
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="public-panel">
        <h2 className="text-xl font-bold text-slate-900 mb-4">What changes with Grabio</h2>
        <ul className="grid sm:grid-cols-1 gap-3 list-none m-0 p-0">
          {pkg.outcomes.map((item) => (
            <li key={item} className="flex gap-2 text-sm text-slate-700">
              <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="public-panel">
        <h2 className="text-xl font-bold text-slate-900 mb-4">A day in the life</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {pkg.dayInLife.map((block) => (
            <article
              key={block.period}
              className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4"
            >
              <p className="text-xs font-bold uppercase tracking-wide text-teal-700">{block.period}</p>
              <h3 className="mt-2 text-sm font-semibold text-slate-900">{block.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{block.description}</p>
            </article>
          ))}
        </div>
      </section>

      <PackageModuleStrip
        moduleIds={pkg.moduleIds}
        title={pkg.moduleStripTitle}
        labelOverrides={pkg.moduleLabelOverrides}
      />

      <section className="public-panel">
        <h2 className="text-xl font-bold text-slate-900 mb-2">Preview the admin screens</h2>
        <p className="text-sm text-slate-600 mb-4">
          Walk through POS, inventory, and reports in a read-only tour — no account required to browse.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            to={verticalDemoOsPath(pkg.slug, 'dashboard')}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700"
          >
            Full admin tour
          </Link>
          <Link
            to={verticalAppPreviewPath(pkg.slug)}
            className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-semibold text-teal-800 transition-colors hover:bg-teal-100"
          >
            Quick screen preview
          </Link>
        </div>
      </section>

      <section className="public-panel">
        <h2 className="text-xl font-bold text-slate-900 mb-4">FAQ</h2>
        <dl className="space-y-4 m-0">
          {pkg.faqs.map((faq) => (
            <div key={faq.question}>
              <dt className="text-sm font-semibold text-slate-900">{faq.question}</dt>
              <dd className="mt-1 text-sm text-slate-600">{faq.answer}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="public-panel text-center">
        <h2 className="text-xl font-bold text-slate-900">See it with your industry preset</h2>
        <p className="mt-2 text-sm text-slate-600">
          Open the {pkg.label.toLowerCase()} demo store — separate from other verticals, pre-configured for how you operate.
        </p>
        <div className="mt-5 flex flex-col items-center gap-3">
          <TryDemoButton pkg={pkg} />
          <Link to="/pricing" className="text-sm font-medium text-slate-600 hover:text-teal-700">
            View pricing
          </Link>
          {comparison && (
            <Link
              to={`/compare/${comparison.slug}`}
              className="text-sm font-medium text-slate-600 hover:text-teal-700"
            >
              Compare Grabio vs {comparison.competitorName}
            </Link>
          )}
        </div>
      </section>
    </PublicPageShell>
  );
};

export default PackageLandingPage;
