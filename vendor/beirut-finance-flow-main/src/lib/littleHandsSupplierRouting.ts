/** Classify cash-book rows miscoded as suppliers (Little Hands). */

export type LittleHandsSupplierRoute =
  | 'vendor'
  | 'social_media'
  | 'payroll'
  | 'treasury'
  | 'divers_misc'
  | 'fuel';

export function normalizeLittleHandsVendorText(description: string, vendor = ''): string {
  return `${description || ''} ${vendor || ''}`.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function isLittleHandsSocialMediaName(name: string): boolean {
  const t = normalizeLittleHandsVendorText(name, name);
  if (!t) return false;
  if (t.includes('social media')) return true;
  if (t.includes('reels colaboration') || t.includes('reels collaboration')) return true;
  if (t.includes('rasha social')) return true;
  if (/\breels\b/.test(t) && (t.includes('social') || t.includes('colaboration') || t.includes('collaboration'))) {
    return true;
  }
  return false;
}

const PAYROLL_MARKERS = [
  'salary',
  'salaries',
  'salairy',
  'working h',
  'workng h',
  'working day',
  'working week',
  'advance on sal',
  'miro advance',
  'advance on salary',
  'marleine advance',
  'payroll',
  'face painting',
  'employee',
  'emouchi salary',
  'miro salary',
  'thaer salary',
  'paid to mirro',
  'circus show',
  'snack show',
  'zammour',
];

export function isLittleHandsPayrollPersonName(name: string): boolean {
  const raw = String(name || '').trim();
  if (!raw) return false;
  if (/\bemployee\b/i.test(raw)) return true;

  const t = normalizeLittleHandsVendorText(name, name);
  if (PAYROLL_MARKERS.some((m) => t.includes(m))) return true;

  if (/cynthia\s+hel[lo]/.test(t) && !t.includes('bakery') && !t.includes('boucherie')) return true;

  if (
    (t.includes('nour malek') || t.includes('nancy ghazal') || t.includes('cynthia hello')) &&
    (t.includes('working') || t.includes('face painting') || t.includes('visit'))
  ) {
    return true;
  }

  if (/\beva\b/.test(t)) return true;
  if (/\bangelina\b/.test(t) && !t.includes('bakery')) return true;
  if (/\blucciana\b/.test(t)) return true;
  if (/mariam\s+fegir/i.test(t)) return true;
  if (/no+ur\s+malek/i.test(t)) return true;
  if (/charbel\s+ghos/i.test(t)) return true;
  if (/nour\s+haybe/i.test(t)) return true;
  if (t.includes('wish transfer') && (t.includes('character') || t.includes('event'))) return true;
  if (t.includes('event character') || t.includes('animat')) return true;

  if (/^mariam$|^miram$|^miriam$/.test(name.trim())) return true;

  if (
    (/\bmariam\b/.test(t) || /\bmiram\b/.test(t) || /\bmiriam\b/.test(t)) &&
    !/\bmariam\s+[a-z]{3,}/i.test(name)
  ) {
    return true;
  }

  if (t.includes('nour malek') || t.includes('nour malik')) return true;

  if (/\bmiro\b/.test(t) && (t.includes('advance') || t.includes('salary') || t.includes('working'))) {
    return true;
  }

  if (
    (/\bmoh?amad\b/.test(t) || /\bmhamad\b/.test(t)) &&
    !t.includes('wissam') &&
    !t.includes('to7fir') &&
    !t.includes('touhfir') &&
    !t.includes('tosli7') &&
    !t.includes('citern')
  ) {
    return true;
  }

  if (t.includes('to7fir') || t.includes('touhfir') || t.includes('tosli7') || t.includes('toslih')) {
    return true;
  }

  if (/\bmiro\b/.test(t)) return true;
  if (t.includes('salairy')) return true;

  return false;
}

export function isLittleHandsDiversMiscItem(name: string): boolean {
  const raw = String(name || '').trim();
  const t = normalizeLittleHandsVendorText(name, name);
  if (/^kassab$/i.test(raw)) return true;
  if (/^balkis$/i.test(raw)) return true;
  if (/masyadet\s+deben/i.test(t)) return true;
  if (/flower\s+mother/i.test(t)) return true;
  if (/egg\s+for\s+egg\s+hunt/i.test(t)) return true;
  if (/teben\s+for\s+furm/i.test(t)) return true;
  if (/dispos/i.test(t)) return true;
  return false;
}

export function isLittleHandsDeliveryFuelLabel(name: string): boolean {
  const t = normalizeLittleHandsVendorText(name, name);
  return /ghaz\s+by\s+thaer/i.test(t) || (/\bghaz\b/.test(t) && /\bthaer\b/.test(t));
}

export function isLittleHandsTreasuryNoise(name: string): boolean {
  const t = normalizeLittleHandsVendorText(name, name);
  if (/returne?\s+to\s+sara\s+exchange/.test(t)) return true;
  if (t.includes('exchange') && t.includes('sara')) return true;
  return false;
}

export function classifyLittleHandsSupplierName(name: string): LittleHandsSupplierRoute {
  if (isLittleHandsTreasuryNoise(name)) return 'treasury';
  if (isLittleHandsSocialMediaName(name)) return 'social_media';
  if (isLittleHandsDeliveryFuelLabel(name)) return 'fuel';
  if (isLittleHandsDiversMiscItem(name)) return 'divers_misc';
  if (isLittleHandsPayrollPersonName(name)) return 'payroll';
  return 'vendor';
}

export function shouldShowOnLittleHandsSupplierList(supplierName: string): boolean {
  const name = String(supplierName || '').trim();
  if (/^karam\s+bek$/i.test(name)) return false;
  return classifyLittleHandsSupplierName(supplierName) === 'vendor';
}
