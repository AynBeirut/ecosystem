// ===================================
// AYN BEIRUT POS - APP INITIALIZATION
// Progressive loading - UI first, features later
// ===================================

// Global state
let appDbReady = false;

// ===================================
// DYNAMIC SCRIPT LOADING
// ===================================

/**
 * Load a single script dynamically
 */
function loadScript(src) {
    return new Promise((resolve, reject) => {
        // Check if already loaded
        if (window.loadedScripts.has(src)) {
            console.log(`✅ Script already loaded: ${src}`);
            resolve();
            return;
        }
        
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => {
            window.loadedScripts.add(src);
            console.log(`✅ Loaded: ${src}`);
            resolve();
        };
        script.onerror = () => {
            console.error(`❌ Failed to load: ${src}`);
            reject(new Error(`Failed to load script: ${src}`));
        };
        document.body.appendChild(script);
    });
}

/**
 * Load scripts for user role with graceful error handling
 */
async function loadScriptsForRole(role) {
    console.log(`📦 Loading scripts for role: ${role}`);
    
    let scriptsToLoad = [];
    
    if (role === 'admin') {
        scriptsToLoad = [...MANAGER_SCRIPTS, ...ADMIN_SCRIPTS];
    } else if (role === 'manager') {
        scriptsToLoad = MANAGER_SCRIPTS;
    }
    // cashier gets no additional scripts
    
    if (scriptsToLoad.length === 0) {
        console.log('ℹ️ No additional scripts needed for this role');
        return;
    }
    
    showProgressNotification(`Loading ${role} features...`, 'info');
    
    let loadedCount = 0;
    let failedScripts = [];
    
    for (const src of scriptsToLoad) {
        try {
            await loadScript(src);
            loadedCount++;
        } catch (error) {
            console.warn(`⚠️ Failed to load ${src}, feature disabled`);
            failedScripts.push(src);
            // Continue loading other scripts - don't crash the app
        }
    }
    
    console.log(`✅ Loaded ${loadedCount}/${scriptsToLoad.length} role scripts`);
    
    if (failedScripts.length > 0) {
        console.warn(`⚠️ ${failedScripts.length} features unavailable:`, failedScripts);
        showProgressNotification(`${loadedCount} features loaded, ${failedScripts.length} unavailable`, 'warning');
    } else {
        showProgressNotification(`${role} features loaded`, 'success');
    }
}

/**
 * Load deferred module on-demand
 */
async function loadModuleOnDemand(moduleName) {
    if (window.deferredModulesLoaded.has(moduleName)) {
        console.log(`ℹ️ Module ${moduleName} already loaded`);
        return true;
    }
    
    const scriptSrc = DEFERRED_SCRIPTS[moduleName];
    if (!scriptSrc) {
        console.warn(`⚠️ Unknown module: ${moduleName}`);
        return false;
    }
    
    try {
        showProgressNotification(`Loading ${moduleName}...`, 'info');
        await loadScript(scriptSrc);
        window.deferredModulesLoaded.add(moduleName);
        
        // Initialize the module if init function exists
        const initFunctionName = `init${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}`;
        if (typeof window[initFunctionName] === 'function') {
            await window[initFunctionName]();
        }
        
        showProgressNotification(`${moduleName} ready`, 'success');
        return true;
    } catch (error) {
        console.error(`❌ Failed to load ${moduleName}:`, error);
        showProgressNotification(`${moduleName} unavailable`, 'error');
        return false;
    }
}

// Make functions globally available
window.loadScriptsForRole = loadScriptsForRole;
window.loadModuleOnDemand = loadModuleOnDemand;

// ===================================
// APP STARTUP
// ===================================

