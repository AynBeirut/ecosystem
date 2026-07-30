import AdminEmbedLoader from '@/components/admin/AdminEmbedLoader';

/** Inline loader for finance embed — used by legacy Suspense boundaries. */
export default function FinanceEmbedFallback() {
  return <AdminEmbedLoader label="Opening module…" compact />;
}
