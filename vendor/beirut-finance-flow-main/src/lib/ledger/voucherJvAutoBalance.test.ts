import { describe, expect, it } from "vitest";
import {
  activeLineMatrixAllocations,
  buildJvAutoBalanceLine,
  draftMatrixBalanced,
  draftMatrixGaps,
  emptyLine,
  flipJvLineCurrencyFromAlloc,
  activeLineSideAllocations,
  type DraftLine,
} from "@/lib/ledger/voucherDraftLineUtils";

const RATE = 89_500;
const LEDGER = "USD";
const JD = true;

function line(partial: Partial<DraftLine>): DraftLine {
  return { ...emptyLine("USD"), ...partial };
}

describe("JV auto balance & active line alloc", () => {
  it("previews LBP from USD on active line", () => {
    const active = line({ debit: "50", transactionCurrency: "USD" });
    const alloc = activeLineMatrixAllocations(active, LEDGER, RATE, JD);
    expect(alloc.usd).toBe(50);
    expect(alloc.lbp).toBe(4_475_000);
  });

  it("auto balance fills last line with USD and LBP gaps", () => {
    const lines: DraftLine[] = [
      line({ accountId: "exp", debit: "50", transactionCurrency: "USD", amountFx: "4475000" }),
      line({ accountId: "cash", credit: "49.98", transactionCurrency: "USD", amountFx: "4470000" }),
      line({ accountId: "fx", transactionCurrency: "USD" }),
    ];
    const gaps = draftMatrixGaps(lines, LEDGER, RATE, JD, 2);
    expect(gaps.usd).toBe(0.02);
    expect(gaps.lbp).toBe(5000);

    const filled = buildJvAutoBalanceLine(lines[2], lines, 2, LEDGER, RATE, JD);
    expect(filled).not.toBeNull();
    expect(Number(filled?.credit)).toBeCloseTo(0.02, 2);
    expect(Number(filled?.amountFx)).toBe(5000);

    const next = [...lines.slice(0, 2), filled!];
    expect(draftMatrixBalanced(next, LEDGER, RATE, JD)).toBe(true);
  });

  it("Ctrl+P flip USD debit to LBP with foreign USD preserved", () => {
    const row = line({ debit: "50", transactionCurrency: "USD" });
    const flipped = flipJvLineCurrencyFromAlloc(row, "debit", LEDGER, RATE, JD);
    expect(flipped?.transactionCurrency).toBe("LBP");
    expect(flipped?.debit).toBe("4475000");
    expect(flipped?.amountFx).toBe("50");
    expect(flipped?.fxRate).toBe(String(RATE));
  });

  it("Ctrl+P flip LBP credit back to USD", () => {
    const row = line({
      credit: "4475000",
      transactionCurrency: "LBP",
      amountFx: "50",
      fxRate: String(RATE),
    });
    const flipped = flipJvLineCurrencyFromAlloc(row, "credit", LEDGER, RATE, JD);
    expect(flipped?.transactionCurrency).toBe("USD");
    expect(Number(flipped?.credit)).toBeCloseTo(50, 2);
    expect(flipped?.amountFx).toBe("4475000");
  });

  it("side preview follows focused Dr cell only", () => {
    const row = line({ debit: "50", credit: "10", transactionCurrency: "USD" });
    const dr = activeLineSideAllocations(row, "debit", LEDGER, RATE, JD);
    const cr = activeLineSideAllocations(row, "credit", LEDGER, RATE, JD);
    expect(dr.lbp).toBe(4_475_000);
    expect(cr.lbp).toBe(895_000);
  });

  it("flip round-trip USD → LBP → USD on same side", () => {
    const row = line({ debit: "50", transactionCurrency: "USD" });
    const lbp = flipJvLineCurrencyFromAlloc(row, "debit", LEDGER, RATE, JD)!;
    expect(lbp.transactionCurrency).toBe("LBP");
    const usd = flipJvLineCurrencyFromAlloc(lbp, "debit", LEDGER, RATE, JD)!;
    expect(usd.transactionCurrency).toBe("USD");
    expect(Number(usd.debit)).toBeCloseTo(50, 2);
  });
});
