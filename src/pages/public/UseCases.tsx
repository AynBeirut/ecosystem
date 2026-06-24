import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import AuthCTA from '@/components/public/AuthCTA';
import { ShoppingBag, Coffee, Truck, Wrench, Factory, Building2, ArrowRight, CheckCircle } from 'lucide-react';
import SEOHead from '@/components/SEOHead';
import { trackSEOEvent, trackUniqueVisit } from '@/lib/seoTracker';
import PublicNav from '@/components/public/PublicNav';
import PublicFooter from '@/components/public/PublicFooter';

const USE_CASES = [
  {
    id: 'retail',
    icon: ShoppingBag,
    title: 'Retail Stores',
    headline: 'Run a tighter retail operation from day one.',
    description:
      'Neighborhood shops, boutiques, and general retail use core marketplace and inventory modules — with optional CRM and the Admin Android app for owners on the go.',
    features: [
      'Online storefront plus web admin dashboard',
      'Real-time inventory and low-stock alerts',
      'Invoicing, payments, and dual currency',
      'Optional Sales CRM for field follow-ups',
      'Grabio Admin App on Google Play',
      'Grabio POS (Windows + mobile) — in development',
    ],
    modules: ['marketplace', 'stock', 'invoicing', 'crm', 'admin_mobile'],
    featureLink: '/features#stock',
    featureLinkLabel: 'Explore inventory modules',
    blogLink: '/blog/commerce-management-system-guide',
    blogLinkLabel: 'Read: Commerce Management Guide',
  },
  {
    id: 'food',
    icon: Coffee,
    title: 'Cafes & Restaurants',
    headline: 'From order to delivery — in one system.',
    description:
      'Cafes, restaurants, and cloud kitchens use delivery, marketplace, and Restaurant Production (beta) for live ingredient deduction — without a separate manufacturing step.',
    features: [
      'Restaurant Production — recipe deduction on sale',
      'Delivery workflow with GPS and notifications',
      'Marketplace ordering and guest tracking',
      'Inventory and supplier management',
      'Staff roles via Team & Sub-Accounts',
      'POS app planned for counter checkout',
    ],
    modules: ['restaurant', 'delivery', 'marketplace', 'stock', 'team'],
    featureLink: '/features#restaurant',
    featureLinkLabel: 'Explore F&B modules',
    blogLink: '/blog/commerce-management-system-guide',
    blogLinkLabel: 'Read: Commerce Management Guide',
  },
  {
    id: 'wholesale',
    icon: Truck,
    title: 'Wholesale & Distribution',
    headline: 'Manage volume, suppliers, and credit — cleanly.',
    description:
      'Wholesale distributors lean on invoicing, payments, inventory, and analytics — with B2B statements and supplier credit built into the platform core.',
    features: [
      'Bulk purchase orders and suppliers',
      'B2B invoices and account statements',
      'Customer credit and payment terms',
      'Multi-location inventory visibility',
      'Revenue and margin analytics',
      'Optional Dropship Sync for supplier links',
    ],
    modules: ['invoicing', 'payments', 'stock', 'analytics', 'dropship'],
    featureLink: '/features#invoicing',
    featureLinkLabel: 'Explore finance modules',
    blogLink: '/blog/invoicing-billing-software-guide',
    blogLinkLabel: 'Read: Invoicing Software Guide',
  },
  {
    id: 'services',
    icon: Wrench,
    title: 'Agencies & Services',
    headline: 'Track work, invoice clients, and grow with CRM + PSA.',
    description:
      'Consultancies and service businesses use invoicing and Service Subscriptions (beta). Add Sales CRM today; Projects (PSA) and Proposal Writer are on the roadmap.',
    features: [
      'Service-type products and recurring billing',
      'Quote-to-invoice workflows',
      'Sales CRM add-on — pipeline and reps',
      'Projects (PSA) — in development',
      'AI Proposal Writer — in development',
      'Client history and payment tracking',
    ],
    modules: ['services', 'invoicing', 'crm', 'projects', 'proposal_writer'],
    featureLink: '/features#crm',
    featureLinkLabel: 'Explore CRM and PSA modules',
    blogLink: '/blog/invoicing-billing-software-guide',
    blogLinkLabel: 'Read: Invoicing Software Guide',
  },
  {
    id: 'manufacturing',
    icon: Factory,
    title: 'Small Manufacturers',
    headline: 'Track what you make, what it costs, and what you sell.',
    description:
      'Food producers and light manufacturers use Factory & Production (Pro+) for BOM, batches, and finished goods — alongside core inventory and analytics.',
    features: [
      'Bill of Materials and production runs',
      'Raw materials with expiry tracking',
      'Finished goods valuation (FIFO/LIFO)',
      'Factory module on Pro plan and above',
      'Marketplace and invoicing included',
      'Business Insights AI — in development',
    ],
    modules: ['factory', 'stock', 'analytics', 'marketplace'],
    featureLink: '/features#factory',
    featureLinkLabel: 'Explore production modules',
    blogLink: '/blog/business-management-software-small-business',
    blogLinkLabel: 'Read: Business Management Guide',
  },
  {
    id: 'multi-branch',
    icon: Building2,
    title: 'Multi-Branch Operations',
    headline: 'One platform. Multiple locations. Complete visibility.',
    description:
      'Growing brands use Business tier multi-user access, consolidated analytics, and optional CRM — plus the Admin Android app for each location owner.',
    features: [
      'Team & Sub-Accounts — up to 10 users on Business',
      'Shared catalog across branches',
      'Per-branch staff and permissions',
      'Consolidated revenue reports',
      'Sales CRM for regional reps',
      'Admin Android app per owner account',
    ],
    modules: ['team', 'analytics', 'crm', 'admin_mobile', 'marketplace'],
    featureLink: '/features#team',
    featureLinkLabel: 'Explore team modules',
    blogLink: '/blog/commerce-management-system-guide',
    blogLinkLabel: 'Read: Commerce Management Guide',
  },
];

