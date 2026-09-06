import type { JournalLine, JournalLineInput, LedgerAccount } from "@/types/generalLedger";
import {
  isAccountsPayableCode,
  isAccountsReceivableCode,
  isCashOrBankCode,
  pickDefaultApAccount,
  pickDefaultArAccount,
} from "@/lib/ledger/accountControlCodes";
import { normalizeLedgerCurrency } from "@/lib/ledger/formatLedgerAmount";
import { parseVoucherAmountNumber } from "@/lib/ledger/voucherAmountInput";

function lineDebit(line: DraftLine): number {
  return parseVoucherAmountNumber(line.debit);
}

function lineCredit(line: DraftLine): number {
  return parseVoucherAmountNumber(line.credit);
}

function lineAmountFx(line: DraftLine): number {
  return parseVoucherAmountNumber(line.amountFx);
}

export type DraftLine = {
  accountId: string;
  debit: string;
  credit: string;
  description: string;
  transactionCurrency: string;
  fxRate: string;
  amountFx: string;
  costCenterId: string;
  valueDate: string;
  /** Line 2 was edited manually — stop auto-mirror with line 1 (Matrix JV). */
  mirrorDetached?: boolean;
};

export type MatrixCurrencyTotals = {
  ledger: { debit: number; credit: number };
  usd: { debit: number; credit: number };
  lbp: { debit: number; credit: number };
};

export function resolveEffectiveFxRate(line: DraftLine, fxRateDefault?: number): number {
  const manual = Number(line.fxRate) || 0;
  if (manual > 0) return manual;
  return fxRateDefault && fxRateDefault > 0 ? fxRateDefault : 0;
}

export function applyDefaultFxRateToLine(
  line: DraftLine,
  ledgerCurrency: string,
  fxRateDefault?: number,
): DraftLine {
  if (!lineNeedsFx(line, ledgerCurrency)) {
    return { ...line, fxRate: "", amountFx: "" };
  }
  if (Number(line.fxRate) > 0) {
    return syncAmountFxFromLedger(line, ledgerCurrency, fxRateDefault);
  }
  if (!fxRateDefault || fxRateDefault <= 0) return line;
  return syncFxOnRateChange(line, ledgerCurrency, String(fxRateDefault), fxRateDefault);
}

export const emptyLine = (ledgerCurrency = "USD"): DraftLine => ({
  accountId: "",
  debit: "",
  credit: "",
  description: "",
  transactionCurrency: normalizeLedgerCurrency(ledgerCurrency),
  fxRate: "",
  amountFx: "",
  costCenterId: "",
  valueDate: "",
});

export function normalizeLineCurrency(code?: string): "LBP" | "USD" {
  const c = String(code || "").toUpperCase();
  if (c === "USD") return "USD";
  return "LBP";
}

/** Line Ccy column value — matches grid display (falls back to ledger when unset). */
export function resolveLineTransactionCurrency(line: DraftLine, ledgerCurrency: string): "LBP" | "USD" {
  const raw = String(line.transactionCurrency || "").trim();
  if (raw) return normalizeLineCurrency(raw);
  return normalizeLedgerCurrency(ledgerCurrency) === "USD" ? "USD" : "LBP";
}

export function accountDefaultLineCurrency(
  account?: { currency?: string } | null,
  ledgerCurrency = "USD",
): "LBP" | "USD" {
  const c = String(account?.currency || "").toUpperCase();
  if (c === "USD") return "USD";
  if (c === "LL" || c === "LBP") return "LBP";
  return normalizeLedgerCurrency(ledgerCurrency) === "USD" ? "USD" : "LBP";
}

export function lineNeedsFx(line: DraftLine, ledgerCurrency: string): boolean {
  return resolveLineTransactionCurrency(line, ledgerCurrency) !== normalizeLedgerCurrency(ledgerCurrency);
}

export function deriveAmountFxFromLedger(
  line: DraftLine,
  ledgerCurrency: string,
  fxRateDefault?: number,
): number | undefined {
  const rate = resolveEffectiveFxRate(line, fxRateDefault);
  if (rate <= 0 || !lineNeedsFx(line, ledgerCurrency)) return undefined;
  const ledgerAmt = lineDebit(line) || lineCredit(line) || 0;
  if (ledgerAmt <= 0) return undefined;
  const txn = resolveLineTransactionCurrency(line, ledgerCurrency);
  const ledger = normalizeLedgerCurrency(ledgerCurrency);
  if (txn === "USD" && ledger === "LBP") return Math.round((ledgerAmt / rate) * 100) / 100;
  if (txn === "LBP" && ledger === "USD") return Math.round(ledgerAmt * rate * 100) / 100;
  return Math.round((ledgerAmt / rate) * 100) / 100;
}

export function resolveAmountFx(line: DraftLine, ledgerCurrency: string, fxRateDefault?: number): number | undefined {
  const manual = lineAmountFx(line);
  if (manual > 0) return manual;
  return deriveAmountFxFromLedger(line, ledgerCurrency, fxRateDefault);
}

