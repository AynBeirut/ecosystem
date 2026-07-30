import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AuthCTA from '@/components/public/AuthCTA';
import { ArrowRight, Clock } from 'lucide-react';
import PublicPageShell from '@/components/public/PublicPageShell';
import { cn } from '@/lib/utils';
import { trackSEOEvent, trackUniqueVisit } from '@/lib/seoTracker';
import { BLOG_POSTS, BLOG_CATEGORIES } from '@/data/blog-posts';

const MODULE_LINKS = [
  { label: 'Platform modules', href: '/features#platform-features' },
  { label: 'Mobile & desktop apps', href: '/features#apps-features' },
  { label: 'AI growth tools', href: '/features#ai-features' },
  { label: 'Build your package', href: '/pricing' },
];

const Blog: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<string>('All');

  useEffect(() => {
    trackSEOEvent('page_view');
    trackUniqueVisit();
  }, []);

  const categories = ['All', ...BLOG_CATEGORIES];
  const filtered =
    activeCategory === 'All' ? BLOG_POSTS : BLOG_POSTS.filter((p) => p.category === activeCategory);

  const featured = BLOG_POSTS[BLOG_POSTS.length - 1];

  return (
    <PublicPageShell
      title="Grabio Blog — Modular Commerce, CRM, and Operations Guides"
      description="Practical guides on modular business platforms, inventory, invoicing, CRM, and AI tools — for owners building on Grabio."
      url="/blog"
      keywords={[
        'Grabio blog',
        'business management guides',
        'Sales CRM tips',
        'inventory management',
        'small business operations',
      ]}
      eyebrow="Resource center"
      heroTitle="Business operations guides"
      heroDescription="Practical guides for modular commerce — inventory, invoicing, CRM, and growth on one platform."
      subnav={MODULE_LINKS}
    >
      <Link
        to={`/blog/${featured.slug}`}
        className="public-panel group grid gap-6 md:grid-cols-5 hover:border-teal-300 transition-all"
      >
        <div className="md:col-span-3">
          <span className="inline-flex rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700">
            Latest · {featured.category}
          </span>
          <h2 className="mt-4 text-2xl md:text-3xl font-bold text-slate-900 leading-tight group-hover:text-teal-700 transition-colors">
            {featured.title}
          </h2>
          <p className="mt-3 text-slate-600 leading-relaxed">{featured.description}</p>
          <div className="mt-5 flex items-center gap-4 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {featured.readingTime} min read
            </span>
            <span>
              {new Date(featured.publishedAt).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>
        <div className="md:col-span-2 flex items-center justify-end">
          <span className="inline-flex items-center gap-2 font-semibold text-teal-600 group-hover:gap-3 transition-all">
            Read article <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </Link>

      <div className="public-panel">
        <div className="public-subnav mb-6" role="navigation" aria-label="Blog categories">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={cn('public-subnav-link', activeCategory === cat && 'public-subnav-link-active')}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((post) => (
            <Link
              key={post.slug}
              to={`/blog/${post.slug}`}
              className="group flex flex-col rounded-2xl border border-slate-200 bg-slate-50/30 p-5 hover:border-teal-300 hover:bg-white transition-all"
            >
              <span className="w-fit rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700">
                {post.category}
              </span>
              <h2 className="mt-3 font-bold text-slate-900 leading-snug group-hover:text-teal-700 transition-colors line-clamp-2">
                {post.title}
              </h2>
              <p className="mt-2 text-sm text-slate-600 line-clamp-3 flex-1">{post.description}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {post.tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-500"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {post.readingTime} min
                </span>
                <span>
                  {new Date(post.publishedAt).toLocaleDateString('en-US', {
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <section className="public-panel text-center">
        <h2 className="text-xl font-bold text-slate-900 mb-3">Ready to put this into practice?</h2>
        <p className="text-slate-600 text-sm mb-6">
          Start with core platform features, then toggle CRM, apps, and AI tools as you grow.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <AuthCTA className="px-6 py-3 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 transition-colors" />
          <Link
            to="/pricing"
            className="px-6 py-3 border border-slate-300 text-slate-700 font-semibold rounded-xl hover:border-slate-400 transition-colors"
          >
            Build your package
          </Link>
        </div>
      </section>
    </PublicPageShell>
  );
};

export default Blog;
