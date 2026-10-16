import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function LineCurrencyField({
  currency,
  choices,
  accountCode,
  partySelected,
  onChange,
}: {
  currency: string;
  choices: string[];
  accountCode?: string;
  partySelected: boolean;
  onChange: (currency: string) => void;
}) {
  const current = String(currency || choices[0] || 'USD').toUpperCase();
  const options = choices.includes(current) ? choices : [current, ...choices];

  return (
    <div>
      <label className="text-sm font-medium mb-1 block">Currency</label>
      {options.length <= 1 ? (
        <div className="flex h-9 items-center rounded-md border px-3 text-sm">{options[0]}</div>
      ) : (
        <Select value={current} onValueChange={onChange}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((code) => (
              <SelectItem key={code} value={code}>
                {code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <p className="mt-1 truncate text-xs text-muted-foreground">
        {!partySelected ? 'Select the party first' : accountCode ? `Account ${accountCode}` : 'No account for this currency'}
      </p>
    </div>
  );
}
