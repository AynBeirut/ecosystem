import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LedgerAccountCombobox } from "@/components/LedgerAccountCombobox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { VoucherAmountInput } from "@/components/VoucherAmountInput";
import { cn } from "@/lib/utils";
import ReportAmountCell from "@/components/ReportAmountCell";
import type { LedgerAccount, LedgerCostCenter, PcgClientAccount } from "@/types/generalLedger";
import { type AccountingLanguage } from "@/lib/grabio/accountingMode";
import { buildClientByGrabioMap, resolvePcgDisplay } from "@/lib/ledger/grabioToPcgMap";
import {
  normalizeLedgerCurrency,
  formatLedgerAmount,
  type ReportCurrencyMode,
} from "@/lib/ledger/formatLedgerAmount";
import { parseVoucherAmountNumber } from "@/lib/ledger/voucherAmountInput";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  type DraftLine,
  emptyLine,
  lineNeedsFx,
  mirrorJvAmount,
  resyncJvMirrorPairs,
  jvMirrorPairIndex,
  normalizeLineCurrency,
  syncAmountFxFromLedger,
  syncFxOnRateChange,
  draftLinesTotals,
  draftLinesBalanced,
  convertLedgerToTxn,
  convertTxnToLedger,
  activeAmountSide,
  setLineLedgerAmount,
  deriveAmountFxFromLedger,
  applyDefaultFxRateToLine,
  draftMatrixTotals,
  draftMatrixBalanced,
  draftMatrixGaps,
  activeLineMatrixAllocations,
  activeLineSideAllocations,
  buildJvAutoBalanceLine,
  flipJvLineCurrencyFromAlloc,
  resolveEffectiveFxRate,
  syncAuxiliaryAmount,
  applyManualAuxiliaryAmount,
  resolvedAuxiliaryAmount,
  auxiliaryCurrencyLabel,
  foreignCurrencyLabel,
  resolveLineTransactionCurrency,
  accountDefaultLineCurrency,
} from "@/lib/ledger/voucherDraftLineUtils";

const JV_TH =
  "!border !border-[#2a5dad] !bg-[#316ac5] !px-2 !py-1.5 !text-[11px] !font-semibold !text-white";
const JV_FIELD =
  "!m-0 !box-border !flex !h-8 !min-h-8 !w-full !min-w-0 !max-w-none !items-center !rounded-none !border-0 !bg-transparent !px-2 !text-[12px] !text-slate-900 !shadow-none !outline-none focus-visible:!bg-white focus-visible:!ring-2 focus-visible:!ring-inset focus-visible:!ring-[#316ac5]";
const JV_AMOUNT =
  "!m-0 !box-border !block !h-8 !min-h-8 !w-full !min-w-0 !max-w-none !rounded-none !border-0 !bg-transparent !px-2 !text-right !text-[12px] !font-mono !tabular-nums !text-slate-900 !shadow-none !outline-none focus-visible:!bg-white focus-visible:!ring-2 focus-visible:!ring-inset focus-visible:!ring-[#316ac5]";

type FxConversionEditorProps = {
  line: DraftLine;
  ledgerCurrency: string;
  fxRateDefault?: number;
  onChange: (line: DraftLine) => void;
  compact?: boolean;
};

