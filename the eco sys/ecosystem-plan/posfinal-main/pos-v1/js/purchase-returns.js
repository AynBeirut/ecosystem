// ===================================
// PURCHASE RETURNS MODULE
// Handle returning items to suppliers for bad/incorrect/unwanted items
// ===================================

console.log('↩️ Loading purchase-returns.js...');

/**
 * Initiate delivery return process
 */
async function initiateDeliveryReturn(deliveryId) {
    try {
        const delivery = await getDeliveryById(deliveryId);
        
        if (!delivery) {
            alert('❌ Delivery not found');
            return;
        }
        
        // Check if already fully returned
        if (delivery.returnStatus === 'full') {
            alert('⚠️ This delivery has already been fully returned');
            return;
        }
        
        // Check if delivery has items
        if (!delivery.items || delivery.items.length === 0) {
            alert('⚠️ This delivery has no items to return');
            return;
        }
        
        // Get previous returns for this delivery
        const previousReturns = runQuery(`
            SELECT returnItems 
            FROM purchase_returns 
            WHERE deliveryId = ?
        `, [deliveryId]);
        
        console.log('📊 Previous returns found:', previousReturns.length);
        
        // Calculate total returned quantities per product
        const returnedQuantities = {};
        previousReturns.forEach(returnRecord => {
            const items = JSON.parse(returnRecord.returnItems || '[]');
            console.log('📦 Return record items:', items);
            items.forEach(item => {
                const key = item.productId;
                const qty = item.returnQuantity || 0;  // Use returnQuantity field
                returnedQuantities[key] = (returnedQuantities[key] || 0) + qty;
                console.log(`  Product ${key}: +${qty} (total: ${returnedQuantities[key]})`);
            });
        });
        
        console.log('📊 Total returned quantities:', returnedQuantities);
        
        // Store previous returns info
        delivery.previousReturns = previousReturns;
        delivery.returnedQuantities = returnedQuantities;
        delivery.hasReturns = previousReturns.length > 0;
        
        // Load current stock for each item (will limit return quantities in modal)
        const products = await loadProductsFromDB();
        
        // Add current stock and calculate remaining quantities for each item
        delivery.items.forEach(item => {
            const product = products.find(p => p.id === item.productId);
            item.currentStock = product ? (product.stock || 0) : 0;
            
            // Calculate remaining quantity after previous returns
            const alreadyReturned = returnedQuantities[item.productId] || 0;
            item.remainingQty = item.quantity - alreadyReturned;
            item.alreadyReturned = alreadyReturned;
            
            console.log(`📦 Item ${item.productName} (ID: ${item.productId}):`, {
                ordered: item.quantity,
                returned: alreadyReturned,
                remaining: item.remainingQty,
                stock: item.currentStock
            });
        });
        
        showPurchaseReturnModal(delivery);
        
    } catch (error) {
        console.error('Error initiating delivery return:', error);
        alert(`❌ Error: ${error.message}`);
    }
}

/**
 * Update return calculation
 */
window.updateReturnCalculation = function() {
    if (!window.currentDeliveryItems) return;
    
    let totalAmount = 0;
    let itemsCount = 0;
    
    document.querySelectorAll('.return-item-checkbox').forEach((checkbox) => {
        const itemIndex = parseInt(checkbox.getAttribute('data-item-index'));
        const qtyInput = document.getElementById('return-qty-' + itemIndex);
        const lineTotalCell = document.querySelector('.return-line-total[data-item-index="' + itemIndex + '"]');
        
        if (checkbox.checked && qtyInput && !qtyInput.disabled) {
            const qty = parseFloat(qtyInput.value) || 0;
            const maxQty = parseFloat(qtyInput.getAttribute('data-max'));
            
            // Validate quantity
            if (qty > maxQty) {
                qtyInput.value = maxQty;
            }
            if (qty < 0.01) {
                qtyInput.value = 0.01;
            }
            
            const validQty = Math.min(Math.max(parseFloat(qtyInput.value) || 0, 0.01), maxQty);
            const unitCost = window.currentDeliveryItems[itemIndex].unitCost;
            const lineTotal = validQty * unitCost;
            
            totalAmount += lineTotal;
            itemsCount++;
            
            lineTotalCell.textContent = '$' + lineTotal.toFixed(2);
        } else {
            if (lineTotalCell) lineTotalCell.textContent = '$0.00';
        }
    });
    
    const countEl = document.getElementById('return-items-count');
    const amountEl = document.getElementById('return-total-amount');
    const debtEl = document.getElementById('return-debt-reduction');
    
    if (countEl) countEl.textContent = itemsCount;
    if (amountEl) amountEl.textContent = '$' + totalAmount.toFixed(2);
    if (debtEl) debtEl.textContent = '$' + totalAmount.toFixed(2);
};

