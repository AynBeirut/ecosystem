// ============================================================================
// AYN BEIRUT POS - DUAL CURRENCY FORMATTER
// ============================================================================
// Displays USD (primary calculation currency) with Lebanese Lira (LBP) equivalent
// LBP is display-only - all calculations remain in USD
// Exchange rate configurable from Company Info settings

/**
 * Currency configuration loaded from company_info table
 */
let currencyConfig = {
    showSecondary: true,              // Enable/disable LBP display
    exchangeRate: 89500,              // 1 USD = X LBP (Lebanese market rate)
    secondaryCurrency: 'LBP',         // Currency code
    secondaryPosition: 'after'        // 'before' or 'after' (unused for two-line format)
};

let currencyConfigLoadPromise = null;

/**
 * Format amount in dual currency (USD primary, LBP secondary)
 * Returns HTML string with two-line format:
 * $100.00
 * 8,950,000 LBP (smaller, gray text)
 * 
 * @param {Number} amountUSD - Amount in USD (primary currency)
 * @param {Object} options - Optional formatting options
 * @param {Boolean} options.showSymbol - Show $ symbol (default: true)
 * @param {Boolean} options.showSecondary - Override global showSecondary setting
 * @param {String} options.className - CSS class for secondary text (default: 'currency-secondary')
 * @returns {String} HTML string with formatted amounts
 */
function formatDualCurrency(amountUSD, options = {}) {
    // Handle null/undefined/NaN
    if (amountUSD === null || amountUSD === undefined || isNaN(amountUSD)) {
        amountUSD = 0;
    }
    
    // Ensure numeric
    amountUSD = parseFloat(amountUSD);
    
    // Format USD (primary currency)
    const showSymbol = options.showSymbol !== false; // default true
    const usdFormatted = showSymbol 
        ? '$' + amountUSD.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
        : amountUSD.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    
    // Check if secondary currency should be shown
    const shouldShowSecondary = options.showSecondary !== undefined 
        ? options.showSecondary 
        : currencyConfig.showSecondary;
    
    if (!shouldShowSecondary) {
        return usdFormatted;
    }
    
    // Calculate LBP equivalent (whole numbers, no decimals)
    const lbpAmount = Math.round(amountUSD * currencyConfig.exchangeRate);
    const lbpFormatted = lbpAmount.toLocaleString('en-US') + ' ' + currencyConfig.secondaryCurrency;
    
    // Get CSS class for secondary text
    const className = options.className || 'currency-secondary';
    
    // Return two-line format: USD prominent, LBP below in smaller/gray text
    return `${usdFormatted}<br><small class="${className}" style="color: #666; font-size: 0.85em;">${lbpFormatted}</small>`;
}

/**
 * Format amount for plain text display (receipts, exports)
 * Returns: $100.00 (8,950,000 LBP)
 * 
 * @param {Number} amountUSD - Amount in USD
 * @param {Object} options - Optional formatting options
 * @returns {String} Plain text formatted amount
 */
function formatDualCurrencyPlain(amountUSD, options = {}) {
    // Handle null/undefined/NaN
    if (amountUSD === null || amountUSD === undefined || isNaN(amountUSD)) {
        amountUSD = 0;
    }
    
    amountUSD = parseFloat(amountUSD);
    
    const showSymbol = options.showSymbol !== false;
    const usdFormatted = showSymbol 
        ? '$' + amountUSD.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
        : amountUSD.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    
    const shouldShowSecondary = options.showSecondary !== undefined 
        ? options.showSecondary 
        : currencyConfig.showSecondary;
    
    if (!shouldShowSecondary) {
        return usdFormatted;
    }
    
    const lbpAmount = Math.round(amountUSD * currencyConfig.exchangeRate);
    const lbpFormatted = lbpAmount.toLocaleString('en-US') + ' ' + currencyConfig.secondaryCurrency;
    
    return `${usdFormatted} (${lbpFormatted})`;
}

/**
 * Format LBP amount only (for secondary displays)
 * 
 * @param {Number} amountUSD - Amount in USD to convert
 * @returns {String} Formatted LBP amount
 */
function formatLBPOnly(amountUSD) {
    if (amountUSD === null || amountUSD === undefined || isNaN(amountUSD)) {
        amountUSD = 0;
    }
    
    const lbpAmount = Math.round(parseFloat(amountUSD) * currencyConfig.exchangeRate);
    return lbpAmount.toLocaleString('en-US') + ' ' + currencyConfig.secondaryCurrency;
}

/**
 * Load currency configuration from company_info table
 * Called on page load and when settings are updated
 */
async function waitForCurrencyConfigDatabase(timeoutMs = 10000) {
    if (window.DB_READY || window.DB_INSTANCE) {
        return true;
    }
    
    if (!window.dbReady || typeof window.dbReady.then !== 'function') {
        return false;
    }
    
    try {
        await Promise.race([
            window.dbReady,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Currency config DB wait timeout')), timeoutMs))
        ]);
        return !!(window.DB_READY || window.DB_INSTANCE);
    } catch (error) {
        console.warn('⚠️ Currency config using defaults until database is ready:', error.message);
        return false;
    }
}

