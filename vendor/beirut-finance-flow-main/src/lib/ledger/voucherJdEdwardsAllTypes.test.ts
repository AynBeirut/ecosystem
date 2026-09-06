/**
 * JD Edwards grid — all voucher types (JV, PV, RV, CRN, DRN, CV).
 * Run: npm test -- voucherJdEdwardsAllTypes.test.ts
 */
import { describe, expect, it } from "vitest";
import {
  type DraftLine,
  applyManualAuxiliaryAmount,
  draftMatrixBalanced,
  draftMatrixTotals,
  draftLinesTotals,
  mapDraftLines,
  mirrorJvAmount,
  resolvedForeignAmount,
  syncAuxiliaryAmount,
  resyncJvMirrorPairs,
} from "@/lib/ledger/voucherDraftLineUtils";

const LEDGER = "USD";
const RATE = 89_500;
const JD = true;

function line(partial: Partial<DraftLine>): DraftLine {
  return {
    accountId: partial.accountId || "acct-test",
    debit: partial.debit ?? "",
    credit: partial.credit ?? "",
    description: partial.description ?? "",
    transactionCurrency: partial.transactionCurrency ?? "USD",
    fxRate: partial.fxRate ?? "",
    amountFx: partial.amountFx ?? "",
    costCenterId: partial.costCenterId ?? "",
    valueDate: partial.valueDate ?? "",
    mirrorDetached: partial.mirrorDetached,
  };
}

function assertBalanced(lines: DraftLine[], label: string) {
  expect(draftMatrixBalanced(lines, LEDGER, RATE, JD), `${label}: matrix not balanced`).toBe(true);
  const totals = draftLinesTotals(lines, LEDGER, JD, RATE);
  expect(totals.debit, `${label}: ledger debit`).toBe(totals.credit);
  expect(totals.debit, `${label}: ledger amount`).toBeGreaterThan(0);
}

function mappedLines(lines: DraftLine[]) {
  return mapDraftLines(lines, LEDGER, "2026-09-02", RATE, JD);
}

/** JV / CRN / DRN: mirrored USD + LBP pair */
function jvStylePair(): DraftLine[] {
  const usdDebit = line({ accountId: "cash", debit: "1000", transactionCurrency: "USD" });
  const lbpCredit = line({ accountId: "ap", credit: "89500000", transactionCurrency: "LBP" });
  let syncedUsd = syncAuxiliaryAmount(usdDebit, LEDGER, RATE, JD);
  let syncedLbp = syncAuxiliaryAmount(lbpCredit, LEDGER, RATE, JD);
  return [syncedUsd, syncedLbp];
}

