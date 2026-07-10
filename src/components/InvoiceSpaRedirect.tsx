import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Main Grabio SPA must not render /invoice/* — that path belongs to the invoice
 * PWA. If React Router catches it (e.g. legacy <Link to="/invoice/...">), force
 * a full navigation so Firebase serves /invoice/index.html.
 */
export default function InvoiceSpaRedirect() {
  const location = useLocation();

  useEffect(() => {
    const target = `${location.pathname}${location.search}${location.hash}`;
    window.location.replace(target);
  }, [location.pathname, location.search, location.hash]);

  return (
    <div className="min-h-[40vh] flex items-center justify-center text-sm text-muted-foreground">
      Opening Invoice Manager…
    </div>
  );
}
