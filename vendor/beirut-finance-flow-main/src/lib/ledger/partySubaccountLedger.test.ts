import { describe, expect, it } from 'vitest';
import { isWalkInClient, mergeLedgerPartyRowsIntoPcgClients } from '@/lib/ledger/partySubaccountLedger';
import type { LedgerAccount, PcgClientAccount } from '@/types/generalLedger';

describe('partySubaccountLedger', () => {
  it('treats missing client as walk-in', () => {
    expect(isWalkInClient(undefined, '')).toBe(true);
    expect(isWalkInClient(undefined, 'Walk-in customer')).toBe(true);
    expect(isWalkInClient('c1', 'Youssif Melik')).toBe(false);
  });

  it('merges ledger party rows missing from pcgClientAccounts', () => {
    const accounts = [
      {
        id: 'acct-4010009',
        code: '4010009',
        name: 'Youssif Melik',
        parentCode: '401',
        partyId: 'c1',
        partyType: 'client',
        isActive: true,
      },
    ] as LedgerAccount[];
    const merged = mergeLedgerPartyRowsIntoPcgClients(accounts, []);
    expect(merged).toHaveLength(1);
    expect(merged[0].clientCode).toBe('4010009');
    expect(merged[0].parentPcgCode).toBe('7010');
  });

  it('does not duplicate existing pcg party rows', () => {
    const pcg: PcgClientAccount[] = [
      {
        id: 'pcg1',
        clientCode: '4010001',
        grabioOperationalCode: '401',
        parentPcgCode: '7010',
        name: 'Client A',
        partyId: 'c1',
        partyType: 'client',
      },
    ];
    const accounts = [
      {
        id: 'acct-4010001',
        code: '4010001',
        name: 'Client A',
        partyId: 'c1',
        partyType: 'client',
        isActive: true,
      },
    ] as LedgerAccount[];
    expect(mergeLedgerPartyRowsIntoPcgClients(accounts, pcg)).toHaveLength(1);
  });

  it('never shows two names on the same clientCode', () => {
    const pcg: PcgClientAccount[] = [
      {
        id: 'pcg-walk',
        clientCode: '70101000003',
        grabioOperationalCode: '401',
        parentPcgCode: '7010',
        name: 'Walk-in',
        partyId: 'walk-1',
        partyType: 'client',
      },
    ];
    const accounts = [
      {
        id: 'acct-70101000003',
        code: '70101000003',
        name: 'Maguie Bou Abdo',
        partyId: 'c-maguie',
        partyType: 'client',
        isActive: true,
      },
      {
        id: 'acct-70101000003b',
        code: '70101000003',
        name: 'Rachel Bader',
        partyId: 'c-rachel',
        partyType: 'client',
        isActive: true,
      },
    ] as LedgerAccount[];
    const merged = mergeLedgerPartyRowsIntoPcgClients(accounts, pcg);
    expect(merged).toHaveLength(1);
    expect(merged[0].name).toBe('Walk-in');
  });
});
