import { getAuth } from 'firebase/auth';
import { getApiBaseUrl } from '@/lib/apiBase';
import type { SupplierPlatform } from '@/types/product';

export type DropshipSyncResponse = {
  success: boolean;
  inStock?: boolean;
  stock?: number;
  imageUpdated?: boolean;
  message?: string;
  syncedAt?: string;
  error?: string;
};

export const DROPSHIP_SUPPLIER_OPTIONS: { value: SupplierPlatform; label: string }[] = [
  { value: 'shein', label: 'Shein' },
  { value: 'alibaba', label: 'Alibaba' },
  { value: 'amazon', label: 'Amazon' },
];

export function supplierLinkPlaceholder(platform: SupplierPlatform): string {
  if (platform === 'alibaba') return 'https://www.alibaba.com/product-detail/...';
  if (platform === 'amazon') return 'https://www.amazon.com/dp/...';
  return 'https://www.shein.com/...';
}

export function isSheinProductUrl(url: string): boolean {
  return isSupplierProductUrl('shein', url);
}

export function isSupplierProductUrl(platform: SupplierPlatform, url: string): boolean {
  try {
    const host = new URL(url.trim()).hostname.toLowerCase();
    if (platform === 'shein') {
      return host === 'shein.com' || host.endsWith('.shein.com');
    }
    if (platform === 'alibaba') {
      return host.includes('alibaba.com');
    }
    if (platform === 'amazon') {
      return host.includes('amazon.') || host.endsWith('.amazon.com') || host === 'amzn.to';
    }
  } catch {
    return false;
  }
  return false;
}

export function buildSupplierFieldsFromUrl(platform: SupplierPlatform, url: string) {
  const trimmed = url.trim();
  if (!trimmed) {
    return {
      supplierPlatform: null,
      supplierProductUrl: null,
      supplierSyncEnabled: false,
    };
  }
  if (!isSupplierProductUrl(platform, trimmed)) {
    const label = DROPSHIP_SUPPLIER_OPTIONS.find((o) => o.value === platform)?.label || platform;
    throw new Error(`Link must be a ${label} product page URL`);
  }
  return {
    supplierPlatform: platform,
    supplierProductUrl: trimmed,
    supplierSyncEnabled: platform === 'shein',
  };
}

export async function syncDropshipProduct(
  storeId: string,
  productId: string,
): Promise<DropshipSyncResponse> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Please sign in to sync supplier stock');
  }

  const token = await user.getIdToken();
  const response = await fetch(`${getApiBaseUrl()}/dropship/sync-product`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ storeId, productId }),
  });

  const raw = await response.text();
  let payload: DropshipSyncResponse;
  try {
    payload = JSON.parse(raw) as DropshipSyncResponse;
  } catch {
    if (response.status === 404) {
      throw new Error(
        'Shein sync API is not deployed yet. Run: firebase deploy --only functions:api',
      );
    }
    throw new Error('Server returned an invalid response. Try again or contact support.');
  }

  if (!response.ok || !payload.success) {
    throw new Error(payload.error || 'Supplier sync failed');
  }
  return payload;
}

export function formatSupplierPlatformLabel(platform?: SupplierPlatform): string {
  return DROPSHIP_SUPPLIER_OPTIONS.find((o) => o.value === platform)?.label || 'Supplier';
}

export function formatSupplierSyncLabel(product: {
  supplierPlatform?: SupplierPlatform;
  supplierProductUrl?: string;
  supplierLastSyncAt?: string;
  supplierLastSyncStatus?: string;
  supplierLastSyncMessage?: string;
}): string {
  if (!product.supplierProductUrl) return '';
  const name = formatSupplierPlatformLabel(product.supplierPlatform);
  if (!product.supplierLastSyncAt) return `${name} · saved (sync N/A)`;
  const when = new Date(product.supplierLastSyncAt);
  const time = Number.isNaN(when.getTime())
    ? product.supplierLastSyncAt
    : when.toLocaleString();
  if (product.supplierLastSyncStatus === 'error') {
    return `${name} · sync failed (${time})`;
  }
  return `${name} · synced ${time}`;
}
