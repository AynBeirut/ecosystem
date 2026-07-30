/**
 * Partial Payments Management Module
 * Handle down payments and remaining balance tracking
 * Allows customers to pay invoices in installments
 */

console.log('💰 Loading partial-payments.js...');

// Show partial payments modal
function showPartialPaymentsModal() {
    const modal = document.getElementById('partial-payments-modal');
    if (!modal) {
        console.error('Partial payments modal not found');
        return;
    }
    
    loadPartialPayments();
    modal.style.display = 'block';
}

// Close partial payments modal
function closePartialPaymentsModal() {
    const modal = document.getElementById('partial-payments-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Load partial payments list
async function loadPartialPayments() {
    const listContainer = document.getElementById('partial-payments-list');
    if (!listContainer) return;
    
    try {
        listContainer.innerHTML = '<div class="loading">Loading partial payments...</div>';
        
        const partialSales = runQuery(`
            SELECT * FROM sales 
            WHERE paymentStatus = 'partial' AND remainingBalance > 0
            ORDER BY timestamp DESC
        `);
        
        if (!partialSales || partialSales.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 40px; color: #666;">
                    <div style="font-size: 48px; margin-bottom: 16px;">💰</div>
                    <p style="font-size: 16px; font-weight: 600;">No Partial Payments Found</p>
                    <p style="font-size: 14px;">All invoices are fully paid or unpaid.</p>
                </div>
            `;
            return;
        }
        
        let html = '<div class="partial-payments-grid" style="display: grid; gap: 16px;">';
        
        partialSales.forEach(sale => {
            const items = JSON.parse(sale.items || '[]');
            const totals = JSON.parse(sale.totals || '{}');
            const customer = sale.customerInfo ? JSON.parse(sale.customerInfo) : null;
            
            // Get payment history for this sale
            const paymentHistory = runQuery(`
                SELECT * FROM partial_payments 
                WHERE saleId = ? 
                ORDER BY timestamp ASC
            `, [sale.id]);
            
            const paymentCount = paymentHistory.length + 1; // +1 for initial down payment
            
            html += `
                <div class="partial-payment-card" style="border: 1px solid #dee2e6; border-radius: 8px; padding: 16px; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <div class="partial-payment-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #e9ecef;">
                        <div>
                            <strong style="font-size: 16px;">Receipt #${sale.receiptNumber}</strong>
                            <div style="font-size: 12px; color: #666; margin-top: 4px;">${new Date(sale.timestamp).toLocaleString()}</div>
                        </div>
                        <div class="partial-payment-status" style="background: #ffc107; color: #000; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">
                            Partial (${paymentCount} payment${paymentCount > 1 ? 's' : ''})
                        </div>
                    </div>
                    <div class="partial-payment-customer" style="margin-bottom: 12px; font-size: 13px; color: #444;">
                        ${customer ? `<div style="margin-bottom: 4px;">👤 ${customer.name || 'Walk-in'}</div>` : '<div>👤 Walk-in Customer</div>'}
                        ${customer?.phone ? `<div>📞 ${customer.phone}</div>` : ''}
                    </div>
                    <div class="partial-payment-amounts" style="margin: 12px 0; padding: 12px; background: #f8f9fa; border-radius: 6px;">
                        <div class="amount-row" style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px;">
                            <span>Total Amount:</span>
                            <span style="font-family: 'Roboto Mono', monospace; font-weight: 600;">$${totals.total.toFixed(2)}</span>
                        </div>
                        <div class="amount-row" style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px;">
                            <span>Initial Down Payment:</span>
                            <span style="font-family: 'Roboto Mono', monospace; color: #28a745; font-weight: 600;">$${sale.downPayment.toFixed(2)}</span>
                        </div>
                        ${paymentHistory.length > 0 ? `
                        <div class="amount-row" style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px;">
                            <span>Additional Payments:</span>
                            <span style="font-family: 'Roboto Mono', monospace; color: #28a745; font-weight: 600;">$${paymentHistory.reduce((sum, p) => sum + p.amount, 0).toFixed(2)}</span>
                        </div>
                        ` : ''}
                        <div class="amount-row total-row" style="display: flex; justify-content: space-between; border-top: 2px solid #dee2e6; margin-top: 8px; padding-top: 12px; font-size: 15px; font-weight: 700;">
                            <span>Remaining Balance:</span>
                            <span style="font-family: 'Roboto Mono', monospace; color: #dc3545;">$${sale.remainingBalance.toFixed(2)}</span>
                        </div>
                    </div>
                    <div class="partial-payment-items" style="margin: 12px 0; font-size: 12px; color: #666;">
                        <strong>Items (${items.length}):</strong>
                        <div style="margin-top: 6px;">
                            ${items.slice(0, 3).map(item => `• ${item.name} (${item.quantity}x)`).join('<br>')}
                            ${items.length > 3 ? `<br>• ... and ${items.length - 3} more` : ''}
                        </div>
                    </div>
                    <div class="partial-payment-actions" style="display: flex; gap: 8px; margin-top: 12px;">
                        <button class="btn-primary" style="flex: 1; padding: 10px; font-size: 14px; border: none; border-radius: 6px; cursor: pointer; background: #007bff; color: white;" onclick="receivePartialPayment(${sale.id}, ${sale.remainingBalance}, '${sale.receiptNumber}')">
                            💵 Receive Payment
                        </button>
                        <button class="btn-secondary" style="flex: 0.5; padding: 10px; font-size: 14px; border: 1px solid #6c757d; border-radius: 6px; cursor: pointer; background: white; color: #6c757d;" onclick="viewPartialPaymentDetails(${sale.id})">
                            📄 Details
                        </button>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        listContainer.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading partial payments:', error);
        listContainer.innerHTML = `
            <div class="error-state" style="text-align: center; padding: 40px; color: #dc3545;">
                <p>Error loading partial payments</p>
                <p style="font-size: 12px;">${error.message}</p>
            </div>
        `;
    }
}

// Receive partial payment
async function receivePartialPayment(saleId, remainingBalance, receiptNumber) {
    const amountStr = prompt(`💵 Receive Payment for Receipt #${receiptNumber}\n\nRemaining Balance: $${remainingBalance.toFixed(2)}\n\nEnter payment amount:`);
    
    if (!amountStr) return;
    
    const paymentAmount = parseFloat(amountStr);
    
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
        showNotification('❌ Invalid payment amount', 'error');
        return;
    }
    
    if (paymentAmount > remainingBalance) {
        showNotification('❌ Payment amount cannot exceed remaining balance', 'error');
        return;
    }
    
    try {
        const newRemainingBalance = remainingBalance - paymentAmount;
        const newPaymentStatus = newRemainingBalance === 0 ? 'paid' : 'partial';
        
        console.log('💰 PARTIAL PAYMENT DEBUG:', {
            saleId,
            receiptNumber,
            paymentAmount,
            oldBalance: remainingBalance,
            newRemainingBalance,
            newPaymentStatus,
            willStayInList: newRemainingBalance > 0
        });
        
        // Get current user for cashier tracking
        const user = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
        const cashierId = user ? user.id : null;
        
        // Update sale record
        await runExec(`
            UPDATE sales 
            SET remainingBalance = ?,
                paymentStatus = ?
            WHERE id = ?
        `, [newRemainingBalance, newPaymentStatus, saleId]);
        
        console.log('✅ UPDATE query executed for sale ID:', saleId);
        
        // Record partial payment
        const paymentReceiptNumber = `PP-${saleId}-${Date.now()}`;
        await runExec(`
            INSERT INTO partial_payments (saleId, amount, paymentMethod, timestamp, receiptNumber, cashierId)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [saleId, paymentAmount, 'Cash', Date.now(), paymentReceiptNumber, cashierId]);
        
        console.log('✅ Partial payment recorded:', paymentReceiptNumber);
        
        // Log activity
        if (typeof logActivity === 'function') {
            await logActivity('partial_payment', `Received $${paymentAmount.toFixed(2)} for Receipt #${receiptNumber} (Balance: $${newRemainingBalance.toFixed(2)})`);
        }
        
        showNotification(`✅ Payment of $${paymentAmount.toFixed(2)} received successfully!`, 'success');
        
        if (newRemainingBalance === 0) {
            setTimeout(() => {
                showNotification('🎉 Invoice fully paid and closed!', 'success');
            }, 500);
        }
        
        console.log('🔄 Refreshing lists...');
        
        // Reload both lists (partial payments modal and unpaid orders modal)
        if (typeof loadPartialPayments === 'function') {
            loadPartialPayments();
        }
        if (typeof loadUnpaidOrders === 'function') {
            loadUnpaidOrders();
        }
        
        console.log('✅ receivePartialPayment completed successfully');
        
    } catch (error) {
        console.error('❌ PARTIAL PAYMENT ERROR:', error);
        console.error('Error stack:', error.stack);
        console.error('Error receiving payment:', error);
        showNotification('❌ Error processing payment: ' + error.message, 'error');
    }
}

// View partial payment details
function viewPartialPaymentDetails(saleId) {
    try {
        const sale = runQuery('SELECT * FROM sales WHERE id = ?', [saleId])[0];
        if (!sale) {
            showNotification('❌ Sale not found', 'error');
            return;
        }
        
        const payments = runQuery(`
            SELECT * FROM partial_payments 
            WHERE saleId = ? 
            ORDER BY timestamp ASC
        `, [saleId]);
        
        const totals = JSON.parse(sale.totals || '{}');
        const customer = sale.customerInfo ? JSON.parse(sale.customerInfo) : null;
        const items = JSON.parse(sale.items || '[]');
        
        let details = `📄 Payment Details - Receipt #${sale.receiptNumber}\n`;
        details += `${'='.repeat(50)}\n\n`;
        
        if (customer) {
            details += `👤 Customer: ${customer.name || 'Walk-in'}\n`;
            if (customer.phone) details += `📞 Phone: ${customer.phone}\n`;
            details += `\n`;
        }
        
        details += `💰 Financial Summary:\n`;
        details += `Total Amount: $${totals.total.toFixed(2)}\n`;
        details += `Down Payment: $${sale.downPayment.toFixed(2)}\n`;
        
        const totalAdditional = payments.reduce((sum, p) => sum + p.amount, 0);
        if (totalAdditional > 0) {
            details += `Additional Payments: $${totalAdditional.toFixed(2)}\n`;
        }
        
        details += `Remaining Balance: $${sale.remainingBalance.toFixed(2)}\n`;
        details += `Status: ${sale.paymentStatus.toUpperCase()}\n\n`;
        
        details += `📦 Items (${items.length}):\n`;
        items.forEach(item => {
            details += `  • ${item.name} - ${item.quantity}x $${item.price.toFixed(2)} = $${(item.quantity * item.price).toFixed(2)}\n`;
        });
        
        details += `\n📅 Payment History:\n`;
        details += `${new Date(sale.timestamp).toLocaleString()} - Initial Down Payment: $${sale.downPayment.toFixed(2)}\n`;
        
        payments.forEach(p => {
            details += `${new Date(p.timestamp).toLocaleString()} - Payment: $${p.amount.toFixed(2)} [${p.receiptNumber}]\n`;
        });
        
        alert(details);
        
    } catch (error) {
        console.error('Error viewing payment details:', error);
        showNotification('❌ Error loading payment details', 'error');
    }
}

// Export functions under partialPayments namespace
window.partialPayments = {
    showModal: showPartialPaymentsModal,
    closeModal: closePartialPaymentsModal,
    loadPayments: loadPartialPayments,
    receivePartialPayment: receivePartialPayment,
    viewDetails: viewPartialPaymentDetails
};

// Also expose directly for backward compatibility
window.showPartialPaymentsModal = showPartialPaymentsModal;
window.closePartialPaymentsModal = closePartialPaymentsModal;

console.log('✅ Partial payments module loaded');
