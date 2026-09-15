import React, { useEffect } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import PublicPageShell from '@/components/public/PublicPageShell';
import TryDemoButton from '@/components/marketing/TryDemoButton';
import { getComparisonPage } from '@/data/marketing/comparisonPages';
import { getMarketingPackage } from '@/lib/marketingPackages';
import { buildSolutionSchema } from '@/lib/grabioBrandSchema';
import { trackSEOEvent, trackUniqueVisit } from '@/lib/seoTracker';

const ComparisonPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const page = getComparisonPage(slug);
  const demoPkg = page ? getMarketingPackage(page.demoVertical) : undefined;

  useEffect(() => {
    if (!page) return;
    trackSEOEvent('page_view', { page_path: `/compare/${page.slug}` });
    trackUniqueVisit();
  }, [page]);

  if (!page || !demoPkg) {
    return <Navigate to="/#industries" replace />;
  }

  const pageUrl = `https://grabio.space/compare/${page.slug}`;
  const structuredData = buildSolutionSchema({
    name: page.heroTitle,
    description: page.metaDescription,
    url: pageUrl,
    faqs: [
      {
        question: `When is ${page.competitorName} the better fit?`,
        answer: page.whenCompetitorFits,
      },
      {
        question: 'When is Grabio the better fit?',
        answer: page.whenGrabioFits,
      },
    ],
  });

  return (
    <PublicPageShell
      title={page.metaTitle}
      description={page.metaDescription}
      url={`/compare/${page.slug}`}
      keywords={page.keywords}
      structuredData={structuredData}
      eyebrow="Comparison"
      heroTitle={page.heroTitle}
      heroDescription={page.heroDescription}
      heroActions={<TryDemoButton pkg={demoPkg} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700" />}
    >
      <section className="public-panel">
        <p className="text-sm leading-relaxed text-slate-700">{page.intro}</p>
      </section>

      <section className="public-panel overflow-x-auto">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Side-by-side</h2>
        <table className="w-full min-w-[32rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left">
              <th className="py-3 pr-4 font-semibold text-slate-900">Area</th>
              <th className="py-3 pr-4 font-semibold text-teal-800">Grabio</th>
              <th className="py-3 font-semibold text-slate-700">{page.competitorName}</th>
            </tr>
          </thead>
          <tbody>
            {page.rows.map((row) => (
              <tr key={row.section} className="border-b border-slate-100 align-top">
                <td className="py-3 pr-4 font-medium text-slate-900">{row.section}</td>
                <td className="py-3 pr-4 text-slate-700">{row.grabio}</td>
                <td className="py-3 text-slate-600">{row.competitor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="public-panel grid gap-6 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-100 bg-slate-50/80 p-5">
          <h2 className="text-base font-semibold text-slate-900">When {page.competitorName} may be the better fit</h2>
          <p className="mt-2 text-sm text-slate-600">{page.whenCompetitorFits}</p>
        </article>
        <article className="rounded-2xl border border-teal-100 bg-teal-50/50 p-5">
          <h2 className="text-base font-semibold text-slate-900">When Grabio may be the better fit</h2>
          <p className="mt-2 text-sm text-slate-600">{page.whenGrabioFits}</p>
        </article>
      </section>

      <section className="public-panel text-center">
        <h2 className="text-xl font-bold text-slate-900">{page.demoCtaLabel}</h2>
        <p className="mt-2 text-sm text-slate-600">
          Walk through a pre-seeded {demoPkg.label.toLowerCase()} environment — no signup required.
        </p>
        <div className="mt-5 flex flex-col items-center gap-3">
          <TryDemoButton pkg={demoPkg} />
          <Link to={`/demo/${demoPkg.slug}`} className="text-sm font-medium text-slate-600 hover:text-teal-700">
            View {demoPkg.label} overview
          </Link>
        </div>
      </section>
    </PublicPageShell>
  );
};

export default ComparisonPage;