export function activeAmountSide(line: DraftLine): "debit" | "credit" {
  if (lineDebit(line) > 0) return "debit";
  if (lineCredit(line) > 0) return "credit";
  return "debit";
}

export function convertTxnToLedger(txnAmount: number, rate: number, txn: string, ledger: string): number {
  if (txn === "USD" && ledger === "LBP") return Math.round(txnAmount * rate * 100) / 100;
  if (txn === "LBP" && ledger === "USD") return Math.round((txnAmount / rate) * 100) / 100;
  return Math.round(txnAmount * 100) / 100;
}

export function convertLedgerToTxn(ledgerAmount: number, rate: number, txn: string, ledger: string): number {
  if (txn === "USD" && ledger === "LBP") return Math.round((ledgerAmount / rate) * 100) / 100;
  if (txn === "LBP" && ledger === "USD") return Math.round(ledgerAmount * rate * 100) / 100;
  return Math.round(ledgerAmount * 100) / 100;
}

export function setLineLedgerAmount(line: DraftLine, ledgerAmount: number, side: "debit" | "credit"): DraftLine {
  if (!ledgerAmount) {
    return side === "debit"
      ? { ...line, debit: "", credit: line.credit }
      : { ...line, credit: "", debit: line.debit };
  }
  if (side === "debit") return { ...line, debit: String(ledgerAmount), credit: "" };
  return { ...line, credit: String(ledgerAmount), debit: "" };
}

export function syncAmountFxFromLedger(
  line: DraftLine,
  ledgerCurrency: string,
  fxRateDefault?: number,
): DraftLine {
  if (!lineNeedsFx(line, ledgerCurrency)) return { ...line, amountFx: "" };
  const derived = deriveAmountFxFromLedger(line, ledgerCurrency, fxRateDefault);
  if (derived == null) return line;
  return { ...line, amountFx: String(derived) };
}

export function syncFxOnRateChange(
  line: DraftLine,
  ledgerCurrency: string,
  newRate: string,
  fxRateDefault?: number,
): DraftLine {
  const rate = Number(newRate) || 0;
  if (!lineNeedsFx(line, ledgerCurrency)) return { ...line, fxRate: newRate };
  if (rate <= 0) return { ...line, fxRate: newRate };
  const txn = resolveLineTransactionCurrency(line, ledgerCurrency);
  const ledger = normalizeLedgerCurrency(ledgerCurrency);
  const side = activeAmountSide(line);
  const manualTxn = lineAmountFx(line);
  if (manualTxn > 0) {
    const ledgerAmt = convertTxnToLedger(manualTxn, rate, txn, ledger);
    return setLineLedgerAmount({ ...line, fxRate: newRate }, ledgerAmt, side);
  }
  const ledgerAmt = lineDebit(line) || lineCredit(line);
  if (ledgerAmt > 0) {
    const txnAmt = convertLedgerToTxn(ledgerAmt, rate, txn, ledger);
    return setLineLedgerAmount({ ...line, fxRate: newRate, amountFx: String(txnAmt) }, ledgerAmt, side);
  }
  return { ...line, fxRate: newRate };
}

/** Debit/credit in line currency when jdEdwardsGrid; ledger amounts when posting. */
export function resolveDraftLinePostingAmount(
  line: DraftLine,
  ledgerCurrency = "USD",
  jdEdwardsGrid = false,
  voucherRate?: number,
): { debit: number; credit: number } {
  const txnDebit = lineDebit(line);
  const txnCredit = lineCredit(line);
  if (!jdEdwardsGrid || !lineNeedsFx(line, ledgerCurrency)) {
    return { debit: txnDebit, credit: txnCredit };
  }
  const rate = resolveEffectiveFxRate(line, voucherRate);
  if (rate <= 0) return { debit: 0, credit: 0 };
  const txn = resolveLineTransactionCurrency(line, ledgerCurrency);
  const ledger = normalizeLedgerCurrency(ledgerCurrency);
  return {
    debit: txnDebit > 0 ? convertTxnToLedger(txnDebit, rate, txn, ledger) : 0,
    credit: txnCredit > 0 ? convertTxnToLedger(txnCredit, rate, txn, ledger) : 0,
  };
}

export function auxiliaryCurrencyLabel(line: DraftLine, ledgerCurrency: string): string {
  const txn = resolveLineTransactionCurrency(line, ledgerCurrency);
  const ledger = normalizeLedgerCurrency(ledgerCurrency);
  if (ledger === "USD" && txn === "USD") return "LBP";
  if (ledger === "USD" && txn === "LBP") return "USD";
  return txn === ledger ? "LBP" : ledger;
}

export function foreignCurrencyLabel(line: DraftLine, ledgerCurrency: string): string {
  return auxiliaryCurrencyLabel(line, ledgerCurrency);
}