async function loadCurrencyConfig() {
    if (currencyConfigLoadPromise) {
        return currencyConfigLoadPromise;
    }

    currencyConfigLoadPromise = (async () => {
    try {
        console.log('💱 Loading currency configuration...');

        if (typeof getCompanyInfo !== 'function') {
            console.warn('⚠️ getCompanyInfo is not available yet, using default currency config');
            return;
        }

        const databaseReady = await waitForCurrencyConfigDatabase();
        if (!databaseReady) {
            return;
        }
        
        // Get company info from database
        const companyInfo = await getCompanyInfo();
        
        if (companyInfo) {
            // Update config with database values (with fallbacks)
            currencyConfig.showSecondary = companyInfo.showSecondary !== 0; // SQLite INTEGER boolean
            currencyConfig.exchangeRate = companyInfo.exchangeRate || 89500;
            currencyConfig.secondaryCurrency = companyInfo.secondaryCurrency || 'LBP';
            currencyConfig.secondaryPosition = companyInfo.secondaryPosition || 'after';
            
            // Save to localStorage for customer display html
            try {
                localStorage.setItem('currencyConfig', JSON.stringify(currencyConfig));
            } catch (e) {
                console.warn('⚠️ Could not save currency config to localStorage:', e);
            }
            
            console.log('💱 Currency config loaded:', currencyConfig);
        } else {
            console.warn('⚠️ No company info found, using default currency config');
        }
    } catch (error) {
        if (String(error?.message || '').includes('Database not initialized')) {
            console.warn('⚠️ Currency config requested before database was ready, using defaults for now');
            return;
        }
        console.error('❌ Error loading currency config:', error);
        console.log('💱 Using default currency configuration');
    } finally {
        currencyConfigLoadPromise = null;
    }
    })();

    return currencyConfigLoadPromise;
}

/**
 * Update currency configuration (call after saving company settings)
 * Refreshes config and triggers UI update
 */
async function updateCurrencyConfig() {
    await loadCurrencyConfig();
    
    // Dispatch event to notify other components
    window.dispatchEvent(new CustomEvent('currencyConfigUpdated', { 
        detail: currencyConfig 
    }));
    
    console.log('💱 Currency configuration updated');
}

/**
 * Get current exchange rate
 * @returns {Number} Current exchange rate (1 USD = X LBP)
 */
function getExchangeRate() {
    return currencyConfig.exchangeRate;
}

/**
 * Check if secondary currency is enabled
 * @returns {Boolean} True if LBP display is enabled
 */
function isSecondaryCurrencyEnabled() {
    return currencyConfig.showSecondary;
}

/**
 * Format for PDF exports (multiline text)
 * Returns object with USD and LBP values separately
 * 
 * @param {Number} amountUSD - Amount in USD
 * @returns {Object} {usd: '100.00', lbp: '8,950,000', formatted: 'USD\nLBP'}
 */
function formatDualCurrencyPDF(amountUSD) {
    if (amountUSD === null || amountUSD === undefined || isNaN(amountUSD)) {
        amountUSD = 0;
    }
    
    amountUSD = parseFloat(amountUSD);
    
    const usdFormatted = '$' + amountUSD.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    
    if (!currencyConfig.showSecondary) {
        return {
            usd: usdFormatted,
            lbp: null,
            formatted: usdFormatted
        };
    }
    
    const lbpAmount = Math.round(amountUSD * currencyConfig.exchangeRate);
    const lbpFormatted = lbpAmount.toLocaleString('en-US') + ' ' + currencyConfig.secondaryCurrency;
    
    return {
        usd: usdFormatted,
        lbp: lbpFormatted,
        formatted: usdFormatted + '\n' + lbpFormatted
    };
}

/**
 * Format for Excel exports
 * Returns object with separate USD and LBP numeric values
 * 
 * @param {Number} amountUSD - Amount in USD
 * @returns {Object} {usd: 100.00, lbp: 8950000}
 */
function formatDualCurrencyExcel(amountUSD) {
    if (amountUSD === null || amountUSD === undefined || isNaN(amountUSD)) {
        amountUSD = 0;
    }
    
    amountUSD = parseFloat(amountUSD);
    
    if (!currencyConfig.showSecondary) {
        return {
            usd: amountUSD,
            lbp: null
        };
    }
    
    const lbpAmount = Math.round(amountUSD * currencyConfig.exchangeRate);
    
    return {
        usd: amountUSD,
        lbp: lbpAmount
    };
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Load configuration when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadCurrencyConfig);
} else {
    // DOM already loaded
    loadCurrencyConfig();
}

// Reload config when user profile changes (login/logout)
window.addEventListener('userProfileChanged', loadCurrencyConfig);

console.log('💱 Dual Currency Formatter loaded');
