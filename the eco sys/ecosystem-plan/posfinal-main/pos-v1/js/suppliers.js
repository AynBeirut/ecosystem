// ===================================
// SUPPLIERS MANAGEMENT MODULE
// Handles supplier CRUD operations and balance tracking
// ===================================

// Initialize suppliers module - create tables if they don't exist
async function initSuppliersModule() {
    try {
        console.log('📦 Initializing Suppliers Module...');
        
        // Check if database is available
        if (!db || typeof runExec !== 'function') {
            console.warn('⚠️ Database not ready, skipping suppliers initialization');
            return;
        }
        
        // Create suppliers table if it doesn't exist
        await runExec(`
            CREATE TABLE IF NOT EXISTS suppliers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                contactPerson TEXT,
                phone TEXT,
                email TEXT,
                address TEXT,
                paymentTerms TEXT,
                balance REAL DEFAULT 0,
                notes TEXT,
                createdAt INTEGER NOT NULL,
                updatedAt INTEGER NOT NULL,
                synced INTEGER DEFAULT 0,
                synced_at INTEGER
            )
        `);
        
        await runExec(`CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name)`);
        
        // Create deliveries table if it doesn't exist
        await runExec(`
            CREATE TABLE IF NOT EXISTS deliveries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                supplierId INTEGER NOT NULL,
                deliveryRef TEXT,
                invoiceNumber TEXT,
                deliveryDate INTEGER NOT NULL,
                totalAmount REAL DEFAULT 0,
                notes TEXT,
                receivedBy TEXT,
                createdAt INTEGER NOT NULL,
                synced INTEGER DEFAULT 0,
                synced_at INTEGER,
                FOREIGN KEY (supplierId) REFERENCES suppliers(id)
            )
        `);
        
        await runExec(`CREATE INDEX IF NOT EXISTS idx_deliveries_supplierId ON deliveries(supplierId)`);
        await runExec(`CREATE INDEX IF NOT EXISTS idx_deliveries_deliveryDate ON deliveries(deliveryDate)`);
        
        // Create delivery_items table if it doesn't exist
        await runExec(`
            CREATE TABLE IF NOT EXISTS delivery_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                deliveryId INTEGER NOT NULL,
                productId INTEGER NOT NULL,
                quantity INTEGER NOT NULL,
                unitCost REAL NOT NULL,
                lineTotal REAL NOT NULL,
                FOREIGN KEY (deliveryId) REFERENCES deliveries(id),
                FOREIGN KEY (productId) REFERENCES products(id)
            )
        `);
        
        await runExec(`CREATE INDEX IF NOT EXISTS idx_delivery_items_deliveryId ON delivery_items(deliveryId)`);
        await runExec(`CREATE INDEX IF NOT EXISTS idx_delivery_items_productId ON delivery_items(productId)`);
        
        // Create supplier_payments table if it doesn't exist
        await runExec(`
            CREATE TABLE IF NOT EXISTS supplier_payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                supplierId INTEGER NOT NULL,
                amount REAL NOT NULL,
                paymentMethod TEXT,
                reference TEXT,
                notes TEXT,
                paidBy TEXT,
                paidAt INTEGER NOT NULL,
                createdAt INTEGER NOT NULL,
                synced INTEGER DEFAULT 0,
                synced_at INTEGER,
                FOREIGN KEY (supplierId) REFERENCES suppliers(id)
            )
        `);
        
        await runExec(`CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplierId ON supplier_payments(supplierId)`);
        await runExec(`CREATE INDEX IF NOT EXISTS idx_supplier_payments_paidAt ON supplier_payments(paidAt)`);
        
        // Create purchase_returns table if it doesn't exist
        await runExec(`
            CREATE TABLE IF NOT EXISTS purchase_returns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                deliveryId INTEGER NOT NULL,
                originalDeliveryDate INTEGER,
                returnAmount REAL NOT NULL,
                returnType TEXT DEFAULT 'full' CHECK(returnType IN ('full', 'partial')),
                returnItems TEXT NOT NULL,
                reason TEXT NOT NULL,
                approvedBy TEXT NOT NULL,
                approverUsername TEXT NOT NULL,
                approverRole TEXT NOT NULL,
                processedBy TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                returnReference TEXT,
                supplierNotified INTEGER DEFAULT 0,
                creditNote TEXT,
                notes TEXT,
                synced INTEGER DEFAULT 0,
                synced_at INTEGER,
                FOREIGN KEY (deliveryId) REFERENCES deliveries(id)
            )
        `);
        
        await runExec(`CREATE INDEX IF NOT EXISTS idx_purchase_returns_deliveryId ON purchase_returns(deliveryId)`);
        await runExec(`CREATE INDEX IF NOT EXISTS idx_purchase_returns_timestamp ON purchase_returns(timestamp)`);
        await runExec(`CREATE INDEX IF NOT EXISTS idx_purchase_returns_reason ON purchase_returns(reason)`);
        
        // Add return tracking columns to deliveries table if they don't exist
        // Check if columns exist first to avoid error logs
        const deliveriesInfo = db.exec(`PRAGMA table_info(deliveries)`);
        const existingColumns = deliveriesInfo.length > 0 ? deliveriesInfo[0].values.map(col => col[1]) : [];
        
        if (!existingColumns.includes('returnId')) {
            await runExec(`ALTER TABLE deliveries ADD COLUMN returnId INTEGER`);
        }
        if (!existingColumns.includes('returnedAt')) {
            await runExec(`ALTER TABLE deliveries ADD COLUMN returnedAt INTEGER`);
        }
        if (!existingColumns.includes('returnStatus')) {
            await runExec(`ALTER TABLE deliveries ADD COLUMN returnStatus TEXT DEFAULT 'none'`);
        }
        
        console.log('✅ Suppliers module tables initialized');
        
    } catch (error) {
        console.error('❌ Error initializing suppliers module:', error);
        // Don't throw - allow app to continue even if tables can't be created
    }
}