/**
 * Show purchase return modal
 */
function showPurchaseReturnModal(delivery) {
    const modal = document.getElementById('purchase-return-modal');
    if (!modal) {
        console.error('❌ Purchase return modal not found');
        return;
    }
    
    const content = document.getElementById('purchase-return-content');
    if (!content) return;
    
    const date = new Date(delivery.deliveryDate).toLocaleDateString();
    
    // Build items HTML
    let itemsHtml = '';
    if (delivery.items && delivery.items.length > 0) {
        itemsHtml = `
            <table style="width: 100%; margin-top: 15px;">
                <thead>
                    <tr>
                        <th style="width: 50px;">Return</th>
                        <th>Product</th>
                        <th style="width: 100px;">Ordered</th>
                        <th style="width: 120px;">Return Qty</th>
                        <th style="width: 100px;">Unit Cost</th>
                        <th style="width: 100px;">Total</th>
                    </tr>
                </thead>
                <tbody>
        `;
        delivery.items.forEach((item, index) => {
            const remainingQty = item.remainingQty !== undefined ? item.remainingQty : item.quantity;
            const maxReturn = Math.min(item.currentStock, remainingQty);
            const canReturn = item.currentStock > 0 && remainingQty > 0;
            const stockWarning = item.currentStock < remainingQty ? 
                ` <span style="color: #ff9800; font-size: 0.9em;">(Stock: ${item.currentStock})</span>` : '';
            
            itemsHtml += `
                <tr style="${!canReturn ? 'background: #ffebee;' : ''}">
                    <td style="text-align: center;">
                        <input type="checkbox" class="return-item-checkbox" data-item-index="${index}" ${canReturn ? 'checked' : 'disabled'} onchange="updateReturnCalculation();">
                    </td>
                    <td>${item.productIcon || ''} ${item.productName}${stockWarning}</td>
                    <td>
                        <strong>${item.quantity}</strong>
                        ${item.alreadyReturned > 0 || delivery.hasReturns ? 
                            `<br><small style="color: #f44336;">Returned: ${item.alreadyReturned || 0}</small>
                             <br><small style="color: #4caf50; font-weight: bold;">Remaining: ${remainingQty}</small>` 
                            : ''}
                    </td>
                    <td>
                        <input type="number" 
                               id="return-qty-${index}" 
                               class="form-control return-qty-input" 
                               data-item-index="${index}"
                               data-max="${maxReturn}"
                               data-ordered="${item.quantity}"
                               data-remaining="${remainingQty}"
                               data-stock="${item.currentStock}"
                               min="0.01" 
                               max="${maxReturn}" 
                               value="${maxReturn}"
                               step="0.01"
                               style="width: 100%;"
                               ${!canReturn ? 'disabled' : ''}
                               onchange="updateReturnCalculation();">
                        ${!canReturn ? '<small style="color: #f44336;">No stock</small>' : ''}
                    </td>
                    <td>$${item.unitCost.toFixed(2)}</td>
                    <td class="return-line-total" data-item-index="${index}">$${(maxReturn * item.unitCost).toFixed(2)}</td>
                </tr>
            `;
        });
        itemsHtml += '</tbody></table>';
    }
    
    content.innerHTML = `
        <div style="padding: 20px; max-height: 70vh; overflow-y: auto;">
            <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px; margin-bottom: 20px; color: #856404;">
                <strong>⚠️ Warning:</strong> Returning items will:
                <ul style="margin: 10px 0 0 20px;">
                    <li>Decrease stock quantities</li>
                    <li>Reduce supplier balance (debt)</li>
                    <li>Cannot be undone</li>
                </ul>
            </div>
            
            ${delivery.hasReturns ? `
                <div style="background: #e3f2fd; border: 1px solid #2196f3; border-radius: 8px; padding: 15px; margin-bottom: 20px; color: #0d47a1;">
                    <strong>ℹ️ Previous Returns:</strong> This delivery has ${delivery.previousReturns.length} previous return(s). 
                    Quantities shown below are remaining after previous returns.
                </div>
            ` : ''}
            
            <h3 style="color: #333;">Delivery Information</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 15px 0; background: #f8f9fa; padding: 15px; border-radius: 8px; color: #333;">
                <div>
                    <p><strong>Delivery ID:</strong> #${delivery.id}</p>
                    <p><strong>Supplier:</strong> ${delivery.supplierName}</p>
                    <p><strong>Date:</strong> ${date}</p>
                </div>
                <div>
                    <p><strong>Reference:</strong> ${delivery.deliveryRef || '-'}</p>
                    <p><strong>Invoice:</strong> ${delivery.invoiceNumber || '-'}</p>
                    <p><strong>Total Amount:</strong> <strong style="color: #1C75BC; font-size: 1.2em;">$${delivery.totalAmount.toFixed(2)}</strong></p>
                </div>
            </div>
            
            <h4 style="color: #333;">Items to Return (Full Return)</h4>
            ${itemsHtml}
            
            <div style="background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0; border-radius: 4px; color: #0d47a1;">
                <strong>📊 Return Summary:</strong>
                <div style="margin-top: 10px; font-size: 1.1em;">
                    <p>• <strong>Items Selected:</strong> <span id="return-items-count">${delivery.items.length}</span> products</p>
                    <p>• <strong>Total Return Amount:</strong> <span id="return-total-amount" style="color: #f44336; font-size: 1.2em; font-weight: bold;">$${delivery.totalAmount.toFixed(2)}</span></p>
                    <p>• <strong>Supplier Debt Reduction:</strong> <span id="return-debt-reduction">$${delivery.totalAmount.toFixed(2)}</span></p>
                </div>
            </div>
            
            <div class="form-group" style="margin-top: 20px;">
                <label for="return-reason" style="color: #333;"><strong>Reason for Return *</strong></label>
                <select id="return-reason" class="form-control" required>
                    <option value="">-- Select Reason --</option>
                    <option value="bad_items">🔴 Bad Items (Defective/Damaged)</option>
                    <option value="not_needed">📦 Not Needed (Over-ordered)</option>
                    <option value="incorrect_items">⚠️ Incorrect Items (Wrong product sent)</option>
                    <option value="expired">⏰ Expired/Near Expiry</option>
                    <option value="wrong_specification">📋 Wrong Specifications</option>
                    <option value="other">❓ Other</option>
                </select>
            </div>
            
            <div class="form-group">
                <label for="return-credit-note" style="color: #333;">Supplier Credit Note (Optional)</label>
                <input type="text" id="return-credit-note" class="form-control" placeholder="e.g., CN-2024-001">
            </div>
            
            <div class="form-group">
                <label for="return-notes" style="color: #333;">Additional Notes (Optional)</label>
                <textarea id="return-notes" class="form-control" rows="3" placeholder="Any additional details..."></textarea>
            </div>
            
            <hr style="margin: 30px 0;">
            <p style="color: #2e7d32; margin-bottom: 15px; font-weight: 600;">
                ✅ Return will be approved using the currently logged-in account
            </p>
            
            <div style="text-align: right; margin-top: 30px; display: flex; gap: 10px; justify-content: flex-end;">
                <button class="btn-secondary" onclick="closePurchaseReturnModal();">Cancel</button>
                <button class="btn-danger" onclick="processPurchaseReturn(${delivery.id});" style="background: #f44336; padding: 12px 30px; font-size: 1.1em;">
                    ↩️ Process Return
                </button>
            </div>
        </div>
    `;
    
    // Store delivery items globally for calculation
    window.currentDeliveryItems = delivery.items;
    
    modal.style.display = 'block';
    
    // Initialize calculation after modal is displayed
    setTimeout(() => {
        if (typeof window.updateReturnCalculation === 'function') {
            window.updateReturnCalculation();
        }
    }, 100);
}

