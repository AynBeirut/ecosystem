import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import AuthCTA from '@/components/public/AuthCTA';
import {
  ShoppingCart, Package, FileText, BarChart2, Users, Truck,
  Building2, CreditCard, ShieldCheck, Smartphone, Layers, Repeat,
  ArrowRight,
} from 'lucide-react';
import SEOHead from '@/components/SEOHead';
import { trackSEOEvent, trackUniqueVisit } from '@/lib/seoTracker';
import PublicNav from '@/components/public/PublicNav';
import PublicFooter from '@/components/public/PublicFooter';

const FEATURE_GROUPS = [
  {
    id: 'pos',
    icon: ShoppingCart,
    title: 'Point of Sale (POS)',
    badge: 'Core',
    description:
      'A fast, reliable POS system built for real retail environments — from neighborhood shops to multi-counter operations.',
    items: [
      'Barcode scanning and product search',
      'Multi-payment methods: cash, card, mobile',
      'Split payments and partial payments',
      'Offline mode — keeps working without internet',
      'Role-based staff access (cashier, manager, admin)',
      'Digital and printed receipts',
      'Discount and promotion application',
      'Dual-currency display (USD + local currency)',
      'Returns and exchanges processing',
    ],
  },
  {
    id: 'inventory',
    icon: Package,
    title: 'Inventory Management',
    badge: 'Core',
    description:
      'Track every unit across your entire operation — from raw materials to finished goods, with full production support.',
    items: [
      'Real-time stock levels updated on every sale',
      'Low-stock alerts and reorder point configuration',
      'Raw materials management with expiry tracking',
      'Recipe-based production (batch manufacturing)',
      'Finished goods tracking with cost valuation',
      'FIFO / LIFO / Weighted-average costing',
      'Purchase orders and supplier management',
      'Stock adjustment with full audit trail',
      'Multi-location inventory visibility',
    ],
  },
  {
    id: 'invoicing',
    icon: FileText,
    title: 'Invoicing & Billing',
    badge: 'Core',
    description:
      'Generate professional, branded invoices in seconds. Track payment status and recover overdue amounts without manual follow-up.',
    items: [
      'One-click invoice generation from orders',
      'Custom branding: logo, colors, business details',
      'Tax and discount configuration per line item',
      'PDF export and shareable invoice links',
      'WhatsApp and email delivery',
      'Payment status tracking (sent / viewed / paid / overdue)',
      'Partial payment recording',
      'Customer payment history',
      'Supplier invoice management',
    ],
  },
  {
    id: 'marketplace',
    icon: Building2,
    title: 'Online Marketplace',
    badge: 'Commerce',
    description:
      'Your store goes live on the Grabio marketplace the moment you publish it — with its own storefront, product pages, and order management.',
    items: [
      'Dedicated store page with custom template',
      'Product catalog with images, categories, and search',
      'Customer-facing order tracking',
      'Delivery address and GPS coordinate capture',
      'Custom store domain support',
      'Store announcements and promotions',
      'Product reviews and ratings',
      'Multi-vendor marketplace exposure',
      'Marketplace-to-POS inventory sync',
    ],
  },
  {
    id: 'analytics',
    icon: BarChart2,
    title: 'Analytics & Reporting',
    badge: 'Intelligence',
    description:
      'Understand your business with live dashboards and detailed reports — no exports, no manual aggregation.',
    items: [
      'Daily, weekly, and monthly revenue reports',
      'Sales by product, category, and staff member',
      'Customer purchase behavior analysis',
      'Inventory value and turnover reports',
      'Expense tracking and margin analysis',
      'Audit logs for all system actions',
      'Bank reconciliation tools',
      'Custom date-range filtering',
      'Exportable financial statements',
    ],
  },
  {
    id: 'team',
    icon: Users,
    title: 'Customer & Staff Management',
    badge: 'Operations',
    description:
      'Manage your team, control access, and build customer relationships — all in one place.',
    items: [
      'Customer profiles with full order history',
      'Staff accounts with role-based permissions',
      'Sub-account management for multi-user operations',
      'Salary and HR tracking',
      'Staff performance visibility by sales',
      'Customer segmentation and history',
      'CRM-ready contact management',
      'Access control: what each role can see and do',
    ],
  },
  {
    id: 'payments',
    icon: CreditCard,
    title: 'Payments & Finance',
    badge: 'Finance',
    description:
      'Track every dirham and dollar — from incoming revenue to outgoing expenses and supplier payments.',
    items: [
      'Multi-currency support',
      'Custom USD/local currency exchange rates',
      'Expense tracking by category',
      'Supplier payment terms and credit management',
      'Account statement generation',
      'Revenue vs. expense dashboards',
      'Cash collection tracking',
      'Finance suite with full P&L visibility',
    ],
  },
  {
    id: 'delivery',
    icon: Truck,
    title: 'Delivery & Fulfillment',
    badge: 'Logistics',
    description:
      'Manage deliveries from order to door — with GPS tracking, status updates, and customer notifications.',
    items: [
      'Delivery status management (pending → out for delivery → delivered)',
      'GPS coordinate capture from customers',
      'Delivery staff assignment',
      'Customer delivery notifications',
      'Order confirmation workflows',
      'Guest order tracking (no account required)',
      'Delivery zone management',
    ],
  },
];