export function syncAuxiliaryAmount(
  line: DraftLine,
  ledgerCurrency: string,
  voucherRate?: number,
  jdEdwardsGrid = false,
): DraftLine {
  if (normalizeLedgerCurrency(ledgerCurrency) !== "USD" || !voucherRate || voucherRate <= 0) {
    return line;
  }
  const txnAmt = lineDebit(line) || lineCredit(line) || 0;
  if (txnAmt <= 0) return { ...line, amountFx: "" };

  const txn = resolveLineTransactionCurrency(line, ledgerCurrency);
  const rate = resolveEffectiveFxRate(line, voucherRate);
  if (rate <= 0) return line;

  if (jdEdwardsGrid && txn === "LBP") {
    const usdForeign = Math.round((txnAmt / rate) * 100) / 100;
    return { ...line, amountFx: String(usdForeign), fxRate: line.fxRate || String(rate) };
  }

  const lbpForeign = Math.round(txnAmt * rate);
  return { ...line, amountFx: String(lbpForeign), fxRate: line.fxRate || String(rate) };
}

/** @deprecated use syncAuxiliaryAmount */
export const syncLbpEquivalent = syncAuxiliaryAmount;

export function applyManualAuxiliaryAmount(
  line: DraftLine,
  raw: string,
  ledgerCurrency: string,
  voucherRate?: number,
  jdEdwardsGrid = false,
): DraftLine {
  const txn = resolveLineTransactionCurrency(line, ledgerCurrency);
  const ledger = normalizeLedgerCurrency(ledgerCurrency);
  const side = activeAmountSide(line);
  const txnAmt = lineDebit(line) || lineCredit(line) || 0;

  if (jdEdwardsGrid && txn === "LBP" && ledger === "USD") {
    if (!raw.trim()) return { ...line, amountFx: raw, fxRate: "" };
    const usdForeign = Number(raw) || 0;
    if (!usdForeign || txnAmt <= 0) return { ...line, amountFx: raw };
    const implied = Math.round(txnAmt / usdForeign);
    return { ...line, amountFx: raw, fxRate: String(implied) };
  }

  if (!raw.trim()) return { ...line, amountFx: raw, fxRate: "" };

  return applyManualLbpAmount(line, raw, voucherRate);
}

export function applyManualLbpAmount(line: DraftLine, raw: string, voucherRate?: number): DraftLine {
  const txnAmt = lineDebit(line) || lineCredit(line) || 0;
  if (!raw.trim()) return { ...line, amountFx: raw, fxRate: "" };
  const lbp = Number(raw) || 0;
  if (!txnAmt || !lbp) return { ...line, amountFx: raw };
  const implied = Math.round(lbp / txnAmt);
  return { ...line, amountFx: raw, fxRate: String(implied) };
}

export function resolvedForeignAmount(
  line: DraftLine,
  ledgerCurrency: string,
  voucherRate?: number,
  jdEdwardsGrid = false,
): string {
  const txnAmt = lineDebit(line) || lineCredit(line) || 0;
  if (txnAmt <= 0) return "";

  const txn = resolveLineTransactionCurrency(line, ledgerCurrency);
  const ledger = normalizeLedgerCurrency(ledgerCurrency);
  const rate = resolveEffectiveFxRate(line, voucherRate);
  if (rate <= 0) return "";

  if (line.amountFx !== undefined && line.amountFx !== null && String(line.amountFx).length > 0) {
    return line.amountFx;
  }

  if (jdEdwardsGrid && txn === "LBP" && ledger === "USD") {
    return String(Math.round((txnAmt / rate) * 100) / 100);
  }

  if (lineNeedsFx(line, ledgerCurrency)) {
    const derived = deriveAmountFxFromLedger(line, ledgerCurrency, voucherRate);
    return derived != null ? String(Math.round(derived)) : "";
  }
  return String(Math.round(txnAmt * rate));
}

export function resolvedAuxiliaryAmount(
  line: DraftLine,
  ledgerCurrency: string,
  voucherRate?: number,
  jdEdwardsGrid = false,
): string {
  return resolvedForeignAmount(line, ledgerCurrency, voucherRate, jdEdwardsGrid);
}

export function mapDraftLine(
  line: DraftLine,
  ledgerCurrency: string,
  voucherRate?: number,
  jdEdwardsGrid = false,
): JournalLineInput | null {
  if (!line.accountId) return null;
  const { debit: finalDebit, credit: finalCredit } = resolveDraftLinePostingAmount(
    line,
    ledgerCurrency,
    jdEdwardsGrid,
    voucherRate,
  );
  if (finalDebit <= 0 && finalCredit <= 0) return null;
  const fxRate = resolveEffectiveFxRate(line, voucherRate);
  const txn = resolveLineTransactionCurrency(line, ledgerCurrency);
  const ledger = normalizeLedgerCurrency(ledgerCurrency);
  const txnDebit = lineDebit(line);
  const txnCredit = lineCredit(line);

  let amountFx: number | undefined;
  if (jdEdwardsGrid && txn === "LBP" && ledger === "USD") {
    amountFx = txnDebit > 0 ? txnDebit : txnCredit > 0 ? txnCredit : undefined;
  } else {
    amountFx = lineAmountFx(line) || resolveAmountFx(line, ledgerCurrency, voucherRate);
  }

  const storeLbpEquiv =
    ledger === "USD" && voucherRate && voucherRate > 0 && amountFx != null && amountFx > 0;
  const fxApplies =
    (lineNeedsFx(line, ledgerCurrency) || storeLbpEquiv) && fxRate > 0 && amountFx != null && amountFx > 0;
  return {
    accountId: line.accountId,
    debit: finalDebit,
    credit: finalCredit,
    description: line.description || undefined,
    transactionCurrency: line.transactionCurrency || ledgerCurrency || undefined,
    fxRate: fxApplies ? fxRate : undefined,
    amountFx: fxApplies ? amountFx : undefined,
    costCenterId: line.costCenterId || undefined,
    valueDate: line.valueDate?.trim() || undefined,
  };
}

