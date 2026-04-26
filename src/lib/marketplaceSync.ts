import type { Product } from '@/types/product';

export type MarketplacePayload = {
  productId: string;
  name: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  inStock: boolean;
  image: string;
  slug: string;
  sku: string;
  productType: string;
  channelData?: Record<string, unknown>;
};

const toMillis = (value: unknown): number => {
  if (!value) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const t = Date.parse(value);
    return Number.isFinite(t) ? t : 0;
  }
  if (typeof value === 'object' && value !== null) {
    const maybe = value as { toDate?: () => Date; seconds?: number };
    if (typeof maybe.toDate === 'function') return maybe.toDate().getTime();
    if (typeof maybe.seconds === 'number') return maybe.seconds * 1000;
  }
  return 0;
};

const tokenize = (input: string): string[] => {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
};

export const toBaseMarketplacePayload = (product: Product): MarketplacePayload => ({
  productId: product.id,
  name: product.name,
  description: product.description || '',
  category: product.category || 'General',
  price: Number(product.price || 0),
  stock: Number(product.stock || 0),
  inStock: Boolean(product.inStock),
  image: product.image || '',
  slug: product.slug || '',
  sku: product.sku || '',
  productType: product.productType || 'simple',
});

export const applyChannelTransform = (
  channelId: string,
  item: MarketplacePayload
): MarketplacePayload => {
  const channel = channelId.toLowerCase();

  if (channel === 'alibaba') {
    return {
      ...item,
      channelData: {
        listingLanguage: 'en',
        minOrderQuantity: 1,
        priceTier: [{ quantity: 1, unitPrice: item.price }],
        inventoryPolicy: item.stock > 0 ? 'in_stock' : 'out_of_stock',
      },
    };
  }

  if (channel === 'amazon') {
    const bulletPoints = item.description
      .split(/[.!?]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 5);

    return {
      ...item,
      channelData: {
        title: item.name,
        bullets: bulletPoints,
        condition: 'new_new',
        fulfillmentChannel: 'MFN',
      },
    };
  }

  if (channel === 'ebay') {
    return {
      ...item,
      channelData: {
        listingType: 'FixedPriceItem',
        quantity: Math.max(0, item.stock),
        format: 'buy_it_now',
      },
    };
  }

  if (channel === 'etsy') {
    const tags = Array.from(new Set([...tokenize(item.name), ...tokenize(item.category)])).slice(0, 13);
    return {
      ...item,
      channelData: {
        whoMade: 'i_did',
        whenMade: 'made_to_order',
        isSupply: false,
        tags,
      },
    };
  }

  if (channel === 'walmart') {
    return {
      ...item,
      channelData: {
        fulfillmentLagTime: item.stock > 0 ? 1 : 3,
        visibility: item.stock > 0 ? 'published' : 'hidden',
      },
    };
  }

  return item;
};

export const buildMarketplacePayload = (channelId: string, products: Product[]): MarketplacePayload[] => {
  return products
    .map((product) => toBaseMarketplacePayload(product))
    .map((item) => applyChannelTransform(channelId, item));
};

export const filterIncrementalProducts = (
  products: Product[],
  lastSyncIso: string
): Product[] => {
  const threshold = toMillis(lastSyncIso);
  if (!threshold) return products;

  return products.filter((product) => {
    const source = (product as Product & { updatedAt?: unknown; createdAt?: unknown }).updatedAt
      ?? (product as Product & { createdAt?: unknown }).createdAt;
    const updatedAt = toMillis(source);
    return updatedAt > threshold;
  });
};
