# Manual HTML Updates Required

The JavaScript backend is now complete! You need to manually add these HTML elements to index.html:

## 1. Add Partial Payment Checkbox (Line ~320 after cash-received div)

Find this section in the cash payment area:
```html
<div class="input-group">
    <label for="cash-received">Cash Received</label>
    <input type="number" id="cash-received" step="0.01" min="0" placeholder="0.00">
</div>
```

Add this AFTER it:
```html
<!-- Partial Payment Option -->
<div class="partial-payment-toggle" style="margin-top: 15px;">
    <label style="display: flex; align-items: center; cursor: pointer;">
        <input type="checkbox" id="partial-payment-checkbox" style="margin-right: 10px; width: 18px; height: 18px;">
        <span style="font-size: 14px; font-weight: 500;">Partial Payment (Down Payment)</span>
    </label>
</div>

<div id="partial-payment-info" style="display: none; margin-top: 15px; padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #007bff;">
    <div class="input-group" style="margin-bottom: 10px;">
        <label for="down-payment-amount">Down Payment Amount</label>
        <input type="number" id="down-payment-amount" step="0.01" min="0" placeholder="0.00">
    </div>
    
    <div class="partial-payment-summary" style="font-size: 13px; line-height: 1.8;">
        <div style="display: flex; justify-content: space-between;">
            <span style="color: #666;">Total Amount:</span>
            <strong id="partial-total-amount">$0.00</strong>
        </div>
        <div style="display: flex; justify-content: space-between;">
            <span style="color: #666;">Down Payment:</span>
            <strong id="partial-down-payment" style="color: #28a745;">$0.00</strong>
        </div>
        <div style="display: flex; justify-content: space-between; padding-top: 8px; border-top: 1px solid #dee2e6; margin-top: 8px;">
            <span style="color: #666;">Remaining Balance:</span>
            <strong id="partial-remaining-balance" style="color: #dc3545; font-size: 15px;">$0.00</strong>
        </div>
    </div>
    
    <div style="margin-top: 12px; padding: 10px; background: #fff3cd; border-radius: 6px; font-size: 12px; color: #856404;">
        ⚠️ Invoice will remain open until full payment is received
    </div>
</div>
```

## 2. Add Partial Payments Modal (Line ~3100 before closing body tag)

Add this modal structure before `</body>`:
```html
<!-- Partial Payments Modal -->
<div id="partial-payments-modal" class="modal">
    <div class="modal-content" style="max-width: 800px;">
        <div class="modal-header">
            <h2>💰 Partial Payments Management</h2>
            <button class="close-btn" onclick="window.partialPayments?.closePartialPaymentsModal()">×</button>
        </div>
        <div class="modal-body">
            <div id="partial-payments-list"></div>
        </div>
    </div>
</div>
```

## 3. Add Menu Button (Line ~95-110 in dropdown menu)

Find the dropdown menu section with buttons like "📊 Reports", "📦 Inventory", etc.

Add this button:
```html
<button id="partial-payments-btn" onclick="window.partialPayments?.showPartialPaymentsModal()">
    💰 Partial Payments
</button>
```

## 4. Add Script Reference (Line ~3125 before closing body tag)

Find where the other scripts are loaded (near the end of the file) and add:
```html
<script src="js/partial-payments.js?v=1"></script>
```

---

**After adding these, restart the application to test the feature!**

**Test Steps:**
1. Add items to cart
2. Click Checkout
3. Enter customer info
4. Check "Partial Payment" checkbox
5. Enter down payment amount (less than total)
6. Complete payment
7. Open "Partial Payments" from menu to see open invoices
8. Click "Receive Payment" to add more payments
9. When fully paid, invoice will close
