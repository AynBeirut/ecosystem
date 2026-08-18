import { describe, expect, it } from 'vitest';
import { LEBANESE_PCG_CHART } from '@/lib/ledger/lebanesePcgChart.generated';
import { buildPcgTree, filterPcgTree, nodeCanAddClientAccount, pcgAddTargetFromNode, pcgClassSuffix, resolveLedgerAccountIdsForPcgNode } from '@/lib/ledger/lebanesePcgTree';
import type { LedgerAccount } from '@/types/generalLedger';

describe('lebanesePcgTree', () => {
  it('builds seven legacy class roots from inferred PCG parents', () => {
    const tree = buildPcgTree(LEBANESE_PCG_CHART, []);
    expect(tree.length).toBeGreaterThanOrEqual(5);
    expect(tree.length).toBeLessThanOrEqual(8);
    expect(tree.some((node) => node.code === '6' && node.name === 'Expenditure')).toBe(true);
  });

  it('nests client sub-accounts under parent PCG code', () => {
    const tree = buildPcgTree(LEBANESE_PCG_CHART, [
      {
        id: 'c1',
        storeId: 's1',
        clientCode: '53001000001',
        grabioOperationalCode: '102',
        parentPcgCode: '5300',
        name: 'Cash USD',
        nameAr: 'صندوق',
        currency: 'USD',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ]);
    const cashNode = tree.flatMap(function flatten(node) {
      return [node, ...node.children.flatMap(flatten)];
    }).find((node) => node.code === '5300');
    expect(cashNode?.children.some((child) => child.code === '53001000001')).toBe(true);
  });

  it('filters tree while keeping ancestor paths', () => {
    const tree = buildPcgTree(LEBANESE_PCG_CHART, []);
    const filtered = filterPcgTree(tree, 'capital');
    expect(filtered.length).toBeGreaterThan(0);
  });

  it('maps class suffix for expenditure and income', () => {
    expect(pcgClassSuffix('6011')).toBe('[ E ]');
    expect(pcgClassSuffix('7010')).toBe('[ I ]');
    expect(pcgClassSuffix('5300')).toBe('');
  });

  it('allows add target on class roots 1–7', () => {
    const tree = buildPcgTree(LEBANESE_PCG_CHART, []);
    const class4 = tree.find((node) => node.code === '4');
    expect(class4).toBeTruthy();
    const target = class4 ? pcgAddTargetFromNode(class4) : null;
    expect(target?.code).toBe('4');
    expect(nodeCanAddClientAccount(class4!)).toBe(true);
  });

  it('nests 6011 detail under 6010 group header', () => {
    const tree = buildPcgTree(LEBANESE_PCG_CHART, []);
    const class6 = tree.find((node) => node.code === '6');
    const group6010 = class6?.children.find((node) => node.code === '6010');
    expect(group6010).toBeTruthy();
    expect(group6010?.children.some((node) => node.code === '6011')).toBe(true);
    expect(group6010?.children.some((node) => node.code === '6012')).toBe(true);
  });

  it('resolves operational ledger account for mapped PCG detail', () => {
    const tree = buildPcgTree(LEBANESE_PCG_CHART, []);
    const apNode = tree
      .flatMap(function flatten(node) {
        return [node, ...node.children.flatMap(flatten)];
      })
      .find((node) => node.code === '4011');
    expect(apNode).toBeTruthy();
    const accounts: LedgerAccount[] = [
      {
        id: 'acct-201',
        storeId: 's1',
        code: '201',
        name: 'AP',
        type: 'liability',
        normalBalance: 'credit',
        isActive: true,
        openingBalance: 0,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ];
    const ids = apNode ? resolveLedgerAccountIdsForPcgNode(apNode, accounts) : [];
    expect(ids).toContain('acct-201');
  });
});
