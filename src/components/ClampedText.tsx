import React, { useState } from 'react';
import { cn } from '@/lib/utils';

type ClampedTextProps = {
  text: string;
  maxLines?: 1 | 2 | 3;
  className?: string;
  moreLabel?: string;
  lessLabel?: string;
  as?: 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'div';
  /** Show (more) when text exceeds this many characters */
  moreAfterChars?: number;
};

const LINE_CLAMP: Record<1 | 2 | 3, string> = {
  1: 'line-clamp-1',
  2: 'line-clamp-2',
  3: 'line-clamp-3',
};

const MORE_AFTER: Record<1 | 2 | 3, number> = {
  1: 42,
  2: 72,
  3: 120,
};

export default function ClampedText({
  text,
  maxLines = 2,
  className,
  moreLabel = 'more',
  lessLabel = 'less',
  as: Tag = 'span',
  moreAfterChars,
}: ClampedTextProps) {
  const [expanded, setExpanded] = useState(false);
  const trimmed = String(text || '').trim();
  const toggleAt = moreAfterChars ?? MORE_AFTER[maxLines];
  const showToggle = trimmed.length > toggleAt;

  if (!trimmed) return null;

  return (
    <Tag className={cn('min-w-0 w-full max-w-full', className)}>
      <span
        className={cn(
          'block break-words [overflow-wrap:anywhere]',
          !expanded && showToggle && LINE_CLAMP[maxLines],
        )}
      >
        {trimmed}
      </span>
      {showToggle && (
        <button
          type="button"
          className="text-primary text-xs font-medium hover:underline mt-0.5"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
        >
          ({expanded ? lessLabel : moreLabel})
        </button>
      )}
    </Tag>
  );
}

/** Truncate long selected file names inside modal buttons */
export function SelectedFileLabel({
  file,
  idleLabel,
}: {
  file: File | null;
  idleLabel: string;
}) {
  if (!file) return <>{idleLabel}</>;
  const label = `Selected: ${file.name}`;
  return (
    <span className="block w-full min-w-0 truncate text-left" title={label}>
      {label}
    </span>
  );
}

/** Fixed-height modal shell: header + scroll body + footer */
export const FORM_DIALOG_SHELL =
  'w-[95vw] max-w-lg max-h-[min(90vh,720px)] flex flex-col overflow-hidden overflow-x-hidden p-0 gap-0';

export const FORM_DIALOG_HEADER = 'px-6 pt-6 pb-3 shrink-0 border-b pr-12 min-w-0';
export const FORM_DIALOG_BODY =
  'flex-1 min-h-0 min-w-0 max-w-full overflow-y-auto overflow-x-hidden px-6 py-4';
export const FORM_DIALOG_FOOTER =
  'px-6 py-4 shrink-0 border-t bg-background flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 min-w-0';

export const FORM_FILE_BUTTON_CLASS =
  'w-full min-w-0 max-w-full overflow-hidden whitespace-normal h-auto min-h-10 py-2';
