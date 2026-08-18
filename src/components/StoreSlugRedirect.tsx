import React, { useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import PublicPageFallback from '@/components/public/PublicPageFallback';
import { buildStorePublicUrl } from '@/lib/storeUrls';

/** Redirect legacy grabio.space/{slug} URLs to {slug}.grabio.space */
const StoreSlugRedirect: React.FC = () => {
  const location = useLocation();
  const { slug, categorySlug, productSlug, storeSlug } = useParams<{
    slug?: string;
    categorySlug?: string;
    productSlug?: string;
    storeSlug?: string;
  }>();

  useEffect(() => {
    const storeKey = slug || storeSlug;
    if (!storeKey) return;

    let path = '/';
    if (productSlug) path = `/product/${productSlug}`;
    else if (categorySlug) path = `/category/${categorySlug}`;
    else if (location.pathname.includes('/products')) path = '/products';

    window.location.replace(buildStorePublicUrl(storeKey, path));
  }, [slug, storeSlug, categorySlug, productSlug, location.pathname]);

  return <PublicPageFallback />;
};

export default StoreSlugRedirect;
