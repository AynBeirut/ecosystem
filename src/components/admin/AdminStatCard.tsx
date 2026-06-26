import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { adminPanelClass, adminPanelInteractiveClass } from '@/lib/adminStyles';

type Props = {
  title: string;
  value: string | number;
  icon: LucideIcon;
  gradient?: string;
  subtitle?: string;
  className?: string;
  onClick?: () => void;
  valueClassName?: string;
};

const DEFAULT_GRADIENT = 'from-slate-500 to-slate-700';

export default function AdminStatCard({
  title,
  value,
  icon: Icon,
  gradient = DEFAULT_GRADIENT,
  subtitle,
  className,
  onClick,
  valueClassName,
}: Props) {
  return (
    <Card
      className={cn(
        adminPanelClass,
        'min-h-[100px] p-4 overflow-hidden',
        onClick && adminPanelInteractiveClass,
        className,
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <CardContent className="flex items-center gap-4 p-0">
        <div
          className={cn(
            'h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br text-white flex items-center justify-center',
            'shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_8px_16px_-6px_rgba(15,23,42,0.45)]',
            gradient,
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{title}</div>
          <div className={cn('text-2xl font-bold tracking-tight text-slate-900', valueClassName)}>{value}</div>
          {subtitle ? <div className="text-xs text-slate-500 truncate mt-0.5">{subtitle}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}
