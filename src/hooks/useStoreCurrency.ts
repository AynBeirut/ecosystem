import { useEffect, useMemo, useState } from 'react';
import { doc, getFirestore, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import {
  formatMoney,
  setDefaultNumberFormat,
  type FormatMoneyOptions,
  type NumberFormatStyle,
} from '@/lib/money/format';
import { normalizeCurrencyCode } from '@/lib/money/currencies';

export interface StoreCurrencyContext {
  /** Store base currency code (normalized, defaults USD). */
  currency: string;
  /** Large-number display style from the store profile. */
  numberFormat: NumberFormatStyle;
  /** Secondary/display currency code, if configured (Phase 3). */
  secondaryCurrency?: string;
  /** Manual exchange rate (base -> secondary), if configured. */
  exchangeRate?: number;
  /** Format an amount in the store's base currency + number style. */
  money: (amount: number, opts?: Partial<FormatMoneyOptions>) => string;
  /** True once the profile has loaded (before that, safe USD defaults apply). */
  loaded: boolean;
}

/**
 * Single source for a component to format money in the store's base currency and
 * large-number style. Subscribes to the store profile so changes to the Base
 * Currency / Large-Number toggle reflect live, and keeps the module-level
 * default in sync so non-hook formatters honor the toggle too.
 */
export function useStoreCurrency(): StoreCurrencyContext {
  const { user } = useAuth();
  const [currency, setCurrency] = useState('USD');
  const [numberFormat, setNumberFormat] = useState<NumberFormatStyle>('full');
  const [secondaryCurrency, setSecondaryCurrency] = useState<string | undefined>(undefined);
  const [exchangeRate, setExchangeRate] = useState<number | undefined>(undefined);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const storeId = getActualStoreId(user);
    if (!storeId) return;
    const db = getFirestore();
    const unsub = onSnapshot(
      doc(db, 'storeProfiles', storeId),
      (snap) => {
        const data = snap.exists() ? snap.data() || {} : {};
        const code = normalizeCurrencyCode((data as { mainCurrency?: unknown }).mainCurrency);
        const style: NumberFormatStyle =
          (data as { numberFormat?: unknown }).numberFormat === 'compact' ? 'compact' : 'full';
        setCurrency(code);
        setNumberFormat(style);
        const secRaw = (data as { secondaryCurrency?: unknown }).secondaryCurrency;
        setSecondaryCurrency(
          typeof secRaw === 'string' && secRaw.trim() && secRaw !== code ? secRaw : undefined,
        );
        const rate = Number((data as { customExchangeRate?: unknown }).customExchangeRate);
        setExchangeRate(Number.isFinite(rate) && rate > 0 ? rate : undefined);
        setDefaultNumberFormat(style);
        setLoaded(true);
      },
      () => setLoaded(true),
    );
    return () => unsub();
  }, [user]);

  return useMemo<StoreCurrencyContext>(() => {
    const money = (amount: number, opts?: Partial<FormatMoneyOptions>) =>
      formatMoney(amount, { currency, style: numberFormat, ...opts });
    return { currency, numberFormat, secondaryCurrency, exchangeRate, money, loaded };
  }, [currency, numberFormat, secondaryCurrency, exchangeRate, loaded]);
}
