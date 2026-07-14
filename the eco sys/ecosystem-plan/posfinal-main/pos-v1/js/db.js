// ===================================
// AYN BEIRUT POS - INDEXEDDB
// Offline data persistence
// ===================================

let db = null;
const DB_NAME = 'AynBeirutPOS';
const DB_VERSION = 6; // Updated to add unpaid_orders store

// ===================================
// DATABASE INITIALIZATION
// ===================================

function initDatabase() {
    return new Promise((resolve, reject) => {
        console.log('🔧 Opening database:', DB_NAME, 'version', DB_VERSION);
        
        // Add timeout to prevent infinite loading
        const timeout = setTimeout(() => {
            console.error('❌ Database initialization timeout - consider clearing DB');
            reject(new Error('Database initialization timeout after 10 seconds'));
        }, 10000);
        
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => {
            clearTimeout(timeout);
            console.error('❌ Database failed to open:', request.error);
            reject(request.error);
        };
        
        request.onsuccess = () => {
            clearTimeout(timeout);
            db = request.result;
            console.log('✅ IndexedDB initialized successfully');
            console.log('📊 Object stores:', Array.from(db.objectStoreNames));
            resolve(db);
        };
        
        request.onblocked = () => {
            clearTimeout(timeout);
            console.warn('⚠️ Database upgrade blocked - close other tabs');
            reject(new Error('Database blocked - please close other POS tabs'));
        };
        
        request.onupgradeneeded = (event) => {
            console.log('🔄 Database upgrade needed from version', event.oldVersion, 'to', event.newVersion);
            db = event.target.result;
            
            // Create sales history store
            if (!db.objectStoreNames.contains('sales')) {
                const salesStore = db.createObjectStore('sales', { 
                    keyPath: 'id', 
                    autoIncrement: true 
                });
                salesStore.createIndex('timestamp', 'timestamp', { unique: false });
                salesStore.createIndex('date', 'date', { unique: false });
            }
            
            // Create products store (for future use)
            if (!db.objectStoreNames.contains('products')) {
                const productsStore = db.createObjectStore('products', { 
                    keyPath: 'id' 
                });
                productsStore.createIndex('category', 'category', { unique: false });
                productsStore.createIndex('name', 'name', { unique: false });
            }
            
            // Create users store
            if (!db.objectStoreNames.contains('users')) {
                const usersStore = db.createObjectStore('users', { 
                    keyPath: 'id' 
                });
                usersStore.createIndex('username', 'username', { unique: true });
                usersStore.createIndex('role', 'role', { unique: false });
            }
            
            // Create activity logs store
            if (!db.objectStoreNames.contains('activity')) {
                const activityStore = db.createObjectStore('activity', { 
                    keyPath: 'id', 
                    autoIncrement: true 
                });
                activityStore.createIndex('userId', 'userId', { unique: false });
                activityStore.createIndex('action', 'action', { unique: false });
                activityStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
            
            // Create stock history store
            if (!db.objectStoreNames.contains('stock_history')) {
                const stockHistoryStore = db.createObjectStore('stock_history', { 
                    keyPath: 'id', 
                    autoIncrement: true 
                });
                stockHistoryStore.createIndex('productId', 'productId', { unique: false });
                stockHistoryStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
            
            // Create customers store
            if (!db.objectStoreNames.contains('customers')) {
                console.log('📝 Creating customers store...');
                const customersStore = db.createObjectStore('customers', { 
                    keyPath: 'id', 
                    autoIncrement: true 
                });
                customersStore.createIndex('phone', 'phone', { unique: false }); // Changed to false to avoid conflicts
                customersStore.createIndex('name', 'name', { unique: false });
                customersStore.createIndex('lastPurchase', 'lastPurchase', { unique: false });
                console.log('✅ Customers store created');
            }
            
            // Create categories store
            if (!db.objectStoreNames.contains('categories')) {
                console.log('📝 Creating categories store...');
                const categoriesStore = db.createObjectStore('categories', { 
                    keyPath: 'id', 
                    autoIncrement: true 
                });
                categoriesStore.createIndex('name', 'name', { unique: true });
                console.log('✅ Categories store created');
                
                // Add default categories
                const transaction = event.target.transaction;
                const store = transaction.objectStore('categories');
                const defaultCategories = [
                    { name: 'electronics', displayName: 'Electronics', icon: '💻' },
                    { name: 'accessories', displayName: 'Accessories', icon: '🎧' },
                    { name: 'software', displayName: 'Software', icon: '📀' },
                    { name: 'other', displayName: 'Other', icon: '📦' }
                ];
                defaultCategories.forEach(cat => store.add(cat));
            }
            
            // Create unpaid orders store
            if (!db.objectStoreNames.contains('unpaid_orders')) {
                console.log('📝 Creating unpaid_orders store...');
                const unpaidOrdersStore = db.createObjectStore('unpaid_orders', { 
                    keyPath: 'id', 
                    autoIncrement: true 
                });
                unpaidOrdersStore.createIndex('timestamp', 'timestamp', { unique: false });
                unpaidOrdersStore.createIndex('customerName', 'customerName', { unique: false });
                unpaidOrdersStore.createIndex('status', 'status', { unique: false });
                console.log('✅ Unpaid orders store created');
            }
            
            console.log('✅ Database schema created/updated');
        };
    });
}

// ===================================
// SALES OPERATIONS
// ===================================

function saveSale(saleData) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject('Database not initialized');
            return;
        }
        
        // Add date for easy querying
        const sale = {
            ...saleData,
            date: new Date(saleData.timestamp).toISOString().split('T')[0]
        };
        
        const transaction = db.transaction(['sales'], 'readwrite');
        const store = transaction.objectStore('sales');
        const request = store.add(sale);
        
        request.onsuccess = () => {
            console.log('✅ Sale saved to database');
            resolve(request.result);
        };
        
        request.onerror = () => {
            console.error('Failed to save sale');
            reject(request.error);
        };
    });
}

