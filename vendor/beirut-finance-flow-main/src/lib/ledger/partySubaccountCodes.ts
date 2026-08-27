import { GL_ACCOUNT_CODES } from '@/lib/ledger/defaultChartOfAccounts';
import type { LedgerAccountType, NormalBalance } from '@/types/generalLedger';

export type PartyKind = 'client' | 'supplier';

/** AM rule: numbered subaccounts under default sales / purchase posting parents. */
export const PARTY_CLIENT_PARENT = GL_ACCOUNT_CODES.REVENUE; // 401
export const PARTY_SUPPLIER_PARENT = GL_ACCOUNT_CODES.COGS; // 501
export const PARTY_SUFFIX_DIGITS = 4;

/** @deprecated Use PARTY_CLIENT_PARENT — kept for imports. */
export const PARTY_AR_PARENT = { lebanese: PARTY_CLIENT_PARENT, international: PARTY_CLIENT_PARENT } as const;
/** @deprecated Use PARTY_SUPPLIER_PARENT — kept for imports. */
export const PARTY_AP_PARENT = { lebanese: PARTY_SUPPLIER_PARENT, international: PARTY_SUPPLIER_PARENT } as const;
/** @deprecated Alias of sales parent. */
export const PARTY_GRABIO_AR = PARTY_CLIENT_PARENT;
/** @deprecated Alias of purchase/COGS parent. */
export const PARTY_GRABIO_AP = PARTY_SUPPLIER_PARENT;

export function partyParentCode(kind: PartyKind, _mode?: 'lebanese' | 'international'): string {
  return kind === 'client' ? PARTY_CLIENT_PARENT : PARTY_SUPPLIER_PARENT;
}

export function partyGrabioCode(kind: PartyKind): string {
  return partyParentCode(kind);
}

export function partyAccountTypeForParent(parentCode: string): {
  type: LedgerAccountType;
  normalBalance: NormalBalance;
} {
  const parent = String(parentCode || '').trim();
  if (parent === GL_ACCOUNT_CODES.REVENUE || parent.startsWith('40')) {
    return { type: 'revenue', normalBalance: 'credit' };
  }
  if (
    parent === GL_ACCOUNT_CODES.COGS ||
    parent === '502' ||
    parent === '503' ||
    parent === '505' ||
    parent === '506' ||
    parent.startsWith('50')
  ) {
    return { type: 'expense', normalBalance: 'debit' };
  }
  if (parent === GL_ACCOUNT_CODES.AP || parent.startsWith('20')) {
    return { type: 'liability', normalBalance: 'credit' };
  }
  if (parent === GL_ACCOUNT_CODES.AR || parent.startsWith('11')) {
    return { type: 'asset', normalBalance: 'debit' };
  }
  return kindFallback('client');
}

function kindFallback(kind: PartyKind): { type: LedgerAccountType; normalBalance: NormalBalance } {
  return kind === 'client'
    ? { type: 'revenue', normalBalance: 'credit' }
    : { type: 'expense', normalBalance: 'debit' };
}

export function partyAccountTypeForKind(kind: PartyKind): {
  type: LedgerAccountType;
  normalBalance: NormalBalance;
} {
  return partyAccountTypeForParent(partyParentCode(kind));
}
