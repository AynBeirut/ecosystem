/**
 * Refunds Module
 * Handle refund processing with user authentication and stock restoration
 */

console.log('🔄 Loading refunds.js...');

try {

// Debounce utility to prevent excessive function calls
function debounce(func, delay = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, delay);
    };
}

/**
 * Show refund modal
 */
function showRefundModal() {
    const modal = document.getElementById('refund-modal');
    if (!modal) {
        console.error('❌ Refund modal not found');
        return;
    }
    
    renderRefundSearchForm();
    modal.classList.add('active');
    modal.style.display = 'block';
}

/**
 * Close refund modal
 */
function closeRefundModal() {
    const modal = document.getElementById('refund-modal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
}

/**
 * Render refund search form
 */
function renderRefundSearchForm() {
    const content = document.getElementById('refund-content');
    if (!content) return;
    
    content.innerHTML = `
        <div class="refund-search">
            <h3>↩️ Process Refund</h3>
            <p>Browse or search for the sale to refund</p>
            
            <div class="filter-tabs" style="display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap;">
                <button onclick="filterSalesByPeriod('today')" class="btn-filter active" data-period="today">📅 Today</button>
                <button onclick="filterSalesByPeriod('yesterday')" class="btn-filter" data-period="yesterday">Yesterday</button>
                <button onclick="filterSalesByPeriod('week')" class="btn-filter" data-period="week">📊 Last Week</button>
                <button onclick="filterSalesByPeriod('month')" class="btn-filter" data-period="month">📆 Last Month</button>
                <button onclick="filterSalesByPeriod('year')" class="btn-filter" data-period="year">📈 Last Year</button>
            </div>
            
            <div class="search-filters" style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                    <div class="form-group">
                        <label for="refund-search-receipt">🧾 Receipt Number</label>
                        <input type="text" id="refund-search-receipt" placeholder="Search by receipt..." onkeyup="searchSalesForRefund()">
                    </div>
                    
                    <div class="form-group">
                        <label for="refund-search-customer">👤 Customer Name</label>
                        <input type="text" id="refund-search-customer" placeholder="Search by name..." onkeyup="searchSalesForRefund()">
                    </div>
                    
                    <div class="form-group">
                        <label for="refund-search-phone">📞 Phone</label>
                        <input type="tel" id="refund-search-phone" placeholder="Phone number..." onkeyup="searchSalesForRefund()">
                    </div>
                    
                    <div class="form-group">
                        <label for="refund-search-date">📅 Specific Date</label>
                        <input type="date" id="refund-search-date" onchange="searchSalesForRefund()">
                    </div>
                </div>
            </div>
            
            <div id="refund-search-results" style="margin-top: 20px;">
                <div style="text-align: center; padding: 20px; color: #666;">
                    <div class="spinner"></div>
                    Loading sales...
                </div>
            </div>
        </div>
        
        <style>
            .btn-filter {
                padding: 8px 16px;
                border: 2px solid #ddd;
                background: white;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s;
            }
            .btn-filter:hover {
                background: #f0f0f0;
            }
            .btn-filter.active {
                background: #4CAF50;
                color: white;
                border-color: #4CAF50;
            }
            .spinner {
                border: 3px solid #f3f3f3;
                border-top: 3px solid #4CAF50;
                border-radius: 50%;
                width: 30px;
                height: 30px;
                animation: spin 1s linear infinite;
                margin: 0 auto;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;
    
    // Auto-load today's sales
    filterSalesByPeriod('today');
}

let currentPeriod = 'today';
let currentSearchFilters = {};
let currentPage = 0;
const ITEMS_PER_PAGE = 20;

function isRefundLedgerSale(sale) {
    if (!sale) {
        return false;
    }

    const paymentMethod = String(sale.paymentMethod || '').trim().toUpperCase();
    if (paymentMethod === 'REFUND') {
        return true;
    }

    try {
        const totals = typeof sale.totals === 'string' ? JSON.parse(sale.totals) : sale.totals;
        return (parseFloat(totals?.total) || 0) < 0;
    } catch (_error) {
        return false;
    }
}

/**
 * Filter sales by time period
 */
function filterSalesByPeriod(period) {
    currentPeriod = period;
    
    // Update active button
    document.querySelectorAll('.btn-filter').forEach(btn => {
        if (btn.dataset.period === period) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Load sales for this period
    searchSalesForRefund();
}

/**
 * Search sales for refund
 */
async function searchSalesForRefund(page = 0) {
    try {
        currentPage = page;
        const receipt = document.getElementById('refund-search-receipt')?.value.trim() || '';
        const customer = document.getElementById('refund-search-customer')?.value.trim() || '';
        const phone = document.getElementById('refund-search-phone')?.value.trim() || '';
        const specificDate = document.getElementById('refund-search-date')?.value || '';
        
        let query = "SELECT * FROM sales WHERE 1=1 AND UPPER(COALESCE(paymentMethod, '')) != 'REFUND'";
        const params = [];
        
        // Period filter - use local timezone midnight
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        today.setHours(0, 0, 0, 0); // Ensure midnight
        
        console.log('🔍 REFUND DEBUG - Current period:', currentPeriod);
        console.log('📅 Now:', now.toString());
        console.log('📅 Today midnight:', today.toString(), 'Timestamp:', today.getTime());
        
        if (currentPeriod === 'today') {
            const todayStart = today.getTime();
            const todayEnd = new Date(today);
            todayEnd.setHours(23, 59, 59, 999);
            console.log('✅ TODAY filter - Start:', new Date(todayStart).toString(), 'End:', todayEnd.toString());
            console.log('📊 Timestamp range:', todayStart, 'to', todayEnd.getTime());
            // Handle both ISO string and numeric timestamps
            query += ` AND (
                (TYPEOF(timestamp) = 'integer' AND timestamp >= ? AND timestamp <= ?) OR
                (TYPEOF(timestamp) = 'text' AND strftime('%s', timestamp) * 1000 >= ? AND strftime('%s', timestamp) * 1000 <= ?)
            )`;
            params.push(todayStart, todayEnd.getTime(), todayStart, todayEnd.getTime());
        } else if (currentPeriod === 'yesterday') {
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            yesterday.setHours(0, 0, 0, 0);
            const yesterdayStart = yesterday.getTime();
            const yesterdayEnd = new Date(yesterday);
            yesterdayEnd.setHours(23, 59, 59, 999);
            console.log('✅ YESTERDAY filter - Start:', yesterday.toString(), 'End:', yesterdayEnd.toString());
            console.log('📊 Timestamp range:', yesterdayStart, 'to', yesterdayEnd.getTime());
            // Handle both ISO string and numeric timestamps
            query += ` AND (
                (TYPEOF(timestamp) = 'integer' AND timestamp >= ? AND timestamp <= ?) OR
                (TYPEOF(timestamp) = 'text' AND strftime('%s', timestamp) * 1000 >= ? AND strftime('%s', timestamp) * 1000 <= ?)
            )`;
            params.push(yesterdayStart, yesterdayEnd.getTime(), yesterdayStart, yesterdayEnd.getTime());
        } else if (currentPeriod === 'week') {
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            const weekStart = weekAgo.getTime();
            // Handle both ISO string and numeric timestamps
            query += ` AND (
                (TYPEOF(timestamp) = 'integer' AND timestamp >= ?) OR
                (TYPEOF(timestamp) = 'text' AND strftime('%s', timestamp) * 1000 >= ?)
            )`;
            params.push(weekStart, weekStart);
        } else if (currentPeriod === 'month') {
            const monthAgo = new Date(today);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            const monthStart = monthAgo.getTime();
            // Handle both ISO string and numeric timestamps
            query += ` AND (
                (TYPEOF(timestamp) = 'integer' AND timestamp >= ?) OR
                (TYPEOF(timestamp) = 'text' AND strftime('%s', timestamp) * 1000 >= ?)
            )`;
            params.push(monthStart, monthStart);
        } else if (currentPeriod === 'year') {
            const yearAgo = new Date(today);
            yearAgo.setFullYear(yearAgo.getFullYear() - 1);
            const yearStart = yearAgo.getTime();
            // Handle both ISO string and numeric timestamps
            query += ` AND (
                (TYPEOF(timestamp) = 'integer' AND timestamp >= ?) OR
                (TYPEOF(timestamp) = 'text' AND strftime('%s', timestamp) * 1000 >= ?)
            )`;
            params.push(yearStart, yearStart);
        }
        // 'all' - no time filter
        
        // Search filters
        if (receipt) {
            query += ' AND (CAST(receiptNumber AS TEXT) LIKE ? OR CAST(id AS TEXT) LIKE ?)';
            params.push(`%${receipt}%`, `%${receipt}%`);
        }
        
        if (customer) {
            query += ' AND customerInfo LIKE ?';
            params.push(`%${customer}%`);
        }
        
        if (phone) {
            query += ' AND customerInfo LIKE ?';
            params.push(`%${phone}%`);
        }
        
        if (specificDate) {
            const dateStart = new Date(specificDate).setHours(0,0,0,0);
            const dateEnd = new Date(specificDate).setHours(23,59,59,999);
            query += ' AND timestamp >= ? AND timestamp <= ?';
            params.push(dateStart, dateEnd);
        }
        
        // Get total count for pagination
        const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
        const countResult = await runQuery(countQuery, params);
        const totalCount = countResult[0]?.total || 0;
        const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
        
        // Add pagination
        query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
        params.push(ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
        
        console.log('📋 Final query:', query);
        console.log('📋 Query params:', params);
        
        const sales = await runQuery(query, params);
        
        console.log('📊 Sales found:', sales?.length || 0);
        if (sales && sales.length > 0) {
            console.log('🔍 First 3 sales timestamps:');
            sales.slice(0, 3).forEach(sale => {
                console.log(`  Sale #${sale.receiptNumber}: timestamp=${sale.timestamp}, date=${new Date(sale.timestamp).toString()}`);
            });
        }
        
        const resultsDiv = document.getElementById('refund-search-results');
        if (!sales || sales.length === 0) {
            resultsDiv.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #888;">
                    <div style="font-size: 48px; margin-bottom: 15px;">📭</div>
                    <h3>No Sales Found</h3>
                    <p>No sales match your search criteria for the selected period.</p>
                </div>
            `;
            return;
        }
        
        // Calculate totals
        let totalAmount = 0;
        sales.forEach(sale => {
            const totals = typeof sale.totals === 'string' ? JSON.parse(sale.totals) : sale.totals;
            totalAmount += totals.total || 0;
        });
        
        // Build sale cards using array for better performance
        const saleCards = sales.map(sale => {
            const totals = typeof sale.totals === 'string' ? JSON.parse(sale.totals) : sale.totals;
            const items = typeof sale.items === 'string' ? JSON.parse(sale.items) : sale.items;
            const saleDate = new Date(sale.timestamp);
            const hasRefund = sale.refundId !== null && sale.refundId !== undefined;
            
            // Extract customer info from JSON
            let customerName = 'Walk-in Customer';
            let customerPhone = '';
            if (sale.customerInfo) {
                try {
                    const custData = typeof sale.customerInfo === 'string' ? JSON.parse(sale.customerInfo) : sale.customerInfo;
                    customerName = custData.name || 'Walk-in Customer';
                    customerPhone = custData.phone || '';
                } catch (e) {
                    console.warn('Failed to parse customer info for display');
                }
            }
            
            const itemsList = items.slice(0, 3).map(item => {
                const hasItemRefund = item.refundedQuantity && item.refundedQuantity > 0;
                const remaining = hasItemRefund ? item.quantity : item.originalQuantity || item.quantity;
                const refunded = item.refundedQuantity || 0;
                const original = item.originalQuantity || (hasItemRefund ? remaining + refunded : item.quantity);
                
                if (hasItemRefund) {
                    return `• ${item.name}: <span style="color: #999; text-decoration: line-through;">${original}</span> → <span style="color: #f57c00;">${refunded} refunded</span>, <span style="color: #4caf50;">${remaining} remaining</span>`;
                } else {
                    return `• ${item.name} x${item.quantity}`;
                }
            }).join('<br>');
            
            const moreItemsText = items.length > 3 ? `<br>• <em>...and ${items.length - 3} more items</em>` : '';
            
            return `
                <div class="sale-card" style="border: 2px solid ${hasRefund ? '#ff9800' : '#e0e0e0'}; padding: 15px; margin-bottom: 12px; border-radius: 8px; background: ${hasRefund ? '#fff3e0' : 'white'}; transition: all 0.2s;" onmouseover="this.style.borderColor='${hasRefund ? '#f57c00' : '#4CAF50'}'" onmouseout="this.style.borderColor='${hasRefund ? '#ff9800' : '#e0e0e0'}'">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div style="flex: 1;">
                            <div style="font-size: 18px; font-weight: bold; color: #333; margin-bottom: 6px;">
                                🧾 Receipt #${sale.receiptNumber || sale.id}
                                ${hasRefund ? '<span style="color: #f57c00; font-size: 14px; margin-left: 8px;">↩️ REFUNDED</span>' : ''}
                            </div>
                            <div style="font-size: 13px; color: #666; margin-bottom: 4px;">
                                📅 ${saleDate.toLocaleDateString()} at ${saleDate.toLocaleTimeString()}
                            </div>
                            <div style="font-size: 14px; margin-bottom: 4px;">
                                👤 ${customerName} ${customerPhone ? `📞 ${customerPhone}` : ''}
                            </div>
                            <div style="font-size: 13px; color: #666; margin-top: 8px;">
                                🛒 ${items.length} item(s) • 💳 ${sale.paymentMethod || 'Cash'}
                            </div>
                            <div style="margin-top: 8px; padding: 8px; background: #f5f5f5; border-radius: 4px; font-size: 12px; color: #333;">
                                ${itemsList}${moreItemsText}
                            </div>
                        </div>
                        <div style="text-align: right; margin-left: 20px;">
                            <div style="font-size: 24px; font-weight: bold; color: ${hasRefund ? '#f57c00' : '#2e7d32'}; margin-bottom: 10px;">
                                $${totals.total.toFixed(2)}
                            </div>
                            <button onclick="selectSaleForRefund(${sale.id})" class="btn-primary" style="padding: 10px 20px; font-size: 14px; white-space: nowrap;" ${hasRefund ? 'disabled' : ''}>
                                ${hasRefund ? '✅ Refunded' : '↩️ Refund'}
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        
        // Pagination controls
        const paginationHtml = totalPages > 1 ? `
            <div style="display: flex; justify-content: center; align-items: center; gap: 10px; margin-top: 20px; padding: 15px;">
                <button onclick="searchSalesForRefund(${page - 1})" class="btn-secondary" style="padding: 8px 16px;" ${page === 0 ? 'disabled' : ''}>
                    ← Previous
                </button>
                <span style="color: #666; font-size: 14px;">
                    Page ${page + 1} of ${totalPages} (${totalCount} total sales)
                </span>
                <button onclick="searchSalesForRefund(${page + 1})" class="btn-secondary" style="padding: 8px 16px;" ${page >= totalPages - 1 ? 'disabled' : ''}>
                    Next →
                </button>
            </div>
        ` : '';
        
        resultsDiv.innerHTML = `
            <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong style="font-size: 18px;">${totalCount} Sales Found</strong>
                    <div style="color: #666; font-size: 14px; margin-top: 4px;">
                        Period: ${getPeriodLabel(currentPeriod)} • Showing ${sales.length} on this page
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 24px; font-weight: bold; color: #2e7d32;">
                        $${totalAmount.toFixed(2)}
                    </div>
                    <div style="color: #666; font-size: 13px;">Page Total</div>
                </div>
            </div>
            
            <div class="sales-list">
                ${saleCards.join('')}
            </div>
            
            ${paginationHtml}
        `;
    } catch (error) {
        console.error('❌ Search failed:', error);
        const resultsDiv = document.getElementById('refund-search-results');
        if (resultsDiv) {
            resultsDiv.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #d32f2f;">
                    <div style="font-size: 48px; margin-bottom: 15px;">⚠️</div>
                    <h3>Search Failed</h3>
                    <p>${error.message}</p>
                </div>
            `;
        }
    }
}

/**
 * Get period label for display
 */
function getPeriodLabel(period) {
    const labels = {
        'today': 'Today',
        'yesterday': 'Yesterday',
        'week': 'Last 7 Days',
        'month': 'Last 30 Days',
        'year': 'Last 365 Days',
        'all': 'All Time'
    };
    return labels[period] || period;
}

/**
 * Update refund total based on selected quantities
 */
// Enhanced updateRefundTotal to ensure accurate totals and dynamic updates
function updateRefundTotal(saleId) {
    const sale = window.currentRefundSale;
    if (!sale) return;

    const totals = typeof sale.totals === 'string' ? JSON.parse(sale.totals) : sale.totals;
    const items = typeof sale.items === 'string' ? JSON.parse(sale.items) : sale.items;

    let refundSubtotal = 0;

    items.forEach((item, index) => {
        const checkbox = document.getElementById(`refund-item-${index}`);
        const qtyInput = document.getElementById(`refund-qty-${index}`);
        
        if (qtyInput) {
            const selectedQty = parseInt(qtyInput.value) || 0;

            // Ensure selected quantity does not exceed available quantity
            if (selectedQty > item.quantity) {
                qtyInput.value = item.quantity;
            }

            // Only add to total if checkbox is checked
            const itemTotal = item.price * selectedQty;
            if (checkbox && checkbox.checked) {
                refundSubtotal += itemTotal;
            }

            // Update individual item total display
            const itemTotalEl = document.getElementById(`item-total-${index}`);
            if (itemTotalEl) {
                itemTotalEl.textContent = itemTotal.toFixed(2);
            }
        }
    });

    // Calculate proportional tax
    const taxRate = totals.subtotal > 0 ? totals.tax / totals.subtotal : 0;
    const refundTax = refundSubtotal * taxRate;
    const refundTotal = refundSubtotal + refundTax;

    // Update total display
    const totalEl = document.getElementById('refund-total-amount');
    if (totalEl) {
        totalEl.textContent = refundTotal.toFixed(2);
    }
}

// Create debounced version for quantity input changes
const debouncedUpdateRefundTotal = debounce(updateRefundTotal, 300);

/**
 * Toggle item selection UI for partial refunds
 */
function toggleItemSelection(saleId) {
    const refundType = document.getElementById('refund-type').value;
    const itemsDiv = document.getElementById('refund-items-selection');
    
    if (refundType === 'partial') {
        itemsDiv.style.display = 'block';
    } else {
        itemsDiv.style.display = 'none';
    }
    
    updatePartialRefundTotal(saleId);
}

/**
 * Update partial refund total based on selected items
 */
function updatePartialRefundTotal(saleId) {
    const sale = window.currentRefundSale;
    if (!sale) return;
    
    const items = typeof sale.items === 'string' ? JSON.parse(sale.items) : sale.items;
    const totals = typeof sale.totals === 'string' ? JSON.parse(sale.totals) : sale.totals;
    
    let subtotal = 0;
    for (let i = 0; i < items.length; i++) {
        const checkbox = document.getElementById(`refund-item-${i}`);
        const qtyInput = document.getElementById(`refund-qty-${i}`);
        
        if (checkbox && checkbox.checked) {
            // Use the quantity from the input field, not the original quantity
            const selectedQty = qtyInput ? parseInt(qtyInput.value) || 0 : items[i].quantity;
            subtotal += items[i].price * selectedQty;
        }
    }
    
    // Apply proportional tax if original sale had tax
    let total = subtotal;
    if (totals.tax > 0) {
        const taxRate = totals.tax / totals.subtotal;
        total = subtotal * (1 + taxRate);
    }
    
    const totalDisplay = document.getElementById('partial-refund-total');
    if (totalDisplay) {
        totalDisplay.textContent = `$${total.toFixed(2)}`;
    }
}

/**
 * Select sale for refund and authenticate user
 */
async function selectSaleForRefund(saleId) {
    try {
        const sale = await runQuery('SELECT * FROM sales WHERE id = ?', [saleId]);
        if (!sale || sale.length === 0) {
            alert('❌ Sale not found');
            return;
        }

        if (isRefundLedgerSale(sale[0])) {
            alert('❌ Refund transactions cannot be refunded again');
            return;
        }
        
        // Store sale for updateRefundTotal function
        window.currentRefundSale = sale[0];
        
        // Show authentication modal
        showRefundAuthModal(sale[0]);
    } catch (error) {
        console.error('❌ Failed to select sale:', error);
        alert('Error: ' + error.message);
    }
}

/**
 * Show refund authentication modal
 */
function showRefundAuthModal(sale) {
    const content = document.getElementById('refund-content');
    if (!content) return;
    
    const totals = typeof sale.totals === 'string' ? JSON.parse(sale.totals) : sale.totals;
    const items = typeof sale.items === 'string' ? JSON.parse(sale.items) : sale.items;
    
    // Get customer info from customerInfo JSON field
    let customerName = 'Walk-in';
    let customerPhone = '';
    
    if (sale.customerInfo) {
        try {
            const customerData = typeof sale.customerInfo === 'string' 
                ? JSON.parse(sale.customerInfo) 
                : sale.customerInfo;
            customerName = customerData.name || 'Walk-in';
            customerPhone = customerData.phone || '';
        } catch (e) {
            console.warn('Failed to parse customer info:', e);
        }
    }
    
    console.log('✅ Final customer data:', JSON.stringify({ customerName, customerPhone }, null, 2));
    
    // Get current user
    const currentUser = getCurrentUser ? getCurrentUser() : null;
    const isAdminOrManager = currentUser && (currentUser.role === 'admin' || currentUser.role === 'manager');
    
    content.innerHTML = `
        <div class="refund-auth">
            <h3>↩️ Process Refund</h3>
            <p>${isAdminOrManager ? 'Review and approve refund request' : 'Manager approval required for refund'}</p>
            
            <div class="sale-summary" style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 2px solid #ffc107;">
                <h4 style="margin-top: 0; color: #333;">Sale Details</h4>
                <div style="color: #333;"><strong>Receipt:</strong> ${sale.receiptNumber || sale.id}</div>
                <div style="color: #333;"><strong>Date:</strong> ${new Date(sale.timestamp).toLocaleString()}</div>
                <div style="color: #333;"><strong>Customer:</strong> ${customerName}${customerPhone ? ` (${customerPhone})` : ''}</div>
                <div style="color: #333;"><strong>Original Total:</strong> $${totals.total.toFixed(2)}</div>
                <div style="margin-top: 10px; color: #333;">
                    <strong>Items:</strong>
                    <div id="refund-items-list" style="margin-top: 5px;">
                        ${items.map((item, index) => `
                            <div style="padding: 8px; background: white; margin: 5px 0; border-radius: 4px; border: 1px solid #ddd;">
                                <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                                    <input type="checkbox" id="refund-item-${index}" value="${index}" checked 
                                           onchange="updateRefundTotal(${sale.id})" 
                                           style="width: 18px; height: 18px; cursor: pointer;">
                                    <div style="flex: 1;">
                                        <strong>${item.name}</strong> - $${item.price.toFixed(2)} each
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <label style="margin: 0;">Qty:</label>
                                        <input type="number" id="refund-qty-${index}" 
                                               min="0" max="${item.quantity}" value="${item.quantity}" 
                                               style="width: 60px; padding: 4px; border: 1px solid #ccc; border-radius: 4px;"
                                               oninput="debouncedUpdateRefundTotal(${sale.id})">
                                        <span style="color: #666;">/ ${item.quantity}</span>
                                        <div style="min-width: 80px; text-align: right; font-weight: bold;">
                                            $<span id="item-total-${index}">${(item.price * item.quantity).toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div style="margin-top: 15px; padding: 10px; background: #d1ecf1; border-radius: 4px; border: 2px solid #0c5460;">
                    <strong style="color: #0c5460;">Refund Total: $<span id="refund-total-amount">${totals.total.toFixed(2)}</span></strong>
                </div>
            </div>
            
            ${!isAdminOrManager ? `
            <div class="form-group">
                <label for="refund-auth-username">Manager/Admin Username *</label>
                <input type="text" id="refund-auth-username" placeholder="Enter manager username" required autofocus>
            </div>
            
            <div class="form-group">
                <label for="refund-auth-password">Password *</label>
                <input type="password" id="refund-auth-password" placeholder="Password" required>
            </div>
            ` : `
            <div style="padding: 10px; background: #d4edda; border: 1px solid #c3e6cb; border-radius: 4px; margin-bottom: 15px; color: #155724;">
                ✅ You are authorized as <strong>${currentUser.name}</strong> (${currentUser.role})
            </div>
            `}
            
            <div class="form-group">
                <label for="refund-reason">Reason for Refund *</label>
                <select id="refund-reason" class="form-control" required onchange="toggleCustomReasonInput()">
                    <option value="damaged">🔨 Item is damaged/defective</option>
                    <option value="not-wanted">❌ Not what I wanted</option>
                    <option value="wrong-item">📦 Wrong item delivered</option>
                    <option value="expired">⏰ Item expired/outdated</option>
                    <option value="quality">⭐ Poor quality</option>
                    <option value="customer-request">👤 Customer changed mind</option>
                    <option value="duplicate">📋 Duplicate order</option>
                    <option value="pricing-error">💰 Pricing error</option>
                    <option value="other">📝 Other (please specify)</option>
                </select>
            </div>
            <div class="form-group" id="custom-reason-container" style="display: none;">
                <label for="custom-reason">Custom Reason</label>
                <textarea id="custom-reason" class="form-control" rows="3" placeholder="Explain the reason..."></textarea>
            </div>
            
            
            <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button onclick="authenticateAndProcessRefund(${sale.id})" class="btn-primary">✅ Approve & Process Refund</button>
                <button onclick="renderRefundSearchForm()" class="btn-secondary">Cancel</button>
            </div>
        </div>
    `;
}

/**
 * Toggle custom reason input visibility
 */
function toggleCustomReasonInput() {
    const reasonSelect = document.getElementById('refund-reason');
    const customReasonContainer = document.getElementById('custom-reason-container');

    if (reasonSelect && customReasonContainer) {
        customReasonContainer.style.display = reasonSelect.value === 'other' ? 'block' : 'none';
    }
}

/**
 * Authenticate and process refund
 */
async function authenticateAndProcessRefund(saleId) {
    try {
        const reason = document.getElementById('refund-reason').value.trim();
        
        if (!reason) {
            alert('❌ Please provide a reason for the refund');
            return;
        }
        
        // Get current user
        const currentUser = getCurrentUser ? getCurrentUser() : null;
        const isAdminOrManager = currentUser && (currentUser.role === 'admin' || currentUser.role === 'manager');
        
        let authenticatedUser = currentUser;
        
        // If user is not admin/manager, verify credentials
        if (!isAdminOrManager) {
            const username = document.getElementById('refund-auth-username').value.trim();
            const password = document.getElementById('refund-auth-password').value;
            
            if (!username || !password) {
                alert('❌ Manager credentials required');
                return;
            }
            
            // Authenticate manager
            const users = runQuery('SELECT * FROM users WHERE username = ?', [username]);
            if (!users || users.length === 0) {
                alert('❌ User not found');
                return;
            }
            
            const user = users[0];
            
            // Verify role (only admin or manager can approve refunds)
            if (user.role !== 'admin' && user.role !== 'manager') {
                alert('❌ Only managers and administrators can approve refunds');
                return;
            }
            
            // Verify password
            if (user.password !== password) {
                alert('❌ Incorrect password');
                return;
            }
            
            authenticatedUser = user;
        }
        
        // Get sale details
        const sale = runQuery('SELECT * FROM sales WHERE id = ?', [saleId])[0];
        if (!sale) {
            alert('❌ Sale not found');
            return;
        }

        if (isRefundLedgerSale(sale)) {
            alert('❌ Refund transactions cannot be refunded again');
            return;
        }

        if (sale.refundId !== null && sale.refundId !== undefined) {
            alert('❌ This sale has already been refunded');
            return;
        }
        
        const totals = typeof sale.totals === 'string' ? JSON.parse(sale.totals) : sale.totals;
        const allItems = typeof sale.items === 'string' ? JSON.parse(sale.items) : sale.items;
        
        // Calculate refund based on selected quantities
        let itemsToRefund = [];
        let refundSubtotal = 0;
        
        for (let i = 0; i < allItems.length; i++) {
            const qtyInput = document.getElementById(`refund-qty-${i}`);
            if (qtyInput) {
                const refundQty = parseInt(qtyInput.value) || 0;
                if (refundQty > 0) {
                    itemsToRefund.push({
                        ...allItems[i],
                        quantity: refundQty,
                        originalQuantity: allItems[i].quantity
                    });
                    refundSubtotal += allItems[i].price * refundQty;
                }
            }
        }
        
        if (itemsToRefund.length === 0) {
            alert('❌ Please select at least one item to refund');
            return;
        }
        
        // Calculate proportional tax
        const taxRate = totals.subtotal > 0 ? totals.tax / totals.subtotal : 0;
        const refundTax = refundSubtotal * taxRate;
        const refundAmount = refundSubtotal + refundTax;
        
        // Determine refund type
        const isFullRefund = itemsToRefund.length === allItems.length && 
                            itemsToRefund.every((item, i) => item.quantity === allItems[i].quantity);
        const refundType = isFullRefund ? 'full' : 'partial';
        
        // Process refund
        const refundData = {
            saleId: sale.id,
            originalSaleDate: sale.date,
            refundAmount: refundAmount,
            refundType: refundType,
            refundItems: JSON.stringify(itemsToRefund),
            reason: reason,
            approvedBy: authenticatedUser.id,
            approverUsername: authenticatedUser.username,
            approverRole: authenticatedUser.role,
            processedBy: currentUser?.username || authenticatedUser.username,
            timestamp: Date.now(),
            receiptNumber: await getNextRefundReceiptNumber(),
            paymentMethod: sale.paymentMethod,
            notes: `${refundType === 'partial' ? 'Partial ' : ''}Refund for receipt ${sale.receiptNumber || sale.id}`
        };
        
        // BEGIN TRANSACTION - Ensure atomic operation
        try {
            if (typeof beginTransaction === 'function') {
                await beginTransaction();
            }
            
            // Save refund record
            await runExec(`
                INSERT INTO refunds (saleId, originalSaleDate, refundAmount, refundType, refundItems, reason, 
                                     approvedBy, approverUsername, approverRole, processedBy, timestamp, 
                                     receiptNumber, paymentMethod, notes, synced)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
            `, [
                refundData.saleId,
                refundData.originalSaleDate,
                refundData.refundAmount,
                refundData.refundType,
                refundData.refundItems,
                refundData.reason,
                refundData.approvedBy,
                refundData.approverUsername,
                refundData.approverRole,
                refundData.processedBy,
                refundData.timestamp,
                refundData.receiptNumber,
                refundData.paymentMethod,
                refundData.notes
            ]);
            
            // Get the refund ID that was just inserted
            const refundIdResult = runQuery('SELECT last_insert_rowid() as id');
            const refundId = refundIdResult[0]?.id;
            
            // Restore stock for refunded items with proper logging (only for physical products)
            for (const item of itemsToRefund) {
                if (item.type !== 'service') {
                    // Get current stock
                    const productResult = runQuery('SELECT stock, name FROM products WHERE id = ?', [item.id]);
                    if (productResult && productResult.length > 0) {
                        const oldStock = productResult[0].stock || 0;
                        const newStock = oldStock + item.quantity;
                        
                        // Update stock
                        await runExec(
                            'UPDATE products SET stock = ?, updatedAt = ? WHERE id = ?',
                            [newStock, Date.now(), item.id]
                        );
                        
                        // Log to stock_history with type='refund'
                        await runExec(
                            `INSERT INTO stock_history (productId, timestamp, oldStock, newStock, quantity, reason, type, userId)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                            [
                                item.id,
                                Date.now(),
                                oldStock,
                                newStock,
                                item.quantity,
                                `Refund: ${item.name} x${item.quantity} - Receipt ${refundData.receiptNumber}`,
                                'refund',
                                authenticatedUser.id
                            ]
                        );
                        
                        console.log(`✅ Stock restored: ${productResult[0].name} ${oldStock} → ${newStock} (+${item.quantity})`);
                    }
                }
            }
            
            // Update original sale record to link to refund and adjust item quantities
            if (refundType === 'partial') {
                // Update item quantities to show what was refunded
                const updatedItems = allItems.map((item) => {
                    const refundedItem = itemsToRefund.find(r => r.id === item.id);
                    if (refundedItem) {
                        return {
                            ...item,
                            quantity: item.quantity - refundedItem.quantity,
                            originalQuantity: item.quantity,
                            refundedQuantity: refundedItem.quantity
                        };
                    }
                    return item;
                });
                
                await runExec(
                    'UPDATE sales SET items = ?, refundId = ?, refundedAt = ? WHERE id = ?',
                    [JSON.stringify(updatedItems), refundId, Date.now(), saleId]
                );
                
                console.log(`✅ Updated original sale #${saleId} with refund details`);
            } else {
                // Full refund - just link to refund record
                await runExec(
                    'UPDATE sales SET refundId = ?, refundedAt = ? WHERE id = ?',
                    [refundId, Date.now(), saleId]
                );
            }
            
            // Create negative sale entry for accounting
            const negativeSale = {
                ...sale,
                id: Date.now(),
                timestamp: Date.now(),
                date: new Date().toLocaleDateString(),
                totals: JSON.stringify({
                    ...totals,
                    total: -refundAmount,
                    subtotal: -refundSubtotal,
                    tax: -refundTax
                }),
                paymentMethod: 'REFUND',
                notes: `Refund of receipt ${sale.receiptNumber || sale.id} - Approved by ${authenticatedUser.username}`
            };
            
            await runExec(`
                INSERT INTO sales (timestamp, date, items, totals, paymentMethod, customerInfo, 
                                  receiptNumber, cashierName, cashierId, notes, synced)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
            `, [
                negativeSale.timestamp,
                negativeSale.date,
                JSON.stringify(itemsToRefund),
                negativeSale.totals,
                negativeSale.paymentMethod,
                negativeSale.customerInfo || null,
                refundData.receiptNumber,
                negativeSale.cashierName,
                negativeSale.cashierId,
                negativeSale.notes
            ]);
            
            // COMMIT TRANSACTION
            if (typeof commit === 'function') {
                await commit();
            }
            
            console.log('✅ Refund transaction completed successfully');
            
        } catch (transactionError) {
            // ROLLBACK on error
            console.error('❌ Refund transaction failed:', transactionError);
            if (typeof rollback === 'function') {
                await rollback();
            }
            alert(`❌ Refund failed: ${transactionError.message}`);
            return;
        }
        
        // Log activity
        if (typeof logActivity === 'function') {
            await logActivity('refund', `Processed refund $${totals.total.toFixed(2)} - Approved by ${authenticatedUser.username} - ${reason}`);
        }

        if (typeof window.invalidateReportsCache === 'function') {
            window.invalidateReportsCache();
        }
        
        // Show success and print refund receipt
        alert(`✅ Refund Processed Successfully\n\nAmount: $${refundAmount.toFixed(2)}\nReceipt: ${refundData.receiptNumber}\nType: ${refundType === 'full' ? 'Full' : 'Partial'}\n\nStock has been restored.`);
        
        // Print refund receipt
        printRefundReceipt(refundData, sale);
        
        closeRefundModal();
        
    } catch (error) {
        console.error('❌ Refund failed:', error);
        alert('Refund failed: ' + error.message);
    }
}

/**
 * Print refund receipt
 */
function printRefundReceipt(refundData, originalSale) {
    // Reuse existing receipt printing with negative amounts
    if (typeof showReceipt === 'function') {
        const totals = typeof originalSale.totals === 'string' ? JSON.parse(originalSale.totals) : originalSale.totals;
        const items = typeof originalSale.items === 'string' ? JSON.parse(originalSale.items) : originalSale.items;
        
        const refundReceiptData = {
            ...originalSale,
            receiptNumber: refundData.receiptNumber,
            timestamp: refundData.timestamp,
            items: items,
            totals: {
                subtotal: -totals.subtotal,
                tax: -totals.tax,
                total: -totals.total
            },
            paymentMethod: 'REFUND',
            notes: `REFUND - Original: ${originalSale.receiptNumber || originalSale.id}\nReason: ${refundData.reason}\nApproved by: ${refundData.approverUsername}`
        };
        
        showReceipt(refundReceiptData);
    }
}

// Export functions
window.showRefundModal = showRefundModal;
window.closeRefundModal = closeRefundModal;
window.searchSalesForRefund = searchSalesForRefund;
window.selectSaleForRefund = selectSaleForRefund;
window.authenticateAndProcessRefund = authenticateAndProcessRefund;
window.toggleItemSelection = toggleItemSelection;
window.updatePartialRefundTotal = updatePartialRefundTotal;
window.updateRefundTotal = updateRefundTotal;
window.debouncedUpdateRefundTotal = debouncedUpdateRefundTotal;

// Attach menu button click handler when script loads
const refundBtn = document.getElementById('refund-btn');
if (refundBtn) {
    refundBtn.addEventListener('click', () => {
        console.log('🔄 Refund button clicked!');
        showRefundModal();
    });
    console.log('✅ Refund menu button handler attached');
}

} catch (error) {
    console.error('❌ Error loading refunds.js:', error);
    console.error('Stack:', error.stack);
}

console.log('✅ Refunds.js loaded successfully');
