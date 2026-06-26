import React from 'react';
import { Card, type CardProps } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { adminPanelClass } from '@/lib/adminStyles';

/** Dashboard-style white panel — use instead of plain Card on admin inner pages */
export default function AdminPanel({ className, ...props }: CardProps) {
  return <Card className={cn(adminPanelClass, className)} {...props} />;
}