// Load all suppliers from database
async function loadSuppliers() {
    try {
        const results = await runQuery('SELECT * FROM suppliers ORDER BY name');
        return results || [];
    } catch (error) {
        console.error('Error loading suppliers:', error);
        return [];
    }
}

// Get supplier by ID
async function getSupplierById(supplierId) {
    try {
        const results = await runQuery('SELECT * FROM suppliers WHERE id = ?', [supplierId]);
        return results && results.length > 0 ? results[0] : null;
    } catch (error) {
        console.error('Error getting supplier:', error);
        return null;
    }
}

// Add new supplier
async function addSupplier(supplierData) {
    try {
        const { name, contactPerson, phone, email, address, paymentTerms, notes } = supplierData;
        
        if (!name || name.trim() === '') {
            throw new Error('Supplier name is required');
        }
        
        const now = Date.now();
        
        // Check which columns exist in the suppliers table (backward compatibility)
        const tableInfo = await runQuery(`PRAGMA table_info(suppliers)`);
        const columns = tableInfo.map(row => row.name);
        const hasPaymentTerms = columns.includes('paymentTerms');
        const hasCreatedAt = columns.includes('createdAt');
        const hasUpdatedAt = columns.includes('updatedAt');
        
        // Build INSERT query dynamically based on available columns
        let insertQuery = `INSERT INTO suppliers (name, contactPerson, phone, email, address`;
        let insertValues = [
            name.trim(),
            contactPerson || '',
            phone || '',
            email || '',
            address || ''
        ];
        
        if (hasPaymentTerms) {
            insertQuery += `, paymentTerms`;
            insertValues.push(paymentTerms || '');
        }
        
        insertQuery += `, balance, notes`;
        insertValues.push(0, notes || '');
        
        if (hasCreatedAt && hasUpdatedAt) {
            insertQuery += `, createdAt, updatedAt`;
            insertValues.push(now, now);
        }
        
        insertQuery += `) VALUES (${insertValues.map(() => '?').join(', ')})`;
        
        // Insert supplier and get ID from runExec return value
        const supplierId = await runExec(insertQuery, insertValues);
        
        console.log('Supplier ID:', supplierId);
        
        if (!supplierId || supplierId === 0) {
            throw new Error(`Failed to get supplier ID after insertion. Got: ${supplierId}`);
        }
        
        // Log activity
        if (typeof logActivity === 'function') {
            await logActivity('supplier_add', `Added supplier: ${name}`);
        }
        
        console.log(`✅ Supplier added: ${name} (ID: ${supplierId})`);
        return supplierId;
        
    } catch (error) {
        console.error('Error adding supplier:', error);
        throw error;
    }
}

