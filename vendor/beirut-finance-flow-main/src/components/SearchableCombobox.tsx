import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type SearchableOption = {
  value: string;
  label: string;
  keywords?: string;
};

type SearchableComboboxProps = {
  options: SearchableOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  /** Shorter label in the closed trigger; dropdown still uses full option labels. */
  displayLabel?: string;
  disabled?: boolean;
  /** Custom renderer for each option row. Falls back to plain label text. */
  renderOption?: (option: SearchableOption) => ReactNode;
  /** Shows a "+ Add new" action at the bottom of the dropdown. */
  onAddNew?: () => void;
  addNewLabel?: string;
  /** Subtitle shown below the trigger button when a value is selected. */
  selectedDetails?: string;
  /** Override default label substring filter (e.g. account code prefix search). */
  filterOptions?: (options: SearchableOption[], query: string) => SearchableOption[];
  popoverClassName?: string;
};

export function SearchableCombobox({
  options,
  value,
  onValueChange,
  placeholder = 'Search…',
  searchPlaceholder = 'Type to search…',
  emptyText = 'No matches.',
  className,
  displayLabel,
  disabled,
  renderOption,
  onAddNew,
  addNewLabel = 'Add new',
  selectedDetails,
  filterOptions,
  popoverClassName,
}: SearchableComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((option) => option.value === value);

  const filtered = useMemo(() => {
    if (filterOptions) return filterOptions(options, query);
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(q) ||
        option.value.toLowerCase().includes(q) ||
        (option.keywords || '').toLowerCase().includes(q),
    );
  }, [filterOptions, options, query]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [query, open]);

  return (
    <div className="min-w-0">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setQuery('');
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn('h-9 w-full min-w-0 justify-between font-normal', className)}
          >
            <span className="min-w-0 truncate text-left">
              {displayLabel ?? selected?.label ?? placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className={cn(
            'w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-1rem)] overflow-hidden p-0',
            popoverClassName,
          )}
          align="start"
        >
          <Command shouldFilter={false} className="overflow-hidden">
            <CommandInput
              placeholder={searchPlaceholder}
              value={query}
              onValueChange={setQuery}
            />
            <CommandList
              ref={listRef}
              className="max-h-[min(280px,45vh)] overflow-x-hidden overflow-y-auto"
            >
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {filtered.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    className="items-center overflow-hidden py-1.5"
                    onSelect={() => {
                      onValueChange(option.value);
                      setOpen(false);
                      setQuery('');
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4 shrink-0',
                        value === option.value ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm leading-snug">
                      {renderOption ? renderOption(option) : option.label}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
              {onAddNew && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => {
                        setOpen(false);
                        setQuery('');
                        onAddNew();
                      }}
                      className="text-teal-600"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {addNewLabel}
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected && selectedDetails && (
        <p className="mt-1 truncate text-xs text-muted-foreground">{selectedDetails}</p>
      )}
    </div>
  );
}
