import { describe, expect, it } from "vitest";
import {
  formatVoucherAmountDisplay,
  parseVoucherAmountNumber,
  sanitizeVoucherAmountInput,
} from "@/lib/ledger/voucherAmountInput";

describe("voucherAmountInput", () => {
  it("strips commas and keeps decimals", () => {
    expect(sanitizeVoucherAmountInput("500,000,000")).toBe("500000000");
    expect(sanitizeVoucherAmountInput("4,475,000.50")).toBe("4475000.50");
  });

  it("formats large LBP with grouping", () => {
    expect(formatVoucherAmountDisplay("500000000")).toBe("500,000,000");
    expect(formatVoucherAmountDisplay("4475000")).toBe("4,475,000");
  });

  it("parses numeric value", () => {
    expect(parseVoucherAmountNumber("4,475,000")).toBe(4475000);
  });
});
