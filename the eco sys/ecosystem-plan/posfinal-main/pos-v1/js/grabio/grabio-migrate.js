// ===================================
// GRABIO POS - FULL DATA MIGRATION
// Syncs ALL data: Products, Customers, Suppliers, Purchases, Expenses,
// Staff, Salaries, Raw Materials, Recipes, Refunds, Orders
// ===================================

const GRABIO_MIGRATE_DELAY_MS = 150;
const GRABIO_MIGRATE_BATCH_SIZE = 50;
const _migrateErrors = [];

function getMigrationCounts() {
    if (typeof runQuery !== 'function') return {};
    const counts = {};
    try { counts.products = (runQuery('SELECT COUNT(*) as c FROM products') || [{}])[0].c || 0; } catch { counts.products = 0; }
    try { counts.customers = (runQuery('SELECT COUNT(*) as c FROM customers') || [{}])[0].c || 0; } catch {
        try { counts.customers = (runQuery('SELECT COUNT(*) as c FROM phonebook') || [{}])[0].c || 0; } catch { counts.customers = 0; }
    }
    try { counts.suppliers = (runQuery('SELECT COUNT(*) as c FROM suppliers') || [{}])[0].c || 0; } catch { counts.suppliers = 0; }
    try { counts.purchases = (runQuery('SELECT COUNT(*) as c FROM deliveries') || [{}])[0].c || 0; } catch { counts.purchases = 0; }
    try {
        const expCount = (runQuery('SELECT COUNT(*) as c FROM expenses') || [{}])[0].c || 0;
        const billCount = (runQuery('SELECT COUNT(*) as c FROM bill_payments') || [{}])[0].c || 0;
        counts.expenses = expCount + billCount;
    } catch { counts.expenses = 0; }
    try { counts.staff = (runQuery('SELECT COUNT(*) as c FROM staff') || [{}])[0].c || 0; } catch { counts.staff = 0; }
    try { counts.salaries = (runQuery('SELECT COUNT(*) as c FROM staff_payments') || [{}])[0].c || 0; } catch { counts.salaries = 0; }
    try { counts.rawMaterials = (runQuery('SELECT COUNT(*) as c FROM raw_materials') || [{}])[0].c || 0; } catch { counts.rawMaterials = 0; }
    try { counts.recipes = (runQuery('SELECT COUNT(*) as c FROM recipes') || [{}])[0].c || 0; } catch { counts.recipes = 0; }
    try { counts.refunds = (runQuery('SELECT COUNT(*) as c FROM refunds') || [{}])[0].c || 0; } catch { counts.refunds = 0; }
    try { counts.orders = (runQuery('SELECT COUNT(*) as c FROM sales') || [{}])[0].c || 0; } catch { counts.orders = 0; }
    counts.total = Object.values(counts).reduce((a, b) => a + b, 0);
    return counts;
}

function countMigratableSales() {
    const counts = getMigrationCounts();
    return counts.total || 0;
}

function getMigrateErrors() { return _migrateErrors.slice(); }

// ===== DATA FETCHERS =====

function getAllLocalProducts() {
    if (typeof runQuery !== 'function') return [];
    try { return runQuery('SELECT id, name, category, price, cost, barcode, stock, unit, icon, description FROM products') || []; }
    catch (e) { console.error('[Migrate] products query:', e); return []; }
}

function getAllLocalCustomers() {
    if (typeof runQuery !== 'function') return [];
    try { return runQuery('SELECT id, name, phone, email, address, notes, totalSpent, totalPurchases FROM customers') || []; }
    catch {
        try { return runQuery('SELECT id, name, phone, email, address, notes, totalSpent, visitCount as totalPurchases FROM phonebook') || []; }
        catch (e) { console.error('[Migrate] customers query:', e); return []; }
    }
}

function getAllLocalSuppliers() {
    if (typeof runQuery !== 'function') return [];
    try { return runQuery('SELECT id, name, contactPerson, phone, email, address, paymentTerms, balance, notes FROM suppliers') || []; }
    catch (e) { console.error('[Migrate] suppliers query:', e); return []; }
}

