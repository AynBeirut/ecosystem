import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, X, ArrowRight } from 'lucide-react';
import SEOHead from '@/components/SEOHead';
import { trackSEOEvent, trackUniqueVisit } from '@/lib/seoTracker';
import PublicNav from '@/components/public/PublicNav';
import PublicFooter from '@/components/public/PublicFooter';

type BillingCycle = 'monthly' | 'annual';

interface PlanFeature {
  label: string;
  starter: boolean | string;
  pro: boolean | string;
  enterprise: boolean | string;
}

const FEATURES: PlanFeature[] = [
  { label: 'Online store & marketplace listing', starter: true, pro: true, enterprise: true },
  { label: 'Products', starter: '50 products', pro: 'Unlimited', enterprise: 'Unlimited' },
  { label: 'Point of Sale (POS)', starter: true, pro: true, enterprise: true },
  { label: 'Orders per month', starter: '200', pro: 'Unlimited', enterprise: 'Unlimited' },
  { label: 'Inventory management', starter: true, pro: true, enterprise: true },
  { label: 'Invoicing & billing', starter: true, pro: true, enterprise: true },
  { label: 'Customer management', starter: false, pro: true, enterprise: true },
  { label: 'Staff sub-accounts', starter: false, pro: '3 staff', enterprise: 'Unlimited' },
  { label: 'Raw materials & production', starter: false, pro: true, enterprise: true },
  { label: 'Supplier & purchase orders', starter: false, pro: true, enterprise: true },
  { label: 'Analytics & reports', starter: 'Basic', pro: 'Advanced', enterprise: 'Full + Custom' },
  { label: 'Dual currency support', starter: false, pro: true, enterprise: true },
  { label: 'Custom store domain', starter: false, pro: true, enterprise: true },
  { label: 'Finance suite (P&L, reconciliation)', starter: false, pro: false, enterprise: true },
  { label: 'API access', starter: false, pro: false, enterprise: true },
  { label: 'Priority support', starter: false, pro: false, enterprise: true },
];

const PLANS = [
  {
    name: 'Starter',
    key: 'starter' as const,
    monthly: 0,
    annual: 0,
    description: 'For businesses just getting started.',
    cta: 'Start Free',
    href: '/signup',
    highlight: false,
  },
  {
    name: 'Pro',
    key: 'pro' as const,
    monthly: 29,
    annual: 23,
    description: 'For growing businesses that need the full stack.',
    cta: 'Start 14-Day Trial',
    href: '/signup?plan=pro',
    highlight: true,
  },
  {
    name: 'Enterprise',
    key: 'enterprise' as const,
    monthly: null,
    annual: null,
    description: 'For multi-branch operations with custom requirements.',
    cta: 'Contact Us',
    href: '/contact',
    highlight: false,
  },
];

const FeatureCell: React.FC<{ value: boolean | string }> = ({ value }) => {
  if (value === true) return <CheckCircle className="h-5 w-5 text-teal-500 mx-auto" />;
  if (value === false) return <X className="h-4 w-4 text-gray-300 mx-auto" />;
  return <span className="text-sm text-gray-700 font-medium">{value}</span>;
};

