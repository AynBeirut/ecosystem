import type { ReactNode } from 'react';
import AppLayout from '@/components/AppLayout';
import { useFinanceEmbed } from '@/context/FinanceEmbedContext';

type FinancePageShellProps = {
  children: ReactNode;
  onLogout?: () => void;
};

/** Standalone /invoice uses AppLayout; embedded Grabio admin renders content only. */
export default function FinancePageShell({ children, onLogout }: FinancePageShellProps) {
  const { embedded } = useFinanceEmbed();

  if (embedded) {
    return <div className="finance-embed-content min-w-0">{children}</div>;
  }

  return <AppLayout onLogout={onLogout ?? (() => undefined)}>{children}</AppLayout>;
}