// App startup sequence - SHOW UI IMMEDIATELY
async function startApp() {
    try {
        console.log('🚀 Starting Ayn Beirut POS...');
        updateLoadingStatus('Initializing database...');
        
        // CRITICAL: Initialize database FIRST
        try {
            if (typeof window.initDatabase === 'function') {
                console.log('🔧 Starting database initialization...');
                await window.initDatabase();
                appDbReady = true;
                console.log('✅ Database initialized successfully');
            } else {
                console.error('❌ initDatabase function not found');
                showProgressNotification('Database initialization failed', 'error');
            }
        } catch (e) {
            console.error('❌ Database initialization failed:', e);
            showProgressNotification('Database initialization failed', 'error');
            hideLoadingScreen();
            return;
        }
        
        // CRITICAL: Check authentication after database is ready
        if (appDbReady) {
            updateLoadingStatus('Checking authentication...');
            console.log('🔐 Checking authentication...');
            
            // Verify initAuth exists before calling
            if (typeof window.initAuth !== 'function') {
                console.error('❌ initAuth function not found on window object');
                console.log('Available auth functions:', Object.keys(window).filter(k => k.includes('Auth') || k.includes('login')));
                throw new Error('initAuth is not defined');
            }
            
            const isAuthenticated = await window.initAuth();
            
            if (!isAuthenticated) {
                console.log('⚠️ Not authenticated - login required');
                // Login modal will be shown by initAuth, stop here
                return;
            }
        } else {
            // Database failed, still check auth
            console.log('⚠️ Database not ready, checking auth anyway...');
            
            if (typeof window.initAuth !== 'function') {
                console.error('❌ initAuth function not found');
                throw new Error('initAuth is not defined');
            }
            
            const isAuthenticated = await window.initAuth();
            if (!isAuthenticated) {
                return;
            }
        }
        
        // Continue with app initialization
        continueAppInit();
        
    } catch (error) {
        console.error('❌ Fatal error during startup:', error);
        hideLoadingScreen();
        showProgressNotification('Startup failed: ' + error.message, 'error');
    }
}

/**
 * Continue app initialization after login
 */
window.continueAppInit = function() {
    try {
        console.log('🔄 Continuing app initialization...');
        
        // IMMEDIATE: Show the UI
        hideLoadingScreen();
        console.log('✅ Interface shown');
        
        // Show loading notification
        showProgressNotification('Initializing system...', 'info');
        
        // NOW load features progressively in the background
        loadFeaturesProgressively();
        
    } catch (error) {
        console.error('❌ Fatal error during startup:', error);
        hideLoadingScreen();
    }
}

/**
 * Load features progressively after UI is shown
 */