function FxConversionEditor({ line, ledgerCurrency, fxRateDefault, onChange, compact }: FxConversionEditorProps) {
  if (!lineNeedsFx(line, ledgerCurrency)) return null;
  const rate = resolveEffectiveFxRate(line, fxRateDefault);
  if (rate <= 0) {
    return <p className="mt-0.5 px-1 text-[10px] text-amber-800">Set rate for FX conversion</p>;
  }

  const txn = normalizeLineCurrency(line.transactionCurrency);
  const ledger = normalizeLedgerCurrency(ledgerCurrency);
  const side = activeAmountSide(line);
  const ledgerAmt = Number(line.debit) || Number(line.credit) || 0;
  const resolvedTxn = Number(line.amountFx) || deriveAmountFxFromLedger(line, ledgerCurrency, fxRateDefault) || 0;

  const inputClass = compact
    ? "h-6 w-[4.5rem] min-w-0 rounded-sm border border-slate-400 bg-white px-1 text-[10px] text-right tabular-nums shadow-inner focus-visible:ring-1 focus-visible:ring-[#316ac5]"
    : "legacy-erp-cell-input h-6 w-[4.5rem] text-right text-[10px]";

  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-1 px-1 text-[10px] text-slate-700">
      <span className="shrink-0">≈</span>
      <Input
        className={inputClass}
        type="number"
        min="0"
        step="0.01"
        value={line.amountFx || (resolvedTxn > 0 ? String(resolvedTxn) : "")}
        onChange={(e) => {
          const raw = e.target.value;
          const txnVal = Number(raw) || 0;
          if (!txnVal) {
            onChange({ ...line, amountFx: raw });
            return;
          }
          const ledgerVal = convertTxnToLedger(txnVal, rate, txn, ledger);
          onChange(setLineLedgerAmount({ ...line, amountFx: raw }, ledgerVal, side));
        }}
      />
      <span className="shrink-0 font-semibold">{txn}</span>
      <span className="shrink-0">@</span>
      <Input
        className={cn(inputClass, "w-[5.5rem]")}
        type="number"
        min="0"
        step="1"
        value={line.fxRate || (fxRateDefault ? String(fxRateDefault) : "")}
        onChange={(e) => onChange(syncFxOnRateChange(line, ledgerCurrency, e.target.value, fxRateDefault))}
      />
      <span className="shrink-0">→</span>
      <Input
        className={cn(inputClass, "w-[6.5rem]")}
        type="number"
        min="0"
        step="1"
        value={ledgerAmt > 0 ? String(ledgerAmt) : ""}
        onChange={(e) => {
          const raw = e.target.value;
          const ledgerVal = Number(raw) || 0;
          if (!ledgerVal) {
            onChange(setLineLedgerAmount({ ...line, amountFx: "" }, 0, side));
            return;
          }
          const txnVal = convertLedgerToTxn(ledgerVal, rate, txn, ledger);
          onChange(setLineLedgerAmount({ ...line, amountFx: String(txnVal) }, ledgerVal, side));
        }}
      />
      <span className="shrink-0 font-semibold">{ledger}</span>
    </div>
  );
}

export type VoucherLinesEditorProps = {
  lines: DraftLine[];
  onLinesChange: (lines: DraftLine[]) => void;
  ledgerCurrency: string;
  fxRateDefault?: number;
  previewAmountMode: ReportCurrencyMode;
  isLebaneseCoa?: boolean;
  accounts: LedgerAccount[];
  accountingLanguage?: AccountingLanguage;
  pcgClientAccounts?: PcgClientAccount[];
  costCenters?: LedgerCostCenter[];
  mirrorPair?: boolean;
  lineKeyPrefix?: string;
  hint?: string;
  previewLabel?: string;
  onPreview?: () => void;
  posting?: boolean;
  requireBalanced?: boolean;
  extraPreviewDisabled?: boolean;
  /** Matrix GL090P footer: Total Dr/Cr/Balance + US/LL buckets */
  matrixJvFooter?: boolean;
  /** JD Edwards: line-ccy debit/credit + foreign amount column */
  jdEdwardsGrid?: boolean;
  /** Voucher-level exchange rate (overrides store default for this entry) */
  exchangeRate?: number;
  /** Matrix GL090P value date per line */
  showValueDate?: boolean;
  voucherDate?: string;
};

