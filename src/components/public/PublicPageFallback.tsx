/** Suspense fallback that matches public marketing pages — reduces white flash on refresh. */
export default function PublicPageFallback() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="h-16 border-b border-gray-100 bg-white/95 shrink-0" aria-hidden />
      <div className="flex-1 bg-[#0b1220] min-h-[280px] shrink-0" aria-hidden />
      <div className="flex-1 bg-slate-50" aria-hidden />
    </div>
  );
}
