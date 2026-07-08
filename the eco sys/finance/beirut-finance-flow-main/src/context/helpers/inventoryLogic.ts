// Composed product cost + inventory movement logic
// Org-scoped helpers used by AppContext

import { dbInsert, dbUpdate } from "./dbOps";
import type { Product } from "../AppContext";

const LOG = "Context][Inventory";

/**
 * Sum of (component.quantity * component.unitCost) * orderedQty + serviceCost * orderedQty.
 * Falls back to product.rawPrice * quantity for non-composed products.
 */
export const calculateComposedProductCost = (
  product: Product | undefined,
  quantity: number = 1,
): number => {
  if (!product) return 0;
  if (product.type !== "composed" || !product.components?.length) {
    return (product.rawPrice || 0) * quantity;
  }
  const componentsCost = product.components.reduce(
    (sum, c) => sum + c.quantity * c.unitCost,
    0,
  );
  const overhead = product.serviceCost || 0;
  return (componentsCost + overhead) * quantity;
};

/**
 * Insert one inventory movement row.
 */
export const insertInventoryMovement = async (params: {
  orgId: string;
  productId: string;
  type: "sale" | "purchase" | "manufacturing" | "adjustment";
  quantity: number; // signed: negative = out, positive = in
  referenceId: string;
  referenceType?: string;
  notes?: string;
}) => {
  const { orgId, productId, type, quantity, referenceId, referenceType, notes } = params;
  return dbInsert(
    "inventory_movements",
    {
      organization_id: orgId,
      product_id: productId,
      movement_type: type,
      quantity,
      reference_id: referenceId,
      reference_type: referenceType || type,
      notes: notes || null,
    },
    LOG,
  );
};

/**
 * Update stock for a composed product.
 *  - operation = "deduct": consumed (sale of composed product). Decrement composed stock,
 *    no component stock change (components were already deducted at manufacture time).
 *  - operation = "restore": invoice/PO deletion. Increment composed stock back.
 *  - operation = "manufacture": produce N units. Deduct each component by (component.qty * N),
 *    increment composed stock by N. Each component change logs an inventory movement.
 */
export const updateInventoryForComposedProduct = async (params: {
  orgId: string;
  product: Product;
  quantity: number;
  operation: "deduct" | "restore" | "manufacture";
  referenceId: string;
  referenceType: string;
  allProducts: Product[];
  applyLocalUpdate: (productId: string, delta: number) => void;
}): Promise<{ success: boolean; error?: string }> => {
  const {
    orgId, product, quantity, operation,
    referenceId, referenceType, allProducts, applyLocalUpdate,
  } = params;

  if (product.type !== "composed") {
    return { success: false, error: "Product is not a composed product" };
  }

  try {
    if (operation === "manufacture") {
      if (!product.components?.length) {
        return { success: false, error: "No components defined" };
      }
      // Stock check on components
      for (const comp of product.components) {
        const raw = allProducts.find((p) => p.id === comp.productId);
        const need = comp.quantity * quantity;
        if (!raw || raw.stockQuantity === undefined || raw.stockQuantity < need) {
          return {
            success: false,
            error: `Insufficient stock for "${comp.productName}". Need ${need}, have ${raw?.stockQuantity ?? 0}`,
          };
        }
      }
      // Deduct each component + log movement
      for (const comp of product.components) {
        const raw = allProducts.find((p) => p.id === comp.productId);
        if (!raw || raw.stockQuantity === undefined) continue;
        const consumed = comp.quantity * quantity;
        const newQty = raw.stockQuantity - consumed;
        applyLocalUpdate(raw.id, -consumed);
        await dbUpdate("products", raw.id, { stock_quantity: newQty }, `${LOG}][manufacture][component`);
        await insertInventoryMovement({
          orgId, productId: raw.id, type: "manufacturing",
          quantity: -consumed, referenceId, referenceType,
        });
      }
      // Increment composed product stock
      const composedQty = (product.stockQuantity ?? 0) + quantity;
      applyLocalUpdate(product.id, quantity);
      await dbUpdate("products", product.id, { stock_quantity: composedQty }, `${LOG}][manufacture][composed`);
      await insertInventoryMovement({
        orgId, productId: product.id, type: "manufacturing",
        quantity, referenceId, referenceType,
      });
      return { success: true };
    }

    if (operation === "deduct") {
      if (product.stockQuantity === undefined) return { success: true };
      const newQty = product.stockQuantity - quantity;
      applyLocalUpdate(product.id, -quantity);
      await dbUpdate("products", product.id, { stock_quantity: newQty }, `${LOG}][deduct`);
      await insertInventoryMovement({
        orgId, productId: product.id, type: "sale",
        quantity: -quantity, referenceId, referenceType,
      });
      return { success: true };
    }

    if (operation === "restore") {
      if (product.stockQuantity === undefined) return { success: true };
      const newQty = product.stockQuantity + quantity;
      applyLocalUpdate(product.id, quantity);
      await dbUpdate("products", product.id, { stock_quantity: newQty }, `${LOG}][restore`);
      await insertInventoryMovement({
        orgId, productId: product.id, type: "adjustment",
        quantity, referenceId, referenceType,
      });
      return { success: true };
    }

    return { success: false, error: "Unknown operation" };
  } catch (e) {
    console.error(`[${LOG}][updateInventoryForComposedProduct]`, e);
    return { success: false, error: String(e) };
  }
};

/**
 * Generic stock movement helper for any product type (product OR composed),
 * skips services. Used by invoice/PO create+delete paths.
 */
export const recordStockMovement = async (params: {
  orgId: string;
  product: Product;
  delta: number; // signed
  type: "sale" | "purchase" | "adjustment";
  referenceId: string;
  referenceType: string;
}) => {
  const { orgId, product, delta, type, referenceId, referenceType } = params;
  if (product.type === "service") return;
  if (product.stockQuantity === undefined) return;
  const newQty = product.stockQuantity + delta;
  await dbUpdate("products", product.id, { stock_quantity: newQty }, `${LOG}][stock`);
  await insertInventoryMovement({
    orgId, productId: product.id, type,
    quantity: delta, referenceId, referenceType,
  });
};
