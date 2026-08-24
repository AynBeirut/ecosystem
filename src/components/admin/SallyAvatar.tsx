import React from 'react';
import { cn } from '@/lib/utils';

export const SALLY_AVATAR_SRC = '/sally-avatar.png';

const SIZE_CLASS = {
  xs: 'h-6 w-6',
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
  fab: 'h-[3.25rem] w-[3.25rem]',
} as const;

type Props = {
  size?: keyof typeof SIZE_CLASS;
  className?: string;
  ring?: boolean;
};

const SallyAvatar: React.FC<Props> = ({ size = 'md', className, ring = true }) => (
  <img
    src={SALLY_AVATAR_SRC}
    alt="Sally"
    className={cn(
      'rounded-full object-cover bg-teal-100',
      ring && 'ring-2 ring-white/90 shadow-sm',
      SIZE_CLASS[size],
      className,
    )}
  />
);

export default SallyAvatar;
