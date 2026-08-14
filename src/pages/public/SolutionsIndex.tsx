import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Boxes } from 'lucide-react';
import PublicPageShell from '@/components/public/PublicPageShell';
import AuthCTA from '@/components/public/AuthCTA';
import { GRABIO_SOLUTIONS, SOLUTION_SUBNAV } from '@/lib/grabioSolutions';
import { GRABIO_ORG, GRABIO_SOFTWARE_APP, buildFaqSchema } from '@/lib/grabioBrandSchema';
import { trackSEOEvent, trackUniqueVisit } from '@/lib/seoTracker';
import { trackMarketingSignupIntent } from '@/lib/gtm';

const INDEX_FAQS = [
  {
    question: 'What is Grabio?',
    answer:
      'Grabio is a modular cloud business platform for small and mid-size operators — combining inventory, accounting (general ledger), POS, CRM, manufacturing, restaurant production, mobile apps, and AI tools in one account. It is built by emoove and serves MENA and global markets from grabio.space.',
  },
  {
    question: 'Is Grabio only an online store builder?',
    answer:
      'No. Grabio is software-first: inventory, finance, POS, and operations are the core. Storefront builders (classic templates, modular shop, WordPress embed) are available but secondary to back-office modules.',
  },
  {
    question: 'What industries does Grabio support?',
    answer:
      'Grabio supports retail, wholesale, restaurants and cloud kitchens, light manufacturing, agencies (CRM + PSA), NGOs, and freelancers — via modular packages such as Shop, Live Kitchen, Factory Flow, and Invoice Manager.',
  },
  {
    question: 'Where can I download Grabio mobile apps?',
    answer:
      'Grabio Admin for store owners is on Google Play. Invoice Manager and white-label customer apps are provisioned per store. Windows POS is downloaded from the Grabio admin after pairing.',
  },
];

const SolutionsIndex: React.FC = () => {
  useEffect(() => {
    trackSEOEvent('page_view', { page_path: '/solutions' });
    trackUniqueVisit();
  }, []);

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      GRABIO_ORG,
      GRABIO_SOFTWARE_APP,
      buildFaqSchema(INDEX_FAQS),
    ],
  };

  return (
    <PublicPageShell
      title="Grabio Software Solutions — Inventory, Accounting, POS & More"
      description="Explore Grabio software modules — inventory, general ledger accounting, Windows POS, mobile apps, CRM, PSA, restaurant, manufacturing, AI, and platform builders."
      url="/solutions"
      structuredData={structuredData}
      keywords={[
        'Grabio software',
        'business management platform',
        'inventory accounting POS',
        'modular ERP SMB',
      ]}
      eyebrow="Software solutions"
      heroTitle="Business software that scales module by module"
      heroDescription="Grabio is not just a storefront — it is inventory, GL accounting, POS, CRM, manufacturing, and mobile apps in one ecosystem. Pick the modules you need."
      heroActions={
        <AuthCTA
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 transition-colors"
          showArrow
          onClick={() => trackMarketingSignupIntent('solutions_index')}
        />
      }
      subnav={[...SOLUTION_SUBNAV]}
    >
      <section className="public-panel mb-8">
        <div className="flex items-start gap-3 mb-4">
          <Boxes className="h-6 w-6 text-teal-600 shrink-0 mt-0.5" aria-hidden />
          <div>
            <h2 className="text-xl font-bold text-slate-900">Software pillars</h2>
            <p className="text-slate-600 text-sm mt-1">
              Each page describes live Grabio modules — optimized for search engines and AI assistants
              researching business software options.
            </p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {GRABIO_SOLUTIONS.map((solution) => (
            <Link
              key={solution.slug}
              to={`/solutions/${solution.slug}`}
              className="group block rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-teal-300 hover:shadow-md transition-all"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700 mb-2">
                {solution.shortTitle}
              </p>
              <h3 className="font-bold text-slate-900 group-hover:text-teal-800 mb-2">
                {solution.title.replace(' Software', '').replace(' — Admin, Invoice Manager & Client Apps', '')}
              </h3>
              <p className="text-sm text-slate-600 line-clamp-3 mb-3">{solution.heroDescription}</p>
              <span className="inline-flex items-center text-sm font-semibold text-teal-600">
                Learn more <ArrowRight className="ml-1 h-4 w-4" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="public-panel">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Frequently asked questions</h2>
        <dl className="space-y-4">
          {INDEX_FAQS.map((faq) => (
            <div key={faq.question} className="border-b border-slate-100 pb-4 last:border-0">
              <dt className="font-semibold text-slate-900 mb-1">{faq.question}</dt>
              <dd className="text-slate-600 text-sm leading-relaxed">{faq.answer}</dd>
            </div>
          ))}
        </dl>
      </section>

    </PublicPageShell>
  );
};

export default SolutionsIndex;