function getAllLocalPurchases() {
    if (typeof runQuery !== 'function') return [];
    try {
        const deliveries = runQuery('SELECT id, supplierId, invoiceNumber, deliveryDate, totalAmount, notes, receivedBy FROM deliveries') || [];
        for (const d of deliveries) {
            try { d.items = runQuery('SELECT productId, quantity, unitCost, lineTotal FROM delivery_items WHERE deliveryId = ?', [d.id]) || []; } catch { d.items = []; }
            try { const s = runQuery('SELECT name FROM suppliers WHERE id = ?', [d.supplierId]); d.supplierName = s?.[0]?.name || ''; } catch { d.supplierName = ''; }
        }
        return deliveries;
    } catch (e) { console.error('[Migrate] purchases query:', e); return []; }
}

function getAllLocalExpenses() {
    if (typeof runQuery !== 'function') return [];
    const results = [];
    // Fetch from expenses table (advanced expense tracking)
    try {
        const rows = runQuery('SELECT id, category, subcategory, description, amount, expenseDate, paymentMethod, paymentReference, vendor, status, notes FROM expenses') || [];
        for (const r of rows) results.push(r);
    } catch (e) { console.error('[Migrate] expenses table query:', e); }
    // Fetch from bill_payments table (utility bills shown in Bill Payments UI)
    try {
        const bills = runQuery(`
            SELECT bp.id, bt.name as category, bp.billNumber, bp.customerName, bp.amount,
                   bp.paymentMethod, bp.timestamp as expenseDate, bp.receiptNumber as paymentReference, bp.notes
            FROM bill_payments bp
            LEFT JOIN bill_types bt ON bp.billType = bt.id
        `) || [];
        for (const b of bills) {
            results.push({
                id: `bill-${b.id}`,
                category: b.category || 'Bill Payment',
                subcategory: '',
                description: `Bill #${b.billNumber || ''} - ${b.customerName || ''}`.trim(),
                amount: b.amount,
                expenseDate: b.expenseDate,
                paymentMethod: b.paymentMethod || 'cash',
                paymentReference: b.paymentReference || '',
                vendor: b.customerName || '',
                status: 'paid',
                notes: b.notes || ''
            });
        }
    } catch (e) { console.error('[Migrate] bill_payments query:', e); }
    return results;
}

function getAllLocalStaff() {
    if (typeof runQuery !== 'function') return [];
    try { return runQuery('SELECT id, employeeCode, firstName, lastName, phone, email, position, department, employmentType, paymentType, monthlySalary, dailyRate, hourlyRate, hireDate, isActive FROM staff') || []; }
    catch (e) { console.error('[Migrate] staff query:', e); return []; }
}

function getAllLocalSalaries() {
    if (typeof runQuery !== 'function') return [];
    try { return runQuery('SELECT id, staffId, paymentType, paymentPeriod, baseAmount, overtimeAmount, bonusAmount, deductions, netAmount, paymentMethod, paidAt, status FROM staff_payments') || []; }
    catch (e) { console.error('[Migrate] salaries query:', e); return []; }
}

function getAllLocalRawMaterials() {
    if (typeof runQuery !== 'function') return [];
    try { return runQuery('SELECT id, code, name, category, unit, currentStock, minStock, costPerUnit, isActive FROM raw_materials') || []; }
    catch (e) { console.error('[Migrate] raw_materials query:', e); return []; }
}

function getAllLocalRecipes() {
    if (typeof runQuery !== 'function') return [];
    try {
        const recipes = runQuery('SELECT id, productId, recipeName, stationId, servingSize, preparationTime, instructions, costPerServing, isActive FROM recipes') || [];
        for (const r of recipes) {
            try { r.ingredients = runQuery('SELECT rawMaterialId, quantityNeeded, unit, cost, isOptional FROM recipe_ingredients WHERE recipeId = ?', [r.id]) || []; } catch { r.ingredients = []; }
        }
        return recipes;
    } catch (e) { console.error('[Migrate] recipes query:', e); return []; }
}

