# Partial Payment Feature - Implementation Changes

## Files Created:
1. ✅ migrations/019-partial-payments.sql - Database migration
2. ✅ js/partial-payments.js - Partial payments management module

## Files That Need Manual Updates:

### 1. migrations/bundle-migrations.js
Add this entry after line 23 (after the last migration entry):
```javascript
    { num: 19, file: '019-partial-payments.sql', desc: 'Add partial payment support with down payments and balance tracking' }
```

### 2. index.html - Add Partial Payment UI (around line 320)
Replace the Cash Payment Section starting at line 320 with:

```html
                <!-- Cash Payment Section -->
                <div id="cash-payment-section" class="payment-section active">
                    <h3>Cash Payment</h3>
                    
                    <!-- Partial Payment Option -->
                    <div class="partial-payment-option" style="margin-bottom: 16px; padding: 12px; background: #f8f9fa; border-radius: 8px;">
                        <label style="display: flex; align-items: center; cursor: pointer; font-size: 14px;">
                            <input type="checkbox" id="partial-payment-checkbox" style="margin-right: 8px; width: 18px; height: 18px; cursor: pointer;">
                            <span style="font-weight: 600;">💰 Partial Payment (Down Payment)</span>
                        </label>
                        <div id="partial-payment-info" style="display: none; margin-top: 12px; padding-top: 12px; border-top: 1px solid #dee2e6;">
                            <div class="form-group" style="margin-bottom: 12px;">
                                <label for="down-payment-amount" style="display: block; margin-bottom: 6px; font-size: 13px; color: #666;">Down Payment Amount:</label>
                                <div class="cash-input-wrapper">
                                    <span class="currency-symbol">$</span>
                                    <input type="text" id="down-payment-amount" inputmode="decimal" placeholder="0.00" autocomplete="off">
                                </div>
                            </div>
                            <div style="font-size: 12px; color: #666; padding: 8px; background: #fff; border-radius: 4px; border-left: 3px solid #28a745;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                                    <span>Total Amount:</span>
                                    <span id="partial-total-amount" style="font-weight: 600;">$0.00</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                                    <span>Down Payment:</span>
                                    <span id="partial-down-payment" style="font-weight: 600; color: #28a745;">$0.00</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; padding-top: 4px; border-top: 1px solid #e9ecef;">
                                    <span style="font-weight: 700;">Remaining Balance:</span>
                                    <span id="partial-remaining-balance" style="font-weight: 700; color: #dc3545;">$0.00</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="cash-input-group">
                        <label for="cash-received">Amount Received:</label>
                        <div class="cash-input-wrapper">
                            <span class="currency-symbol">$</span>
                            <input type="text" id="cash-received" inputmode="decimal" placeholder="0.00" autocomplete="off">
                        </div>
                    </div>
```

### 3. index.html - Add Partial Payments Modal (before closing body tag, around line 3100)
Add this modal:

```html
    <!-- Partial Payments Modal -->
    <div id="partial-payments-modal" class="modal">
        <div class="modal-content" style="max-width: 900px;">
            <div class="modal-header">
                <h2>💰 Partial Payments Management</h2>
                <button type="button" class="modal-close" onclick="closePartialPaymentsModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div id="partial-payments-list">Loading...</div>
            </div>
        </div>
    </div>
```

### 4. index.html - Add Menu Button (around line 100, in the menu dropdown)
Add this button in the menu dropdown:

```html
                        <button id="partial-payments-btn" class="menu-dropdown-item" onclick="showPartialPaymentsModal();">
                            <span class="menu-item-icon">💰</span>
                            <span>Partial Payments</span>
                        </button>
```

### 5. index.html - Add Script Reference (after line 3125, after payment.js)
Add:
```html
    <script src="js/partial-payments.js?v=1"></script>
```

### 6. js/payment.js - Add Variables (at the top, around line 10)
Add these variables:
```javascript
let isPartialPayment = false;
let downPaymentAmount = 0;
```

### 7. js/payment.js - Update initPayment() function (around line 110)
Add these event listeners inside initPayment():
```javascript
    // Partial payment checkbox
    const partialCheckbox = document.getElementById('partial-payment-checkbox');
    const downPaymentInput = document.getElementById('down-payment-amount');
    
    if (partialCheckbox) {
        partialCheckbox.addEventListener('change', handlePartialPaymentToggle);
    }
    
    if (downPaymentInput) {
        downPaymentInput.addEventListener('input', calculatePartialPayment);
    }
```

### 8. js/payment.js - Add New Functions (after initPayment, around line 140)
Add these functions:

