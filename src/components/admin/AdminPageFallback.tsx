import AdminEmbedLoader from '@/components/admin/AdminEmbedLoader';

/** In-layout fallback while a lazy admin page chunk loads — keeps sidebar visible. */
export default function AdminPageFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center py-12">
      <AdminEmbedLoader label="Loading workspace…" />
    </div>
  );
}
