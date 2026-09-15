import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import PublicNav from '@/components/public/PublicNav';
import PublicFooter from '@/components/public/PublicFooter';
import SEOHead from '@/components/SEOHead';
import HomeHero from '@/components/marketing/HomeHero';
import PackageSelectorGrid from '@/components/marketing/PackageSelectorGrid';
import AuthCTA from '@/components/public/AuthCTA';
import HomeVenueHighlights from '@/components/marketing/HomeVenueHighlights';
import HomePlatformExtras from '@/components/marketing/HomePlatformExtras';
import HomeMaintainedWorkflows from '@/components/marketing/HomeMaintainedWorkflows';
import { useAuth } from '@/context/useAuth';
import { trackSEOEvent, trackUniqueVisit } from '@/lib/seoTracker';
import { BLOG_POSTS } from '@/data/blog-posts';

const ModularHome: React.FC = () => {
  const { user, isLoading } = useAuth();
  const recentPosts = BLOG_POSTS.slice(0, 3);

  const dashboardPath =
    user?.role === 'crm_rep'
      ? '/team/crm'
      : user?.role === 'sub_account'
        ? '/team/dashboard'
        : '/admin/dashboard';

  useEffect(() => {
    trackSEOEvent('page_view');
    trackUniqueVisit();
  }, []);

  return (
    <>
      <SEOHead
        title="Fine Dining & Restaurant Operations Software | Grabio"
        description="Grabio helps fine dining and full-service venues run floor service, reservations, guest CRM, kitchen flow, and POS on one platform — optional inventory and finance when you need them."
        url="/"
        keywords={[
          'fine dining restaurant software',
          'restaurant POS and reservations',
          'restaurant CRM and guest management',
          'live kitchen operations software',
          'restaurant food cost software',
          'venue operations platform',
          'Grabio restaurant',
        ]}
      />

      <div className="marketing-home">
        <PublicNav />

        <main className="flex-1">
          <HomeHero />
          <PackageSelectorGrid />

          <div className="mx-auto max-w-6xl space-y-8 px-4 pb-14 pt-10 sm:px-6 md:pb-16">
            <HomeVenueHighlights />

            <HomePlatformExtras />

            <section className="marketing-platform-band">
              <div className="marketing-section-head mb-6">
                <p className="marketing-section-eyebrow">Resources</p>
                <h2 className="marketing-section-title">Guides for restaurant operators</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {recentPosts.map((post) => (
                  <Link key={post.slug} to={`/blog/${post.slug}`} className="marketing-blog-card group">
                    <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-teal-700">
                      {post.category}
                    </span>
                    <h3 className="mt-3 line-clamp-2 text-sm font-semibold text-slate-900 group-hover:text-teal-900">
                      {post.title}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-500">{post.excerpt}</p>
                  </Link>
                ))}
              </div>
            </section>

            <HomeMaintainedWorkflows />

            <section className="marketing-cta-band">
              <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl">Ready when you are</h2>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-slate-300 md:text-base">
                Explore the fine dining demo or start a Live Kitchen workspace.
              </p>
              <div className="mt-7 flex min-h-[44px] flex-col justify-center gap-3 sm:flex-row">
                {isLoading ? (
                  <div className="mx-auto h-11 w-48 animate-pulse rounded-xl bg-white/10" aria-hidden />
                ) : user ? (
                  <Link
                    to={dashboardPath}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                  >
                    Go to Dashboard
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <AuthCTA className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100" />
                )}
                <Link
                  to="/contact"
                  className="rounded-xl border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/5"
                >
                  Talk to us
                </Link>
              </div>
            </section>
          </div>
        </main>

        <PublicFooter />
      </div>
    </>
  );
};

export default ModularHome;