/**
 * Close purchase return modal
 */
function closePurchaseReturnModal() {
    const modal = document.getElementById('purchase-return-modal');
    if (modal) {
        modal.style.display = 'none';
        
        // Clean up global state
        window.currentDeliveryItems = null;
    }
}

/**
 * Process purchase return with authentication
 */
async function processPurchaseReturn(deliveryId) {
    try {
        // Get form values
        const reason = document.getElementById('return-reason').value;
        const creditNote = document.getElementById('return-credit-note').value.trim();
        const notes = document.getElementById('return-notes').value.trim();
        
        // Validate required fields
        if (!reason) {
            alert('⚠️ Please select a reason for return');
            document.getElementById('return-reason').focus();
            return;
        }
        
        // Collect selected items to return
        const returnItems = [];
        let returnAmount = 0;
        let selectedCount = 0;
        
        document.querySelectorAll('.return-item-checkbox').forEach((checkbox) => {
            if (checkbox.checked) {
                const itemIndex = parseInt(checkbox.getAttribute('data-item-index'));
                const qtyInput = document.getElementById('return-qty-' + itemIndex);
                const returnQty = parseFloat(qtyInput.value) || 0;
                
                if (returnQty > 0) {
                    const originalItem = window.currentDeliveryItems[itemIndex];
                    const lineTotal = returnQty * originalItem.unitCost;
                    
                    returnItems.push({
                        deliveryItemId: originalItem.id,
                        productId: originalItem.productId,
                        productName: originalItem.productName,
                        productIcon: originalItem.productIcon,
                        originalQuantity: originalItem.quantity,
                        returnQuantity: returnQty,
                        unitCost: originalItem.unitCost,
                        lineTotal: lineTotal
                    });
                    
                    returnAmount += lineTotal;
                    selectedCount++;
                }
            }
        });
        
        if (returnItems.length === 0) {
            alert('⚠️ Please select at least one item to return');
            return;
        }
        
        // Use currently logged-in user as approver (no extra re-auth required)
        const approver = typeof getCurrentUser === 'function'
            ? getCurrentUser()
            : JSON.parse(sessionStorage.getItem('currentUser') || 'null');

        if (!approver || !approver.username) {
            alert('❌ No active session found. Please login again.');
            return;
        }
        
        // Check if user has permission (admin or manager only)
        if (approver.role !== 'admin' && approver.role !== 'manager') {
            alert('⛔ Only managers and administrators can approve returns');
            return;
        }
        
        // Confirm action
        const itemsList = returnItems.map(item => `• ${item.productName}: ${item.returnQuantity} units`).join('\n');
        if (!confirm(`⚠️ Are you sure you want to process this return?\n\nReturning:\n${itemsList}\n\nTotal: $${returnAmount.toFixed(2)}\n\nThis will:\n• Remove items from stock\n• Reduce supplier debt\n• Cannot be undone\n\nClick OK to proceed.`)) {
            return;
        }
        
        // Get delivery details
        const delivery = await getDeliveryById(deliveryId);
        if (!delivery) {
            throw new Error('Delivery not found');
        }
        
        // Determine if this is a full or partial return
        const totalItemsInDelivery = delivery.items.length;
        const isFullReturn = returnItems.length === totalItemsInDelivery && 
                            returnItems.every((item, idx) => item.returnQuantity === delivery.items[idx].quantity);
        const returnType = isFullReturn ? 'full' : 'partial';
        
        // Get current user for processedBy
        const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        const processedBy = currentUser ? currentUser.username : 'Unknown';
        
        // Begin transaction
        beginTransaction();
        
        try {
            // Create return record
            const returnData = {
                deliveryId: delivery.id,
                originalDeliveryDate: delivery.deliveryDate,
                returnAmount: returnAmount,
                returnType: returnType,
                returnItems: JSON.stringify(returnItems),
                reason,
                approvedBy: approver.id,
                approverUsername: approver.username,
                approverRole: approver.role,
                processedBy,
                timestamp: Date.now(),
                returnReference: `RET-${delivery.id}-${Date.now()}`,
                creditNote: creditNote || null,
                notes: notes || null
            };
            
            const returnId = await runExec(
                `INSERT INTO purchase_returns (deliveryId, originalDeliveryDate, returnAmount, returnType, returnItems, reason, approvedBy, approverUsername, approverRole, processedBy, timestamp, returnReference, creditNote, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    returnData.deliveryId,
                    returnData.originalDeliveryDate,
                    returnData.returnAmount,
                    returnData.returnType,
                    returnData.returnItems,
                    returnData.reason,
                    returnData.approvedBy,
                    returnData.approverUsername,
                    returnData.approverRole,
                    returnData.processedBy,
                    returnData.timestamp,
                    returnData.returnReference,
                    returnData.creditNote,
                    returnData.notes
                ]
            );
            
            if (!returnId || returnId === 0) {
                throw new Error('Failed to create return record');
            }
            
            console.log(`✅ Return record created: ID ${returnId}`);
            
            // Process each returned item - decrease stock
            const products = await loadProductsFromDB();
            
            for (const item of returnItems) {
                const product = products.find(p => p.id === item.productId);
                if (!product) {
                    throw new Error(`Product ${item.productName} not found`);
                }
                
                const currentStock = product.stock || 0;
                const newStock = Math.max(0, currentStock - item.returnQuantity);
                
                // Update stock
                await runExec(
                    'UPDATE products SET stock = ?, updatedAt = ? WHERE id = ?',
                    [newStock, Date.now(), item.productId]
                );
                
                // Log stock change
                await logStockChange(
                    item.productId,
                    item.productName,
                    currentStock,
                    newStock,
                    `Purchase Return: -${item.returnQuantity} to ${delivery.supplierName} (Return #${returnId})`
                );
                
                console.log(`📉 Stock decreased: ${item.productName} ${currentStock} → ${newStock}`);
            }
            
            // Update supplier balance (reduce debt - positive amount)
            await updateSupplierBalance(
                delivery.supplierId,
                returnData.returnAmount,  // Positive to reduce debt
                `Purchase Return #${returnId} (Delivery #${deliveryId})`
            );
            
            // Update delivery record
            await runExec(
                'UPDATE deliveries SET returnId = ?, returnedAt = ?, returnStatus = ? WHERE id = ?',
                [returnId, Date.now(), returnType, deliveryId]
            );
            
            // Log activity
            if (typeof logActivity === 'function') {
                await logActivity(
                    'purchase_return',
                    `${returnType === 'full' ? 'Full' : 'Partial'} return of delivery #${deliveryId} to ${delivery.supplierName}: ${returnItems.length} items, $${returnData.returnAmount.toFixed(2)} (Reason: ${reason}) - Approved by ${approver.username}`
                );
            }
            
            // Commit transaction
            await commit();
            
            console.log(`✅ Purchase return processed successfully: Return #${returnId}`);
            
            // Show success message
            alert(`✅ ${returnType === 'full' ? 'Full' : 'Partial'} Return Processed Successfully!\n\nReturn ID: #${returnId}\nReference: ${returnData.returnReference}\nItems: ${returnItems.length}\nAmount: $${returnData.returnAmount.toFixed(2)}\n\nStock has been decreased and supplier balance has been adjusted.`);
            
            // Close modal
            closePurchaseReturnModal();
            
            // Reload data
            if (typeof loadDeliveryHistory === 'function') {
                await loadDeliveryHistory();
            }
            if (typeof loadPurchaseReturnsTable === 'function') {
                await loadPurchaseReturnsTable();
            }
            if (typeof loadSuppliersTable === 'function') {
                await loadSuppliersTable();
            }
            if (typeof loadInventoryData === 'function') {
                loadInventoryData();
            }
            
        } catch (error) {
            // Rollback transaction on error
            rollback();
            throw error;
        }
        
    } catch (error) {
        console.error('❌ Error processing purchase return:', error);
        alert(`❌ Failed to process return: ${error.message}`);
    }
}

