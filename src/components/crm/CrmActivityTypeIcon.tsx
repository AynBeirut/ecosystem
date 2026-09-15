import React from 'react';
import { MapPin, MessageCircle, Phone, ShoppingCart, Users } from 'lucide-react';
import type { CrmActivityType } from '@/types/crm';
import { CRM_ACTIVITY_TYPE_LABELS } from '@/lib/crm';
import { cn } from '@/lib/utils';

const ICONS: Record<CrmActivityType, React.ComponentType<{ className?: string }>> = {
  visit: MapPin,
  call: Phone,
  meeting: Users,
  whatsapp: MessageCircle,
  order: ShoppingCart,
};

type Props = {
  type?: CrmActivityType | string | null;
  className?: string;
  showLabel?: boolean;
};

export default function CrmActivityTypeIcon({ type, className, showLabel }: Props) {
  const key = (type || 'visit') as CrmActivityType;
  const Icon = ICONS[key in ICONS ? key : 'visit'] || MapPin;
  const label = CRM_ACTIVITY_TYPE_LABELS[key in CRM_ACTIVITY_TYPE_LABELS ? key : 'visit'] || 'Activity';
  return (
    <span className={cn('inline-flex items-center gap-1', className)} title={label}>
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {showLabel ? <span className="text-xs">{label}</span> : null}
    </span>
  );
}
