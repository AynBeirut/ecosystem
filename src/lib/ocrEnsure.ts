import { addDoc, collection, getFirestore } from 'firebase/firestore';
import { generateBarcode, generateSKU } from '@/lib/skuGenerator';
import type { OcrCatalogMaterial, OcrCatalogSupplier } from '@/features/ocr/OcrReceiptFlow';
import { fuzzyMatchSupplier } from '@/features/ocr/OcrReceiptFlow';

function fold(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function fuzzyMatchMaterial(
  name: string,
  materials: Array<{ id: string; name: string; sku?: string; unit?: string }>,
): OcrCatalogMaterial | undefined {
  const n = fold(name);
  if (!n || n.length < 2) return undefined;

  const exact = materials.find((m) => fold(m.name) === n);
  if (exact) return exact as OcrCatalogMaterial;

  return materials.find((m) => {
    const mn = fold(m.name);
    return mn.includes(n) || n.includes(mn);
  }) as OcrCatalogMaterial | undefined;
}

export async function ensureOcrSupplier(opts: {
  storeId: string;
  name: string;
  existing: OcrCatalogSupplier[];
  source?: string;
}): Promise<OcrCatalogSupplier> {
  const name = opts.name.trim();
  if (!name) throw new Error('Supplier name required');
  const matched = fuzzyMatchSupplier(name, opts.existing);
  if (matched) return matched;

  const db = getFirestore();
  const now = new Date().toISOString();
  const data = {
    storeId: opts.storeId,
    name,
    supplierCode: `SUP-${Date.now().toString(36).toUpperCase()}`,
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    status: 'active' as const,
    createdAt: now,
    updatedAt: now,
    source: opts.source || 'ocr',
  };
  const ref = await addDoc(collection(db, 'suppliers'), data);
  return { id: ref.id, name };
}

export async function ensureOcrMaterial(opts: {
  storeId: string;
  name: string;
  unitCost?: number;
  existing?: Array<{ id: string; name: string; sku?: string; unit?: string }>;
  existingCount?: number;
  source?: string;
}): Promise<OcrCatalogMaterial> {
  const name = opts.name.trim();
  if (!name) throw new Error('Material name required');

  if (opts.existing?.length) {
    const matched = fuzzyMatchMaterial(name, opts.existing);
    if (matched) return matched;
  }

  const db = getFirestore();
  const storePrefix = opts.storeId.substring(0, 5).toUpperCase();
  const sku = generateSKU(storePrefix, 'MAT', (opts.existingCount ?? opts.existing?.length ?? 0) + 1);
  const cost = Number(opts.unitCost) || 0;
  const now = new Date().toISOString();
  const data = {
    storeId: opts.storeId,
    name,
    sku,
    barcode: generateBarcode(),
    unit: 'piece' as const,
    costPerUnit: cost,
    currentStock: 0,
    minimumThreshold: 10,
    reorderPoint: 20,
    preferredSupplierId: '',
    storageLocation: '',
    expiryTracking: false,
    expiryDate: '',
    expiryAlertDays: 30,
    warrantyPeriod: 0,
    warrantyStartDate: now,
    createdAt: now,
    updatedAt: now,
    source: opts.source || 'ocr',
    catalogDataStatus: 'quick-entry',
  };
  const ref = await addDoc(collection(db, 'rawMaterials'), data);
  return { id: ref.id, name, sku, unit: 'piece' };
}
