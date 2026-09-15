import { collection, doc, getDoc, getDocs, type Firestore } from 'firebase/firestore';

export type OwnerWalletSourceKind = 'electrical' | 'yoga' | 'dev';

export type OwnerWalletSource = {
  id: string;
  label: string;
  kind: OwnerWalletSourceKind;
  active: boolean;
};

export type OwnerWalletEntryType = 'income' | 'company_feed';

export type OwnerWalletEntry = {
  id: string;
  type: OwnerWalletEntryType;
  sourceId: string;
  sourceLabel: string;
  kind: OwnerWalletSourceKind | 'company';
  amount: number;
  currency: string;
  paymentDate: string;
  memo?: string;
  voucherNumber?: string;
  linkedDocId?: string;
};

export type OwnerPersonalWalletConfig = {
  sources: OwnerWalletSource[];
  note?: string;
};

export const DEFAULT_OWNER_WALLET_SOURCES: OwnerWalletSource[] = [
  { id: 'cli-youssif-malek-electrical', label: 'Youssif Malek', kind: 'electrical', active: true },
  { id: 'cli-ali-webi-borej-hajal', label: 'Ali Webi — Borej le Hajal', kind: 'electrical', active: true },
  { id: 'cli-firas-yoga', label: 'Firas', kind: 'yoga', active: true },
  { id: 'cli-zeina-yoga', label: 'Zeina Chalak', kind: 'yoga', active: true },
  { id: 'cli-nicole-yoga', label: 'Nicole', kind: 'yoga', active: false },
  { id: 'cli-wissam-web-app', label: 'Wissam Mansour', kind: 'dev', active: true },
];

function toDate(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value.slice(0, 10);
  return '';
}

export async function loadOwnerPersonalWalletConfig(
  db: Firestore,
  storeId: string,
): Promise<OwnerPersonalWalletConfig> {
  const snap = await getDoc(doc(db, 'storeProfiles', storeId));
  const raw = snap.data()?.ownerPersonalWallet as OwnerPersonalWalletConfig | undefined;
  if (raw?.sources?.length) return raw;
  return {
    sources: DEFAULT_OWNER_WALLET_SOURCES,
    note: 'Personal work income feeds the company Whish account until owner vs company is split.',
  };
}

export async function listOwnerWalletEntries(db: Firestore, storeId: string): Promise<OwnerWalletEntry[]> {
  const snap = await getDocs(collection(db, 'stores', storeId, 'ownerWalletEntries'));
  return snap.docs
    .map((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      const amount = Number(data.amount);
      if (!Number.isFinite(amount) || amount <= 0) return null;
      return {
        id: docSnap.id,
        type: data.type as OwnerWalletEntryType,
        sourceId: String(data.sourceId || ''),
        sourceLabel: String(data.sourceLabel || ''),
        kind: (data.kind as OwnerWalletEntry['kind']) || 'company',
        amount: Math.round(amount * 100) / 100,
        currency: String(data.currency || 'USD'),
        paymentDate: toDate(data.paymentDate),
        memo: typeof data.memo === 'string' ? data.memo : undefined,
        voucherNumber: typeof data.voucherNumber === 'string' ? data.voucherNumber : undefined,
        linkedDocId: typeof data.linkedDocId === 'string' ? data.linkedDocId : undefined,
      } satisfies OwnerWalletEntry;
    })
    .filter((row): row is OwnerWalletEntry => Boolean(row))
    .sort((a, b) => (a.paymentDate < b.paymentDate ? 1 : a.paymentDate > b.paymentDate ? -1 : 0));
}

export type OwnerWalletSummary = {
  incomeTotal: number;
  companyFeedTotal: number;
  balance: number;
  incomeBySource: Record<string, number>;
  feedByMonth: Array<{ month: string; label: string; amount: number }>;
  incomeByMonth: Array<{ month: string; label: string; bySource: Record<string, number>; total: number }>;
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  return `${MONTH_NAMES[m - 1] ?? ym} ${y}`;
}

export function summarizeOwnerWallet(
  entries: OwnerWalletEntry[],
  sources: OwnerWalletSource[],
  startDate?: string,
  endDate?: string,
): OwnerWalletSummary {
  const activeIds = new Set(sources.filter((s) => s.active).map((s) => s.id));
  const incomeBySource: Record<string, number> = Object.fromEntries(sources.map((s) => [s.id, 0]));
  let incomeTotal = 0;
  let companyFeedTotal = 0;
  const feedMonthMap = new Map<string, number>();
  const incomeMonthMap = new Map<string, Record<string, number>>();

  for (const entry of entries) {
    if (startDate && entry.paymentDate < startDate) continue;
    if (endDate && entry.paymentDate > endDate) continue;
    const month = entry.paymentDate.slice(0, 7);
    if (entry.type === 'income') {
      if (!activeIds.has(entry.sourceId)) continue;
      incomeBySource[entry.sourceId] = Math.round(((incomeBySource[entry.sourceId] || 0) + entry.amount) * 100) / 100;
      incomeTotal = Math.round((incomeTotal + entry.amount) * 100) / 100;
      const row = incomeMonthMap.get(month) ?? Object.fromEntries(sources.map((s) => [s.id, 0]));
      row[entry.sourceId] = Math.round(((row[entry.sourceId] || 0) + entry.amount) * 100) / 100;
      incomeMonthMap.set(month, row);
    } else if (entry.type === 'company_feed') {
      companyFeedTotal = Math.round((companyFeedTotal + entry.amount) * 100) / 100;
      feedMonthMap.set(month, Math.round(((feedMonthMap.get(month) || 0) + entry.amount) * 100) / 100);
    }
  }

  return {
    incomeTotal,
    companyFeedTotal,
    balance: Math.round((incomeTotal - companyFeedTotal) * 100) / 100,
    incomeBySource,
    feedByMonth: [...feedMonthMap.entries()]
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([month, amount]) => ({ month, label: monthLabel(month), amount })),
    incomeByMonth: [...incomeMonthMap.entries()]
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([month, bySource]) => ({
        month,
        label: monthLabel(month),
        bySource,
        total: Math.round(sources.reduce((sum, s) => sum + (bySource[s.id] || 0), 0) * 100) / 100,
      })),
  };
}
