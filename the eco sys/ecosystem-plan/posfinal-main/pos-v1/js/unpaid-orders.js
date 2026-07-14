/**
 * Unpaid Orders Module
 * Manage orders that are placed but not yet paid
 */

let unpaidOrdersCache = [];
let unpaidOrdersRefreshInterval = null;
const UNPAID_ORDERS_REFRESH_MS = 30000;
const UNPAID_ORDER_TAX_RATE = 0.11;

function stopUnpaidOrdersLiveRefresh() {
    if (unpaidOrdersRefreshInterval) {
        clearInterval(unpaidOrdersRefreshInterval);
        unpaidOrdersRefreshInterval = null;
    }
}

function startUnpaidOrdersLiveRefresh() {
    stopUnpaidOrdersLiveRefresh();

    unpaidOrdersRefreshInterval = setInterval(() => {
        const modal = document.getElementById('unpaid-orders-modal');
        if (!modal || !modal.classList.contains('active')) {
            stopUnpaidOrdersLiveRefresh();
            return;
        }

        renderUnpaidOrdersList();
    }, UNPAID_ORDERS_REFRESH_MS);
}

function getEffectiveUnpaidServiceStartTime(timer, orderTimestamp = null) {
    const timerStartTime = Number(timer?.startTime) || 0;
    const orderStartTime = Number(orderTimestamp) || 0;

    if (timerStartTime > 0 && orderStartTime > 0) {
        return Math.max(timerStartTime, orderStartTime);
    }

    return timerStartTime || orderStartTime || Date.now();
}

function normalizeUnpaidOrderItem(item, orderTimestamp = null) {
    if (typeof window.normalizeCartItem === 'function') {
        const normalized = window.normalizeCartItem({ ...item });
        if (Array.isArray(normalized.serviceTimers)) {
            normalized.serviceTimers = normalized.serviceTimers.map(timer => ({
                ...timer,
                startTime: getEffectiveUnpaidServiceStartTime(timer, orderTimestamp)
            }));
        }
        return normalized;
    }

    const normalized = {
        ...item,
        price: parseFloat(item.price) || 0,
        quantity: Math.max(1, parseInt(item.quantity, 10) || 1)
    };

    if (Array.isArray(normalized.serviceTimers)) {
        normalized.serviceTimers = normalized.serviceTimers.map(timer => ({
            ...timer,
            startTime: getEffectiveUnpaidServiceStartTime(timer, orderTimestamp)
        }));
    }

    return normalized;
}

function getLiveTimerPeriods(timer, fallbackPeriodMinutes = 60, orderTimestamp = null) {
    const startTime = getEffectiveUnpaidServiceStartTime(timer, orderTimestamp);
    const periodMinutes = Math.max(1, parseInt(timer?.periodMinutes, 10) || fallbackPeriodMinutes);
    const elapsedMs = Math.max(0, Date.now() - startTime);
    return Math.max(1, Math.ceil(elapsedMs / (1000 * 60 * periodMinutes)));
}

function calculateUnpaidOrderItemTotal(item, orderTimestamp = null) {
    const normalizedItem = normalizeUnpaidOrderItem(item, orderTimestamp);

    if (!normalizedItem.isHourlyService || !Array.isArray(normalizedItem.serviceTimers) || normalizedItem.serviceTimers.length === 0) {
        return normalizedItem.price * normalizedItem.quantity;
    }

    return normalizedItem.serviceTimers.reduce((total, timer) => {
        const firstPeriodRate = parseFloat(timer?.firstHourRate) || normalizedItem.price;
        const additionalPeriodRate = parseFloat(timer?.additionalHourRate) || normalizedItem.additionalHourRate || normalizedItem.price;
        const periods = getLiveTimerPeriods(timer, normalizedItem.serviceDuration, orderTimestamp);

        if (periods <= 1) {
            return total + firstPeriodRate;
        }

        return total + firstPeriodRate + ((periods - 1) * additionalPeriodRate);
    }, 0);
}

