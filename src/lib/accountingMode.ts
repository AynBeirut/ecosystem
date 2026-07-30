/** Per-store accounting system (immutable after first posted JE). */
export type AccountingMode = 'international' | 'lebanese';

export type AccountingLanguage = 'en' | 'ar' | 'bilingual';

export const DEFAULT_ACCOUNTING_MODE: AccountingMode = 'international';

export function normalizeAccountingMode(value: unknown): AccountingMode {
  const raw = String(value || '').toLowerCase();
  if (raw === 'lebanese' || raw === 'lb') return 'lebanese';
  return 'international';
}

export function normalizeAccountingLanguage(value: unknown, mode?: AccountingMode): AccountingLanguage {
  const raw = String(value || '').toLowerCase();
  if (raw === 'ar' || raw === 'arabic') return 'ar';
  if (raw === 'bilingual' || raw === 'bi') return 'bilingual';
  if (raw === 'en' || raw === 'english') return 'en';
  if (mode === 'lebanese') return 'bilingual';
  return 'en';
}

/** Profile fields applied when user selects Lebanese mode (does not overwrite explicit user choices). */
export function lebaneseModeProfilePatch(existing?: {
  secondaryCurrency?: string;
  accountingLanguage?: AccountingLanguage;
}): {
  accountingMode: AccountingMode;
  accountingLanguage: AccountingLanguage;
  secondaryCurrency?: string;
} {
  const patch: {
    accountingMode: AccountingMode;
    accountingLanguage: AccountingLanguage;
    secondaryCurrency?: string;
  } = {
    accountingMode: 'lebanese',
    accountingLanguage: existing?.accountingLanguage ?? 'bilingual',
  };
  if (!existing?.secondaryCurrency) {
    patch.secondaryCurrency = 'LBP';
  }
  return patch;
}

export function internationalModeProfilePatch(): {
  accountingMode: AccountingMode;
  accountingLanguage: AccountingLanguage;
} {
  return {
    accountingMode: 'international',
    accountingLanguage: 'en',
  };
}

export function accountingModeLabel(mode: AccountingMode): string {
  return mode === 'lebanese' ? 'Lebanese (PCG-style)' : 'International';
}

export function supportsArabicEntry(language: AccountingLanguage | undefined): boolean {
  return language === 'ar' || language === 'bilingual';
}
