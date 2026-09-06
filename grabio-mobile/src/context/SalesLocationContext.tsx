import React, { createContext, useContext } from 'react';
import { useMandatorySalesLocation } from '../hooks/useMandatorySalesLocation';

type SalesLocationState = ReturnType<typeof useMandatorySalesLocation>;

const SalesLocationContext = createContext<SalesLocationState | null>(null);

export function SalesLocationProvider({ children }: { children: React.ReactNode }) {
  const value = useMandatorySalesLocation();
  return <SalesLocationContext.Provider value={value}>{children}</SalesLocationContext.Provider>;
}

export function useSalesLocation(): SalesLocationState {
  const ctx = useContext(SalesLocationContext);
  if (!ctx) {
    return { required: false, ready: true, checking: false, retry: () => undefined };
  }
  return ctx;
}
