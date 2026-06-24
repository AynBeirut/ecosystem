"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPublicProductStock = getPublicProductStock;
const publicProductStock_1 = require("../services/publicProductStock");
/**
 * POST /public/product-stock
 * Body: { storeId: string, productIds: string[] }
 * Response: { success: true, items: [{ productId, availableStock, inStock }] }
 */
async function getPublicProductStock(req, res) {
    const { storeId, productIds } = req.body;
    if (!storeId || typeof storeId !== 'string') {
        res.status(400).json({ success: false, error: 'Missing storeId' });
        return;
    }
    if (!Array.isArray(productIds)) {
        res.status(400).json({ success: false, error: 'productIds must be an array' });
        return;
    }
    try {
        const items = await (0, publicProductStock_1.computePublicProductStock)(storeId, productIds);
        res.json({ success: true, items });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to compute stock';
        const status = message === 'Store not found' ? 404 : message.startsWith('Too many') ? 400 : 500;
        res.status(status).json({ success: false, error: message });
    }
}
