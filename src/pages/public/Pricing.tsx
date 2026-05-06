import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, X, ArrowRight } from 'lucide-react';
import SEOHead from '@/components/SEOHead';
import { trackSEOEvent, trackUniqueVisit } from '@/lib/seoTracker';
import PublicNav from '@/components/public/PublicNav';
import PublicFooter from '@/components/public/PublicFooter';

type BillingCycle = 'monthly' | 'yearly';

const PLANS = [
  {
    name: 'Trial',
    monthly: null,
    yearly: null,
    priceLabel: { monthly: '$0 + 20% of sales', yearly: 'Up to 3 months' },
    description: 'Pay As You Go — Free to start',
    badge: 'FREE TO START',
    highlight: false,
    cta: 'Start Free Trial',
    features: [
      'Up to 10 products',
      'Simple products & services only',
      '500 MB storage',
      '30 operations/month',
      'yourstore.grabio.space subdomain',
      'OMT & Stripe checkout',
      'Multi-currency checkout',
      'Basic inventory & analytics',
      'Email notifications + 3 basic themes',
    ],
    restrictions: [
      'No custom domain',
      'No manufacturing features',
      '20% revenue share',
      'Powered by Grabio footer shown',
    ],
  },
  {
    name: 'Starter',
    monthly: 10,
    yearly: 100,
    priceLabel: { monthly: '$10/month', yearly: '$100/year (Save $20)' },
    description: 'Most chosen for growing stores',
    badge: 'POPULAR',
    highlight: true,
    cta: 'Choose Starter',
    features: [
      'Up to 8 products',
      'All product types',
      '5 GB storage',
      'Unlimited operations',
      '0% revenue share — keep 100%',
      'Everything in Trial',
      'Discount codes & basic SEO tools',
      'Email marketing (200/month)',
      'Priority email support',
    ],
    restrictions: [],
  },
  {
    name: 'Pro',
    monthly: 20,
    yearly: 200,
    priceLabel: { monthly: '$20/month', yearly: '$200/year (Save $40)' },
    description: 'For advanced operations',
    badge: undefined,
    highlight: false,
    cta: 'Choose Pro',
    features: [
      'Up to 20 products',
      'All types + Manufacturing',
      '10 GB storage',
      'Unlimited operations',
      '0% revenue share',
      'Everything in Starter',
      'Composed products & services',
      'Advanced analytics & reports',
      'Email marketing (1,000/month)',
      'Multi-location inventory + API access',
    ],
    restrictions: [],
  },
  {
    name: 'Business',
    monthly: 30,
    yearly: 300,
    priceLabel: { monthly: '$30/month', yearly: '$300/year (Save $60)' },
    description: 'Best value for scaling brands',
    badge: 'BEST VALUE',
    highlight: false,
    cta: 'Choose Business',
    features: [
      'Up to 50 products',
      'All types + Manufacturing',
      '20 GB storage',
      'Unlimited operations',
      '0% revenue share',
      'Everything in Pro',
      'Email marketing (5,000/month)',
      'Multi-user access (up to 10)',
      'Meta shop integration + advanced SEO',
      'Dedicated account manager',
    ],
    restrictions: [],
  },
];

const COMPARISON_ROWS = [
  { feature: 'Monthly Cost',      trial: '$0 + 20%', starter: '$10',    pro: '$20',    business: '$30' },
  { feature: 'Yearly Cost',       trial: 'N/A',      starter: '$100',   pro: '$200',   business: '$300' },
  { feature: 'Products',          trial: '10',       starter: '8',      pro: '20',     business: '50' },
  { feature: 'Product Types',     trial: 'Simple',   starter: 'All',    pro: 'All',    business: 'All' },
  { feature: 'Storage',           trial: '500 MB',   starter: '5 GB',   pro: '10 GB',  business: '20 GB' },
  { feature: 'Operations/month',  trial: '30',       starter: '∞',      pro: '∞',      business: '∞' },
  { feature: 'Revenue Share',     trial: '20%',      starter: '0%',     pro: '0%',     business: '0%' },
  { feature: 'Custom Domain',     trial: 'No',       starter: '+$15',   pro: '+$15',   business: '+$15' },
  { feature: 'Manufacturing',     trial: 'No',       starter: 'No',     pro: 'Yes',    business: 'Yes' },
  { feature: 'Email Marketing',   trial: 'No',       starter: '200/mo', pro: '1K/mo',  business: '5K/mo' },
  { feature: 'Multi-user',        trial: 'No',       starter: 'No',     pro: 'No',     business: '10 users' },
  { feature: 'Support',           trial: 'Email',    starter: 'Priority', pro: 'Phone', business: 'Dedicated' },
];

