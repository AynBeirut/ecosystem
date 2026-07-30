import type { LedgerAccount } from '@/types/generalLedger';
import { mapGrabioCodeToPcg } from '@/lib/ledger/grabioToPcgMap';

/** Prefer PCG ledger row (5300…) over Grabio operational (102…) when chart is seeded. */
export function resolvePostingAccount(accounts: LedgerAccount[], grabioCode: string): LedgerAccount {
  const code = String(grabioCode || '').trim();
  const pcgCode = mapGrabioCodeToPcg(code);
  if (pcgCode) {
    const pcg = accounts.find((a) => a.code === pcgCode && a.isActive && a.isPcgChart);
    if (pcg) return pcg;
  }
  const grabio = accounts.find((a) => a.code === code && a.isActive);
  if (!grabio) {
    throw new Error(`GL account ${code} not found. Initialize Chart of Accounts first.`);
  }
  return grabio;
}
