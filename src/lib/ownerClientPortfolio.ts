import { collection, getDocs, type Firestore } from 'firebase/firestore';

export type OwnerClientBillingFrequency = 'monthly' | 'yearly' | 'per_project';

export type OwnerClientContractLine = {
  id: string;
  label: string;
  amountUsd: number | null;
  frequency: OwnerClientBillingFrequency;
  note?: string;
};

export type OwnerClientPortfolioEntry = {
  id: string;
  clientName: string;
  contactName?: string;
  grabioAccount?: string;
  billingModel: 'recurring' | 'project';
  contracts: OwnerClientContractLine[];
  paymentMethod: string;
  billingNote?: string;
  financeClientIds?: string[];
  status: 'active' | 'paused';
};

export type OwnerClientReceiptRow = {
  id: string;
  clientId: string;
  clientName: string;
  amount: number;
  paymentDate: string;
  voucherNumber: string;
};

export type OwnerClientPortfolioMetrics = {
  entry: OwnerClientPortfolioEntry;
  expectedMonthlyUsd: number | null;
  expectedYearlyUsd: number | null;
  receivedMonthUsd: number;
  receivedYtdUsd: number;
  receiptCount: number;
  lastPaymentDate?: string;
};

/** Anwar E-Service — freelance / agency client contracts (terms from owner; cash from financeReceipts only). */
export const OWNER_CLIENT_PORTFOLIO_CATALOG: OwnerClientPortfolioEntry[] = [
  {
    id: 'gj-properties-wissam',
    clientName: 'GJ Properties',
    contactName: 'Wissam Mansour',
    grabioAccount: 'GJ Properties SEO program (Grabio)',
    billingModel: 'recurring',
    contracts: [
      { id: 'gj-wp', label: 'WordPress maintenance', amountUsd: 500, frequency: 'monthly' },
      { id: 'gj-seo', label: 'SEO project', amountUsd: 500, frequency: 'monthly' },
    ],
    paymentMethod: 'Whish (mostly)',
    financeClientIds: ['cli-wissam-web-app'],
    status: 'active',
  },
  {
    id: 'medea-indogo',
    clientName: 'Medea Company',
    contactName: 'Indogo',
    grabioAccount: 'Indogo store — Grabio builder package',
    billingModel: 'recurring',
    contracts: [
      {
        id: 'indogo-grabio',
        label: 'Grabio platform account',
        amountUsd: 600,
        frequency: 'yearly',
        note: 'Builder package — billed manually until subscription checkout is live',
      },
      {
        id: 'indogo-wp-server',
        label: 'WordPress hosting (Grabio-rented server)',
        amountUsd: null,
        frequency: 'yearly',
        note: 'VPS rented by Grabio for client WP — amount pending',
      },
    ],
    paymentMethod: 'Manual invoice',
    billingNote: 'Yearly Grabio platform fee + WP server cost invoiced manually until builder billing is complete.',
    status: 'active',
  },
  {
    id: 'custom-dev-projects',
    clientName: 'Website / app / software clients',
    contactName: 'Per project',
    billingModel: 'project',
    contracts: [
      {
        id: 'scoped-dev',
        label: 'New website, mobile app, or custom software',
        amountUsd: null,
        frequency: 'per_project',
        note: 'No fixed retainer — quoted per scope',
      },
    ],
    paymentMethod: 'Whish / bank / per agreement',
    status: 'active',
  },
];

function toPaymentDate(data: Record<string, unknown>): string {
  const raw =
    (typeof data.paymentDate === 'string' && data.paymentDate) ||
    (typeof data.paidAt === 'string' && data.paidAt) ||
    (typeof data.date === 'string' && data.date) ||
    '';
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'pending') return '';
  return trimmed.slice(0, 10);
}

export function expectedMonthlyFromContracts(contracts: OwnerClientContractLine[]): number | null {
  let monthly = 0;
  let hasFixed = false;
  for (const line of contracts) {
    if (line.amountUsd == null || line.amountUsd <= 0) continue;
    hasFixed = true;
    if (line.frequency === 'monthly') monthly += line.amountUsd;
    if (line.frequency === 'yearly') monthly += line.amountUsd / 12;
  }
  return hasFixed ? Math.round(monthly * 100) / 100 : null;
}