const Pricing: React.FC = () => {
  const [billing, setBilling] = useState<BillingCycle>('monthly');

  useEffect(() => {
    trackSEOEvent('page_view');
    trackUniqueVisit();
  }, []);

  return (
    <>
      <SEOHead
        title="Grabio Pricing — Free, Pro, and Enterprise Plans"
        description="Grabio offers a free plan for businesses getting started, a Pro plan for full-featured operations, and Enterprise for multi-branch businesses. No hidden fees."
        url="/pricing"
        keywords={[
          'business management software pricing',
          'POS system pricing',
          'invoicing software pricing',
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
                Start free. Upgrade when you are ready. No contracts. No hidden fees.
              </p>

              {/* Billing toggle */}
              <div className="inline-flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-1.5">
                <button
                  onClick={() => setBilling('monthly')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    billing === 'monthly'
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBilling('annual')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    billing === 'annual'
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Annual
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${billing === 'annual' ? 'bg-white/20 text-white' : 'bg-teal-100 text-teal-700'}`}>
                    Save 20%
                  </span>
                </button>
              </div>
            </div>
          </section>

          {/* ── Plan cards ── */}
          <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {PLANS.map((plan) => (
                <div
                  key={plan.name}
                  className={`rounded-2xl border p-8 flex flex-col ${
                    plan.highlight
                      ? 'border-teal-500 ring-2 ring-teal-500/20 bg-gradient-to-b from-teal-50/50 to-white relative'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-teal-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                        Most Popular
                      </span>
                    </div>
                  )}

                  <div className="mb-6">
                    <h2 className="text-xl font-bold text-gray-900">{plan.name}</h2>
                    <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
                  </div>

                  <div className="mb-8">
                    {plan.monthly === null ? (
                      <p className="text-4xl font-extrabold text-gray-900">Custom</p>
                    ) : plan.monthly === 0 ? (
                      <p className="text-4xl font-extrabold text-gray-900">Free</p>
                    ) : (
                      <div className="flex items-end gap-2">
                        <p className="text-4xl font-extrabold text-gray-900">
                          ${billing === 'annual' ? plan.annual : plan.monthly}
                        </p>
                        <p className="text-gray-500 text-sm mb-1.5">/mo{billing === 'annual' ? ', billed annually' : ''}</p>
                      </div>
                    )}
                  </div>

                  <Link
                    to={plan.href}
                    className={`w-full text-center py-3 rounded-xl font-semibold text-sm transition-colors mb-6 ${
                      plan.highlight
                        ? 'bg-teal-600 text-white hover:bg-teal-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {plan.cta} <ArrowRight className="inline ml-1 h-3.5 w-3.5" />
                  </Link>

                  <ul className="space-y-3 mt-auto">
                    {FEATURES.filter((f) => f[plan.key] !== false).slice(0, 8).map((f) => (
                      <li key={f.label} className="flex items-start gap-2.5 text-sm text-gray-600">
                        <CheckCircle className="h-4 w-4 text-teal-500 mt-0.5 flex-shrink-0" />
                        <span>
                          {f.label}
                          {typeof f[plan.key] === 'string' && f[plan.key] !== 'true' && (
                            <span className="text-gray-400 ml-1">({f[plan.key]})</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* ── Full comparison table ── */}
          <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Full Feature Comparison</h2>
            <div className="overflow-x-auto rounded-2xl border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-6 py-4 font-semibold text-gray-700 w-1/2">Feature</th>
                    {PLANS.map((p) => (
                      <th key={p.name} className={`px-4 py-4 text-center font-semibold ${p.highlight ? 'text-teal-600' : 'text-gray-700'}`}>
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FEATURES.map((feature, i) => (
                    <tr key={feature.label} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="px-6 py-3 text-gray-700">{feature.label}</td>
                      {PLANS.map((p) => (
                        <td key={p.name} className="px-4 py-3 text-center">
                          <FeatureCell value={feature[p.key]} />
                        </td>
                      ))}
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
                  { q: 'Is there a free trial for the Pro plan?', a: 'Yes. All Pro plan features are available free for 14 days. No credit card required to start.' },
                  { q: 'Can I switch plans at any time?', a: 'Yes. You can upgrade or downgrade at any point. Upgrades take effect immediately; downgrades apply at the next billing cycle.' },
                  { q: 'Is my data safe if I cancel?', a: 'Your data remains accessible for 60 days after cancellation. You can export it at any time.' },
                  { q: 'Does the Starter plan have any time limits?', a: 'No. The Starter plan is free indefinitely, with the feature limits noted above.' },
                  { q: 'What payment methods do you accept?', a: 'We accept all major credit cards. Enterprise customers can arrange invoice-based billing.' },
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
