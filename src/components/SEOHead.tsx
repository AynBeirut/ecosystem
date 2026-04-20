import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOHeadProps {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'product' | 'article';
  price?: number;
  currency?: string;
  siteName?: string;
}

const DEFAULT_DESCRIPTION = 'Grabio – Discover and shop from local stores in Lebanon. Browse products, place orders, and support local businesses.';
const DEFAULT_IMAGE = 'https://grabio.space/og-image.png';
const SITE_NAME = 'Grabio';

const SEOHead: React.FC<SEOHeadProps> = ({
  title,
  description = DEFAULT_DESCRIPTION,
  image = DEFAULT_IMAGE,
  url,
  type = 'website',
  price,
  currency = 'USD',
  siteName = SITE_NAME,
}) => {
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
  const canonicalUrl = url || (typeof window !== 'undefined' ? window.location.href : 'https://grabio.space');

  const schema =
    type === 'product' && price !== undefined
      ? JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: title,
          description,
          image,
          offers: {
            '@type': 'Offer',
            price: price.toFixed(2),
            priceCurrency: currency,
            availability: 'https://schema.org/InStock',
          },
        })
      : JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: siteName,
          url: canonicalUrl,
          description,
        });

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content={type === 'product' ? 'product' : 'website'} />
      <meta property="og:site_name" content={siteName} />
      {type === 'product' && price !== undefined && (
        <meta property="og:price:amount" content={price.toFixed(2)} />
      )}
      {type === 'product' && (
        <meta property="og:price:currency" content={currency} />
      )}

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* Schema.org JSON-LD */}
      <script type="application/ld+json">{schema}</script>
    </Helmet>
  );
};

export default SEOHead;
