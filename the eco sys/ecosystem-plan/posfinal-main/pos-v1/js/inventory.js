/**
 * Inventory Tracking Module
 * Manages stock levels, auto-deduction, low stock alerts, and inventory reports
 */

let inventoryLowStockThreshold = 10; // Default low stock warning threshold

/**
 * Initialize inventory tracking
 */
function initInventory() {
    // Guard to prevent duplicate initialization
    if (window._inventoryInitialized) {
        console.log('⚠️ Inventory already initialized, skipping...');
        return;
    }
    window._inventoryInitialized = true;
    
    console.log('Initializing inventory tracking...');
    
    // Attach to existing inventory button in HTML (don't create duplicate)
    const inventoryBtn = document.getElementById('inventory-btn');
    if (inventoryBtn && !inventoryBtn.hasAttribute('data-inventory-init')) {
        inventoryBtn.addEventListener('click', openInventoryModal);
        inventoryBtn.setAttribute('data-inventory-init', 'true');
        console.log('✅ Inventory button listener attached');
    }
    
    // Check for low stock on startup
    checkLowStock();
    
    console.log('✅ Inventory tracking initialized');
}

/**
 * Open inventory management modal
 */
function openInventoryModal() {
    const modal = document.getElementById('inventory-modal');
    if (!modal) return;
    
    loadInventoryData();
    modal.classList.add('show');
}

/**
 * Close inventory modal
 */
function closeInventoryModal() {
    const modal = document.getElementById('inventory-modal');
    if (modal) {
        modal.classList.remove('show');
    }
}

/**
 * Load and display inventory data
 */
async function loadInventoryData() {
    const products = await loadProductsFromDB();
    
    // Calculate inventory stats
    const stats = calculateInventoryStats(products);
    updateInventoryStats(stats);
    
    // Render inventory table
    renderInventoryTable(products);
    
    // Render low stock alerts
    renderLowStockAlerts(products);
}

/**
 * Calculate inventory statistics
 */
function calculateInventoryStats(products) {
    // Filter out services - they don't have stock
    const itemProducts = products.filter(p => p.type !== 'service');
    
    // Helper function to get actual stock (handles composed products)
    const getActualStock = (product) => {
        let stock = product.stock || 0;
        const isComposed = product.type === 'composed' || (product.has_recipe === 1 && product.type === 'item');
        if (isComposed && typeof window.calculateComposedProductStock === 'function') {
            stock = window.calculateComposedProductStock(product.id);
        }
        return parseInt(stock) || 0;
    };
    
    const totalProducts = products.length;
    const totalStock = itemProducts.reduce((sum, p) => sum + getActualStock(p), 0);
    const lowStockItems = itemProducts.filter(p => {
        const stock = getActualStock(p);
        return stock <= inventoryLowStockThreshold && stock > 0;
    }).length;
    const outOfStockItems = itemProducts.filter(p => {
        const stock = getActualStock(p);
        return stock <= 0;
    }).length;
    const totalValue = itemProducts.reduce((sum, p) => sum + (getActualStock(p) * p.price), 0);
    
    return {
        totalProducts,
        totalStock,
        lowStockItems,
        outOfStockItems,
        totalValue
    };
}

/**
 * Update inventory statistics display
 */
function updateInventoryStats(stats) {
    document.getElementById('total-products-stat').textContent = stats.totalProducts;
    document.getElementById('total-stock-stat').textContent = stats.totalStock;
    document.getElementById('low-stock-stat').textContent = stats.lowStockItems;
    document.getElementById('out-of-stock-stat').textContent = stats.outOfStockItems;
    document.getElementById('inventory-value-stat').textContent = `$${stats.totalValue.toFixed(2)}`;
}

/**
 * Render inventory table
 */
