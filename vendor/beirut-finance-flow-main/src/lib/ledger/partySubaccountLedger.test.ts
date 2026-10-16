import { describe, expect, it } from 'vitest';
import { isWalkInClient, mergeLedgerPartyRowsIntoPcgClients, partyAccountForCurrency } from '@/lib/ledger/partySubaccountLedger';
import type { LedgerAccount, PcgClientAccount } from '@/types/generalLedger';

describe('partySubaccountLedger', () => {
  it('links a party line to the existing account in that currency', () => {
    const accounts = [
      { id: 'a', code: '6111001', partyId: 's1', partyType: 'supplier', currency: 'USD', isActive: true },
      { id: 'b', code: '6111002', partyId: 's1', partyType: 'supplier', currency: 'LL', isActive: true },
    ] as LedgerAccount[];
    expect(partyAccountForCurrency('supplier', 's1', 'USD', accounts)?.code).toBe('6111001');
    expect(partyAccountForCurrency('supplier', 's1', 'LBP', accounts)?.code).toBe('6111002');
    expect(partyAccountForCurrency('client', 's1', 'USD', accounts)).toBeNull();
  });

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

  it('keeps both USD and LBP accounts for the same party', () => {
    const accounts = [
      { id: 'usd', code: '4010001', name: 'Client USD', partyId: 'c1', partyType: 'client', currency: 'USD', isActive: true },
      { id: 'lbp', code: '4010002', name: 'Client LBP', partyId: 'c1', partyType: 'client', currency: 'LL', isActive: true },
    ] as LedgerAccount[];
    const merged = mergeLedgerPartyRowsIntoPcgClients(accounts, []);
    expect(merged.map((row) => row.clientCode).sort()).toEqual(['4010001', '4010002']);
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