function getLiveUnpaidOrderTotals(order) {
    const savedTotals = order?.totals || {};

    if (!Array.isArray(order?.items) || order.items.length === 0 || order.source === 'partial_payment') {
        return savedTotals;
    }

    const subtotal = order.items.reduce((sum, item) => sum + calculateUnpaidOrderItemTotal(item, order.timestamp), 0);
    const discountPercent = parseFloat(savedTotals.discountPercent) || 0;
    const discount = subtotal * (discountPercent / 100);
    const afterDiscount = Math.max(0, subtotal - discount);
    const taxEnabled = !!savedTotals.taxEnabled;
    const tax = taxEnabled ? afterDiscount * UNPAID_ORDER_TAX_RATE : 0;
    const total = afterDiscount + tax;

    return {
        ...savedTotals,
        subtotal,
        discount,
        discountPercent,
        taxEnabled,
        tax,
        total
    };
}

function orderHasLiveHourlyPricing(order) {
    return order?.source !== 'partial_payment' && Array.isArray(order?.items) && order.items.some(item => item?.isHourlyService || (Array.isArray(item?.serviceTimers) && item.serviceTimers.length > 0));
}

function getUnpaidOrderCustomerInfo(order) {
    return {
        customerName: order?.customerInfo?.name || order?.customerName || 'Walk-in Customer',
        customerPhone: order?.customerInfo?.phone || order?.customerPhone || ''
    };
}

function applyUnpaidOrderContext(orderId, order, options = {}) {
    const { editable = false, paymentMode = false } = options;
    const customerInfo = getUnpaidOrderCustomerInfo(order);
    const customerNameInput = document.getElementById('customer-name');
    const customerPhoneInput = document.getElementById('customer-phone');

    window.activeUnpaidOrderContext = {
        orderId,
        customerName: customerInfo.customerName,
        customerPhone: customerInfo.customerPhone,
        editable,
        paymentMode
    };

    if (customerNameInput) {
        customerNameInput.value = customerInfo.customerName === 'Walk-in Customer' ? '' : customerInfo.customerName;
    }

    if (customerPhoneInput) {
        customerPhoneInput.value = customerInfo.customerPhone;
    }

    if (typeof window.setCustomerSelectionDraft === 'function') {
        window.setCustomerSelectionDraft({
            name: customerInfo.customerName,
            phone: customerInfo.customerPhone
        });
    }

    if (editable) {
        window.editingUnpaidOrderId = orderId;
    } else if (window.editingUnpaidOrderId === orderId) {
        delete window.editingUnpaidOrderId;
    }

    if (paymentMode) {
        window.currentUnpaidOrderId = orderId;
    } else if (window.currentUnpaidOrderId === orderId) {
        window.currentUnpaidOrderId = null;
    }
}

function clearActiveUnpaidOrderContext() {
    delete window.activeUnpaidOrderContext;
    delete window.editingUnpaidOrderId;

    const customerNameInput = document.getElementById('customer-name');
    const customerPhoneInput = document.getElementById('customer-phone');

    if (customerNameInput) {
        customerNameInput.value = '';
    }

    if (customerPhoneInput) {
        customerPhoneInput.value = '';
    }

    if (typeof window.setCustomerSelectionDraft === 'function') {
        window.setCustomerSelectionDraft({ name: '', phone: '' });
    }
}

/**
 * Initialize unpaid orders system
 */
async function initUnpaidOrders() {
    await loadUnpaidOrders();
    updateUnpaidOrdersBadge();
    console.log('✅ Unpaid orders system initialized');
}

/**
 * Load unpaid orders from database
 */
async function loadUnpaidOrders() {
    try {
        unpaidOrdersCache = await getAllUnpaidOrders();
        console.log(`📋 Loaded ${unpaidOrdersCache.length} unpaid orders`);
        return unpaidOrdersCache;
    } catch (error) {
        console.error('Failed to load unpaid orders:', error);
        return [];
    }
}

/**
 * Place an order without payment
 */
