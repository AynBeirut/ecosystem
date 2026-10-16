import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  type InvoiceManagerDatePreset,
  type InvoiceManagerDateRange,
  isInInvoiceManagerDateRange,
  resolveInvoiceManagerDateRange,
} from '@/lib/invoiceManagerDateFilter';

type InvoiceManagerDateFilterContextValue = {
  preset: InvoiceManagerDatePreset;
  setPreset: (preset: InvoiceManagerDatePreset) => void;
  customStart: string;
  customEnd: string;
  setCustomStart: (value: string) => void;
  setCustomEnd: (value: string) => void;
  range: InvoiceManagerDateRange;
  matchesDate: (value: unknown, includeWhenMissing?: boolean) => boolean;
};

const InvoiceManagerDateFilterContext = createContext<InvoiceManagerDateFilterContextValue | null>(null);

export function InvoiceManagerDateFilterProvider({ children }: { children: React.ReactNode }) {
  const [preset, setPreset] = useState<InvoiceManagerDatePreset>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const range = useMemo(
    () => resolveInvoiceManagerDateRange(preset, customStart, customEnd),
    [preset, customStart, customEnd],
  );

  const matchesDate = useCallback(
    (value: unknown, includeWhenMissing = true) =>
      isInInvoiceManagerDateRange(value, range, includeWhenMissing),
    [range],
  );

  const value = useMemo(
    () => ({
      preset,
      setPreset,
      customStart,
      customEnd,
      setCustomStart,
      setCustomEnd,
      range,
      matchesDate,
    }),
    [preset, customStart, customEnd, range, matchesDate],
  );

  return (
    <InvoiceManagerDateFilterContext.Provider value={value}>
      {children}
    </InvoiceManagerDateFilterContext.Provider>
  );
}

export function useInvoiceManagerDateFilter() {
  const ctx = useContext(InvoiceManagerDateFilterContext);
  if (!ctx) {
    throw new Error('useInvoiceManagerDateFilter must be used within InvoiceManagerDateFilterProvider');
  }
  return ctx;
}

/** Safe when embed runs outside invoice manager shell (no-op filter). */
export function useInvoiceManagerDateFilterOptional() {
  const ctx = useContext(InvoiceManagerDateFilterContext);
  return ctx;
}
