/** In-layout fallback while a lazy admin page chunk loads — keeps sidebar visible. */
export default function AdminPageFallback() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading page">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 space-y-3">
        <div className="h-3 w-28 rounded bg-slate-200" />
        <div className="h-8 w-72 max-w-full rounded bg-slate-200" />
        <div className="h-4 w-full max-w-md rounded bg-slate-100" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl border border-slate-200/80 bg-white" />
        ))}
      </div>
      <div className="h-64 rounded-2xl border border-slate-200/80 bg-white" />
    </div>
  );
}