// Update existing supplier
async function updateSupplier(supplierId, supplierData) {
    try {
        const { name, contactPerson, phone, email, address, paymentTerms, notes } = supplierData;
        
        if (!name || name.trim() === '') {
            throw new Error('Supplier name is required');
        }
        
        const now = Date.now();
        
        // Check which columns exist in the suppliers table (backward compatibility)
        const tableInfo = await runQuery(`PRAGMA table_info(suppliers)`);
        const columns = tableInfo.map(row => row.name);
        const hasPaymentTerms = columns.includes('paymentTerms');
        const hasUpdatedAt = columns.includes('updatedAt');
        
        // Build UPDATE query dynamically based on available columns
        let updateQuery = `UPDATE suppliers 
             SET name = ?, contactPerson = ?, phone = ?, email = ?, address = ?`;
        let updateValues = [
            name.trim(),
            contactPerson || '',
            phone || '',
            email || '',
            address || ''
        ];
        
        if (hasPaymentTerms) {
            updateQuery += `, paymentTerms = ?`;
            updateValues.push(paymentTerms || '');
        }
        
        updateQuery += `, notes = ?`;
        updateValues.push(notes || '');
        
        if (hasUpdatedAt) {
            updateQuery += `, updatedAt = ?`;
            updateValues.push(now);
        }
        
        updateQuery += ` WHERE id = ?`;
        updateValues.push(supplierId);
        
        await runExec(updateQuery, updateValues);
        
        // Log activity
        if (typeof logActivity === 'function') {
            await logActivity('supplier_edit', `Updated supplier: ${name} (ID: ${supplierId})`);
        }
        
        console.log(`✅ Supplier updated: ${name}`);
        return true;
        
    } catch (error) {
        console.error('Error updating supplier:', error);
        throw error;
    }
}

// Delete supplier
async function deleteSupplier(supplierId) {
    try {
        // Check if supplier has any deliveries
        const deliveries = await runQuery('SELECT COUNT(*) as count FROM deliveries WHERE supplierId = ?', [supplierId]);
        
        if (deliveries && deliveries[0].count > 0) {
            throw new Error('Cannot delete supplier with existing deliveries. Please delete or reassign deliveries first.');
        }
        
        // Get supplier name for logging
        const supplier = await getSupplierById(supplierId);
        const supplierName = supplier ? supplier.name : `ID ${supplierId}`;
        
        await runExec('DELETE FROM suppliers WHERE id = ?', [supplierId]);
        
        // Log activity
        if (typeof logActivity === 'function') {
            await logActivity('supplier_delete', `Deleted supplier: ${supplierName}`);
        }
        
        console.log(`✅ Supplier deleted: ${supplierName}`);
        return true;
        
    } catch (error) {
        console.error('Error deleting supplier:', error);
        throw error;
    }
}

// Get supplier balance (negative = we owe them, positive = they owe us)
async function getSupplierBalance(supplierId) {
    try {
        const results = await runQuery('SELECT balance FROM suppliers WHERE id = ?', [supplierId]);
        return results && results.length > 0 ? (results[0].balance || 0) : 0;
    } catch (error) {
        console.error('Error getting supplier balance:', error);
        return 0;
    }
}