async function loadFeaturesProgressively() {
    try {
        // Database is already initialized in startApp, just verify it's ready
        console.log('Database status:', appDbReady ? 'Ready' : 'Not Ready');
        
        // Step 1.5: Restore tax checkbox state from previous session
        restoreTaxCheckboxState();
        
        // Step 2: Load products (only if DB is ready)
        if (appDbReady) {
            showProgressNotification('Loading products...', 'info');
            try {
                if (typeof loadProductsFromDB === 'function') {
                    const productsPromise = loadProductsFromDB();
                    const timeout = new Promise(resolve => setTimeout(() => resolve([]), 3000));
                    const products = await Promise.race([productsPromise, timeout]);
                    
                    if (Array.isArray(products) && products.length > 0) {
                        PRODUCTS.length = 0;
                        PRODUCTS.push(...products);
                        console.log('✅ Products loaded:', PRODUCTS.length);
                        
                        // Initialize categories FIRST before rendering products
                        if (typeof initCategories === 'function') {
                            await initCategories();
                        }
                        
                        // Load dynamic categories from products
                        if (typeof loadCategoriesFromProducts === 'function') {
                            loadCategoriesFromProducts();
                        }
                        
                        // Render products AFTER categories are loaded
                        if (typeof renderProducts === 'function') {
                            renderProducts(PRODUCTS);
                        }
                    }
                }
            } catch (e) {
                console.warn('⚠️ Products load skipped:', e.message);
            }
        }
        
        // Step 3: Initialize modules (only if DB is ready)
        if (appDbReady) {
            showProgressNotification('Initializing modules...', 'info');
            
            // Initialize immediately without delay
            try { if (typeof initSuppliersModule === 'function') await initSuppliersModule(); } catch (e) { console.warn('initSuppliersModule failed:', e); }
            try { if (typeof initPOS === 'function') initPOS(); } catch (e) { console.warn('initPOS failed:', e); }
            // initCategories already called in Step 2, skip here
            try { if (typeof initProductManagement === 'function') initProductManagement(); } catch (e) { console.warn('initProductManagement failed:', e); }
            try { if (typeof initInventory === 'function') initInventory(); } catch (e) { console.warn('initInventory failed:', e); }
            try { if (typeof initPayment === 'function') initPayment(); } catch (e) { console.warn('initPayment failed:', e); }
            try { if (typeof initReports === 'function') await initReports(); } catch (e) { console.warn('initReports failed:', e); }
            try { if (typeof initAdminDashboard === 'function') initAdminDashboard(); } catch (e) { console.warn('initAdminDashboard failed:', e); }
            try { if (typeof initPurchases === 'function') initPurchases(); } catch (e) { console.warn('initPurchases failed:', e); }
            try { if (typeof initCashDrawer === 'function') await initCashDrawer(); } catch (e) { console.warn('initCashDrawer failed:', e); }
            try { if (typeof initUnpaidOrders === 'function') await initUnpaidOrders(); } catch (e) { console.warn('initUnpaidOrders failed:', e); }
            try { if (typeof initStatusDropdownHandlers === 'function') initStatusDropdownHandlers(); } catch (e) { console.warn('initStatusDropdownHandlers failed:', e); }
        }
        
        // Step 4: Show success
        if (appDbReady) {
            showProgressNotification(`System Ready! ${PRODUCTS.length} products loaded`, 'success');
        } else {
            showProgressNotification('Running in limited mode', 'warning');
        }
        
        console.log('✅ Progressive loading complete');
        
    } catch (error) {
        console.error('Progressive loading error:', error);
        showProgressNotification('Some features may be limited', 'warning');
    }
}

/**
 * Show progress notification
 */
function showProgressNotification(message, type = 'info') {
    // Remove existing notification
    const existing = document.querySelector('.progress-notification');
    if (existing) existing.remove();
    
    const colors = {
        info: 'linear-gradient(135deg, #2196F3, #1976D2)',
        success: 'linear-gradient(135deg, #4CAF50, #45a049)',
        warning: 'linear-gradient(135deg, #FF9800, #F57C00)',
        error: 'linear-gradient(135deg, #f44336, #d32f2f)'
    };
    
    const notification = document.createElement('div');
    notification.className = 'progress-notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 20px;
        background: ${colors[type] || colors.info};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        font-family: 'Poppins', sans-serif;
        font-size: 14px;
        font-weight: 500;
        animation: slideInLeft 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Auto-hide info messages
    if (type === 'info') {
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(-100%)';
            notification.style.transition = 'all 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    } else if (type === 'success') {
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(-100%)';
            notification.style.transition = 'all 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }
}

/**
 * Initialize the app (DEPRECATED - now using progressive loading)
 */
/**
 * Initialize the app (DEPRECATED - now using progressive loading)
 */
async function initializeApp() {
    // This function is no longer used - keeping for compatibility
    console.log('⚠️ initializeApp called but using progressive loading instead');
}

function updateLoadingStatus(message) {
    const statusEl = document.getElementById('loading-status');
    if (statusEl) {
        statusEl.textContent = message;
    }
}

function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    const posApp = document.getElementById('pos-app');
    
    loadingScreen.classList.add('hidden');
    posApp.style.display = 'flex';
    
    // Remove loading screen after animation
    setTimeout(() => {
        loadingScreen.remove();
    }, 500);
}

// ===================================
// APP LIFECYCLE
// ===================================

// Start app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Initialize page navigation first
        if (window.pageNav) {
            window.pageNav.init();
        }
        startApp();
    });
} else {
    // Initialize page navigation first
    if (window.pageNav) {
        window.pageNav.init();
    }
    startApp();
}

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        console.log('App resumed');
        // Reload cart from storage in case it was updated in another tab
        if (typeof loadCartFromStorage === 'function') {
            loadCartFromStorage({ reason: 'resume' });
        }
    }
});

