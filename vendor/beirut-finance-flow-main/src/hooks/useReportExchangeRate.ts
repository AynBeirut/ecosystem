import { useEffect, useMemo, useState } from 'react';
import { useGrabioStore } from '@/hooks/useGrabioStore';
import { useFinanceTable } from '@/hooks/useFinanceTable';
import { resolveLiveUsdToLbpRate } from '@/lib/currency/usdLbpRate';
import { resolveStoreLedgerCurrency } from '@/lib/ledger/formatLedgerAmount';
import {
  resolveUsdToLbpFromCurrencySettings,
  resolveUsdToLbpFromProfile,
  shouldFetchLiveUsdToLbpRate,
  type FinanceCurrencyRateRow,
} from '@/lib/ledger/resolveExchangeRate';

export type ReportExchangeRateState = {
  /** 1 USD = X LBP — from profile, currency settings, or live API (auto mode). */
  usdToLbp?: number;
  storeLedgerCurrency: string;
  exchangeRateMode: 'manual' | 'auto';
  loading: boolean;
};

/**
 * USD ledger + LBP display: manual profile rate → currency settings → live API (auto when unset).
 */
export function useReportExchangeRate(): ReportExchangeRateState {
  const { profile } = useGrabioStore();
  const { data: currencySettings, loading: settingsLoading } = useFinanceTable<
    FinanceCurrencyRateRow & { id: string }
  >('currencySettings');

  const [liveRate, setLiveRate] = useState<number | undefined>();
  const [liveLoading, setLiveLoading] = useState(false);

  const profileRate = useMemo(() => resolveUsdToLbpFromProfile(profile), [profile]);
  const settingsRate = useMemo(
    () => resolveUsdToLbpFromCurrencySettings(currencySettings),
    [currencySettings],
  );
  const exchangeRateMode = profile?.exchangeRateMode === 'auto' ? 'auto' : 'manual';
  const storeLedgerCurrency = useMemo(
    () => resolveStoreLedgerCurrency(profile?.mainCurrency, { secondaryCurrency: profile?.secondaryCurrency }),
    [profile?.mainCurrency, profile?.secondaryCurrency],
  );

  const storedRate = profileRate ?? settingsRate;

  useEffect(() => {
    if (storedRate) {
      setLiveRate(undefined);
      return;
    }
    if (!shouldFetchLiveUsdToLbpRate(storedRate)) return;

    let cancelled = false;
    setLiveLoading(true);
    void resolveLiveUsdToLbpRate()
      .then((rate) => {
        if (!cancelled) setLiveRate(rate);
      })
      .finally(() => {
        if (!cancelled) setLiveLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [storedRate]);

  const usdToLbp = storedRate ?? liveRate;

  return {
    usdToLbp,
    storeLedgerCurrency,
    exchangeRateMode,
    loading: settingsLoading || liveLoading,
  };
}
