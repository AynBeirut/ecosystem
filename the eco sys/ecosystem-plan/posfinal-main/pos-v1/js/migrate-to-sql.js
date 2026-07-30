// ===================================
// AYN BEIRUT POS - INDEXEDDB TO SQL.JS MIGRATION
// One-time data migration tool
// ===================================

let migrationProgress = { total: 0, current: 0 };

async function migrateFromIndexedDB() {
    try {
        console.log('🔄 Checking for IndexedDB migration...');
        
        // Check if already migrated
        if (localStorage.getItem('migration_completed') === 'true') {
            console.log('✅ Migration already completed');
            return true;
        }
        
        // Open old IndexedDB
        const oldDb = await openIndexedDB();
        if (!oldDb) {
            console.log('ℹ️ No existing IndexedDB - skipping migration');
            localStorage.setItem('migration_completed', 'true');
            return true;
        }
        
        // Count records
        const counts = await countRecords(oldDb);
        migrationProgress.total = Object.values(counts).reduce((a, b) => a + b, 0);
        
        if (migrationProgress.total === 0) {
            console.log('ℹ️ No data to migrate');
            oldDb.close();
            localStorage.setItem('migration_completed', 'true');
            return true;
        }
        
        console.log('📊 Migrating', migrationProgress.total, 'records...');
        showMigrationUI();
        
        // Migrate stores
        migrationProgress.current = 0;
        await migrateStore(oldDb, 'products', counts.products);
        await migrateStore(oldDb, 'users', counts.users);
        await migrateStore(oldDb, 'categories', counts.categories);
        await migrateStore(oldDb, 'customers', counts.customers);
        await migrateStore(oldDb, 'sales', counts.sales);
        await migrateStore(oldDb, 'unpaid_orders', counts.unpaid_orders);
        
        localStorage.setItem('migration_completed', 'true');
        await saveDatabase();
        
        oldDb.close();
        console.log('✅ Migration completed');
        
        hideMigrationUI();
        return true;
    } catch (error) {
        console.error('❌ Migration failed:', error);
        hideMigrationUI();
        throw error;
    }
}

function openIndexedDB() {
    return new Promise((resolve) => {
        const request = indexedDB.open('AynBeirutPOS', 6);
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = () => resolve(null);
    });
}

async function countRecords(oldDb) {
    const counts = {};
    const stores = ['products', 'users', 'categories', 'customers', 'sales', 'unpaid_orders'];
    
    for (const name of stores) {
        if (!oldDb.objectStoreNames.contains(name)) {
            counts[name] = 0;
            continue;
        }
        
        counts[name] = await new Promise((resolve) => {
            const tx = oldDb.transaction([name], 'readonly');
            const store = tx.objectStore(name);
            const req = store.count();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(0);
        });
    }
    
    return counts;
}

async function migrateStore(oldDb, storeName, count) {
    if (count === 0) return;
    
    console.log(`📦 Migrating ${storeName}...`);
    updateMigrationUI(`Migrating ${storeName}...`, (migrationProgress.current / migrationProgress.total) * 100);
    
    const records = await new Promise((resolve) => {
        const tx = oldDb.transaction([storeName], 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
    });
    
    for (const record of records) {
        try {
            await insertRecord(storeName, record);
            migrationProgress.current++;
            
            if (migrationProgress.current % 10 === 0) {
                updateMigrationUI(
                    `Migrating ${storeName}...`,
                    (migrationProgress.current / migrationProgress.total) * 100
                );
            }
        } catch (error) {
            console.error(`Failed to migrate ${storeName} record:`, error);
        }
    }
}

async function insertRecord(table, record) {
    const cashierId = getCashierId();
    
    switch (table) {
        case 'products':
            await runExec(
                `INSERT OR REPLACE INTO products (id, name, category, price, icon, barcode, stock, synced)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
                [record.id, record.name, record.category, record.price, record.icon || null, record.barcode || null, record.stock || 0]
            );
            break;
        
        case 'users':
            await runExec(
                `INSERT OR REPLACE INTO users (id, username, password, role, name, email)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [record.id, record.username, record.password, record.role || 'cashier', record.name || null, record.email || null]
            );
            break;
        
        case 'sales':
            await runExec(
                `INSERT INTO sales (timestamp, date, items, totals, paymentMethod, customerInfo, cashierId, synced)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
                [record.timestamp, record.date, JSON.stringify(record.items), JSON.stringify(record.totals), 
                 record.paymentMethod || null, record.customerInfo ? JSON.stringify(record.customerInfo) : null, cashierId]
            );
            break;
        
        case 'customers':
            await runExec(
                `INSERT INTO customers (name, phone, email, totalSpent, totalPurchases, synced)
                 VALUES (?, ?, ?, ?, ?, 0)`,
                [record.name, record.phone || null, record.email || null, record.totalSpent || 0, record.totalPurchases || 0]
            );
            break;
        
        case 'categories':
            await runExec(
                `INSERT OR REPLACE INTO categories (id, name, displayName, icon, sortOrder, synced)
                 VALUES (?, ?, ?, ?, ?, 0)`,
                [record.id, record.name, record.displayName, record.icon || null, record.sortOrder || 0]
            );
            break;
        
        case 'unpaid_orders':
            await runExec(
                `INSERT INTO unpaid_orders (timestamp, status, customerName, items, totals, createdDate, cashierId, synced)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
                [record.timestamp, record.status || 'unpaid', record.customerName || null, 
                 JSON.stringify(record.items), JSON.stringify(record.totals), record.createdDate, cashierId]
            );
            break;
    }
}

function showMigrationUI() {
    const div = document.createElement('div');
    div.id = 'migration-overlay';
    div.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:99999';
    div.innerHTML = `
        <div style="background:white;padding:30px;border-radius:8px;text-align:center;max-width:400px">
            <h2>🔄 Migrating Database</h2>
            <p id="migration-status">Please wait...</p>
            <div style="background:#f0f0f0;border-radius:4px;height:30px;margin:20px 0;overflow:hidden">
                <div id="migration-bar" style="background:#1C75BC;height:100%;width:0%;transition:width 0.3s"></div>
            </div>
            <p id="migration-percent">0%</p>
        </div>
    `;
    document.body.appendChild(div);
}

function updateMigrationUI(status, percent) {
    const statusEl = document.getElementById('migration-status');
    const bar = document.getElementById('migration-bar');
    const percentEl = document.getElementById('migration-percent');
    
    if (statusEl) statusEl.textContent = status;
    if (bar) bar.style.width = percent + '%';
    if (percentEl) percentEl.textContent = Math.round(percent) + '%';
}

function hideMigrationUI() {
    const overlay = document.getElementById('migration-overlay');
    if (overlay) overlay.remove();
}

if (typeof window !== 'undefined') {
    window.migrateFromIndexedDB = migrateFromIndexedDB;
}

console.log('📦 Migration tool loaded');