export default function VoucherLinesEditor({
  lines,
  onLinesChange,
  ledgerCurrency,
  fxRateDefault,
  previewAmountMode,
  isLebaneseCoa,
  accounts,
  accountingLanguage,
  pcgClientAccounts = [],
  costCenters = [],
  mirrorPair = false,
  lineKeyPrefix = "voucher-line",
  hint,
  previewLabel,
  onPreview,
  posting,
  requireBalanced = true,
  extraPreviewDisabled = false,
  matrixJvFooter = false,
  jdEdwardsGrid = false,
  exchangeRate,
  showValueDate = false,
  voucherDate = "",
}: VoucherLinesEditorProps) {
  const clientByGrabio = useMemo(() => buildClientByGrabioMap(pcgClientAccounts), [pcgClientAccounts]);
  const voucherRate = exchangeRate ?? fxRateDefault;
  const ledgerTotals = useMemo(
    () => draftLinesTotals(lines, ledgerCurrency, jdEdwardsGrid, voucherRate),
    [lines, ledgerCurrency, jdEdwardsGrid, voucherRate],
  );
  const matrixTotals = useMemo(
    () =>
      matrixJvFooter ? draftMatrixTotals(lines, ledgerCurrency, voucherRate, jdEdwardsGrid) : null,
    [lines, ledgerCurrency, voucherRate, matrixJvFooter, jdEdwardsGrid],
  );
  const totals = matrixTotals?.ledger ?? ledgerTotals;
  const balanced = matrixJvFooter
    ? draftMatrixBalanced(lines, ledgerCurrency, voucherRate, jdEdwardsGrid)
    : draftLinesBalanced(lines, ledgerCurrency, jdEdwardsGrid, voucherRate);
  const balance = Math.round((totals.debit - totals.credit) * 100) / 100;
  const previewDisabled = posting || extraPreviewDisabled || (requireBalanced && !balanced);
  const showLbpColumn =
    Boolean(isLebaneseCoa) &&
    normalizeLedgerCurrency(ledgerCurrency) === "USD" &&
    Boolean(fxRateDefault && fxRateDefault > 0);

  const syncLineAfterEdit = (line: DraftLine): DraftLine => {
    let next = applyDefaultFxRateToLine(line, ledgerCurrency, voucherRate);
    if (jdEdwardsGrid && voucherRate && voucherRate > 0) {
      next = syncAuxiliaryAmount(next, ledgerCurrency, voucherRate, jdEdwardsGrid);
    } else if (showLbpColumn) {
      next = syncAuxiliaryAmount(next, ledgerCurrency, voucherRate, jdEdwardsGrid);
    } else {
      next = syncAmountFxFromLedger(next, ledgerCurrency, voucherRate);
    }
    return next;
  };

  const updateLine = (idx: number, patch: Partial<DraftLine>) => {
    let next = lines.map((line) => ({ ...line }));
    next[idx] = { ...next[idx], ...patch };
    if (mirrorPair && jdEdwardsGrid) {
      next = resyncJvMirrorPairs(next, ledgerCurrency, voucherRate, jdEdwardsGrid);
      next = next.map((line) => syncLineAfterEdit(line));
    } else {
      next[idx] = syncLineAfterEdit(next[idx]);
    }
    onLinesChange(next);
  };

  const updateAmount = (idx: number, field: "debit" | "credit", value: string) => {
    let next = lines.map((line) => ({ ...line }));
    if (mirrorPair && jvMirrorPairIndex(idx) != null) {
      next = mirrorJvAmount(next, idx, field, value, {
        ledgerCurrency,
        voucherRate,
        jdEdwardsGrid,
      });
    } else if (field === "debit") {
      next[idx] = { ...next[idx], debit: value, credit: value ? "" : next[idx].credit };
    } else {
      next[idx] = { ...next[idx], credit: value, debit: value ? "" : next[idx].debit };
    }

    const touched = new Set<number>([idx]);
    const pairIdx = mirrorPair ? jvMirrorPairIndex(idx) : null;
    if (pairIdx != null && pairIdx >= 0 && pairIdx < next.length) touched.add(pairIdx);
    for (const lineIdx of touched) {
      next[lineIdx] = syncLineAfterEdit(next[lineIdx]);
    }
    onLinesChange(next);
  };

  const updateAuxiliaryAmount = (idx: number, value: string) => {
    const next = [...lines];
    let line = applyManualAuxiliaryAmount(
      next[idx],
      value,
      ledgerCurrency,
      voucherRate,
      jdEdwardsGrid,
    );
    if (mirrorPair && idx === 1) {
      line = { ...line, mirrorDetached: true };
    }
    next[idx] = line;
    onLinesChange(next);
  };

  useEffect(() => {
    if (!jdEdwardsGrid || !exchangeRate || exchangeRate <= 0) return;
    let changed = false;
    const next = lines.map((line) => {
      const cleared = Number(line.fxRate) > 0 ? { ...line, fxRate: "" } : line;
      const synced = syncAuxiliaryAmount(cleared, ledgerCurrency, exchangeRate, jdEdwardsGrid);
      if (synced.amountFx !== line.amountFx || synced.fxRate !== line.fxRate) {
        changed = true;
        return synced;
      }
      return line;
    });
    if (changed) onLinesChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exchangeRate, jdEdwardsGrid, ledgerCurrency]);

  useEffect(() => {
    if (!jdEdwardsGrid || !voucherRate || voucherRate <= 0) return;
    let changed = false;
    const next = lines.map((line) => {
      const synced = syncAuxiliaryAmount(line, ledgerCurrency, voucherRate, jdEdwardsGrid);
      if (synced.amountFx !== line.amountFx || synced.fxRate !== line.fxRate) {
        changed = true;
        return synced;
      }
      return line;
    });
    if (changed) onLinesChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voucherRate, jdEdwardsGrid, ledgerCurrency]);

  useEffect(() => {
    if (!voucherRate || voucherRate <= 0) return;
    let changed = false;
    const next = lines.map((line) => {
      if (!lineNeedsFx(line, ledgerCurrency) || Number(line.fxRate) > 0) return line;
      const patched = applyDefaultFxRateToLine(line, ledgerCurrency, voucherRate);
      if (patched.fxRate !== line.fxRate || patched.amountFx !== line.amountFx) {
        changed = true;
        return patched;
      }
      return line;
    });
    if (changed) onLinesChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voucherRate, ledgerCurrency]);

  const debitCreditHeader = jdEdwardsGrid ? "Debit" : `Debit (${ledgerCurrency})`;
  const creditHeader = jdEdwardsGrid ? "Credit" : `Credit (${ledgerCurrency})`;
  const foreignColumnLabel = jdEdwardsGrid ? "Foreign amount" : "Equiv.";

  const handleLineKeyDown = (e: React.KeyboardEvent, idx: number, field: keyof DraftLine) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (field === "description" && idx < lines.length - 1) {
        const nextInput = document.querySelector<HTMLInputElement>(
          `[data-${lineKeyPrefix}="${idx + 1}"][data-${lineKeyPrefix}-field="accountId"]`,
        );
        nextInput?.focus();
      }
    }
  };

  const removeLine = (idx: number) => {
    if (lines.length <= 2) return;
    let next = lines.filter((_, i) => i !== idx);
    if (mirrorPair && jdEdwardsGrid) {
      next = resyncJvMirrorPairs(next, ledgerCurrency, voucherRate, jdEdwardsGrid);
      next = next.map((line) => syncLineAfterEdit(line));
    }
    onLinesChange(next);
  };

  const pairGap =
    mirrorPair && jdEdwardsGrid && lines[1]?.mirrorDetached && lines.length >= 2
      ? (() => {
          const pair = draftLinesTotals(lines.slice(0, 2), ledgerCurrency, jdEdwardsGrid, voucherRate);
          return Math.round((pair.debit - pair.credit) * 100) / 100;
        })()
      : 0;

  const [linesToAdd, setLinesToAdd] = useState(1);
  const gridRef = useRef<HTMLDivElement>(null);
  const [activeLineIdx, setActiveLineIdx] = useState(() => Math.max(0, lines.length - 1));
  const [activeAmountField, setActiveAmountField] = useState<"debit" | "credit">("debit");

  useEffect(() => {
    if (activeLineIdx >= lines.length) {
      setActiveLineIdx(Math.max(0, lines.length - 1));
    }
  }, [lines.length, activeLineIdx]);

  const usdNet = matrixTotals ? Math.round((matrixTotals.usd.debit - matrixTotals.usd.credit) * 100) / 100 : 0;
  const lbpNet = matrixTotals ? Math.round(matrixTotals.lbp.debit - matrixTotals.lbp.credit) : 0;

  const activeLine = lines[activeLineIdx] ?? emptyLine(ledgerCurrency);
  const activeSidePreview = useMemo(
    () => activeLineSideAllocations(activeLine, activeAmountField, ledgerCurrency, voucherRate, jdEdwardsGrid),
    [activeLine, activeAmountField, ledgerCurrency, voucherRate, jdEdwardsGrid],
  );
  const flipToLbp = activeSidePreview.txn === "USD";
  const flipTargetAmount = flipToLbp ? activeSidePreview.lbp : activeSidePreview.usd;
  const flipTargetLabel = flipToLbp ? "LL" : "USD";
  const canFlipCurrency =
    activeSidePreview.sideAmount > 0 && flipTargetAmount > 0 && Boolean(voucherRate && voucherRate > 0);

  const focusAmountCell = (idx: number, field: "debit" | "credit") => {
    setActiveLineIdx(idx);
    setActiveAmountField(field);
  };

  const applyCurrencyFlipFromAlloc = () => {
    if (!matrixJvFooter || !jdEdwardsGrid || !voucherRate) {
      toast.error("Exchange rate required to flip currency");
      return;
    }
    const row = lines[activeLineIdx];
    if (!row) return;
    const side = activeAmountField;
    const flipped = flipJvLineCurrencyFromAlloc(row, side, ledgerCurrency, voucherRate, jdEdwardsGrid);
    if (!flipped) {
      toast.error("Click a Dr/Cr cell with an amount, then click the flip box");
      return;
    }
    let next = [...lines];
    let nextLine = syncLineAfterEdit(flipped);
    if (mirrorPair && activeLineIdx === 1) {
      nextLine = { ...nextLine, mirrorDetached: true };
    }
    next[activeLineIdx] = nextLine;
    onLinesChange(next);
  };

  const handleAutoBalance = () => {
    const row = lines[activeLineIdx];
    if (!row?.accountId) {
      toast.error("Pick an account on the active line first");
      return;
    }
    const filled = buildJvAutoBalanceLine(row, lines, activeLineIdx, ledgerCurrency, voucherRate, jdEdwardsGrid);
    if (!filled) {
      toast.info("Already balanced — nothing to fill");
      return;
    }
    let next = lines.map((line) => ({ ...line }));
    next[activeLineIdx] = syncLineAfterEdit(filled);
    if (mirrorPair && jdEdwardsGrid && activeLineIdx <= 1) {
      next = resyncJvMirrorPairs(next, ledgerCurrency, voucherRate, jdEdwardsGrid);
      next = next.map((line) => syncLineAfterEdit(line));
    }
    onLinesChange(next);
    toast.success("Auto balance applied to active line");
  };

  const formatCalcNum = (n: number, ccy: "USD" | "LBP") => {
    if (!n) return "0";
    if (ccy === "LBP") return Math.round(Math.abs(n)).toLocaleString("en-US");
    return Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const appendEmptyLines = (count?: number) => {
    const n = Math.min(50, Math.max(1, Math.floor(count ?? linesToAdd) || 1));
    const extra = Array.from({ length: n }, () => emptyLine(ledgerCurrency));
    onLinesChange([...lines, ...extra]);
    setActiveLineIdx(lines.length + n - 1);
  };

  const defaultHint =
    `Ledger: ${ledgerCurrency}` +
    (voucherRate ? ` · 1 USD = ${voucherRate.toLocaleString()} LBP` : "") +
    (jdEdwardsGrid
      ? " · Debit/Credit in line Ccy. Foreign amount = other currency. Rate on voucher header."
      : showLbpColumn
        ? ` · Debit/Credit = ${ledgerCurrency}. Equiv. column shows LBP when Ccy is USD, USD when Ccy is LBP.`
        : ` · Debit/Credit = ${ledgerCurrency} posting.`);

  const showMirrorSideColumn = Boolean(isLebaneseCoa && mirrorPair && jdEdwardsGrid);

  return (
    <div className="space-y-1">
      {hint !== "" && !isLebaneseCoa ? (
        <p className="text-xs text-muted-foreground">{hint ?? defaultHint}</p>
      ) : null}
      {isLebaneseCoa && mirrorPair && jdEdwardsGrid && lines[1]?.mirrorDetached ? (
        <p className="legacy-erp-voucher-tip legacy-erp-voucher-tip--warn">
          Lines 1–2 unlinked.
          {pairGap !== 0
            ? ` Difference on lines 1–2: ${formatLedgerAmount(Math.abs(pairGap), ledgerCurrency)} ${pairGap > 0 ? "Dr" : " Cr"} — add lines 3+ for FX / tips / cash.`
            : " Add lines 3+ for FX, tips, or cash."}
        </p>
      ) : null}

      {isLebaneseCoa ? (
        <div className="legacy-erp-excel-sheet" ref={gridRef}>
          <div className="max-h-[min(28rem,60vh)] overflow-y-auto overflow-x-hidden">
          <table
            className="legacy-erp-jv-lines"
            data-ui="voucher-grid-v4"
          >
            <colgroup>
              {showMirrorSideColumn ? <col style={{ width: "4%" }} /> : null}
              <col style={{ width: showMirrorSideColumn ? (showLbpColumn ? "20%" : "18%") : showLbpColumn ? "24%" : "22%" }} />
              <col style={{ width: "7%" }} />
              {!showLbpColumn ? <col style={{ width: "8%" }} /> : null}
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              {showLbpColumn ? <col style={{ width: "14%" }} /> : null}
              {showValueDate ? <col style={{ width: "10%" }} /> : null}
              <col style={{ width: showLbpColumn ? "31%" : showValueDate ? "29%" : "39%" }} />
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr className="!bg-[#316ac5] !text-white">
                {showMirrorSideColumn ? (
                  <th className={cn(JV_TH, "text-center")} title="Debit / credit side">
                    Side
                  </th>
                ) : null}
                <th className={cn(JV_TH, "text-left")}>Account</th>
                <th className={cn(JV_TH, "text-left")}>Ccy</th>
                {!showLbpColumn ? <th className={cn(JV_TH, "text-right")}>Rate</th> : null}
                <th className={cn(JV_TH, "text-right")}>{debitCreditHeader}</th>
                <th className={cn(JV_TH, "text-right")}>{creditHeader}</th>
                {showLbpColumn ? <th className={cn(JV_TH, "text-right")}>{foreignColumnLabel}</th> : null}
                {showValueDate ? <th className={JV_TH}>Value date</th> : null}
                <th className={cn(JV_TH, "text-left")}>Line memo</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => {
                const rowClass = cn(
                  idx < 2 && mirrorPair && jdEdwardsGrid && "legacy-erp-jv-row--pair",
                  idx === 1 && line.mirrorDetached && "legacy-erp-jv-row--detached",
                  idx === activeLineIdx && "legacy-erp-jv-row--active",
                );
                return (
                  <tr
                    key={idx}
                    className={rowClass}
                    onFocusCapture={() => setActiveLineIdx(idx)}
                  >
                    {showMirrorSideColumn ? (
                      <td className="!h-8 !border !border-[#b0b0b0] !bg-[#f0efe8] !p-0 align-middle text-center">
                        {idx < 2 ? (
                          <span className="legacy-erp-jv-side-badge">{idx === 0 ? "Dr" : "Cr"}</span>
                        ) : (
                          <span className="text-[10px] font-semibold text-slate-500">{idx + 1}</span>
                        )}
                      </td>
                    ) : null}
                    <td className="!h-8 !border !border-[#b0b0b0] !bg-white !p-0 align-middle legacy-erp-jv-td--account">
                      <div className="legacy-erp-jv-account-wrap">
                      <LedgerAccountCombobox
                        accounts={accounts}
                        allowInactiveAccounts={jdEdwardsGrid}
                        accountingLanguage={accountingLanguage}
                        isLebaneseCoa={isLebaneseCoa}
                        pcgClientAccounts={pcgClientAccounts}
                        value={line.accountId}
                        className={JV_FIELD}
                        compactSelectedLabel
                        onValueChange={(v) => {
                          const account = accounts.find((row) => row.id === v);
                          const patch: Partial<DraftLine> = { accountId: v };
                          if (jdEdwardsGrid && account) {
                            patch.transactionCurrency = accountDefaultLineCurrency(
                              account,
                              ledgerCurrency,
                            );
                            patch.amountFx = "";
                            patch.fxRate = "";
                          }
                          updateLine(idx, patch);
                        }}
                      />
                      {!showLbpColumn && lineNeedsFx(line, ledgerCurrency) ? (
                        <FxConversionEditor
                          line={line}
                          ledgerCurrency={ledgerCurrency}
                          fxRateDefault={fxRateDefault}
                          onChange={(nextLine) => updateLine(idx, nextLine)}
                        />
                      ) : null}
                      <button
                        type="button"
                        className="legacy-erp-jv-del"
                        title={lines.length <= 2 ? "At least two lines required" : "Remove line"}
                        disabled={lines.length <= 2}
                        onClick={() => removeLine(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      </div>
                    </td>
                    <td className="!h-8 !border !border-[#b0b0b0] !bg-white !p-0 align-middle">
                      <Select
                        value={resolveLineTransactionCurrency(line, ledgerCurrency)}
                        onValueChange={(v) => {
                          updateLine(idx, {
                            transactionCurrency: v,
                            amountFx: "",
                            fxRate: "",
                          });
                        }}
                      >
                        <SelectTrigger className={JV_FIELD}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LBP">LBP</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    {!showLbpColumn ? (
                      <td className="!h-8 !border !border-[#b0b0b0] !bg-white !p-0 align-middle">
                        {lineNeedsFx(line, ledgerCurrency) ? (
                          <Input
                            className={JV_AMOUNT}
                            type="number"
                            min="0"
                            step="1"
                            value={line.fxRate || (fxRateDefault ? String(fxRateDefault) : "")}
                            onChange={(e) =>
                              updateLine(
                                idx,
                                syncFxOnRateChange(line, ledgerCurrency, e.target.value, fxRateDefault),
                              )
                            }
                          />
                        ) : (
                          <span className="legacy-erp-jv-empty">—</span>
                        )}
                      </td>
                    ) : null}
                    <td className="!h-8 !border !border-[#b0b0b0] !bg-white !p-0 align-middle">
                      <VoucherAmountInput
                        className={JV_AMOUNT}
                        value={line.debit}
                        onFocus={() => focusAmountCell(idx, "debit")}
                        onMouseDown={() => focusAmountCell(idx, "debit")}
                        onKeyDown={(e) => handleLineKeyDown(e, idx, "debit")}
                        onChange={(v) => updateAmount(idx, "debit", v)}
                      />
                    </td>
                    <td className="!h-8 !border !border-[#b0b0b0] !bg-white !p-0 align-middle">
                      <VoucherAmountInput
                        className={JV_AMOUNT}
                        value={line.credit}
                        onFocus={() => focusAmountCell(idx, "credit")}
                        onMouseDown={() => focusAmountCell(idx, "credit")}
                        onKeyDown={(e) => handleLineKeyDown(e, idx, "credit")}
                        onChange={(v) => updateAmount(idx, "credit", v)}
                      />
                    </td>
                    {showLbpColumn ? (
                      <td className="!h-8 !border !border-[#b0b0b0] !bg-white !p-0 align-middle">
                          <VoucherAmountInput
                            className={JV_AMOUNT}
                          title={foreignCurrencyLabel(line, ledgerCurrency)}
                          value={resolvedAuxiliaryAmount(line, ledgerCurrency, voucherRate, jdEdwardsGrid)}
                          onFocus={() => focusAmountCell(idx, activeAmountSide(line))}
                          onMouseDown={() => focusAmountCell(idx, activeAmountSide(line))}
                          onChange={(v) => updateAuxiliaryAmount(idx, v)}
                        />
                      </td>
                    ) : null}
                    {showValueDate ? (
                      <td className="!h-8 !border !border-[#b0b0b0] !bg-white !p-0 align-middle">
                        <Input
                          className={JV_FIELD}
                          type="date"
                          min="2000-01-01"
                          max="2099-12-31"
                          value={line.valueDate || voucherDate}
                          onChange={(e) => updateLine(idx, { valueDate: e.target.value })}
                        />
                      </td>
                    ) : null}
                    <td className="!h-8 !border !border-[#b0b0b0] !bg-white !p-0 align-middle">
                      <Input
                        className={JV_FIELD}
                        value={line.description}
                        onKeyDown={(e) => handleLineKeyDown(e, idx, "description")}
                        onChange={(e) => updateLine(idx, { description: e.target.value })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          {matrixJvFooter && matrixTotals && voucherRate ? (
            <div className="legacy-erp-jv-matrix-footer">
              <div className="legacy-erp-jv-matrix-rates">
                <span>USD = {voucherRate.toLocaleString("en-US")} LL</span>
                <span>USD = 1 USD</span>
                {!balanced ? (
                  <span className="legacy-erp-jv-matrix-rates__warn">Entry not balanced — fix or use Auto balance</span>
                ) : null}
              </div>
              <div className="legacy-erp-jv-matrix-grid">
                <div className="legacy-erp-jv-matrix-cell">
                  <span className="legacy-erp-jv-matrix-label">LL DB Amount</span>
                  <span className="legacy-erp-jv-matrix-value">{formatCalcNum(matrixTotals.lbp.debit, "LBP")}</span>
                </div>
                <div className="legacy-erp-jv-matrix-cell">
                  <span className="legacy-erp-jv-matrix-label">LL CR Amount</span>
                  <span className="legacy-erp-jv-matrix-value">{formatCalcNum(matrixTotals.lbp.credit, "LBP")}</span>
                </div>
                <div className="legacy-erp-jv-matrix-cell">
                  <span className="legacy-erp-jv-matrix-label">USD DB Amount</span>
                  <span className="legacy-erp-jv-matrix-value">{formatCalcNum(matrixTotals.usd.debit, "USD")}</span>
                </div>
                <div className="legacy-erp-jv-matrix-cell">
                  <span className="legacy-erp-jv-matrix-label">USD CR Amount</span>
                  <span className="legacy-erp-jv-matrix-value">{formatCalcNum(matrixTotals.usd.credit, "USD")}</span>
                </div>
                <div className={cn("legacy-erp-jv-matrix-cell", usdNet !== 0 && "legacy-erp-jv-matrix-cell--warn")}>
                  <span className="legacy-erp-jv-matrix-label">USD Total</span>
                  <span className="legacy-erp-jv-matrix-value">{usdNet.toFixed(2)}</span>
                </div>
                <div className={cn("legacy-erp-jv-matrix-cell", lbpNet !== 0 && "legacy-erp-jv-matrix-cell--warn")}>
                  <span className="legacy-erp-jv-matrix-label">LL Total</span>
                  <span className="legacy-erp-jv-matrix-value">{lbpNet.toLocaleString("en-US")}</span>
                </div>
                <button
                  type="button"
                  className={cn(
                    "legacy-erp-jv-matrix-cell legacy-erp-jv-matrix-cell--active legacy-erp-jv-matrix-cell--flip",
                    !canFlipCurrency && "legacy-erp-jv-matrix-cell--flip-disabled",
                  )}
                  title={
                    canFlipCurrency
                      ? `Click to flip active ${activeAmountField} to ${flipTargetLabel}`
                      : "Select a Dr/Cr cell with an amount first"
                  }
                  disabled={!canFlipCurrency}
                  onClick={applyCurrencyFlipFromAlloc}
                >
                  <span className="legacy-erp-jv-matrix-label">
                    Active · Ln {activeLineIdx + 1} · {activeAmountField === "debit" ? "Dr" : "Cr"} ·{" "}
                    {activeSidePreview.txn === "USD" ? "USD" : "LL"}
                  </span>
                  <span className="legacy-erp-jv-matrix-value">
                    {activeSidePreview.sideAmount > 0
                      ? formatCalcNum(
                          activeSidePreview.sideAmount,
                          activeSidePreview.txn === "USD" ? "USD" : "LBP",
                        )
                      : "—"}
                  </span>
                  {canFlipCurrency ? (
                    <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-600">
                      Click to flip → {flipTargetLabel}
                    </span>
                  ) : null}
                </button>
              </div>
            </div>
          ) : null}
          <div className="legacy-erp-excel-toolbar">
            {mirrorPair && jdEdwardsGrid ? (
              <p className="legacy-erp-voucher-tip m-0 max-w-md">
                Line 1 = debit side · Line 2 = credit side. Line 3+ for FX / cash diff. Click Dr/Cr to flip currency in Active cell.
              </p>
            ) : null}
            {matrixJvFooter && jdEdwardsGrid ? (
              <button type="button" className="legacy-erp-btn" onClick={handleAutoBalance}>
                Auto balance
              </button>
            ) : null}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={50}
                  className="legacy-erp-voucher-add-qty"
                  value={linesToAdd}
                  title="How many lines to add"
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setLinesToAdd(Number.isFinite(n) ? Math.min(50, Math.max(1, Math.floor(n))) : 1);
                  }}
                />
                <button type="button" className="legacy-erp-btn" onClick={() => appendEmptyLines()}>
                  <Plus className="mr-1 inline h-3.5 w-3.5" />
                  Add line{linesToAdd > 1 ? "s" : ""}
                </button>
              </div>
              {onPreview ? (
                <Button
                  type="button"
                  className="legacy-erp-preview-submit h-8"
                  disabled={previewDisabled}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onPreview();
                  }}
                >
                  {posting ? "Posting…" : previewLabel || "Preview"}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Ccy</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead className="text-right">Debit ({ledgerCurrency})</TableHead>
                <TableHead className="text-right">Credit ({ledgerCurrency})</TableHead>
                <TableHead>Cost ctr</TableHead>
                <TableHead>Line memo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <LedgerAccountCombobox
                      accounts={accounts}
                      accountingLanguage={accountingLanguage}
                      isLebaneseCoa={isLebaneseCoa}
                      pcgClientAccounts={pcgClientAccounts}
                      value={line.accountId}
                      onValueChange={(v) => updateLine(idx, { accountId: v })}
                    />
                    {lineNeedsFx(line, ledgerCurrency) ? (
                      <FxConversionEditor
                        compact
                        line={line}
                        ledgerCurrency={ledgerCurrency}
                        fxRateDefault={fxRateDefault}
                        onChange={(nextLine) => updateLine(idx, nextLine)}
                      />
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={normalizeLineCurrency(line.transactionCurrency || ledgerCurrency)}
                      onValueChange={(v) => {
                        const ledger = normalizeLedgerCurrency(ledgerCurrency);
                        const needsFx = v !== ledger;
                        updateLine(idx, {
                          transactionCurrency: v,
                          amountFx: needsFx ? line.amountFx : "",
                          fxRate: needsFx ? line.fxRate : "",
                        });
                      }}
                    >
                      <SelectTrigger className="w-[88px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LBP">LBP</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {lineNeedsFx(line, ledgerCurrency) ? (
                      <Input
                        className="w-24"
                        type="number"
                        min="0"
                        step="1"
                        value={line.fxRate}
                        onChange={(e) =>
                          updateLine(idx, syncFxOnRateChange(line, ledgerCurrency, e.target.value, fxRateDefault))
                        }
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Input
                      className="text-right"
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.debit}
                      onChange={(e) => updateAmount(idx, "debit", e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      className="text-right"
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.credit}
                      onChange={(e) => updateAmount(idx, "credit", e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={line.costCenterId || "__none__"}
                      onValueChange={(v) => updateLine(idx, { costCenterId: v === "__none__" ? "" : v })}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">—</SelectItem>
                        {costCenters.map((cc) => (
                          <SelectItem key={cc.id} value={cc.id}>
                            {cc.code} {cc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={line.description}
                      onChange={(e) => updateLine(idx, { description: e.target.value })}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!isLebaneseCoa ? (
      <div>
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="inline-flex items-center gap-1">
                Totals: Debit
                <ReportAmountCell
                  amount={totals.debit}
                  storeCurrency={ledgerCurrency}
                  mode={previewAmountMode}
                  usdToLbp={fxRateDefault}
                  empty="0"
                />
              </span>
              <span className="inline-flex items-center gap-1">
                Credit
                <ReportAmountCell
                  amount={totals.credit}
                  storeCurrency={ledgerCurrency}
                  mode={previewAmountMode}
                  usdToLbp={fxRateDefault}
                  empty="0"
                />
              </span>
              {balanced ? (
                <Badge variant="outline" className="text-green-700">
                  Balanced
                </Badge>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                type="number"
                min={1}
                max={50}
                className="h-8 w-14 rounded-md border border-input px-2 text-sm"
                value={linesToAdd}
                title="How many lines to add"
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setLinesToAdd(Number.isFinite(n) ? Math.min(50, Math.max(1, Math.floor(n))) : 1);
                }}
              />
              <Button variant="outline" size="sm" onClick={() => appendEmptyLines()}>
                <Plus className="h-4 w-4 mr-1" /> Add line{linesToAdd > 1 ? "s" : ""}
              </Button>
              {onPreview ? (
                <Button
                  type="button"
                  className="ml-auto"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onPreview();
                  }}
                  disabled={previewDisabled}
                >
                  {posting ? "Posting…" : previewLabel || "Preview"}
                </Button>
              ) : null}
            </div>
          </>
      </div>
      ) : null}
    </div>
  );
}
