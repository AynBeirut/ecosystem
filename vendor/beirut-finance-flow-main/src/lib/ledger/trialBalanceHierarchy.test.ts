import { describe, expect, it } from 'vitest';
import type { LedgerAccount } from '@/types/generalLedger';
import {
  buildLebaneseTrialBalanceTree,
  collectTrialBalanceTreeGroupIds,
  defaultExpandedTrialBalanceNodes,
  emptyExtendedRow,
  flattenTrialBalanceTree,
} from '@/lib/ledger/trialBalanceHierarchy';

const storeId = 'store-1';

function ledgerAccount(partial: Partial<LedgerAccount> & Pick<LedgerAccount, 'id' | 'code' | 'name'>): LedgerAccount {
  return {
    storeId,
    type: 'expense',
    normalBalance: 'debit',
    isActive: true,
    isSystem: false,
    openingBalance: 0,
    ...partial,
  };
}

describe('trialBalanceHierarchy', () => {
  it('groups 6011 detail under collapsed 6010 header', () => {
    const accounts: LedgerAccount[] = [
      ledgerAccount({
        id: 'pcg-6010',
        code: '6010',
        name: 'Purchase Of Goods',
        pcgKind: 'G',
        isPcgChart: true,
        isActive: false,
      }),
      ledgerAccount({
        id: 'pcg-6011',
        code: '6011',
        name: 'Purchase Of Goods detail',
        pcgKind: 'D',
        isPcgChart: true,
      }),
      ledgerAccount({
        id: 'pcg-6012',
        code: '6012',
        name: 'Packing Materials',
        pcgKind: 'D',
        isPcgChart: true,
      }),
    ];

    const rowByAccountId = new Map(
      accounts.map((account) => [
        account.id,
        {
          ...emptyExtendedRow(account),
          periodDebit: account.code === '6011' ? 100 : account.code === '6012' ? 50 : 0,
          closingDebit: account.code === '6011' ? 100 : account.code === '6012' ? 50 : 0,
        },
      ]),
    );

    const roots = buildLebaneseTrialBalanceTree(accounts, rowByAccountId, '6010', '6019', [], {
      hideInactiveAccounts: true,
      includeZeroBalance: true,
    });

    const group6010 = roots
      .flatMap((node) => node.children)
      .find((node) => node.code === '6010');
    expect(group6010).toBeTruthy();
    expect(group6010?.hasChildren).toBe(true);
    expect(group6010?.row.periodDebit).toBe(150);

    const expanded = defaultExpandedTrialBalanceNodes(roots);
    expect(expanded.has('class:6')).toBe(true);
    expect(expanded.has('pcg:6010')).toBe(false);

    const collapsedVisible = flattenTrialBalanceTree(roots, expanded);
    expect(collapsedVisible.some((node) => node.code === '6011')).toBe(false);

    const allExpanded = new Set(collectTrialBalanceTreeGroupIds(roots));
    const expandedVisible = flattenTrialBalanceTree(roots, allExpanded);
    expect(expandedVisible.some((node) => node.code === '6011')).toBe(true);
    expect(expandedVisible.some((node) => node.code === '6012')).toBe(true);
  });

  it('rolls Grabio operational 102/601 into class 1–7 totals', () => {
    const cash = ledgerAccount({
      id: 'op-102',
      code: '102',
      name: 'POS Cash Drawer',
      type: 'asset',
      normalBalance: 'debit',
    });
    const payroll = ledgerAccount({
      id: 'op-601',
      code: '601',
      name: 'Salaries',
      type: 'expense',
      normalBalance: 'debit',
    });
    const rowByAccountId = new Map([
      [
        cash.id,
        {
          ...emptyExtendedRow(cash),
          periodDebit: 400,
          closingDebit: 400,
        },
      ],
      [
        payroll.id,
        {
          ...emptyExtendedRow(payroll),
          periodDebit: 250,
          closingDebit: 250,
        },
      ],
    ]);

    const roots = buildLebaneseTrialBalanceTree([cash, payroll], rowByAccountId, '1', '7', [], {
      hideInactiveAccounts: true,
      includeZeroBalance: true,
    });

    const class5 = roots.find((node) => node.code === '5');
    const class6 = roots.find((node) => node.code === '6');
    expect(class5?.row.periodDebit).toBeGreaterThan(0);
    expect(class6?.row.periodDebit).toBeGreaterThan(0);
    expect(class5?.row.periodDebit).toBe(400);
    expect(class6?.row.periodDebit).toBe(250);
  });
});
