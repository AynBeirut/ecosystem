/** Strip grouping commas; keep digits and at most one decimal point. */
export function sanitizeVoucherAmountInput(raw: string): string {
  const cleaned = String(raw || "").replace(/,/g, "").trim();
  if (!cleaned) return "";
  let out = "";
  let dot = false;
  for (const ch of cleaned) {
    if (ch >= "0" && ch <= "9") {
      out += ch;
      continue;
    }
    if (ch === "." && !dot) {
      dot = true;
      out += ch;
    }
  }
  return out;
}

/** Excel-style grouping for display while typing (integer part only). */
export function formatVoucherAmountDisplay(raw: string): string {
  const value = sanitizeVoucherAmountInput(raw);
  if (!value) return "";
  const [intPart, decPart] = value.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart !== undefined ? `${grouped}.${decPart}` : grouped;
}

export function parseVoucherAmountNumber(raw: string): number {
  const n = Number(sanitizeVoucherAmountInput(raw));
  return Number.isFinite(n) ? n : 0;
}
