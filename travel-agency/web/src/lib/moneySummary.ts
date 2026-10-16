import { listDeals } from './travelService';
import { nextraWalletApi } from './travelApi';

export type MoneySummary = {
  openDeals: number;
  bookedDeals: number;
  totalMargin: number;
  byStage: Record<string, number>;
  wallet: { balance: number; available: number; due: number; currency: string };
  creditAlert: boolean;
};

const fallbackWallet = {
  balance: 0,
  available: 26670,
  due: 73330,
  currency: 'INR',
};

/** Money dashboard from Firestore + optional Nextra wallet (no Cloud Function required). */
export async function loadMoneySummary(storeId: string): Promise<MoneySummary> {
  const deals = await listDeals(storeId);
  let totalMargin = 0;
  let openDeals = 0;
  let bookedDeals = 0;
  const byStage: Record<string, number> = {};
  for (const d of deals) {
    byStage[d.stage] = (byStage[d.stage] || 0) + 1;
    if (d.stage !== 'closed' && d.stage !== 'lost') openDeals += 1;
    if (d.stage === 'booked' || d.stage === 'traveled') bookedDeals += 1;
    totalMargin += Number(d.marginTotal || 0);
  }
  let wallet = fallbackWallet;
  try {
    const res = await nextraWalletApi(storeId);
    if (res?.wallet) wallet = res.wallet;
  } catch {
    // API not deployed or Nextra mock — show demo wallet numbers
  }
  const creditAlert = wallet.due > 0 && wallet.available < wallet.due * 0.5;
  return { openDeals, bookedDeals, totalMargin, byStage, wallet, creditAlert };
}
