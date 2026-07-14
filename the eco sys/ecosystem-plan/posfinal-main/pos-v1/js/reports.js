/**
 * Sales Reports & Analytics Module
 * Displays sales statistics, charts, and transaction history with advanced filtering
 */

console.log('📊 reports.js loaded');

// ===================================
// CONTEXT MANAGEMENT
// ===================================

// Track which container we're rendering to (modal or admin dashboard)
let currentReportsContainer = null;

// Store selected filter values separately to prevent loss during dropdown repopulation
let selectedFilters = {
    productId: null,
    productName: null,
    customerId: null
};

let currentRefundMetadata = {
    byRefundId: new Map(),
    bySaleId: new Map()
};

function formatLocalDateForInput(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        return '';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseLocalDateInput(value, endOfDay = false) {
    if (!value) {
        return null;
    }

    const [year, month, day] = String(value).split('-').map(Number);
    if (!year || !month || !day) {
        return null;
    }

    return endOfDay
        ? new Date(year, month - 1, day, 23, 59, 59, 999)
        : new Date(year, month - 1, day, 0, 0, 0, 0);
}

function getSaleTimestampValue(sale) {
    const rawTimestamp = sale?.timestamp;
    if (typeof rawTimestamp === 'number') {
        return rawTimestamp;
    }

    const parsedTimestamp = new Date(rawTimestamp).getTime();
    return Number.isFinite(parsedTimestamp) ? parsedTimestamp : 0;
}

function sortSalesByTimestampDesc(sales) {
    return [...sales].sort((a, b) => getSaleTimestampValue(b) - getSaleTimestampValue(a));
}

function getStartOfCurrentWeek(date) {
    const startDate = new Date(date);
    const dayOfWeek = startDate.getDay();
    const offset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    startDate.setDate(startDate.getDate() + offset);
    startDate.setHours(0, 0, 0, 0);
    return startDate;
}

function normalizeFilterText(value) {
    return String(value || '').trim().toLowerCase();
}

function getSelectedProductName(selectElement) {
    const selectedOption = selectElement?.selectedOptions?.[0];
    const optionLabel = selectedOption?.textContent || '';
    return optionLabel ? optionLabel.split(' - $')[0].trim() : null;
}

function syncCurrentReportFilterSelections() {
    const container = currentReportsContainer || document.getElementById('reports-modal');
    const customerSelect = container?.querySelector('#filter-customer');
    const productSelect = container?.querySelector('#filter-product');

    selectedFilters.customerId = customerSelect?.value?.trim() || null;
    selectedFilters.productId = productSelect?.value?.trim() || null;
    selectedFilters.productName = selectedFilters.productId ? getSelectedProductName(productSelect) : null;

    return {
        customerId: selectedFilters.customerId,
        productId: selectedFilters.productId,
        productName: selectedFilters.productName
    };
}

function matchesActiveProductFilter(item) {
    if (!activeFilters?.productId) {
        return true;
    }

    const filterProductId = parseInt(activeFilters.productId, 10);
    const itemId = parseInt(item?.id ?? item?.productId, 10);
    if (Number.isFinite(filterProductId) && Number.isFinite(itemId) && itemId === filterProductId) {
        return true;
    }

    const filterProductName = normalizeFilterText(activeFilters.productName);
    const itemName = normalizeFilterText(item?.name);
    return !!filterProductName && itemName === filterProductName;
}

function filterItemsByActiveProduct(items = []) {
    if (!activeFilters?.productId) {
        return items;
    }

    return items.filter(item => matchesActiveProductFilter(item));
}

function resetCurrentRefundMetadata() {
    currentRefundMetadata = {
        byRefundId: new Map(),
        bySaleId: new Map()
    };
}

async function loadRefundMetadataForSales(sales = []) {
    resetCurrentRefundMetadata();

    const saleIds = [...new Set(sales
        .map(sale => parseInt(sale?.id, 10))
        .filter(Number.isFinite))];
    const refundIds = [...new Set(sales
        .map(sale => parseInt(sale?.refundId, 10))
        .filter(Number.isFinite))];

    if (saleIds.length === 0 && refundIds.length === 0) {
        return currentRefundMetadata;
    }

    const clauses = [];
    const params = [];

    if (saleIds.length > 0) {
        clauses.push(`saleId IN (${saleIds.map(() => '?').join(', ')})`);
        params.push(...saleIds);
    }

    if (refundIds.length > 0) {
        clauses.push(`id IN (${refundIds.map(() => '?').join(', ')})`);
        params.push(...refundIds);
    }

    if (clauses.length === 0) {
        return currentRefundMetadata;
    }

    try {
        const refundRows = await runQuery(
            `SELECT id, saleId, refundType, refundAmount, timestamp FROM refunds WHERE ${clauses.join(' OR ')}`,
            params
        );

        refundRows.forEach(row => {
            const refundId = parseInt(row?.id, 10);
            const saleId = parseInt(row?.saleId, 10);

            if (Number.isFinite(refundId)) {
                currentRefundMetadata.byRefundId.set(refundId, row);
            }

            if (Number.isFinite(saleId)) {
                currentRefundMetadata.bySaleId.set(saleId, row);
            }
        });
    } catch (error) {
        console.warn('⚠️ Failed to load refund metadata for reports:', error.message);
    }

    return currentRefundMetadata;
}

function getRefundMetadataForSale(sale) {
    const refundId = parseInt(sale?.refundId, 10);
    const saleId = parseInt(sale?.id, 10);

    if (Number.isFinite(refundId) && currentRefundMetadata.byRefundId.has(refundId)) {
        return currentRefundMetadata.byRefundId.get(refundId);
    }

    if (Number.isFinite(saleId) && currentRefundMetadata.bySaleId.has(saleId)) {
        return currentRefundMetadata.bySaleId.get(saleId);
    }

    return null;
}

function isRefundLedgerSale(sale, parsedSale = null) {
    const parsed = parsedSale || getParsedSale(sale);
    const total = parseFloat(parsed?.totals?.total) || 0;
    return normalizeFilterText(sale?.paymentMethod) === 'refund' || total < 0;
}

function isFullyRefundedSale(sale, parsedSale = null) {
    if (isRefundLedgerSale(sale, parsedSale)) {
        return false;
    }

    return getRefundMetadataForSale(sale)?.refundType === 'full';
}

function getNetReportSales(sales = []) {
    return sales.filter(sale => {
        const parsed = getParsedSale(sale);
        return !isRefundLedgerSale(sale, parsed) && !isFullyRefundedSale(sale, parsed);
    });
}

function getNetReportItemsForSale(sale, items = null) {
    const parsed = getParsedSale(sale);
    const reportItems = items || parsed.items;

    if (isRefundLedgerSale(sale, parsed) || isFullyRefundedSale(sale, parsed)) {
        return [];
    }

    return reportItems;
}

function calculateItemMetrics(items = []) {
    return items.reduce((totals, item) => {
        const quantity = parseInt(item?.quantity, 10) || 0;
        const revenue = (parseFloat(item?.price) || 0) * quantity;
        const cost = (parseFloat(item?.cost) || 0) * quantity;

        totals.quantity += quantity;
        totals.revenue += revenue;
        totals.cost += cost;
        return totals;
    }, {
        quantity: 0,
        revenue: 0,
        cost: 0
    });
}

/**
 * Helper to find elements in the current context
 */
function getReportsElement(id) {
    if (currentReportsContainer) {
        return currentReportsContainer.querySelector(`#${id}`);
    }
    return document.getElementById(id);
}

// ===================================
// INLINE RENDERING IN ADMIN DASHBOARD
// ===================================

/**
 * Render reports inline in Admin Dashboard tab (like Balance tab)
 */
window.renderReportsInAdminTab = function() {
    console.log('📊 Rendering reports inline in Admin Dashboard');
    
    const container = document.getElementById('admin-reports-container');
    if (!container) {
        console.error('❌ admin-reports-container not found');
        return;
    }
    
    // Set the current context to admin container
    currentReportsContainer = container;
    console.log('📊 Set currentReportsContainer to admin-reports-container');
    
    // IMMEDIATE LOADING INDICATOR - Show before any heavy operations
    container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; min-height: 400px;">
            <div style="width: 50px; height: 50px; border: 4px solid #f3f3f3; border-top: 4px solid var(--primary-color, #4CAF50); border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px;"></div>
            <p style="color: var(--text-color); font-size: 16px; margin: 0;">Loading sales reports...</p>
            <p style="color: var(--light-grey); font-size: 14px; margin-top: 8px;">This may take a moment for large datasets</p>
        </div>
    `;
    
    // Use setTimeout to allow UI to update before heavy operations
    setTimeout(() => {
        // Get reports modal content
        const reportsModal = document.getElementById('reports-modal');
        if (!reportsModal) {
            console.error('❌ reports-modal not found');
            container.innerHTML = '<p style="color: #ff6b6b; text-align: center; padding: 40px;">Reports template not found</p>';
            return;
        }
        
        const reportsBody = reportsModal.querySelector('.reports-body');
        if (!reportsBody) {
            console.error('❌ reports-body not found');
            container.innerHTML = '<p style="color: #ff6b6b; text-align: center; padding: 40px;">Reports content not found</p>';
            return;
        }
        
        // Clone the reports content into admin container
        container.innerHTML = reportsBody.innerHTML;
        
        // Re-attach event listeners for the cloned elements
        attachReportsEventListeners();
        
        // Populate dropdowns in the cloned content
        populateFilterDropdowns().catch(err => {
            console.error('❌ Error populating filter dropdowns:', err);
        });
        
        // Ensure Today button is active
        const periodButtons = container.querySelectorAll('.period-btn');
        periodButtons.forEach(btn => {
            if (btn.dataset.period === 'today') {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        // Initialize reports with today's data (async, non-blocking)
        loadReportsData('today');
        
        console.log('✅ Reports rendered inline in Admin Dashboard');
    }, 50); // Small delay to ensure loading indicator is visible
};

/**
 * Attach event listeners to reports elements
 */
function attachReportsEventListeners() {
    // Use currentReportsContainer if available (set in renderReportsInAdminTab)
    const container = currentReportsContainer || document.getElementById('admin-reports-container');
    if (!container) {
        console.warn('⚠️ Reports container not found, cannot attach listeners');
        return;
    }
    
    console.log('📊 Attaching event listeners to container:', container.id || 'reports-modal');
    console.log('📊 currentReportsContainer:', currentReportsContainer?.id || 'not set');
    
    // Period selector buttons
    const periodButtons = container.querySelectorAll('.period-btn');
    console.log('📊 Found period buttons:', periodButtons.length);
    
    periodButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            console.log('📊 Period button clicked:', this.dataset.period);
            periodButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            const period = this.dataset.period;
            currentPeriod = period; // Update global currentPeriod for exports
            
            // Find the filters div within the admin container
            const filtersDiv = container.querySelector('.reports-filters') || container.querySelector('#reports-filters');
            
            if (period === 'custom') {
                if (filtersDiv) {
                    filtersDiv.classList.remove('d-none');
                    filtersDiv.style.display = 'block';
                }
                
                // Show date fields in custom mode
                const startDateGroup = filtersDiv?.querySelector('#filter-start-date')?.closest('.filter-group');
                const endDateGroup = filtersDiv?.querySelector('#filter-end-date')?.closest('.filter-group');
                if (startDateGroup) startDateGroup.style.display = 'block';
                if (endDateGroup) endDateGroup.style.display = 'block';
                
                setDefaultDateRange();
            } else {
                // Show filters in all periods, not just custom
                if (filtersDiv) {
                    filtersDiv.classList.remove('d-none');
                    filtersDiv.style.display = 'block';
                }
                
                // Hide date fields for standard periods (they're not needed)
                const startDateGroup = filtersDiv?.querySelector('#filter-start-date')?.closest('.filter-group');
                const endDateGroup = filtersDiv?.querySelector('#filter-end-date')?.closest('.filter-group');
                if (startDateGroup) startDateGroup.style.display = 'none';
                if (endDateGroup) endDateGroup.style.display = 'none';
                
                // Keep product/customer filters active even in standard periods
                console.log('📊 Keeping filters active for period:', period);
                
                loadReportsData(period);
            }
        });
    });
    
    // Apply filters button
    const applyFiltersBtn = container.querySelector('#apply-filters-btn');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', applyAdvancedFilters);
        console.log('✅ Apply filters button listener attached');
    }
    
    // Clear filters button
    const clearFiltersBtn = container.querySelector('#clear-filters-btn');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', clearAdvancedFilters);
        console.log('✅ Clear filters button listener attached');
    }
    
    // Export buttons
    const exportCSV = container.querySelector('#export-sales-csv');
    const exportExcel = container.querySelector('#export-sales-excel');
    const exportPDF = container.querySelector('#export-sales-pdf');
    
    if (exportCSV) exportCSV.addEventListener('click', () => exportReports('csv'));
    if (exportExcel) exportExcel.addEventListener('click', () => exportReports('excel'));
    if (exportPDF) exportPDF.addEventListener('click', () => exportReports('pdf'));
    
    // Add change listeners to store filter selections
    const productSelect = container.querySelector('#filter-product');
    const customerSelect = container.querySelector('#filter-customer');
    
    if (productSelect) {
        productSelect.addEventListener('change', function() {
            selectedFilters.productId = this.value || null;
            selectedFilters.productName = selectedFilters.productId ? getSelectedProductName(this) : null;
            console.log('📝 Product selection stored:', selectedFilters.productId);
        });
    }
    
    if (customerSelect) {
        customerSelect.addEventListener('change', function() {
            selectedFilters.customerId = this.value || null;
            console.log('📝 Customer selection stored:', selectedFilters.customerId);
        });
    }
    
    // Date validation listeners
    const startDateInput = container.querySelector('#filter-start-date');
    const endDateInput = container.querySelector('#filter-end-date');
    if (startDateInput && endDateInput) {
        startDateInput.addEventListener('change', validateDateRange);
        endDateInput.addEventListener('change', validateDateRange);
    }
    
    console.log('✅ All reports event listeners attached');
}

// ===================================
// PERFORMANCE MONITORING
// ===================================
const PerformanceMonitor = {
    timers: {},
    
    start(label) {
        this.timers[label] = performance.now();
    },
    
    end(label) {
        if (this.timers[label]) {
            const duration = performance.now() - this.timers[label];
            this.timers[label + '_duration'] = duration;
            return duration;
        }
        return 0;
    },
    
    report() {
        const metrics = {};
        Object.keys(this.timers).forEach(key => {
            if (key.endsWith('_duration')) {
                metrics[key.replace('_duration', '')] = this.timers[key].toFixed(2) + 'ms';
            }
        });
        return metrics;
    },
    
    reset() {
        this.timers = {};
    }
};

// ===================================
// CACHE LAYER (localStorage)
// ===================================
const ReportsCache = {
    TTL: 60000, // 60 seconds for today/week
    
    get(period) {
        try {
            const cached = localStorage.getItem('reports_cache_' + period);
            if (!cached) return null;
            
            const data = JSON.parse(cached);
            const age = Date.now() - data.timestamp;
            
            if (age > this.TTL) {
                this.clear(period);
                return null;
            }
            
            console.log(`✅ Cache HIT for ${period} (age: ${(age/1000).toFixed(1)}s)`);
            return data;
        } catch (error) {
            console.warn('Cache read error:', error);
            return null;
        }
    },
    
    set(period, sales, stats) {
        try {
            const data = {
                sales,
                stats,
                timestamp: Date.now()
            };
            localStorage.setItem('reports_cache_' + period, JSON.stringify(data));
            console.log(`💾 Cached ${period}: ${sales.length} sales`);
        } catch (error) {
            console.warn('Cache write error:', error);
        }
    },
    
    clear(period) {
        if (period) {
            localStorage.removeItem('reports_cache_' + period);
        } else {
            // Clear all report caches
            ['today', 'week', 'month', 'year'].forEach(p => {
                localStorage.removeItem('reports_cache_' + p);
            });
        }
    }
};

// ===================================
// PARSED SALES CACHE (memoization)
// ===================================
const parsedSalesCache = new Map();

function getParsedSale(sale) {
    if (!sale.id) return sale; // No ID, can't cache
    
    if (!parsedSalesCache.has(sale.id)) {
        const parsed = {
            ...sale,
            items: typeof sale.items === 'string' ? JSON.parse(sale.items) : sale.items,
            totals: typeof sale.totals === 'string' ? JSON.parse(sale.totals) : sale.totals,
            customerInfo: sale.customerInfo && typeof sale.customerInfo === 'string' 
                ? JSON.parse(sale.customerInfo) 
                : sale.customerInfo
        };
        parsedSalesCache.set(sale.id, parsed);
    }
    
    return parsedSalesCache.get(sale.id);
}

function clearParsedCache() {
    parsedSalesCache.clear();
    console.log('🗑️ Cleared parsed sales cache');
}

// ===================================
// WEB WORKER FOR HEAVY CALCULATIONS
// ===================================
let reportsWorker = null;
let workerSupported = typeof Worker !== 'undefined';

function initWorker() {
    if (workerSupported && !reportsWorker) {
        try {
            reportsWorker = new Worker('js/reports-worker.js');
            console.log('✅ Web Worker initialized for reports calculations');
        } catch (error) {
            console.warn('⚠️ Web Worker not supported, using main thread:', error);
            workerSupported = false;
        }
    }
}

function terminateWorker() {
    if (reportsWorker) {
        reportsWorker.terminate();
        reportsWorker = null;
        console.log('🛑 Web Worker terminated');
    }
}

let currentPeriod = 'today';
let activeFilters = {
    startDate: null,
    endDate: null,
    customerId: null,
    supplierId: null,
    productId: null,
    productName: null,
    reportType: 'sales'
};

/**
 * Initialize the reports module
 */
async function initReports() {
    console.log('📊 initReports() called');
    
    // Initialize Web Worker
    initWorker();
    
    const reportsModal = document.getElementById('reports-modal');
    
    console.log('📊 reportsModal:', reportsModal);
    
    if (!reportsModal) {
        console.error('❌ Reports modal not found in DOM');
        return;
    }
    
    console.log('✅ Reports modal found, setting up internal event listeners');
    
    // Populate filter dropdowns with fresh data (no caching)
    await populateFilterDropdowns();
    
    const closeBtn = reportsModal.querySelector('.modal-close');
    console.log('📊 closeBtn found:', closeBtn);
    const periodBtns = reportsModal.querySelectorAll('.period-btn');
    console.log('📊 periodBtns found:', periodBtns.length, 'buttons');
    
    // Export buttons
    const exportCsvBtn = document.getElementById('export-sales-csv');
    const exportExcelBtn = document.getElementById('export-sales-excel');
    const exportPdfBtn = document.getElementById('export-sales-pdf');
    
    // Filter controls
    const applyFiltersBtn = document.getElementById('apply-filters-btn');
    const clearFiltersBtn = document.getElementById('clear-filters-btn');
    
    
    // Close modal
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            console.log('📊 Close button clicked');
            // Use page navigation to go back
            if (window.pageNav) {
                window.pageNav.goBack();
            } else {
                // Fallback
                reportsModal.classList.remove('active');
                reportsModal.style.display = 'none';
            }
        });
    } else {
        console.error('❌ Close button not found in reports modal');
    }
    
    // Click outside to close
    reportsModal.addEventListener('click', (e) => {
        if (e.target === reportsModal) {
            reportsModal.classList.remove('active');
        }
    });
    
    // Period selector buttons
    periodBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state
            periodBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Load data for selected period
            currentPeriod = btn.dataset.period;
            
            // Show/hide custom date filters
            const filtersSection = document.getElementById('reports-filters');
            if (currentPeriod === 'custom') {
                filtersSection.classList.remove('d-none');
                filtersSection.style.display = 'block';
                setDefaultDateRange();
                
                // DON'T auto-load - wait for user to click Apply Filters
                console.log('📅 Custom Range selected - waiting for user to apply filters');
                
                // Show message to user
                showNotification('Please select date range and click Apply Filters', 'info');
            } else {
                filtersSection.classList.add('d-none');
                filtersSection.style.display = 'none';
                console.log('📊 Standard period selected, keeping current customer/product filters');
                
                loadReportsData(currentPeriod);
            }
        });
    });
    
    // Date validation - Use modal-scoped queries
    const startDateInput = reportsModal.querySelector('#filter-start-date');
    const endDateInput = reportsModal.querySelector('#filter-end-date');
    const productSelect = reportsModal.querySelector('#filter-product');
    const customerSelect = reportsModal.querySelector('#filter-customer');
    
    if (startDateInput && endDateInput) {
        startDateInput.addEventListener('change', validateDateRange);
        endDateInput.addEventListener('change', validateDateRange);
    }

    if (productSelect) {
        productSelect.addEventListener('change', function() {
            selectedFilters.productId = this.value || null;
            selectedFilters.productName = selectedFilters.productId ? getSelectedProductName(this) : null;
            console.log('📝 Modal product selection stored:', selectedFilters.productId, selectedFilters.productName);
        });
    }

    if (customerSelect) {
        customerSelect.addEventListener('change', function() {
            selectedFilters.customerId = this.value || null;
            console.log('📝 Modal customer selection stored:', selectedFilters.customerId);
        });
    }
    
    // Connect filter buttons
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', applyAdvancedFilters);
        console.log('✅ Apply filters button connected');
    }
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', clearAdvancedFilters);
        console.log('✅ Clear filters button connected');
    }
    
    // Export buttons
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', () => exportReports('csv'));
    }
    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', () => exportReports('excel'));
    }
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', () => exportReports('pdf'));
    }
    
    console.log('✅ Reports module initialized');
}

/**
 * Populate customer and product dropdowns for filtering
 */
async function populateFilterDropdowns() {
    try {
        const container = currentReportsContainer || document.getElementById('reports-modal');

        // Populate customers
        const customerSelect = container?.querySelector('#filter-customer');
        if (customerSelect && typeof getAllCustomers === 'function') {
            const customers = await getAllCustomers();
            customerSelect.innerHTML = '<option value="">All Customers</option>';
            customers.forEach(customer => {
                const option = document.createElement('option');
                option.value = customer.name; // Use name for filtering
                option.textContent = `${customer.name}${customer.phone ? ' - ' + customer.phone : ''}`;
                customerSelect.appendChild(option);
            });
            console.log(`✅ Populated ${customers.length} customers in filter`);
        }
        
        // Populate products
        const productSelect = container?.querySelector('#filter-product');
        if (productSelect && typeof loadProductsFromDB === 'function') {
            // Save current selection before repopulating
            const currentValue = productSelect.value;
            
            const products = await loadProductsFromDB();
            productSelect.innerHTML = '<option value="">All Products</option>';
            products.forEach(product => {
                const option = document.createElement('option');
                option.value = product.id;
                option.textContent = `${product.name} - $${product.price}`;
                productSelect.appendChild(option);
            });
            
            // Restore stored selection
            if (selectedFilters.productId) {
                productSelect.value = selectedFilters.productId;
                selectedFilters.productName = getSelectedProductName(productSelect);
                console.log(`🔄 Restored product selection from storage: ${selectedFilters.productId}`);
            } else if (currentValue) {
                productSelect.value = currentValue;
                selectedFilters.productId = currentValue;
                selectedFilters.productName = getSelectedProductName(productSelect);
                console.log(`🔄 Restored product selection from dropdown: ${currentValue}`);
            }
            
            console.log(`✅ Populated ${products.length} products in filter`);
        }
        
        // Restore customer selection
        if (customerSelect && selectedFilters.customerId) {
            customerSelect.value = selectedFilters.customerId;
            console.log(`🔄 Restored customer selection from storage: ${selectedFilters.customerId}`);
        }
    } catch (error) {
        console.error('❌ Error populating filter dropdowns:', error);
        showNotification('Failed to load filter options', 'error');
    }
}

/**
 * Set default date range for custom period (1st of current month to today)
 */
function setDefaultDateRange() {
    const endDate = new Date(); // Today
    const startDate = new Date();
    startDate.setDate(1); // 1st of current month
    
    // Get the correct container
    const container = currentReportsContainer || document.getElementById('reports-modal');
    const startInput = container?.querySelector('#filter-start-date');
    const endInput = container?.querySelector('#filter-end-date');
    
    if (startInput) startInput.value = formatLocalDateForInput(startDate);
    if (endInput) endInput.value = formatLocalDateForInput(endDate);
}

/**
 * Validate date range (max 1 year)
 */
function validateDateRange() {
    // Get the correct container
    const container = currentReportsContainer || document.getElementById('reports-modal');
    const startDateInput = container?.querySelector('#filter-start-date');
    const endDateInput = container?.querySelector('#filter-end-date');
    
    if (!startDateInput?.value || !endDateInput?.value) return;
    
    const startDate = parseLocalDateInput(startDateInput.value);
    const endDate = parseLocalDateInput(endDateInput.value);

    if (!startDate || !endDate) {
        return;
    }
    
    // Check if end date is before start date
    if (endDate < startDate) {
        alert('End date cannot be before start date!');
        endDateInput.value = startDateInput.value;
        return;
    }
    
    // Check if range exceeds 1 year (365 days)
    const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    
    if (daysDiff > 365) {
        alert('Date range cannot exceed 1 year (365 days)!\\nPlease select a shorter range.');
        
        // Auto-adjust end date to 365 days from start
        const maxEndDate = new Date(startDate);
        maxEndDate.setDate(maxEndDate.getDate() + 365);
        endDateInput.value = formatLocalDateForInput(maxEndDate);
    }
}

/**
 * Load filter options (customers, suppliers, products)
 */
async function loadFilterOptions() {
    try {
        // Load unique customer names from actual sales
        const allSales = await getAllSales();
        const customerNames = new Set();
        
        allSales.forEach(sale => {
            if (sale.customerInfo && sale.customerInfo.name) {
                customerNames.add(sale.customerInfo.name);
            }
        });
        
        const customerSelect = document.getElementById('filter-customer');
        
        if (customerSelect) {
            customerSelect.innerHTML = '<option value="">All Customers</option>';
            Array.from(customerNames).sort().forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                customerSelect.appendChild(option);
            });
        }
        
        // Load suppliers
        const suppliers = await db.exec('SELECT id, name FROM suppliers ORDER BY name');
        const supplierSelect = document.getElementById('filter-supplier');
        
        if (supplierSelect && suppliers.length > 0) {
            const rows = suppliers[0].values;
            supplierSelect.innerHTML = '<option value="">All Suppliers</option>';
            rows.forEach(row => {
                const option = document.createElement('option');
                option.value = row[0];
                option.textContent = row[1];
                supplierSelect.appendChild(option);
            });
        }
        
        // Load products
        const products = await db.exec('SELECT id, name FROM products ORDER BY name');
        const productSelect = document.getElementById('filter-product');
        
        if (productSelect && products.length > 0) {
            const rows = products[0].values;
            productSelect.innerHTML = '<option value="">All Products</option>';
            rows.forEach(row => {
                const option = document.createElement('option');
                option.value = row[0];
                option.textContent = row[1];
                productSelect.appendChild(option);
            });
        }
        
    } catch (error) {
        console.error('Error loading filter options:', error);
    }
}

/**
 * Apply advanced filters
 */
function applyAdvancedFilters() {
    const { customerId, productId, productName } = syncCurrentReportFilterSelections();
    
    console.log('🔍 ===== APPLY FILTERS DEBUG =====');
    console.log('🔍 Using stored values - Customer:', customerId, 'Product:', productId);
    console.log('🔍 selectedFilters object:', selectedFilters);
    
    // Parse productId as integer if it exists
    let parsedProductId = null;
    if (productId && productId !== '' && productId !== '0' && productId !== 'all') {
        parsedProductId = parseInt(productId);
        console.log('✅ Parsed productId:', parsedProductId, 'from string:', productId);
    } else {
        console.log('ℹ️ No product filter selected (value was:', productId, ')');
    }
    
    // Get the correct container (admin dashboard or modal)
    const container = currentReportsContainer || document.getElementById('reports-modal');
    console.log('🔍 Reading dates from container:', container?.id || 'unknown');
    
    // Read date inputs from the correct container (not global document)
    const startDateInput = container.querySelector('#filter-start-date');
    const endDateInput = container.querySelector('#filter-end-date');
    
    // Check if we're in custom mode (use currentPeriod instead of checking DOM)
    const isCustomMode = currentPeriod === 'custom';
    
    console.log('🔍 isCustomMode check:', isCustomMode, 'currentPeriod:', currentPeriod);
    
    if (isCustomMode) {
        // Custom mode: require dates and use custom period
        validateDateRange();
        
        const startDate = startDateInput?.value;
        const endDate = endDateInput?.value;
        
        console.log('📅 Reading from inputs:', {
            startValue: startDate,
            endValue: endDate,
            startElement: startDateInput?.id,
            endElement: endDateInput?.id
        });
        
        if (!startDate || !endDate) {
            alert('Please select both start and end dates!');
            return;
        }
        
        // Set active filters with custom dates (fix timezone to use local midnight)
        const startDateTime = parseLocalDateInput(startDate);
        const endDateTime = parseLocalDateInput(endDate, true);

        if (!startDateTime || !endDateTime) {
            alert('Please select valid start and end dates!');
            return;
        }
        
        console.log('📅 Custom date range:', {
            startInput: startDate,
            endInput: endDate,
            startDate: startDateTime.toISOString(),
            endDate: endDateTime.toISOString()
        });
        
        activeFilters = {
            startDate: startDateTime,
            endDate: endDateTime,
            customerId: customerId || null,
            productId: parsedProductId,
            productName: productName || null,
            supplierId: null,
            reportType: 'custom'
        };
        
        console.log('🔍 Custom mode - Active filters set:', activeFilters);
        
        // Reload with custom period and active filters
        loadReportsData('custom');
    } else {
        // Standard period mode: only update product/customer filters, keep current period
        activeFilters.customerId = customerId || null;
        activeFilters.productId = parsedProductId;
        activeFilters.productName = productName || null;
        
        console.log('🔍 Standard period mode - Updated filters:', {
            productId: activeFilters.productId,
            customerId: activeFilters.customerId,
            currentPeriod: currentPeriod
        });
        
        // Reload with current period (today, week, month, etc.)
        loadReportsData(currentPeriod || 'today');
    }
}

/**
 * Clear advanced filters
 */
function clearAdvancedFilters() {
    // Get the correct container
    const container = currentReportsContainer || document.getElementById('reports-modal');
    
    const startInput = container?.querySelector('#filter-start-date');
    const endInput = container?.querySelector('#filter-end-date');
    if (startInput) startInput.value = '';
    if (endInput) endInput.value = '';
    
    const customerSelect = container?.querySelector('#filter-customer');
    if (customerSelect) customerSelect.value = '';
    
    const productSelect = container?.querySelector('#filter-product');
    if (productSelect) productSelect.value = '';
    
    // Clear stored selections
    selectedFilters.productId = null;
    selectedFilters.productName = null;
    selectedFilters.customerId = null;
    console.log('🗑️ Cleared stored filter selections');
    
    activeFilters = {
        startDate: null,
        endDate: null,
        customerId: null,
        supplierId: null,
        productId: null,
        productName: null,
        reportType: 'sales'
    };
    
    console.log('🔄 All filters cleared');
    
    // Reload current period without filters
    loadReportsData(currentPeriod || 'today');
}

/**
 * Load and display reports data for the selected period
 */
async function loadReportsData(period) {
    console.log('📊 loadReportsData() called with period:', period);
    PerformanceMonitor.reset();
    PerformanceMonitor.start('total');
    
    // Update currentPeriod so exports use the correct period
    currentPeriod = period;
    console.log('📊 currentPeriod updated to:', currentPeriod);
    
    // Show loading indicator
    showLoading();
    
    // Add timeout protection (30 seconds)
    const timeoutId = setTimeout(() => {
        hideLoading();
        showError('Reports loading timed out. The database may be too large. Try selecting a shorter time period.');
        console.error('❌ Reports loading timed out after 30 seconds');
    }, 30000);
    
    try {
        // Check cache for today/week periods
        if ((period === 'today' || period === 'week') && period !== 'custom') {
            const cached = ReportsCache.get(period);
            if (cached && cached.sales && cached.stats) {
                clearTimeout(timeoutId);
                console.log(`⚡ Using cached data for ${period}`);
                
                // Use cached data with progressive rendering
                requestAnimationFrame(() => {
                    updateStatsCards(cached.stats);
                    requestAnimationFrame(() => {
                        renderTopProductsChart(cached.sales);
                        requestAnimationFrame(() => {
                            renderCategoryChart(cached.sales);
                            requestAnimationFrame(() => {
                                renderRecentSales(cached.sales);
                                hideLoading();
                                console.log('⚡ Rendered from cache in', PerformanceMonitor.end('total').toFixed(2), 'ms');
                            });
                        });
                    });
                });
                return;
            }
        }
        
        // Check if database is ready
        if (!db) {
            console.log('Database not ready, initializing...');
            await initDatabase();
        }
        
        // Fetch sales data with performance tracking
        PerformanceMonitor.start('fetch');
        const sales = await getSalesForPeriod(period);
        await loadRefundMetadataForSales(sales);
        PerformanceMonitor.end('fetch');
        console.log(`📊 Loaded ${sales.length} sales for period: ${period}`);
        
        // If no sales data, show empty state
        if (sales.length === 0) {
            clearTimeout(timeoutId);
            console.warn('⚠️ No sales data found for period:', period);
            hideLoading();
            showEmptyReportsState();
            PerformanceMonitor.end('total');
            return;
        }
        
        // Calculate statistics with performance tracking
        PerformanceMonitor.start('calculate');
        const stats = calculateStats(sales);
        PerformanceMonitor.end('calculate');
        
        // Cache the results for today/week
        if ((period === 'today' || period === 'week') && period !== 'custom') {
            ReportsCache.set(period, sales, stats);
        }
        
        // Progressive rendering to prevent UI freezing
        PerformanceMonitor.start('render');
        requestAnimationFrame(() => {
            updateStatsCards(stats);
            requestAnimationFrame(() => {
                renderTopProductsChart(sales);
                requestAnimationFrame(() => {
                    renderCategoryChart(sales);
                    requestAnimationFrame(() => {
                        renderRecentSales(sales);
                        PerformanceMonitor.end('render');
                        clearTimeout(timeoutId); // Clear timeout on success
                        hideLoading();
                        
                        // Display performance metrics
                        const metrics = PerformanceMonitor.report();
                        console.log('⚡ Performance:', metrics);
                        PerformanceMonitor.end('total');
                    });
                });
            });
        });
        
    } catch (error) {
        clearTimeout(timeoutId);
        console.error('❌ Error loading reports:', error);
        hideLoading();
        showError('Failed to load sales data: ' + error.message);
        PerformanceMonitor.end('total');
    }
}

/**
 * Show empty state when no sales data
 */
function showEmptyReportsState() {
    // Update stats to zero
    updateStatsCards({
        totalRevenue: 0,
        totalSales: 0,
        totalItems: 0,
        averageSale: 0,
        profitMargin: 0,
        totalProfit: 0
    });
    
    // Show empty message
    const topProductsChart = document.getElementById('top-products-chart');
    const categoryChart = document.getElementById('category-chart');
    const salesList = document.getElementById('recent-sales-table');
    
    if (topProductsChart) {
        topProductsChart.innerHTML = '<p style="text-align: center; color: #888; padding: 40px;">No sales data yet. Complete a transaction to see reports.</p>';
    }
    
    if (categoryChart) {
        categoryChart.innerHTML = '<p style="text-align: center; color: #888; padding: 40px;">No category data available.</p>';
    }
    
    if (salesList) {
        salesList.innerHTML = '<p style="text-align: center; color: #888; padding: 20px;">No recent sales.</p>';
    }
}

/**
 * Get sales for the selected period
 */
async function getSalesForPeriod(period) {
    console.log('🔍 ========== getSalesForPeriod START ==========');
    console.log('🔍 Period:', period);
    console.log('🔍 Current activeFilters:', JSON.stringify(activeFilters, null, 2));
    console.log('🔍 activeFilters.productId:', activeFilters.productId, 'Type:', typeof activeFilters.productId);
    
    const now = new Date();
    let startDate;
    let endDate = now;
    
    // Check if we're using custom filters
    if (period === 'custom' && activeFilters.startDate && activeFilters.endDate) {
        startDate = activeFilters.startDate;
        endDate = activeFilters.endDate;
    } else {
        switch (period) {
            case 'today':
                // Start of today (00:00:00)
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
                // End of today (23:59:59.999)
                endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
                break;
            case 'week':
                // Start of current calendar week (Monday)
                startDate = getStartOfCurrentWeek(now);
                endDate = new Date(now);
                break;
            case 'month':
                // Start of current calendar month
                startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
                endDate = new Date(now);
                break;
            case 'year':
                // Start of current calendar year
                startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
                endDate = new Date(now);
                break;
            case 'all':
                // Beginning of time
                startDate = new Date(2020, 0, 1, 0, 0, 0, 0);
                // End at current moment
                endDate = new Date(now);
                break;
            default:
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
                endDate = new Date(now);
        }
    }
    
    console.log('📊 Getting sales for period:', period);
    const perfStart = performance.now();
    const allSales = await getAllSales({ limit: 1000 }); // Cap at 1000 for performance
    const fetchTime = performance.now() - perfStart;
    console.log(`📊 Total sales in database: ${allSales.length} (fetched in ${fetchTime.toFixed(0)}ms)`);
    
    if (allSales.length === 0) {
        console.warn('⚠️ No sales found in database');
        return [];
    }
    
    console.log('📊 Date range filter:', startDate.toISOString(), 'to', endDate.toISOString());
    console.log('📊 Date range (readable):', startDate.toLocaleDateString(), 'to', endDate.toLocaleDateString());
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();
    console.log('📊 Time range (ms):', startTime, 'to', endTime);
    
    // PERFORMANCE: Pre-calculate parsed sales to avoid re-parsing in loop
    const filterStart = performance.now();
    let loggedCount = 0; // Track logged sales
    const filtered = allSales.filter(sale => {
        if (!sale.timestamp) {
            console.warn('⚠️ Sale missing timestamp:', sale);
            return false;
        }
        
        // Handle both ISO strings and timestamps
        const saleTime = typeof sale.timestamp === 'string' 
            ? new Date(sale.timestamp).getTime() 
            : sale.timestamp;
        
        const saleDate = new Date(saleTime);
        
        // Date filter - DETAILED LOGGING FOR FIRST FEW SALES
        const isInRange = saleTime >= startTime && saleTime <= endTime;
        
        // Log first 5 sales and any out-of-range sales
        if (loggedCount < 5 || !isInRange) {
            console.log(`🔍 Sale ${sale.receiptNumber}: ${saleDate.toLocaleString()} (${saleTime}) - In range? ${isInRange}`);
            loggedCount++;
        }
        
        if (!isInRange) {
            return false;
        }
        
        // Apply product and customer filters in ALL modes (not just custom)
        
        // Customer filter - search by customer name (customerInfo.name)
        if (activeFilters.customerId) {
            const parsed = getParsedSale(sale);
            const customerName = normalizeFilterText(activeFilters.customerId);
            const saleCustomerName = normalizeFilterText(parsed.customerInfo?.name);
            if (!saleCustomerName || saleCustomerName !== customerName) {
                return false;
            }
        }
        
        // Product filter - check if any item in the sale matches (works in ALL periods)
        if (activeFilters.productId) {
            const parsed = getParsedSale(sale);
            const hasProduct = parsed.items.some(item => matchesActiveProductFilter(item));
            if (!hasProduct) {
                return false;
            }
        }
        
        return true;
    });
    
    const filterTime = performance.now() - filterStart;
    console.log(`✅ Filtered ${filtered.length} sales (filter took ${filterTime.toFixed(0)}ms, total: ${(fetchTime + filterTime).toFixed(0)}ms)`);
    
    console.log('✅ Filtered sales count:', filtered.length);
    return filtered;
}

/**
 * Calculate statistics from sales data
 */
function calculateStats(sales) {
    let totalRevenue = 0;
    let totalCost = 0;
    let totalProfit = 0;
    const reportSales = getNetReportSales(sales);
    
    const totalSales = reportSales.length;
    
    const totalItems = reportSales.reduce((sum, sale) => {
        const parsed = getParsedSale(sale);
        
        // Filter items if product filter is active
        let items = parsed.items;
        if (activeFilters?.productId) {
            items = filterItemsByActiveProduct(items);
        }

        items = getNetReportItemsForSale(sale, items);
        const metrics = calculateItemMetrics(items);

        totalRevenue += metrics.revenue;
        totalCost += metrics.cost;
        totalProfit += (metrics.revenue - metrics.cost);
        
        return sum + metrics.quantity;
    }, 0);
    
    const averageSale = totalSales > 0 ? totalRevenue / totalSales : 0;
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    
    return {
        totalRevenue,
        totalSales,
        totalItems,
        averageSale,
        totalCost,
        totalProfit,
        profitMargin
    };
}

/**
 * Update statistics cards in the UI
 */
function updateStatsCards(stats) {
    const statRevenue = getReportsElement('stat-revenue');
    const statSales = getReportsElement('stat-sales');
    const statItems = getReportsElement('stat-items');
    const statAverage = getReportsElement('stat-average');
    const profitMarginEl = getReportsElement('stat-profit-margin');
    const totalProfitEl = getReportsElement('stat-total-profit');
    
    if (statRevenue) statRevenue.innerHTML = formatDualCurrency(stats.totalRevenue);
    if (statSales) statSales.textContent = stats.totalSales;
    if (statItems) statItems.textContent = stats.totalItems;
    if (statAverage) statAverage.innerHTML = formatDualCurrency(stats.averageSale);
    
    // Update profit stats
    if (profitMarginEl) {
        profitMarginEl.textContent = `${stats.profitMargin.toFixed(1)}%`;
        
        // Color code based on margin
        if (stats.profitMargin >= 30) {
            profitMarginEl.style.color = '#10b981'; // Green
        } else if (stats.profitMargin >= 15) {
            profitMarginEl.style.color = '#f59e0b'; // Orange
        } else {
            profitMarginEl.style.color = '#ef4444'; // Red
        }
    }
    
    if (totalProfitEl) {
        totalProfitEl.innerHTML = formatDualCurrency(stats.totalProfit);
        totalProfitEl.style.color = stats.totalProfit >= 0 ? '#10b981' : '#ef4444';
    }
}

/**
 * Render top selling products chart
 */
function renderTopProductsChart(sales) {
    const container = getReportsElement('top-products-chart');
    const reportSales = getNetReportSales(sales);
    
    // Aggregate products
    const productMap = {};
    reportSales.forEach(sale => {
        let items = typeof sale.items === 'string' ? JSON.parse(sale.items) : sale.items;
        
        // Filter items if product filter is active
        if (activeFilters?.productId) {
            items = filterItemsByActiveProduct(items);
        }

        items = getNetReportItemsForSale(sale, items);
        
        items.forEach(item => {
            if (!productMap[item.name]) {
                productMap[item.name] = {
                    name: item.name,
                    quantity: 0,
                    revenue: 0
                };
            }
            productMap[item.name].quantity += item.quantity;
            productMap[item.name].revenue += item.price * item.quantity;
        });
    });
    
    // Convert to array and sort by quantity
    const products = Object.values(productMap)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5); // Top 5
    
    if (products.length === 0) {
        container.innerHTML = '<div class="empty-state">No sales data available</div>';
        return;
    }
    
    // Find max for scaling
    const maxQuantity = Math.max(...products.map(p => p.quantity));
    
    // Render horizontal bar chart
    container.innerHTML = products.map(product => {
        const percentage = (product.quantity / maxQuantity) * 100;
        return `
            <div class="product-bar-item">
                <div class="product-bar-info">
                    <span class="product-bar-name">${product.name}</span>
                    <span class="product-bar-value">${product.quantity} sold • $${product.revenue.toFixed(2)}</span>
                </div>
                <div class="product-bar-container">
                    <div class="product-bar-fill" style="width: ${percentage}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Render sales by category chart
 */
function renderCategoryChart(sales) {
    const container = getReportsElement('category-chart');
    const reportSales = getNetReportSales(sales);
    
    // Aggregate by category
    const categoryMap = {};
    reportSales.forEach(sale => {
        const parsed = getParsedSale(sale);
        const items = getNetReportItemsForSale(sale, parsed.items);

        items.forEach(item => {
            const category = item.category || 'Uncategorized';
            if (!categoryMap[category]) {
                categoryMap[category] = {
                    category,
                    quantity: 0,
                    revenue: 0
                };
            }
            categoryMap[category].quantity += item.quantity;
            categoryMap[category].revenue += item.price * item.quantity;
        });
    });
    
    const categories = Object.values(categoryMap);
    
    if (categories.length === 0) {
        container.innerHTML = '<div class="empty-state">No sales data available</div>';
        return;
    }
    
    // Calculate total for percentages
    const totalRevenue = categories.reduce((sum, cat) => sum + cat.revenue, 0);
    
    // Category colors (using Ayn Beirut palette)
    const colors = [
        'var(--color-primary)',      // Ayn Blue
        'var(--color-accent)',        // Electric Cyan
        'var(--color-cta)',           // Warm Orange
        'rgba(242, 122, 29, 0.6)',    // Light Orange
        'rgba(28, 117, 188, 0.6)',    // Light Blue
        'rgba(0, 194, 255, 0.6)'      // Light Cyan
    ];
    
    // Render category bars
    container.innerHTML = categories.map((cat, index) => {
        const percentage = (cat.revenue / totalRevenue) * 100;
        const color = colors[index % colors.length];
        return `
            <div class="category-bar-item">
                <div class="category-bar-info">
                    <span class="category-bar-name">${cat.category}</span>
                    <span class="category-bar-value">${percentage.toFixed(1)}% • $${cat.revenue.toFixed(2)}</span>
                </div>
                <div class="category-bar-container">
                    <div class="category-bar-fill" style="width: ${percentage}%; background: ${color}"></div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Render recent sales table
 */
function renderRecentSales(sales) {
    const container = getReportsElement('recent-sales-table');
    const reportSales = getNetReportSales(sales);
    
    if (reportSales.length === 0) {
        container.innerHTML = '<div class="empty-state">No transactions found</div>';
        return;
    }
    
    // Sort by date (newest first) and limit to 50 for performance
    const recentSales = sortSalesByTimestampDesc(reportSales)
        .slice(0, 50);
    
    const tableHTML = `
        <table class="sales-table-grid">
            <thead>
                <tr>
                    <th width="10%">Receipt #</th>
                    <th width="12%">Date & Time</th>
                    <th width="20%">Items</th>
                    <th width="6%">Qty</th>
                    <th width="9%">Cost</th>
                    <th width="9%">Revenue</th>
                    <th width="9%">Profit</th>
                    <th width="10%">Margin</th>
                    <th width="15%">Actions</th>
                </tr>
            </thead>
            <tbody>
                ${recentSales.map((sale, index) => {
                    const parsed = getParsedSale(sale);
                    let items = parsed.items;
                    
                    // If product filter is active, only show the filtered product
                    if (activeFilters?.productId) {
                        items = filterItemsByActiveProduct(items);
                    }

                    items = getNetReportItemsForSale(sale, items);
                    
                    const totals = parsed.totals;
                    const date = new Date(sale.timestamp);
                    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                    const itemCount = items.length;
                    const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
                    const receiptNum = sale.receiptNumber || 'N/A';
                    
                    // Calculate cost, revenue, and profit (only for displayed items)
                    const metrics = calculateItemMetrics(items);
                    const totalCost = metrics.cost;
                    const totalRevenue = metrics.revenue;
                    const totalProfit = totalRevenue - totalCost;
                    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
                    
                    // Color code profit margin
                    let marginColor = '#10b981'; // Green
                    if (profitMargin < 15) marginColor = '#ef4444'; // Red
                    else if (profitMargin < 30) marginColor = '#f59e0b'; // Orange
                    
                    // Check if user is admin
                    const isAdmin = (typeof getCurrentUser === 'function' && getCurrentUser()?.role === 'admin');
                    
                    // Create detailed items list with profit info
                    const itemsList = items.map(item => {
                        const itemRevenue = item.price * item.quantity;
                        const itemCost = (item.cost || 0) * item.quantity;
                        const itemProfit = itemRevenue - itemCost;
                        const itemMargin = itemRevenue > 0 ? (itemProfit / itemRevenue) * 100 : 0;
                        
                        return `<div class="sale-item-detail">
                            <span class="item-name">${item.name || 'Unknown Item'}</span>
                            <span class="item-qty">×${item.quantity}</span>
                            <span class="item-price">${formatDualCurrencyPlain(itemRevenue)}</span>
                            <span class="item-profit" style="color: ${itemMargin >= 20 ? '#10b981' : '#f59e0b'}">
                                ${itemMargin.toFixed(1)}% margin
                            </span>
                        </div>`;
                    }).join('');
                    
                    // Add tax and discount information
                    let taxDiscountInfo = '';
                    if (totals) {
                        if (totals.discountPercent > 0) {
                            taxDiscountInfo += `<div class="sale-item-detail" style="background: #fef3c7; padding: 4px 8px; margin-top: 4px;">
                                <span style="color: #92400e;">💰 Discount: ${totals.discountPercent}% ($${(totals.discount || 0).toFixed(2)})</span>
                            </div>`;
                        }
                        if (totals.taxEnabled && totals.tax > 0) {
                            taxDiscountInfo += `<div class="sale-item-detail" style="background: #dbeafe; padding: 4px 8px; margin-top: 4px;">
                                <span style="color: #1e40af;">🧾 Tax (11%): $${totals.tax.toFixed(2)}</span>
                            </div>`;
                        }
                    }
                    
                    return `
                        <tr class="sale-row" onclick="toggleSaleDetails(${index})">
                            <td>
                                <div class="receipt-number" style="font-family: monospace; font-weight: 600; color: var(--color-primary);">
                                    ${receiptNum}
                                </div>
                            </td>
                            <td>
                                <div class="sale-datetime">
                                    <span class="sale-date">${dateStr}</span>
                                    <span class="sale-time">${timeStr}</span>
                                </div>
                            </td>
                            <td>
                                <div class="sale-items-summary">
                                    <span class="expand-icon" id="expand-icon-${index}">▶</span>
                                    <span>${itemCount} item${itemCount !== 1 ? 's' : ''}</span>
                                </div>
                            </td>
                            <td>${totalQty}</td>
                            <td>${formatDualCurrencyPlain(totalCost)}</td>
                            <td>${formatDualCurrencyPlain(totalRevenue)}</td>
                            <td style="color: ${totalProfit >= 0 ? '#10b981' : '#ef4444'}">
                                ${formatDualCurrencyPlain(totalProfit)}
                            </td>
                            <td style="color: ${marginColor}; font-weight: 600;">
                                ${profitMargin.toFixed(1)}%
                            </td>
                            <td onclick="event.stopPropagation();">
                                ${isAdmin ? `
                                    <button 
                                        onclick="deleteSaleFromReport(${sale.id})" 
                                        class="btn-text" 
                                        style="color: #ef4444; padding: 4px 8px; font-size: 12px;"
                                        title="Delete Sale (Admin Only)">
                                        🗑️ Delete
                                    </button>
                                ` : '<span style="color: #888; font-size: 12px;">-</span>'}
                            </td>
                        </tr>
                        <tr class="sale-details-row" id="sale-details-${index}" style="display: none;">
                            <td colspan="9">
                                <div class="sale-items-details">
                                    ${itemsList}
                                    ${taxDiscountInfo}
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
    
    container.innerHTML = tableHTML;
}

/**
 * Toggle sale details expansion
 */
function toggleSaleDetails(index) {
    const detailsRow = document.getElementById(`sale-details-${index}`);
    const expandIcon = document.getElementById(`expand-icon-${index}`);
    
    if (detailsRow.style.display === 'none') {
        detailsRow.style.display = 'table-row';
        expandIcon.textContent = '▼';
    } else {
        detailsRow.style.display = 'none';
        expandIcon.textContent = '▶';
    }
}

/**
 * Export reports in multiple formats
 */
async function exportReports(format) {
    console.log('📤 ========== EXPORT CALLED ==========');
    console.log('📤 Export format:', format);
    console.log('📤 Current period:', currentPeriod);
    console.log('📤 Container context:', currentReportsContainer?.id || 'unknown');
    console.log('📤 Export functions available:');
    console.log('  - exportToCSV:', typeof exportToCSV);
    console.log('  - exportToExcel:', typeof exportToExcel);
    console.log('  - exportToPDF:', typeof exportToPDF);
    
    try {
        syncCurrentReportFilterSelections();
        activeFilters.customerId = selectedFilters.customerId || null;
        activeFilters.productId = selectedFilters.productId ? parseInt(selectedFilters.productId, 10) : null;
        activeFilters.productName = selectedFilters.productName || null;

        const sales = sortSalesByTimestampDesc(await getSalesForPeriod(currentPeriod));
        await loadRefundMetadataForSales(sales);
        const reportSales = sortSalesByTimestampDesc(getNetReportSales(sales));
        console.log('📤 Sales data retrieved:', sales.length, 'sales');
        
        if (reportSales.length === 0) {
            showNotification('No sales data to export', 'error');
            console.log('❌ No sales to export');
            return;
        }
        
        // Prepare data with profit calculations - use keys that match column definitions
        const exportData = reportSales.map(sale => {
            let items = typeof sale.items === 'string' ? JSON.parse(sale.items) : sale.items;
            
            // Filter items if product filter is active (match on-screen display behavior)
            if (activeFilters?.productId) {
                items = filterItemsByActiveProduct(items);
                console.log(`🔍 Export: Filtering items for product ${activeFilters.productId}, ${items.length} items match`);
            }

            items = getNetReportItemsForSale(sale, items);
            
            const date = new Date(getSaleTimestampValue(sale));
            const metrics = calculateItemMetrics(items);
            const totalQty = metrics.quantity;
            const totalCost = metrics.cost;
            const totalRevenue = metrics.revenue;
            const totalProfit = totalRevenue - totalCost;
            const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
            
            return {
                receipt: sale.receiptNumber || 'N/A',
                date: date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
                time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                items: items.length,
                quantity: totalQty,
                cost: totalCost,
                revenue: totalRevenue,
                profit: totalProfit,
                margin: profitMargin.toFixed(2)
            };
        });
        
        // Calculate totals
        const totals = {
            receipt: 'TOTAL',
            date: '',
            time: '',
            items: exportData.reduce((sum, row) => sum + row.items, 0),
            quantity: exportData.reduce((sum, row) => sum + row.quantity, 0),
            cost: exportData.reduce((sum, row) => sum + row.cost, 0),
            revenue: exportData.reduce((sum, row) => sum + row.revenue, 0),
            profit: exportData.reduce((sum, row) => sum + row.profit, 0),
            margin: ''
        };
        
        // Add totals row
        const dataWithTotals = [...exportData, totals];
        
        // Create better filename with date range for custom periods
        let filename;
        if (currentPeriod === 'custom' && activeFilters.startDate && activeFilters.endDate) {
            const startStr = formatLocalDateForInput(activeFilters.startDate);
            const endStr = formatLocalDateForInput(activeFilters.endDate);
            filename = `sales-report-${startStr}-to-${endStr}`;
        } else {
            filename = `sales-report-${currentPeriod}-${formatLocalDateForInput(new Date())}`;
        }
        
        console.log('📤 Export filename:', filename);
        
        // Export based on format
        switch (format) {
            case 'csv':
                if (typeof exportToCSV === 'function') {
                    const csvColumns = [
                        {header: 'Receipt #', key: 'receipt'},
                        {header: 'Date', key: 'date'},
                        {header: 'Time', key: 'time'},
                        {header: 'Items', key: 'items', type: 'number'},
                        {header: 'Quantity', key: 'quantity', type: 'number'},
                        {header: 'Cost', key: 'cost', type: 'currency'},
                        {header: 'Revenue', key: 'revenue', type: 'currency'},
                        {header: 'Profit', key: 'profit', type: 'currency'},
                        {header: 'Margin %', key: 'margin'}
                    ];
                    await exportToCSV(dataWithTotals, csvColumns, filename);
                    showNotification('Sales report exported as CSV!');
                } else {
                    console.error('exportToCSV function not found');
                    showNotification('Export utilities not loaded', 'error');
                }
                break;
                
            case 'excel':
                if (typeof exportToExcel === 'function') {
                    const excelColumns = [
                        {header: 'Receipt #', key: 'receipt', width: 15},
                        {header: 'Date', key: 'date', width: 12},
                        {header: 'Time', key: 'time', width: 10},
                        {header: 'Items', key: 'items', width: 10, type: 'number'},
                        {header: 'Quantity', key: 'quantity', width: 10, type: 'number'},
                        {header: 'Cost', key: 'cost', width: 12, type: 'currency'},
                        {header: 'Revenue', key: 'revenue', width: 12, type: 'currency'},
                        {header: 'Profit', key: 'profit', width: 12, type: 'currency'},
                        {header: 'Margin %', key: 'margin', width: 10}
                    ];
                    await exportToExcel(dataWithTotals, excelColumns, filename, 'Sales Report');
                    showNotification('Sales report exported as Excel!');
                } else {
                    console.error('exportToExcel function not found');
                    showNotification('Export utilities not loaded', 'error');
                }
                break;
                
            case 'pdf':
                if (typeof exportToPDF === 'function') {
                    const pdfColumns = [
                        {header: 'Receipt #', dataKey: 'receipt'},
                        {header: 'Date', dataKey: 'date'},
                        {header: 'Time', dataKey: 'time'},
                        {header: 'Items', dataKey: 'items'},
                        {header: 'Qty', dataKey: 'quantity'},
                        {header: 'Cost', dataKey: 'cost'},
                        {header: 'Revenue', dataKey: 'revenue'},
                        {header: 'Profit', dataKey: 'profit'},
                        {header: 'Margin %', dataKey: 'margin'}
                    ];
                    
                    // Format currency values for PDF with dual currency
                    const pdfData = dataWithTotals.map(row => ({
                        ...row,
                        cost: typeof row.cost === 'number' ? formatDualCurrencyPlain(row.cost) : row.cost,
                        revenue: typeof row.revenue === 'number' ? formatDualCurrencyPlain(row.revenue) : row.revenue,
                        profit: typeof row.profit === 'number' ? formatDualCurrencyPlain(row.profit) : row.profit
                    }));
                    
                    // Create subtitle with date range
                    let subtitle;
                    if (currentPeriod === 'custom' && activeFilters.startDate && activeFilters.endDate) {
                        const startStr = activeFilters.startDate.toLocaleDateString('en-US');
                        const endStr = activeFilters.endDate.toLocaleDateString('en-US');
                        subtitle = `Period: ${startStr} - ${endStr}`;
                    } else {
                        subtitle = `Period: ${currentPeriod}`;
                    }
                    
                    await exportToPDF(pdfData, pdfColumns, 'Sales Report', filename, {
                        subtitle: subtitle,
                        orientation: 'landscape'
                    });
                    showNotification('Sales report exported as PDF!');
                } else {
                    console.error('exportToPDF function not found');
                    showNotification('Export utilities not loaded', 'error');
                }
                break;
        }
        
    } catch (error) {
        console.error('Error exporting reports:', error);
        showNotification('Failed to export reports', 'error');
    }
}

/**
 * Generate purchase report (for deliveries/restocks)
 */
async function generatePurchaseReport() {
    try {
        // Query deliveries with supplier info
        const query = `
            SELECT 
                d.id,
                d.deliveryDate,
                d.totalCost,
                s.name as supplierName,
                d.notes
            FROM deliveries d
            LEFT JOIN suppliers s ON d.supplierId = s.id
            ORDER BY d.deliveryDate DESC
        `;
        
        const result = await db.exec(query);
        
        if (result.length === 0 || result[0].values.length === 0) {
            showNotification('No purchase data available', 'error');
            return;
        }
        
        const deliveries = result[0].values.map(row => ({
            id: row[0],
            deliveryDate: row[1],
            totalCost: row[2],
            supplierName: row[3] || 'Unknown',
            notes: row[4] || ''
        }));
        
        // Get delivery items for each delivery
        const purchaseData = [];
        
        for (const delivery of deliveries) {
            const itemsQuery = `
                SELECT 
                    p.name,
                    di.quantity,
                    di.unitCost,
                    (di.quantity * di.unitCost) as totalCost
                FROM delivery_items di
                JOIN products p ON di.productId = p.id
                WHERE di.deliveryId = ?
            `;
            
            const stmt = db.prepare(itemsQuery);
            stmt.bind([delivery.id]);
            
            while (stmt.step()) {
                const row = stmt.getAsObject();
                purchaseData.push({
                    'Date': new Date(delivery.deliveryDate).toLocaleDateString('en-US'),
                    'Supplier': delivery.supplierName,
                    'Product': row.name,
                    'Quantity': row.quantity,
                    'Unit Cost': row.unitCost,
                    'Total Cost': row.totalCost,
                    'Notes': delivery.notes
                });
            }
            
            stmt.free();
        }
        
        if (purchaseData.length === 0) {
            showNotification('No purchase items found', 'error');
            return;
        }
        
        return purchaseData;
        
    } catch (error) {
        console.error('Error generating purchase report:', error);
        showNotification('Failed to generate purchase report', 'error');
        return [];
    }
}

/**
 * Delete sale from reports (Admin only)
 */
async function deleteSaleFromReport(saleId) {
    // Check if user is admin
    const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (!currentUser || currentUser.role !== 'admin') {
        showNotification('❌ Only admins can delete sales', 'error');
        return;
    }
    
    // Confirm deletion
    if (!confirm('⚠️ Are you sure you want to delete this sale?\n\nThis will:\n• Remove the sale from all reports\n• Delete all transaction records\n• This action CANNOT be undone\n\nContinue?')) {
        return;
    }
    
    try {
        // Delete from database
        await runExec('DELETE FROM sales WHERE id = ?', [saleId]);
        
        // Log activity
        if (typeof logActivity === 'function') {
            await logActivity('sale_delete', `Deleted sale #${saleId} from reports`);
        }
        
        showNotification('✅ Sale deleted successfully');
        
        // Reload reports
        loadReportsData(currentPeriod);
        
    } catch (error) {
        console.error('❌ Error deleting sale:', error);
        showNotification('❌ Failed to delete sale', 'error');
    }
}

/**
 * Invalidate reports cache (call when new sale is created)
 */
function invalidateReportsCache() {
    ReportsCache.clear();
    clearParsedCache();
    console.log('🔄 Reports cache invalidated');
}

/**
 * Show notification toast
 */
function showNotification(message, type = 'success') {
    // Remove existing notifications
    const existing = document.querySelector('.notification-toast');
    if (existing) {
        existing.remove();
    }
    
    // Create notification
    const notification = document.createElement('div');
    notification.className = `notification-toast ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Trigger animation
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Make functions globally available
console.log('📊 reports.js: Making functions global...');
window.renderReportsInAdminTab = renderReportsInAdminTab;
window.loadReportsData = loadReportsData;
window.getSalesForPeriod = getSalesForPeriod;
window.initReports = initReports;
window.invalidateReportsCache = invalidateReportsCache;
window.populateFilterDropdowns = populateFilterDropdowns;
console.log('📊 reports.js: Functions assigned to window:', {
    renderReportsInAdminTab: typeof window.renderReportsInAdminTab,
    loadReportsData: typeof window.loadReportsData,
    getSalesForPeriod: typeof window.getSalesForPeriod,
    initReports: typeof window.initReports,
    invalidateReportsCache: typeof window.invalidateReportsCache,
    populateFilterDropdowns: typeof window.populateFilterDropdowns
});

// Also ensure they're available when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('📊 reports.js: DOMContentLoaded - Re-assigning functions to window');
    window.renderReportsInAdminTab = renderReportsInAdminTab;
    window.loadReportsData = loadReportsData;
    window.getSalesForPeriod = getSalesForPeriod;
    window.initReports = initReports;
    window.invalidateReportsCache = invalidateReportsCache;
    window.populateFilterDropdowns = populateFilterDropdowns;
    console.log('📊 reports.js: Functions re-assigned:', {
        renderReportsInAdminTab: typeof window.renderReportsInAdminTab,
        loadReportsData: typeof window.loadReportsData,
        getSalesForPeriod: typeof window.getSalesForPeriod,
        initReports: typeof window.initReports,
        invalidateReportsCache: typeof window.invalidateReportsCache,
        populateFilterDropdowns: typeof window.populateFilterDropdowns
    });
});

/**
 * Show loading indicator
 */
function showLoading() {
    // Use current context (admin container or modal)
    const container = currentReportsContainer || document.getElementById('reports-modal');
    if (!container) return;
    
    // Remove existing loader if any
    let loader = container.querySelector('.reports-loader');
    if (!loader) {
        loader = document.createElement('div');
        loader.className = 'reports-loader';
        loader.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
                        background: rgba(0,0,0,0.5); display: flex; align-items: center; 
                        justify-content: center; z-index: 10000;">
                <div style="background: #1a1a2e; padding: 30px; border-radius: 12px; 
                            text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
                    <div class="spinner" style="border: 4px solid rgba(76, 175, 80, 0.2);
                                                 border-top: 4px solid #4CAF50; 
                                                 border-radius: 50%; width: 50px; height: 50px;
                                                 animation: spin 1s linear infinite; margin: 0 auto 15px;">
                    </div>
                    <div style="color: #4CAF50; font-size: 16px; font-weight: 500;">
                        Loading sales data...
                    </div>
                </div>
            </div>
        `;
        container.appendChild(loader);
        
        // Add spin animation if not exists
        if (!document.getElementById('spin-animation')) {
            const style = document.createElement('style');
            style.id = 'spin-animation';
            style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
    }
    loader.style.display = 'block';
}

/**
 * Hide loading indicator
 */
function hideLoading() {
    const container = currentReportsContainer || document.getElementById('reports-modal');
    if (!container) return;
    
    const loader = container.querySelector('.reports-loader');
    if (loader) {
        loader.style.display = 'none';
    }
}

/**
 * Show error message
 */
function showError(message) {
    const container = currentReportsContainer || document.getElementById('reports-modal');
    if (!container) {
        alert(message);
        return;
    }
    
    // Remove existing error if any
    let errorDiv = container.querySelector('.reports-error');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.className = 'reports-error';
        container.appendChild(errorDiv);
    }
    
    errorDiv.innerHTML = `
        <div style="position: fixed; top: 80px; right: 20px; 
                    background: #f44336; color: white; padding: 15px 20px; 
                    border-radius: 8px; box-shadow: 0 4px 12px rgba(244, 67, 54, 0.3);
                    z-index: 10001; max-width: 400px; animation: slideInRight 0.3s ease;">
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 20px;">⚠️</span>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" 
                        style="margin-left: auto; background: none; border: none; 
                               color: white; font-size: 20px; cursor: pointer; padding: 0 5px;">×</button>
            </div>
        </div>
    `;
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        if (errorDiv) errorDiv.remove();
    }, 5000);
}
