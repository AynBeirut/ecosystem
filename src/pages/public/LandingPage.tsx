import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import AuthCTA from '@/components/public/AuthCTA';
import {
  ShoppingCart,
  BarChart2,
  Package,
  FileText,
  Users,
  Zap,
  ArrowRight,
  CheckCircle,
  Store,
} from 'lucide-react';
import SEOHead from '@/components/SEOHead';
import { trackSEOEvent, trackUniqueVisit, trackCTAClick } from '@/lib/seoTracker';
import PublicNav from '@/components/public/PublicNav';
import PublicFooter from '@/components/public/PublicFooter';
import { BLOG_POSTS } from '@/data/blog-posts';

const FEATURES_PREVIEW = [
  {
    icon: ShoppingCart,
    title: 'Point of Sale',
    desc: 'Fast checkout, barcode scanning, multi-payment support, and offline mode. Built for real retail environments.',
    href: '/features#pos',
  },
  {
    icon: Package,
    title: 'Inventory Management',
    desc: 'Real-time stock tracking, raw materials, production batches, and automatic low-stock alerts.',
    href: '/features#inventory',
  },
  {
    icon: FileText,
    title: 'Invoicing & Billing',
    desc: 'Generate professional invoices in seconds. Share via PDF, WhatsApp, or email. Track payment status automatically.',
    href: '/features#invoicing',
  },
  {
    icon: Store,
    title: 'Online Marketplace',
    desc: 'Your store goes live on the Grabio marketplace and your own custom domain — reaching customers wherever they shop.',
    href: '/features#marketplace',
  },
  {
    icon: BarChart2,
    title: 'Analytics & Reports',
    desc: 'Understand your business with sales trends, revenue by product, customer behavior, and financial summaries.',
    href: '/features#analytics',
  },
  {
    icon: Users,
    title: 'Customer & Staff Management',
    desc: 'Manage customer records, order history, staff accounts, and role-based access controls in one place.',
    href: '/features#team',
  },
];

const USE_CASES = [
  { label: 'Retail Stores', href: '/use-cases#retail' },
  { label: 'Cafes & Restaurants', href: '/use-cases#food' },
  { label: 'Wholesale Distributors', href: '/use-cases#wholesale' },
  { label: 'Service Businesses', href: '/use-cases#services' },
  { label: 'Manufacturers', href: '/use-cases#manufacturing' },
  { label: 'Multi-branch Operations', href: '/use-cases#multi-branch' },
];

const STATS = [
  { value: '500+', label: 'Active Stores' },
  { value: '50K+', label: 'Orders Processed' },
  { value: '4.8 / 5', label: 'Average Rating' },
  { value: '< 2s', label: 'Page Load Time' },
];

const SCHEMA = {
  '@context': 'https://schema.org',
  '@type': ['WebSite', 'SoftwareApplication'],
  name: 'Grabio',
  url: 'https://grabio.space',
  description:
    'All-in-one business management platform with POS, inventory, invoicing, and multi-vendor marketplace.',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web, Android, iOS',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    description: 'Free and paid plans available',
  },
};