const TECHNICAL = [
  { icon: Smartphone, title: 'Mobile-First Design', desc: 'Works flawlessly on phones, tablets, and desktops.' },
  { icon: ShieldCheck, title: 'Secure by Default', desc: 'Role-based access, Firebase Authentication, and audit logging.' },
  { icon: Layers, title: 'Offline Mode', desc: 'POS continues operating during internet outages.' },
  { icon: Repeat, title: 'Real-Time Sync', desc: 'All data syncs instantly across devices and users.' },
];

const Features: React.FC = () => {
  useEffect(() => {
    trackSEOEvent('page_view');
    trackUniqueVisit();
  }, []);

  return (
  <>
    <SEOHead
      title="Grabio Features — POS, Inventory, Invoicing, and Marketplace"
      description="Explore all Grabio features: point of sale, real-time inventory management, professional invoicing, multi-vendor marketplace, analytics, and more for small businesses."
      url="/features"
      keywords={[
        'business management software features',
        'POS system features',
        'inventory management software',
        'invoicing platform',
        'multi-vendor marketplace',
      ]}
    />

    <div className="flex flex-col min-h-screen bg-white">
      <PublicNav />

      <main>
        {/* ── Hero ── */}
        <section className="bg-gradient-to-br from-gray-900 to-gray-800 text-white py-16 md:py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
            <h1 className="text-4xl md:text-5xl font-extrabold mb-5">
              Everything in One Platform
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Grabio replaces the stack of disconnected tools small businesses run on. POS, inventory, invoicing, marketplace, analytics — all sharing the same data.
            </p>
            <div className="flex flex-wrap gap-3 justify-center mt-8">
              {FEATURE_GROUPS.map((g) => (
                <a
                  key={g.id}
                  href={`#${g.id}`}
                  className="px-4 py-2 text-sm font-medium bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                >
                  {g.title}
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* ── Feature Groups ── */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 space-y-20">
          {FEATURE_GROUPS.map(({ id, icon: Icon, title, badge, description, items }) => (
            <div key={id} id={id} className="scroll-mt-20">
              <div className="grid md:grid-cols-5 gap-8 items-start">
                <div className="md:col-span-2">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-semibold text-teal-600 bg-teal-50 px-2.5 py-1 rounded-full">{badge}</span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">{title}</h2>
                  <p className="text-gray-500 leading-relaxed">{description}</p>
                  <Link
                    to="/pricing"
                    className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-teal-600 hover:text-teal-700"
                  >
                    See plans that include this <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                <div className="md:col-span-3">
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {items.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2.5 text-sm text-gray-700 p-3 rounded-lg bg-gray-50 border border-gray-100"
                      >
                        <span className="w-1.5 h-1.5 bg-teal-500 rounded-full mt-1.5 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* ── Technical specs ── */}
        <section className="bg-gray-50 py-16 border-t border-gray-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Platform Capabilities</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {TECHNICAL.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="text-center p-6 bg-white rounded-2xl border border-gray-200">
                  <Icon className="h-7 w-7 text-teal-600 mx-auto mb-3" />
                  <p className="font-semibold text-gray-900 text-sm mb-1">{title}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="py-16 text-center max-w-3xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Ready to replace your tool stack?</h2>
          <p className="text-gray-500 mb-8">Start free. No credit card required. Full features available immediately.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <AuthCTA className="px-8 py-4 font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors" />
            <Link to="/pricing" className="px-8 py-4 font-semibold text-gray-700 border border-gray-300 hover:border-gray-400 rounded-xl transition-colors">
              View Pricing
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  </>
  );
};

export default Features;
