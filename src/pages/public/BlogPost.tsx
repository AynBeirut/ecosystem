import React, { useEffect } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import AuthCTA from '@/components/public/AuthCTA';
import { ArrowLeft, ArrowRight, Clock, Calendar } from 'lucide-react';
import SEOHead from '@/components/SEOHead';
import { trackSEOEvent, trackUniqueVisit } from '@/lib/seoTracker';
import PublicNav from '@/components/public/PublicNav';
import PublicFooter from '@/components/public/PublicFooter';
import { BLOG_POSTS, getBlogPost, BlogSection } from '@/data/blog-posts';

const renderSection = (section: BlogSection, idx: number) => {
  switch (section.type) {
    case 'h2':
      return (
        <h2 key={idx} className="text-2xl font-bold text-gray-900 mt-10 mb-4">
          {section.content as string}
        </h2>
      );
    case 'h3':
      return (
        <h3 key={idx} className="text-xl font-semibold text-gray-800 mt-7 mb-3">
          {section.content as string}
        </h3>
      );
    case 'p':
      return (
        <p key={idx} className="text-gray-600 leading-relaxed mb-5">
          {section.content as string}
        </p>
      );
    case 'ul':
      return (
        <ul key={idx} className="list-none space-y-2 mb-6 pl-1">
          {(section.content as string[]).map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-gray-600">
              <span className="w-1.5 h-1.5 bg-teal-500 rounded-full mt-2 flex-shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol key={idx} className="space-y-2 mb-6 pl-1">
          {(section.content as string[]).map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-gray-600">
              <span className="flex-shrink-0 w-6 h-6 bg-teal-100 text-teal-700 text-xs font-bold rounded-full flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              {item}
            </li>
          ))}
        </ol>
      );
    default:
      return null;
  }
};

