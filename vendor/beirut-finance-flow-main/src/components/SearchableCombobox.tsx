import { useMemo, useState, type ReactNode } from 'react';
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
  disabled?: boolean;
  /** Custom renderer for each option row. Falls back to plain label text. */
  renderOption?: (option: SearchableOption) => ReactNode;
  /** Shows a "+ Add new" action at the bottom of the dropdown. */
  onAddNew?: () => void;
  addNewLabel?: string;
  /** Subtitle shown below the trigger button when a value is selected. */
  selectedDetails?: string;
};

export function SearchableCombobox({
  options,
  value,
  onValueChange,
  placeholder = 'Search…',
  searchPlaceholder = 'Type to search…',
  emptyText = 'No matches.',
  className,
  disabled,
  renderOption,
  onAddNew,
  addNewLabel = 'Add new',
  selectedDetails,
}: SearchableComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((option) => option.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(q) ||
        option.value.toLowerCase().includes(q) ||
        (option.keywords || '').toLowerCase().includes(q),
    );
  }, [options, query]);

  return (
    <div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn('w-full justify-between font-normal', className)}
          >
            <span className="truncate text-left">{selected?.label || placeholder}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={searchPlaceholder}
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {filtered.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
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
                    {renderOption ? renderOption(option) : option.label}
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
        <p className="mt-1 text-xs text-muted-foreground truncate">{selectedDetails}</p>
      )}
    </div>
  );
}
