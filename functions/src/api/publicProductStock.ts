import { Request, Response } from 'express';
import { computePublicProductStock } from '../services/publicProductStock';

/**
 * POST /public/product-stock
 * Body: { storeId: string, productIds: string[] }
 * Response: { success: true, items: [{ productId, availableStock, inStock }] }
 */
export async function getPublicProductStock(req: Request, res: Response): Promise<void> {
  const { storeId, productIds } = req.body as {
    storeId?: string;
    productIds?: unknown;
  };

  if (!storeId || typeof storeId !== 'string') {
    res.status(400).json({ success: false, error: 'Missing storeId' });
    return;
  }

  if (!Array.isArray(productIds)) {
    res.status(400).json({ success: false, error: 'productIds must be an array' });
    return;
  }

  try {
    const items = await computePublicProductStock(storeId, productIds as string[]);
    res.json({ success: true, items });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to compute stock';
    const status = message === 'Store not found' ? 404 : message.startsWith('Too many') ? 400 : 500;
    res.status(status).json({ success: false, error: message });
  }
}