const Pricing: React.FC = () => {
  const [billing, setBilling] = useState<BillingCycle>('monthly');

  useEffect(() => {
    trackSEOEvent('page_view');
    trackUniqueVisit();
  }, []);

  return (
    <>
      <SEOHead
        title="Grabio Pricing — Trial, Starter, Pro, Business Plans"
        description="Start free with Grabio's Trial plan (pay 20% of sales only), then upgrade to Starter ($10/mo), Pro ($20/mo), or Business ($30/mo). No hidden fees."
        url="/pricing"
        keywords={[
          'Grabio pricing',
          'business management software pricing',
          'POS system pricing Lebanon',
          'small business platform cost',
        ]}
      />

      <div className="flex flex-col min-h-screen bg-white">
        <PublicNav />

        <main>
          {/* ── Hero ── */}
          <section className="bg-gray-50 border-b border-gray-100 py-16 text-center">
            <div className="max-w-2xl mx-auto px-4 sm:px-6">
              <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4">
                Simple, Transparent Pricing
              </h1>
              <p className="text-lg text-gray-500 mb-8">
                Start free — no credit card required. Upgrade when you're ready.
              </p>
              <div className="inline-flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-1.5">
                <button
                  onClick={() => setBilling('monthly')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    billing === 'monthly' ? 'bg-teal-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBilling('yearly')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    billing === 'yearly' ? 'bg-teal-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Yearly
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${billing === 'yearly' ? 'bg-white/20 text-white' : 'bg-teal-100 text-teal-700'}`}>
                    Save ~$20–60
                  </span>
                </button>
              </div>
            </div>
          </section>

          {/* ── Plan cards ── */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {PLANS.map((plan) => (
                <div
                  key={plan.name}
                  className={`rounded-2xl border p-6 flex flex-col relative ${
                    plan.highlight
                      ? 'border-teal-500 ring-2 ring-teal-500/20 bg-gradient-to-b from-teal-50/50 to-white'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${plan.highlight ? 'bg-teal-600 text-white' : 'bg-gray-800 text-white'}`}>
                        {plan.badge}
                      </span>
                    </div>
                  )}

                  <div className="mb-4">
                    <h2 className="text-lg font-bold text-gray-900">{plan.name}</h2>
                    <p className="text-xs text-gray-500 mt-1">{plan.description}</p>
                  </div>

                  <div className="mb-6">
                    {plan.monthly === null ? (
                      <p className="text-2xl font-extrabold text-gray-900">Free to start</p>
                    ) : (
                      <div>
                        <p className="text-3xl font-extrabold text-gray-900">
                          ${billing === 'yearly' ? plan.yearly : plan.monthly}
                          <span className="text-sm font-normal text-gray-500">/{billing === 'yearly' ? 'yr' : 'mo'}</span>
                        </p>
                        {billing === 'yearly' && (
                          <p className="text-xs text-teal-600 mt-0.5">
                            Save ${(plan.monthly! * 12) - plan.yearly!} vs monthly
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <Link
                    to="/login?tab=signup"
                    className={`w-full text-center py-2.5 rounded-xl font-semibold text-sm transition-colors mb-5 ${
                      plan.highlight
                        ? 'bg-teal-600 text-white hover:bg-teal-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {plan.cta} <ArrowRight className="inline ml-1 h-3.5 w-3.5" />
                  </Link>

                  <ul className="space-y-2 text-sm text-gray-600">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-teal-500 mt-0.5 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                    {plan.restrictions.map((r) => (
                      <li key={r} className="flex items-start gap-2 text-gray-400">
                        <X className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* ── Add-ons ── */}
          <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-12">
            <h2 className="text-xl font-bold text-gray-900 mb-4 text-center">Optional Add-ons</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { name: 'Custom Domain Package', monthly: '$15/mo', yearly: '$150/yr', note: 'Available on Starter and above' },
                { name: 'WhatsApp Business', monthly: '$10/mo', yearly: '$100/yr', note: 'Available on all plans' },
                { name: 'Extra Storage (per 5 GB)', monthly: '$2/mo', yearly: '$24/yr', note: 'Available on Starter and above' },
              ].map((addon) => (
                <div key={addon.name} className="border border-gray-200 rounded-xl p-4">
                  <p className="font-semibold text-gray-900 text-sm mb-1">{addon.name}</p>
                  <p className="text-teal-600 font-bold">{billing === 'yearly' ? addon.yearly : addon.monthly}</p>
                  <p className="text-xs text-gray-400 mt-1">{addon.note}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Comparison table ── */}
          <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Full Plan Comparison</h2>
            <div className="overflow-x-auto rounded-2xl border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-6 py-4 font-semibold text-gray-700 w-2/5">Feature</th>
                    <th className="px-4 py-4 text-center font-semibold text-gray-700">Trial</th>
                    <th className="px-4 py-4 text-center font-semibold text-teal-600">Starter</th>
                    <th className="px-4 py-4 text-center font-semibold text-gray-700">Pro</th>
                    <th className="px-4 py-4 text-center font-semibold text-gray-700">Business</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((row, i) => (
                    <tr key={row.feature} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="px-6 py-3 text-gray-700">{row.feature}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{row.trial}</td>
                      <td className="px-4 py-3 text-center font-medium text-teal-700">{row.starter}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{row.pro}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{row.business}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── FAQ ── */}
          <section className="bg-gray-50 py-16 border-t border-gray-100">
            <div className="max-w-3xl mx-auto px-4 sm:px-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Frequently Asked Questions</h2>
              <dl className="space-y-6">
                {[
                  { q: 'What is the Trial plan?', a: 'The Trial plan is free to start — you pay nothing upfront. Instead, Grabio takes 20% of your sales revenue. It\'s a pay-as-you-go model for up to 3 months, after which you choose a paid plan.' },
                  { q: 'Can I switch plans at any time?', a: 'Yes. You can upgrade at any point from your store\'s subscription settings. Upgrades take effect immediately.' },
                  { q: 'What is the Custom Domain add-on?', a: 'The Domain Package ($15/mo) lets you connect your own domain (e.g. mystore.com) instead of using yourstore.grabio.space. Available on Starter and above.' },
                  { q: 'Is the yearly billing a one-time payment?', a: 'Yes. Yearly billing is charged once a year at the discounted rate shown. Starter saves $20, Pro saves $40, Business saves $60 vs monthly.' },
                  { q: 'What payment methods are accepted?', a: 'We accept OMT (local Lebanese transfer) and Stripe (international cards). Both are available from day one on all plans.' },
                ].map(({ q, a }) => (
                  <div key={q}>
                    <dt className="font-semibold text-gray-900 mb-2">{q}</dt>
                    <dd className="text-gray-500 leading-relaxed">{a}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          {/* ── CTA ── */}
          <section className="py-14 text-center max-w-2xl mx-auto px-4 sm:px-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Still have questions?</h2>
            <p className="text-gray-500 mb-6">Our team will help you choose the right plan for your business.</p>
            <Link to="/contact" className="px-6 py-3 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 transition-colors">
              Talk to Us
            </Link>
          </section>
        </main>

        <PublicFooter />
      </div>
    </>
  );
};

export default Pricing;
