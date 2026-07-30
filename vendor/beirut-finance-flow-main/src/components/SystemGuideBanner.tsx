import { Info } from 'lucide-react';

type SystemGuideBannerProps = {
  enabled: boolean;
};

export default function SystemGuideBanner({ enabled }: SystemGuideBannerProps) {
  if (!enabled) return null;

  return (
    <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p>
        <strong>Help mode is on.</strong> Click the small{' '}
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-current/30 align-middle text-[10px]">
          i
        </span>{' '}
        icons next to titles for plain-language explanations of each section.
      </p>
    </div>
  );
}
