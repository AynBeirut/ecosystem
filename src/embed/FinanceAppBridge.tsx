import React from 'react';
import './wireFinanceOnLoad';
import { FinanceEmbedProvider } from '../../vendor/beirut-finance-flow-main/src/context/FinanceEmbedContext';
import { AppProvider } from '../../vendor/beirut-finance-flow-main/src/context/AppContext';
import { AccountingProvider } from '../../vendor/beirut-finance-flow-main/src/context/AccountingContext';
import { LedgerProvider } from '../../vendor/beirut-finance-flow-main/src/context/LedgerContext';

const FINANCE_EMBED_BASE = '/admin/finance';

type FinanceAppBridgeProps = {
  children: React.ReactNode;
};

export default function FinanceAppBridge({ children }: FinanceAppBridgeProps) {
  return (
    <FinanceEmbedProvider embedded basePath={FINANCE_EMBED_BASE}>
      <AppProvider embedded>
        <AccountingProvider>
          <LedgerProvider>{children}</LedgerProvider>
        </AccountingProvider>
      </AppProvider>
    </FinanceEmbedProvider>
  );
}
