import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { useAuth } from '@/context/useAuth';
import GrabioGuideChat from '@/components/admin/GrabioGuideChat';
import SallyIconBadge, { SallyNavIcon } from '@/components/admin/SallyIconBadge';
import { cn } from '@/lib/utils';

const GrabioGuideFloating: React.FC = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user || user.role !== 'admin') return null;

  return (
    <>
      {open ? (
        <div
          className={cn(
            'fixed z-[60] flex flex-col rounded-2xl border border-border/80 bg-background shadow-2xl',
            'bottom-24 right-4 w-[min(calc(100vw-2rem),24rem)] max-h-[min(80vh,640px)]',
            'animate-in fade-in slide-in-from-bottom-4 duration-200',
          )}
          role="dialog"
          aria-label="Sally — Grabio assistant"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3 bg-gradient-to-r from-teal-500/5 to-pink-500/5">
            <div className="flex items-center gap-2.5 min-w-0">
              <SallyIconBadge size="tile" />
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">Sally</p>
                <p className="text-[11px] text-muted-foreground truncate">Setup · modules · pricing</p>
              </div>
            </div>
            <button
              type="button"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition"
              aria-label="Close Sally"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <GrabioGuideChat compact className="flex-1 min-h-[320px]" />
          <div className="border-t border-border/50 px-4 py-2 text-[10px] text-muted-foreground text-center">
            Grabio only ·{' '}
            <Link to="/admin/ai-agent" className="text-teal-600 hover:underline" onClick={() => setOpen(false)}>
              Open full page
            </Link>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'fixed z-[60] bottom-6 right-4 group',
          'hover:scale-105 active:scale-95 transition-transform duration-200',
        )}
        aria-label={open ? 'Close Sally' : 'Chat with Sally'}
        title="Sally — Grabio assistant"
      >
        {open ? (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-600 text-white shadow-lg ring-4 ring-teal-500/20">
            <X className="h-6 w-6" />
          </div>
        ) : (
          <SallyIconBadge size="fab" showLabel />
        )}
      </button>
    </>
  );
};

export default GrabioGuideFloating;
