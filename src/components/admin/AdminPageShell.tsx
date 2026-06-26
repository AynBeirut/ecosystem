import React from 'react';
import { cn } from '@/lib/utils';
import AdminPageHero from '@/components/admin/AdminPageHero';

type Props = {
  title: string;
  description?: string;
  eyebrow?: string;
  backTo?: string;
  backLabel?: string;
  children: React.ReactNode;
  className?: string;
  /** Optional actions rendered on the right of the hero row (second row below title on mobile) */
  actions?: React.ReactNode;
};

export default function AdminPageShell({
  title,
  description,
  eyebrow = 'Grabio Admin',
  backTo = '/admin/dashboard',
  backLabel = 'Dashboard',
  children,
  className,
  actions,
}: Props) {
  return (
    <div className={cn('space-y-6', className)}>
      <div className="space-y-4">
        <AdminPageHero
          title={title}
          description={description}
          eyebrow={eyebrow}
          backTo={backTo}
          backLabel={backLabel}
        />
        {actions ? <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}
