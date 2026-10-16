/**
 * Cash-book imports often put invoice line text in the vendor title, e.g.
 * "Le Marchet Selectif ( Chedar Cheese, Tortilla Bread …)" — show vendor only.
 */
export function stripCashBookLineFromVendorName(raw: string): string {
  let name = String(raw || '').trim();
  if (!name) return name;

  const openParen = name.indexOf(' (');
  if (openParen > 0) {
    name = name.slice(0, openParen).trim();
  }

  name = name.replace(/\s+inv\s*\([^)]*\)\s*$/i, '').trim();
  name = name.replace(/\s+for\s+.+$/i, '').trim();
  name = name.replace(/\s+/g, ' ');

  const leMarchet = normalizeLeMarchetVendorLabel(name);
  if (leMarchet) return leMarchet;
  if (/^spinneys\b/i.test(name)) {
    return 'Spinneys';
  }
  if (/^maliks\b/i.test(name)) {
    return 'Maliks';
  }
  if (/^boucherie\s+ziad\b/i.test(name)) {
    return 'Boucherie Ziad';
  }
  if (/^storium\b/i.test(name)) {
    return 'Storium';
  }

  return name;
}

export function displayVendorPartyName(raw: string): string {
  return stripCashBookLineFromVendorName(raw);
}

function normalizeLeMarchetVendorLabel(name: string): string | null {
  const n = name.trim();
  if (/^le\s+m[ae]r(?:chet|che)\s+sel[ae]ctif\s*$/i.test(n)) return 'Le Marchet Selectif';
  if (/^le\s+m[ae]r(?:chet|che)\s+slectif\s*$/i.test(n)) return 'Le Marchet Selectif';
  if (/^le\s+marcher\s*$/i.test(n)) return 'Le Marchet Selectif';
  if (/^le\s+m[ae]rche?t\s+(fruits|ice)\b/i.test(n)) return 'Le Marchet Selectif';
  if (/^le\s+m[ae]rche?t\s+sel[ae]ctif\s+for\b/i.test(n)) return 'Le Marchet Selectif';
  return null;
}