function renderInventoryTable(products) {
    const tbody = document.getElementById('inventory-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    products.forEach(product => {
        let stock = product.stock || 0;
        const productType = product.type || 'item';
        const unit = product.unit || '';
        
        // Calculate stock for composed products
        const isComposed = product.type === 'composed' || (product.has_recipe === 1 && productType === 'item');
        if (isComposed && typeof window.calculateComposedProductStock === 'function') {
            stock = window.calculateComposedProductStock(product.id);
        }
        
        const stockStatus = getStockStatus(stock);
        
        // Get unit display
        const unitDisplay = unit ? getUnitDisplay(unit) : (productType === 'item' || isComposed ? 'pcs' : '-');
        
        // Type badge
        let typeBadge = '📦 Item';
        if (productType === 'service') typeBadge = '🛠️ Service';
        else if (productType === 'raw_material') typeBadge = '🧱 Raw Material';
        else if (isComposed) typeBadge = '🍽️ Composed';
        
        // Check if current user is admin
        const isAdmin = typeof getCurrentUser === 'function' && getCurrentUser()?.role === 'admin';
        
        // Get category display name
        let categoryDisplay = product.category || '';
        if (window.categories && Array.isArray(window.categories)) {
            const cat = window.categories.find(c => c.name === product.category);
            if (cat && cat.displayName) {
                categoryDisplay = cat.displayName;
            }
        }
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${product.icon} ${product.name}</td>
            <td>${categoryDisplay}</td>
            <td><span style="font-size: 11px; opacity: 0.8;">${typeBadge}</span></td>
            <td>$${product.price.toFixed(2)}</td>
            <td>
                ${productType === 'service' ? 
                    '<span class="stock-badge" style="background: rgba(156, 39, 176, 0.2); color: #9C27B0;">N/A</span>' :
                    `<span class="stock-badge stock-${stockStatus.class}">${productType === 'raw_material' ? stock.toFixed(2) : stock} ${stockStatus.icon}</span>`
                }
            </td>
            <td>${unitDisplay}</td>
            <td>${productType === 'service' ? '-' : '$' + (stock * product.price).toFixed(2)}</td>
            <td>
                <div class="inventory-actions">
                    ${productType !== 'service' && isAdmin ? `
                        <button class="btn-adjust btn-damaged" onclick="recordDamagedStock(${product.id})" title="Record Damaged/Lost Stock (Admin Only)" style="background: rgba(244, 67, 54, 0.1); color: #f44336;">
                            🗑️
                        </button>
                    ` : ''}
                    <button class="btn-adjust" onclick="editProductFromInventory(${product.id})" title="Edit Product Details">
                        ✏️
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

/**
 * Get stock status
 */
function getStockStatus(stock) {
    const stockNum = parseInt(stock) || 0;
    if (stockNum <= 0) {
        return { class: 'out', icon: '❌', label: 'Out of Stock' };
    } else if (stockNum <= inventoryLowStockThreshold) {
        return { class: 'low', icon: '⚠️', label: 'Low Stock' };
    } else {
        return { class: 'good', icon: '✅', label: 'In Stock' };
    }
}

/**
 * Render low stock alerts
 */
function renderLowStockAlerts(products) {
    const alertsContainer = document.getElementById('low-stock-alerts');
    if (!alertsContainer) return;
    
    // Filter out services - they don't have stock
    const itemProducts = products.filter(p => p.type !== 'service');
    
    // Helper function to get actual stock (handles composed products)
    const getActualStock = (product) => {
        let stock = product.stock || 0;
        const isComposed = product.type === 'composed' || (product.has_recipe === 1 && product.type === 'item');
        if (isComposed && typeof window.calculateComposedProductStock === 'function') {
            stock = window.calculateComposedProductStock(product.id);
        }
        return parseInt(stock) || 0;
    };
    
    const lowStockProducts = itemProducts.filter(p => {
        const stock = getActualStock(p);
        return stock <= inventoryLowStockThreshold && stock > 0;
    });
    const outOfStockProducts = itemProducts.filter(p => {
        const stock = getActualStock(p);
        return stock <= 0;
    });
    
    if (lowStockProducts.length === 0 && outOfStockProducts.length === 0) {
        alertsContainer.innerHTML = '<div class="no-alerts">✅ All products have sufficient stock</div>';
        return;
    }
    
    let html = '';
    
    if (outOfStockProducts.length > 0) {
        html += '<div class="alert-section out-of-stock-section">';
        html += '<h4>❌ Out of Stock</h4>';
        outOfStockProducts.forEach(p => {
            const actualStock = getActualStock(p);
            html += `<div class="alert-item out">${p.icon} ${p.name} - <strong>${actualStock} units</strong></div>`;
        });
        html += '</div>';
    }
    
    if (lowStockProducts.length > 0) {
        html += '<div class="alert-section low-stock-section">';
        html += '<h4>⚠️ Low Stock</h4>';
        lowStockProducts.forEach(p => {
            const actualStock = getActualStock(p);
            html += `<div class="alert-item low">${p.icon} ${p.name} - <strong>${actualStock} units</strong></div>`;
        });
        html += '</div>';
    }
    
    alertsContainer.innerHTML = html;
}

/**
 * Adjust stock (add or remove)
 */
async function adjustStock(productId, action) {
    const amount = prompt(`Enter amount to ${action === 'add' ? 'add to' : 'remove from'} stock:`, '10');
    
    if (!amount || isNaN(amount) || parseInt(amount) <= 0) {
        return;
    }
    
    const quantity = parseInt(amount);
    const products = await loadProductsFromDB();
    const product = products.find(p => p.id === productId);
    
    if (!product) return;
    
    const currentStock = product.stock || 0;
    let newStock;
    
    if (action === 'add') {
        newStock = currentStock + quantity;
    } else {
        newStock = Math.max(0, currentStock - quantity);
    }
    
    await updateProductStock(productId, newStock, `Manual ${action}: ${quantity} units`);
    
    showInventoryNotification(`✅ Stock ${action === 'add' ? 'added' : 'removed'}: ${product.name}`);
    loadInventoryData();
}

/**
 * Record damaged/lost stock (Admin only)
 */
async function recordDamagedStock(productId) {
    // Admin check
    const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (!currentUser || currentUser.role !== 'admin') {
        alert('⛔ Admin access required to record damaged stock');
        return;
    }
    
    const products = await loadProductsFromDB();
    const product = products.find(p => p.id === productId);
    
    if (!product) return;
    
    const currentStock = product.stock || 0;
    
    if (currentStock === 0) {
        alert('⚠️ This product has no stock to record as damaged');
        return;
    }
    
    const quantity = prompt(`Record damaged/lost stock for ${product.name}\nCurrent stock: ${currentStock}\n\nEnter quantity damaged:`, '1');
    
    if (!quantity || isNaN(quantity) || parseInt(quantity) <= 0) {
        return;
    }
    
    const damagedQty = parseInt(quantity);
    
    if (damagedQty > currentStock) {
        alert(`⚠️ Cannot record ${damagedQty} units as damaged. Only ${currentStock} in stock.`);
        return;
    }
    
    const reason = prompt(`Reason for damaged/lost stock:\n(e.g., Broken, Expired, Lost, Theft)`, 'Damaged') || 'Damaged';
    
    const newStock = currentStock - damagedQty;
    
    await updateProductStock(productId, newStock, `Damaged/Lost: ${damagedQty} units - ${reason}`);
    
    showInventoryNotification(`🗑️ Recorded ${damagedQty} damaged: ${product.name}`);
    loadInventoryData();
}

/**
 * Edit product from inventory (opens product management with stock disabled)
 */
async function editProductFromInventory(productId) {
    // Check if openProductManagement and editProduct exist
    if (typeof openProductManagement === 'function' && typeof editProduct === 'function') {
        // Open the product management modal
        openProductManagement();
        
        // Small delay to ensure modal is open
        setTimeout(() => {
            // Call editProduct which will load the product into the form
            editProduct(productId);
            
            // Disable stock field (stock can only be changed via Receive Stock or sales)
            const stockInput = document.getElementById('product-stock-input');
            if (stockInput) {
                stockInput.setAttribute('readonly', true);
                stockInput.style.opacity = '0.6';
                stockInput.style.cursor = 'not-allowed';
                stockInput.title = 'Stock can only be changed via Receive Stock or sales';
            }
        }, 100);
    } else {
        alert('⚠️ Product management module not available');
    }
}

/**
 * Set stock to specific value
 */
async function setStock(productId) {
    const products = await loadProductsFromDB();
    const product = products.find(p => p.id === productId);
    
    if (!product) return;
    
    const currentStock = product.stock || 0;
    const newStock = prompt(`Set stock quantity for ${product.name}:`, currentStock.toString());
    
    if (newStock === null || isNaN(newStock) || parseInt(newStock) < 0) {
        return;
    }
    
    const quantity = parseInt(newStock);
    await updateProductStock(productId, quantity, `Stock set to ${quantity}`);
    
    showInventoryNotification(`✅ Stock updated: ${product.name} = ${quantity} units`);
    loadInventoryData();
}

/**
 * Update product stock in database
 */
async function updateProductStock(productId, newStock, reason = '') {
    if (!db) return;
    
    return new Promise(async (resolve, reject) => {
        try {
            // Get current product
            const products = await loadProductsFromDB();
            const product = products.find(p => p.id === productId);
            
            if (!product) {
                reject(new Error('Product not found'));
                return;
            }
            
            const oldStock = product.stock || 0;
            product.stock = newStock;
            
            // Direct SQL update - don't call updateProduct() as it reads from form inputs!
            try {
                if (typeof runExec === 'function') {
                    await runExec(
                        'UPDATE products SET stock = ?, updatedAt = ? WHERE id = ?',
                        [newStock, Date.now(), productId]
                    );
                    console.log(`✅ Stock updated in DB: ${product.name} = ${newStock}`);
                } else {
                    console.warn('⚠️ runExec not available, skipping stock update');
                }
                
                // Log stock change
                await logStockChange(productId, product.name, oldStock, newStock, reason);
                
                // Log activity
                if (typeof logActivity === 'function') {
                    await logActivity('stock_update', `${product.name}: ${oldStock} → ${newStock} (${reason})`);
                }
                
                // Update global products array
                await reloadProducts();
                
                resolve();
            } catch (error) {
                console.error('Failed to update stock:', error);
                reject(error);
            }
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Log stock change to history
 */
async function logStockChange(productId, productName, oldStock, newStock, reason) {
    if (!db) return;
    
    const user = getCurrentUser ? getCurrentUser() : null;
    
    const stockChange = {
        id: Date.now(),
        productId: productId,
        productName: productName,
        oldStock: oldStock,
        newStock: newStock,
        change: newStock - oldStock,
        reason: reason,
        timestamp: new Date().toISOString(),
        user: user ? {
            id: user.id,
            username: user.username,
            name: user.name
        } : null
    };
    
    try {
        // Use SQL.js database
        if (typeof runExec === 'function') {
            await runExec(
                `INSERT INTO stock_history (productId, timestamp, oldStock, newStock, quantity, reason, userId)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    productId,
                    Date.now(),
                    oldStock,
                    newStock,
                    newStock - oldStock,
                    reason,
                    user ? user.id : null
                ]
            );
        } else {
            console.warn('⚠️ runExec not available, skipping stock history logging');
        }
    } catch (error) {
        console.error('Failed to log stock change:', error);
    }
}

/**
 * Deduct stock after sale
 */
async function deductStockAfterSale(cartItems, options = {}) {
    const { deferSave = false, skipLowStockCheck = false } = options;
    window.deductionCallCount = (window.deductionCallCount || 0) + 1;
    console.log('🔥 DEDUCTION CALL #' + window.deductionCallCount);
    console.log('📦 Deducting stock for', cartItems.length, 'items...');
    console.log('📋 Cart items:', JSON.stringify(cartItems.map(i => ({id: i.id, name: i.name, qty: i.quantity}))));
    
    for (const item of cartItems) {
        const products = await loadProductsFromDB();
        const product = products.find(p => p.id === item.id);
        
        if (!product) {
            console.warn(`⚠️ Product not found: ${item.name}`);
            continue;
        }
        
        // Check if this is a composed product with a recipe
        if (product.has_recipe === 1) {
            console.log(`🍽️ ${item.name} is a composed product - deducting ingredients...`);
            console.log(`   Selling ${item.quantity} unit(s) of ${item.name}`);
            
            // Get recipe ingredients (DISTINCT to handle duplicate entries)
            const recipeResult = db.exec(`
                SELECT DISTINCT raw_material_id, quantity
                FROM product_recipes
                WHERE product_id = ${item.id}
            `);
            
            console.log(`   Found ${recipeResult && recipeResult[0] ? recipeResult[0].values.length : 0} ingredients in recipe`);
            
            if (recipeResult && recipeResult[0] && recipeResult[0].values.length > 0) {
                // Deduct each ingredient
                for (const ingredientRow of recipeResult[0].values) {
                    const materialId = ingredientRow[0];
                    const quantityPerUnit = ingredientRow[1];
                    const totalQuantityNeeded = quantityPerUnit * item.quantity;
                    
                    console.log(`   🧮 Calculation: ${quantityPerUnit} (per unit) × ${item.quantity} (units sold) = ${totalQuantityNeeded} (to deduct)`);
                    
                    const material = products.find(p => p.id === materialId);
                    if (material) {
                        const currentStock = material.stock || 0;
                        const newStock = Math.max(0, currentStock - totalQuantityNeeded);
                        
                        console.log(`  • ${material.name}: ${currentStock} → ${newStock} (-${totalQuantityNeeded})`);
                        
                        await updateProductStock(
                            materialId,
                            newStock,
                            `Used in ${item.name} (sale: ${item.quantity} unit${item.quantity > 1 ? 's' : ''})`
                        );
                    }
                }
                
                // Save recipe snapshot for historical tracking
                await saveRecipeSnapshot(item.id, item.quantity);
                
                console.log(`✅ Deducted ingredients for ${item.name}`);
            } else {
                console.warn(`⚠️ No recipe found for ${item.name}`);
            }
        } else {
            // Regular product - deduct from its own stock
            const currentStock = product.stock || 0;
            const newStock = Math.max(0, currentStock - item.quantity);
            
            console.log(`📦 ${item.name}: ${currentStock} → ${newStock} (-${item.quantity})`);
            
            await updateProductStock(
                item.id,
                newStock,
                `Sale: ${item.quantity} unit${item.quantity > 1 ? 's' : ''} sold`
            );
        }
    }
    
    // Save database after all stock changes unless caller defers it
    if (!deferSave) {
        await saveDatabase();
    }

    console.log('✅ All stock deductions completed');
    
    // Check for low stock after sale unless explicitly skipped
    if (!skipLowStockCheck) {
        checkLowStock();
    }
}

/**
 * Save recipe snapshot for historical tracking
 */
async function saveRecipeSnapshot(productId, quantitySold) {
    // Skip recipe snapshots for now - table schema issue
    // TODO: Implement proper migration for sale_recipe_snapshots table
    return;
}

/**
 * Check for low stock and show notifications
 */
async function checkLowStock() {
    const products = await loadProductsFromDB();
    // Filter out services - they don't have stock
    const itemProducts = products.filter(p => p.type !== 'service');
    
    // Helper function to get actual stock (handles composed products)
    const getActualStock = (product) => {
        let stock = product.stock || 0;
        const isComposed = product.type === 'composed' || (product.has_recipe === 1 && product.type === 'item');
        if (isComposed && typeof window.calculateComposedProductStock === 'function') {
            stock = window.calculateComposedProductStock(product.id);
        }
        return parseInt(stock) || 0;
    };
    
    const lowStockProducts = itemProducts.filter(p => {
        const stock = getActualStock(p);
        return stock > 0 && stock <= inventoryLowStockThreshold;
    });
    
    const outOfStockProducts = itemProducts.filter(p => getActualStock(p) === 0);
    
    // Update header badge
    updateInventoryBadge(lowStockProducts.length + outOfStockProducts.length);
    
    // Show notification if there are low/out of stock items
    if (lowStockProducts.length > 0 || outOfStockProducts.length > 0) {
        const message = `⚠️ ${outOfStockProducts.length} out of stock, ${lowStockProducts.length} low stock`;
        console.warn('Inventory Alert:', message);
    }
}

/**
 * Update inventory button badge
 */
function updateInventoryBadge(count) {
    const inventoryBtn = document.getElementById('inventory-btn');
    if (!inventoryBtn) return;
    
    // Remove existing badge
    const existingBadge = inventoryBtn.querySelector('.inventory-badge');
    if (existingBadge) {
        existingBadge.remove();
    }
    
    // Add new badge if count > 0
    if (count > 0) {
        const badge = document.createElement('span');
        badge.className = 'inventory-badge';
        badge.textContent = count;
        inventoryBtn.appendChild(badge);
    }
}

/**
 * Show inventory notification
 */
function showInventoryNotification(message, type = 'success') {
    const existing = document.querySelector('.inventory-notification');
    if (existing) {
        existing.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `inventory-notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

/**
 * Export inventory report in multiple formats
 */
async function exportInventory(format) {
    try {
        const products = await loadProductsFromDB();
        
        // Prepare export data
        const exportData = products.map(product => {
            const stock = product.stock || 0;
            const productType = product.type || 'item';
            const unit = product.unit || '';
            const unitDisplay = unit ? getUnitDisplay(unit) : (productType === 'item' ? 'pcs' : '-');
            const value = productType === 'service' ? 0 : stock * product.price;
            const status = productType === 'service' ? 'Service' : getStockStatus(stock).label;
            
            // Type label
            let typeLabel = 'Item';
            if (productType === 'service') typeLabel = 'Service';
            else if (productType === 'raw_material') typeLabel = 'Raw Material';
            
            // Stock display - services don't have stock
            let stockDisplay;
            if (productType === 'service') {
                stockDisplay = '-'; // Services don't have stock
            } else if (productType === 'raw_material') {
                stockDisplay = parseFloat(stock.toFixed(2));
            } else {
                stockDisplay = stock;
            }
            
            return {
                'product': product.name,
                'category': product.category,
                'type': typeLabel,
                'price': product.price,
                'stock': stockDisplay,
                'unit': productType === 'service' ? '-' : unitDisplay,
                'value': value,
                'status': status
            };
        });
        
        const filename = `inventory-report-${new Date().toISOString().split('T')[0]}`;
        
        // Export based on format
        switch (format) {
            case 'csv':
                if (typeof exportToCSV === 'function') {
                    const csvColumns = [
                        {header: 'Product', key: 'product'},
                        {header: 'Category', key: 'category'},
                        {header: 'Type', key: 'type'},
                        {header: 'Price', key: 'price'},
                        {header: 'Stock', key: 'stock'},
                        {header: 'Unit', key: 'unit'},
                        {header: 'Value', key: 'value'},
                        {header: 'Status', key: 'status'}
                    ];
                    exportToCSV(exportData, csvColumns, filename);
                    showInventoryNotification('✅ Inventory exported as CSV');
                } else {
                    console.error('exportToCSV function not found');
                    showInventoryNotification('❌ Export utilities not loaded', 'error');
                }
                break;
                
            case 'excel':
                if (typeof exportToExcel === 'function') {
                    const excelColumns = [
                        {header: 'Product', key: 'product', width: 25},
                        {header: 'Category', key: 'category', width: 15},
                        {header: 'Type', key: 'type', width: 12},
                        {header: 'Price', key: 'price', width: 12, type: 'currency'},
                        {header: 'Stock', key: 'stock', width: 10, type: 'number'},
                        {header: 'Unit', key: 'unit', width: 10},
                        {header: 'Value', key: 'value', width: 12, type: 'currency'},
                        {header: 'Status', key: 'status', width: 12}
                    ];
                    exportToExcel(exportData, excelColumns, filename, 'Inventory Report');
                    showInventoryNotification('✅ Inventory exported as Excel');
                } else {
                    console.error('exportToExcel function not found');
                    showInventoryNotification('❌ Export utilities not loaded', 'error');
                }
                break;
                
            case 'pdf':
                if (typeof exportToPDF === 'function') {
                    const pdfColumns = [
                        {header: 'Product', dataKey: 'product'},
                        {header: 'Category', dataKey: 'category'},
                        {header: 'Type', dataKey: 'type'},
                        {header: 'Price', dataKey: 'price'},
                        {header: 'Stock', dataKey: 'stock'},
                        {header: 'Unit', dataKey: 'unit'},
                        {header: 'Value', dataKey: 'value'},
                        {header: 'Status', dataKey: 'status'}
                    ];
                    exportToPDF(exportData, pdfColumns, 'Inventory Report', filename);
                    showInventoryNotification('✅ Inventory exported as PDF');
                } else {
                    console.error('exportToPDF function not found');
                    showInventoryNotification('❌ Export utilities not loaded', 'error');
                }
                break;
                
            default:
                showInventoryNotification('❌ Invalid export format', 'error');
        }
        
    } catch (error) {
        console.error('Error exporting inventory:', error);
        showInventoryNotification('❌ Failed to export inventory', 'error');
    }
}

/**
 * Helper function to get unit display string
 */
function getUnitDisplay(unit) {
    const unitMap = {
        'kg': 'kg',
        'g': 'g',
        'litre': 'L',
        'ml': 'mL',
        'meter': 'm',
        'cm': 'cm',
        'pieces': 'pcs'
    };
    return unitMap[unit] || unit || 'pcs';
}

/**
 * Legacy CSV export function (kept for backwards compatibility)
 */
async function exportInventoryCSV() {
    await exportInventory('csv');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInventory);
} else {
    initInventory();
}

console.log('✅ Inventory module loaded');
