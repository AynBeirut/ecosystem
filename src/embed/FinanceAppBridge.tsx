import React from 'react';
import './wireFinanceOnLoad';
import { FinanceEmbedProvider } from '../../vendor/beirut-finance-flow-main/src/context/FinanceEmbedContext';
import { AppProvider } from '../../vendor/beirut-finance-flow-main/src/context/AppContext';
import { AccountingProvider } from '../../vendor/beirut-finance-flow-main/src/context/AccountingContext';
import { LedgerProvider } from '../../vendor/beirut-finance-flow-main/src/context/LedgerContext';
import type { GrabioStoreProfile } from '../../vendor/beirut-finance-flow-main/src/lib/grabio/types';

const FINANCE_EMBED_BASE = '/admin/finance';

type FinanceAppBridgeProps = {
  children: React.ReactNode;
  seedProfile?: GrabioStoreProfile | null;
  seedStoreId?: string | null;
};

export default function FinanceAppBridge({
  children,
  seedProfile = null,
  seedStoreId = null,
}: FinanceAppBridgeProps) {
  return (
    <FinanceEmbedProvider
      embedded
      basePath={FINANCE_EMBED_BASE}
      seedProfile={seedProfile}
      seedStoreId={seedStoreId}
    >
      <AppProvider embedded>
        <AccountingProvider>
          <LedgerProvider>{children}</LedgerProvider>
        </AccountingProvider>
      </AppProvider>
    </FinanceEmbedProvider>
  );
}