/**
 * Load purchase returns history
 */
async function loadPurchaseReturns(filters = {}) {
    try {
        let query = `
            SELECT 
                pr.*,
                d.deliveryRef,
                d.invoiceNumber,
                s.name as supplierName
            FROM purchase_returns pr
            LEFT JOIN deliveries d ON pr.deliveryId = d.id
            LEFT JOIN suppliers s ON d.supplierId = s.id
            WHERE 1=1
        `;
        const params = [];
        
        // Apply filters
        if (filters.supplierId) {
            query += ' AND d.supplierId = ?';
            params.push(filters.supplierId);
        }
        
        if (filters.startDate) {
            query += ' AND pr.timestamp >= ?';
            params.push(filters.startDate);
        }
        
        if (filters.endDate) {
            query += ' AND pr.timestamp <= ?';
            params.push(filters.endDate);
        }
        
        if (filters.reason) {
            query += ' AND pr.reason = ?';
            params.push(filters.reason);
        }
        
        query += ' ORDER BY pr.timestamp DESC';
        
        const returns = await runQuery(query, params);
        return returns || [];
        
    } catch (error) {
        console.error('Error loading purchase returns:', error);
        return [];
    }
}

/**
 * View purchase return details
 */
async function viewPurchaseReturnDetails(returnId) {
    try {
        const returns = await runQuery(
            `SELECT 
                pr.*,
                d.deliveryRef,
                d.invoiceNumber,
                s.name as supplierName
            FROM purchase_returns pr
            LEFT JOIN deliveries d ON pr.deliveryId = d.id
            LEFT JOIN suppliers s ON d.supplierId = s.id
            WHERE pr.id = ?`,
            [returnId]
        );
        
        if (!returns || returns.length === 0) {
            alert('❌ Return not found');
            return;
        }
        
        const returnRecord = returns[0];
        const returnItems = JSON.parse(returnRecord.returnItems || '[]');
        
        const date = new Date(returnRecord.timestamp).toLocaleString();
        const originalDate = new Date(returnRecord.originalDeliveryDate).toLocaleDateString();
        
        let itemsHtml = '';
        if (returnItems.length > 0) {
            itemsHtml = '<table style="width: 100%; margin-top: 10px;"><thead><tr><th>Product</th><th>Quantity</th><th>Unit Cost</th><th>Total</th></tr></thead><tbody>';
            returnItems.forEach(item => {
                itemsHtml += `
                    <tr>
                        <td>${item.productIcon || ''} ${item.productName}</td>
                        <td>${item.quantity || item.returnQuantity}</td>
                        <td>$${item.unitCost.toFixed(2)}</td>
                        <td>$${item.lineTotal.toFixed(2)}</td>
                    </tr>
                `;
            });
            itemsHtml += '</tbody></table>';
        }
        
        const reasonLabels = {
            'bad_items': '🔴 Bad Items (Defective/Damaged)',
            'not_needed': '📦 Not Needed (Over-ordered)',
            'incorrect_items': '⚠️ Incorrect Items',
            'expired': '⏰ Expired/Near Expiry',
            'wrong_specification': '📋 Wrong Specifications',
            'other': '❓ Other'
        };
        
        const content = `
            <div style="padding: 20px;">
                <h3>Purchase Return #${returnRecord.id}</h3>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <p><strong>Return Reference:</strong> ${returnRecord.returnReference}</p>
                    <p><strong>Return Date:</strong> ${date}</p>
                    <p><strong>Original Delivery Date:</strong> ${originalDate}</p>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
                    <div>
                        <h4>Delivery Information</h4>
                        <p><strong>Delivery ID:</strong> #${returnRecord.deliveryId}</p>
                        <p><strong>Supplier:</strong> ${returnRecord.supplierName}</p>
                        <p><strong>Reference:</strong> ${returnRecord.deliveryRef || '-'}</p>
                        <p><strong>Invoice:</strong> ${returnRecord.invoiceNumber || '-'}</p>
                    </div>
                    <div>
                        <h4>Return Details</h4>
                        <p><strong>Reason:</strong> ${reasonLabels[returnRecord.reason] || returnRecord.reason}</p>
                        <p><strong>Type:</strong> ${returnRecord.returnType === 'full' ? 'Full Return' : 'Partial Return'}</p>
                        <p><strong>Credit Note:</strong> ${returnRecord.creditNote || '-'}</p>
                        <p><strong>Return Amount:</strong> <strong style="color: #f44336; font-size: 1.2em;">$${returnRecord.returnAmount.toFixed(2)}</strong></p>
                    </div>
                </div>
                
                <h4>Returned Items</h4>
                ${itemsHtml}
                
                <div style="margin-top: 20px;">
                    <h4>Processing Information</h4>
                    <p><strong>Processed By:</strong> ${returnRecord.processedBy}</p>
                    <p><strong>Approved By:</strong> ${returnRecord.approverUsername} (${returnRecord.approverRole})</p>
                    ${returnRecord.notes ? `<p><strong>Notes:</strong> ${returnRecord.notes}</p>` : ''}
                </div>
            </div>
        `;
        
        const modal = document.getElementById('purchase-return-details-modal');
        if (modal) {
            document.getElementById('purchase-return-details-content').innerHTML = content;
            modal.style.display = 'block';
        }
        
    } catch (error) {
        console.error('Error viewing return details:', error);
        alert(`❌ Error: ${error.message}`);
    }
}

console.log('✅ Purchase returns module loaded');
