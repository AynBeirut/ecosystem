import { mapGrabioCodeToPcg } from './grabioToPcgMap';

type PostingAccount = {
  id: string;
  code: string;
  name: string;
  isActive?: boolean;
  isPcgChart?: boolean;
};

export function resolvePostingAccount(accounts: PostingAccount[], grabioCode: string): PostingAccount {
  const code = String(grabioCode || '').trim();
  const pcgCode = mapGrabioCodeToPcg(code);
  if (pcgCode) {
    const pcg = accounts.find(
      (a) => a.code === pcgCode && a.isActive !== false && (a as { isPcgChart?: boolean }).isPcgChart,
    );
    if (pcg) return { ...pcg, isActive: pcg.isActive !== false };
  }
  const grabio = accounts.find((a) => a.code === code && a.isActive !== false);
  if (!grabio) throw new Error(`GL account ${code} not found. Initialize Chart of Accounts first.`);
  return { ...grabio, isActive: grabio.isActive !== false };
}