function getAllLocalRefunds() {
    if (typeof runQuery !== 'function') return [];
    try { return runQuery('SELECT id, saleId, refundAmount, refundType, refundItems, reason, approvedBy, processedBy, timestamp, paymentMethod FROM refunds') || []; }
    catch (e) { console.error('[Migrate] refunds query:', e); return []; }
}

function getAllLocalSales() {
    if (typeof runQuery !== 'function') return [];
    try { return runQuery('SELECT id, timestamp, date, items, totals, paymentMethod, receiptNumber FROM sales ORDER BY id ASC') || []; }
    catch (e) { console.error('[Migrate] sales query:', e); return []; }
}

// ===== HELPERS =====

function parseJsonSafe(value, fallback) {
    if (!value) return fallback;
    if (typeof value === 'object') return value;
    try { return JSON.parse(value); } catch { return fallback; }
}

function toMigrateTimestamp(sale) {
    if (sale.timestamp) { const n = Number(sale.timestamp); if (Number.isFinite(n) && n > 0) return new Date(n).toISOString(); }
    if (sale.date) { const d = new Date(sale.date); if (!Number.isNaN(d.getTime())) return d.toISOString(); }
    return new Date().toISOString();
}

// ===== BULK POST HELPER =====

async function postBulkData(endpoint, payload) {
    const url = getGrabioApiUrl(endpoint);
    console.log(`[Migrate] POST ${url}`);
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    let data = {};
    let rawText = '';
    try { rawText = await response.text(); data = JSON.parse(rawText); } catch { data = {}; }
    console.log(`[Migrate] ${endpoint} → status=${response.status}, body=${rawText.substring(0, 200)}`);
    if (!response.ok || data.success === false) {
        const errMsg = data.error || `HTTP ${response.status}`;
        _migrateErrors.push({ endpoint, status: response.status, error: errMsg, url });
        console.error(`[Migrate] ${endpoint} failed:`, errMsg);
    }
    return { ok: response.ok && data.success !== false, data, status: response.status };
}

// ===== BATCH SYNC FUNCTIONS =====

async function syncProductsBatch(auth, items) {
    return postBulkData('/pos/products', {
        storeId: auth.storeId, deviceId: auth.deviceId, deviceToken: auth.deviceToken,
        products: items.map(p => ({ id: String(p.id||''), name: String(p.name||''), category: String(p.category||''), price: Number(p.price)||0, cost: Number(p.cost)||0, barcode: String(p.barcode||''), stock: Number(p.stock)||0, unit: String(p.unit||''), description: String(p.description||'') }))
    });
}

async function syncCustomersBatch(auth, items) {
    return postBulkData('/pos/customers', {
        storeId: auth.storeId, deviceId: auth.deviceId, deviceToken: auth.deviceToken,
        customers: items.map(c => ({ id: String(c.id||''), name: String(c.name||''), phone: String(c.phone||''), email: String(c.email||''), address: String(c.address||''), notes: String(c.notes||''), totalPurchases: Number(c.totalPurchases)||0, totalSpent: Number(c.totalSpent)||0 }))
    });
}

async function syncSuppliersBatch(auth, items) {
    return postBulkData('/pos/suppliers', {
        storeId: auth.storeId, deviceId: auth.deviceId, deviceToken: auth.deviceToken,
        suppliers: items.map(s => ({ id: String(s.id||''), name: String(s.name||''), contactPerson: String(s.contactPerson||''), phone: String(s.phone||''), email: String(s.email||''), address: String(s.address||''), paymentTerms: String(s.paymentTerms||''), balance: Number(s.balance)||0, notes: String(s.notes||'') }))
    });
}

