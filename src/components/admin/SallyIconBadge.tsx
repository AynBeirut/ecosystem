import React from 'react';
import { cn } from '@/lib/utils';
import SallyAvatar, { SALLY_AVATAR_SRC } from '@/components/admin/SallyAvatar';

type Props = {
  size?: 'nav' | 'tile' | 'fab';
  className?: string;
  showLabel?: boolean;
};

/** Cute Sally avatar — matches the floating FAB styling at smaller sizes. */
const SallyIconBadge: React.FC<Props> = ({ size = 'nav', className, showLabel = false }) => {
  if (size === 'fab') {
    return (
      <div className={cn('relative inline-flex', className)}>
        <span className="pointer-events-none absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pink-400 opacity-70" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-pink-500 ring-2 ring-background" />
        </span>
        <div className="rounded-full bg-gradient-to-br from-teal-400 via-teal-500 to-emerald-600 p-[3px] shadow-lg ring-4 ring-teal-500/25">
          <SallyAvatar size="fab" ring={false} className="ring-2 ring-white" />
        </div>
        {showLabel ? (
          <span className="pointer-events-none absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-white px-1.5 py-px text-[8px] font-semibold text-teal-700 shadow ring-1 ring-teal-200">
            Sally
          </span>
        ) : null}
      </div>
    );
  }

  if (size === 'tile') {
    return (
      <div
        className={cn(
          'relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 via-teal-500 to-emerald-600 p-[2px] shadow-md',
          className,
        )}
      >
        <img src={SALLY_AVATAR_SRC} alt="" className="h-full w-full rounded-full object-cover ring-2 ring-white" />
      </div>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-emerald-600 p-[2px] shadow-sm',
        className,
      )}
      aria-hidden
    >
      <img src={SALLY_AVATAR_SRC} alt="" className="h-full w-full rounded-full object-cover ring-1 ring-white" />
    </span>
  );
};

/** Lucide-compatible nav icon (sidebar). */
export function SallyNavIcon({ className }: { className?: string }) {
  return <SallyIconBadge size="nav" className={className} />;
}

export default SallyIconBadge;
