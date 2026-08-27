import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ReportCurrencyMode } from '@/lib/ledger/formatLedgerAmount';

type Props = {
  value: ReportCurrencyMode;
  onChange: (value: ReportCurrencyMode) => void;
  id?: string;
};

export default function ReportCurrencyPicker({ value, onChange, id = 'report-currency' }: Props) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-medium text-slate-700">
        Currency
      </Label>
      <Select value={value} onValueChange={(next) => onChange(next as ReportCurrencyMode)}>
        <SelectTrigger id={id} className="h-9 bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="LBP">LBP</SelectItem>
          <SelectItem value="USD">USD</SelectItem>
          <SelectItem value="both">LBP + USD</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
