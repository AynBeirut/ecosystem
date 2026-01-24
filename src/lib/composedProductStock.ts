import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { ComposedProduct, RawMaterial } from '@/types/product';

export interface StockStatus {
  available: number;
  status: 'in-stock' | 'low-stock' | 'out-of-stock';
  canMake: number;
}

/**
 * Calculate how many units of a composed product can be made with current raw material stock
 */
export async function calculateAvailableStock(
  product: ComposedProduct,
  storeId: string
): Promise<number> {
  if (!product.materials || product.materials.length === 0) {
    return 0;
  }

  const db = getFirestore();
  const materialsQuery = query(
    collection(db, 'rawMaterials'),
    where('storeId', '==', storeId)
  );

  const snapshot = await getDocs(materialsQuery);
  const rawMaterials = new Map<string, RawMaterial>();
  
  snapshot.forEach(doc => {
    const material = doc.data() as RawMaterial;
    rawMaterials.set(doc.id, material);
  });

  // Calculate minimum units that can be made based on each material
  let minUnits = Infinity;

  for (const material of product.materials) {
    const rawMaterial = rawMaterials.get(material.materialId);
    
    if (!rawMaterial) {
      return 0; // Material not found
    }

    const availableStock = rawMaterial.currentStock || 0;
    const requiredPerUnit = material.quantityNeeded || 0;

    if (requiredPerUnit === 0) {
      continue;
    }

    const unitsFromThisMaterial = Math.floor(availableStock / requiredPerUnit);
    minUnits = Math.min(minUnits, unitsFromThisMaterial);
  }

  return minUnits === Infinity ? 0 : minUnits;
}

/**
 * Get stock status for a composed product
 */
export async function getComposedStockStatus(
  product: ComposedProduct,
  storeId: string
): Promise<StockStatus> {
  const canMake = await calculateAvailableStock(product, storeId);

  let status: 'in-stock' | 'low-stock' | 'out-of-stock';
  if (canMake === 0) {
    status = 'out-of-stock';
  } else if (canMake < 10) {
    status = 'low-stock';
  } else {
    status = 'in-stock';
  }

  return {
    available: canMake,
    status,
    canMake
  };
}
