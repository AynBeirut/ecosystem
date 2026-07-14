/**
 * Customer Display Module
 * Opens and syncs a customer-facing display window
 */

let customerDisplayWindow = null;

// Display configuration
let displayConfig = {
    mode: 'full', // full, price-only, items-prices
    location: 'auto', // auto, primary, secondary
    fullscreen: false,
    fontSize: 'medium'
};

/**
 * Initialize customer display functionality
 */
function initCustomerDisplay() {
    const displayBtn = document.getElementById('customer-display-btn');
    const themeDropdown = document.getElementById('theme-dropdown');
    const openDisplayBtn = document.getElementById('open-customer-display');
    
    // Toggle dropdown on button click
    displayBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        themeDropdown.classList.toggle('show');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.customer-display-container')) {
            themeDropdown.classList.remove('show');
        }
    });
    
    // Open display settings modal instead of directly opening display
    openDisplayBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openDisplaySettingsModal();
        themeDropdown.classList.remove('show');
    });
    
    // Sync cart changes to customer display
    window.addEventListener('cart-updated', syncCartToDisplay);
    
    // Check if display window is still open periodically
    setInterval(checkDisplayWindow, 3000);
}

/**
 * Open display settings modal
 */
function openDisplaySettingsModal() {
    const modal = document.getElementById('display-settings-modal');
    if (modal) {
        modal.classList.add('show');
        
        // Load saved settings
        const saved = localStorage.getItem('customerDisplayConfig');
        if (saved) {
            displayConfig = JSON.parse(saved);
            document.getElementById('display-mode-select').value = displayConfig.mode;
            document.getElementById('display-location-select').value = displayConfig.location;
            document.getElementById('display-fullscreen').checked = displayConfig.fullscreen;
            document.getElementById('display-fontsize').value = displayConfig.fontSize;
        }
        
        updateDisplayPreview();
    }
}

/**
 * Close display settings modal
 */
function closeDisplaySettings() {
    const modal = document.getElementById('display-settings-modal');
    if (modal) {
        modal.classList.remove('show');
    }
}

/**
 * Update preview in settings modal
 */
function updateDisplayPreview() {
    const mode = document.getElementById('display-mode-select')?.value || 'full';
    const fontSize = document.getElementById('display-fontsize')?.value || 'medium';
    const preview = document.querySelector('.display-preview-content');
    
    if (!preview) return;
    
    const fontSizes = {
        small: '16px',
        medium: '24px',
        large: '32px',
        xlarge: '48px'
    };
    
    let html = '';
    if (mode === 'full') {
        html = `
            <div style="font-size: ${fontSizes[fontSize]};">
                <div>Item 1 x2 - $20.00</div>
                <div>Item 2 x1 - $15.00</div>
                <hr style="border-color: #ddd; margin: 10px 0;">
                <div><strong>Total: $35.00</strong></div>
            </div>
        `;
    } else if (mode === 'price-only') {
        html = `
            <div style="font-size: calc(${fontSizes[fontSize]} * 2); font-weight: bold; color: #1C75BC;">
                $35.00
            </div>
        `;
    } else {
        html = `
            <div style="font-size: ${fontSizes[fontSize]};">
                <div>Item 1 - $20.00</div>
                <div>Item 2 - $15.00</div>
                <hr style="border-color: #ddd; margin: 10px 0;">
                <div><strong>Total: $35.00</strong></div>
            </div>
        `;
    }
    
    preview.innerHTML = html;
}

/**
 * Save settings and open display
 */
function saveDisplaySettings() {
    displayConfig = {
        mode: document.getElementById('display-mode-select').value,
        location: document.getElementById('display-location-select').value,
        fullscreen: document.getElementById('display-fullscreen').checked,
        fontSize: document.getElementById('display-fontsize').value
    };
    
    localStorage.setItem('customerDisplayConfig', JSON.stringify(displayConfig));
    closeDisplaySettings();
    openCustomerDisplay();
}

/**
 * Open the customer display in a new window
 */
async function openCustomerDisplay() {
    // Load config
    const saved = localStorage.getItem('customerDisplayConfig');
    if (saved) {
        displayConfig = JSON.parse(saved);
    }
    
    // Check if running in Electron
    if (window.electronAPI && typeof window.electronAPI.openCustomerDisplay === 'function') {
        // Use Electron API
        try {
            const result = await window.electronAPI.openCustomerDisplay(displayConfig);
            if (result.success) {
                showNotification('Customer display opened successfully!', 'success');
                console.log(`Opened on display ${result.displayCount > 1 ? '(multiple monitors detected)' : ''}`);
            } else {
                showNotification('Failed to open customer display: ' + result.error, 'error');
            }
        } catch (error) {
            console.error('Electron display error:', error);
            showNotification('Failed to open customer display: ' + error.message, 'error');
        }
    } else {
        // Fallback to browser window.open
        const displayUrl = `customer-display.html?mode=${displayConfig.mode}&fontSize=${displayConfig.fontSize}`;
        const windowFeatures = 'width=800,height=600,left=100,top=100,resizable=yes,scrollbars=no';
        
        // Check if window is already open
        if (customerDisplayWindow && !customerDisplayWindow.closed) {
            customerDisplayWindow.focus();
            return;
        }
        
        customerDisplayWindow = window.open(displayUrl, 'CustomerDisplay', windowFeatures);
        
        if (customerDisplayWindow) {
            setTimeout(() => syncCartToDisplay(), 500);
            showNotification('Customer display opened in browser window', 'success');
        } else {
            showNotification('Failed to open customer display. Please allow popups.', 'error');
        }
    }
}

/**
 * Sync current cart to customer display
 */
function syncCartToDisplay() {
    const cartData = getCurrentCart();
    
    // Store in localStorage for the customer display to read
    localStorage.setItem('customer-display-cart', JSON.stringify(cartData));
    
    // If window is open, also send via postMessage
    if (customerDisplayWindow && !customerDisplayWindow.closed) {
        try {
            customerDisplayWindow.postMessage({
                type: 'cart-update',
                cart: cartData
            }, '*');
        } catch (error) {
            console.error('Failed to sync to customer display:', error);
        }
    }
}

/**
 * Get current cart data for display
 */
function getCurrentCart() {
    return cart.map(item => ({
        id: item.id,
        name: item.name,
        icon: item.icon,
        price: item.price,
        quantity: item.quantity,
        category: item.category
    }));
}

/**
 * Check if display window is still open
 */
function checkDisplayWindow() {
    if (customerDisplayWindow && customerDisplayWindow.closed) {
        customerDisplayWindow = null;
    }
}

/**
 * Clear customer display (on checkout)
 */
function clearCustomerDisplay() {
    localStorage.setItem('customer-display-cart', JSON.stringify([]));
    
    if (customerDisplayWindow && !customerDisplayWindow.closed) {
        customerDisplayWindow.postMessage({
            type: 'cart-update',
            cart: []
        }, '*');
    }
}

// Auto-attach menu button handler when this script loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachCustomerDisplayMenuButton);
} else {
    attachCustomerDisplayMenuButton();
}

function attachCustomerDisplayMenuButton() {
    const menuBtn = document.getElementById('customer-display-menu-btn');
    if (menuBtn && !menuBtn.dataset.handlerAttached) {
        menuBtn.addEventListener('click', () => {
            if (window.dropdownManager) {
                window.dropdownManager.closeAll();
            }
            openDisplaySettingsModal();
        });
        menuBtn.dataset.handlerAttached = 'true';
        console.log('✅ Customer display menu button handler attached');
    }
}