async function placeUnpaidOrder(orderData) {
    try {
        const orderId = await saveUnpaidOrder(orderData);
        await loadUnpaidOrders();
        updateUnpaidOrdersBadge();
        
        showNotification('Order Placed', `Order #${orderId} saved successfully`, 'success');
        console.log('✅ Unpaid order placed:', orderId);
        
        return orderId;
    } catch (error) {
        console.error('Failed to place unpaid order:', error);
        showNotification('Error', 'Failed to place order', 'error');
        throw error;
    }
}

/**
 * Show unpaid orders modal
 */
function showUnpaidOrdersModal() {
    const modal = document.getElementById('unpaid-orders-modal');
    if (!modal) {
        console.error('Unpaid orders modal not found');
        return;
    }
    
    // Load unpaid orders before rendering
    loadUnpaidOrders().then(() => {
        renderUnpaidOrdersList();
        modal.classList.add('active');
        startUnpaidOrdersLiveRefresh();
    });
}

/**
 * Close unpaid orders modal
 */
function closeUnpaidOrdersModal() {
    const modal = document.getElementById('unpaid-orders-modal');
    if (modal) {
        modal.classList.remove('active');
    }
    stopUnpaidOrdersLiveRefresh();
}

/**
 * Render unpaid orders list
 */