const UseCases: React.FC = () => {
  useEffect(() => {
    trackSEOEvent('page_view');
    trackUniqueVisit();
  }, []);

  return (
    <>
      <SEOHead
        title="Grabio Use Cases — Retail, F&B, Wholesale, Agencies, and More"
        description="See how Grabio modular platform adapts to your industry — activate core features on your plan and add CRM, production, apps, and AI tools as you grow."
        url="/use-cases"
        keywords={[
          'Grabio use cases',
          'retail management software',
          'restaurant inventory software',
          'agency CRM PSA',
          'manufacturing inventory software',
        ]}
      />

      <div className="flex flex-col min-h-screen bg-white">
        <PublicNav />

        <main>
          <section className="bg-gradient-to-br from-teal-600 to-cyan-800 text-white py-16">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
              <h1 className="text-4xl md:text-5xl font-extrabold mb-4">Built for Your Industry</h1>
              <p className="text-lg text-teal-100 mb-2">One sign-in — all your data in one place.</p>
              <p className="text-teal-200/90">
                Start with core platform features on your plan. Toggle optional modules, apps, and add-ons
                to match how your business actually works.
              </p>
              <div className="flex flex-wrap gap-3 justify-center mt-8">
                {USE_CASES.map((uc) => (
                  <a
                    key={uc.id}
                    href={`#${uc.id}`}
                    className="px-4 py-2 text-sm font-medium bg-white/15 hover:bg-white/25 rounded-full transition-colors"
                  >
                    {uc.title}
                  </a>
                ))}
              </div>
            </div>
          </section>

          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 space-y-20">
            {USE_CASES.map(
              (
                { id, icon: Icon, title, headline, description, features, modules, featureLink, featureLinkLabel, blogLink, blogLinkLabel },
                i,
              ) => (
                <section key={id} id={id} className="scroll-mt-20" aria-labelledby={`${id}-heading`}>
                  <div className={`grid md:grid-cols-2 gap-10 items-start ${i % 2 === 1 ? 'md:grid-flow-dense' : ''}`}>
                    <div className={i % 2 === 1 ? 'md:col-start-2' : ''}>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center">
                          <Icon className="h-5 w-5" />
                        </div>
                        <span className="text-sm font-semibold text-gray-500">{title}</span>
                      </div>
                      <h2 id={`${id}-heading`} className="text-2xl md:text-3xl font-bold text-gray-900 mb-4 leading-tight">
                        {headline}
                      </h2>
                      <p className="text-gray-500 leading-relaxed mb-4">{description}</p>
                      <div className="flex flex-wrap gap-1.5 mb-6">
                        {modules.map((mod) => (
                          <Link
                            key={mod}
                            to={`/features#${mod}`}
                            className="text-[10px] font-mono bg-teal-50 text-teal-700 border border-teal-100 px-2 py-0.5 rounded hover:bg-teal-100"
                          >
                            grabio_{mod}
                          </Link>
                        ))}
                      </div>
                      <div className="flex flex-col gap-2">
                        <Link
                          to={featureLink}
                          className="inline-flex items-center gap-2 text-sm font-medium text-teal-600 hover:text-teal-700"
                        >
                          {featureLinkLabel} <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                        <Link
                          to={blogLink}
                          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
                        >
                          {blogLinkLabel} <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                        <Link
                          to="/pricing"
                          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
                        >
                          Build your module package <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>

                    <div
                      className={`bg-gray-50 rounded-2xl border border-gray-100 p-6 ${i % 2 === 1 ? 'md:col-start-1 md:row-start-1' : ''}`}
                    >
                      <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">
                        Key capabilities for {title.toLowerCase()}
                      </p>
                      <ul className="space-y-3">
                        {features.map((feature) => (
                          <li key={feature} className="flex items-start gap-3 text-sm text-gray-700">
                            <CheckCircle className="h-4 w-4 text-teal-500 mt-0.5 flex-shrink-0" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </section>
              ),
            )}
          </div>

          <section className="bg-gradient-to-br from-teal-600 to-cyan-700 py-16 text-white text-center">
            <div className="max-w-2xl mx-auto px-4 sm:px-6">
              <h2 className="text-3xl font-extrabold mb-4">Your industry. Your module stack.</h2>
              <p className="text-teal-100 text-lg mb-8">
                Start free, pick a base plan, and toggle only the modules you need.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <AuthCTA className="px-8 py-4 font-semibold bg-white text-teal-700 rounded-xl hover:bg-teal-50 transition-colors" />
                <Link
                  to="/features"
                  className="px-8 py-4 font-semibold border-2 border-white/40 text-white rounded-xl hover:bg-white/10 transition-colors"
                >
                  Explore Features
                </Link>
                <Link
                  to="/pricing"
                  className="px-8 py-4 font-semibold border-2 border-white/40 text-white rounded-xl hover:bg-white/10 transition-colors"
                >
                  View Pricing
                </Link>
              </div>
            </div>
          </section>
        </main>

        <PublicFooter />
      </div>
    </>
  );
};

export default UseCases;
