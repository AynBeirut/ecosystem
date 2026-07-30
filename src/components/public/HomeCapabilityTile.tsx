import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { adminListItemClass } from '@/lib/adminStyles';
import type { ModuleAccent } from '@/lib/moduleIcons';

type Props = {
  title: string;
  desc: string;
  Icon: LucideIcon;
  accent: ModuleAccent;
};

export default function HomeCapabilityTile({ title, desc, Icon, accent }: Props) {
  return (
    <div
      className={cn(
        adminListItemClass,
        'group flex flex-col items-center px-4 py-5 text-center transition-all duration-300 hover:-translate-y-0.5',
      )}
    >
      <div
        className={cn(
          'home-feature-icon mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_20px_-8px_rgba(15,23,42,0.45)] transition-transform duration-300 group-hover:scale-105',
          accent.gradient,
          accent.glow,
        )}
      >
        <Icon className={cn('h-7 w-7', accent.iconClass)} strokeWidth={1.65} />
      </div>
      <p className="mb-1.5 text-sm font-semibold text-slate-900">{title}</p>
      <p className="text-xs leading-relaxed text-slate-500">{desc}</p>
    </div>
  );
}