async function syncPurchasesBatch(auth, items) {
    return postBulkData('/pos/purchases', {
        storeId: auth.storeId, deviceId: auth.deviceId, deviceToken: auth.deviceToken,
        purchases: items.map(p => ({ id: String(p.id||''), supplierId: String(p.supplierId||''), supplierName: String(p.supplierName||''), date: p.deliveryDate ? new Date(Number(p.deliveryDate)).toISOString() : '', invoiceNumber: String(p.invoiceNumber||''), items: Array.isArray(p.items) ? p.items : [], totalAmount: Number(p.totalAmount)||0, status: 'received', notes: String(p.notes||'') }))
    });
}

async function syncExpensesBatch(auth, items) {
    return postBulkData('/pos/expenses', {
        storeId: auth.storeId, deviceId: auth.deviceId, deviceToken: auth.deviceToken,
        expenses: items.map(e => ({ id: String(e.id||''), category: String(e.category||''), subcategory: String(e.subcategory||''), description: String(e.description||''), amount: Number(e.amount)||0, date: e.expenseDate ? new Date(Number(e.expenseDate)).toISOString() : '', paymentMethod: String(e.paymentMethod||'cash'), reference: String(e.paymentReference||''), vendor: String(e.vendor||''), status: String(e.status||'paid'), notes: String(e.notes||'') }))
    });
}

async function syncStaffBatch(auth, items) {
    return postBulkData('/pos/staff', {
        storeId: auth.storeId, deviceId: auth.deviceId, deviceToken: auth.deviceToken,
        staff: items.map(s => ({ id: String(s.id||''), employeeCode: String(s.employeeCode||''), firstName: String(s.firstName||''), lastName: String(s.lastName||''), phone: String(s.phone||''), email: String(s.email||''), position: String(s.position||''), department: String(s.department||''), employmentType: String(s.employmentType||'full_time'), paymentType: String(s.paymentType||'monthly'), monthlySalary: Number(s.monthlySalary)||0, dailyRate: Number(s.dailyRate)||0, hourlyRate: Number(s.hourlyRate)||0, hireDate: s.hireDate ? new Date(Number(s.hireDate)).toISOString() : '', isActive: s.isActive !== 0 }))
    });
}

async function syncSalariesBatch(auth, items) {
    return postBulkData('/pos/salaries', {
        storeId: auth.storeId, deviceId: auth.deviceId, deviceToken: auth.deviceToken,
        salaries: items.map(s => ({ id: String(s.id||''), staffId: String(s.staffId||''), paymentType: String(s.paymentType||''), paymentPeriod: String(s.paymentPeriod||''), baseAmount: Number(s.baseAmount)||0, overtimeAmount: Number(s.overtimeAmount)||0, bonusAmount: Number(s.bonusAmount)||0, deductions: Number(s.deductions)||0, netAmount: Number(s.netAmount)||0, paymentMethod: String(s.paymentMethod||'cash'), paymentDate: s.paidAt ? new Date(Number(s.paidAt)).toISOString() : '', status: String(s.status||'paid') }))
    });
}

async function syncRawMaterialsBatch(auth, items) {
    return postBulkData('/pos/raw-materials', {
        storeId: auth.storeId, deviceId: auth.deviceId, deviceToken: auth.deviceToken,
        rawMaterials: items.map(m => ({ id: String(m.id||''), code: String(m.code||''), name: String(m.name||''), category: String(m.category||''), unit: String(m.unit||''), currentStock: Number(m.currentStock)||0, minStock: Number(m.minStock)||0, costPerUnit: Number(m.costPerUnit)||0, isActive: m.isActive !== 0 }))
    });
}

async function syncRecipesBatch(auth, items) {
    return postBulkData('/pos/recipes', {
        storeId: auth.storeId, deviceId: auth.deviceId, deviceToken: auth.deviceToken,
        recipes: items.map(r => ({ id: String(r.id||''), productId: String(r.productId||''), recipeName: String(r.recipeName||''), stationId: String(r.stationId||''), servingSize: Number(r.servingSize)||1, preparationTime: Number(r.preparationTime)||0, instructions: String(r.instructions||''), costPerServing: Number(r.costPerServing)||0, ingredients: Array.isArray(r.ingredients) ? r.ingredients : [], isActive: r.isActive !== 0 }))
    });
}

