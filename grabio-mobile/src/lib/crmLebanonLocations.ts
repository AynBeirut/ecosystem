export type CrmLocationSelection = {
  country: string;
  district: string;
  area: string;
};

export const CRM_LOCATION_COUNTRIES = ['Lebanon'] as const;

export const CRM_LEBANON_GOVERNORATES: Record<string, readonly string[]> = {
  'Mount Lebanon': [
    'Hamana', 'Aley', 'Baabda', 'Bhamdoun', 'Bikfaya', 'Broummana', 'Dbayeh', 'Fanar',
    'Hazmieh', 'Jdeideh', 'Jounieh', 'Metn', 'Saifi', 'Sin el Fil', 'Zalka', 'Zouk Mikael',
  ],
  Beirut: ['Achrafieh', 'Sioufi', 'Badaro', 'Beirut Central', 'Hamra', 'Mar Mikhael', 'Verdun'],
  'North Lebanon': ['Amioun', 'Batroun', 'Bcharre', 'Chekka', 'Koura', 'Minieh', 'Tripoli', 'Zgharta'],
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
