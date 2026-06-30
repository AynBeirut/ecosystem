// ===================================
// SUPPLIER BALANCE MANAGEMENT
// Real-time balance tracking with caching
// ===================================

/**
 * Format currency for display
 */
function formatCurrency(amount) {
    return `$${(amount || 0).toFixed(2)}`;
}

// Update queue for batch processing
let balanceUpdateQueue = new Set();
let balanceUpdateTimer = null;
let isProcessingBalances = false;

/**
 * Add supplier to update queue with smart debouncing
 */
function queueSupplierBalanceUpdate(supplierId) {
    balanceUpdateQueue.add(supplierId);
    
    // Clear existing timer
    if (balanceUpdateTimer) {
        clearTimeout(balanceUpdateTimer);
    }
    
    // Determine debounce delay based on queue size
    const delay = balanceUpdateQueue.size >= 10 ? 2500 : 500;
    
    balanceUpdateTimer = setTimeout(() => {
        processBatchBalanceUpdates();
    }, delay);
}

/**
 * Process queued balance updates in batch
 */
async function processBatchBalanceUpdates() {
    if (isProcessingBalances || balanceUpdateQueue.size === 0) {
        return;
    }
    
    isProcessingBalances = true;
    const supplierIds = Array.from(balanceUpdateQueue);
    balanceUpdateQueue.clear();
    
    try {
        // Show loading indicator
        showBalanceLoadingIndicator(`Processing ${supplierIds.length} balance updates...`);
        
        console.log(`📊 Batch updating ${supplierIds.length} supplier balances...`);
        
        for (const supplierId of supplierIds) {
            await updateSupplierBalance(supplierId);
        }
        
        console.log(`✅ Batch update complete for ${supplierIds.length} suppliers`);
        
        // Emit event for real-time updates
        document.dispatchEvent(new CustomEvent('balanceUpdated', { 
            detail: { supplierIds } 
        }));
        
        // Show success notification
        showNotification('Balance cache refreshed', 'success');
        
    } catch (error) {
        console.error('❌ Batch balance update failed:', error);
        showNotification('Failed to update balances: ' + error.message, 'error');
    } finally {
        isProcessingBalances = false;
        hideBalanceLoadingIndicator();
    }
}

/**
 * Calculate and cache single supplier balance
 */