// Handle before unload (save state)
window.addEventListener('beforeunload', () => {
    console.log('Saving state before unload');
    if (typeof saveCartToStorage === 'function') {
        saveCartToStorage();
    }
});

// ===================================
// KEYBOARD SHORTCUTS
// ===================================

document.addEventListener('keydown', (e) => {
    // F1 - Focus search
    if (e.key === 'F1') {
        e.preventDefault();
        document.getElementById('product-search').focus();
    }
    
    // Escape - Clear search or close modal
    if (e.key === 'Escape') {
        const modal = document.getElementById('receipt-modal');
        if (modal.classList.contains('show')) {
            modal.classList.remove('show');
        } else {
            const searchInput = document.getElementById('product-search');
            searchInput.value = '';
            searchInput.dispatchEvent(new Event('input'));
        }
    }
    
    // Ctrl/Cmd + K - Focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('product-search').focus();
    }
    
    // Ctrl/Cmd + Enter - Checkout
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        const checkoutBtn = document.getElementById('checkout-btn');
        if (!checkoutBtn.disabled) {
            checkout();
        }
    }
});

// ===================================
// UTILITY FUNCTIONS
// ===================================

// Check if app is online
function isOnline() {
    return navigator.onLine;
}

// Update connection status indicator
function updateConnectionStatus() {
    const statusEl = document.getElementById('connection-status');
    const indicator = document.querySelector('.status-indicator');
    
    // Skip if elements don't exist yet
    if (!statusEl || !indicator) {
        return;
    }
    
    if (isOnline()) {
        statusEl.textContent = 'Online';
        indicator.classList.remove('offline');
        indicator.classList.add('online');
    } else {
        statusEl.textContent = 'Offline Mode';
        indicator.classList.remove('online');
        indicator.classList.add('offline');
    }
}

// Listen for online/offline events
window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);

// Initial connection check (immediately or after DOM loads)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        updateConnectionStatus();
    });
} else {
    updateConnectionStatus();
}


// ===================================
// MENU BUTTON INITIALIZATION
// ===================================

// Initialize menu button handlers (works even if DOMContentLoaded already fired)
// NOTE: Cash Drawer, Refund, and Unpaid Orders handlers are now in their respective feature files
function initializeMenuButtons() {
    console.log('🎯 Initializing app.js menu button handlers...');
    
    // Menu button handlers are now in:
    // - cash-drawer.js (cash-drawer-btn)
    // - refunds.js (refund-btn)  
    // - unpaid-orders.js (unpaid-orders-btn)
    // This prevents timing issues with dynamically loaded scripts
    
    console.log('✅ App.js initialization complete');
}

// Run initialization immediately if DOM already loaded, or wait for it
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeMenuButtons);
} else {
    // DOM already loaded (script loaded dynamically after page load)
    initializeMenuButtons();
}

// Initialize Reports module (immediately after menu buttons)
async function initializeReportsModule() {
    if (typeof window.initReports === 'function') {
        console.log('✅ Initializing Reports module');
        await window.initReports();
    }
    // Reports is deferred - loads on-demand when Reports button clicked
    
    // Reports button handler - Opens modal and auto-loads today's data
    const reportsBtn = document.getElementById('reports-btn');
    if (reportsBtn) {
        console.log('✅ Setting up Reports button handler');
        reportsBtn.addEventListener('click', async (e) => {
            console.log('📊 Reports button clicked');
            const modal = document.getElementById('reports-modal');
            if (modal) {
                modal.classList.add('active');
                
                // Filter dropdowns are now populated in initReports() - no need to populate here
                
                // Auto-load today's data
                if (typeof loadReportsData === 'function') {
                    console.log('📊 Auto-loading today\'s sales data...');
                    loadReportsData('today');
                } else {
                    console.warn('⚠️ loadReportsData function not available');
                }
            }
        });
    }
}

// Run initialization immediately if DOM already loaded, or wait for it
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeReportsModule);
} else {
    initializeReportsModule();
}

// ===================================
// ERROR HANDLING
// ===================================

window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    // Could show user-friendly error message here
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});

