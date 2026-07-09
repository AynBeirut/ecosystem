import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AuthCTA from '@/components/public/AuthCTA';
import { ArrowRight, Clock } from 'lucide-react';
import SEOHead from '@/components/SEOHead';
import { trackSEOEvent, trackUniqueVisit } from '@/lib/seoTracker';
import PublicNav from '@/components/public/PublicNav';
import PublicFooter from '@/components/public/PublicFooter';
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
    <>
      <SEOHead
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
      />

      <div className="flex flex-col min-h-screen bg-white">
        <PublicNav />

        <main>
          <section className="bg-gradient-to-br from-teal-600 to-cyan-800 text-white py-14">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
              <h1 className="text-4xl md:text-5xl font-extrabold mb-4">Business Operations Resource Center</h1>
              <p className="text-lg text-teal-100 mb-2">Practical guides for modular commerce.</p>
              <p className="text-teal-200/90 max-w-2xl mx-auto">
                Learn how to run inventory, invoicing, CRM, and growth — on one platform with installable
                modules.
              </p>
            </div>
          </section>

          <section className="border-b border-gray-100 bg-gray-50">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
              <div className="flex flex-wrap gap-2 justify-center">
                {MODULE_LINKS.map(({ label, href }) => (
                  <Link
                    key={href}
                    to={href}
                    className="text-xs font-medium px-3 py-1.5 rounded-full bg-white border border-gray-200 text-teal-700 hover:border-teal-300 hover:bg-teal-50"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-4">
            <Link
              to={`/blog/${featured.slug}`}
              className="group grid md:grid-cols-5 gap-6 bg-gradient-to-br from-teal-50 to-cyan-50 rounded-3xl border border-teal-100 p-8 hover:shadow-md transition-all"
            >
              <div className="md:col-span-3">
                <span className="text-xs font-semibold text-teal-600 bg-white border border-teal-200 px-2.5 py-1 rounded-full">
                  Latest · {featured.category}
                </span>
                <h2 className="mt-4 text-2xl md:text-3xl font-bold text-gray-900 leading-tight group-hover:text-teal-700 transition-colors">
                  {featured.title}
                </h2>
                <p className="mt-3 text-gray-600 leading-relaxed">{featured.description}</p>
                <div className="mt-5 flex items-center gap-4">
                  <span className="inline-flex items-center gap-1.5 text-sm text-gray-500">
                    <Clock className="h-3.5 w-3.5" />
                    {featured.readingTime} min read
                  </span>
                  <span className="text-sm text-gray-400">
                    {new Date(featured.publishedAt).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>
              <div className="md:col-span-2 flex items-center justify-end">
                <span className="inline-flex items-center gap-2 text-teal-600 font-semibold group-hover:gap-3 transition-all">
                  Read article <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
          </section>

          <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
            <div className="flex flex-wrap gap-2" role="navigation" aria-label="Blog categories">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    activeCategory === cat
                      ? 'bg-teal-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </section>

          <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((post) => (
                <Link
                  key={post.slug}
                  to={`/blog/${post.slug}`}
                  className="group flex flex-col bg-white rounded-2xl border border-gray-200 hover:border-teal-300 hover:shadow-md transition-all overflow-hidden"
                >
                  <div className="p-6 flex flex-col flex-1">
                    <span className="text-xs font-semibold text-teal-600 bg-teal-50 px-2.5 py-1 rounded-full w-fit">
                      {post.category}
                    </span>
                    <h2 className="mt-3 font-bold text-gray-900 leading-snug group-hover:text-teal-700 transition-colors line-clamp-2">
                      {post.title}
                    </h2>
                    <p className="mt-2 text-sm text-gray-500 line-clamp-3 flex-1">{post.description}</p>

                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {post.tags.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="text-xs text-gray-400 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="h-3 w-3" />
                        {post.readingTime} min read
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(post.publishedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="bg-gray-50 border-t border-gray-100 py-12 text-center">
            <div className="max-w-xl mx-auto px-4 sm:px-6">
              <h2 className="text-xl font-bold text-gray-900 mb-3">Ready to put this into practice?</h2>
              <p className="text-gray-500 text-sm mb-6">
                Start with core platform features, then toggle CRM, apps, and AI tools as you grow.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <AuthCTA className="px-6 py-3 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 transition-colors" />
                <Link
                  to="/pricing"
                  className="px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:border-gray-400 transition-colors"
                >
                  Build your package
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

export default Blog;
