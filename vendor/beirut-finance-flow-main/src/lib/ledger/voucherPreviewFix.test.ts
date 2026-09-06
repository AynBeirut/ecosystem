import { describe, expect, it } from "vitest";
import {
  draftMatrixBalanced,
  draftMatrixTotals,
  draftLinesTotals,
  emptyLine,
  mapDraftLines,
  mirrorJvAmount,
  syncAuxiliaryAmount,
  previewLineSideAmount,
  previewLineFxLabel,
} from "@/lib/ledger/voucherDraftLineUtils";

const LEDGER = "USD";
const RATE = 89_500;
const JD = true;

describe("JV preview balance scenarios", () => {
  it("simple 50/50 USD mirror balances for preview", () => {
    let lines = mirrorJvAmount(
      [
        { ...emptyLine("USD"), accountId: "cash" },
        { ...emptyLine("USD"), accountId: "exp" },
      ],
      0,
      "debit",
      "50",
      { ledgerCurrency: LEDGER, voucherRate: RATE, jdEdwardsGrid: true },
    );
    lines = lines.map((l) => syncAuxiliaryAmount(l, LEDGER, RATE, JD));
    expect(draftMatrixBalanced(lines, LEDGER, RATE, JD)).toBe(true);
    expect(mapDraftLines(lines, LEDGER, "2026-09-04", RATE, JD)).toHaveLength(2);
  });

  it("comma-formatted amounts still balance when parsed", () => {
    const lines = [
      {
        ...emptyLine("USD"),
        accountId: "cash",
        debit: "4,475,000",
        transactionCurrency: "LBP",
      },
      {
        ...emptyLine("USD"),
        accountId: "ap",
        credit: "50",
        transactionCurrency: "USD",
        amountFx: "4475000",
      },
    ];
    const totals = draftLinesTotals(lines, LEDGER, JD, RATE);
    expect(totals.debit).toBeGreaterThan(0);
    expect(totals.credit).toBe(50);
  });

  it("preview shows LBP line debit in LBP, not converted USD", () => {
    const lines = [
      {
        ...emptyLine("USD"),
        accountId: "exp",
        debit: "447500",
        transactionCurrency: "LBP",
        amountFx: "5",
        fxRate: String(RATE),
      },
      {
        ...emptyLine("USD"),
        accountId: "cash",
        credit: "60",
        transactionCurrency: "USD",
        amountFx: "5370000",
        fxRate: String(RATE),
      },
    ];
    const mapped = mapDraftLines(lines, LEDGER, "2026-09-04", RATE, JD);
    const lbpLine = mapped[0];
    expect(lbpLine.debit).toBeCloseTo(5, 2);
    expect(lbpLine.amountFx).toBe(447500);

    const display = previewLineSideAmount(lbpLine, "debit", LEDGER, JD);
    expect(display).toEqual({ amount: 447500, currency: "LBP" });

    expect(previewLineFxLabel(lbpLine, LEDGER, JD)).toBe("5.00 USD × 89,500");
  });

  it("preview FX for USD line shows LBP foreign amount", () => {
    const lines = [
      {
        ...emptyLine("USD"),
        accountId: "exp",
        debit: "55",
        transactionCurrency: "USD",
        amountFx: "4922500",
        fxRate: String(RATE),
      },
      {
        ...emptyLine("USD"),
        accountId: "cash",
        credit: "60",
        transactionCurrency: "USD",
      },
    ];
    const mapped = mapDraftLines(
      mirrorJvAmount(
        lines,
        1,
        "credit",
        "60",
        { ledgerCurrency: LEDGER, voucherRate: RATE, jdEdwardsGrid: true },
      ).map((l) => syncAuxiliaryAmount(l, LEDGER, RATE, JD)),
      LEDGER,
      "2026-09-04",
      RATE,
      JD,
    );
    const usdLine = mapped.find((l) => l.debit === 55);
    expect(usdLine).toBeDefined();
    expect(previewLineSideAmount(usdLine!, "debit", LEDGER, JD)).toEqual({
      amount: 55,
      currency: "USD",
    });
    expect(previewLineFxLabel(usdLine!, LEDGER, JD)).toBe("4,922,500 LBP × 89,500");
  });
});
