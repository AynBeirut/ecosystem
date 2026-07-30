import React, { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CRM_LEBANON_GOVERNORATE_NAMES,
  CRM_LOCATION_COUNTRIES,
  crmAreasForGovernorate,
  type CrmLocationSelection,
} from '@/lib/crmLebanonLocations';

type Props = {
  value: CrmLocationSelection;
  onChange: (next: CrmLocationSelection) => void;
  required?: boolean;
  className?: string;
};

export default function CrmLocationSelects({ value, onChange, required, className }: Props) {
  const areaOptions = useMemo(
    () => (value.district ? crmAreasForGovernorate(value.district) : []),
    [value.district],
  );

  return (
    <div className={className}>
      <p className="text-sm font-semibold text-slate-800 mb-2">Location</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label>Country{required ? ' *' : ''}</Label>
          <Select
            value={value.country || 'none'}
            onValueChange={(v) =>
              onChange({
                country: v === 'none' ? '' : v,
                district: '',
                area: '',
              })
            }
          >
            <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {CRM_LOCATION_COUNTRIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Governorate{required ? ' *' : ''}</Label>
          <Select
            value={value.district || 'none'}
            onValueChange={(v) =>
              onChange({
                ...value,
                district: v === 'none' ? '' : v,
                area: '',
              })
            }
            disabled={!value.country}
          >
            <SelectTrigger><SelectValue placeholder="e.g. Mount Lebanon" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {CRM_LEBANON_GOVERNORATE_NAMES.map((g) => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Area{required ? ' *' : ''}</Label>
          <Select
            value={value.area || 'none'}
            onValueChange={(v) => onChange({ ...value, area: v === 'none' ? '' : v })}
            disabled={!value.district}
          >
            <SelectTrigger><SelectValue placeholder="e.g. Hamana" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {areaOptions.map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
