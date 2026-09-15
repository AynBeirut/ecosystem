/** Mirror of scripts/lib/littleHandsPurchasesEligibility.cjs for Purchases UI filter. */

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
];

const OPERATING_NOT_PURCHASE = [
  'social media',
  'reels colaboration',
  'rasha social',
  'insurance',
  'internet',
  'circus show',
  'snack show',
  'cash with youssef',
];

function normText(description: string, vendor: string): string {
  return `${description || ''} ${vendor || ''}`.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function belongsOnLittleHandsPurchasesPage(
  description: string,
  vendor: string,
  organizedCategory?: string,
): boolean {
  if (
    organizedCategory === 'payroll'
    || organizedCategory === 'operating_expense'
    || organizedCategory === 'fixed_asset'
  ) {
    return false;
  }
  if (organizedCategory === 'owner_bank_sanaa' || organizedCategory === 'owner_bank_youssef') return false;

  const t = normText(description, vendor);
  if (PAYROLL_MARKERS.some((m) => t.includes(m))) return false;
  if (OPERATING_NOT_PURCHASE.some((m) => t.includes(m))) return false;
  if (/\bmiro\b/.test(t) && (t.includes('advance') || t.includes('salary') || t.includes('working'))) {
    return false;
  }
  if (
    (t.includes('nour malek') || t.includes('nancy ghazal') || t.includes('cynthia hello')) &&
    (t.includes('working') || t.includes('face painting') || t.includes('visit'))
  ) {
    return false;
  }
  if (/\beva\b/.test(t)) {
    return false;
  }
  if (t.includes('charbel ghostin') || t.includes('charbel ghostine')) {
    return false;
  }
  if (t.includes('nour malek') || t.includes('nour malik')) {
    return false;
  }
  if (/\bluccian/.test(t)) {
    return false;
  }
  if (t.includes('mgharbal') || t.includes('m8arbal')) {
    return false;
  }
  if (t.includes('asab') || t.includes('assab')) {
    return false;
  }
  if (t.includes('returne to sara exchange') || t.includes('return to sara exchange')) {
    return false;
  }
  if (t.includes('marawi7') || t.includes('marawe7') || (t.includes('melhem') && t.includes('garden'))) {
    return false;
  }
  if (/\bmariam\b/.test(t) || /\bmiram\b/.test(t) || /\bmiriam\b/.test(t)) {
    return false;
  }
  if (t.includes('kitchen tools') || t.includes('kitcken tools') || t.includes('tools for kitchen')) {
    return false;
  }
  if (/\bangelina\b/.test(t)) {
    return false;
  }
  if ((t.includes('tabale') || t.includes('tabaly')) && t.includes('garden')) {
    return false;
  }
  if (t.includes('citern') || t.includes('cistern') || t.includes('sitern')) {
    return false;
  }
  if (t.includes('advance')) {
    return false;
  }
  if (t.includes('chicken') && t.includes('farm')) {
    return false;
  }
  if (t.includes('masyadet') && (t.includes('deben') || t.includes('debben'))) {
    return false;
  }
  if (t.includes('umbrella') && t.includes('garden')) {
    return false;
  }
  if (t.includes('khayzaran') || t.includes('khaizaran')) {
    return false;
  }
  if (
    (/\bmoh?amad\b/.test(t) || /\bmhamad\b/.test(t))
    && !t.includes('wissam')
    && !t.includes('to7fir')
    && !t.includes('touhfir')
    && !t.includes('tosli7')
    && !t.includes('citern')
  ) {
    return false;
  }
  if (t.includes('to7fir') || t.includes('touhfir') || t.includes('tosli7') || t.includes('toslih')) {
    return false;
  }
  if (/\bmiro\b/.test(t)) return false;
  if (t.includes('salairy')) return false;
  return true;
}
