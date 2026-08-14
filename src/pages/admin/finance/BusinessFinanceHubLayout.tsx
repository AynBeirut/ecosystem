import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  financeHubChipClass,
  financeHubChipRowClass,
  financeHubIconColorClass,
} from '@/pages/admin/finance/financeTabStyles';
import type { LucideIcon } from 'lucide-react';

export type BusinessFinanceHubItem = {
  id?: string;
  to?: string;
  label: string;
  description: string;
  icon: LucideIcon;
  external?: boolean;
};

type HubSectionProps = {
  title: string;
  items: BusinessFinanceHubItem[];
  mode?: 'link' | 'select';
  activeId?: string | null;
  onSelect?: (id: string) => void;
};

function HubChipContent({
  icon: Icon,
  label,
  colorIndex,
}: {
  icon: LucideIcon;
  label: string;
  colorIndex: number;
}) {
  return (
    <>
      <span className={cn('finance-accounting-tab__icon-wrap', financeHubIconColorClass(colorIndex))}>
        <Icon className="finance-accounting-tab__icon" aria-hidden />
      </span>
      <span className="finance-accounting-tab__label">{label}</span>
    </>
  );
}

function HubItemGrid({
  items,
  mode,
  activeId,
  onSelect,
  colorOffset = 0,
}: {
  items: BusinessFinanceHubItem[];
  mode: 'link' | 'select';
  activeId?: string | null;
  onSelect?: (id: string) => void;
  colorOffset?: number;
}) {
  return (
    <div className={financeHubChipRowClass()}>
      {items.map((item, index) => {
        const itemKey = item.id ?? item.to ?? item.label;
        const colorIndex = colorOffset + index;

        if (mode === 'select' && item.id && onSelect) {
          const selected = activeId === item.id;
          return (
            <button
              key={itemKey}
              type="button"
              onClick={() => onSelect(item.id!)}
              className={financeHubChipClass(selected)}
              data-state={selected ? 'active' : 'inactive'}
              title={item.description}
            >
              <HubChipContent icon={item.icon} label={item.label} colorIndex={colorIndex} />
            </button>
          );
        }

        if (!item.to) return null;

        return (
          <Link
            key={itemKey}
            to={item.to}
            className={financeHubChipClass(false)}
            data-state="inactive"
            title={item.description}
          >
            <HubChipContent icon={item.icon} label={item.label} colorIndex={colorIndex} />
          </Link>
        );
      })}
    </div>
  );
}

export function BusinessFinanceHubSection({
  title,
  items,
  mode = 'link',
  activeId = null,
  onSelect,
}: HubSectionProps) {
  return (
    <section className="space-y-2">
      <h2 className="finance-hub-panel__section">{title}</h2>
      <HubItemGrid items={items} mode={mode} activeId={activeId} onSelect={onSelect} />
    </section>
  );
}

type HubToggleButtonProps = {
  label: string;
  description: string;
  icon: LucideIcon;
  expanded: boolean;
  onToggle: () => void;
  colorIndex?: number;
};

/** Top-level category chip (Documents, Ledger setup, …). */
export function BusinessFinanceHubToggleButton({
  label,
  description,
  icon: Icon,
  expanded,
  onToggle,
  colorIndex = 0,
}: HubToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className={cn(financeHubChipClass(expanded), 'finance-hub-toggle')}
      data-state={expanded ? 'active' : 'inactive'}
      title={description}
    >
      <span className={cn('finance-accounting-tab__icon-wrap', financeHubIconColorClass(colorIndex))}>
        <Icon className="finance-accounting-tab__icon" aria-hidden />
      </span>
      <span className="finance-accounting-tab__label">{label}</span>
      <ChevronDown
        className={cn('h-3.5 w-3.5 shrink-0 opacity-70 transition-transform', expanded && 'rotate-180')}
        aria-hidden
      />
    </button>
  );
}

type HubToggleSectionProps = {
  label: string;
  description: string;
  icon: LucideIcon;
  expanded: boolean;
  onToggle: () => void;
  items: BusinessFinanceHubItem[];
  activeId?: string | null;
  onSelect: (id: string) => void;
  /** When true, sub-items render in a full-width block below the toggle row (use in parent). */
  itemsBelow?: boolean;
  colorIndex?: number;
};

/** Toggle chip + inline sub-items (default) or toggle-only when itemsBelow is used with BusinessFinanceHubSubGrid. */
export function BusinessFinanceHubToggleSection({
  label,
  description,
  icon,
  expanded,
  onToggle,
  items,
  activeId = null,
  onSelect,
  itemsBelow = false,
  colorIndex = 0,
}: HubToggleSectionProps) {
  if (itemsBelow) {
    return (
      <BusinessFinanceHubToggleButton
        label={label}
        description={description}
        icon={icon}
        expanded={expanded}
        onToggle={onToggle}
        colorIndex={colorIndex}
      />
    );
  }

  return (
    <div className="finance-hub-toggle-group space-y-2">
      <BusinessFinanceHubToggleButton
        label={label}
        description={description}
        icon={icon}
        expanded={expanded}
        onToggle={onToggle}
        colorIndex={colorIndex}
      />
      {expanded ? (
        <div className="finance-hub-toggle-items">
          <HubItemGrid
            items={items}
            mode="select"
            activeId={activeId}
            onSelect={onSelect}
            colorOffset={colorIndex + 1}
          />
        </div>
      ) : null}
    </div>
  );
}

export function BusinessFinanceHubSubGrid({
  title,
  items,
  mode = 'select',
  activeId = null,
  onSelect,
  colorOffset = 0,
}: {
  title?: string;
  items: BusinessFinanceHubItem[];
  mode?: 'link' | 'select';
  activeId?: string | null;
  onSelect?: (id: string) => void;
  colorOffset?: number;
}) {
  return (
    <section className="finance-hub-toggle-items space-y-2">
      {title ? <h2 className="finance-hub-panel__section">{title}</h2> : null}
      <HubItemGrid
        items={items}
        mode={mode}
        activeId={activeId}
        onSelect={onSelect}
        colorOffset={colorOffset}
      />
    </section>
  );
}

type BusinessFinanceHubLayoutProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

export default function BusinessFinanceHubLayout({ title, description, children }: BusinessFinanceHubLayoutProps) {
  return (
    <div className="finance-hub-panel space-y-4">
      <div>
        <h1 className="finance-hub-panel__title">{title}</h1>
        <p className="finance-hub-panel__desc">{description}</p>
      </div>
      {children}
    </div>
  );
}

/** White frame for embedded finance modules (Quotation, Receipts). */
export function BusinessFinancePageFrame({
  title,
  description,
  backTo,
  backLabel = 'Back',
  children,
}: {
  title: string;
  description?: string;
  backTo?: string;
  backLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4 rounded-lg border bg-white p-4 md:p-6">
      {backTo ? (
        <Link to={backTo} className="text-sm text-teal-700 hover:text-teal-900 font-medium inline-flex items-center gap-1">
          ← {backLabel}
        </Link>
      ) : null}
      <div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        {description ? <p className="text-sm text-gray-600 mt-1">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}