export function mapDraftLines(
  lines: DraftLine[],
  ledgerCurrency: string,
  voucherDate?: string,
  voucherRate?: number,
  jdEdwardsGrid = false,
): JournalLineInput[] {
  return lines
    .map((line) => {
      const mapped = mapDraftLine(line, ledgerCurrency, voucherRate, jdEdwardsGrid);
      if (!mapped) return null;
      if (!mapped.valueDate && voucherDate) mapped.valueDate = voucherDate;
      return mapped;
    })
    .filter(Boolean) as JournalLineInput[];
}

export type PreviewLineSideAmount = {
  amount: number;
  currency: string;
};

type PreviewLineShape = Pick<
  JournalLineInput,
  "debit" | "credit" | "transactionCurrency" | "amountFx" | "fxRate"
>;

/** Preview Dr/Cr in line transaction currency — matches what the user typed in the grid. */
export function previewLineSideAmount(
  line: PreviewLineShape,
  side: "debit" | "credit",
  ledgerCurrency: string,
  jdEdwardsGrid = false,
): PreviewLineSideAmount | null {
  const ledgerAmt = side === "debit" ? Number(line.debit) || 0 : Number(line.credit) || 0;
  if (ledgerAmt <= 0) return null;

  const txn = normalizeLineCurrency(line.transactionCurrency || ledgerCurrency);
  const ledger = normalizeLedgerCurrency(ledgerCurrency);

  if (jdEdwardsGrid && ledger === "USD" && txn === "LBP") {
    const lbpAmt = Number(line.amountFx) || 0;
    if (lbpAmt > 0) return { amount: lbpAmt, currency: "LBP" };
    const rate = Number(line.fxRate) || 0;
    if (rate > 0) return { amount: Math.round(ledgerAmt * rate), currency: "LBP" };
  }

  return { amount: ledgerAmt, currency: ledger };
}