// ===================================
// KEYBOARD SHORTCUTS
// ===================================
document.addEventListener('keydown', (e) => {
    // Ctrl+Shift+P - Add Product
    if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        if (typeof openProductManagement === 'function') {
            openProductManagement();
        }
    }
});

// ===================================
// MODAL BODY SCROLL LOCK
// ===================================

// Prevent background scroll when modal is open
const modalObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
            const modal = mutation.target;
            if (modal.classList.contains('modal')) {
                const isVisible = window.getComputedStyle(modal).display !== 'none';
                if (isVisible) {
                    document.body.classList.add('modal-open');
                } else {
                    // Check if any other modals are open
                    const openModals = Array.from(document.querySelectorAll('.modal')).some(
                        m => window.getComputedStyle(m).display !== 'none'
                    );
                    if (!openModals) {
                        document.body.classList.remove('modal-open');
                    }
                }
            }
        }
    });
});

// Observe all modals (works even if DOM already loaded)
function initializeModalObservers() {
    document.querySelectorAll('.modal').forEach(modal => {
        modalObserver.observe(modal, { attributes: true, attributeFilter: ['style'] });
        
        // Also handle class changes
        const classObserver = new MutationObserver(() => {
            const isVisible = modal.classList.contains('show') || modal.classList.contains('active');
            if (isVisible) {
                document.body.classList.add('modal-open');
            } else {
                const openModals = Array.from(document.querySelectorAll('.modal')).some(
                    m => m.classList.contains('show') || m.classList.contains('active')
                );
                if (!openModals) {
                    document.body.classList.remove('modal-open');
                }
            }
        });
        classObserver.observe(modal, { attributes: true, attributeFilter: ['class'] });
    });
}

// Run initialization immediately if DOM already loaded, or wait for it
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeModalObservers);
} else {
    initializeModalObservers();
}

// ===================================
// CONSOLE BRANDING
// ===================================

console.log('%c AYN BEIRUT POS ', 'background: linear-gradient(135deg, #1C75BC, #00C2FF); color: white; font-size: 20px; font-weight: bold; padding: 10px 20px; border-radius: 5px;');
console.log('%c Tech made in Beirut, deployed worldwide ', 'color: #00C2FF; font-size: 12px; font-weight: 600;');
console.log('%c Version 1.0.0 - MVP ', 'color: #C9D1D9; font-size: 10px;');
console.log('');

// ===================================
// TAX CHECKBOX STATE PERSISTENCE
// ===================================

function restoreTaxCheckboxState() {
    try {
        const taxCheckbox = document.getElementById('tax-enabled');
        if (taxCheckbox) {
            // Restore saved state from localStorage
            const savedState = localStorage.getItem('taxCheckboxState');
            if (savedState !== null) {
                taxCheckbox.checked = savedState === 'true';
                console.log('✅ Tax checkbox state restored:', taxCheckbox.checked);
            }
            
            // Save state whenever it changes
            taxCheckbox.addEventListener('change', function() {
                localStorage.setItem('taxCheckboxState', this.checked.toString());
                console.log('💾 Tax checkbox state saved:', this.checked);
            });
        }
    } catch (error) {
        console.error('Error restoring tax checkbox state:', error);
    }
}

// ===================================
// FRIENDLY NUMERIC INPUTS
// ===================================

function getNumericEntryMode(input) {
    const step = input.getAttribute('step') || '';
    const value = input.value || '';
    const placeholder = input.getAttribute('placeholder') || '';
    const allowsDecimal = step === 'any' || step.includes('.') || value.includes('.') || placeholder.includes('.');
    return allowsDecimal ? 'decimal' : 'integer';
}

function sanitizeNumericEntryValue(rawValue, mode, allowNegative) {
    const normalizedValue = String(rawValue || '').replace(/,/g, '.');
    let sanitized = '';
    let hasDecimalPoint = false;
    let hasMinus = false;
    
    for (const char of normalizedValue) {
        if (char >= '0' && char <= '9') {
            sanitized += char;
            continue;
        }
        
        if (mode === 'decimal' && char === '.' && !hasDecimalPoint) {
            sanitized += char;
            hasDecimalPoint = true;
            continue;
        }
        
        if (allowNegative && char === '-' && !hasMinus && sanitized.length === 0) {
            sanitized += char;
            hasMinus = true;
        }
    }
    
    return sanitized;
}