describe("JD Edwards grid — all voucher types", () => {
  it("JV — USD/LBP pair balances and posts with FX", () => {
    const lines = jvStylePair();
    assertBalanced(lines, "JV");
    const posted = mappedLines(lines);
    expect(posted).toHaveLength(2);
    expect(posted[0].debit).toBe(1000);
    expect(posted[0].amountFx).toBe(89_500_000);
    expect(posted[0].fxRate).toBe(RATE);
    expect(posted[1].credit).toBe(1000);
    expect(posted[1].amountFx).toBe(89_500_000);
  });

  it("PV — debit AP (LBP) / credit cash (USD)", () => {
    const debitAp = syncAuxiliaryAmount(
      line({ accountId: "ap", debit: "89500000", transactionCurrency: "LBP" }),
      LEDGER,
      RATE,
      JD,
    );
    const creditCash = syncAuxiliaryAmount(
      line({ accountId: "cash", credit: "1000", transactionCurrency: "USD" }),
      LEDGER,
      RATE,
      JD,
    );
    const lines = [debitAp, creditCash];
    assertBalanced(lines, "PV");
    const posted = mappedLines(lines);
    expect(posted[0].debit).toBe(1000);
    expect(posted[1].credit).toBe(1000);
  });

  it("RV — debit cash (USD) / credit AR (LBP)", () => {
    const debitCash = syncAuxiliaryAmount(
      line({ accountId: "cash", debit: "500", transactionCurrency: "USD" }),
      LEDGER,
      RATE,
      JD,
    );
    const creditAr = syncAuxiliaryAmount(
      line({ accountId: "ar", credit: "44750000", transactionCurrency: "LBP" }),
      LEDGER,
      RATE,
      JD,
    );
    const lines = [debitCash, creditAr];
    assertBalanced(lines, "RV");
    const posted = mappedLines(lines);
    expect(posted[0].debit).toBe(500);
    expect(posted[0].amountFx).toBe(44_750_000);
    expect(posted[1].credit).toBe(500);
  });

  it("CRN — mirrored pair like JV", () => {
    const lines = jvStylePair();
    assertBalanced(lines, "CRN");
    expect(mappedLines(lines)).toHaveLength(2);
  });

  it("DRN — mirrored pair like JV", () => {
    const lines = jvStylePair();
    assertBalanced(lines, "DRN");
    expect(mappedLines(lines)).toHaveLength(2);
  });

  it("CV — transfer USD cash to LBP bank (balanced)", () => {
    const fromCash = syncAuxiliaryAmount(
      line({ accountId: "cash-usd", credit: "200", transactionCurrency: "USD" }),
      LEDGER,
      RATE,
      JD,
    );
    const toBank = syncAuxiliaryAmount(
      line({ accountId: "bank-lbp", debit: "17900000", transactionCurrency: "LBP" }),
      LEDGER,
      RATE,
      JD,
    );
    const lines = [toBank, fromCash];
    assertBalanced(lines, "CV");
    const posted = mappedLines(lines);
    expect(posted[0].debit).toBe(200);
    expect(posted[1].credit).toBe(200);
  });

  it("foreign amount override sticks (USD line → LBP foreign)", () => {
    const base = syncAuxiliaryAmount(
      line({ accountId: "cash", debit: "10", transactionCurrency: "USD" }),
      LEDGER,
      RATE,
      JD,
    );
    const overridden = applyManualAuxiliaryAmount(base, "900000", LEDGER, RATE, JD);
    expect(overridden.amountFx).toBe("900000");
    expect(Number(overridden.fxRate)).toBe(90_000);
    expect(resolvedForeignAmount(overridden, LEDGER, RATE, JD)).toBe("900000");
    const afterSync = syncAuxiliaryAmount(overridden, LEDGER, RATE, JD);
    expect(afterSync.amountFx).toBe("900000");
  });

  it("foreign amount override on LBP line (USD foreign)", () => {
    const base = syncAuxiliaryAmount(
      line({ accountId: "ap", debit: "89500000", transactionCurrency: "LBP" }),
      LEDGER,
      RATE,
      JD,
    );
    const overridden = applyManualAuxiliaryAmount(base, "990", LEDGER, RATE, JD);
    expect(overridden.amountFx).toBe("990");
    expect(Number(overridden.fxRate)).toBe(Math.round(89_500_000 / 990));
  });

  it("mirror pairs 0↔1 for JV debit edit", () => {
    const lines = [line({ accountId: "a" }), line({ accountId: "b" })];
    const next = mirrorJvAmount(lines, 0, "debit", "1000");
    expect(next[0].debit).toBe("1000");
    expect(next[1].credit).toBe("1000");
  });

  it("matrix totals — US and LL buckets each balance", () => {
    const lines = jvStylePair();
    const m = draftMatrixTotals(lines, LEDGER, RATE, JD);
    expect(m.usd.debit).toBe(m.usd.credit);
    expect(m.lbp.debit).toBe(m.lbp.credit);
    expect(m.ledger.debit).toBe(m.ledger.credit);
  });

  it("mirror pairs convert when line Ccy differs (USD → LBP)", () => {
    const lines = [
      line({ accountId: "a", transactionCurrency: "USD" }),
      line({ accountId: "b", transactionCurrency: "LBP" }),
    ];
    const next = mirrorJvAmount(lines, 0, "debit", "1000", {
      ledgerCurrency: LEDGER,
      voucherRate: RATE,
      jdEdwardsGrid: true,
    });
    expect(next[1].credit).toBe("89500000");
    const synced = syncAuxiliaryAmount(next[1], LEDGER, RATE, JD);
    expect(synced.amountFx).toBe("1000");
  });

  it("unset line Ccy uses ledger for foreign calc (not LBP default)", () => {
    const blank = line({ transactionCurrency: "", debit: "1000" });
    const synced = syncAuxiliaryAmount(blank, LEDGER, RATE, JD);
    expect(synced.amountFx).toBe("89500000");
    expect(resolvedForeignAmount(synced, LEDGER, RATE, JD)).toBe("89500000");
  });

  it("line 2 manual edit detaches mirror — line 1 keeps 56 when line 2 changed to 50", () => {
    let lines = mirrorJvAmount(
      [
        line({ accountId: "cash", debit: "56", transactionCurrency: "USD" }),
        line({ accountId: "elec", transactionCurrency: "USD" }),
      ],
      0,
      "debit",
      "56",
      { ledgerCurrency: LEDGER, voucherRate: RATE, jdEdwardsGrid: true },
    );
    expect(lines[1].credit).toBe("56");
    lines = mirrorJvAmount(lines, 1, "credit", "50", {
      ledgerCurrency: LEDGER,
      voucherRate: RATE,
      jdEdwardsGrid: true,
    });
    expect(lines[0].debit).toBe("56");
    expect(lines[1].credit).toBe("50");
    expect(lines[1].mirrorDetached).toBe(true);
    lines = mirrorJvAmount(lines, 0, "debit", "60", {
      ledgerCurrency: LEDGER,
      voucherRate: RATE,
      jdEdwardsGrid: true,
    });
    expect(lines[0].debit).toBe("60");
    expect(lines[1].credit).toBe("50");
  });

  it("resyncJvMirrorPairs skips when line 2 detached", () => {
    const lines = [
      line({ debit: "56", transactionCurrency: "USD" }),
      line({ credit: "50", transactionCurrency: "USD", mirrorDetached: true }),
    ];
    const synced = resyncJvMirrorPairs(lines, LEDGER, RATE, JD);
    expect(synced[1].credit).toBe("50");
  });

  it("lines 3+ do not mirror (independent FX / transport lines)", () => {
    const lines = [
      line({ debit: "1000", transactionCurrency: "USD" }),
      line({ credit: "89500000", transactionCurrency: "LBP" }),
      line({ accountId: "fx", credit: "89900", transactionCurrency: "LBP" }),
      line({ accountId: "transport", debit: "1000000", transactionCurrency: "LBP" }),
    ];
    const next = mirrorJvAmount(lines, 2, "credit", "89900", {
      ledgerCurrency: LEDGER,
      voucherRate: RATE,
      jdEdwardsGrid: true,
    });
    expect(next[2].credit).toBe("89900");
    expect(next[3].debit).toBe("1000000");
  });

  it("resync after line 2 set to LBP converts $500 to 44,750,000 LBP credit", () => {
    let lines = mirrorJvAmount(
      [
        line({ accountId: "exp", debit: "500", transactionCurrency: "USD" }),
        line({ accountId: "ap", transactionCurrency: "USD" }),
      ],
      0,
      "debit",
      "500",
      { ledgerCurrency: LEDGER, voucherRate: RATE, jdEdwardsGrid: true },
    );
    lines[1] = { ...lines[1], transactionCurrency: "LBP" };
    lines = resyncJvMirrorPairs(lines, LEDGER, RATE, JD);
    expect(lines[0].debit).toBe("500");
    expect(lines[1].credit).toBe("44750000");
    expect(lines[1].transactionCurrency).toBe("LBP");
    const synced = syncAuxiliaryAmount(lines[1], LEDGER, RATE, JD);
    expect(synced.amountFx).toBe("500");
  });
});
