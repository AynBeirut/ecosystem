import { GL_ACCOUNT_CODES } from '@/lib/ledger/defaultChartOfAccounts';

const BASE_MAP: Record<string, string> = {
  rent: '610',
  utilities: '612',
  payroll: '601',
  staff_wages: '601',
  meals: GL_ACCOUNT_CODES.COGS,
  office_supplies: GL_ACCOUNT_CODES.COGS,
  fuel: '613',
  internet: '622',
  maintenance: '613',
  marketing: GL_ACCOUNT_CODES.GENERAL_EXPENSE,
  insurance: GL_ACCOUNT_CODES.GENERAL_EXPENSE,
  legal: GL_ACCOUNT_CODES.GENERAL_EXPENSE,
  travel: GL_ACCOUNT_CODES.GENERAL_EXPENSE,
  other: GL_ACCOUNT_CODES.GENERAL_EXPENSE,
};

const UTILITIES_VENDOR = /edl|electric|électric|zir electric|generator|diesel|kahraba/i;
const RENT_VENDOR = /rent|lease|إيجار/i;

function normalizeCategory(category?: string): string {
  return String(category || '').toLowerCase().trim();
}

function categoryKey(category?: string): string {
  return normalizeCategory(category).replace(/_/g, ' ');
}

export function resolveExpenseAccountCode(input: {
  category?: string;
  vendor?: string;
  description?: string;
}): string {
  const cat = normalizeCategory(input.category);
  const catSpaced = categoryKey(input.category);
  const hay = `${input.vendor || ''} ${input.description || ''}`.toLowerCase();

  if (catSpaced === 'bill payment') {
    if (UTILITIES_VENDOR.test(hay)) return '612';
    if (RENT_VENDOR.test(hay)) return '610';
    return GL_ACCOUNT_CODES.COGS;
  }

  return BASE_MAP[cat] || BASE_MAP[catSpaced] || GL_ACCOUNT_CODES.GENERAL_EXPENSE;
}