function normalizeFriendlyNumericInput(input, clampValue = false) {
    const mode = input.dataset.numericEntryMode || getNumericEntryMode(input);
    const minValue = parseFloat(input.dataset.numericMin ?? input.getAttribute('min'));
    const maxValue = parseFloat(input.dataset.numericMax ?? input.getAttribute('max'));
    const allowNegative = Number.isFinite(minValue) ? minValue < 0 : true;
    let sanitizedValue = sanitizeNumericEntryValue(input.value, mode, allowNegative);
    
    if (!clampValue) {
        input.value = sanitizedValue;
        return;
    }
    
    if (sanitizedValue === '' || sanitizedValue === '-' || sanitizedValue === '.' || sanitizedValue === '-.') {
        input.value = '';
        return;
    }
    
    if (mode === 'decimal' && sanitizedValue.endsWith('.')) {
        sanitizedValue = sanitizedValue.slice(0, -1);
    }
    
    let numericValue = mode === 'decimal' ? parseFloat(sanitizedValue) : parseInt(sanitizedValue, 10);
    if (!Number.isFinite(numericValue)) {
        input.value = '';
        return;
    }
    
    if (Number.isFinite(minValue)) {
        numericValue = Math.max(minValue, numericValue);
    }
    if (Number.isFinite(maxValue)) {
        numericValue = Math.min(maxValue, numericValue);
    }
    
    input.value = mode === 'decimal' ? String(numericValue) : String(Math.trunc(numericValue));
}

function upgradeNumericInput(input) {
    if (!input || input.dataset.numericEntryEnhanced === 'true') {
        return;
    }
    if (input.readOnly || input.disabled) {
        return;
    }
    
    input.dataset.numericEntryEnhanced = 'true';
    input.dataset.numericEntryMode = getNumericEntryMode(input);
    input.dataset.numericMin = input.getAttribute('min') || '';
    input.dataset.numericMax = input.getAttribute('max') || '';
    input.dataset.originalInputType = 'number';
    input.dataset.numericInput = 'true';
    input.classList.add('friendly-numeric-input');
    input.type = 'text';
    input.inputMode = input.dataset.numericEntryMode === 'decimal' ? 'decimal' : 'numeric';
    input.autocomplete = input.autocomplete || 'off';
    
    input.addEventListener('input', () => {
        normalizeFriendlyNumericInput(input, false);
    });
    input.addEventListener('blur', () => {
        normalizeFriendlyNumericInput(input, true);
    });
    
    normalizeFriendlyNumericInput(input, false);
}

function initializeFriendlyNumericInputs() {
    const upgradeAllNumericInputs = (root = document) => {
        root.querySelectorAll('input[type="number"]:not([readonly]):not([disabled])').forEach(upgradeNumericInput);
    };
    
    upgradeAllNumericInputs();
    
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (!(node instanceof HTMLElement)) {
                    return;
                }
                if (node.matches && node.matches('input[type="number"]:not([readonly]):not([disabled])')) {
                    upgradeNumericInput(node);
                }
                if (node.querySelectorAll) {
                    upgradeAllNumericInputs(node);
                }
            });
        });
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    console.log('✅ Friendly numeric input mode enabled');
}

// ===================================
// GLOBAL ENTER KEY NAVIGATION
// ===================================