function getAllSales() {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject('Database not initialized');
            return;
        }
        
        const transaction = db.transaction(['sales'], 'readonly');
        const store = transaction.objectStore('sales');
        const request = store.getAll();
        
        request.onsuccess = () => {
            resolve(request.result);
        };
        
        request.onerror = () => {
            reject(request.error);
        };
    });
}

function getSalesByDate(date) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject('Database not initialized');
            return;
        }
        
        const transaction = db.transaction(['sales'], 'readonly');
        const store = transaction.objectStore('sales');
        const index = store.index('date');
        const request = index.getAll(date);
        
        request.onsuccess = () => {
            resolve(request.result);
        };
        
        request.onerror = () => {
            reject(request.error);
        };
    });
}

function getTodaySales() {
    const today = new Date().toISOString().split('T')[0];
    return getSalesByDate(today);
}

function clearAllSales() {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject('Database not initialized');
            return;
        }
        
        const transaction = db.transaction(['sales'], 'readwrite');
        const store = transaction.objectStore('sales');
        const request = store.clear();
        
        request.onsuccess = () => {
            console.log('✅ All sales cleared');
            resolve();
        };
        
        request.onerror = () => {
            reject(request.error);
        };
    });
}

// ===================================
// STATISTICS
// ===================================

async function getDailyStats() {
    try {
        const sales = await getTodaySales();
        
        const totalSales = sales.length;
        const totalRevenue = sales.reduce((sum, sale) => sum + sale.totals.total, 0);
        const totalItems = sales.reduce((sum, sale) => {
            return sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0);
        }, 0);
        
        return {
            totalSales,
            totalRevenue,
            totalItems,
            averageSale: totalSales > 0 ? totalRevenue / totalSales : 0
        };
    } catch (error) {
        console.error('Failed to get daily stats:', error);
        return {
            totalSales: 0,
            totalRevenue: 0,
            totalItems: 0,
            averageSale: 0
        };
    }
}

// ===================================
// CUSTOMER OPERATIONS
// ===================================

function saveCustomer(customerData) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject('Database not initialized');
            return;
        }
        
        const transaction = db.transaction(['customers'], 'readwrite');
        const store = transaction.objectStore('customers');
        const request = store.add(customerData);
        
        request.onsuccess = () => {
            console.log('✅ Customer saved');
            resolve(request.result);
        };
        
        request.onerror = () => {
            reject(request.error);
        };
    });
}

function updateCustomer(customerId, customerData) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject('Database not initialized');
            return;
        }
        
        const transaction = db.transaction(['customers'], 'readwrite');
        const store = transaction.objectStore('customers');
        const request = store.put({ ...customerData, id: customerId });
        
        request.onsuccess = () => {
            console.log('✅ Customer updated');
            resolve(request.result);
        };
        
        request.onerror = () => {
            reject(request.error);
        };
    });
}

function getAllCustomers() {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject('Database not initialized');
            return;
        }
        
        const transaction = db.transaction(['customers'], 'readonly');
        const store = transaction.objectStore('customers');
        const request = store.getAll();
        
        request.onsuccess = () => {
            resolve(request.result || []);
        };
        
        request.onerror = () => {
            reject(request.error);
        };
    });
}

function getCustomerByPhone(phone) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject('Database not initialized');
            return;
        }
        
        const transaction = db.transaction(['customers'], 'readonly');
        const store = transaction.objectStore('customers');
        const index = store.index('phone');
        const request = index.get(phone);
        
        request.onsuccess = () => {
            resolve(request.result);
        };
        
        request.onerror = () => {
            reject(request.error);
        };
    });
}

// ===================================
// CATEGORY OPERATIONS
// ===================================

function getAllCategories() {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject('Database not initialized');
            return;
        }
        
        const transaction = db.transaction(['categories'], 'readonly');
        const store = transaction.objectStore('categories');
        const request = store.getAll();
        
        request.onsuccess = () => {
            resolve(request.result || []);
        };
        
        request.onerror = () => {
            reject(request.error);
        };
    });
}