```javascript
/**
 * Handle partial payment checkbox toggle
 */
function handlePartialPaymentToggle() {
    const checkbox = document.getElementById('partial-payment-checkbox');
    const partialInfo = document.getElementById('partial-payment-info');
    
    isPartialPayment = checkbox.checked;
    
    if (isPartialPayment) {
        partialInfo.style.display = 'block';
        updatePartialPaymentDisplay();
    } else {
        partialInfo.style.display = 'none';
        downPaymentAmount = 0;
    }
}

/**
 * Calculate partial payment amounts
 */
function calculatePartialPayment() {
    const downPaymentInput = document.getElementById('down-payment-amount');
    downPaymentAmount = parseFloat(downPaymentInput.value) || 0;
    
    // Validate down payment
    if (downPaymentAmount > paymentTotal) {
        downPaymentAmount = paymentTotal;
        downPaymentInput.value = paymentTotal.toFixed(2);
    }
    
    if (downPaymentAmount < 0) {
        downPaymentAmount = 0;
        downPaymentInput.value = '0.00';
    }
    
    updatePartialPaymentDisplay();
}

/**
 * Update partial payment display
 */
function updatePartialPaymentDisplay() {
    document.getElementById('partial-total-amount').textContent = `$${paymentTotal.toFixed(2)}`;
    document.getElementById('partial-down-payment').textContent = `$${downPaymentAmount.toFixed(2)}`;
    document.getElementById('partial-remaining-balance').textContent = `$${(paymentTotal - downPaymentAmount).toFixed(2)}`;
}
```

### 9. js/payment.js - Update openPaymentModal() (around line 200)
Add at the end of the function, before closing:
```javascript
    // Reset partial payment
    isPartialPayment = false;
    downPaymentAmount = 0;
    const partialCheckbox = document.getElementById('partial-payment-checkbox');
    const partialInfo = document.getElementById('partial-payment-info');
    if (partialCheckbox) partialCheckbox.checked = false;
    if (partialInfo) partialInfo.style.display = 'none';
```

### 10. js/payment.js - Update processPayment() (around line 420)
Replace the cash payment section with:

```javascript
        if (currentPaymentMethod === 'cash') {
            let cashReceived = parseFloat(document.getElementById('cash-received').value);
            
            // Handle partial payment
            if (isPartialPayment) {
                const downPayment = parseFloat(document.getElementById('down-payment-amount').value) || 0;
                
                if (downPayment <= 0) {
                    showPaymentNotification('Please enter a down payment amount', 'error');
                    return;
                }
                
                if (downPayment >= paymentTotal) {
                    showPaymentNotification('Down payment must be less than total amount', 'error');
                    return;
                }
                
                cashReceived = downPayment;
            } else {
                // Normal full payment
                if (!cashReceived || isNaN(cashReceived)) {
                    cashReceived = paymentTotal;
                    document.getElementById('cash-received').value = paymentTotal.toFixed(2);
                }
                
                if (cashReceived < paymentTotal) {
                    showPaymentNotification('Insufficient cash amount', 'error');
                    return;
                }
            }
            
            const change = isPartialPayment ? 0 : (cashReceived - paymentTotal);
            
            // Complete the sale with payment info
            await completeSaleWithPayment({
                method: 'Cash',
                amountReceived: cashReceived,
                change: change,
                isPartialPayment: isPartialPayment,
                downPayment: isPartialPayment ? cashReceived : 0,
                remainingBalance: isPartialPayment ? (paymentTotal - cashReceived) : 0,
                paymentStatus: isPartialPayment ? 'partial' : 'paid'
            });
```

### 11. js/payment.js - Update completeSaleWithPayment() (around line 520)
Add these fields to the saleData object:
```javascript
        const saleData = {
            // ... existing fields ...
            paymentStatus: paymentInfo.paymentStatus || 'paid',
            remainingBalance: paymentInfo.remainingBalance || 0,
            downPayment: paymentInfo.downPayment || 0,
            // ... rest of fields ...
        };
```

## To Complete Installation:
1. Run the migration bundler: `npm run bundle-migrations` (if it exists) or manually run bundle-migrations.js
2. Restart the application
3. The partial payment feature will be available in the payment modal
4. Access "Partial Payments" from the menu to manage partial payments

## Testing:
1. Add items to cart
2. Click Checkout
3. In payment modal, check "Partial Payment (Down Payment)"
4. Enter a down payment amount (less than total)
5. Complete payment
6. Check "Partial Payments" from menu to see the invoice
7. Click "Receive Payment" to collect remaining balance
