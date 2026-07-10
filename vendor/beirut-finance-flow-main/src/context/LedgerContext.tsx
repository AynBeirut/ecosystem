import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { getFinanceAuth } from '@/integrations/firebase/client';
import {
  ensureDefaultChartOfAccounts,
  loadLedgerBundle,
} from '@/lib/firestore/ledgerFirestore';
import {
  closeLedgerPeriod,
  reopenLedgerPeriod,
  type PeriodLockActor,
} from '@/lib/ledger/periodLock';
import { findClosedPeriodForDate, periodContainingAsOfDate } from '@/lib/ledger/periodLockCore';
import {
  postJournalEntry,
  postOpeningBalanceEntry,
  updateAccountOpeningBalance,
  validateBalancedLines,
  type PostJournalResult,
} from '@/lib/ledger/postingService';
import { buildTrialBalance } from '@/lib/ledger/trialBalance';
import { buildBalanceSheet } from '@/lib/ledger/balanceSheet';
import type {
  JournalEntry,
  JournalLine,
  JournalLineInput,
  LedgerAccount,
  LedgerPeriodClosure,
  PeriodLockType,
  TrialBalanceReport,
  BalanceSheetReport,
} from '@/types/generalLedger';
import { toast } from 'sonner';

interface LedgerContextType {
  loading: boolean;
  accounts: LedgerAccount[];
  entries: JournalEntry[];
  lines: JournalLine[];
  periodClosures: LedgerPeriodClosure[];
  asOfDate: string;
  setAsOfDate: (d: string) => void;
  asOfPeriod: LedgerPeriodClosure | null;
  asOfPeriodLocked: boolean;
  isDateLocked: (dateIso: string) => boolean;
  trialBalance: TrialBalanceReport;
  balanceSheet: BalanceSheetReport;
  ensureCoa: () => Promise<LedgerAccount[]>;
  refreshLedger: () => Promise<void>;
  postManualEntry: (params: {
    date: string;
    memo: string;
    lines: JournalLineInput[];
  }) => Promise<PostJournalResult>;
  setOpeningBalance: (accountId: string, amount: number, date: string) => Promise<void>;
  closePeriod: (periodType: PeriodLockType, year: number, monthOrQuarter: number, note?: string) => Promise<LedgerPeriodClosure>;
  reopenPeriod: (periodId: string, reason: string) => Promise<LedgerPeriodClosure>;
  accountsById: Map<string, LedgerAccount>;
  accountsByCode: Map<string, LedgerAccount>;
}

const LedgerContext = createContext<LedgerContextType | undefined>(undefined);

