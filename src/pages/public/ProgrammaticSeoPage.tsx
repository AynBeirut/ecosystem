import React, { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import PublicPageShell from '@/components/public/PublicPageShell';
import AuthCTA from '@/components/public/AuthCTA';
import { getPublishedProgPage, type ProgGeneratedPage } from '@/lib/seoProgrammatic';
import { trackSEOEvent, trackUniqueVisit } from '@/lib/seoTracker';

const ProgrammaticSeoPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<ProgGeneratedPage | null | undefined>(undefined);

  useEffect(() => {
    if (!slug) return;
    void getPublishedProgPage(slug).then(setPage);
  }, [slug]);

  useEffect(() => {
    if (!page) return;
    trackSEOEvent('page_view', { page_path: `/pages/${page.slug}` });
    trackUniqueVisit();
  }, [page]);

  if (!slug) return <Navigate to="/" replace />;
  if (page === undefined) {
    return <div className="min-h-[40vh] flex items-center justify-center text-gray-500">Loading…</div>;
  }
  if (!page) return <Navigate to="/" replace />;

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: page.title,
        description: page.metaDescription,
        url: page.canonicalUrl,
      },
      page.faqSchema,
    ],
  };

  return (
    <PublicPageShell
      title={page.title}
      description={page.metaDescription}
      url={`/pages/${page.slug}`}
      structuredData={structuredData}
      eyebrow="Grabio local software"
      heroTitle={page.h1}
      heroDescription={page.metaDescription}
      heroActions={<AuthCTA className="inline-flex items-center px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700" />}
    >
      <section className="public-panel mb-8 prose prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: page.bodyHtml }} />
      <section className="public-panel prose prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: page.faqHtml }} />
    </PublicPageShell>
  );
};

export default ProgrammaticSeoPage;