// Update supplier balance
async function updateSupplierBalance(supplierId, amount, reason = '') {
    try {
        const currentBalance = await getSupplierBalance(supplierId);
        const numAmount = parseFloat(amount) || 0;
        const newBalance = (parseFloat(currentBalance) || 0) + numAmount;
        
        // Validate numbers before updating
        if (isNaN(newBalance)) {
            console.error('❌ Invalid balance calculation:', { currentBalance, amount, newBalance });
            throw new Error('Invalid balance calculation - result is NaN');
        }
        
        await runExec(
            'UPDATE suppliers SET balance = ?, updatedAt = ? WHERE id = ?',
            [newBalance, Date.now(), supplierId]
        );
        
        console.log(`✅ Supplier balance updated: ${currentBalance.toFixed(2)} → ${newBalance.toFixed(2)} (${reason})`);
        return newBalance;
        
    } catch (error) {
        console.error('Error updating supplier balance:', error);
        throw error;
    }
}

// Get suppliers with outstanding balances (we owe them money)
async function getSuppliersWithDebt() {
    try {
        const results = await runQuery(
            'SELECT * FROM suppliers WHERE balance < 0 ORDER BY balance ASC'
        );
        return results || [];
    } catch (error) {
        console.error('Error getting suppliers with debt:', error);
        return [];
    }
}

// Get total amount owed to all suppliers
async function getTotalSupplierDebt() {
    try {
        const results = await runQuery(
            'SELECT SUM(balance) as totalDebt FROM suppliers WHERE balance < 0'
        );
        return results && results[0].totalDebt ? Math.abs(results[0].totalDebt) : 0;
    } catch (error) {
        console.error('Error calculating total supplier debt:', error);
        return 0;
    }
}

// Get payment history (all or filtered by supplier)
async function getPaymentHistory(filters = {}) {
    try {
        let query = `
            SELECT sp.*, s.name as supplierName
            FROM supplier_payments sp
            LEFT JOIN suppliers s ON sp.supplierId = s.id
        `;
        const params = [];
        const conditions = [];
        
        // Filter by supplier
        if (filters.supplierId) {
            conditions.push('sp.supplierId = ?');
            params.push(filters.supplierId);
        }
        
        // Filter by date range
        if (filters.startDate) {
            conditions.push('sp.paidAt >= ?');
            params.push(filters.startDate);
        }
        if (filters.endDate) {
            conditions.push('sp.paidAt <= ?');
            params.push(filters.endDate);
        }
        
        // Add WHERE clause if there are conditions
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += ' ORDER BY sp.paidAt DESC';
        
        const results = await runQuery(query, params);
        return results || [];
        
    } catch (error) {
        console.error('Error getting payment history:', error);
        return [];
    }
}

// Load purchase returns (all or filtered)
async function loadPurchaseReturns(filters = {}) {
    try {
        let query = `
            SELECT pr.*, s.name as supplierName, d.deliveryRef
            FROM purchase_returns pr
            LEFT JOIN deliveries d ON pr.deliveryId = d.id
            LEFT JOIN suppliers s ON d.supplierId = s.id
        `;
        const params = [];
        const conditions = [];
        
        // Filter by supplier
        if (filters.supplierId) {
            conditions.push('s.id = ?');
            params.push(filters.supplierId);
        }
        
        // Filter by reason
        if (filters.reason) {
            conditions.push('pr.reason = ?');
            params.push(filters.reason);
        }
        
        // Filter by date range
        if (filters.startDate) {
            conditions.push('pr.timestamp >= ?');
            params.push(filters.startDate);
        }
        if (filters.endDate) {
            conditions.push('pr.timestamp <= ?');
            params.push(filters.endDate);
        }
        
        // Add WHERE clause if there are conditions
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += ' ORDER BY pr.timestamp DESC';
        
        const results = await runQuery(query, params);
        return results || [];
        
    } catch (error) {
        console.error('Error loading purchase returns:', error);
        return [];
    }
}

