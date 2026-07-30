import type {
  FixedAsset,
  JournalLineInput,
  LedgerAccount,
} from '@/types/generalLedger';
import { postJournalEntry } from '@/lib/ledger/postingService';
import {
  applyDepreciationToAssets,
  setLedgerAccountsActive,
} from '@/lib/firestore/fixedAssetsFirestore';
import {
  buildDepreciationRunPreview,
  depreciationForMonth,
  depreciationSourceId,
  depreciableBase,
} from '@/lib/ledger/depreciationSchedule';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type PostDepreciationResult = {
  entryId: string;
  idempotentReplay: boolean;
  totalPosted: number;
};

export async function postMonthlyDepreciation(params: {
  storeId: string;
  year: number;
  month: number;
  assets: FixedAsset[];
  accounts: LedgerAccount[];
  createdBy?: string;
  periodLocked?: boolean;
}): Promise<PostDepreciationResult> {
  const preview = buildDepreciationRunPreview(params.assets, params.year, params.month, {
    periodLocked: params.periodLocked,
    currency: params.accounts[0]?.currency,
  });
  if (!preview.canPost) {
    throw new Error(preview.blockReason || 'Nothing to post');
  }

  const accountsById = new Map(params.accounts.map((a) => [a.id, a]));
  const accountsByCode = new Map(params.accounts.map((a) => [a.code, a]));

  const codesToActivate = new Set<string>(['710']);
  for (const asset of params.assets) {
    codesToActivate.add(asset.expenseAccountCode);
    codesToActivate.add(asset.accumDeprAccountCode);
    codesToActivate.add(asset.assetAccountCode);
  }
  await setLedgerAccountsActive(params.storeId, [...codesToActivate]);
  for (const a of params.accounts) {
    if (codesToActivate.has(a.code)) a.isActive = true;
  }

  const expenseTotals = new Map<string, number>();
  const accumTotals = new Map<string, number>();
  const assetUpdates: Array<{
    assetId: string;
    amount: number;
    newAccumulated: number;
    newStatus: FixedAsset['status'];
  }> = [];

  for (const asset of params.assets) {
    if (asset.status !== 'active') continue;
    const amount = depreciationForMonth(asset, params.year, params.month);
    if (amount <= 0) continue;

    const expCode = asset.expenseAccountCode || '710';
    const accumCode = asset.accumDeprAccountCode || '156';
    expenseTotals.set(expCode, round2((expenseTotals.get(expCode) || 0) + amount));
    accumTotals.set(accumCode, round2((accumTotals.get(accumCode) || 0) + amount));

    const newAccum = round2((asset.accumulatedDepreciation || 0) + amount);
    const fully = newAccum >= depreciableBase(asset);
    assetUpdates.push({
      assetId: asset.id,
      amount,
      newAccumulated: newAccum,
      newStatus: fully ? 'fully_depreciated' : 'active',
    });
  }

  const lines: JournalLineInput[] = [];
  for (const [code, amount] of expenseTotals) {
    const acct = accountsByCode.get(code);
    if (!acct?.isActive) throw new Error(`Depreciation expense account ${code} is not on the chart.`);
    lines.push({ accountId: acct.id, debit: amount, credit: 0, description: 'Depreciation expense' });
  }
  for (const [code, amount] of accumTotals) {
    const acct = accountsByCode.get(code);
    if (!acct?.isActive) throw new Error(`Accumulated depreciation account ${code} is not on the chart.`);
    lines.push({ accountId: acct.id, debit: 0, credit: amount, description: 'Accumulated depreciation' });
  }

  const result = await postJournalEntry(
    {
      storeId: params.storeId,
      date: preview.postDate,
      memo: `Monthly depreciation ${preview.periodLabel}`,
      sourceType: 'depreciation',
      sourceId: depreciationSourceId(params.year, params.month),
      event: 'post',
      createdBy: params.createdBy,
      lines,
    },
    accountsById,
  );

  if (!result.idempotentReplay && assetUpdates.length > 0) {
    await applyDepreciationToAssets(params.storeId, assetUpdates);
  }

  return {
    entryId: result.entryId,
    idempotentReplay: result.idempotentReplay,
    totalPosted: preview.totalDepreciation,
  };
}