async function syncRefundsBatch(auth, items) {
    return postBulkData('/pos/refunds', {
        storeId: auth.storeId, deviceId: auth.deviceId, deviceToken: auth.deviceToken,
        refunds: items.map(r => ({ id: String(r.id||''), saleId: String(r.saleId||''), refundAmount: Number(r.refundAmount)||0, refundType: String(r.refundType||'full'), refundItems: parseJsonSafe(r.refundItems, []), reason: String(r.reason||''), approvedBy: String(r.approvedBy||''), processedBy: String(r.processedBy||''), timestamp: r.timestamp ? new Date(Number(r.timestamp)).toISOString() : '', paymentMethod: String(r.paymentMethod||'cash') }))
    });
}

// ===== ORDER SYNC (one-by-one for idempotency) =====

function buildMigrateItems(rawItems) {
    const items = parseJsonSafe(rawItems, []);
    if (!Array.isArray(items)) return [];
    return items.map(item => {
        const localId = String(item.id ?? item.productId ?? item.product_id ?? '').trim();
        const name = String(item.name || '').trim();
        const qty = Math.max(1, Number(item.quantity) || 1);
        const price = Number(item.price ?? item.unitPrice) || 0;
        const productId = localId || (name ? `local-name-${name.replace(/\s+/g, '-').toLowerCase()}` : '');
        if (!productId || qty <= 0) return null;
        return { productId, name, quantity: qty, price, total: Number(item.total) || price * qty };
    }).filter(Boolean);
}

function buildMigratePayload(sale, auth) {
    const items = buildMigrateItems(sale.items);
    if (items.length === 0) return null;
    const totals = parseJsonSafe(sale.totals, {});
    return {
        storeId: auth.storeId, deviceId: auth.deviceId, deviceToken: auth.deviceToken,
        localSaleId: `hist-${sale.id}`, composedProductSource: 'pos',
        paymentMethod: String(sale.paymentMethod || 'cash').trim() || 'cash',
        timestamp: toMigrateTimestamp(sale), items,
        totals: { subtotal: Number(totals.subtotal)||0, taxAmount: Number(totals.tax ?? totals.taxAmount)||0, discountAmount: Number(totals.discount ?? totals.discountAmount)||0, total: Number(totals.total)||0 }
    };
}

