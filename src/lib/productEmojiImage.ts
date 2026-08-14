/** Warm gradient tile with centered emoji — works as product.image on any storefront build. */
export function buildEmojiProductImage(emoji: string): string {
  const safe = emoji.trim() || '🍽️';
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">',
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">',
    '<stop offset="0%" stop-color="#FEF3C7"/>',
    '<stop offset="50%" stop-color="#FFEDD5"/>',
    '<stop offset="100%" stop-color="#ECFCCB"/>',
    '</linearGradient></defs>',
    '<rect width="200" height="200" fill="url(#g)"/>',
    `<text x="100" y="112" font-size="72" text-anchor="middle">${safe}</text>`,
    '</svg>',
  ].join('');
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function isEmojiProductImage(image?: string): boolean {
  return Boolean(image?.startsWith('data:image/svg+xml'));
}
