/** Shared product emoji rules — keep in sync with src/lib/visualFallbacks.ts */

const POS_CATEGORY_ICONS: Record<string, string> = {
  other: '📦',
  services: '🛠️',
  accessories: '🎧',
  software: '📀',
  food: '🍽️',
  'drink---water': '💧',
};

export function extractEmojiFromText(text?: string): string | undefined {
  if (!text?.trim()) return undefined;
  const match = text.match(/\p{Extended_Pictographic}/u);
  return match?.[0];
}

export function resolveCategoryIcon(category?: string): string | undefined {
  const raw = String(category || '').trim();
  if (!raw) return undefined;
  const embedded = extractEmojiFromText(raw);
  if (embedded) return embedded;
  return POS_CATEGORY_ICONS[raw.toLowerCase()];
}

const NAME_EMOJI: Array<{ match: RegExp; emoji: string }> = [
  { match: /\bwater\b|sparkling/i, emoji: '💧' },
  { match: /coffee|espresso|latte|cappuccino|mocha|americano/i, emoji: '☕' },
  { match: /muffin|cookie|cake|croissant|bread|mankouche|zaatar/i, emoji: '🧁' },
  { match: /salad|quinoa|tuna|fruit/i, emoji: '🥗' },
  { match: /milk|vegan milk/i, emoji: '🥛' },
  { match: /ice cream|sundae|dessert/i, emoji: '🍦' },
  { match: /pizza|burger|food|khardal/i, emoji: '🍽️' },
  { match: /booking|birthday|entrance|party/i, emoji: '🎉' },
  { match: /craft|wood|paint|play/i, emoji: '🎨' },
  { match: /flour|sugar|cacao|choco|beans|almond|bounty|honduras/i, emoji: '🛒' },
  { match: /onion|spice|herb/i, emoji: '🧅' },
];

const CATEGORY_EMOJI: Array<{ match: RegExp; emoji: string }> = [
  { match: /bakery|bread|cake|pastry|dessert/i, emoji: '🥐' },
  { match: /coffee|caf[eé]/i, emoji: '☕' },
  { match: /pizza/i, emoji: '🍕' },
  { match: /burger|fast.?food/i, emoji: '🍔' },
  { match: /ice.?cream|sweet/i, emoji: '🍦' },
  { match: /vegan|plant|salad/i, emoji: '🥗' },
  { match: /spread|jam|honey/i, emoji: '🍯' },
  { match: /kitchen|food|meal|restaurant|dine/i, emoji: '🍽️' },
  { match: /drink|juice|smoothie|water/i, emoji: '🥤' },
  { match: /fashion|cloth|wear/i, emoji: '👗' },
  { match: /beauty|cosmetic|skin/i, emoji: '💄' },
  { match: /tech|electronic|phone/i, emoji: '📱' },
  { match: /\bbook\b|stationery/i, emoji: '📚' },
  { match: /gift|handmade/i, emoji: '🎁' },
  { match: /\bservice/i, emoji: '🛠️' },
  { match: /accessor/i, emoji: '🎧' },
];

export function productFallbackEmoji(icon?: string, category?: string, name?: string): string {
  if (icon?.trim()) return icon.trim();
  const nameHaystack = String(name || '');
  for (const rule of NAME_EMOJI) {
    if (rule.match.test(nameHaystack)) return rule.emoji;
  }
  const categoryIcon = resolveCategoryIcon(category);
  if (categoryIcon) return categoryIcon;
  const haystack = `${category || ''} ${name || ''}`;
  for (const rule of CATEGORY_EMOJI) {
    if (rule.match.test(haystack)) return rule.emoji;
  }
  return '🛍️';
}

export function resolveProductIconFromPayload(
  payload: Record<string, unknown>,
): string {
  const explicit = String(payload.icon || payload.emoji || payload.productIcon || '').trim();
  const category = String(payload.category || '').trim();
  const name = String(payload.name || '').trim();
  return productFallbackEmoji(explicit || undefined, category, name);
}

export function resolveStoredProductIcon(data: Record<string, unknown>): string {
  return productFallbackEmoji(
    String(data.icon || '').trim() || undefined,
    String(data.category || '').trim(),
    String(data.name || '').trim(),
  );
}
