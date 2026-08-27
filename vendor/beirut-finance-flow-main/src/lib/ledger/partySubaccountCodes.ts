export type PartyKind = 'client' | 'supplier';

export const PARTY_AR_PARENT = { lebanese: '4111', international: '110' } as const;
export const PARTY_AP_PARENT = { lebanese: '4011', international: '201' } as const;
export const PARTY_GRABIO_AR = '110';
export const PARTY_GRABIO_AP = '201';

export function partyParentCode(kind: PartyKind, mode: 'lebanese' | 'international'): string {
  if (kind === 'client') return mode === 'lebanese' ? PARTY_AR_PARENT.lebanese : PARTY_AR_PARENT.international;
  return mode === 'lebanese' ? PARTY_AP_PARENT.lebanese : PARTY_AP_PARENT.international;
}

export function partyGrabioCode(kind: PartyKind): string {
  return kind === 'client' ? PARTY_GRABIO_AR : PARTY_GRABIO_AP;
}
