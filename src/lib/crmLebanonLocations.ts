/** CRM customer location — Lebanon hierarchy (Country → Governorate → Area). */

export type CrmLocationSelection = {
  country: string;
  district: string;
  area: string;
};

export const CRM_LOCATION_COUNTRIES = ['Lebanon'] as const;

/** Governorate → areas/towns */
export const CRM_LEBANON_GOVERNORATES: Record<string, readonly string[]> = {
  'Mount Lebanon': [
    'Hamana',
    'Aley',
    'Baabda',
    'Bhamdoun',
    'Bikfaya',
    'Broummana',
    'Dbayeh',
    'Fanar',
    'Hazmieh',
    'Jdeideh',
    'Jounieh',
    'Metn',
    'Saifi',
    'Sin el Fil',
    'Zalka',
    'Zouk Mikael',
  ],
  Beirut: [
    'Achrafieh',
    'Badaro',
    'Beirut Central',
    'Hamra',
    'Mar Mikhael',
    'Verdun',
  ],
  'North Lebanon': [
    'Amioun',
    'Batroun',
    'Bcharre',
    'Chekka',
    'Koura',
    'Minieh',
    'Tripoli',
    'Zgharta',
  ],
  Akkar: ['Akkar', 'Halba', 'Qobayat'],
  Bekaa: ['Chtaura', 'Jdita', 'Rayak', 'Zahle'],
  'Baalbek-Hermel': ['Baalbek', 'Hermel', 'Nabi Chit'],
  'South Lebanon': ['Jezzine', 'Maghdouche', 'Saida', 'Sour'],
  Nabatieh: ['Habboush', 'Marjayoun', 'Nabatieh', 'Tebnin'],
};

export const CRM_LEBANON_GOVERNORATE_NAMES = Object.keys(CRM_LEBANON_GOVERNORATES).sort();

export function crmAreasForGovernorate(governorate: string): string[] {
  const areas = CRM_LEBANON_GOVERNORATES[governorate];
  return areas ? [...areas].sort((a, b) => a.localeCompare(b)) : [];
}

export function crmDefaultLocation(): CrmLocationSelection {
  return { country: 'Lebanon', district: '', area: '' };
}

/** Match saved free-text values to dropdown options when possible. */
export function crmNormalizeLocation(input: Partial<CrmLocationSelection> | null | undefined): CrmLocationSelection {
  const country =
    input?.country && CRM_LOCATION_COUNTRIES.includes(input.country as (typeof CRM_LOCATION_COUNTRIES)[number])
      ? input.country
      : 'Lebanon';

  let district = input?.district?.trim() || '';
  if (district && !CRM_LEBANON_GOVERNORATES[district]) {
    const match = CRM_LEBANON_GOVERNORATE_NAMES.find(
      (g) => g.toLowerCase() === district.toLowerCase(),
    );
    if (match) district = match;
  }

  let area = input?.area?.trim() || '';
  if (district && area) {
    const areas = crmAreasForGovernorate(district);
    if (!areas.includes(area)) {
      const match = areas.find((a) => a.toLowerCase() === area.toLowerCase());
      if (match) area = match;
    }
  }

  return { country, district, area };
}
