import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { adminPanelClass, adminPanelInteractiveClass } from '@/lib/adminStyles';

type Props = {
  title: string;
  description: string;
  icon: LucideIcon;
  gradient?: string;
  onClick?: () => void;
  className?: string;
};

const DEFAULT_GRADIENT = 'from-teal-500 to-teal-700';

export default function AdminNavCard({
  title,
  description,
  icon: Icon,
  gradient = DEFAULT_GRADIENT,
  onClick,
  className,
}: Props) {
  return (
    <Card
      className={cn(adminPanelClass, adminPanelInteractiveClass, 'p-4 h-full', className)}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && onClick) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <CardContent className="p-0 flex items-start gap-3">
        <div
          className={cn(
            'h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br text-white flex items-center justify-center',
            'shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_8px_16px_-6px_rgba(15,23,42,0.45)]',
            gradient,
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-slate-900 text-sm">{title}</div>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
