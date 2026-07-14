// ===================================
// DELIVERIES MANAGEMENT MODULE
// Handles stock receipts from suppliers with weighted average cost calculation
// ===================================

// Calculate weighted average cost for a product
// Formula: ((currentStock × currentCost) + (deliveryQty × deliveryCost)) / (currentStock + deliveryQty)
async function calculateWeightedAverageCost(productId, deliveryQuantity, deliveryCost) {
    try {
        const products = await loadProductsFromDB();
        const product = products.find(p => p.id === productId);
        
        if (!product) {
            throw new Error('Product not found');
        }
        
        const currentStock = product.stock || 0;
        const currentCost = product.cost || 0;
        
        // If stock is 0, new delivery cost becomes the product cost
        if (currentStock === 0) {
            return deliveryCost;
        }
        
        // Calculate weighted average
        const totalValue = (currentStock * currentCost) + (deliveryQuantity * deliveryCost);
        const totalQuantity = currentStock + deliveryQuantity;
        const weightedAvgCost = totalValue / totalQuantity;
        
        console.log(`📊 Weighted Average Cost Calculation:
            Current: ${currentStock} units @ $${currentCost.toFixed(2)} = $${(currentStock * currentCost).toFixed(2)}
            Delivery: ${deliveryQuantity} units @ $${deliveryCost.toFixed(2)} = $${(deliveryQuantity * deliveryCost).toFixed(2)}
            New Average: ${totalQuantity} units @ $${weightedAvgCost.toFixed(2)}`);
        
        return weightedAvgCost;
        
    } catch (error) {
        console.error('Error calculating weighted average cost:', error);
        throw error;
    }
}