async function updateSupplierBalance(supplierId) {
    try {
        // Check if new schema exists
        const hasNewSchema = runQuery(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='supplier_balances_cache'
        `).length > 0;
        
        if (!hasNewSchema) {
            console.warn('⚠️ Migration 017 not applied yet - balance cache not available');
            return null;
        }
        
        // Calculate total purchases
        const purchases = runQuery(`
            SELECT 
                COALESCE(SUM(totalAmount), 0) as total_purchases,
                MAX(deliveryDate) as last_delivery_date
            FROM deliveries 
            WHERE supplierId = ?
        `, [supplierId]);
        
        // Calculate total payments
        const payments = runQuery(`
            SELECT 
                COALESCE(SUM(amount), 0) as total_paid,
                MAX(paidAt) as last_payment_date
            FROM supplier_payments 
            WHERE supplierId = ?
        `, [supplierId]);
        
        const totalPurchases = purchases[0]?.total_purchases || 0;
        const totalPaid = payments[0]?.total_paid || 0;
        const balanceOwed = totalPurchases - totalPaid;
        const lastDeliveryDate = purchases[0]?.last_delivery_date || null;
        const lastPaymentDate = payments[0]?.last_payment_date || null;
        
        // Update cache
        runQuery(`
            INSERT OR REPLACE INTO supplier_balances_cache 
            (supplier_id, total_purchases, total_paid, balance_owed, last_delivery_date, last_payment_date, last_updated, cache_expires_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now', '+24 hours'))
        `, [supplierId, totalPurchases, totalPaid, balanceOwed, lastDeliveryDate, lastPaymentDate]);
        
        console.log(`✅ Updated balance for supplier ${supplierId}: purchases=$${totalPurchases}, paid=$${totalPaid}, owed=$${balanceOwed}`);
        
        return { totalPurchases, totalPaid, balanceOwed, lastDeliveryDate, lastPaymentDate };
        
    } catch (error) {
        console.error(`❌ Failed to update balance for supplier ${supplierId}:`, error);
        throw error;
    }
}

/**
 * Refresh all supplier balances
 */
async function refreshSupplierBalances() {
    // Use the full recalculation function for accuracy
    await recalculateAllSupplierBalances();
}

/**
 * Legacy balance loading for pre-migration 017 databases
 */
function loadSupplierBalancesLegacy() {
    try {
        console.log('📊 Loading balances using legacy method (no cache)...');
        
        // Get all suppliers
        const suppliers = runQuery('SELECT * FROM suppliers');
        
        if (!suppliers || suppliers.length === 0) {
            console.log('ℹ️ No suppliers found');
            // Update UI with zeros
            document.getElementById('total-supplier-debt').textContent = formatCurrency(0);
            document.getElementById('total-paid-amount').textContent = formatCurrency(0);
            document.getElementById('total-purchases-amount').textContent = formatCurrency(0);
            
            const balanceList = document.getElementById('supplier-balance-list');
            if (balanceList) {
                balanceList.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--light-grey);">No suppliers found</td></tr>';
            }
            return;
        }
        
        const balances = suppliers.map(supplier => {
            // Calculate purchases
            const purchases = runQuery(`
                SELECT COALESCE(SUM(totalAmount), 0) as total
                FROM deliveries
                WHERE supplierId = ?
            `, [supplier.id]);
            
            // Calculate payments  
            const payments = runQuery(`
                SELECT COALESCE(SUM(amount), 0) as total
                FROM supplier_payments
                WHERE supplierId = ?
            `, [supplier.id]);
            
            // Calculate returns (handle missing table)
            let totalReturns = 0;
            try {
                const returns = runQuery(`
                    SELECT COALESCE(SUM(returnAmount), 0) as total
                    FROM purchase_returns pr
                    JOIN deliveries d ON pr.deliveryId = d.id
                    WHERE d.supplierId = ?
                `, [supplier.id]);
                totalReturns = returns[0]?.total || 0;
            } catch (error) {
                // Purchase returns table doesn't exist yet
                if (!error.message || !error.message.includes('no such table')) {
                    console.error('Error loading purchase returns for supplier', supplier.id, error);
                }
                totalReturns = 0;
            }
            
            const totalPurchases = purchases[0]?.total || 0;
            const totalPaid = payments[0]?.total || 0;
            const balanceOwed = totalPurchases - totalPaid - totalReturns;
            
            return {
                id: supplier.id,
                name: supplier.name,
                total_purchases: totalPurchases,
                total_paid: totalPaid,
                balance_owed: balanceOwed,
                status: balanceOwed === 0 ? 'PAID' : 'CURRENT'
            };
        });
        
        // Calculate totals
        const totalDebt = balances.reduce((sum, b) => sum + b.balance_owed, 0);
        const totalPaid = balances.reduce((sum, b) => sum + b.total_paid, 0);
        const totalPurchases = balances.reduce((sum, b) => sum + b.total_purchases, 0);
        
        // Update UI
        document.getElementById('total-supplier-debt').textContent = formatCurrency(totalDebt);
        document.getElementById('total-paid-amount').textContent = formatCurrency(totalPaid);
        document.getElementById('total-purchases-amount').textContent = formatCurrency(totalPurchases);
        
        const balanceList = document.getElementById('supplier-balance-list');
        if (!balanceList) return;
        
        if (balances.length === 0) {
            balanceList.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--light-grey);">No suppliers found</td></tr>';
            return;
        }
        
        balanceList.innerHTML = balances.map(balance => `
            <tr>
                <td>${escapeHtml(balance.name)}</td>
                <td>${formatCurrency(balance.total_purchases)}</td>
                <td>${formatCurrency(balance.total_paid)}</td>
                <td style="font-weight: bold; color: ${balance.balance_owed > 0 ? '#f44336' : '#4caf50'}">
                    ${formatCurrency(balance.balance_owed)}
                </td>
                <td>${getSupplierStatusBadge(balance.status)}</td>
                <td>
                    ${balance.balance_owed > 0 ? `
                        <button class="btn-primary" onclick="openSupplierPaymentModal(${balance.id}, '${escapeHtml(balance.name)}', ${balance.balance_owed})" style="font-size: 0.85em; padding: 6px 12px;">
                            💰 Pay
                        </button>
                    ` : '—'}
                </td>
            </tr>
        `).join('');
        
        console.log(`✅ Loaded ${balances.length} supplier balances (legacy method)`);
        
    } catch (error) {
        console.error('❌ Failed to load supplier balances (legacy):', error);
        showNotification('Failed to load balances: ' + error.message, 'error');
    }
}

/**
 * Load supplier balances into Payments tab
 */
function loadSupplierBalances() {
    try {
        // FORCE LEGACY METHOD - Always calculate directly from transactions
        // Cache system has timing issues with real-time updates
        console.log('📊 Using direct calculation (legacy method) for real-time accuracy');
        loadSupplierBalancesLegacy();
        return;
        
        /* Cache-based method disabled for real-time accuracy
        // Check if new schema exists
        let hasNewSchema = false;
        try {
            const result = runQuery(`
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='supplier_balances_cache'
            `);
            hasNewSchema = result && result.length > 0;
        } catch (schemaCheckError) {
            console.warn('⚠️ Schema check failed, using legacy method:', schemaCheckError.message);
            hasNewSchema = false;
        }
        
        if (!hasNewSchema) {
            console.warn('⚠️ Migration 017 not applied - using legacy calculation');
            loadSupplierBalancesLegacy();
            return;
        }
        */
        
        // Check for stale caches (don't auto-refresh to avoid loops)
        const staleCount = runQuery(`
            SELECT COUNT(*) as count 
            FROM supplier_balances_cache 
            WHERE cache_expires_at < datetime('now')
        `)[0]?.count || 0;
        
        if (staleCount > 0) {
            console.log(`ℹ️ Found ${staleCount} stale cache entries (will refresh on next supplier action)`);
            // Don't auto-refresh here to avoid page reload loops
            // Stale caches will be refreshed when user interacts with suppliers
        }
        
        // Load supplier balances with status
        const balances = runQuery(`
            SELECT 
                s.id,
                s.name,
                s.payment_terms_days,
                COALESCE(sbc.total_purchases, 0) as total_purchases,
                COALESCE(sbc.total_paid, 0) as total_paid,
                COALESCE(sbc.balance_owed, 0) as balance_owed,
                sbc.last_delivery_date,
                CASE 
                    WHEN sbc.last_delivery_date IS NOT NULL THEN
                        date(sbc.last_delivery_date, '+' || s.payment_terms_days || ' days')
                    ELSE NULL
                END as due_date,
                CASE
                    WHEN sbc.balance_owed = 0 THEN 'PAID'
                    WHEN sbc.last_delivery_date IS NOT NULL AND 
                         date(sbc.last_delivery_date, '+' || s.payment_terms_days || ' days') < date('now') 
                         AND sbc.balance_owed > 0 
                    THEN 'OVERDUE'
                    WHEN sbc.last_delivery_date IS NOT NULL AND 
                         date(sbc.last_delivery_date, '+' || s.payment_terms_days || ' days') BETWEEN date('now') AND date('now', '+7 days')
                         AND sbc.balance_owed > 0
                    THEN 'DUE_SOON'
                    ELSE 'CURRENT'
                END as status
            FROM suppliers s
            LEFT JOIN supplier_balances_cache sbc ON s.id = sbc.supplier_id
            ORDER BY sbc.balance_owed DESC, s.name
        `);
        
        // Calculate totals
        const totalDebt = balances.reduce((sum, b) => sum + (b.balance_owed || 0), 0);
        const totalPaid = balances.reduce((sum, b) => sum + (b.total_paid || 0), 0);
        const totalPurchases = balances.reduce((sum, b) => sum + (b.total_purchases || 0), 0);
        
        // Update summary cards
        document.getElementById('total-supplier-debt').textContent = formatCurrency(totalDebt);
        document.getElementById('total-paid-amount').textContent = formatCurrency(totalPaid);
        document.getElementById('total-purchases-amount').textContent = formatCurrency(totalPurchases);
        
        // Populate balance table
        const balanceList = document.getElementById('supplier-balance-list');
        if (!balanceList) return;
        
        if (balances.length === 0) {
            balanceList.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--light-grey);">No suppliers found</td></tr>';
            return;
        }
        
        balanceList.innerHTML = balances.map(balance => `
            <tr>
                <td>${escapeHtml(balance.name)}</td>
                <td>${formatCurrency(balance.total_purchases)}</td>
                <td>${formatCurrency(balance.total_paid)}</td>
                <td style="font-weight: bold; color: ${balance.balance_owed > 0 ? '#f44336' : '#4caf50'}">
                    ${formatCurrency(balance.balance_owed)}
                </td>
                <td>${getSupplierStatusBadge(balance.status)}</td>
                <td>
                    ${balance.balance_owed > 0 ? `
                        <button class="btn-primary" onclick="openSupplierPaymentModal(${balance.id}, '${escapeHtml(balance.name)}', ${balance.balance_owed})" style="font-size: 0.85em; padding: 6px 12px;">
                            💰 Pay
                        </button>
                    ` : '—'}
                </td>
            </tr>
        `).join('');
        
        console.log(`✅ Loaded ${balances.length} supplier balances`);
        
    } catch (error) {
        console.error('❌ Failed to load supplier balances:', error);
        showNotification('Failed to load balances: ' + error.message, 'error');
    }
}

/**
 * Get status badge HTML with SVG
 */
function getSupplierStatusBadge(status) {
    const badges = {
        'PAID': '<span class="status-badge paid" style="background: #4caf50; color: white; padding: 4px 10px; border-radius: 4px; font-size: 0.85em; font-weight: bold; display: inline-flex; align-items: center; gap: 5px;"><svg width="12" height="12" viewBox="0 0 12 12"><path fill="white" d="M5 9L2 6l1-1 2 2 4-4 1 1z"/></svg>PAID</span>',
        'OVERDUE': '<span class="status-badge overdue" style="background: #f44336; color: white; padding: 4px 10px; border-radius: 4px; font-size: 0.85em; font-weight: bold; display: inline-flex; align-items: center; gap: 5px;"><svg width="12" height="12" viewBox="0 0 12 12"><circle fill="white" cx="6" cy="6" r="5"/></svg>OVERDUE</span>',
        'DUE_SOON': '<span class="status-badge due-soon" style="background: #ff9800; color: white; padding: 4px 10px; border-radius: 4px; font-size: 0.85em; font-weight: bold; display: inline-flex; align-items: center; gap: 5px;"><svg width="12" height="12" viewBox="0 0 12 12"><circle fill="white" cx="6" cy="6" r="5"/></svg>DUE SOON</span>',
        'CURRENT': '<span class="status-badge current" style="background: #2196f3; color: white; padding: 4px 10px; border-radius: 4px; font-size: 0.85em; font-weight: bold;">CURRENT</span>'
    };
    return badges[status] || badges['CURRENT'];
}

/**
 * Get client status badge HTML with SVG
 */
function getClientStatusBadge(daysSinceVisit, activeThreshold = 30, occasionalThreshold = 90) {
    if (daysSinceVisit === null) {
        return '<span class="status-badge never" style="background: #9e9e9e; color: white; padding: 4px 10px; border-radius: 4px; font-size: 0.85em; font-weight: bold;">NEVER VISITED</span>';
    }
    
    if (daysSinceVisit <= activeThreshold) {
        return '<span class="status-badge active" style="background: #4caf50; color: white; padding: 4px 10px; border-radius: 4px; font-size: 0.85em; font-weight: bold; display: inline-flex; align-items: center; gap: 5px;"><svg width="12" height="12" viewBox="0 0 12 12"><circle fill="white" cx="6" cy="6" r="5"/></svg>ACTIVE (&lt;' + activeThreshold + ' days)</span>';
    } else if (daysSinceVisit <= occasionalThreshold) {
        return '<span class="status-badge occasional" style="background: #ff9800; color: white; padding: 4px 10px; border-radius: 4px; font-size: 0.85em; font-weight: bold; display: inline-flex; align-items: center; gap: 5px;"><svg width="12" height="12" viewBox="0 0 12 12"><circle fill="white" cx="6" cy="6" r="5"/></svg>OCCASIONAL (' + daysSinceVisit + ' days)</span>';
    } else {
        return '<span class="status-badge inactive" style="background: #f44336; color: white; padding: 4px 10px; border-radius: 4px; font-size: 0.85em; font-weight: bold; display: inline-flex; align-items: center; gap: 5px;"><svg width="12" height="12" viewBox="0 0 12 12"><circle fill="white" cx="6" cy="6" r="5"/></svg>INACTIVE (' + daysSinceVisit + '+ days)</span>';
    }
}

/**
 * Open payment modal with pre-filled supplier info
 */
function openSupplierPaymentModal(supplierId, supplierName, balanceOwed) {
    const modal = document.getElementById('make-payment-modal');
    if (!modal) return;
    
    // Pre-fill form
    document.getElementById('payment-supplier-id').value = supplierId;
    document.getElementById('payment-supplier-name').value = supplierName;
    document.getElementById('payment-supplier-balance').value = formatCurrency(balanceOwed);
    document.getElementById('payment-amount').value = balanceOwed.toFixed(2);
    
    // Clear other fields
    document.getElementById('payment-method').value = 'Cash';
    document.getElementById('payment-reference').value = '';
    document.getElementById('payment-notes').value = '';
    
    // Show modal
    modal.style.display = 'block';
    
    // Focus on amount field
    setTimeout(() => {
        document.getElementById('payment-amount').focus();
        document.getElementById('payment-amount').select();
    }, 100);
}

/**
 * Show balance loading indicator
 */
function showBalanceLoadingIndicator(message = 'Processing balance updates...') {
    const indicator = document.getElementById('balance-loading-indicator');
    const text = document.getElementById('balance-loading-text');
    if (indicator) {
        indicator.style.display = 'block';
        if (text) text.textContent = message;
    }
}

/**
 * Hide balance loading indicator
 */
function hideBalanceLoadingIndicator() {
    const indicator = document.getElementById('balance-loading-indicator');
    if (indicator) {
        indicator.style.display = 'none';
    }
}

/**
 * Recalculate all supplier balances from transaction data
 * Fixes incorrect cached balance values in suppliers table
 */
async function recalculateAllSupplierBalances() {
    try {
        showBalanceLoadingIndicator('Recalculating all supplier balances from transactions...');
        console.log('🔄 Starting full supplier balance recalculation...');
        
        // Get all suppliers
        const suppliers = runQuery('SELECT id, name FROM suppliers');
        
        if (!suppliers || suppliers.length === 0) {
            console.log('ℹ️ No suppliers to recalculate');
            hideBalanceLoadingIndicator();
            return;
        }
        
        let updatedCount = 0;
        let errors = [];
        
        for (const supplier of suppliers) {
            try {
                // Calculate total purchases (deliveries)
                const purchases = runQuery(`
                    SELECT COALESCE(SUM(totalAmount), 0) as total
                    FROM deliveries
                    WHERE supplierId = ?
                `, [supplier.id]);
                
                // Calculate total payments
                const payments = runQuery(`
                    SELECT COALESCE(SUM(amount), 0) as total
                    FROM supplier_payments
                    WHERE supplierId = ?
                `, [supplier.id]);
                
                // Calculate returns (reduce what we owe)
                let totalReturns = 0;
                try {
                    const returns = runQuery(`
                        SELECT COALESCE(SUM(returnAmount), 0) as total
                        FROM purchase_returns pr
                        JOIN deliveries d ON pr.deliveryId = d.id
                        WHERE d.supplierId = ?
                    `, [supplier.id]);
                    totalReturns = returns[0]?.total || 0;
                } catch (e) {
                    // Table doesn't exist yet
                    totalReturns = 0;
                }
                
                const totalPurchases = purchases[0]?.total || 0;
                const totalPaid = payments[0]?.total || 0;
                
                // Balance calculation: negative means we owe them money
                // purchases - payments - returns = what we still owe
                const correctBalance = -(totalPurchases - totalPaid - totalReturns);
                
                // Update suppliers table with correct balance
                runQuery(`
                    UPDATE suppliers 
                    SET balance = ?, updatedAt = ?
                    WHERE id = ?
                `, [correctBalance, Date.now(), supplier.id]);
                
                // Update cache table if it exists
                try {
                    runQuery(`
                        INSERT OR REPLACE INTO supplier_balances_cache 
                        (supplier_id, total_purchases, total_paid, balance_owed, last_updated, cache_expires_at)
                        VALUES (?, ?, ?, ?, datetime('now'), datetime('now', '+24 hours'))
                    `, [supplier.id, totalPurchases, totalPaid, Math.abs(correctBalance)]);
                } catch (e) {
                    // Cache table doesn't exist, skip
                }
                
                console.log(`✅ ${supplier.name}: Purchases=$${totalPurchases.toFixed(2)}, Paid=$${totalPaid.toFixed(2)}, Balance=$${correctBalance.toFixed(2)}`);
                updatedCount++;
                
            } catch (error) {
                console.error(`❌ Error recalculating balance for ${supplier.name}:`, error);
                errors.push({ supplier: supplier.name, error: error.message });
            }
        }
        
        hideBalanceLoadingIndicator();
        
        if (errors.length === 0) {
            showNotification(`✅ Recalculated ${updatedCount} supplier balances successfully`, 'success');
            console.log(`✅ Balance recalculation complete: ${updatedCount} suppliers updated`);
        } else {
            showNotification(`⚠️ Recalculated ${updatedCount} balances, ${errors.length} errors`, 'warning');
            console.warn('⚠️ Some balances failed:', errors);
        }
        
        // Reload the display
        loadSupplierBalances();
        
        // Save database
        await saveDatabase();
        
    } catch (error) {
        console.error('❌ Failed to recalculate supplier balances:', error);
        showNotification('Failed to recalculate balances: ' + error.message, 'error');
        hideBalanceLoadingIndicator();
    }
}

/**
 * Listen for balance update events
 */
document.addEventListener('balanceUpdated', (e) => {
    console.log('📢 Balance update event received:', e.detail);
    
    // Reload balances if on Payments tab
    const paymentsTab = document.getElementById('payments-tab');
    if (paymentsTab && paymentsTab.classList.contains('active')) {
        loadSupplierBalances();
    }
    
    // Show subtle notification
    showNotification('Balances updated', 'info', 2000);
});

/**
 * Auto-recalculate supplier balances on database ready
 */
document.addEventListener('db-ready', async () => {
    console.log('🔄 Database ready - checking supplier balances...');
    
    // Small delay to ensure all modules loaded
    setTimeout(async () => {
        try {
            // Check if we have suppliers
            const suppliers = runQuery('SELECT COUNT(*) as count FROM suppliers');
            const supplierCount = suppliers[0]?.count || 0;
            
            if (supplierCount > 0) {
                console.log(`📊 Found ${supplierCount} suppliers - recalculating balances...`);
                await recalculateAllSupplierBalances();
            }
        } catch (error) {
            console.error('❌ Auto-recalculation failed:', error);
        }
    }, 2000);
});

// Export functions globally
window.recalculateAllSupplierBalances = recalculateAllSupplierBalances;
window.refreshSupplierBalances = refreshSupplierBalances;
window.loadSupplierBalances = loadSupplierBalances;
window.queueSupplierBalanceUpdate = queueSupplierBalanceUpdate;

console.log('✅ Supplier balance management loaded');
