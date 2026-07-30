import React, { useId } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAdminTheme } from '@/hooks/useAdminTheme';
import { cn } from '@/lib/utils';

type Props = {
  variant?: 'sidebar' | 'compact';
  className?: string;
};

export default function AdminThemeToggle({ variant = 'sidebar', className }: Props) {
  const switchId = useId();
  const { setAdminTheme, isDark } = useAdminTheme();

  return (
    <div
      className={cn(
        'flex items-center gap-2.5',
        variant === 'sidebar' && 'admin-theme-toggle',
        className,
      )}
    >
      <Sun
        className={cn('h-4 w-4 shrink-0', isDark ? 'text-zinc-500' : 'text-amber-400')}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <Label
          htmlFor={switchId}
          className={cn(
            'text-xs font-medium cursor-pointer',
            isDark ? 'text-[hsl(var(--admin-text-muted))]' : 'text-slate-600',
          )}
        >
          {isDark ? 'Dark' : 'Light'}
        </Label>
      </div>
      <Switch
        id={switchId}
        checked={isDark}
        onCheckedChange={(checked) => setAdminTheme(checked ? 'dark' : 'light')}
        aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      />
      <Moon
        className={cn('h-4 w-4 shrink-0', isDark ? 'text-teal-400' : 'text-zinc-500')}
        aria-hidden
      />
    </div>
  );
}