function renderUnpaidOrdersList() {
    const container = document.getElementById('unpaid-orders-list');
    if (!container) return;
    
    if (unpaidOrdersCache.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📋</div>
                <p>No unpaid orders</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = unpaidOrdersCache.map(order => {
        const orderDate = new Date(order.timestamp);
        const timeAgo = getTimeAgo(order.timestamp);
        const liveTotals = getLiveUnpaidOrderTotals(order);
        const hasLiveHourlyPricing = orderHasLiveHourlyPricing(order);
        
        return `
            <div class="unpaid-order-card" data-order-id="${order.id}">
                <div class="order-header">
                    <div class="order-number">${order.source === 'partial_payment' ? `Receipt #${order.receiptNumber}` : `Order #${order.id}`}</div>
                    <div class="order-time">${timeAgo}</div>
                </div>
                <div class="order-customer">
                    <strong>${order.customerInfo?.name || order.customerName || 'Walk-in Customer'}</strong>
                    ${order.customerInfo?.phone || order.customerPhone ? `<span>${order.customerInfo?.phone || order.customerPhone}</span>` : ''}
                </div>
                <div class="order-items">
                    ${order.items.slice(0, 3).map(item => `
                        <div class="order-item">
                            <span>${item.name}</span>
                            <span>×${item.quantity}</span>
                        </div>
                    `).join('')}
                    ${order.items.length > 3 ? `<div class="order-item-more">+${order.items.length - 3} more items</div>` : ''}
                </div>
                <div class="order-footer">
                    <div class="order-total">
                        <strong>Total:</strong> $${(liveTotals.total || 0).toFixed(2)}
                        ${hasLiveHourlyPricing ? `
                        <div style="font-size: 12px; color: #ff9800; margin-top: 4px; font-weight: 600;">
                            ⏱️ Live hourly total
                        </div>
                        ` : ''}
                        ${order.source === 'partial_payment' && order.remainingBalance > 0 ? `
                        <div style="font-size: 12px; color: #dc3545; margin-top: 4px; font-weight: bold;">
                            ⚠️ Balance Due: $${order.remainingBalance.toFixed(2)}
                        </div>
                        <div style="font-size: 11px; color: #28a745; margin-top: 2px;">
                            Paid: $${order.downPayment.toFixed(2)}
                        </div>
                        ` : ''}
                        ${liveTotals.discountPercent > 0 ? `
                        <div style="font-size: 12px; color: #28a745; margin-top: 2px;">
                            💰 Discount: ${liveTotals.discountPercent.toFixed(0)}% off
                        </div>
                        ` : ''}
                        ${liveTotals ? `
                        <div style="font-size: 12px; color: #666; margin-top: 2px;">
                            ${liveTotals.taxEnabled ? '✅ Tax: Yes' : '❌ Tax: No'}
                        </div>
                        ` : ''}
                    </div>
                    <div class="order-actions">
                        <button class="btn btn-sm btn-success" onclick="${order.source === 'partial_payment' ? `receivePartialPayment(${order.id}, ${order.remainingBalance}, '${order.receiptNumber}')` : `payUnpaidOrder(${order.id})`}">
                            💳 ${order.source === 'partial_payment' ? 'Pay Balance' : 'Pay Now'}
                        </button>
                        ${order.source !== 'partial_payment' ? `
                        <button class="btn btn-sm btn-primary" onclick="editUnpaidOrder(${order.id})">
                            ✏️ Edit
                        </button>
                        ` : ''}
                        <button class="btn btn-sm btn-secondary" onclick="viewUnpaidOrder(${order.id})">
                            👁️ View
                        </button>
                        ${order.source !== 'partial_payment' ? `
                        <button class="btn btn-sm btn-danger" onclick="deleteUnpaidOrderConfirm(${order.id})">
                            🗑️
                        </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * View unpaid order details
 */
function loadOrderItemsIntoCart(items, options = {}) {
    const { orderTimestamp = null } = options;
    cart.length = 0;
    
    items.forEach(item => {
        cart.push(normalizeUnpaidOrderItem(item, orderTimestamp));
    });
    
    if (typeof saveCartToStorage === 'function') {
        saveCartToStorage({
            restoreOnStartup: false,
            source: 'unpaid-order'
        });
    }
    
    updateCart();
    
    if (typeof refreshServiceTimerState === 'function') {
        refreshServiceTimerState(true);
    }
}

async function viewUnpaidOrder(orderId) {
    try {
        const order = await getUnpaidOrderById(orderId);
        if (!order) {
            showNotification('Error', 'Order not found', 'error');
            return;
        }
        
        // Load order into cart
        loadOrderItemsIntoCart(order.items, { orderTimestamp: order.timestamp });
        applyUnpaidOrderContext(orderId, order, { editable: true });
        if (typeof updateCustomerDisplay === 'function') {
            updateCustomerDisplay();
        }
        closeUnpaidOrdersModal();
        
        showNotification('Order Loaded', `Order #${orderId} loaded into cart`, 'info');
    } catch (error) {
        console.error('Failed to view order:', error);
        showNotification('Error', 'Failed to load order', 'error');
    }
}

/**
 * Edit an unpaid order
 */
async function editUnpaidOrder(orderId) {
    try {
        const order = await getUnpaidOrderById(orderId);
        if (!order) {
            showNotification('Error', 'Order not found', 'error');
            return;
        }
        
        // Load order into cart
        loadOrderItemsIntoCart(order.items, { orderTimestamp: order.timestamp });
        applyUnpaidOrderContext(orderId, order, { editable: true });
        
        // Restore discount and tax settings from order (EDITABLE)
        const discountInput = document.getElementById('discount-amount');
        const taxCheckbox = document.getElementById('tax-enabled');
        
        if (discountInput && order.totals?.discountPercent !== undefined) {
            discountInput.value = order.totals.discountPercent;
            discountInput.disabled = false;
        }
        
        if (taxCheckbox && order.totals?.taxEnabled !== undefined) {
            taxCheckbox.checked = order.totals.taxEnabled;
            taxCheckbox.disabled = false;
        }
        
        if (typeof updateCustomerDisplay === 'function') {
            updateCustomerDisplay();
        }
        closeUnpaidOrdersModal();
        
        showNotification('Order Loaded', 'Make changes and click "Place Order" to update', 'info');
    } catch (error) {
        console.error('Failed to edit order:', error);
        showNotification('Error', 'Failed to load order for editing', 'error');
    }
}

/**
 * Pay for an unpaid order
 */
async function payUnpaidOrder(orderId) {
    try {
        const order = await getUnpaidOrderById(orderId);
        if (!order) {
            showNotification('Error', 'Order not found', 'error');
            return;
        }
        
        // Load order into cart
        loadOrderItemsIntoCart(order.items, { orderTimestamp: order.timestamp });
        applyUnpaidOrderContext(orderId, order, { paymentMode: true });
        
        // Restore discount and tax settings from order (LOCKED)
        const discountInput = document.getElementById('discount-amount');
        const taxCheckbox = document.getElementById('tax-enabled');
        
        if (discountInput && order.totals?.discountPercent !== undefined) {
            discountInput.value = order.totals.discountPercent;
            discountInput.disabled = true;
            discountInput.style.backgroundColor = '#f0f0f0';
            discountInput.title = 'Locked from original order';
        }
        
        if (taxCheckbox && order.totals?.taxEnabled !== undefined) {
            taxCheckbox.checked = order.totals.taxEnabled;
            taxCheckbox.disabled = true;
            taxCheckbox.title = 'Locked from original order';
        }
        
        if (typeof updateCustomerDisplay === 'function') {
            updateCustomerDisplay();
        }
        closeUnpaidOrdersModal();
        
        // Open payment modal with pre-filled customer info
        openPaymentModal();
        
        showNotification('Order Loaded', '🔒 Discount/tax locked. Complete payment to finalize order', 'info');
    } catch (error) {
        console.error('Failed to load order for payment:', error);
        showNotification('Error', 'Failed to load order', 'error');
    }
}

/**
 * Delete unpaid order with confirmation
 */
function deleteUnpaidOrderConfirm(orderId) {
    if (confirm('Are you sure you want to delete this order? This action cannot be undone.')) {
        deleteUnpaidOrderNow(orderId);
    }
}

/**
 * Delete unpaid order
 */
async function deleteUnpaidOrderNow(orderId) {
    try {
        await deleteUnpaidOrder(orderId);
        await loadUnpaidOrders();
        renderUnpaidOrdersList();
        updateUnpaidOrdersBadge();
        
        showNotification('Order Deleted', 'Unpaid order removed', 'success');
    } catch (error) {
        console.error('Failed to delete order:', error);
        showNotification('Error', 'Failed to delete order', 'error');
    }
}

/**
 * Update unpaid orders badge
 */
function updateUnpaidOrdersBadge() {
    const badge = document.getElementById('unpaid-orders-badge');
    if (!badge) return;
    
    const count = unpaidOrdersCache.length;
    
    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

/**
 * Get time ago string
 */
function getTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    
    return new Date(timestamp).toLocaleDateString();
}

/**
 * After payment completion, delete the unpaid order if it exists
 */
async function cleanupPaidOrder() {
    if (window.currentUnpaidOrderId) {
        try {
            await deleteUnpaidOrder(window.currentUnpaidOrderId);
            await loadUnpaidOrders();
            updateUnpaidOrdersBadge();
            console.log('✅ Paid order removed from unpaid list');
            window.currentUnpaidOrderId = null;
            clearActiveUnpaidOrderContext();
        } catch (error) {
            console.error('Failed to cleanup paid order:', error);
        }
    }
}

// Export functions
window.initUnpaidOrders = initUnpaidOrders;
window.loadUnpaidOrders = loadUnpaidOrders;
window.placeUnpaidOrder = placeUnpaidOrder;
window.showUnpaidOrdersModal = showUnpaidOrdersModal;
window.closeUnpaidOrdersModal = closeUnpaidOrdersModal;
window.viewUnpaidOrder = viewUnpaidOrder;
window.payUnpaidOrder = payUnpaidOrder;
window.deleteUnpaidOrderConfirm = deleteUnpaidOrderConfirm;
window.cleanupPaidOrder = cleanupPaidOrder;
window.clearActiveUnpaidOrderContext = clearActiveUnpaidOrderContext;

// Attach menu button click handler when script loads
const unpaidOrdersBtn = document.getElementById('unpaid-orders-btn');
if (unpaidOrdersBtn) {
    unpaidOrdersBtn.addEventListener('click', showUnpaidOrdersModal);
    console.log('✅ Unpaid orders menu button handler attached');
}