const BlogPost: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getBlogPost(slug) : undefined;

  useEffect(() => {
    if (!post) return;
    trackSEOEvent('page_view');
    trackUniqueVisit();
  }, [post]);

  if (!post) return <Navigate to="/blog" replace />;

  const postIndex = BLOG_POSTS.findIndex((p) => p.slug === slug);
  const prevPost = postIndex > 0 ? BLOG_POSTS[postIndex - 1] : null;
  const nextPost = postIndex < BLOG_POSTS.length - 1 ? BLOG_POSTS[postIndex + 1] : null;

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    url: `https://grabio.space/blog/${post.slug}`,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    author: {
      '@type': 'Organization',
      name: post.author,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Grabio',
      logo: {
        '@type': 'ImageObject',
        url: 'https://grabio.space/icon-512x512.png',
      },
    },
    keywords: post.tags.join(', '),
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://grabio.space/blog/${post.slug}`,
    },
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://grabio.space' },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://grabio.space/blog' },
      { '@type': 'ListItem', position: 3, name: post.title, item: `https://grabio.space/blog/${post.slug}` },
    ],
  };

  return (
    <>
      <SEOHead
        title={post.title}
        description={post.description}
        url={`/blog/${post.slug}`}
        type="article"
        keywords={post.tags}
        structuredData={[articleSchema, breadcrumbSchema]}
      />

      <div className="flex flex-col min-h-screen bg-white">
        <PublicNav />

        <main className="flex-1">
          {/* ── Header ── */}
          <section className="bg-gray-50 border-b border-gray-100 py-12">
            <div className="max-w-3xl mx-auto px-4 sm:px-6">
              {/* Breadcrumb */}
              <nav aria-label="Breadcrumb" className="mb-6">
                <ol className="flex items-center gap-2 text-sm text-gray-400 list-none p-0 m-0">
                  <li><Link to="/" className="hover:text-gray-600">Home</Link></li>
                  <li>/</li>
                  <li><Link to="/blog" className="hover:text-gray-600">Blog</Link></li>
                  <li>/</li>
                  <li className="text-gray-600 truncate max-w-xs">{post.title}</li>
                </ol>
              </nav>

              <span className="text-xs font-semibold text-teal-600 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-full">
                {post.category}
              </span>
              <h1 className="mt-4 text-3xl md:text-4xl font-extrabold text-gray-900 leading-tight">
                {post.title}
              </h1>
              <p className="mt-4 text-lg text-gray-500 leading-relaxed">{post.description}</p>

              <div className="mt-6 flex flex-wrap items-center gap-5 text-sm text-gray-400">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {post.readingTime} min read
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {new Date(post.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
                <span>By {post.author}</span>
              </div>
            </div>
          </section>

          {/* ── Article body ── */}
          <article className="max-w-3xl mx-auto px-4 sm:px-6 py-12" aria-label={post.title}>
            <div className="prose-like">
              {post.sections.map((section, idx) => renderSection(section, idx))}
            </div>

            {/* Tags */}
            <div className="mt-12 pt-8 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Topics</p>
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <span key={tag} className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full border border-gray-200">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Related links */}
            {post.relatedLinks.length > 0 && (
              <div className="mt-8 p-6 bg-teal-50 rounded-2xl border border-teal-100">
                <p className="font-semibold text-gray-900 mb-3">Related from Grabio</p>
                <ul className="space-y-2 list-none p-0 m-0">
                  {post.relatedLinks.map(({ label, href }) => (
                    <li key={href}>
                      <Link
                        to={href}
                        className="inline-flex items-center gap-2 text-sm text-teal-700 hover:text-teal-800 font-medium"
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>

          {/* ── Post navigation ── */}
          <nav
            aria-label="Article navigation"
            className="max-w-3xl mx-auto px-4 sm:px-6 pb-12 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-100 pt-8"
          >
            {prevPost && (
              <Link
                to={`/blog/${prevPost.slug}`}
                className="group flex flex-col p-4 rounded-xl border border-gray-200 hover:border-teal-300 hover:bg-teal-50 transition-all"
              >
                <span className="flex items-center gap-1 text-xs text-gray-400 mb-2">
                  <ArrowLeft className="h-3 w-3" /> Previous
                </span>
                <span className="text-sm font-semibold text-gray-800 group-hover:text-teal-700 transition-colors line-clamp-2">
                  {prevPost.title}
                </span>
              </Link>
            )}
            {nextPost && (
              <Link
                to={`/blog/${nextPost.slug}`}
                className={`group flex flex-col p-4 rounded-xl border border-gray-200 hover:border-teal-300 hover:bg-teal-50 transition-all ${!prevPost ? 'sm:col-start-2' : ''}`}
              >
                <span className="flex items-center justify-end gap-1 text-xs text-gray-400 mb-2">
                  Next <ArrowRight className="h-3 w-3" />
                </span>
                <span className="text-sm font-semibold text-gray-800 group-hover:text-teal-700 transition-colors line-clamp-2 text-right">
                  {nextPost.title}
                </span>
              </Link>
            )}
          </nav>

          {/* ── CTA ── */}
          <section className="bg-gradient-to-br from-teal-600 to-cyan-700 py-14">
            <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center text-white">
              <h2 className="text-2xl font-bold mb-3">Put This Into Practice</h2>
              <p className="text-teal-100 mb-7 text-sm leading-relaxed">
                Grabio gives you the tools described in this guide — POS, inventory, invoicing, and more — in one integrated platform.
              </p>
              <AuthCTA
                className="px-6 py-3 bg-white text-teal-700 font-semibold rounded-xl hover:bg-teal-50 transition-colors"
              />
            </div>
          </section>

          {/* ── More articles ── */}
          <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
            <h2 className="text-xl font-bold text-gray-900 mb-6">More Articles</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {BLOG_POSTS.filter((p) => p.slug !== slug)
                .slice(0, 3)
                .map((p) => (
                  <Link
                    key={p.slug}
                    to={`/blog/${p.slug}`}
                    className="group p-5 rounded-xl border border-gray-200 hover:border-teal-300 hover:shadow-sm transition-all"
                  >
                    <span className="text-xs font-semibold text-teal-600">{p.category}</span>
                    <h3 className="mt-2 text-sm font-semibold text-gray-900 group-hover:text-teal-700 transition-colors line-clamp-2 leading-snug">
                      {p.title}
                    </h3>
                    <p className="mt-1 text-xs text-gray-400">{p.readingTime} min read</p>
                  </Link>
                ))}
            </div>
          </section>
        </main>

        <PublicFooter />
      </div>
    </>
  );
};

export default BlogPost;
