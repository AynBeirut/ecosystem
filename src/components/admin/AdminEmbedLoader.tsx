import { cn } from '@/lib/utils';

type AdminEmbedLoaderProps = {
  label?: string;
  compact?: boolean;
  className?: string;
};

/** Mercedes-style inline loader for admin embeds and lazy routes. */
export default function AdminEmbedLoader({
  label = 'Loading…',
  compact = false,
  className,
}: AdminEmbedLoaderProps) {
  return (
    <div
      className={cn(
        'admin-embed-loader',
        compact && 'admin-embed-loader--compact',
        className,
      )}
      aria-busy="true"
      aria-label={label}
    >
      <div className="admin-embed-loader__ring" aria-hidden>
        <div className="admin-embed-loader__core" />
      </div>
      <p className="admin-embed-loader__label">{label}</p>
    </div>
  );
}