const LandingPage: React.FC = () => {
  const recentPosts = BLOG_POSTS.slice(0, 3);

  useEffect(() => {
    trackSEOEvent('page_view');
    trackUniqueVisit();
  }, []);

  return (
    <>
      <SEOHead
        title="Grabio — Business Management Software for Modern Commerce"
        description="Grabio is an all-in-one business management platform with POS, inventory management, invoicing, and an online marketplace. Built for small businesses that need serious tools."
        url="/"
        keywords={[
          'business management software',
          'POS system for small business',
          'invoicing and billing platform',
          'commerce management system',
          'inventory management software',
        ]}
        structuredData={SCHEMA}
      />

      <div className="flex flex-col min-h-screen bg-white">
        <PublicNav />

        <main>
          {/* ── Hero ── */}
          <section className="relative overflow-hidden bg-gradient-to-br from-teal-600 via-teal-700 to-cyan-800 text-white py-20 md:py-28">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center relative z-10">
              <span className="inline-block mb-4 px-3 py-1 text-xs font-semibold bg-white/20 rounded-full tracking-wide uppercase">
                All-in-one business platform
              </span>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight mb-6 text-balance">
                Manage Your Business.<br className="hidden sm:block" />
                Grow Your Commerce.
              </h1>
              <p className="text-xl md:text-2xl text-teal-100 max-w-3xl mx-auto mb-10 leading-relaxed">
                POS, inventory, invoicing, and marketplace in one platform. Built for small businesses that are serious about growth.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <AuthCTA
                  className="px-8 py-4 text-base font-semibold bg-white text-teal-700 rounded-xl hover:bg-teal-50 transition-colors shadow-lg"
                  onClick={() => trackCTAClick('get_started_free')}
                  showArrow
                />
                <Link
                  to="/features"
                  className="px-8 py-4 text-base font-semibold border-2 border-white/40 text-white rounded-xl hover:bg-white/10 transition-colors"
                  onClick={() => trackCTAClick('explore_features')}
                >
                  Explore Features
                </Link>
              </div>
            </div>

            {/* Decorative background */}
            <div className="absolute inset-0 opacity-10" aria-hidden="true">
              <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full translate-x-1/2 -translate-y-1/2" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-white rounded-full -translate-x-1/2 translate-y-1/2" />
            </div>
          </section>

          {/* ── Stats ── */}
          <section className="bg-gray-50 border-b border-gray-100 py-10" aria-label="Platform statistics">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              {STATS.map((s) => (
                <div key={s.label}>
                  <p className="text-3xl font-extrabold text-teal-600">{s.value}</p>
                  <p className="text-sm text-gray-500 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Features ── */}
          <section className="py-20 max-w-6xl mx-auto px-4 sm:px-6" id="features" aria-labelledby="features-heading">
            <div className="text-center mb-14">
              <h2 id="features-heading" className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Everything Your Business Needs
              </h2>
              <p className="text-lg text-gray-500 max-w-2xl mx-auto">
                From the first sale to growing a multi-channel operation — Grabio handles the operational layer so you can focus on building.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {FEATURES_PREVIEW.map(({ icon: Icon, title, desc, href }) => (
                <Link
                  key={title}
                  to={href}
                  className="group p-6 rounded-2xl border border-gray-200 hover:border-teal-300 hover:shadow-md transition-all bg-white"
                >
                  <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center mb-4 group-hover:bg-teal-100 transition-colors">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
                  <span className="mt-4 inline-flex items-center text-sm text-teal-600 font-medium group-hover:gap-1 gap-0.5 transition-all">
                    Learn more <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              ))}
            </div>

            <div className="mt-10 text-center">
              <Link
                to="/features"
                className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 transition-colors"
              >
                See All Features <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>

          {/* ── Use Cases ── */}
          <section className="bg-gray-50 py-20" aria-labelledby="use-cases-heading">
            <div className="max-w-6xl mx-auto px-4 sm:px-6">
              <div className="text-center mb-12">
                <h2 id="use-cases-heading" className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                  Built for Your Industry
                </h2>
                <p className="text-lg text-gray-500 max-w-2xl mx-auto">
                  Whether you run a retail store, a cafe, or a wholesale operation — Grabio adapts to how your business actually works.
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
                {USE_CASES.map(({ label, href }) => (
                  <Link
                    key={label}
                    to={href}
                    className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-teal-300 hover:bg-teal-50 transition-all text-sm font-medium text-gray-700 hover:text-teal-700"
                  >
                    <CheckCircle className="h-4 w-4 text-teal-500 flex-shrink-0" />
                    {label}
                  </Link>
                ))}
              </div>

              <div className="mt-8 text-center">
                <Link
                  to="/use-cases"
                  className="text-sm font-medium text-teal-600 hover:text-teal-700 underline-offset-2 hover:underline"
                >
                  Explore all use cases →
                </Link>
              </div>
            </div>
          </section>

          {/* ── Why Grabio ── */}
          <section className="py-20 max-w-6xl mx-auto px-4 sm:px-6" aria-labelledby="why-heading">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 id="why-heading" className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                  One Platform. <br />No More Juggling.
                </h2>
                <p className="text-gray-500 text-lg mb-8 leading-relaxed">
                  Most small businesses run on 4–6 different tools that barely talk to each other. Grabio replaces the stack with one integrated platform — so your POS, inventory, invoices, and analytics all share the same data, without any manual syncing.
                </p>
                <ul className="space-y-3">
                  {[
                    'Sales automatically update inventory',
                    'Orders auto-generate professional invoices',
                    'Customer records build with every transaction',
                    'Reports update in real time — no manual exports',
                    'Multi-channel: in-store, online, and marketplace in one view',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-gray-700">
                      <Zap className="h-4 w-4 text-teal-500 mt-1 flex-shrink-0" />
                      <span className="text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/pricing"
                  className="mt-8 inline-flex items-center gap-2 px-6 py-3 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 transition-colors"
                >
                  See Pricing <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-3xl p-8 border border-teal-100">
                <div className="space-y-4">
                  {[
                    { label: 'Before Grabio', items: ['WhatsApp orders → lost in chat', 'Excel inventory → always outdated', 'Word invoices → slow & inconsistent', 'No data → decisions by instinct'], bg: 'bg-red-50 border-red-200 text-red-700' },
                    { label: 'With Grabio', items: ['Unified order queue → nothing missed', 'Live inventory → auto-updated on every sale', 'Instant professional invoices → shareable in seconds', 'Live analytics → decisions backed by data'], bg: 'bg-teal-50 border-teal-200 text-teal-700' },
                  ].map(({ label, items, bg }) => (
                    <div key={label}>
                      <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">{label}</p>
                      <ul className={`rounded-xl border p-4 space-y-1.5 ${bg}`}>
                        {items.map((item) => (
                          <li key={item} className="text-sm">{item}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── Blog Preview ── */}
          <section className="bg-gray-50 py-20" aria-labelledby="blog-preview-heading">
            <div className="max-w-6xl mx-auto px-4 sm:px-6">
              <div className="text-center mb-12">
                <h2 id="blog-preview-heading" className="text-3xl font-bold text-gray-900 mb-3">
                  Resources for Business Owners
                </h2>
                <p className="text-gray-500 max-w-xl mx-auto">
                  Practical guides on running a better business — no filler, no fluff.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {recentPosts.map((post) => (
                  <Link
                    key={post.slug}
                    to={`/blog/${post.slug}`}
                    className="group bg-white rounded-2xl border border-gray-200 hover:border-teal-300 hover:shadow-md transition-all overflow-hidden"
                  >
                    <div className="p-6">
                      <span className="text-xs font-semibold text-teal-600 bg-teal-50 px-2.5 py-1 rounded-full">
                        {post.category}
                      </span>
                      <h3 className="mt-3 font-semibold text-gray-900 leading-snug group-hover:text-teal-700 transition-colors line-clamp-2">
                        {post.title}
                      </h3>
                      <p className="mt-2 text-sm text-gray-500 line-clamp-2">{post.description}</p>
                      <p className="mt-4 text-xs text-gray-400">
                        {post.readingTime} min read · {new Date(post.publishedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>

              <div className="mt-10 text-center">
                <Link
                  to="/blog"
                  className="inline-flex items-center gap-2 text-sm font-medium text-teal-600 hover:text-teal-700"
                >
                  Read all articles <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </section>

          {/* ── Final CTA ── */}
          <section className="bg-gradient-to-br from-teal-600 to-cyan-700 text-white py-20" aria-labelledby="cta-heading">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
              <h2 id="cta-heading" className="text-3xl md:text-4xl font-extrabold mb-5">
                Start Running Your Business on Data
              </h2>
              <p className="text-lg text-teal-100 mb-10 leading-relaxed">
                Join hundreds of businesses that replaced disconnected tools with one platform. Free to start. No credit card required.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <AuthCTA
                  className="px-8 py-4 text-base font-semibold bg-white text-teal-700 rounded-xl hover:bg-teal-50 transition-colors shadow-lg"
                />
                <Link
                  to="/contact"
                  className="px-8 py-4 text-base font-semibold border-2 border-white/40 text-white rounded-xl hover:bg-white/10 transition-colors"
                >
                  Talk to Us
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

export default LandingPage;