// Load supplier statement (all deliveries and payments)
async function loadSupplierStatement(supplierId, startDate = null, endDate = null) {
    try {
        if (!supplierId) {
            throw new Error('Supplier ID is required');
        }
        
        // Get supplier info
        const suppliers = await runQuery(
            'SELECT * FROM suppliers WHERE id = ?',
            [supplierId]
        );
        
        if (!suppliers || suppliers.length === 0) {
            throw new Error('Supplier not found');
        }
        
        const supplier = suppliers[0];
        
        // Build delivery query with optional date filter
        let deliveryQuery = `SELECT id, deliveryDate as date, deliveryRef as reference, 
                    totalAmount as amount, 'delivery' as type, notes
             FROM deliveries 
             WHERE supplierId = ?`;
        const deliveryParams = [supplierId];
        
        if (startDate) {
            deliveryQuery += ` AND deliveryDate >= ?`;
            deliveryParams.push(new Date(startDate).getTime());
        }
        if (endDate) {
            const endDateTime = new Date(endDate);
            endDateTime.setHours(23, 59, 59, 999);
            deliveryQuery += ` AND deliveryDate <= ?`;
            deliveryParams.push(endDateTime.getTime());
        }
        
        deliveryQuery += ` ORDER BY deliveryDate DESC`;
        
        // Get all deliveries
        const deliveries = await runQuery(deliveryQuery, deliveryParams);
        
        // Build payment query with optional date filter
        let paymentQuery = `SELECT id, paidAt as date, reference, 
                    amount, 'payment' as type, notes, paymentMethod
             FROM supplier_payments 
             WHERE supplierId = ?`;
        const paymentParams = [supplierId];
        
        if (startDate) {
            paymentQuery += ` AND paidAt >= ?`;
            paymentParams.push(new Date(startDate).getTime());
        }
        if (endDate) {
            const endDateTime = new Date(endDate);
            endDateTime.setHours(23, 59, 59, 999);
            paymentQuery += ` AND paidAt <= ?`;
            paymentParams.push(endDateTime.getTime());
        }
        
        paymentQuery += ` ORDER BY paidAt DESC`;
        
        // Get all payments
        const payments = await runQuery(paymentQuery, paymentParams);
        
        // Combine and sort by date
        const transactions = [
            ...(deliveries || []),
            ...(payments || [])
        ].sort((a, b) => b.date - a.date);
        
        // Calculate returns for this supplier (handle missing table)
        let totalReturns = 0;
        try {
            const returns = runQuery(`
                SELECT COALESCE(SUM(returnAmount), 0) as total
                FROM purchase_returns pr
                WHERE pr.deliveryId IN (SELECT id FROM deliveries WHERE supplierId = ?)
            `, [supplierId]);
            totalReturns = returns[0]?.total || 0;
        } catch (error) {
            // Purchase returns table doesn't exist yet - feature not implemented
            if (!error.message || !error.message.includes('no such table')) {
                console.error('Error loading purchase returns:', error);
            }
            totalReturns = 0;
        }
        
        // Calculate balance from transactions: Deliveries - Payments - Returns
        const totalDeliveries = (deliveries || []).reduce((sum, d) => sum + (d.amount || 0), 0);
        const totalPayments = (payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
        const currentBalance = totalDeliveries - totalPayments - totalReturns;
        
        return {
            supplier,
            transactions,
            currentBalance
        };
        
    } catch (error) {
        console.error('Error loading supplier statement:', error);
        throw error;
    }
}

// Initialize tables on module load - but ONLY if database is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Don't initialize here - wait for database
    });
} else {
    // Don't auto-initialize - app.js will call initSuppliersModule() after DB is ready
}

console.log('✅ Suppliers module loaded');
