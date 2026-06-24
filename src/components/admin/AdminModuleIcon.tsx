import { getModuleIcon } from '@/lib/moduleIcons';

type Props = {
  moduleId: string;
  size?: 'sm' | 'md';
};

export default function AdminModuleIcon({ moduleId, size = 'sm' }: Props) {
  const { Icon, accent } = getModuleIcon(moduleId);
  const tile = size === 'md' ? 'h-11 w-11' : 'h-9 w-9';
  const icon = size === 'md' ? 'h-5 w-5' : 'h-4 w-4';

  return (
    <div
      className={`${tile} shrink-0 flex items-center justify-center rounded-xl bg-gradient-to-br ${accent.gradient} shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_6px_14px_-6px_rgba(15,23,42,0.45)]`}
      aria-hidden
    >
      <Icon className={`${icon} ${accent.iconClass}`} strokeWidth={1.75} />
    </div>
  );
}
