import React, { createContext, useContext, useMemo } from 'react';
import type { GrabioStoreProfile } from '@/lib/grabio/types';

export type FinanceEmbedContextValue = {
  embedded: boolean;
  basePath: string;
  seedProfile?: GrabioStoreProfile | null;
  seedStoreId?: string | null;
};

const FinanceEmbedContext = createContext<FinanceEmbedContextValue>({
  embedded: false,
  basePath: '',
  seedProfile: null,
  seedStoreId: null,
});

export function FinanceEmbedProvider({
  embedded,
  basePath,
  seedProfile = null,
  seedStoreId = null,
  children,
}: {
  embedded: boolean;
  basePath: string;
  seedProfile?: GrabioStoreProfile | null;
  seedStoreId?: string | null;
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => ({ embedded, basePath, seedProfile, seedStoreId }),
    [embedded, basePath, seedProfile, seedStoreId],
  );
  return (
    <FinanceEmbedContext.Provider value={value}>{children}</FinanceEmbedContext.Provider>
  );
}

export function useFinanceEmbed() {
  return useContext(FinanceEmbedContext);
}

export function financePath(basePath: string, subpath: string): string {
  const normalized = subpath.startsWith('/') ? subpath : `/${subpath}`;
  if (!basePath) return normalized;
  return `${basePath.replace(/\/$/, '')}${normalized}`;
}