function saveCategory(categoryData) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject('Database not initialized');
            return;
        }
        
        const transaction = db.transaction(['categories'], 'readwrite');
        const store = transaction.objectStore('categories');
        const request = store.add(categoryData);
        
        request.onsuccess = () => {
            console.log('✅ Category saved');
            resolve(request.result);
        };
        
        request.onerror = () => {
            console.error('Failed to save category');
            reject(request.error);
        };
    });
}

function updateCategory(id, categoryData) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject('Database not initialized');
            return;
        }
        
        const transaction = db.transaction(['categories'], 'readwrite');
        const store = transaction.objectStore('categories');
        const request = store.put({ ...categoryData, id });
        
        request.onsuccess = () => {
            console.log('✅ Category updated');
            resolve(request.result);
        };
        
        request.onerror = () => {
            console.error('Failed to update category');
            reject(request.error);
        };
    });
}

function deleteCategory(id) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject('Database not initialized');
            return;
        }
        
        const transaction = db.transaction(['categories'], 'readwrite');
        const store = transaction.objectStore('categories');
        const request = store.delete(id);
        
        request.onsuccess = () => {
            console.log('✅ Category deleted');
            resolve();
        };
        
        request.onerror = () => {
            console.error('Failed to delete category');
            reject(request.error);
        };
    });
}

// ===================================
// UNPAID ORDERS OPERATIONS
// ===================================

function saveUnpaidOrder(orderData) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject('Database not initialized');
            return;
        }
        
        const order = {
            ...orderData,
            timestamp: Date.now(),
            status: 'unpaid',
            createdDate: new Date().toISOString()
        };
        
        const transaction = db.transaction(['unpaid_orders'], 'readwrite');
        const store = transaction.objectStore('unpaid_orders');
        const request = store.add(order);
        
        request.onsuccess = () => {
            console.log('✅ Unpaid order saved to database');
            resolve(request.result);
        };
        
        request.onerror = () => {
            console.error('Failed to save unpaid order');
            reject(request.error);
        };
    });
}

function getAllUnpaidOrders() {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject('Database not initialized');
            return;
        }
        
        const transaction = db.transaction(['unpaid_orders'], 'readonly');
        const store = transaction.objectStore('unpaid_orders');
        const request = store.getAll();
        
        request.onsuccess = () => {
            const orders = request.result.filter(order => order.status === 'unpaid');
            resolve(orders);
        };
        
        request.onerror = () => {
            console.error('Failed to get unpaid orders');
            reject(request.error);
        };
    });
}

function getUnpaidOrderById(id) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject('Database not initialized');
            return;
        }
        
        const transaction = db.transaction(['unpaid_orders'], 'readonly');
        const store = transaction.objectStore('unpaid_orders');
        const request = store.get(id);
        
        request.onsuccess = () => {
            resolve(request.result);
        };
        
        request.onerror = () => {
            console.error('Failed to get unpaid order');
            reject(request.error);
        };
    });
}

function deleteUnpaidOrder(id) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject('Database not initialized');
            return;
        }
        
        const transaction = db.transaction(['unpaid_orders'], 'readwrite');
        const store = transaction.objectStore('unpaid_orders');
        const request = store.delete(id);
        
        request.onsuccess = () => {
            console.log('✅ Unpaid order deleted');
            resolve();
        };
        
        request.onerror = () => {
            console.error('Failed to delete unpaid order');
            reject(request.error);
        };
    });
}

function updateUnpaidOrderStatus(id, status) {
    return new Promise(async (resolve, reject) => {
        if (!db) {
            reject('Database not initialized');
            return;
        }
        
        try {
            const order = await getUnpaidOrderById(id);
            if (!order) {
                reject('Order not found');
                return;
            }
            
            order.status = status;
            order.paidDate = new Date().toISOString();
            
            const transaction = db.transaction(['unpaid_orders'], 'readwrite');
            const store = transaction.objectStore('unpaid_orders');
            const request = store.put(order);
            
            request.onsuccess = () => {
                console.log('✅ Unpaid order status updated');
                resolve(order);
            };
            
            request.onerror = () => {
                console.error('Failed to update unpaid order');
                reject(request.error);
            };
        } catch (error) {
            reject(error);
        }
    });
}

// ===================================
// EXPORT FUNCTIONS
// ===================================

window.initDatabase = initDatabase;
window.saveSale = saveSale;
window.getAllSales = getAllSales;
window.getSalesByDate = getSalesByDate;
window.getTodaySales = getTodaySales;
window.clearAllSales = clearAllSales;
window.getDailyStats = getDailyStats;
window.saveCustomer = saveCustomer;
window.updateCustomer = updateCustomer;
window.getAllCustomers = getAllCustomers;
window.getCustomerByPhone = getCustomerByPhone;
window.getAllCategories = getAllCategories;
window.saveCategory = saveCategory;
window.updateCategory = updateCategory;
window.deleteCategory = deleteCategory;
window.saveUnpaidOrder = saveUnpaidOrder;
window.getAllUnpaidOrders = getAllUnpaidOrders;
window.getUnpaidOrderById = getUnpaidOrderById;
window.deleteUnpaidOrder = deleteUnpaidOrder;
window.updateUnpaidOrderStatus = updateUnpaidOrderStatus;
