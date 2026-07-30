import React, { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CRM_LEBANON_GOVERNORATE_NAMES,
  CRM_LOCATION_COUNTRIES,
  crmAreasForGovernorate,
} from '@/lib/crmLebanonLocations';

export type CrmLocationFilterValue = {
  country: string;
  district: string;
  area: string;
};

export const CRM_LOCATION_FILTER_ALL = 'all';

export function crmEmptyLocationFilter(): CrmLocationFilterValue {
  return { country: CRM_LOCATION_FILTER_ALL, district: CRM_LOCATION_FILTER_ALL, area: CRM_LOCATION_FILTER_ALL };
}

export function crmMatchesLocationFilter(
  client: { country?: string | null; district?: string | null; area?: string | null },
  filter: CrmLocationFilterValue,
): boolean {
  if (filter.country !== CRM_LOCATION_FILTER_ALL) {
    const cCountry = (client.country || 'Lebanon').trim();
    if (cCountry !== filter.country) return false;
  }
  if (filter.district !== CRM_LOCATION_FILTER_ALL) {
    if ((client.district || '').trim() !== filter.district) return false;
  }
  if (filter.area !== CRM_LOCATION_FILTER_ALL) {
    if ((client.area || '').trim() !== filter.area) return false;
  }
  return true;
}

type Props = {
  value: CrmLocationFilterValue;
  onChange: (next: CrmLocationFilterValue) => void;
  /** Extra governorate/area values from existing customer records */
  extraGovernorates?: string[];
  extraAreas?: string[];
};

export default function CrmLocationFilters({ value, onChange, extraGovernorates = [], extraAreas = [] }: Props) {
  const governorates = useMemo(() => {
    const set = new Set<string>([...CRM_LEBANON_GOVERNORATE_NAMES, ...extraGovernorates.filter(Boolean)]);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [extraGovernorates]);

  const areas = useMemo(() => {
    const fromCatalog =
      value.district !== CRM_LOCATION_FILTER_ALL ? crmAreasForGovernorate(value.district) : [];
    const set = new Set<string>([...fromCatalog, ...extraAreas.filter(Boolean)]);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [value.district, extraAreas]);

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div>
        <Label>Country</Label>
        <Select
          value={value.country}
          onValueChange={(v) => onChange({ country: v, district: CRM_LOCATION_FILTER_ALL, area: CRM_LOCATION_FILTER_ALL })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={CRM_LOCATION_FILTER_ALL}>All countries</SelectItem>
            {CRM_LOCATION_COUNTRIES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Governorate</Label>
        <Select
          value={value.district}
          onValueChange={(v) => onChange({ ...value, district: v, area: CRM_LOCATION_FILTER_ALL })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={CRM_LOCATION_FILTER_ALL}>All governorates</SelectItem>
            {governorates.map((g) => (
              <SelectItem key={g} value={g}>{g}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Area</Label>
        <Select
          value={value.area}
          onValueChange={(v) => onChange({ ...value, area: v })}
          disabled={value.district === CRM_LOCATION_FILTER_ALL}
        >
          <SelectTrigger><SelectValue placeholder={value.district === CRM_LOCATION_FILTER_ALL ? 'Pick governorate first' : 'All areas'} /></SelectTrigger>
          <SelectContent>
            <SelectItem value={CRM_LOCATION_FILTER_ALL}>All areas</SelectItem>
            {areas.map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
