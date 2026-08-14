import React, { useEffect } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import PublicPageShell from '@/components/public/PublicPageShell';
import AuthCTA from '@/components/public/AuthCTA';
import {
  GRABIO_SOLUTION_BY_SLUG,
  SOLUTION_SUBNAV,
  getSolutionModuleBullets,
} from '@/lib/grabioSolutions';
import { buildSolutionSchema } from '@/lib/grabioBrandSchema';
import { MODULE_CATALOG } from '@/lib/pricingDisplay';
import { trackSEOEvent, trackUniqueVisit } from '@/lib/seoTracker';
import { trackMarketingSignupIntent, trackSolutionView } from '@/lib/gtm';

const SolutionDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const solution = slug ? GRABIO_SOLUTION_BY_SLUG[slug] : undefined;

  useEffect(() => {
    if (!solution) return;
    trackSEOEvent('page_view', { page_path: `/solutions/${solution.slug}` });
    trackUniqueVisit();
    trackSolutionView(solution.slug, solution.title);
  }, [solution]);

  if (!solution) {
    return <Navigate to="/solutions" replace />;
  }

  const pageUrl = `https://grabio.space/solutions/${solution.slug}`;
  const structuredData = buildSolutionSchema({
    name: solution.title,
    description: solution.metaDescription,
    url: pageUrl,
    faqs: solution.faqs,
  });

  const moduleBullets = getSolutionModuleBullets(solution.moduleIds);
  const linkedModules = MODULE_CATALOG.filter((m) => solution.moduleIds.includes(m.id));

  return (
    <PublicPageShell
      title={solution.title}
      description={solution.metaDescription}
      url={`/solutions/${solution.slug}`}
      keywords={solution.keywords}
      structuredData={structuredData}
      eyebrow={`Grabio ${solution.shortTitle}`}
      heroTitle={solution.heroTitle}
      heroDescription={solution.heroDescription}
      heroActions={
        <div className="flex flex-wrap gap-3">
          <AuthCTA
            className="inline-flex items-center px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 transition-colors"
            onClick={() => trackMarketingSignupIntent(`solution_${solution.slug}`)}
          />
          <Link
            to="/pricing"
            className="inline-flex items-center px-5 py-2.5 rounded-xl text-sm font-semibold text-teal-800 bg-white border border-teal-200 hover:bg-teal-50 transition-colors"
          >
            View pricing
          </Link>
        </div>
      }
      subnav={[...SOLUTION_SUBNAV]}
    >
      <section className="public-panel mb-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Key capabilities</h2>
        <ul className="grid sm:grid-cols-2 gap-3 list-none m-0 p-0">
          {solution.highlights.map((item) => (
            <li key={item} className="flex gap-2 text-sm text-slate-700">
              <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </section>

      {moduleBullets.length > 0 && (
        <section className="public-panel mb-8">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Included modules</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {linkedModules.map((mod) => (
              <Link
                key={mod.id}
                to={`/features#${mod.id}`}
                className="text-xs font-semibold px-3 py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-100 hover:bg-teal-100"
              >
                {mod.name}
              </Link>
            ))}
          </div>
          <ul className="space-y-2 list-none m-0 p-0">
            {moduleBullets.map((item) => (
              <li key={item} className="text-sm text-slate-600 pl-4 border-l-2 border-teal-200">
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="public-panel mb-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Frequently asked questions</h2>
        <p className="text-sm text-slate-500 mb-4">
          Clear answers for buyers, search engines, and AI research tools researching Grabio.
        </p>
        <dl className="space-y-5">
          {solution.faqs.map((faq) => (
            <div key={faq.question}>
              <dt className="font-semibold text-slate-900 mb-1">{faq.question}</dt>
              <dd className="text-slate-600 text-sm leading-relaxed">{faq.answer}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="public-panel bg-teal-50 border-teal-100">
        <h2 className="text-lg font-bold text-slate-900 mb-2">Start with the modules you need</h2>
        <p className="text-sm text-slate-600 mb-4">
          Grabio plans start at $5/mo (Invoice Manager). Add inventory, POS, CRM, and manufacturing as
          you grow — one account, real-time sync.
        </p>
        <AuthCTA
          className="inline-flex items-center px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700"
          showArrow
          onClick={() => trackMarketingSignupIntent(`solution_${solution.slug}_footer`)}
        />
      </section>
    </PublicPageShell>
  );
};

export default SolutionDetail;