async function postMigrateOrder(payload) {
    const response = await fetch(getGrabioApiUrl('/pos/orders'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    let data = {}; try { data = await response.json(); } catch { data = {}; }
    if (!response.ok || data.success === false) { _migrateErrors.push({ endpoint: '/pos/orders', saleId: payload.localSaleId, status: response.status, error: data.error || `HTTP ${response.status}` }); }
    return { ok: response.ok && data.success !== false, data, status: response.status };
}

// ===== GENERIC BATCH PHASE RUNNER =====

async function runBatchPhase(phaseName, allItems, syncFn, auth, stats, progress) {
    console.log(`[Migrate] ${phaseName} found: ${allItems.length}`);
    if (allItems.length === 0) return;
    for (let i = 0; i < allItems.length; i += GRABIO_MIGRATE_BATCH_SIZE) {
        const batch = allItems.slice(i, i + GRABIO_MIGRATE_BATCH_SIZE);
        try {
            const result = await syncFn(auth, batch);
            if (result.ok) { stats.synced += batch.length; } else { stats.failed += batch.length; }
        } catch (e) {
            stats.failed += batch.length;
            _migrateErrors.push({ endpoint: `/pos/${phaseName}`, error: e.message });
        }
        for (let j = 0; j < batch.length; j++) progress(phaseName, `${phaseName} ${Math.min(i + j + 1, allItems.length)}/${allItems.length}`);
        if (i + GRABIO_MIGRATE_BATCH_SIZE < allItems.length) await new Promise(r => setTimeout(r, GRABIO_MIGRATE_DELAY_MS));
    }
}

// ===== MAIN MIGRATION FUNCTION =====

async function migrateHistoricalSales(onProgress) {
    if (!isGrabioPaired()) throw new Error('POS not paired with Grabio');
    const auth = getGrabioSyncAuth();
    if (!auth.storeId || !auth.deviceId || !auth.deviceToken) throw new Error('Missing Grabio pairing credentials');

    _migrateErrors.length = 0;
    const stats = {
        products: { synced: 0, failed: 0 }, customers: { synced: 0, failed: 0 },
        suppliers: { synced: 0, failed: 0 }, purchases: { synced: 0, failed: 0 },
        expenses: { synced: 0, failed: 0 }, staff: { synced: 0, failed: 0 },
        salaries: { synced: 0, failed: 0 }, rawMaterials: { synced: 0, failed: 0 },
        recipes: { synced: 0, failed: 0 }, refunds: { synced: 0, failed: 0 },
        orders: { posted: 0, existed: 0, skipped: 0, failed: 0 }
    };

    let globalCurrent = 0;
    const counts = getMigrationCounts();
    const globalTotal = counts.total || 1;

    function progress(phase, label) {
        globalCurrent++;
        if (typeof onProgress === 'function') onProgress({ phase, current: globalCurrent, total: globalTotal, label });
    }

    // Batch phases
    await runBatchPhase('products', getAllLocalProducts(), syncProductsBatch, auth, stats.products, progress);
    await runBatchPhase('customers', getAllLocalCustomers(), syncCustomersBatch, auth, stats.customers, progress);
    await runBatchPhase('suppliers', getAllLocalSuppliers(), syncSuppliersBatch, auth, stats.suppliers, progress);
    await runBatchPhase('purchases', getAllLocalPurchases(), syncPurchasesBatch, auth, stats.purchases, progress);
    await runBatchPhase('expenses', getAllLocalExpenses(), syncExpensesBatch, auth, stats.expenses, progress);
    await runBatchPhase('staff', getAllLocalStaff(), syncStaffBatch, auth, stats.staff, progress);
    await runBatchPhase('salaries', getAllLocalSalaries(), syncSalariesBatch, auth, stats.salaries, progress);
    await runBatchPhase('rawMaterials', getAllLocalRawMaterials(), syncRawMaterialsBatch, auth, stats.rawMaterials, progress);
    await runBatchPhase('recipes', getAllLocalRecipes(), syncRecipesBatch, auth, stats.recipes, progress);
    await runBatchPhase('refunds', getAllLocalRefunds(), syncRefundsBatch, auth, stats.refunds, progress);

    // Orders (one-by-one for idempotency)
    const sales = getAllLocalSales();
    console.log(`[Migrate] Orders found: ${sales.length}`);
    for (let i = 0; i < sales.length; i++) {
        const sale = sales[i];
        const payload = buildMigratePayload(sale, auth);
        if (!payload) { stats.orders.skipped++; progress('orders', `Orders ${i+1}/${sales.length}`); continue; }
        try {
            const result = await postMigrateOrder(payload);
            if (result.ok) { if (result.data.alreadyExisted) { stats.orders.existed++; } else { stats.orders.posted++; } }
            else { stats.orders.failed++; }
        } catch (e) { stats.orders.failed++; _migrateErrors.push({ endpoint: '/pos/orders', saleId: `hist-${sale.id}`, error: e.message }); }
        progress('orders', `Orders ${i+1}/${sales.length}`);
        if (GRABIO_MIGRATE_DELAY_MS > 0 && i < sales.length - 1) await new Promise(r => setTimeout(r, GRABIO_MIGRATE_DELAY_MS));
    }

    stats.errors = _migrateErrors.slice();
    console.log('[Grabio-Migrate] Full sync complete:', stats);
    if (_migrateErrors.length > 0) console.warn('[Grabio-Migrate] Errors:', _migrateErrors);
    return stats;
}

if (typeof window !== 'undefined') {
    window.countMigratableSales = countMigratableSales;
    window.getMigrationCounts = getMigrationCounts;
    window.getMigrateErrors = getMigrateErrors;
    window.migrateHistoricalSales = migrateHistoricalSales;
}
