/** Suspense fallback that matches public marketing pages — reduces flash on refresh. */
export default function PublicPageFallback() {
  return (
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col">
      <div className="h-16 border-b border-slate-200/80 bg-[#f5f5f7]/90 shrink-0" aria-hidden />
      <div className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 pt-6">
        <div className="rounded-3xl border border-slate-200/80 bg-white min-h-[220px] shadow-sm" aria-hidden />
      </div>
    </div>
  );
}