function initializeEnterKeyNavigation() {
    // Add Enter key navigation to all forms
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
            const target = e.target;
            
            // Skip if target is a textarea (allow new lines)
            if (target.tagName === 'TEXTAREA') {
                return;
            }
            
            // Skip if target is a button or submit input
            if (target.tagName === 'BUTTON' || (target.tagName === 'INPUT' && target.type === 'submit')) {
                return;
            }
            
            // Skip if target is inside a modal (let modals handle their own Enter key behavior)
            if (target.closest('.modal')) {
                return;
            }
            
            // Skip customer name/phone inputs to prevent interference with typing
            if (target.id && (target.id.includes('customer-name') || target.id.includes('customer-phone'))) {
                return;
            }
            
            // Handle inputs and selects
            if (target.tagName === 'INPUT' || target.tagName === 'SELECT') {
                e.preventDefault();
                
                // Find the form
                const form = target.closest('form');
                if (form) {
                    // Get all focusable elements in the form
                    const focusableElements = Array.from(form.querySelectorAll(
                        'input:not([type="hidden"]):not([disabled]):not([readonly]), select:not([disabled]), textarea:not([disabled])'
                    ));
                    
                    const currentIndex = focusableElements.indexOf(target);
                    
                    if (currentIndex > -1 && currentIndex < focusableElements.length - 1) {
                        // Move to next field
                        focusableElements[currentIndex + 1].focus();
                    } else {
                        // Last field - submit form if valid
                        if (form.checkValidity()) {
                            // Find submit button and click it
                            const submitButton = form.querySelector('button[type="submit"], input[type="submit"]');
                            if (submitButton) {
                                submitButton.click();
                            } else {
                                form.requestSubmit();
                            }
                        } else {
                            // Form invalid - report validity
                            form.reportValidity();
                        }
                    }
                }
            }
        }
    }, true); // Use capture phase
    
    console.log('✅ Global Enter key navigation enabled');
}

// Run initialization immediately if DOM already loaded, or wait for it
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeEnterKeyNavigation);
} else {
    initializeEnterKeyNavigation();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeFriendlyNumericInputs);
} else {
    initializeFriendlyNumericInputs();
}

// ===================================
// SERVICE WORKER REGISTRATION & UPDATES
// ===================================

// Only register service worker in browser mode (not Electron/file:// protocol)
if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then((registration) => {
                console.log('✅ ServiceWorker registered:', registration);
                
                // Check for updates periodically
                setInterval(() => {
                    registration.update();
                }, 60000); // Check every minute
                
                // Listen for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    console.log('🔄 New ServiceWorker found, installing...');
                    
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New service worker available, show update notification
                            console.log('✅ New version available!');
                            showUpdateNotification();
                        }
                    });
                });
            })
            .catch((error) => {
                console.error('❌ ServiceWorker registration failed:', error);
            });
        
        // Listen for controller change (new SW activated)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('🔄 New ServiceWorker activated');
        });
    });
}

/**
 * Show update notification with reload button
 */
function showUpdateNotification() {
    const notification = document.createElement('div');
    notification.className = 'update-notification';
    notification.innerHTML = `
        <div class="update-content">
            <span class="update-icon">🔄</span>
            <span class="update-text">New version available!</span>
            <button class="update-reload-btn" onclick="location.reload()">Reload</button>
            <button class="update-dismiss-btn" onclick="this.closest('.update-notification').remove()">×</button>
        </div>
    `;
    
    // Add styles if not already present
    if (!document.getElementById('update-notification-styles')) {
        const style = document.createElement('style');
        style.id = 'update-notification-styles';
        style.textContent = `
            .update-notification {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: linear-gradient(135deg, #1C75BC, #00C2FF);
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                z-index: 10000;
                animation: slideIn 0.3s ease-out;
            }
            .update-content {
                display: flex;
                align-items: center;
                gap: 15px;
            }
            .update-icon {
                font-size: 24px;
            }
            .update-text {
                font-weight: 600;
            }
            .update-reload-btn {
                background: white;
                color: #1C75BC;
                border: none;
                padding: 8px 16px;
                border-radius: 5px;
                font-weight: 600;
                cursor: pointer;
                transition: transform 0.2s;
            }
            .update-reload-btn:hover {
                transform: scale(1.05);
            }
            .update-dismiss-btn {
                background: transparent;
                color: white;
                border: none;
                font-size: 24px;
                cursor: pointer;
                padding: 0 8px;
            }
            @keyframes slideIn {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Auto-dismiss after 30 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 30000);
}
