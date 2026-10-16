import { ADDON_PRICING, PLAN_PRICING, type AddOnKey, type PaidTier } from '@/lib/pricingDisplay';
import { PHASE1_PACKAGES } from '@/lib/marketingPackages';
import { ORDERED_PRESET_LIST } from '@/lib/packagePresets';

/** Public HTTPS image for Meta (required on every row). */
export const GRABIO_META_CATALOG_IMAGE =
  'https://grabio.space/icon-192x192.png';

export type GrabioMetaCatalogRow = {
  id: string;
  title: string;
  description: string;
  availability: 'in stock' | 'out of stock';
  condition: 'new';
  price: string;
  link: string;
  image_link: string;
  brand: string;
  google_product_category: string;
  retailer_id: string;
};

const BRAND = 'Grabio';
const CATEGORY = 'Software > Business & Productivity Software';

export function grabioPlanCatalogId(tier: PaidTier): string {
  return `grabio-plan-${tier}`;
}

export function grabioAddonCatalogId(key: AddOnKey): string {
  return `grabio-addon-${key}`;
}

export function grabioDemoCatalogId(slug: string): string {
  return `grabio-demo-${String(slug || '').trim()}`;
}

export function grabioPresetCatalogId(presetKey: string): string {
  return `grabio-preset-${String(presetKey || '').trim()}`;
}

function planRow(tier: PaidTier): GrabioMetaCatalogRow {
  const monthly = PLAN_PRICING[tier].monthly;
  const id = grabioPlanCatalogId(tier);
  const title = `Grabio ${tier.charAt(0).toUpperCase()}${tier.slice(1)} Plan`;
  return {
    id,
    retailer_id: id,
    title,
    description: `${title} — modular venue operations, CRM, and apps on grabio.space`,
    availability: 'in stock',
    condition: 'new',
    price: `${monthly.toFixed(2)} USD`,
    link: `https://grabio.space/pricing#${tier}`,
    image_link: GRABIO_META_CATALOG_IMAGE,
    brand: BRAND,
    google_product_category: CATEGORY,
  };
}

function addonRow(key: AddOnKey): GrabioMetaCatalogRow {
  const meta = ADDON_PRICING[key];
  const id = grabioAddonCatalogId(key);
  return {
    id,
    retailer_id: id,
    title: `Grabio ${meta.label}`,
    description: meta.label,
    availability: 'in stock',
    condition: 'new',
    price: `${meta.monthly.toFixed(2)} USD`,
    link: 'https://grabio.space/pricing',
    image_link: GRABIO_META_CATALOG_IMAGE,
    brand: BRAND,
    google_product_category: CATEGORY,
  };
}

export function buildGrabioMetaCatalogRows(): GrabioMetaCatalogRow[] {
  const tiers: PaidTier[] = ['starter', 'pro', 'business'];
  const rows: GrabioMetaCatalogRow[] = tiers.map(planRow);

  (Object.keys(ADDON_PRICING) as AddOnKey[]).forEach((key) => {
    rows.push(addonRow(key));
  });

  for (const pkg of PHASE1_PACKAGES) {
    const id = grabioDemoCatalogId(pkg.slug);
    rows.push({
      id,
      retailer_id: id,
      title: `Grabio for ${pkg.label}`,
      description: pkg.metaDescription,
      availability: 'in stock',
      condition: 'new',
      price: '10.00 USD',
      link: `https://grabio.space/demo/${pkg.slug}`,
      image_link: GRABIO_META_CATALOG_IMAGE,
      brand: BRAND,
      google_product_category: CATEGORY,
    });
  }

  for (const preset of ORDERED_PRESET_LIST) {
    const id = grabioPresetCatalogId(preset.key);
    rows.push({
      id,
      retailer_id: id,
      title: preset.label,
      description: preset.limitLines.join('; '),
      availability: 'in stock',
      condition: 'new',
      price: `${Number(preset.monthlyUsd || 10).toFixed(2)} USD`,
      link: `https://grabio.space/login?tab=signup&preset=${encodeURIComponent(preset.key)}`,
      image_link: GRABIO_META_CATALOG_IMAGE,
      brand: BRAND,
      google_product_category: CATEGORY,
    });
  }

  const whitelabelId = 'grabio-whitelabel-app';
  rows.push({
    id: whitelabelId,
    retailer_id: whitelabelId,
    title: 'Grabio White-Label Store App',
    description: 'Branded buyer mobile app — one-time setup',
    availability: 'in stock',
    condition: 'new',
    price: '200.00 USD',
    link: 'https://grabio.space/pricing',
    image_link: GRABIO_META_CATALOG_IMAGE,
    brand: BRAND,
    google_product_category: CATEGORY,
  });

  return rows;
}

export const GRABIO_META_CATALOG_IDS: readonly string[] = buildGrabioMetaCatalogRows().map((r) => r.id);

const GRABIO_CATALOG_ID_SET = new Set(GRABIO_META_CATALOG_IDS);

export function isGrabioMarketingCatalogId(productId: string | undefined | null): boolean {
  const id = String(productId || '').trim();
  return id.length > 0 && GRABIO_CATALOG_ID_SET.has(id);
}

function escapeCsvCell(value: string): string {
  const cell = String(value ?? '').replace(/\r?\n/g, ' ').trim();
  if (/[",\n]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

export function grabioMetaCatalogToCsv(rows: GrabioMetaCatalogRow[] = buildGrabioMetaCatalogRows()): string {
  const headers = [
    'id',
    'title',
    'description',
    'availability',
    'condition',
    'price',
    'link',
    'image_link',
    'brand',
    'google_product_category',
    'retailer_id',
  ];
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(
      [
        row.id,
        row.title,
        row.description,
        row.availability,
        row.condition,
        row.price,
        row.link,
        row.image_link,
        row.brand,
        row.google_product_category,
        row.retailer_id,
      ]
        .map(escapeCsvCell)
        .join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}
