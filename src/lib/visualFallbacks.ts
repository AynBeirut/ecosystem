/** Shared rules for when to show a styled icon tile instead of a remote image. */

const PLACEHOLDER_HOSTS = ['placehold.co', 'via.placeholder.com', 'dummyimage.com', 'picsum.photos'];

export function isPlaceholderImageUrl(url?: string): boolean {
  const value = url?.trim() || '';
  if (!value) return true;
  const lower = value.toLowerCase();
  if (lower.startsWith('data:image/svg+xml')) return true;
  return PLACEHOLDER_HOSTS.some((host) => lower.includes(host));
}

export function storeInitial(name?: string): string {
  const trimmed = name?.trim() || '';
  if (!trimmed) return 'S';
  return trimmed[0].toUpperCase();
}

const STORE_PALETTES = [
  { gradient: 'from-teal-50 via-cyan-50 to-teal-100', icon: 'text-teal-600', ring: 'ring-teal-100' },
  { gradient: 'from-violet-50 via-purple-50 to-fuchsia-100', icon: 'text-violet-600', ring: 'ring-violet-100' },
  { gradient: 'from-amber-50 via-orange-50 to-yellow-100', icon: 'text-amber-600', ring: 'ring-amber-100' },
  { gradient: 'from-rose-50 via-pink-50 to-red-100', icon: 'text-rose-600', ring: 'ring-rose-100' },
  { gradient: 'from-sky-50 via-blue-50 to-indigo-100', icon: 'text-sky-600', ring: 'ring-sky-100' },
  { gradient: 'from-lime-50 via-green-50 to-emerald-100', icon: 'text-lime-700', ring: 'ring-lime-100' },
] as const;

export function storePalette(name?: string) {
  const label = name?.trim() || 'Store';
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  return STORE_PALETTES[Math.abs(hash) % STORE_PALETTES.length];
}

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

const PRODUCT_PALETTES = [
  'from-amber-50 via-orange-50 to-lime-100',
  'from-rose-50 via-pink-50 to-orange-100',
  'from-sky-50 via-cyan-50 to-teal-100',
  'from-violet-50 via-purple-50 to-fuchsia-100',
  'from-lime-50 via-emerald-50 to-green-100',
] as const;

export function productPalette(name?: string): string {
  const label = name?.trim() || 'Product';
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PRODUCT_PALETTES[Math.abs(hash) % PRODUCT_PALETTES.length];
}
