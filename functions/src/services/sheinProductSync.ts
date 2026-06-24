import axios from 'axios';

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

export type SheinSyncResult = {
  inStock: boolean;
  stock: number;
  imageUrl?: string;
  title?: string;
  description?: string;
  externalId?: string;
  message: string;
  blockedByShein?: boolean;
};

export function isSheinProductUrl(url: string): boolean {
  try {
    const host = new URL(url.trim()).hostname.toLowerCase();
    return host === 'shein.com' || host.endsWith('.shein.com');
  } catch {
    return false;
  }
}

export function normalizeSheinProductUrl(url: string): string {
  const trimmed = url.trim();
  const parsed = new URL(trimmed);
  if (!isSheinProductUrl(trimmed)) {
    throw new Error('URL must be a shein.com product link');
  }
  parsed.protocol = 'https:';
  return parsed.toString();
}

export function parseSheinExternalId(url: string): string | undefined {
  try {
    const parsed = new URL(url.trim());
    const fromQuery =
      parsed.searchParams.get('goods_id') ||
      parsed.searchParams.get('goodsId') ||
      parsed.searchParams.get('id');
    if (fromQuery) return fromQuery;

    const pathMatch =
      parsed.pathname.match(/-p-(\d+)\.html/i) ||
      parsed.pathname.match(/\/(\d{6,})\.html/i);
    return pathMatch?.[1];
  } catch {
    return undefined;
  }
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function extractMetaContent(html: string, property: string): string | undefined {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtmlEntities(match[1].trim());
  }
  return undefined;
}

function extractProductTitle(html: string): string | undefined {
  const ogTitle = extractMetaContent(html, 'og:title');
  if (ogTitle && !isGenericSheinTitle(ogTitle)) return ogTitle;

  const titleTag = html.match(/<title>([^<]{8,300})<\/title>/i)?.[1];
  if (titleTag && !isGenericSheinTitle(decodeHtmlEntities(titleTag))) {
    return decodeHtmlEntities(titleTag.trim());
  }
  return undefined;
}

function isGenericSheinTitle(title: string): boolean {
  const normalized = title.toLowerCase();
  return (
    normalized.includes('shop online fashion') ||
    normalized.includes('shein.com') && normalized.length < 80 ||
    normalized.includes('ملابس نسائية') ||
    normalized.includes('تسوق الموضة')
  );
}

function detectSheinBlockedPage(html: string, externalId?: string): boolean {
  const hasProductJson =
    (externalId && html.includes(`"goods_id":"${externalId}"`)) ||
    (externalId && html.includes(`"goods_id":${externalId}`)) ||
    (externalId && html.includes(`"goodsId":${externalId}`)) ||
    /"isSoldOut"\s*:\s*(true|false)/i.test(html) ||
    /"is_on_sale"\s*:\s*[01]/i.test(html);

  if (hasProductJson) return false;

  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1] || '';
  const genericTitle = isGenericSheinTitle(decodeHtmlEntities(title));
  const hasProductOgImage = Boolean(extractMetaContent(html, 'og:image')?.includes('ltwebstatic'));
  const hasAddToBag = />\s*add to (bag|cart)\s*</i.test(html);

  return genericTitle && !hasProductOgImage && !hasAddToBag;
}

function parseStockFromHtml(html: string): { inStock: boolean; reason: string } {
  // JSON signals first (most reliable).
  if (/"isSoldOut"\s*:\s*true/i.test(html) || /"soldOut"\s*:\s*true/i.test(html)) {
    return { inStock: false, reason: 'Supplier page indicates sold out' };
  }
  if (/"isSoldOut"\s*:\s*false/i.test(html) || /"soldOut"\s*:\s*false/i.test(html)) {
    return { inStock: true, reason: 'Supplier page indicates in stock' };
  }
  if (/"stock"\s*:\s*0\b/i.test(html) || /"is_on_sale"\s*:\s*0\b/i.test(html)) {
    return { inStock: false, reason: 'Supplier page indicates sold out' };
  }
  if (/"stock"\s*:\s*[1-9]\d*/i.test(html)) {
    return { inStock: true, reason: 'Supplier page indicates in stock' };
  }

  // Visible UI text only — do NOT match CSS classes like `.soldout`.
  if (/>\s*sold\s+out\s*</i.test(html) || />\s*out\s+of\s+stock\s*</i.test(html)) {
    return { inStock: false, reason: 'Supplier page indicates sold out' };
  }
  if (/>\s*add to (bag|cart)\s*</i.test(html)) {
    return { inStock: true, reason: 'Supplier page indicates in stock' };
  }

  throw new Error(
    'Could not read stock from Shein page. Shein may be blocking automated reads — check the item in the Shein app and set visibility manually.',
  );
}

export async function fetchSheinAvailability(productUrl: string): Promise<SheinSyncResult> {
  const normalizedUrl = normalizeSheinProductUrl(productUrl);
  const externalId = parseSheinExternalId(normalizedUrl);

  const response = await axios.get<string>(normalizedUrl, {
    headers: {
      ...FETCH_HEADERS,
      Referer: 'https://www.shein.com/',
    },
    timeout: 20000,
    maxRedirects: 5,
    responseType: 'text',
    validateStatus: (status) => status >= 200 && status < 400,
  });

  const html = typeof response.data === 'string' ? response.data : String(response.data || '');
  if (!html || html.length < 200) {
    throw new Error('Empty response from Shein — request may have been blocked');
  }

  if (detectSheinBlockedPage(html, externalId)) {
    const err = new Error(
      'Shein did not return product details to our server (bot protection). Save the link for your reference, then set name, image, and stock manually after checking the Shein app.',
    );
    (err as Error & { blockedByShein?: boolean }).blockedByShein = true;
    throw err;
  }

  const { inStock, reason } = parseStockFromHtml(html);
  const imageUrl = extractMetaContent(html, 'og:image');
  const title = extractProductTitle(html);
  const description = extractMetaContent(html, 'og:description');

  return {
    inStock,
    stock: inStock ? 1 : 0,
    imageUrl,
    title,
    description,
    externalId,
    message: reason,
  };
}
