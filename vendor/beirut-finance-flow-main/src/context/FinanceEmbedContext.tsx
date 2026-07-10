import React, { createContext, useContext, useMemo } from 'react';

export type FinanceEmbedContextValue = {
  embedded: boolean;
  basePath: string;
};

const FinanceEmbedContext = createContext<FinanceEmbedContextValue>({
  embedded: false,
  basePath: '',
});

export function FinanceEmbedProvider({
  embedded,
  basePath,
  children,
}: {
  embedded: boolean;
  basePath: string;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ embedded, basePath }), [embedded, basePath]);
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
