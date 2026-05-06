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
      'Neighborhood shops, boutiques, electronics stores, and general retail benefit from integrated POS and inventory — where every sale automatically updates stock and generates a receipt.',
    features: [
      'Fast checkout with barcode scanning',
      'Real-time inventory updates on every sale',
      'Low-stock alerts before you run out',
      'Customer profiles built from purchase history',
      'Multi-staff accounts with cashier-level access control',
      'Online store alongside physical shop',
    ],
    featureLink: '/features#pos',
    featureLinkLabel: 'Explore POS features',
    blogLink: '/blog/pos-systems-for-small-business-guide',
    blogLinkLabel: 'Read: POS Guide for Small Businesses',
  },
  {
    id: 'food',
    icon: Coffee,
    title: 'Cafes & Restaurants',
    headline: 'From order to delivery — in one system.',
    description:
      'Cafes, restaurants, cloud kitchens, and food delivery operations need fast order processing, table or delivery management, and real-time inventory that accounts for ingredients consumed per dish.',
    features: [
      'Recipe-based inventory consumption (ingredients per dish)',
      'Fast order processing with modifiers',
      'Delivery order management with GPS tracking',
      'Daily sales reports by product',
      'Cash + card + mobile payment handling',
      'Staff management with shift-level tracking',
    ],
    featureLink: '/features#inventory',
    featureLinkLabel: 'Explore inventory features',
    blogLink: '/blog/commerce-management-system-guide',
    blogLinkLabel: 'Read: Commerce Management Guide',
  },
  {
    id: 'wholesale',
    icon: Truck,
    title: 'Wholesale & Distribution',
    headline: 'Manage volume, suppliers, and credit — cleanly.',
    description:
      'Wholesale distributors operate on thin margins and complex credit terms. Grabio handles multi-unit inventory, supplier purchase orders, customer credit management, and B2B invoicing at volume.',
    features: [
      'Bulk purchase orders with supplier management',
      'Customer credit limits and payment terms',
      'Professional B2B invoices with VAT/tax support',
      'Multi-warehouse inventory visibility',
      'Overdue invoice tracking and follow-up',
      'Supplier statements and reconciliation',
    ],
    featureLink: '/features#invoicing',
    featureLinkLabel: 'Explore invoicing features',
    blogLink: '/blog/invoicing-billing-software-guide',
    blogLinkLabel: 'Read: Invoicing Software Guide',
  },
  {
    id: 'services',
    icon: Wrench,
    title: 'Service Businesses',
    headline: 'Track work, invoice clients, and get paid.',
    description:
      'Service businesses — repair shops, consultancies, cleaning services, freelancers — need fast quoting, clean invoicing, and payment tracking without the overhead of complex product inventory.',
    features: [
      'Service-type products (no physical stock required)',
      'Quote-to-invoice workflows',
      'Customer service history',
      'Payment terms and partial payment tracking',
      'Expense tracking for service delivery costs',
      'Recurring service billing',
    ],
    featureLink: '/features#invoicing',
    featureLinkLabel: 'Explore invoicing features',
    blogLink: '/blog/invoicing-billing-software-guide',
    blogLinkLabel: 'Read: Invoicing Software Guide',
  },
  {
    id: 'manufacturing',
    icon: Factory,
    title: 'Small Manufacturers',
    headline: 'Track what you make, what it costs, and what you sell.',
    description:
      'Food producers, artisan goods makers, and light manufacturers need to track raw material costs, production batches, yield rates, and finished goods inventory — separately from simple retail stock.',
    features: [
      'Raw materials inventory with expiry tracking',
      'Recipe management (ingredients → finished product)',
      'Production batch tracking with quality status',
      'Finished goods valuation (FIFO/LIFO/Weighted average)',
      'Cost-per-unit calculation for pricing decisions',
      'Reorder points for raw materials',
    ],
    featureLink: '/features#inventory',
    featureLinkLabel: 'Explore production features',
    blogLink: '/blog/business-management-software-small-business',
    blogLinkLabel: 'Read: Business Management Guide',
  },
  {
    id: 'multi-branch',
    icon: Building2,
    title: 'Multi-Branch Operations',
    headline: 'One platform. Multiple locations. Complete visibility.',
    description:
      'Businesses with more than one outlet need consolidated reporting, shared product catalogs, and per-branch staff management — without maintaining separate systems for each location.',
    features: [
      'Multiple store profiles under one account',
      'Shared product catalog across branches',
      'Per-branch staff and access control',
      'Consolidated revenue and sales reports',
      'Branch-level inventory tracking',
      'Marketplace presence for each location',
    ],
    featureLink: '/features#team',
    featureLinkLabel: 'Explore team management features',
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
      title="Grabio Use Cases — Retail, Food, Wholesale, Services, and More"
      description="See how Grabio adapts to your industry — retail stores, cafes, wholesale distributors, service businesses, small manufacturers, and multi-branch operations."
      url="/use-cases"
      keywords={[
        'business management software use cases',
        'POS for retail store',
        'POS for restaurant',
        'wholesale management system',
        'invoicing for service business',
        'manufacturing inventory software',
      ]}
    />

    <div className="flex flex-col min-h-screen bg-white">
      <PublicNav />

      <main>
        {/* ── Hero ── */}
        <section className="bg-gradient-to-br from-gray-900 to-gray-800 text-white py-16">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <h1 className="text-4xl md:text-5xl font-extrabold mb-5">
              Built for Your Industry
            </h1>
            <p className="text-xl text-gray-300">
              Grabio adapts to how your business actually works — not the other way around.
            </p>
            <div className="flex flex-wrap gap-3 justify-center mt-8">
              {USE_CASES.map((uc) => (
                <a
                  key={uc.id}
                  href={`#${uc.id}`}
                  className="px-4 py-2 text-sm font-medium bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                >
                  {uc.title}
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* ── Use Case sections ── */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 space-y-20">
          {USE_CASES.map(({ id, icon: Icon, title, headline, description, features, featureLink, featureLinkLabel, blogLink, blogLinkLabel }, i) => (
            <section
              key={id}
              id={id}
              className="scroll-mt-20"
              aria-labelledby={`${id}-heading`}
            >
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
                  <p className="text-gray-500 leading-relaxed mb-6">{description}</p>

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
                  </div>
                </div>

                <div className={`bg-gray-50 rounded-2xl border border-gray-100 p-6 ${i % 2 === 1 ? 'md:col-start-1 md:row-start-1' : ''}`}>
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
          ))}
        </div>

        {/* ── CTA ── */}
        <section className="bg-gradient-to-br from-teal-600 to-cyan-700 py-16 text-white text-center">
          <div className="max-w-2xl mx-auto px-4 sm:px-6">
            <h2 className="text-3xl font-extrabold mb-4">Your industry. One platform.</h2>
            <p className="text-teal-100 text-lg mb-8">
              Start free and configure Grabio for how your business actually operates.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <AuthCTA className="px-8 py-4 font-semibold bg-white text-teal-700 rounded-xl hover:bg-teal-50 transition-colors" />
              <Link to="/features" className="px-8 py-4 font-semibold border-2 border-white/40 text-white rounded-xl hover:bg-white/10 transition-colors">
                Explore Features
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
