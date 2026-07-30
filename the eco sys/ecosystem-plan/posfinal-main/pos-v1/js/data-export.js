/**
 * Data Export & Backup Module
 * Allows users to export sales data, products, and transactions
 */

// Export all data to JSON file
async function exportAllData() {
    try {
        const data = {
            exportDate: new Date().toISOString(),
            version: '1.0',
            sales: await getAllSales(),
            products: await loadProductsFromDB(),
            transactions: await getAllTransactions(),
            users: await getAllUsers()
        };

        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `AynBeirut-POS-Data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('✅ Data exported successfully');
        return true;
    } catch (error) {
        console.error('Export error:', error);
        return false;
    }
}

// Export sales data only (using shared export utilities)
async function exportSalesData() {
    try {
        const sales = await getAllSales();
        
        // Prepare data for export
        const exportData = sales.map(sale => ({
            'Date': new Date(sale.timestamp).toLocaleDateString(),
            'Time': new Date(sale.timestamp).toLocaleTimeString(),
            'Transaction ID': sale.id,
            'Items': sale.items.length,
            'Subtotal': sale.subtotal,
            'Tax': sale.tax,
            'Total': sale.total,
            'Payment Method': sale.paymentMethod || 'N/A'
        }));
        
        const filename = `Sales-Report-${new Date().toISOString().split('T')[0]}`;
        
        // Use shared export utility
        if (typeof exportToCSV === 'function') {
            exportToCSV(exportData, filename);
            console.log('✅ Sales data exported using shared utility');
        } else {
            console.error('exportToCSV function not available');
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Export error:', error);
        return false;
    }
}

// Get all sales from database
async function getAllSales() {
    try {
        return runQuery('SELECT * FROM sales ORDER BY timestamp DESC');
    } catch (error) {
        console.error('Error getting sales:', error);
        return [];
    }
}

// Get all transactions
async function getAllTransactions() {
    try {
        return runQuery('SELECT * FROM sales ORDER BY timestamp DESC');
    } catch (error) {
        console.error('Error getting transactions:', error);
        return [];
    }
}

// Get all users
async function getAllUsers() {
    try {
        return runQuery('SELECT id, username, role, name, email FROM users');
    } catch (error) {
        console.error('Error getting users:', error);
        return [];
    }
}

// View database location info
function showDatabaseInfo() {
    const info = {
        browser: getBrowserName(),
        storage: 'IndexedDB',
        database: 'ayn-pos-db',
        location: getDatabaseLocation()
    };
    
    console.log('📊 Database Information:', info);
    alert(`Database Location:\n\nBrowser: ${info.browser}\nStorage: IndexedDB (Browser Storage)\nDatabase: ayn-pos-db\n\nLocation: ${info.location}\n\nNote: Data is stored in your browser's internal storage.\nUse "Export Data" to save a backup file.`);
}

function getBrowserName() {
    const ua = navigator.userAgent;
    if (ua.includes('Chrome')) return 'Google Chrome';
    if (ua.includes('Firefox')) return 'Mozilla Firefox';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Microsoft Edge';
    return 'Unknown Browser';
}

function getDatabaseLocation() {
    const browser = getBrowserName();
    if (browser.includes('Chrome')) {
        return 'Chrome > DevTools (F12) > Application > IndexedDB > ayn-pos-db';
    } else if (browser.includes('Firefox')) {
        return 'Firefox > DevTools (F12) > Storage > IndexedDB > ayn-pos-db';
    } else if (browser.includes('Edge')) {
        return 'Edge > DevTools (F12) > Application > IndexedDB > ayn-pos-db';
    }
    return 'Browser DevTools > Storage/Application > IndexedDB';
}

// Export functions for global access
window.exportAllData = exportAllData;
window.exportSalesData = exportSalesData;
window.showDatabaseInfo = showDatabaseInfo;
