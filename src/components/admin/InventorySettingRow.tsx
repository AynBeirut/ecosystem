import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type InventorySettingRowProps = {
  id: string;
  title: string;
  description: string;
  footerNote?: string;
  checked: boolean;
  disabled?: boolean;
  saving?: boolean;
  onCheckedChange: (checked: boolean) => void;
};

const InventorySettingRow: React.FC<InventorySettingRowProps> = ({
  id,
  title,
  description,
  footerNote,
  checked,
  disabled,
  saving,
  onCheckedChange,
}) => {
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <div className="rounded-lg border bg-muted/10 px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <Label htmlFor={id} className="text-sm font-medium leading-snug cursor-pointer">
            {title}
          </Label>
          <button
            type="button"
            className="mt-0.5 inline-flex items-center gap-0.5 text-xs text-teal-700 hover:text-teal-800 hover:underline"
            onClick={() => setDetailsOpen((prev) => !prev)}
            aria-expanded={detailsOpen}
          >
            {detailsOpen ? 'Hide details' : 'Details'}
            <ChevronDown className={cn('h-3 w-3 transition-transform', detailsOpen && 'rotate-180')} />
          </button>
          {detailsOpen ? (
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
          {detailsOpen && footerNote ? (
            <p className="mt-1 text-xs text-muted-foreground">{footerNote}</p>
          ) : null}
        </div>
        <Switch
          id={id}
          className="mt-0.5 shrink-0 scale-90 origin-right"
          checked={checked}
          disabled={disabled || saving}
          onCheckedChange={onCheckedChange}
        />
      </div>
    </div>
  );
};

export default InventorySettingRow;