export function expectedYearlyFromContracts(contracts: OwnerClientContractLine[]): number | null {
  let yearly = 0;
  let hasFixed = false;
  for (const line of contracts) {
    if (line.amountUsd == null || line.amountUsd <= 0) continue;
    hasFixed = true;
    if (line.frequency === 'monthly') yearly += line.amountUsd * 12;
    if (line.frequency === 'yearly') yearly += line.amountUsd;
  }
  return hasFixed ? Math.round(yearly * 100) / 100 : null;
}

export function getOwnerClientPortfolioCatalog(_storeId: string): OwnerClientPortfolioEntry[] {
  return OWNER_CLIENT_PORTFOLIO_CATALOG;
}

export async function listPortfolioReceipts(
  db: Firestore,
  storeId: string,
  catalog: OwnerClientPortfolioEntry[],
): Promise<OwnerClientReceiptRow[]> {
  const clientIdSet = new Set(
    catalog.flatMap((entry) => entry.financeClientIds ?? []),
  );
  if (clientIdSet.size === 0) return [];

  const snap = await getDocs(collection(db, 'stores', storeId, 'financeReceipts'));
  return snap.docs
    .map((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      const clientId = String(data.clientId || '');
      if (!clientIdSet.has(clientId)) return null;
      const amount = Number(data.amount);
      if (!Number.isFinite(amount) || amount <= 0) return null;
      const paymentDate = toPaymentDate(data);
      if (!paymentDate) return null;
      return {
        id: docSnap.id,
        clientId,
        clientName: String(data.clientName || clientId),
        amount: Math.round(amount * 100) / 100,
        paymentDate,
        voucherNumber: String(data.voucherNumber || data.number || docSnap.id),
      } satisfies OwnerClientReceiptRow;
    })
    .filter((row): row is OwnerClientReceiptRow => Boolean(row))
    .sort((a, b) => (a.paymentDate < b.paymentDate ? 1 : a.paymentDate > b.paymentDate ? -1 : 0));
}

export function buildOwnerClientPortfolioMetrics(
  catalog: OwnerClientPortfolioEntry[],
  receipts: OwnerClientReceiptRow[],
  monthKey: string,
  yearKey: string,
): OwnerClientPortfolioMetrics[] {
  return catalog.map((entry) => {
    const ids = new Set(entry.financeClientIds ?? []);
    const matched = receipts.filter((r) => ids.has(r.clientId));
    const receivedMonthUsd = matched
      .filter((r) => r.paymentDate.startsWith(monthKey))
      .reduce((sum, r) => sum + r.amount, 0);
    const receivedYtdUsd = matched
      .filter((r) => r.paymentDate.startsWith(yearKey))
      .reduce((sum, r) => sum + r.amount, 0);

    return {
      entry,
      expectedMonthlyUsd: expectedMonthlyFromContracts(entry.contracts),
      expectedYearlyUsd: expectedYearlyFromContracts(entry.contracts),
      receivedMonthUsd: Math.round(receivedMonthUsd * 100) / 100,
      receivedYtdUsd: Math.round(receivedYtdUsd * 100) / 100,
      receiptCount: matched.length,
      lastPaymentDate: matched[0]?.paymentDate,
    };
  });
}

export function summarizeOwnerClientPortfolio(metrics: OwnerClientPortfolioMetrics[]) {
  const recurring = metrics.filter((m) => m.entry.billingModel === 'recurring');
  const contractMonthly = recurring.reduce(
    (sum, m) => sum + (m.expectedMonthlyUsd ?? 0),
    0,
  );
  const receivedMonth = metrics.reduce((sum, m) => sum + m.receivedMonthUsd, 0);
  const receivedYtd = metrics.reduce((sum, m) => sum + m.receivedYtdUsd, 0);
  return {
    clientCount: metrics.length,
    contractMonthlyUsd: Math.round(contractMonthly * 100) / 100,
    receivedMonthUsd: Math.round(receivedMonth * 100) / 100,
    receivedYtdUsd: Math.round(receivedYtd * 100) / 100,
  };
}

export function formatContractAmount(line: OwnerClientContractLine): string {
  if (line.amountUsd == null) return 'Per project quote';
  const freq =
    line.frequency === 'monthly' ? '/mo' : line.frequency === 'yearly' ? '/yr' : '';
  return `$${line.amountUsd.toFixed(0)}${freq}`;
}