// Create a new delivery with multiple items
async function createDelivery(deliveryData) {
    try {
        const { supplierId, deliveryRef, invoiceNumber, deliveryDate, items, notes, receivedBy } = deliveryData;
        
        if (!supplierId) {
            throw new Error('Supplier is required');
        }
        
        if (!items || items.length === 0) {
            throw new Error('At least one product is required');
        }
        
        // Validate all items have required fields
        for (const item of items) {
            if (!item.productId || !item.quantity || !item.unitCost) {
                throw new Error('Each item must have productId, quantity, and unitCost');
            }
            if (item.quantity <= 0) {
                throw new Error('Quantity must be greater than 0');
            }
            if (item.unitCost < 0) {
                throw new Error('Unit cost cannot be negative');
            }
        }
        
        // Calculate total amount
        let totalAmount = 0;
        for (const item of items) {
            totalAmount += item.quantity * item.unitCost;
        }
        
        const now = Date.now();
        const deliveryDateTimestamp = deliveryDate || now;
        
        // Start transaction for delivery + items
        beginTransaction();
        
        // Create delivery record and get ID
        const deliveryId = await runExec(
            `INSERT INTO deliveries (supplierId, deliveryRef, invoiceNumber, deliveryDate, totalAmount, notes, receivedBy, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                supplierId,
                deliveryRef || '',
                invoiceNumber || '',
                deliveryDateTimestamp,
                totalAmount,
                notes || '',
                receivedBy || '',
                now
            ]
        );
        
        console.log('Delivery ID:', deliveryId);
        
        if (!deliveryId || deliveryId === 0) {
            throw new Error(`Failed to get delivery ID after insertion. Got: ${deliveryId}`);
        }
        
        // Process each delivery item
        for (const item of items) {
            await addDeliveryItem(deliveryId, item);
        }
        
        // Update supplier balance (delivery increases debt - negative balance)
        await updateSupplierBalance(supplierId, -totalAmount, `Delivery #${deliveryId}`);
        
        // Commit transaction - single save for all operations
        await commit();
        
        // Log activity
        if (typeof logActivity === 'function') {
            const supplier = await getSupplierById(supplierId);
            const supplierName = supplier ? supplier.name : `ID ${supplierId}`;
            await logActivity('delivery_receive', 
                `Received delivery from ${supplierName}: ${items.length} products, Total: $${totalAmount.toFixed(2)}`);
        }
        
        console.log(`✅ Delivery created: ID ${deliveryId}, Total: $${totalAmount.toFixed(2)}`);
        return deliveryId;
        
    } catch (error) {
        rollback();
        console.error('Error creating delivery:', error);
        throw error;
    }
}

// Add a delivery item and update product stock/cost
async function addDeliveryItem(deliveryId, itemData) {
    try {
        const { productId, quantity, unitCost } = itemData;
        const lineTotal = quantity * unitCost;
        
        // Insert delivery item
        await runExec(
            `INSERT INTO delivery_items (deliveryId, productId, quantity, unitCost, lineTotal)
             VALUES (?, ?, ?, ?, ?)`,
            [deliveryId, productId, quantity, unitCost, lineTotal]
        );
        
        // Get current product data
        const products = await loadProductsFromDB();
        const product = products.find(p => p.id === productId);
        
        if (!product) {
            throw new Error(`Product ID ${productId} not found`);
        }
        
        // Calculate weighted average cost
        const newCost = await calculateWeightedAverageCost(productId, quantity, unitCost);
        
        // Update product cost
        await runExec(
            'UPDATE products SET cost = ?, updatedAt = ? WHERE id = ?',
            [newCost, Date.now(), productId]
        );
        
        // Update product stock using existing function
        const currentStock = product.stock || 0;
        const newStock = currentStock + quantity;
        
        await updateProductStock(
            productId, 
            newStock, 
            `Delivery: +${quantity} units @ $${unitCost.toFixed(2)} (Delivery #${deliveryId})`
        );
        
        console.log(`✅ Delivery item added: ${product.name} +${quantity} @ $${unitCost.toFixed(2)}, New cost: $${newCost.toFixed(2)}`);
        
    } catch (error) {
        console.error('Error adding delivery item:', error);
        throw error;
    }
}

// Get delivery history with optional filters
async function getDeliveryHistory(filters = {}) {
    try {
        let query = `
            SELECT d.*, s.name as supplierName 
            FROM deliveries d
            LEFT JOIN suppliers s ON d.supplierId = s.id
        `;
        const params = [];
        const conditions = [];
        
        // Filter by supplier
        if (filters.supplierId) {
            conditions.push('d.supplierId = ?');
            params.push(filters.supplierId);
        }
        
        // Filter by date range
        if (filters.startDate) {
            conditions.push('d.deliveryDate >= ?');
            params.push(filters.startDate);
        }
        if (filters.endDate) {
            conditions.push('d.deliveryDate <= ?');
            params.push(filters.endDate);
        }
        
        // Add WHERE clause if there are conditions
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += ' ORDER BY d.deliveryDate DESC, d.createdAt DESC';
        
        const results = await runQuery(query, params);
        return results || [];
        
    } catch (error) {
        console.error('Error getting delivery history:', error);
        return [];
    }
}

// Get delivery by ID with all items
async function getDeliveryById(deliveryId) {
    try {
        const deliveries = await runQuery(
            `SELECT d.*, s.name as supplierName, s.phone as supplierPhone
             FROM deliveries d
             LEFT JOIN suppliers s ON d.supplierId = s.id
             WHERE d.id = ?`,
            [deliveryId]
        );
        
        if (!deliveries || deliveries.length === 0) {
            return null;
        }
        
        const delivery = deliveries[0];
        
        // Get delivery items
        const items = await runQuery(
            `SELECT di.*, p.name as productName, p.icon as productIcon
             FROM delivery_items di
             LEFT JOIN products p ON di.productId = p.id
             WHERE di.deliveryId = ?`,
            [deliveryId]
        );
        
        delivery.items = items || [];
        
        return delivery;
        
    } catch (error) {
        console.error('Error getting delivery by ID:', error);
        return null;
    }
}

// Get deliveries by supplier
async function getDeliveriesBySupplier(supplierId) {
    try {
        return await getDeliveryHistory({ supplierId });
    } catch (error) {
        console.error('Error getting deliveries by supplier:', error);
        return [];
    }
}

// Get total delivery value for a date range
async function getDeliveryTotals(startDate, endDate) {
    try {
        let query = 'SELECT SUM(totalAmount) as total, COUNT(*) as count FROM deliveries';
        const params = [];
        const conditions = [];
        
        if (startDate) {
            conditions.push('deliveryDate >= ?');
            params.push(startDate);
        }
        if (endDate) {
            conditions.push('deliveryDate <= ?');
            params.push(endDate);
        }
        
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        const results = await runQuery(query, params);
        return {
            total: results && results[0].total ? results[0].total : 0,
            count: results && results[0].count ? results[0].count : 0
        };
        
    } catch (error) {
        console.error('Error getting delivery totals:', error);
        return { total: 0, count: 0 };
    }
}

console.log('✅ Deliveries module loaded');