export const LedgerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeOrganizationId: storeId } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [lines, setLines] = useState<JournalLine[]>([]);
  const [periodClosures, setPeriodClosures] = useState<LedgerPeriodClosure[]>([]);
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));

  const closedPeriods = useMemo(
    () => periodClosures.filter((p) => p.isClosed),
    [periodClosures],
  );

  const asOfPeriod = useMemo(
    () => periodContainingAsOfDate(asOfDate, periodClosures),
    [asOfDate, periodClosures],
  );

  const asOfPeriodLocked = Boolean(asOfPeriod?.isClosed);

  const isDateLocked = useCallback(
    (dateIso: string) => Boolean(findClosedPeriodForDate(dateIso, closedPeriods)),
    [closedPeriods],
  );

  const resolveActor = useCallback((): PeriodLockActor => {
    const user = getFinanceAuth().currentUser;
    if (!user) throw new Error('Sign in to manage period locks.');
    return {
      userId: user.uid,
      ...(user.email ? { userEmail: user.email } : {}),
      ...(user.displayName ? { userName: user.displayName } : {}),
    };
  }, []);

  const refreshLedger = useCallback(async () => {
    if (!storeId) {
      setAccounts([]);
      setEntries([]);
      setLines([]);
      setPeriodClosures([]);
      return;
    }
    setLoading(true);
    try {
      const bundle = await loadLedgerBundle(storeId);
      setAccounts(bundle.accounts);
      setEntries(bundle.entries);
      setLines(bundle.lines);
      setPeriodClosures(bundle.periodClosures);
    } catch (err) {
      console.error('[Ledger] load failed', err);
      toast.error('Failed to load general ledger data.');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  const ensureCoa = useCallback(async () => {
    if (!storeId) return [];
    const seeded = await ensureDefaultChartOfAccounts(storeId);
    setAccounts(seeded);
    await refreshLedger();
    return seeded;
  }, [storeId, refreshLedger]);

  useEffect(() => {
    if (!storeId) return;
    void ensureCoa();
  }, [storeId, ensureCoa]);

  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const accountsByCode = useMemo(() => new Map(accounts.map((a) => [a.code, a])), [accounts]);

  const trialBalance = useMemo(
    () => buildTrialBalance(accounts, entries, lines, { endDate: asOfDate }),
    [accounts, entries, lines, asOfDate],
  );

  const balanceSheet = useMemo(
    () => buildBalanceSheet(accounts, entries, lines, asOfDate),
    [accounts, entries, lines, asOfDate],
  );

  const postManualEntry = useCallback(
    async (params: { date: string; memo: string; lines: JournalLineInput[] }) => {
      if (!storeId) throw new Error('No active store');
      const validation = validateBalancedLines(params.lines);
      if (!validation.valid) throw new Error(validation.message);

      let accts = accounts;
      if (!accts.length) accts = await ensureCoa();

      const result = await postJournalEntry(
        {
          storeId,
          date: params.date,
          memo: params.memo,
          sourceType: 'manual',
          sourceId: `manual-${Date.now()}`,
          event: 'post',
          lines: params.lines,
        },
        new Map(accts.map((a) => [a.id, a])),
      );

      await refreshLedger();
      return result;
    },
    [storeId, accounts, ensureCoa, refreshLedger],
  );

  const setOpeningBalance = useCallback(
    async (accountId: string, amount: number, date: string) => {
      if (!storeId) throw new Error('No active store');
      let accts = accounts;
      if (!accts.length) accts = await ensureCoa();
      const account = accts.find((a) => a.id === accountId);
      if (!account) throw new Error('Account not found');

      await updateAccountOpeningBalance(storeId, accountId, amount);
      await postOpeningBalanceEntry(
        storeId,
        { ...account, openingBalance: amount },
        amount,
        date,
        new Map(accts.map((a) => [a.id, a])),
      );
      await refreshLedger();
    },
    [storeId, accounts, ensureCoa, refreshLedger],
  );

  const closePeriod = useCallback(
    async (periodType: PeriodLockType, year: number, monthOrQuarter: number, note?: string) => {
      if (!storeId) throw new Error('No active store');
      const result = await closeLedgerPeriod(storeId, periodType, year, monthOrQuarter, resolveActor(), note);
      await refreshLedger();
      return result;
    },
    [storeId, resolveActor, refreshLedger],
  );

  const reopenPeriod = useCallback(
    async (periodId: string, reason: string) => {
      if (!storeId) throw new Error('No active store');
      const result = await reopenLedgerPeriod(storeId, periodId, resolveActor(), reason);
      await refreshLedger();
      return result;
    },
    [storeId, resolveActor, refreshLedger],
  );

  const value: LedgerContextType = {
    loading,
    accounts,
    entries,
    lines,
    periodClosures,
    asOfDate,
    setAsOfDate,
    asOfPeriod,
    asOfPeriodLocked,
    isDateLocked,
    trialBalance,
    balanceSheet,
    ensureCoa,
    refreshLedger,
    postManualEntry,
    setOpeningBalance,
    closePeriod,
    reopenPeriod,
    accountsById,
    accountsByCode,
  };

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
};

export const useLedger = () => {
  const ctx = useContext(LedgerContext);
  if (!ctx) throw new Error('useLedger must be used within LedgerProvider');
  return ctx;
};