/** Preview FX column — foreign/auxiliary currency, not transaction currency label on amountFx. */
export function previewLineFxLabel(
  line: PreviewLineShape,
  ledgerCurrency: string,
  jdEdwardsGrid = false,
): string {
  const rate = Number(line.fxRate) || 0;
  if (rate <= 0) return "—";

  const txn = normalizeLineCurrency(line.transactionCurrency || ledgerCurrency);
  const ledger = normalizeLedgerCurrency(ledgerCurrency);

  if (jdEdwardsGrid && ledger === "USD") {
    if (txn === "USD") {
      const lbp = Number(line.amountFx) || 0;
      if (lbp <= 0) return "—";
      return `${lbp.toLocaleString("en-US")} LBP × ${rate.toLocaleString("en-US")}`;
    }
    if (txn === "LBP") {
      const usd = Number(line.debit) || Number(line.credit) || 0;
      if (usd <= 0) return "—";
      return `${usd.toFixed(2)} USD × ${rate.toLocaleString("en-US")}`;
    }
  }

  const fx = Number(line.amountFx) || 0;
  if (fx <= 0) return "—";
  const ccy = String(line.transactionCurrency || "").trim();
  return `${fx.toLocaleString("en-US")} ${ccy} × ${rate.toLocaleString("en-US")}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function draftLinesTotals(lines: DraftLine[], ledgerCurrency = "USD", jdEdwardsGrid = false, voucherRate?: number) {
  let debit = 0;
  let credit = 0;
  for (const line of lines) {
    const posting = resolveDraftLinePostingAmount(line, ledgerCurrency, jdEdwardsGrid, voucherRate);
    debit += posting.debit;
    credit += posting.credit;
  }
  return { debit: round2(debit), credit: round2(credit) };
}

export function draftMatrixTotals(
  lines: DraftLine[],
  ledgerCurrency: string,
  voucherRate?: number,
  jdEdwardsGrid = false,
): MatrixCurrencyTotals {
  const totals: MatrixCurrencyTotals = {
    ledger: { debit: 0, credit: 0 },
    usd: { debit: 0, credit: 0 },
    lbp: { debit: 0, credit: 0 },
  };
  for (const line of lines) {
    const posting = resolveDraftLinePostingAmount(line, ledgerCurrency, jdEdwardsGrid, voucherRate);
    totals.ledger.debit += posting.debit;
    totals.ledger.credit += posting.credit;

    const txn = resolveLineTransactionCurrency(line, ledgerCurrency);
    const txnAmt = lineDebit(line) || lineCredit(line) || 0;
    const foreignAmt = lineAmountFx(line) || 0;

    if (jdEdwardsGrid && txn === "LBP") {
      if (posting.debit > 0) totals.lbp.debit += txnAmt;
      if (posting.credit > 0) totals.lbp.credit += txnAmt;
      totals.usd.debit += posting.debit;
      totals.usd.credit += posting.credit;
      continue;
    }

    const lbpAmt = foreignAmt || resolveAmountFx(line, ledgerCurrency, voucherRate) || 0;
    if (txn === "USD" && normalizeLedgerCurrency(ledgerCurrency) === "USD") {
      if (lineDebit(line) > 0) {
        totals.usd.debit += jdEdwardsGrid ? lineDebit(line) : posting.debit;
        if (posting.debit > 0) totals.lbp.debit += lbpAmt;
      }
      if (lineCredit(line) > 0) {
        totals.usd.credit += jdEdwardsGrid ? lineCredit(line) : posting.credit;
        if (posting.credit > 0) totals.lbp.credit += lbpAmt;
      }
      continue;
    }
    if (txn === "USD") {
      totals.usd.debit += posting.debit;
      totals.usd.credit += posting.credit;
      continue;
    }

    if (posting.debit > 0) totals.lbp.debit += txnAmt || lbpAmt;
    if (posting.credit > 0) totals.lbp.credit += txnAmt || lbpAmt;
    totals.usd.debit += posting.debit;
    totals.usd.credit += posting.credit;
  }
  totals.ledger.debit = round2(totals.ledger.debit);
  totals.ledger.credit = round2(totals.ledger.credit);
  totals.usd.debit = round2(totals.usd.debit);
  totals.usd.credit = round2(totals.usd.credit);
  totals.lbp.debit = round2(totals.lbp.debit);
  totals.lbp.credit = round2(totals.lbp.credit);
  return totals;
}

export function draftLinesBalanced(
  lines: DraftLine[],
  ledgerCurrency = "USD",
  jdEdwardsGrid = false,
  voucherRate?: number,
): boolean {
  const totals = draftLinesTotals(lines, ledgerCurrency, jdEdwardsGrid, voucherRate);
  return totals.debit === totals.credit && totals.debit > 0 && totals.credit > 0;
}

/** Matrix GL090P: ledger must balance; US and LL buckets must each balance. */
export function draftMatrixBalanced(
  lines: DraftLine[],
  ledgerCurrency: string,
  voucherRate?: number,
  jdEdwardsGrid = false,
): boolean {
  const totals = draftMatrixTotals(lines, ledgerCurrency, voucherRate, jdEdwardsGrid);
  const ledgerOk =
    totals.ledger.debit === totals.ledger.credit && totals.ledger.debit > 0 && totals.ledger.credit > 0;
  const usOk = totals.usd.debit === totals.usd.credit;
  const llOk = totals.lbp.debit === totals.lbp.credit;
  return ledgerOk && usOk && llOk;
}

/** Net Dr−Cr per bucket (0 = balanced). Optional excludeIdx zeros one line for auto-balance. */
export function draftMatrixGaps(
  lines: DraftLine[],
  ledgerCurrency: string,
  voucherRate?: number,
  jdEdwardsGrid = false,
  excludeIdx?: number,
): { ledger: number; usd: number; lbp: number } {
  const working = lines.map((line, idx) => (excludeIdx === idx ? emptyLine(ledgerCurrency) : line));
  const totals = draftMatrixTotals(working, ledgerCurrency, voucherRate, jdEdwardsGrid);
  return {
    ledger: round2(totals.ledger.debit - totals.ledger.credit),
    usd: round2(totals.usd.debit - totals.usd.credit),
    lbp: round2(Math.round(totals.lbp.debit - totals.lbp.credit)),
  };
}

/** Active-line USD / LL bucket amounts for the Matrix footer (preview LBP when rate known). */
export function activeLineMatrixAllocations(
  line: DraftLine,
  ledgerCurrency: string,
  voucherRate?: number,
  jdEdwardsGrid = false,
): { usd: number; lbp: number } {
  const txn = resolveLineTransactionCurrency(line, ledgerCurrency);
  const ledger = normalizeLedgerCurrency(ledgerCurrency);
  const txnAmt = lineDebit(line) || lineCredit(line) || 0;
  if (!txnAmt) return { usd: 0, lbp: 0 };

  if (jdEdwardsGrid && ledger === "USD") {
    if (txn === "USD") {
      const manualLbp = lineAmountFx(line);
      const lbp =
        manualLbp > 0
          ? manualLbp
          : voucherRate && voucherRate > 0
            ? Math.round(txnAmt * voucherRate)
            : 0;
      return { usd: round2(txnAmt), lbp };
    }
    const manualUsd = lineAmountFx(line);
    const usd =
      manualUsd > 0
        ? round2(manualUsd)
        : voucherRate && voucherRate > 0
          ? round2(txnAmt / voucherRate)
          : 0;
    return { usd, lbp: Math.round(txnAmt) };
  }

  const single = draftMatrixTotals([line], ledgerCurrency, voucherRate, jdEdwardsGrid);
  return {
    usd: round2(single.usd.debit - single.usd.credit),
    lbp: Math.round(single.lbp.debit - single.lbp.credit),
  };
}

export type ActiveLineSideAlloc = {
  txn: "LBP" | "USD";
  usd: number;
  lbp: number;
  sideAmount: number;
};

/** Active Dr/Cr cell preview — follows focused side, not whole line. */
export function activeLineSideAllocations(
  line: DraftLine,
  side: "debit" | "credit",
  ledgerCurrency: string,
  voucherRate?: number,
  jdEdwardsGrid = false,
): ActiveLineSideAlloc {
  const txn = resolveLineTransactionCurrency(line, ledgerCurrency);
  const sideAmount = side === "debit" ? lineDebit(line) : lineCredit(line);
  if (sideAmount <= 0) {
    return { txn, usd: 0, lbp: 0, sideAmount: 0 };
  }
  const shadow: DraftLine =
    side === "debit"
      ? { ...line, debit: String(sideAmount), credit: "" }
      : { ...line, credit: String(sideAmount), debit: "" };
  const alloc = activeLineMatrixAllocations(shadow, ledgerCurrency, voucherRate, jdEdwardsGrid);
  return { txn, ...alloc, sideAmount };
}

/** Flip active Dr/Cr cell USD ↔ LBP using footer opposite-currency amount. */
export function flipJvLineCurrencyFromAlloc(
  line: DraftLine,
  side: "debit" | "credit",
  ledgerCurrency: string,
  voucherRate?: number,
  jdEdwardsGrid = false,
): DraftLine | null {
  if (!jdEdwardsGrid || normalizeLedgerCurrency(ledgerCurrency) !== "USD") return null;
  if (!voucherRate || voucherRate <= 0) return null;

  const preview = activeLineSideAllocations(line, side, ledgerCurrency, voucherRate, jdEdwardsGrid);
  if (preview.sideAmount <= 0) return null;

  const rate = String(voucherRate);

  if (preview.txn === "USD") {
    if (preview.lbp <= 0) return null;
    return {
      ...line,
      transactionCurrency: "LBP",
      debit: side === "debit" ? String(Math.round(preview.lbp)) : "",
      credit: side === "credit" ? String(Math.round(preview.lbp)) : "",
      amountFx: String(round2(preview.usd)),
      fxRate: rate,
    };
  }

  if (preview.txn === "LBP") {
    if (preview.usd <= 0) return null;
    const usdText = Number.isInteger(preview.usd) ? String(preview.usd) : preview.usd.toFixed(2);
    return {
      ...line,
      transactionCurrency: "USD",
      debit: side === "debit" ? usdText : "",
      credit: side === "credit" ? usdText : "",
      amountFx: String(Math.round(preview.lbp)),
      fxRate: rate,
    };
  }

  return null;
}

/** Fill the active line with remaining Dr/Cr gaps (other lines unchanged). */
export function buildJvAutoBalanceLine(
  activeLine: DraftLine,
  lines: DraftLine[],
  activeIdx: number,
  ledgerCurrency: string,
  voucherRate?: number,
  jdEdwardsGrid = false,
): DraftLine | null {
  if (!activeLine.accountId?.trim()) return null;
  const gaps = draftMatrixGaps(lines, ledgerCurrency, voucherRate, jdEdwardsGrid, activeIdx);
  if (gaps.usd === 0 && gaps.lbp === 0 && gaps.ledger === 0) return null;

  const txn = resolveLineTransactionCurrency(activeLine, ledgerCurrency);
  const ledger = normalizeLedgerCurrency(ledgerCurrency);
  const sideFromGap = (gap: number): "debit" | "credit" => (gap > 0 ? "credit" : "debit");

  let line: DraftLine = {
    ...activeLine,
    debit: "",
    credit: "",
    amountFx: "",
    ...(activeIdx === 1 ? { mirrorDetached: true } : {}),
  };

  if (jdEdwardsGrid && ledger === "USD") {
    const usdGap = gaps.usd;
    const lbpGap = gaps.lbp;
    const primaryGap = usdGap !== 0 ? usdGap : lbpGap !== 0 ? lbpGap : gaps.ledger;
    const side = sideFromGap(primaryGap);
    let usdAmt = Math.abs(usdGap !== 0 ? usdGap : gaps.ledger);
    let lbpAmt = Math.abs(lbpGap);

    if (txn === "USD") {
      if (usdAmt === 0 && lbpAmt > 0 && voucherRate && voucherRate > 0) {
        usdAmt = round2(lbpAmt / voucherRate);
      }
      if (lbpAmt === 0 && usdAmt > 0 && voucherRate && voucherRate > 0) {
        lbpAmt = Math.round(usdAmt * voucherRate);
      }
      line = setLineLedgerAmount(line, usdAmt, side);
      if (lbpAmt > 0) {
        line = {
          ...line,
          amountFx: String(Math.round(lbpAmt)),
          fxRate: line.fxRate || (voucherRate ? String(voucherRate) : ""),
        };
      } else if (voucherRate && usdAmt > 0) {
        line = syncAuxiliaryAmount(line, ledgerCurrency, voucherRate, jdEdwardsGrid);
      }
    } else {
      const lbpLineAmt = lbpAmt > 0 ? lbpAmt : Math.abs(lbpGap);
      line = setLineLedgerAmount(line, lbpLineAmt, side);
      if (usdAmt > 0) {
        line = {
          ...line,
          amountFx: String(round2(usdAmt)),
          fxRate: line.fxRate || (voucherRate ? String(voucherRate) : ""),
        };
      } else if (voucherRate && lbpLineAmt > 0) {
        line = syncAuxiliaryAmount(line, ledgerCurrency, voucherRate, jdEdwardsGrid);
      }
    }
    return line;
  }

  const side = sideFromGap(gaps.ledger);
  line = setLineLedgerAmount(line, Math.abs(gaps.ledger), side);
  return syncAuxiliaryAmount(line, ledgerCurrency, voucherRate, jdEdwardsGrid);
}

/** JV mirror applies only to lines 1–2; lines 3+ are independent (FX diff, transport, etc.). */
export function jvMirrorPairIndex(idx: number): number | null {
  if (idx === 0) return 1;
  if (idx === 1) return 0;
  return null;
}

export type MirrorJvAmountOptions = {
  ledgerCurrency?: string;
  voucherRate?: number;
  jdEdwardsGrid?: boolean;
};

/** Convert mirrored amount from source line Ccy into target line Ccy (ledger-equivalent). */
export function convertMirrorAmountBetweenLines(
  sourceLine: DraftLine,
  targetLine: DraftLine,
  sourceField: "debit" | "credit",
  ledgerCurrency: string,
  voucherRate?: number,
  jdEdwardsGrid = false,
): string {
  const sourceValue = sourceField === "debit" ? sourceLine.debit : sourceLine.credit;
  const amt = Number(sourceValue) || 0;
  if (!amt) return "";

  const sourceTxn = resolveLineTransactionCurrency(sourceLine, ledgerCurrency);
  const targetTxn = resolveLineTransactionCurrency(targetLine, ledgerCurrency);
  const ledger = normalizeLedgerCurrency(ledgerCurrency);
  const rate = resolveEffectiveFxRate(sourceLine, voucherRate) || voucherRate || 0;

  if (!jdEdwardsGrid || sourceTxn === targetTxn || rate <= 0) {
    return sourceValue;
  }

  const ledgerAmt = convertTxnToLedger(amt, rate, sourceTxn, ledger);
  const converted = convertLedgerToTxn(ledgerAmt, rate, targetTxn, ledger);
  return targetTxn === "LBP"
    ? String(Math.round(converted))
    : String(Math.round(converted * 100) / 100);
}

/** Re-apply mirror conversion for lines 1–2 only (skipped when line 2 was manually overridden). */
export function resyncJvMirrorPairs(
  lines: DraftLine[],
  ledgerCurrency: string,
  voucherRate?: number,
  jdEdwardsGrid = false,
): DraftLine[] {
  if (!jdEdwardsGrid || lines.length < 2 || lines[1]?.mirrorDetached) return lines;
  const next = lines.map((line) => ({ ...line }));
  const pairFxReset = { amountFx: "", fxRate: "" };
  const a = next[0];
  const b = next[1];
  if (!b) return next;

  if (Number(a.debit) > 0) {
    const converted = convertMirrorAmountBetweenLines(
      a,
      b,
      "debit",
      ledgerCurrency,
      voucherRate,
      jdEdwardsGrid,
    );
    next[1] = { ...b, credit: converted, debit: "", ...pairFxReset };
  } else if (Number(a.credit) > 0) {
    const converted = convertMirrorAmountBetweenLines(
      a,
      b,
      "credit",
      ledgerCurrency,
      voucherRate,
      jdEdwardsGrid,
    );
    next[1] = { ...b, debit: converted, credit: "", ...pairFxReset };
  } else if (Number(b.debit) > 0) {
    const converted = convertMirrorAmountBetweenLines(
      b,
      a,
      "debit",
      ledgerCurrency,
      voucherRate,
      jdEdwardsGrid,
    );
    next[0] = { ...a, credit: converted, debit: "", ...pairFxReset };
  } else if (Number(b.credit) > 0) {
    const converted = convertMirrorAmountBetweenLines(
      b,
      a,
      "credit",
      ledgerCurrency,
      voucherRate,
      jdEdwardsGrid,
    );
    next[0] = { ...a, debit: converted, credit: "", ...pairFxReset };
  }
  return next;
}

export function mirrorJvAmount(
  lines: DraftLine[],
  idx: number,
  field: "debit" | "credit",
  value: string,
  options: MirrorJvAmountOptions = {},
): DraftLine[] {
  const { ledgerCurrency = "USD", voucherRate, jdEdwardsGrid = false } = options;
  const next = lines.map((line) => ({ ...line }));
  const pairFxReset = { amountFx: "", fxRate: "" };

  if (field === "debit") {
    next[idx] = { ...next[idx], debit: value, credit: value ? "" : next[idx].credit };
  } else {
    next[idx] = { ...next[idx], credit: value, debit: value ? "" : next[idx].debit };
  }

  const pairIdx = jvMirrorPairIndex(idx);
  if (pairIdx == null) {
    return next;
  }

  /** Line 2 manual edit: keep line 1 unchanged (AM: enter 56 on L1, change L2 to 50). */
  if (idx === 1) {
    next[1] = { ...next[1], mirrorDetached: true };
    return next;
  }

  /** Line 1 edit after line 2 override: do not overwrite line 2. */
  if (idx === 0 && next[1]?.mirrorDetached) {
    return next;
  }

  if (pairIdx < 0 || pairIdx >= next.length) return next;

  if (!value.trim()) {
    if (field === "debit") next[pairIdx] = { ...next[pairIdx], credit: "", ...pairFxReset };
    else next[pairIdx] = { ...next[pairIdx], debit: "", ...pairFxReset };
    return next;
  }

  const pairValue = convertMirrorAmountBetweenLines(
    next[idx],
    next[pairIdx],
    field,
    ledgerCurrency,
    voucherRate,
    jdEdwardsGrid,
  );

  if (field === "debit") {
    next[pairIdx] = { ...next[pairIdx], credit: pairValue, debit: "", ...pairFxReset };
  } else {
    next[pairIdx] = { ...next[pairIdx], debit: pairValue, credit: "", ...pairFxReset };
  }
  if (pairIdx === 1) {
    next[1] = { ...next[1], mirrorDetached: false };
  }
  return next;
}

export function journalLinesToDraft(
  lines: JournalLine[],
  ledgerCurrency: string,
  minLines = 2,
): DraftLine[] {
  const mapped = lines.map((line) => ({
    accountId: line.accountId,
    debit: line.debit ? String(line.debit) : "",
    credit: line.credit ? String(line.credit) : "",
    description: line.description || "",
    transactionCurrency: line.transactionCurrency || ledgerCurrency || "",
    fxRate: line.fxRate != null ? String(line.fxRate) : "",
    amountFx: line.amountFx != null ? String(line.amountFx) : "",
    costCenterId: line.costCenterId || "",
    valueDate: line.valueDate ? line.valueDate.slice(0, 10) : "",
  }));
  if (mapped.length >= minLines) return mapped;
  const padded = [...mapped];
  while (padded.length < minLines) padded.push(emptyLine(ledgerCurrency));
  return padded;
}

export function seedPvLines(accts: LedgerAccount[], ledgerCurrency: string): DraftLine[] {
  const cash =
    accts.find((row) => row.code === "102") || accts.find((row) => isCashOrBankCode(row.code));
  const ap = pickDefaultApAccount(accts);
  return [
    { ...emptyLine(ledgerCurrency), accountId: ap?.id || "" },
    { ...emptyLine(ledgerCurrency), accountId: cash?.id || "" },
  ];
}

export function seedRvLines(accts: LedgerAccount[], ledgerCurrency: string): DraftLine[] {
  const cash =
    accts.find((row) => row.code === "102") || accts.find((row) => isCashOrBankCode(row.code));
  const ar = pickDefaultArAccount(accts);
  return [
    { ...emptyLine(ledgerCurrency), accountId: cash?.id || "" },
    { ...emptyLine(ledgerCurrency), accountId: ar?.id || "" },
  ];
}

export function seedCvLines(accts: LedgerAccount[], ledgerCurrency: string): DraftLine[] {
  const cash =
    accts.find((row) => row.code === "102") || accts.find((row) => isCashOrBankCode(row.code));
  const bank = accts.find((row) => row.code === "103") || cash;
  return [
    { ...emptyLine(ledgerCurrency), accountId: bank?.id || "" },
    { ...emptyLine(ledgerCurrency), accountId: cash?.id || "" },
  ];
}

export function firstDebitLine(mapped: JournalLineInput[]): JournalLineInput | undefined {
  return mapped.find((line) => line.debit > 0);
}

export function firstCreditLine(mapped: JournalLineInput[]): JournalLineInput | undefined {
  return mapped.find((line) => line.credit > 0);
}

export function findKnockOffAccountId(
  mapped: JournalLineInput[],
  acctById: Map<string, LedgerAccount>,
  prefer: "ap" | "ar",
): string | undefined {
  for (const line of mapped) {
    const amount = prefer === "ap" ? line.debit : line.credit;
    if (amount <= 0) continue;
    const acct = acctById.get(line.accountId);
    if (!acct) continue;
    if (prefer === "ap" && isAccountsPayableCode(acct.code)) return line.accountId;
    if (prefer === "ar" && isAccountsReceivableCode(acct.code)) return line.accountId;
  }
  return prefer === "ap" ? firstDebitLine(mapped)?.accountId : firstCreditLine(mapped)?.accountId;
}
