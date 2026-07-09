export type AiCreditPack = {
  id: string;
  label: string;
  credits: number;
  priceUsd: number;
};

export const AI_CREDIT_PACKS: AiCreditPack[] = [
  { id: 'pack_100', label: '100 credits', credits: 100, priceUsd: 5 },
  { id: 'pack_500', label: '500 credits', credits: 500, priceUsd: 20 },
  { id: 'pack_2000', label: '2000 credits', credits: 2000, priceUsd: 70 },
];

export type AiCreditLedgerEntry = {
  id?: string;
  type: 'purchase' | 'deduction' | 'refund' | 'grant';
  credits: number;
  balanceAfter: number;
  reason: string;
  modelId?: string;
  createdAt: string;
};

export function getAiCreditBalance(profile: { aiCreditBalance?: number } | null | undefined): number {
  return Math.max(0, Number(profile?.aiCreditBalance) || 0);
}

export function canAffordCredits(balance: number, cost: number): boolean {
  return balance >= cost;
}
