/** Heuristic parse of Vision OCR text into a receipt draft. Image is never stored. */

export type OcrLineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type OcrSuggestedDestination = 'purchase' | 'expense' | 'ambiguous';

export type OcrDraft = {
  rawText: string;
  vendorName: string;
  date: string;
  currency: string;
  total: number;
  lineItems: OcrLineItem[];
  suggestedDestination: OcrSuggestedDestination;
  suggestionReason: string;
};

const EXPENSE_HINTS =
  /\b(rent|electric|electricity|water|internet|phone|salary|payroll|fuel|gas|insurance|maintenance|utility|utilities|subscription|fee|tax|إيجار|كهرباء|ماء|انترنت|راتب|وقود|تأمين)\b/i;

const PURCHASE_HINTS =
  /\b(invoice|فاتورة|qty|quantity|كمية|kg|pcs|piece|box|carton|supplier|مواد|بضاعة|item)\b/i;

function parseMoney(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.,]/g, '').replace(/,/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseDate(text: string): string {
  const iso = text.match(/\b(20\d{2})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\b/);
  if (iso) {
    const y = iso[1];
    const m = iso[2].padStart(2, '0');
    const d = iso[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const dmy = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](20\d{2})\b/);
  if (dmy) {
    const d = dmy[1].padStart(2, '0');
    const m = dmy[2].padStart(2, '0');
    const y = dmy[3];
    return `${y}-${m}-${d}`;
  }
  return new Date().toISOString().slice(0, 10);
}

function detectCurrency(text: string): string {
  if (/\b(LBP|LL|ل\.?ل)\b/i.test(text) || /ليرة/.test(text)) return 'LBP';
  if (/\b(USD|\$|US\$|دولار)\b/i.test(text)) return 'USD';
  return 'USD';
}

function extractTotal(lines: string[]): number {
  const totalRe =
    /(?:grand\s*)?total|amount\s*due|net\s*amount|المبلغ|الإجمالي|اجمالي|المجموع/i;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!totalRe.test(line)) continue;
    const moneyMatch = line.match(/(\d[\d,]*(?:\.\d{1,3})?)/g);
    if (!moneyMatch?.length) continue;
    const n = parseMoney(moneyMatch[moneyMatch.length - 1]);
    if (n != null && n > 0) return n;
  }
  // Fallback: largest money-looking number near the end
  let best = 0;
  for (const line of lines.slice(-12)) {
    const nums = line.match(/(\d[\d,]*(?:\.\d{1,3})?)/g) || [];
    for (const raw of nums) {
      const n = parseMoney(raw);
      if (n != null && n > best) best = n;
    }
  }
  return best;
}

function extractVendor(lines: string[]): string {
  for (const line of lines.slice(0, 8)) {
    const t = line.trim();
    if (t.length < 3 || t.length > 80) continue;
    if (/^\d/.test(t)) continue;
    if (/^(tel|phone|fax|email|www|http|invoice|فاتورة|receipt)/i.test(t)) continue;
    if (/^\d{1,2}[\/\-.]\d{1,2}/.test(t)) continue;
    return t;
  }
  return '';
}

function extractLineItems(lines: string[]): OcrLineItem[] {
  const items: OcrLineItem[] = [];
  const skip = /(?:grand\s*)?total|subtotal|tax|vat|amount\s*due|المبلغ|الإجمالي|اجمالي|ضريبة/i;
  // description ... qty ... price  OR  description ... amount
  const rowRe =
    /^(.+?)\s+(\d+(?:[.,]\d+)?)\s+(?:x\s*)?(\d[\d,]*(?:\.\d{1,3})?)(?:\s+(\d[\d,]*(?:\.\d{1,3})?))?$/i;

  for (const line of lines) {
    const t = line.trim();
    if (t.length < 4 || skip.test(t)) continue;
    const m = t.match(rowRe);
    if (!m) continue;
    const description = m[1].replace(/[.\-–—]+$/g, '').trim();
    if (description.length < 2) continue;
    const a = parseMoney(m[2]) ?? 0;
    const b = parseMoney(m[3]) ?? 0;
    const c = m[4] != null ? parseMoney(m[4]) : null;
    let quantity = 1;
    let unitPrice = 0;
    let total = 0;
    if (c != null && c > 0) {
      quantity = a || 1;
      unitPrice = b;
      total = c;
    } else if (a > 0 && b > 0 && a < 1000 && b >= a) {
      // qty + line total
      quantity = a;
      total = b;
      unitPrice = quantity ? total / quantity : total;
    } else {
      total = b || a;
      unitPrice = total;
      quantity = 1;
    }
    if (total <= 0 && unitPrice <= 0) continue;
    items.push({
      description,
      quantity: quantity || 1,
      unitPrice: Number(unitPrice.toFixed(4)),
      total: Number((total || unitPrice * quantity).toFixed(2)),
    });
    if (items.length >= 40) break;
  }
  return items;
}

function suggestDestination(
  text: string,
  lineItems: OcrLineItem[],
): { suggestedDestination: OcrSuggestedDestination; suggestionReason: string } {
  const expenseHit = EXPENSE_HINTS.test(text);
  const purchaseHit = PURCHASE_HINTS.test(text) || lineItems.length >= 2;

  if (expenseHit && !purchaseHit) {
    return { suggestedDestination: 'expense', suggestionReason: 'Looks like a bill/fee (no stock lines).' };
  }
  if (purchaseHit && !expenseHit) {
    return {
      suggestedDestination: 'purchase',
      suggestionReason: lineItems.length >= 2 ? 'Multiple line items suggest a supplier invoice.' : 'Invoice/stock wording detected.',
    };
  }
  if (lineItems.length >= 2) {
    return { suggestedDestination: 'purchase', suggestionReason: 'Multiple line items suggest a purchase.' };
  }
  if (lineItems.length === 0 && expenseHit) {
    return { suggestedDestination: 'expense', suggestionReason: 'Expense keywords with no line items.' };
  }
  return {
    suggestedDestination: 'ambiguous',
    suggestionReason: 'Could be either — pick Purchase or Expense on confirm.',
  };
}

export function parseOcrText(rawText: string): OcrDraft {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const lineItems = extractLineItems(lines);
  const total = extractTotal(lines) || lineItems.reduce((s, i) => s + i.total, 0);
  const { suggestedDestination, suggestionReason } = suggestDestination(rawText, lineItems);

  return {
    rawText,
    vendorName: extractVendor(lines),
    date: parseDate(rawText),
    currency: detectCurrency(rawText),
    total: Number((total || 0).toFixed(2)),
    lineItems,
    suggestedDestination,
    suggestionReason,
  };
}
