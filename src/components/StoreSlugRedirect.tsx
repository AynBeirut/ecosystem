import React, { useEffect } from 'react';
import { useLocation, useParams, Navigate } from 'react-router-dom';
import PublicPageFallback from '@/components/public/PublicPageFallback';
import { PLATFORM_ROUTE_SLUGS } from '@/lib/platformHosts';
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

  const storeKey = slug || storeSlug;
  const isReserved = Boolean(storeKey && PLATFORM_ROUTE_SLUGS.has(storeKey.toLowerCase()));

  useEffect(() => {
    if (isReserved || !storeKey) return;

    let path = '/';
    if (productSlug) path = `/product/${productSlug}`;
    else if (categorySlug) path = `/category/${categorySlug}`;
    else if (location.pathname.includes('/products')) path = '/products';

    window.location.replace(buildStorePublicUrl(storeKey, path));
  }, [storeKey, isReserved, categorySlug, productSlug, location.pathname]);

  if (isReserved) {
    return <Navigate to="/" replace />;
  }

  return <PublicPageFallback />;
};

export default StoreSlugRedirect;
