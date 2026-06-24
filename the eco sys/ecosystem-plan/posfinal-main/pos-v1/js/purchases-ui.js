// ===================================
// PURCHASES UI MODULE
// Handles all UI interactions for purchases, suppliers, deliveries, and payments
// ===================================

let deliveryItemsCounter = 0;
let purchasesInitialized = false;

// Record a payment to a supplier
async function recordSupplierPayment(paymentData) {
    try {
        const { supplierId, amount, paymentMethod, reference, notes, paidBy } = paymentData;
        
        if (!supplierId) {
            throw new Error('Supplier is required');
        }
        
        if (!amount || amount <= 0) {
            throw new Error('Payment amount must be greater than 0');
        }
        
        const now = Date.now();
        
        // Insert payment record and get ID
        const result = await runExec(
            `INSERT INTO supplier_payments (supplierId, amount, paymentMethod, reference, notes, paidBy, paidAt, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                supplierId,
                amount,
                paymentMethod || 'Cash',
                reference || '',
                notes || '',
                paidBy || '',
                now,
                now
            ]
        );
        
        const paymentId = result || 0;
        
        // Invalidate supplier balance cache to force recalculation
        if (typeof invalidateSupplierBalanceCache === 'function') {
            await invalidateSupplierBalanceCache(supplierId);
        }
        
        // Update balance immediately instead of queuing
        if (typeof updateSupplierBalance === 'function') {
            await updateSupplierBalance(supplierId);
        } else if (typeof queueSupplierBalanceUpdate === 'function') {
            queueSupplierBalanceUpdate(supplierId);
        }
        
        await saveDatabase();
        
        console.log('✅ Supplier payment recorded successfully');
        return true;
    } catch (error) {
        console.error('❌ Error recording supplier payment:', error);
        throw error;
    }
}

// Initialize Purchases Module
function initPurchases() {
    if (purchasesInitialized) {
        console.log('⚠️ Purchases module already initialized, skipping');
        return;
    }
    
    console.log('📦 Initializing Purchases Module...');
    
    // Set up Purchases button
    const purchasesBtn = document.getElementById('purchases-btn');
    if (purchasesBtn) {
        purchasesBtn.addEventListener('click', openPurchasesModal);
        console.log('✅ Purchases button listener attached');
    } else {
        console.warn('⚠️ Purchases button not found');
    }
    
    // Set up modal close buttons (only for purchases modals)
    setupPurchasesModalCloseButtons();
    
    // Set up tab navigation
    setupTabNavigation();
    
    // Set today's date as default
    const deliveryDateInput = document.getElementById('delivery-date');
    if (deliveryDateInput) {
        deliveryDateInput.valueAsDate = new Date();
    }
    
    // Update supplier debt badge (only if database is ready)
    if (typeof getTotalSupplierDebt === 'function' && typeof db !== 'undefined' && db) {
        updateSupplierDebtBadge().catch(err => {
            console.warn('Could not update supplier debt badge:', err);
        });
    }
    
    purchasesInitialized = true;
    console.log('✅ Purchases Module initialized');
}

// Open Purchases Modal
async function openPurchasesModal() {
    const modal = document.getElementById('purchases-modal');
    if (modal) {
        modal.style.display = 'block';
        
        console.log('📦 Opening Purchases Modal...');
        
        try {
            // Load required modules first
            console.log('📦 Loading required modules...');
            
            // Ensure suppliers module is loaded
            if (typeof loadSuppliers !== 'function') {
                console.log('Loading suppliers module...');
                await loadModuleOnDemand('suppliers');
            }
            
            // Ensure deliveries module is loaded
            if (typeof getDeliveryHistory !== 'function') {
                console.log('Loading deliveries module...');
                await loadModuleOnDemand('deliveries');
            }
            
            console.log('✅ All required modules loaded');
            
            // Load data for all tabs with error handling
            console.log('Loading supplier dropdowns...');
            await loadSupplierDropdowns();
            
            console.log('Loading suppliers table...');
            await loadSuppliersTable();
            
            console.log('Loading delivery history...');
            await loadDeliveryHistory();
            
            console.log('Loading payment history...');
            await loadPaymentHistory();
            
            console.log('Loading purchase returns...');
            await loadPurchaseReturnsTable();
            
            console.log('✅ All purchases data loaded successfully');
            
            // Add first delivery item row
            const deliveryItemsBody = document.getElementById('delivery-items-body');
            if (deliveryItemsBody && deliveryItemsBody.children.length === 0) {
                addDeliveryItemRow();
            }
        } catch (error) {
            console.error('❌ Error loading purchases data:', error);
            showNotification('Error loading purchases data: ' + error.message, 'error');
        }
    }
}

// Set up modal close buttons (only for purchases-related modals)
function setupPurchasesModalCloseButtons() {
    // Only set up close buttons for purchases modals
    const purchasesModals = [
        'purchases-modal',
        'quick-add-supplier-modal',
        'supplier-form-modal',
        'make-payment-modal',
        'delivery-details-modal'
    ];
    
    purchasesModals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            const closeBtn = modal.querySelector('.modal-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    modal.style.display = 'none';
                });
            }
            
            // Close when clicking outside (only for this modal)
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        }
    });
}

// Setup tab navigation
function setupTabNavigation() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab');
            switchTab(tabName);
        });
    });
}

// Switch between tabs
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const targetBtn = document.querySelector(`[data-tab="${tabName}"]`);
    if (targetBtn) {
        targetBtn.classList.add('active');
    }
    
    // Update tab panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });
    const targetPane = document.getElementById(`${tabName}-tab`);
    if (targetPane) {
        targetPane.classList.add('active');
    }
    
    // Load data for specific tabs
    if (tabName === 'payments' && typeof loadSupplierBalances === 'function') {
        loadSupplierBalances();
    }
    if (tabName === 'statements' && typeof populateStatementSuppliers === 'function') {
        populateStatementSuppliers();
    }
    // Load purchase-returns module for delivery history tab
    if (tabName === 'deliveries') {
        loadModuleOnDemand('purchase-returns').catch(err => {
            console.warn('⚠️ Failed to load purchase-returns module:', err);
        });
    }
}

// Load suppliers into dropdowns
async function loadSupplierDropdowns() {
    try {
        console.log('🔄 Loading supplier dropdowns...');
        
        // Ensure suppliers module is loaded
        if (typeof loadSuppliers !== 'function') {
            console.log('📦 Loading suppliers module...');
            await loadModuleOnDemand('suppliers');
        }
        
        const suppliers = await loadSuppliers();
        console.log(`👥 Found ${suppliers.length} suppliers for dropdowns`);
        
        // Delivery supplier dropdown
        const deliverySupplier = document.getElementById('delivery-supplier');
        if (deliverySupplier) {
            deliverySupplier.innerHTML = '<option value="">Select Supplier...</option>';
            suppliers.forEach(supplier => {
                const option = document.createElement('option');
                option.value = supplier.id;
                option.textContent = supplier.name;
                deliverySupplier.appendChild(option);
            });
        }
        
        // Filter dropdowns
        ['filter-supplier', 'payment-filter-supplier', 'returns-filter-supplier', 'statement-supplier'].forEach(id => {
            const select = document.getElementById(id);
            if (select) {
                const currentValue = select.value;
                select.innerHTML = '<option value="">All Suppliers</option>';
                suppliers.forEach(supplier => {
                    const option = document.createElement('option');
                    option.value = supplier.id;
                    option.textContent = supplier.name;
                    select.appendChild(option);
                });
                select.value = currentValue;
            }
        });
    } catch (error) {
        console.error('❌ Error loading supplier dropdowns:', error);
        showNotification('Error loading suppliers: ' + error.message, 'error');
    }
}

// Add delivery item row
function addDeliveryItemRow() {
    const tbody = document.getElementById('delivery-items-body');
    const rowId = ++deliveryItemsCounter;
    
    const row = document.createElement('tr');
    row.id = `delivery-item-${rowId}`;
    row.innerHTML = `
        <td>
            <select class="form-control delivery-item-product" data-row="${rowId}" onchange="updateDeliveryLineTotal(${rowId});" required>
                <option value="">Select Product...</option>
            </select>
        </td>
        <td>
            <input type="number" class="form-control delivery-item-qty" data-row="${rowId}" min="1" step="1" value="1" onchange="updateDeliveryLineTotal(${rowId});" required>
        </td>
        <td>
            <input type="number" class="form-control delivery-item-cost" data-row="${rowId}" min="0" step="0.01" value="0" onchange="updateDeliveryLineTotal(${rowId});" required>
        </td>
        <td>
            <span class="delivery-item-total" data-row="${rowId}">$0.00</span>
        </td>
        <td>
            <button type="button" class="btn-icon-danger" onclick="removeDeliveryItemRow(${rowId});" title="Remove">✖</button>
        </td>
    `;
    
    tbody.appendChild(row);
    
    // Load products into dropdown
    loadProductsIntoRow(rowId);
}

// Load products into delivery item row
async function loadProductsIntoRow(rowId) {
    const products = await loadProductsFromDB();
    const select = document.querySelector(`.delivery-item-product[data-row="${rowId}"]`);
    
    if (select) {
        // Only show items (not services) since services don't have stock
        products.filter(p => p.type !== 'service').forEach(product => {
            const option = document.createElement('option');
            option.value = product.id;
            option.textContent = `${product.icon} ${product.name} (Stock: ${product.stock || 0})`;
            select.appendChild(option);
        });
    }
}

// Remove delivery item row
function removeDeliveryItemRow(rowId) {
    const row = document.getElementById(`delivery-item-${rowId}`);
    if (row) {
        row.remove();
        updateDeliveryTotal();
    }
}

// Update delivery line total
function updateDeliveryLineTotal(rowId) {
    const qty = parseFloat(document.querySelector(`.delivery-item-qty[data-row="${rowId}"]`).value) || 0;
    const cost = parseFloat(document.querySelector(`.delivery-item-cost[data-row="${rowId}"]`).value) || 0;
    const lineTotal = qty * cost;
    
    const totalSpan = document.querySelector(`.delivery-item-total[data-row="${rowId}"]`);
    if (totalSpan) {
        totalSpan.textContent = `$${lineTotal.toFixed(2)}`;
    }
    
    updateDeliveryTotal();
}

// Update delivery total
function updateDeliveryTotal() {
    let total = 0;
    document.querySelectorAll('.delivery-item-total').forEach(span => {
        const value = parseFloat(span.textContent.replace('$', '')) || 0;
        total += value;
    });
    
    const totalDiv = document.getElementById('delivery-total');
    if (totalDiv) {
        totalDiv.textContent = `$${total.toFixed(2)}`;
    }
}

// Submit delivery
async function submitDelivery() {
    try {
        const supplierId = parseInt(document.getElementById('delivery-supplier').value);
        const deliveryDate = new Date(document.getElementById('delivery-date').value).getTime();
        const deliveryRef = document.getElementById('delivery-ref').value.trim();
        const invoiceNumber = document.getElementById('delivery-invoice').value.trim();
        const notes = document.getElementById('delivery-notes').value.trim();
        
        if (!supplierId) {
            alert('⚠️ Please select a supplier');
            return;
        }
        
        // Collect delivery items
        const items = [];
        const rows = document.querySelectorAll('#delivery-items-body tr');
        
        if (rows.length === 0) {
            alert('⚠️ Please add at least one product');
            return;
        }
        
        rows.forEach(row => {
            const rowId = row.id.split('-')[2];
            const productId = parseInt(document.querySelector(`.delivery-item-product[data-row="${rowId}"]`).value);
            const quantity = parseInt(document.querySelector(`.delivery-item-qty[data-row="${rowId}"]`).value);
            const unitCost = parseFloat(document.querySelector(`.delivery-item-cost[data-row="${rowId}"]`).value);
            
            if (productId && quantity > 0 && unitCost >= 0) {
                items.push({ productId, quantity, unitCost });
            }
        });
        
        if (items.length === 0) {
            alert('⚠️ Please fill in all product details');
            return;
        }
        
        // Get current user
        const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        const receivedBy = currentUser ? currentUser.name : 'Unknown';
        
        // Create delivery
        const deliveryData = {
            supplierId,
            deliveryRef,
            invoiceNumber,
            deliveryDate,
            items,
            notes,
            receivedBy
        };
        
        const deliveryId = await createDelivery(deliveryData);
        
        alert(`✅ Delivery received successfully!\nDelivery ID: ${deliveryId}`);
        
        // Clear form
        clearDeliveryForm();
        
        // Reload data
        await loadDeliveryHistory();
        await loadSuppliersTable();
        await updateSupplierDebtBadge();
        
        // Reload inventory if open
        if (typeof loadInventoryData === 'function') {
            loadInventoryData();
        }
        
    } catch (error) {
        console.error('Error submitting delivery:', error);
        alert(`❌ Failed to receive delivery: ${error.message}`);
    }
}

// Clear delivery form
function clearDeliveryForm() {
    document.getElementById('delivery-supplier').value = '';
    document.getElementById('delivery-date').valueAsDate = new Date();
    document.getElementById('delivery-ref').value = '';
    document.getElementById('delivery-invoice').value = '';
    document.getElementById('delivery-notes').value = '';
    
    // Clear all delivery items
    document.getElementById('delivery-items-body').innerHTML = '';
    deliveryItemsCounter = 0;
    
    // Add first row
    addDeliveryItemRow();
    
    updateDeliveryTotal();
}

// Show quick add supplier
function showQuickAddSupplier() {
    const modal = document.getElementById('quick-add-supplier-modal');
    if (modal) {
        document.getElementById('quick-supplier-form').reset();
        modal.style.display = 'block';
    }
}

// Submit quick supplier
async function submitQuickSupplier(event) {
    event.preventDefault();
    
    try {
        const supplierData = {
            name: document.getElementById('quick-supplier-name').value.trim(),
            contactPerson: document.getElementById('quick-supplier-contact').value.trim(),
            phone: document.getElementById('quick-supplier-phone').value.trim()
        };
        
        const supplierId = await addSupplier(supplierData);
        
        // Close modal
        document.getElementById('quick-add-supplier-modal').style.display = 'none';
        
        // Reload dropdowns
        await loadSupplierDropdowns();
        
        // Select the new supplier
        document.getElementById('delivery-supplier').value = supplierId;
        
        alert(`✅ Supplier "${supplierData.name}" added successfully!`);
        
    } catch (error) {
        console.error('Error adding supplier:', error);
        alert(`❌ Failed to add supplier: ${error.message}`);
    }
}

// Show add supplier form
function showAddSupplierForm() {
    const modal = document.getElementById('supplier-form-modal');
    if (modal) {
        document.getElementById('supplier-form-title').textContent = '➕ Add Supplier';
        document.getElementById('supplier-form').reset();
        document.getElementById('edit-supplier-id').value = '';
        modal.style.display = 'block';
    }
}

// Submit supplier form
async function submitSupplierForm(event) {
    event.preventDefault();
    
    try {
        const supplierId = document.getElementById('edit-supplier-id').value;
        const supplierData = {
            name: document.getElementById('supplier-name').value.trim(),
            contactPerson: document.getElementById('supplier-contact-person').value.trim(),
            phone: document.getElementById('supplier-phone').value.trim(),
            email: document.getElementById('supplier-email').value.trim(),
            address: document.getElementById('supplier-address').value.trim(),
            paymentTerms: document.getElementById('supplier-payment-terms-days')?.value?.trim() || '',
            notes: document.getElementById('supplier-notes').value.trim()
        };
        
        if (supplierId) {
            // Update existing
            await updateSupplier(parseInt(supplierId), supplierData);
            alert(`✅ Supplier "${supplierData.name}" updated successfully!`);
        } else {
            // Add new
            await addSupplier(supplierData);
            alert(`✅ Supplier "${supplierData.name}" added successfully!`);
        }
        
        // Close modal
        document.getElementById('supplier-form-modal').style.display = 'none';
        
        // Reload suppliers table
        await loadSuppliersTable();
        await loadSupplierDropdowns();
        
    } catch (error) {
        console.error('Error saving supplier:', error);
        alert(`❌ Failed to save supplier: ${error.message}`);
    }
}

// Load suppliers table
async function loadSuppliersTable() {
    const tbody = document.getElementById('suppliers-list');
    if (!tbody) {
        console.warn('⚠️ suppliers-list element not found');
        return;
    }
    
    try {
        console.log('🔄 Loading suppliers...');
        const suppliers = await loadSuppliers();
        console.log(`👥 Found ${suppliers.length} suppliers`);
        
        tbody.innerHTML = '';
        
        if (suppliers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">👥 No suppliers found. Click "Add Supplier" to add your first supplier!</td></tr>';
            return;
        }
        
        suppliers.forEach(supplier => {
            const paymentTerms = supplier.payment_terms_days ? `${supplier.payment_terms_days} Days` : (supplier.paymentTerms || '-');
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${escapeHtml(supplier.name)}</strong></td>
                <td>${escapeHtml(supplier.contactPerson || '-')}</td>
                <td>${escapeHtml(supplier.phone || '-')}</td>
                <td>${escapeHtml(supplier.email || '-')}</td>
                <td>${escapeHtml(paymentTerms)}</td>
                <td>
                    <button class="btn-icon-primary" onclick="editSupplier(${supplier.id});" title="Edit">✏️</button>
                    <button class="btn-icon-danger" onclick="deleteSupplierConfirm(${supplier.id});" title="Delete">🗑️</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('❌ Error loading suppliers:', error);
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: red;">❌ Error loading suppliers: ${error.message}</td></tr>`;
    }
}

// Edit supplier
async function editSupplier(supplierId) {
    const supplier = await getSupplierById(supplierId);
    if (!supplier) return;
    
    document.getElementById('supplier-form-title').textContent = '✏️ Edit Supplier';
    document.getElementById('edit-supplier-id').value = supplier.id;
    document.getElementById('supplier-name').value = supplier.name;
    document.getElementById('supplier-contact-person').value = supplier.contactPerson || '';
    document.getElementById('supplier-phone').value = supplier.phone || '';
    document.getElementById('supplier-email').value = supplier.email || '';
    document.getElementById('supplier-address').value = supplier.address || '';
    
    // Handle both old and new payment terms field
    const paymentTermsDays = supplier.payment_terms_days || supplier.paymentTerms || '';
    document.getElementById('supplier-payment-terms-days').value = paymentTermsDays;
    
    document.getElementById('supplier-notes').value = supplier.notes || '';
    
    document.getElementById('supplier-form-modal').style.display = 'block';
}

// Delete supplier confirm
async function deleteSupplierConfirm(supplierId) {
    const supplier = await getSupplierById(supplierId);
    if (!supplier) return;
    
    if (!confirm(`Are you sure you want to delete supplier "${supplier.name}"?\n\nThis cannot be undone.`)) {
        return;
    }
    
    try {
        await deleteSupplier(supplierId);
        alert(`✅ Supplier "${supplier.name}" deleted successfully`);
        await loadSuppliersTable();
        await loadSupplierDropdowns();
    } catch (error) {
        alert(`❌ ${error.message}`);
    }
}

// Make payment
async function makePayment(supplierId) {
    const supplier = await getSupplierById(supplierId);
    if (!supplier) return;
    
    const balance = supplier.balance || 0;
    const outstandingAmount = balance < 0 ? Math.abs(balance) : 0;
    
    document.getElementById('payment-supplier-id').value = supplier.id;
    document.getElementById('payment-supplier-name').value = supplier.name;
    document.getElementById('payment-supplier-balance').value = `$${outstandingAmount.toFixed(2)}`;
    document.getElementById('payment-amount').value = outstandingAmount.toFixed(2);
    document.getElementById('payment-method').value = 'Cash';
    document.getElementById('payment-reference').value = '';
    document.getElementById('payment-notes').value = '';
    
    document.getElementById('make-payment-modal').style.display = 'block';
}

// Submit payment
async function submitPayment(event) {
    event.preventDefault();
    
    try {
        const supplierId = parseInt(document.getElementById('payment-supplier-id').value);
        const amount = parseFloat(document.getElementById('payment-amount').value);
        const paymentMethod = document.getElementById('payment-method').value;
        const reference = document.getElementById('payment-reference').value.trim();
        const notes = document.getElementById('payment-notes').value.trim();
        
        const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        const paidBy = currentUser ? currentUser.name : 'Unknown';
        
        const paymentData = {
            supplierId,
            amount,
            paymentMethod,
            reference,
            notes,
            paidBy
        };
        
        await recordSupplierPayment(paymentData);
        
        alert(`✅ Payment of $${amount.toFixed(2)} recorded successfully!`);
        
        // Close modal
        document.getElementById('make-payment-modal').style.display = 'none';
        
        // Wait a moment for cache updates to process
        await new Promise(resolve => setTimeout(resolve, 600));
        
        // Reload data
        await loadSuppliersTable();
        await loadPaymentHistory();
        await updateSupplierDebtBadge();
        
        // Refresh supplier balances if on payments tab
        if (typeof loadSupplierBalances === 'function') {
            loadSupplierBalances();
        }
        
    } catch (error) {
        console.error('Error recording payment:', error);
        alert(`❌ Failed to record payment: ${error.message}`);
    }
}

// Wrapper function to handle delivery returns with module loading
async function handleDeliveryReturn(deliveryId) {
    try {
        // Ensure purchase-returns module is loaded
        if (typeof initiateDeliveryReturn !== 'function') {
            console.log('📦 Loading purchase-returns module...');
            await loadModuleOnDemand('purchase-returns');
        }
        
        // Call the actual function
        if (typeof initiateDeliveryReturn === 'function') {
            await initiateDeliveryReturn(deliveryId);
        } else {
            throw new Error('initiateDeliveryReturn function not available');
        }
    } catch (error) {
        console.error('❌ Error handling delivery return:', error);
        alert(`❌ Failed to initiate return: ${error.message}`);
    }
}

// Load delivery history
async function loadDeliveryHistory() {
    const tbody = document.getElementById('delivery-history-list');
    if (!tbody) {
        console.warn('⚠️ delivery-history-list element not found');
        return;
    }
    
    try {
        console.log('🔄 Loading delivery history...');
        const deliveries = await getDeliveryHistory();
        console.log(`📦 Found ${deliveries.length} deliveries`);
        
        tbody.innerHTML = '';
        
        if (deliveries.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">📦 No deliveries found. Click "Receive Delivery" to add your first delivery.</td></tr>';
            return;
        }
        
        deliveries.forEach(delivery => {
            const date = new Date(delivery.deliveryDate);
            const dateStr = date.toLocaleDateString();
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${dateStr}</td>
                <td>${delivery.supplierName || 'Unknown'}</td>
                <td>${delivery.deliveryRef || '-'}</td>
                <td>${delivery.invoiceNumber || '-'}</td>
                <td><span class="badge">${delivery.items ? delivery.items.length : '-'} items</span></td>
                <td><strong>${formatDualCurrencyPlain(delivery.totalAmount)}</strong></td>
                <td>${delivery.receivedBy || '-'}</td>
                <td>
                    <button class="btn-icon-primary" onclick="viewDeliveryDetails(${delivery.id});" title="View Details">👁️</button>
                    ${delivery.returnStatus !== 'full' ? `<button class="btn-icon-warning" onclick="handleDeliveryReturn(${delivery.id});" title="Return Items" style="background: #ff9800;">↩️</button>` : ''}
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('❌ Error loading delivery history:', error);
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 20px; color: red;">❌ Error loading deliveries: ${error.message}</td></tr>`;
    }
}

// View delivery details
async function viewDeliveryDetails(deliveryId) {
    const delivery = await getDeliveryById(deliveryId);
    if (!delivery) return;
    
    const date = new Date(delivery.deliveryDate).toLocaleDateString();
    
    let itemsHtml = '';
    if (delivery.items && delivery.items.length > 0) {
        itemsHtml = '<table style="width: 100%; margin-top: 10px;"><thead><tr><th>Product</th><th>Quantity</th><th>Unit Cost</th><th>Total</th></tr></thead><tbody>';
        delivery.items.forEach(item => {
            itemsHtml += `
                <tr>
                    <td>${item.productIcon || ''} ${item.productName}</td>
                    <td>${item.quantity}</td>
                    <td>${formatDualCurrencyPlain(item.unitCost)}</td>
                    <td>${formatDualCurrencyPlain(item.lineTotal)}</td>
                </tr>
            `;
        });
        itemsHtml += '</tbody></table>';
    }
    
    const content = document.getElementById('delivery-details-content');
    content.innerHTML = `
        <div style="padding: 20px;">
            <h3>Delivery #${delivery.id}</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
                <div>
                    <p><strong>Supplier:</strong> ${delivery.supplierName}</p>
                    <p><strong>Date:</strong> ${date}</p>
                    <p><strong>Reference:</strong> ${delivery.deliveryRef || '-'}</p>
                    <p><strong>Invoice:</strong> ${delivery.invoiceNumber || '-'}</p>
                </div>
                <div>
                    <p><strong>Received By:</strong> ${delivery.receivedBy || '-'}</p>
                    <p><strong>Total Amount:</strong> $${delivery.totalAmount.toFixed(2)}</p>
                    <p><strong>Notes:</strong> ${delivery.notes || '-'}</p>
                </div>
            </div>
            <h4>Products Received</h4>
            ${itemsHtml}
        </div>
    `;
    
    document.getElementById('delivery-details-modal').style.display = 'block';
}

// Load filtered deliveries
async function loadFilteredDeliveries() {
    // Get container to ensure we read from the correct modal
    const container = document.getElementById('purchases-modal') || document;
    
    const supplierSelect = container.querySelector('#filter-supplier');
    const startDateInput = container.querySelector('#filter-start-date');
    const endDateInput = container.querySelector('#filter-end-date');
    
    const supplierId = supplierSelect?.value;
    const startDate = startDateInput?.value;
    const endDate = endDateInput?.value;
    
    const filters = {};
    if (supplierId) filters.supplierId = parseInt(supplierId);
    if (startDate) filters.startDate = new Date(startDate).getTime();
    if (endDate) filters.endDate = new Date(endDate).getTime();
    
    const deliveries = await getDeliveryHistory(filters);
    
    // Update table (similar to loadDeliveryHistory but with filtered results)
    const tbody = document.getElementById('delivery-history-list');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (deliveries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No deliveries found matching your filters</td></tr>';
        return;
    }
    
    deliveries.forEach(delivery => {
        const date = new Date(delivery.deliveryDate).toLocaleDateString();
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${date}</td>
            <td>${delivery.supplierName || 'Unknown'}</td>
            <td>${delivery.deliveryRef || '-'}</td>
            <td>${delivery.invoiceNumber || '-'}</td>
            <td><span class="badge">-</span></td>
            <td><strong>$${delivery.totalAmount.toFixed(2)}</strong></td>
            <td>${delivery.receivedBy || '-'}</td>
            <td>
                <button class="btn-icon-primary" onclick="viewDeliveryDetails(${delivery.id});" title="View Details">👁️</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Clear delivery filters
function clearDeliveryFilters() {
    // Get container to ensure we clear the correct modal inputs
    const container = document.getElementById('purchases-modal') || document;
    
    const supplierSelect = container.querySelector('#filter-supplier');
    const startDateInput = container.querySelector('#filter-start-date');
    const endDateInput = container.querySelector('#filter-end-date');
    
    if (supplierSelect) supplierSelect.value = '';
    if (startDateInput) startDateInput.value = '';
    if (endDateInput) endDateInput.value = '';
    
    loadDeliveryHistory();
}

// Load payment history
async function loadPaymentHistory() {
    const tbody = document.getElementById('payment-history-list');
    if (!tbody) {
        console.warn('⚠️ payment-history-list element not found');
        return;
    }
    
    try {
        console.log('🔄 Loading payment history...');
        const payments = await getPaymentHistory();
        console.log(`💵 Found ${payments.length} payments`);
        
        tbody.innerHTML = '';
        
        if (payments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">💵 No payments found. Click "Make Payment" to record a payment.</td></tr>';
            return;
        }
        
        payments.forEach(payment => {
            const date = new Date(payment.paidAt).toLocaleDateString();
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${date}</td>
                <td>${payment.supplierName || 'Unknown'}</td>
                <td><strong>${formatDualCurrencyPlain(payment.amount)}</strong></td>
                <td>${payment.paymentMethod || '-'}</td>
                <td>${payment.reference || '-'}</td>
                <td>${payment.paidBy || '-'}</td>
                <td>${payment.notes || '-'}</td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('❌ Error loading payment history:', error);
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px; color: red;">❌ Error loading payments: ${error.message}</td></tr>`;
    }
}

// Load filtered payments
async function loadFilteredPayments() {
    // Get container to ensure we read from the correct modal
    const container = document.getElementById('purchases-modal') || document;
    
    const supplierSelect = container.querySelector('#payment-filter-supplier');
    const startDateInput = container.querySelector('#payment-filter-start-date');
    const endDateInput = container.querySelector('#payment-filter-end-date');
    
    const supplierId = supplierSelect?.value;
    const startDate = startDateInput?.value;
    const endDate = endDateInput?.value;
    
    const filters = {};
    if (supplierId) filters.supplierId = parseInt(supplierId);
    if (startDate) filters.startDate = new Date(startDate).getTime();
    if (endDate) filters.endDate = new Date(endDate).getTime();
    
    const payments = await getPaymentHistory(filters);
    
    const tbody = document.getElementById('payment-history-list');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (payments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No payments found matching your filters</td></tr>';
        return;
    }
    
    payments.forEach(payment => {
        const date = new Date(payment.paidAt).toLocaleDateString();
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${date}</td>
            <td>${payment.supplierName || 'Unknown'}</td>
            <td><strong>$${payment.amount.toFixed(2)}</strong></td>
            <td>${payment.paymentMethod || '-'}</td>
            <td>${payment.reference || '-'}</td>
            <td>${payment.paidBy || '-'}</td>
            <td>${payment.notes || '-'}</td>
        `;
        tbody.appendChild(row);
    });
}

// Clear payment filters
function clearPaymentFilters() {
    // Get container to ensure we clear the correct modal inputs
    const container = document.getElementById('purchases-modal') || document;
    
    const supplierSelect = container.querySelector('#payment-filter-supplier');
    const startDateInput = container.querySelector('#payment-filter-start-date');
    const endDateInput = container.querySelector('#payment-filter-end-date');
    
    if (supplierSelect) supplierSelect.value = '';
    if (startDateInput) startDateInput.value = '';
    if (endDateInput) endDateInput.value = '';
    
    loadPaymentHistory();
}

// Load purchase returns table
async function loadPurchaseReturnsTable() {
    const tbody = document.getElementById('purchase-returns-list');
    if (!tbody) {
        console.warn('⚠️ purchase-returns-list element not found');
        return;
    }
    
    try {
        console.log('🔄 Loading purchase returns...');
        let returns = [];
        try {
            returns = await loadPurchaseReturns();
        } catch (error) {
            // Purchase returns table doesn't exist yet (feature not implemented)
            if (error.message && error.message.includes('no such table')) {
                console.warn('⚠️ Purchase returns feature not yet available');
                tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">ℹ️ Purchase returns feature coming soon</td></tr>';
                return;
            }
            throw error;
        }
        console.log(`↩️ Found ${returns.length} returns`);
        
        tbody.innerHTML = '';
        
        if (returns.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">↩️ No returns found. Returns will appear here when items are returned to suppliers.</td></tr>';
            return;
        }
        
        const reasonLabels = {
            'bad_items': '🔴 Bad Items',
            'not_needed': '📦 Not Needed',
            'incorrect_items': '⚠️ Incorrect',
            'expired': '⏰ Expired',
            'wrong_specification': '📋 Wrong Spec',
            'other': '❓ Other'
        };
        
        returns.forEach(returnRecord => {
            const date = new Date(returnRecord.timestamp).toLocaleDateString();
            const returnItems = JSON.parse(returnRecord.returnItems || '[]');
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${date}</td>
                <td>${returnRecord.deliveryRef || '-'}</td>
                <td>${returnRecord.supplierName || 'Unknown'}</td>
                <td><span class="badge">${reasonLabels[returnRecord.reason] || returnRecord.reason}</span></td>
                <td><span class="badge">${returnItems.length} items</span></td>
                <td><strong style="color: #f44336;">${formatDualCurrencyPlain(-returnRecord.returnAmount)}</strong></td>
                <td>${returnRecord.approverUsername}</td>
                <td>
                    <button class="btn-icon-primary" onclick="viewPurchaseReturnDetails(${returnRecord.id});" title="View Details">👁️</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('❌ Error loading purchase returns:', error);
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 20px; color: red;">❌ Error loading returns: ${error.message}</td></tr>`;
    }
}

// Load filtered returns
async function loadFilteredReturns() {
    // Get container to ensure we read from the correct modal
    const container = document.getElementById('purchases-modal') || document;
    
    const supplierSelect = container.querySelector('#returns-filter-supplier');
    const reasonSelect = container.querySelector('#returns-filter-reason');
    const startDateInput = container.querySelector('#returns-filter-start-date');
    const endDateInput = container.querySelector('#returns-filter-end-date');
    
    const supplierId = supplierSelect?.value;
    const reason = reasonSelect?.value;
    const startDate = startDateInput?.value;
    const endDate = endDateInput?.value;
    
    const filters = {};
    if (supplierId) filters.supplierId = parseInt(supplierId);
    if (reason) filters.reason = reason;
    if (startDate) filters.startDate = new Date(startDate).getTime();
    if (endDate) filters.endDate = new Date(endDate).getTime();
    
    const returns = await loadPurchaseReturns(filters);
    
    const tbody = document.getElementById('purchase-returns-list');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (returns.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No returns found matching your filters</td></tr>';
        return;
    }
    
    const reasonLabels = {
        'bad_items': '🔴 Bad Items',
        'not_needed': '📦 Not Needed',
        'incorrect_items': '⚠️ Incorrect',
        'expired': '⏰ Expired',
        'wrong_specification': '📋 Wrong Spec',
        'other': '❓ Other'
    };
    
    returns.forEach(returnRecord => {
        const date = new Date(returnRecord.timestamp).toLocaleDateString();
        const returnItems = JSON.parse(returnRecord.returnItems || '[]');
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${date}</td>
            <td>${returnRecord.deliveryRef || '-'}</td>
            <td>${returnRecord.supplierName || 'Unknown'}</td>
            <td><span class="badge">${reasonLabels[returnRecord.reason] || returnRecord.reason}</span></td>
            <td><span class="badge">${returnItems.length} items</span></td>
            <td><strong style="color: #f44336;">-$${returnRecord.returnAmount.toFixed(2)}</strong></td>
            <td>${returnRecord.approverUsername}</td>
            <td>
                <button class="btn-icon-primary" onclick="viewPurchaseReturnDetails(${returnRecord.id});" title="View Details">👁️</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Clear returns filters
function clearReturnsFilters() {
    // Get container to ensure we clear the correct modal inputs
    const container = document.getElementById('purchases-modal') || document;
    
    const supplierSelect = container.querySelector('#returns-filter-supplier');
    const reasonSelect = container.querySelector('#returns-filter-reason');
    const startDateInput = container.querySelector('#returns-filter-start-date');
    const endDateInput = container.querySelector('#returns-filter-end-date');
    
    if (supplierSelect) supplierSelect.value = '';
    if (reasonSelect) reasonSelect.value = '';
    if (startDateInput) startDateInput.value = '';
    if (endDateInput) endDateInput.value = '';
    
    loadPurchaseReturnsTable();
}

// Update supplier debt badge
async function updateSupplierDebtBadge() {
    const totalDebt = await getTotalSupplierDebt();
    const badge = document.getElementById('purchases-debt-badge');
    
    if (badge) {
        if (totalDebt > 0) {
            badge.textContent = `$${totalDebt.toFixed(0)}`;
            badge.style.display = 'inline-block';
            badge.style.background = '#f44336';
        } else {
            badge.style.display = 'none';
        }
    }
}

// Load and display supplier statement
async function loadAndDisplaySupplierStatement() {
    try {
        // Ensure suppliers module is loaded
        if (typeof loadSuppliers !== 'function' || typeof loadSupplierStatement !== 'function') {
            console.log('📦 Loading suppliers module...');
            await loadModuleOnDemand('suppliers');
        }
        
        const supplierId = document.getElementById('statement-supplier').value;
        
        // Get date range from filters
        const container = document.getElementById('purchases-modal') || document;
        const startDateInput = container.querySelector('#statement-start-date');
        const endDateInput = container.querySelector('#statement-end-date');
        
        const startDate = startDateInput ? startDateInput.value : null;
        const endDate = endDateInput ? endDateInput.value : null;
        
        // If no supplier selected, load all suppliers with purchases in date range
        if (!supplierId) {
            console.log('📊 Loading purchase report for all suppliers');
            const allSuppliers = await loadSuppliers();
            console.log('👥 Found suppliers:', allSuppliers);
            
            if (!allSuppliers || allSuppliers.length === 0) {
                showNotification('⚠️ No suppliers found in database', 'warning');
                return;
            }
            
            // Display purchases grouped by supplier with date filter
            displayAllSuppliersPurchases(allSuppliers, startDate, endDate);
            showNotification(`✅ Loaded purchases report`, 'success');
            return;
        }
        
        console.log('📊 Loading statement for supplier:', supplierId);
        console.log('📅 Date range:', startDate, 'to', endDate);
        
        const statement = await loadSupplierStatement(parseInt(supplierId), startDate, endDate);
        
        if (!statement) {
            showNotification('❌ Failed to load statement', 'error');
            return;
        }
        
        // Display statement in a table or detailed view
        displaySupplierStatement(statement);
        
        showNotification('✅ Statement loaded successfully', 'success');
        
    } catch (error) {
        console.error('❌ Error loading statement:', error);
        showNotification('Error: ' + error.message, 'error');
    }
}

// Display all suppliers purchases with expandable rows (matching sales report format)
function displayAllSuppliersPurchases(suppliers, startDate, endDate) {
    console.log('🖥️ Displaying purchase report for all suppliers:', suppliers);
    console.log('📅 Date range:', startDate, 'to', endDate);
    
    const container = document.getElementById('statement-summary');
    if (!container) {
        console.error('❌ Statement summary container not found');
        return;
    }
    
    // Hide the empty message
    const emptyMessage = document.getElementById('statement-empty');
    if (emptyMessage) {
        emptyMessage.style.display = 'none';
    }
    
    // Hide the statement table if it exists
    const statementTable = document.getElementById('statement-table');
    if (statementTable) {
        statementTable.classList.add('d-none');
    }
    
    // Force display to block to override CSS
    container.classList.remove('d-none');
    container.style.display = 'block';
    
    // Group deliveries by supplier with date filter
    let purchasesBySupplier = [];
    let grandTotal = 0;
    let grandTotalItems = 0;
    
    suppliers.forEach(supplier => {
        // Build query with date filter
        let query = `
            SELECT d.*
            FROM deliveries d
            WHERE d.supplierId = ?
        `;
        const params = [supplier.id];
        
        // Convert date strings to timestamps for comparison
        if (startDate) {
            query += ` AND d.deliveryDate >= ?`;
            params.push(new Date(startDate).getTime());
        }
        if (endDate) {
            // Add 23:59:59 to include the entire end date
            const endDateTime = new Date(endDate);
            endDateTime.setHours(23, 59, 59, 999);
            query += ` AND d.deliveryDate <= ?`;
            params.push(endDateTime.getTime());
        }
        
        query += ` ORDER BY d.deliveryDate DESC`;
        
        const deliveries = runQuery(query, params);
        
        if (deliveries && deliveries.length > 0) {
            // Calculate totals for this supplier
            let supplierTotal = 0;
            let supplierItemCount = 0;
            
            deliveries.forEach(delivery => {
                supplierTotal += delivery.totalAmount || 0;
                
                // Get items count for this delivery
                const items = runQuery(`
                    SELECT COUNT(*) as count
                    FROM delivery_items
                    WHERE deliveryId = ?
                `, [delivery.id]);
                supplierItemCount += items[0]?.count || 0;
            });
            
            purchasesBySupplier.push({
                supplier: supplier,
                deliveries: deliveries,
                total: supplierTotal,
                itemCount: supplierItemCount
            });
            
            grandTotal += supplierTotal;
            grandTotalItems += supplierItemCount;
        }
    });
    
    // Build HTML with expandable rows (matching sales report structure)
    const tableHTML = `
        <table class="sales-table-grid">
            <thead>
                <tr>
                    <th width="5%"></th>
                    <th width="25%">Supplier</th>
                    <th width="10%">Deliveries</th>
                    <th width="10%">Total Items</th>
                    <th width="15%">Total Amount</th>
                    <th width="35%">Contact</th>
                </tr>
            </thead>
            <tbody>
                ${purchasesBySupplier.length === 0 ? `
                    <tr>
                        <td colspan="6" style="text-align: center; padding: 30px;">
                            <div class="empty-state">No purchases found for the selected period</div>
                        </td>
                    </tr>
                ` : purchasesBySupplier.map((supplierData, index) => {
                    const { supplier, deliveries, total, itemCount } = supplierData;
                    
                    // Create detailed deliveries list with individual items (matching sales report format)
                    const deliveriesList = deliveries.map(delivery => {
                        const deliveryDate = new Date(delivery.deliveryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                        
                        // Get items for this delivery
                        const items = runQuery(`
                            SELECT di.*, p.name as productName
                            FROM delivery_items di
                            LEFT JOIN products p ON di.productId = p.id
                            WHERE di.deliveryId = ?
                        `, [delivery.id]);
                        
                        // Show delivery header + individual items breakdown
                        let deliveryHtml = `<div style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--color-border);">
                            <div style="font-weight: 600; color: var(--color-accent); margin-bottom: 8px;">
                                📦 ${deliveryDate} - ${delivery.deliveryRef || delivery.invoiceNumber || 'No Ref'} - ${formatDualCurrencyPlain(delivery.totalAmount)}
                            </div>`;
                        
                        // Add each item as a separate row (like sales report)
                        items.forEach(item => {
                            deliveryHtml += `<div class="sale-item-detail">
                                <span class="item-name">${item.productName || 'Unknown Product'}</span>
                                <span class="item-qty">×${item.quantity || 0}</span>
                                <span class="item-price">@ ${formatDualCurrencyPlain(item.unitCost || 0)}</span>
                                <span class="item-price" style="font-weight: 600;">${formatDualCurrencyPlain(item.lineTotal || 0)}</span>
                            </div>`;
                        });
                        
                        deliveryHtml += `</div>`;
                        return deliveryHtml;
                    }).join('');
                    
                    return `
                        <tr class="sale-row" onclick="togglePurchaseDetails(${index})">
                            <td>
                                <div class="sale-items-summary">
                                    <span class="expand-icon" id="expand-icon-${index}">▶</span>
                                </div>
                            </td>
                            <td>
                                <div style="font-weight: 600; color: var(--color-text);">
                                    ${supplier.name}
                                </div>
                            </td>
                            <td>${deliveries.length}</td>
                            <td>${itemCount}</td>
                            <td style="font-weight: 600; color: var(--color-accent);">
                                ${formatDualCurrencyPlain(total)}
                            </td>
                            <td>
                                <div style="font-size: 12px; color: var(--color-text-secondary);">
                                    ${supplier.phone || 'No phone'} ${supplier.email ? '• ' + supplier.email : ''}
                                </div>
                            </td>
                        </tr>
                        <tr class="sale-details-row" id="purchase-details-${index}" style="display: none;">
                            <td colspan="6">
                                <div class="sale-items-details">
                                    ${deliveriesList}
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('')}
                ${purchasesBySupplier.length > 0 ? `
                    <tr style="background: var(--color-bg-secondary); border-top: 2px solid var(--color-border); font-weight: 600;">
                        <td></td>
                        <td>TOTAL</td>
                        <td>${purchasesBySupplier.reduce((sum, s) => sum + s.deliveries.length, 0)}</td>
                        <td>${grandTotalItems}</td>
                        <td style="color: var(--color-accent); font-size: 1.1em;">${formatDualCurrencyPlain(grandTotal)}</td>
                        <td></td>
                    </tr>
                ` : ''}
            </tbody>
        </table>
    `;
    
    const html = tableHTML;
    
    container.innerHTML = html;
    console.log('✅ Purchase report displayed with', purchasesBySupplier.length, 'suppliers');
}

// Display all suppliers statements overview (legacy function - kept for compatibility)
function displayAllSuppliersStatements(suppliers) {
    console.log('🖥️ Displaying all suppliers:', suppliers);
    
    const container = document.getElementById('statement-summary');
    if (!container) {
        console.error('❌ Statement summary container not found');
        return;
    }
    
    // Hide the empty message
    const emptyMessage = document.getElementById('statement-empty');
    if (emptyMessage) {
        emptyMessage.style.display = 'none';
    }
    
    // Hide the statement table if it exists
    const statementTable = document.getElementById('statement-table');
    if (statementTable) {
        statementTable.classList.add('d-none');
    }
    
    // Force display to block to override CSS
    container.classList.remove('d-none');
    container.style.display = 'block';
    
    let html = `
        <div class="card">
            <div class="card-header">
                <h5>All Suppliers Overview</h5>
            </div>
            <div class="card-body">
                <div class="table-responsive">
                    <table class="table table-striped">
                        <thead>
                            <tr>
                                <th>Supplier Name</th>
                                <th>Phone</th>
                                <th>Email</th>
                                <th>Current Balance</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
    `;
    
    suppliers.forEach(supplier => {
        // Calculate balance from transactions instead of using stale database field
        const purchases = runQuery(`
            SELECT COALESCE(SUM(totalAmount), 0) as total
            FROM deliveries
            WHERE supplierId = ?
        `, [supplier.id]);
        
        const payments = runQuery(`
            SELECT COALESCE(SUM(amount), 0) as total
            FROM supplier_payments
            WHERE supplierId = ?
        `, [supplier.id]);
        
        // Purchase returns feature not yet implemented
        let totalReturns = 0;
        try {
            const returns = runQuery(`
                SELECT COALESCE(SUM(returnAmount), 0) as total
                FROM purchase_returns pr
                JOIN deliveries d ON pr.deliveryId = d.id
                WHERE d.supplierId = ?
            `, [supplier.id]);
            totalReturns = returns[0]?.total || 0;
        } catch (error) {
            // Silently ignore if table doesn't exist
            if (!error.message || !error.message.includes('no such table')) {
                console.error('Error loading purchase returns:', error);
            }
        }
        
        const totalPurchases = purchases[0]?.total || 0;
        const totalPaid = payments[0]?.total || 0;
        const balance = totalPurchases - totalPaid - totalReturns;
        
        const statusClass = balance > 0 ? 'danger' : balance < 0 ? 'success' : 'secondary';
        const statusText = balance > 0 ? 'WE OWE' : balance < 0 ? 'OVERPAID' : 'SETTLED';
        
        html += `
            <tr>
                <td><strong>${supplier.name}</strong></td>
                <td>${supplier.phone || 'N/A'}</td>
                <td>${supplier.email || 'N/A'}</td>
                <td><span class="badge bg-${statusClass}">${formatDualCurrencyPlain(Math.abs(balance))}</span></td>
                <td><span class="badge bg-${statusClass}">${statusText}</span></td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="document.getElementById('statement-supplier').value='${supplier.id}'; loadAndDisplaySupplierStatement();">
                        View Details
                    </button>
                </td>
            </tr>
        `;
    });
    
    // Calculate grand totals
    let grandTotalPurchases = 0;
    let grandTotalPaid = 0;
    let grandTotalBalance = 0;
    
    suppliers.forEach(supplier => {
        const purchases = runQuery(`
            SELECT COALESCE(SUM(totalAmount), 0) as total
            FROM deliveries
            WHERE supplierId = ?
        `, [supplier.id]);
        
        const payments = runQuery(`
            SELECT COALESCE(SUM(amount), 0) as total
            FROM supplier_payments
            WHERE supplierId = ?
        `, [supplier.id]);
        
        let totalReturns = 0;
        try {
            const returns = runQuery(`
                SELECT COALESCE(SUM(returnAmount), 0) as total
                FROM purchase_returns pr
                JOIN deliveries d ON pr.deliveryId = d.id
                WHERE d.supplierId = ?
            `, [supplier.id]);
            totalReturns = returns[0]?.total || 0;
        } catch (error) {
            console.log('No purchase returns for supplier', supplier.id);
        }
        
        const totalPurchases = purchases[0]?.total || 0;
        const totalPaid = payments[0]?.total || 0;
        const balance = totalPurchases - totalPaid - totalReturns;
        
        grandTotalPurchases += totalPurchases;
        grandTotalPaid += totalPaid;
        grandTotalBalance += balance;
    });
    
    // Add totals row
    html += `
            <tr style="background: #f5f5f5; border-top: 3px solid #333; font-weight: bold; font-size: 1.1em;">
                <td colspan="3" style="text-align: right; padding: 15px;">TOTAL:</td>
                <td><span class="badge bg-${grandTotalBalance > 0 ? 'danger' : grandTotalBalance < 0 ? 'success' : 'secondary'}">${formatDualCurrencyPlain(Math.abs(grandTotalBalance))}</span></td>
                <td><span class="badge bg-${grandTotalBalance > 0 ? 'danger' : grandTotalBalance < 0 ? 'success' : 'secondary'}">${grandTotalBalance > 0 ? 'WE OWE' : grandTotalBalance < 0 ? 'OVERPAID' : 'SETTLED'}</span></td>
                <td></td>
            </tr>
    `;
    
    html += `
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    
    console.log('📝 Setting innerHTML for statement-summary');
    container.innerHTML = html;
    console.log('✅ Suppliers table displayed');
}

// Display supplier statement in the UI
function displaySupplierStatement(statement) {
    const container = document.getElementById('statement-summary');
    if (!container) {
        console.warn('⚠️ Statement display container not found');
        return;
    }
    
    // Hide the empty message
    const emptyMessage = document.getElementById('statement-empty');
    if (emptyMessage) {
        emptyMessage.style.display = 'none';
    }
    
    // Hide the statement table if it exists
    const statementTable = document.getElementById('statement-table');
    if (statementTable) {
        statementTable.classList.add('d-none');
    }
    
    // Make container visible - force display to override CSS
    container.classList.remove('d-none');
    container.style.display = 'block';
    
    const { supplier, transactions, currentBalance } = statement;
    
    let html = `
        <div style="margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px;">
            <h3 style="margin: 0 0 10px 0; color: #333;">📋 ${supplier.name}</h3>
            <p style="margin: 5px 0; color: #333;"><strong>Contact:</strong> ${supplier.contactPerson || 'N/A'}</p>
            <p style="margin: 5px 0; color: #333;"><strong>Phone:</strong> ${supplier.phone || 'N/A'}</p>
            <p style="margin: 5px 0; color: #333;"><strong>Current Balance:</strong> 
                <span style="color: ${currentBalance < 0 ? '#f44336' : '#4CAF50'}; font-weight: bold; font-size: 1.2em;">
                    $${Math.abs(currentBalance).toFixed(2)} ${currentBalance < 0 ? '(We Owe)' : '(Overpaid)'}
                </span>
            </p>
        </div>
        
        <h4 style="margin: 20px 0 10px 0; color: #333;">📊 Transaction History</h4>
    `;
    
    if (transactions.length === 0) {
        html += '<p style="text-align: center; padding: 20px; color: #999;">No transactions found</p>';
    } else {
        html += `
            <table class="data-table">
                <thead>
                    <tr>
                        <th width="12%">Date</th>
                        <th width="15%">Type</th>
                        <th width="35%">Reference / Item</th>
                        <th width="15%">Details</th>
                        <th width="11%">Debit</th>
                        <th width="12%">Credit</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        // Calculate totals as we iterate
        let totalDebit = 0;
        let totalCredit = 0;
        
        transactions.forEach(txn => {
            const date = new Date(txn.date).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
            });
            const isDelivery = txn.type === 'delivery';
            
            if (isDelivery) {
                // Delivery header row
                html += `
                    <tr style="background: #fff3cd;">
                        <td style="color: #333;">${date}</td>
                        <td><span class="badge" style="background: #ff9800; color: #fff;">📦 DELIVERY</span></td>
                        <td style="color: #333;"><strong>${txn.reference || 'No Ref'}</strong></td>
                        <td style="color: #333;"></td>
                        <td style="color: #f44336; font-weight: bold;">$${txn.amount.toFixed(2)}</td>
                        <td style="color: #333;">-</td>
                    </tr>
                `;
                
                // Get items for this delivery
                const items = runQuery(`
                    SELECT di.*, p.name as productName
                    FROM delivery_items di
                    LEFT JOIN products p ON di.productId = p.id
                    WHERE di.deliveryId = ?
                `, [txn.id]);
                
                // Add each item as a sub-row
                items.forEach(item => {
                    html += `
                        <tr style="background: #fffef5;">
                            <td style="color: #333;"></td>
                            <td style="color: #333;"></td>
                            <td style="padding-left: 30px; color: #333;">→ ${item.productName || 'Unknown Product'}</td>
                            <td style="font-size: 0.9em; color: #666;">×${item.quantity || 0} @ $${(item.unitCost || 0).toFixed(2)}</td>
                            <td style="color: #666;">$${(item.lineTotal || 0).toFixed(2)}</td>
                            <td style="color: #333;"></td>
                        </tr>
                    `;
                });
                
                totalDebit += txn.amount;
            } else {
                // Payment row
                html += `
                    <tr>
                        <td style="color: #333;">${date}</td>
                        <td><span class="badge" style="background: #4CAF50; color: #fff;">💵 PAYMENT</span></td>
                        <td style="color: #333;">${txn.reference || '-'}</td>
                        <td style="font-size: 0.9em; color: #666;">${txn.notes || '-'}</td>
                        <td style="color: #333;">-</td>
                        <td style="color: #4CAF50; font-weight: bold;">$${txn.amount.toFixed(2)}</td>
                    </tr>
                `;
                totalCredit += txn.amount;
            }
        });
        
        // Add total row
        const netBalance = totalDebit - totalCredit;
        html += `
                <tr style="background: #f5f5f5; border-top: 2px solid #333;">
                    <td colspan="4" style="text-align: right; font-weight: bold; padding: 12px;">TOTAL:</td>
                    <td style="color: #f44336; font-weight: bold; font-size: 1.1em;">$${totalDebit.toFixed(2)}</td>
                    <td style="color: #4CAF50; font-weight: bold; font-size: 1.1em;">$${totalCredit.toFixed(2)}</td>
                </tr>
                <tr style="background: #e8f5e9; border-top: 1px solid #4CAF50;">
                    <td colspan="4" style="text-align: right; font-weight: bold; padding: 12px; font-size: 1.1em;">NET BALANCE:</td>
                    <td colspan="2" style="font-weight: bold; font-size: 1.2em; color: ${netBalance < 0 ? '#4CAF50' : '#f44336'};">
                        $${Math.abs(netBalance).toFixed(2)} ${netBalance < 0 ? '(Overpaid)' : '(We Owe)'}
                    </td>
                </tr>
        `;
        
        html += `
                </tbody>
            </table>
        `;
    }
    
    container.innerHTML = html;
}

// Toggle purchase details (matching sales report pattern)
function togglePurchaseDetails(index) {
    const detailsRow = document.getElementById(`purchase-details-${index}`);
    const expandIcon = document.getElementById(`expand-icon-${index}`);
    
    if (detailsRow && expandIcon) {
        if (detailsRow.style.display === 'none' || !detailsRow.style.display) {
            detailsRow.style.display = 'table-row';
            expandIcon.textContent = '▼';
        } else {
            detailsRow.style.display = 'none';
            expandIcon.textContent = '▶';
        }
    }
}

// Make toggle function globally accessible
window.togglePurchaseDetails = togglePurchaseDetails;

// Export supplier statement to PDF
async function exportSupplierStatementPDF() {
    try {
        const supplierId = document.getElementById('statement-supplier').value;
        
        // Get date range from filters
        const container = document.getElementById('purchases-modal') || document;
        const startDateInput = container.querySelector('#statement-start-date');
        const endDateInput = container.querySelector('#statement-end-date');
        
        const startDate = startDateInput ? startDateInput.value : null;
        const endDate = endDateInput ? endDateInput.value : null;
        
        // Check if showing all suppliers or single supplier
        if (!supplierId) {
            // Export filtered purchase report (matching what's displayed on screen)
            const allSuppliers = await loadSuppliers();
            
            if (!allSuppliers || allSuppliers.length === 0) {
                showNotification('❌ No suppliers to export', 'error');
                return;
            }
            
            // Build filtered purchase data (same logic as displayAllSuppliersPurchases)
            const pdfData = [];
            let grandTotal = 0;
            
            for (const supplier of allSuppliers) {
                // Build query with date filter (same as display function)
                let query = `
                    SELECT d.*
                    FROM deliveries d
                    WHERE d.supplierId = ?
                `;
                const params = [supplier.id];
                
                // Convert date strings to timestamps for comparison
                if (startDate) {
                    query += ` AND d.deliveryDate >= ?`;
                    params.push(new Date(startDate).getTime());
                }
                if (endDate) {
                    const endDateTime = new Date(endDate);
                    endDateTime.setHours(23, 59, 59, 999);
                    query += ` AND d.deliveryDate <= ?`;
                    params.push(endDateTime.getTime());
                }
                
                query += ` ORDER BY d.deliveryDate DESC`;
                
                const deliveries = runQuery(query, params);
                
                if (deliveries && deliveries.length > 0) {
                    let supplierTotal = 0;
                    
                    // Add supplier header row
                    pdfData.push({
                        date: '',
                        supplier: `--- ${supplier.name.toUpperCase()} ---`,
                        reference: '',
                        items: '',
                        amount: ''
                    });
                    
                    // Add each delivery as a detailed row
                    deliveries.forEach(delivery => {
                        const deliveryDate = new Date(delivery.deliveryDate).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                        });
                        
                        // Get items for this delivery
                        const items = runQuery(`
                            SELECT di.*, p.name as productName
                            FROM delivery_items di
                            LEFT JOIN products p ON di.productId = p.id
                            WHERE di.deliveryId = ?
                        `, [delivery.id]);
                        
                        const itemsCount = items.length;
                        const itemsList = items.map(item => 
                            `${item.productName || 'Unknown'} (x${item.quantity})`
                        ).join(', ');
                        
                        pdfData.push({
                            date: deliveryDate,
                            supplier: delivery.deliveryRef || delivery.invoiceNumber || 'No Ref',
                            reference: itemsList,
                            items: `${itemsCount} item${itemsCount !== 1 ? 's' : ''}`,
                            amount: formatDualCurrencyPlain(delivery.totalAmount)
                        });
                        
                        supplierTotal += delivery.totalAmount || 0;
                    });
                    
                    // Add supplier subtotal row
                    pdfData.push({
                        date: '',
                        supplier: `Subtotal: ${supplier.name}`,
                        reference: '',
                        items: `${deliveries.length} deliveries`,
                        amount: formatDualCurrencyPlain(supplierTotal)
                    });
                    
                    // Add spacing row
                    pdfData.push({
                        date: '',
                        supplier: '',
                        reference: '',
                        items: '',
                        amount: ''
                    });
                    
                    grandTotal += supplierTotal;
                }
            }
            
            if (pdfData.length === 0) {
                showNotification('❌ No purchases found for the selected period', 'warning');
                return;
            }
            
            // Add grand total row
            pdfData.push({
                date: '',
                supplier: '--- GRAND TOTAL ---',
                reference: '',
                items: '',
                amount: formatDualCurrencyPlain(grandTotal)
            });
            
            const columns = [
                {header: 'Date', dataKey: 'date', width: 15},
                {header: 'Ref/Supplier', dataKey: 'supplier', width: 25},
                {header: 'Items', dataKey: 'reference', width: 35},
                {header: 'Count', dataKey: 'items', width: 12},
                {header: 'Amount', dataKey: 'amount', width: 13}
            ];
            
            const dateRangeStr = startDate || endDate 
                ? `${startDate || 'Start'} to ${endDate || 'Today'}`
                : 'All Time';
            const filename = `purchase-report-${new Date().toISOString().split('T')[0]}`;
            
            await exportToPDF(pdfData, columns, 'Purchase Report - Detailed', filename, {
                subtitle: `Period: ${dateRangeStr}`
            });
            showNotification('✅ PDF exported successfully', 'success');
            return;
        }
        
        // Export single supplier statement with date filter
        const statement = await loadSupplierStatement(parseInt(supplierId), startDate, endDate);
        
        if (!statement || !statement.transactions) {
            showNotification('❌ Failed to load statement', 'error');
            return;
        }
        
        // Prepare data for PDF with detailed items for deliveries
        const pdfData = [];
        
        statement.transactions.forEach(txn => {
            const date = new Date(txn.date).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
            });
            const isDelivery = txn.type === 'delivery';
            
            if (isDelivery) {
                // Add delivery header
                pdfData.push({
                    date: date,
                    type: 'DELIVERY',
                    reference: txn.reference || 'No Ref',
                    items: '',
                    debit: formatDualCurrencyPlain(txn.amount),
                    credit: ''
                });
                
                // Get items for this delivery
                const items = runQuery(`
                    SELECT di.*, p.name as productName
                    FROM delivery_items di
                    LEFT JOIN products p ON di.productId = p.id
                    WHERE di.deliveryId = ?
                `, [txn.id]);
                
                // Add each item as a sub-row
                items.forEach(item => {
                    pdfData.push({
                        date: '',
                        type: '',
                        reference: `  > ${item.productName || 'Unknown'}`,
                        items: `x${item.quantity || 0} @ ${formatDualCurrencyPlain(item.unitCost || 0)}`,
                        debit: formatDualCurrencyPlain(item.lineTotal || 0),
                        credit: ''
                    });
                });
            } else {
                // Payment row
                pdfData.push({
                    date: date,
                    type: 'PAYMENT',
                    reference: txn.reference || '-',
                    items: txn.notes || '-',
                    debit: '',
                    credit: formatDualCurrencyPlain(txn.amount)
                });
            }
        });
        
        // Add totals
        const totalDebit = statement.transactions
            .filter(t => t.type === 'delivery')
            .reduce((sum, t) => sum + (t.amount || 0), 0);
        const totalCredit = statement.transactions
            .filter(t => t.type === 'payment')
            .reduce((sum, t) => sum + (t.amount || 0), 0);
        
        pdfData.push({
            date: '',
            type: '--- TOTAL ---',
            reference: '',
            items: '',
            debit: formatDualCurrencyPlain(totalDebit),
            credit: formatDualCurrencyPlain(totalCredit)
        });
        
        pdfData.push({
            date: '',
            type: 'NET BALANCE',
            reference: '',
            items: '',
            debit: '',
            credit: formatDualCurrencyPlain(Math.abs(statement.currentBalance)) + (statement.currentBalance < 0 ? ' (We Owe)' : ' (Overpaid)')
        });
        
        const columns = [
            {header: 'Date', dataKey: 'date', width: 12},
            {header: 'Type', dataKey: 'type', width: 15},
            {header: 'Reference/Item', dataKey: 'reference', width: 30},
            {header: 'Details', dataKey: 'items', width: 18},
            {header: 'Debit', dataKey: 'debit', width: 12},
            {header: 'Credit', dataKey: 'credit', width: 13}
        ];
        
        const dateRangeStr = startDate || endDate 
            ? `${startDate || 'Start'} to ${endDate || 'Today'}`
            : 'All Time';
        const filename = `supplier-statement-${statement.supplier.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}`;
        
        await exportToPDF(pdfData, columns, `Supplier Statement: ${statement.supplier.name}`, filename, {
            subtitle: `Period: ${dateRangeStr} | Balance: ${formatDualCurrencyPlain(statement.currentBalance)}`
        });
        
        showNotification('✅ PDF exported successfully', 'success');
        
    } catch (error) {
        console.error('Error exporting PDF:', error);
        showNotification('Error exporting PDF', 'error');
    }
}

// Export supplier statement to Excel
async function exportSupplierStatementExcel() {
    try {
        const supplierId = document.getElementById('statement-supplier').value;
        
        // Get date range from filters
        const container = document.getElementById('purchases-modal') || document;
        const startDateInput = container.querySelector('#statement-start-date');
        const endDateInput = container.querySelector('#statement-end-date');
        
        const startDate = startDateInput ? startDateInput.value : null;
        const endDate = endDateInput ? endDateInput.value : null;
        
        // Check if showing all suppliers or single supplier
        if (!supplierId) {
            // Export filtered purchase report (matching what's displayed on screen)
            const allSuppliers = await loadSuppliers();
            
            if (!allSuppliers || allSuppliers.length === 0) {
                showNotification('❌ No suppliers to export', 'error');
                return;
            }
            
            // Build filtered purchase data (same logic as displayAllSuppliersPurchases)
            const excelData = [];
            let grandTotal = 0;
            
            for (const supplier of allSuppliers) {
                // Build query with date filter
                let query = `
                    SELECT d.*
                    FROM deliveries d
                    WHERE d.supplierId = ?
                `;
                const params = [supplier.id];
                
                // Convert date strings to timestamps for comparison
                if (startDate) {
                    query += ` AND d.deliveryDate >= ?`;
                    params.push(new Date(startDate).getTime());
                }
                if (endDate) {
                    const endDateTime = new Date(endDate);
                    endDateTime.setHours(23, 59, 59, 999);
                    query += ` AND d.deliveryDate <= ?`;
                    params.push(endDateTime.getTime());
                }
                
                query += ` ORDER BY d.deliveryDate DESC`;
                
                const deliveries = runQuery(query, params);
                
                if (deliveries && deliveries.length > 0) {
                    let supplierTotal = 0;
                    
                    // Add supplier header row
                    excelData.push({
                        date: '',
                        supplier: `--- ${supplier.name.toUpperCase()} ---`,
                        reference: '',
                        items: '',
                        amount: ''
                    });
                    
                    // Add each delivery as a detailed row
                    deliveries.forEach(delivery => {
                        const deliveryDate = new Date(delivery.deliveryDate).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                        });
                        
                        // Get items for this delivery
                        const items = runQuery(`
                            SELECT di.*, p.name as productName
                            FROM delivery_items di
                            LEFT JOIN products p ON di.productId = p.id
                            WHERE di.deliveryId = ?
                        `, [delivery.id]);
                        
                        const itemsCount = items.length;
                        const itemsList = items.map(item => 
                            `${item.productName || 'Unknown'} (x${item.quantity})`
                        ).join(', ');
                        
                        excelData.push({
                            date: deliveryDate,
                            supplier: delivery.deliveryRef || delivery.invoiceNumber || 'No Ref',
                            reference: itemsList,
                            items: `${itemsCount} item${itemsCount !== 1 ? 's' : ''}`,
                            amount: delivery.totalAmount
                        });
                        
                        supplierTotal += delivery.totalAmount || 0;
                    });
                    
                    // Add supplier subtotal row
                    excelData.push({
                        date: '',
                        supplier: `Subtotal: ${supplier.name}`,
                        reference: '',
                        items: `${deliveries.length} deliveries`,
                        amount: supplierTotal
                    });
                    
                    // Add spacing row
                    excelData.push({
                        date: '',
                        supplier: '',
                        reference: '',
                        items: '',
                        amount: ''
                    });
                    
                    grandTotal += supplierTotal;
                }
            }
            
            if (excelData.length === 0) {
                showNotification('❌ No purchases found for the selected period', 'warning');
                return;
            }
            
            // Add grand total row
            excelData.push({
                date: '',
                supplier: '--- GRAND TOTAL ---',
                reference: '',
                items: '',
                amount: grandTotal
            });
            
            const columns = [
                {header: 'Date', key: 'date', width: 15},
                {header: 'Ref/Supplier', key: 'supplier', width: 25},
                {header: 'Items', key: 'reference', width: 40},
                {header: 'Count', key: 'items', width: 15},
                {header: 'Amount', key: 'amount', width: 15, type: 'currency'}
            ];
            
            const dateRangeStr = startDate || endDate 
                ? `${startDate || 'Start'}_to_${endDate || 'Today'}`
                : 'All_Time';
            const filename = `purchase-report-${dateRangeStr}-${new Date().toISOString().split('T')[0]}`;
            
            await exportToExcel(excelData, columns, filename, 'Purchase Report');
            showNotification('✅ Excel exported successfully', 'success');
            return;
        }
        
        // Export single supplier statement with date filter
        const statement = await loadSupplierStatement(parseInt(supplierId), startDate, endDate);
        
        if (!statement || !statement.transactions) {
            showNotification('❌ Failed to load statement', 'error');
            return;
        }
        
        // Prepare data for Excel with detailed items for deliveries
        const excelData = [];
        
        statement.transactions.forEach(txn => {
            const date = new Date(txn.date).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
            });
            const isDelivery = txn.type === 'delivery';
            
            if (isDelivery) {
                // Add delivery header
                excelData.push({
                    date: date,
                    type: 'DELIVERY',
                    reference: txn.reference || 'No Ref',
                    items: '',
                    debit: txn.amount,
                    credit: 0
                });
                
                // Get items for this delivery
                const items = runQuery(`
                    SELECT di.*, p.name as productName
                    FROM delivery_items di
                    LEFT JOIN products p ON di.productId = p.id
                    WHERE di.deliveryId = ?
                `, [txn.id]);
                
                // Add each item as a sub-row
                items.forEach(item => {
                    excelData.push({
                        date: '',
                        type: '',
                        reference: `  > ${item.productName || 'Unknown'}`,
                        items: `x${item.quantity || 0} @ $${(item.unitCost || 0).toFixed(2)}`,
                        debit: item.lineTotal || 0,
                        credit: 0
                    });
                });
            } else {
                // Payment row
                excelData.push({
                    date: date,
                    type: 'PAYMENT',
                    reference: txn.reference || '-',
                    items: txn.notes || '-',
                    debit: 0,
                    credit: txn.amount
                });
            }
        });
        
        // Add totals
        const totalDebit = statement.transactions
            .filter(t => t.type === 'delivery')
            .reduce((sum, t) => sum + (t.amount || 0), 0);
        const totalCredit = statement.transactions
            .filter(t => t.type === 'payment')
            .reduce((sum, t) => sum + (t.amount || 0), 0);
        
        excelData.push({
            date: '',
            type: '--- TOTAL ---',
            reference: '',
            items: '',
            debit: totalDebit,
            credit: totalCredit
        });
        
        excelData.push({
            date: '',
            type: 'NET BALANCE',
            reference: '',
            items: '',
            debit: 0,
            credit: Math.abs(statement.currentBalance)
        });
        
        const columns = [
            {header: 'Date', key: 'date', width: 12},
            {header: 'Type', key: 'type', width: 15},
            {header: 'Reference/Item', key: 'reference', width: 30},
            {header: 'Details', key: 'items', width: 20},
            {header: 'Debit', key: 'debit', width: 12, type: 'currency'},
            {header: 'Credit', key: 'credit', width: 12, type: 'currency'}
        ];
        
        const filename = `supplier-statement-${statement.supplier.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}`;
        
        await exportToExcel(excelData, columns, filename, `Statement: ${statement.supplier.name}`);
        
        showNotification('✅ Excel exported successfully', 'success');
        
    } catch (error) {
        console.error('Error exporting Excel:', error);
        showNotification('Error exporting Excel', 'error');
    }
}

// Export supplier statement to CSV
async function exportSupplierStatementCSV() {
    try {
        const supplierId = document.getElementById('statement-supplier').value;
        
        // Get date range from filters
        const container = document.getElementById('purchases-modal') || document;
        const startDateInput = container.querySelector('#statement-start-date');
        const endDateInput = container.querySelector('#statement-end-date');
        
        const startDate = startDateInput ? startDateInput.value : null;
        const endDate = endDateInput ? endDateInput.value : null;
        
        // Check if showing all suppliers or single supplier
        if (!supplierId) {
            // Export filtered purchase report (matching what's displayed on screen)
            const allSuppliers = await loadSuppliers();
            
            if (!allSuppliers || allSuppliers.length === 0) {
                showNotification('❌ No suppliers to export', 'error');
                return;
            }
            
            // Build filtered purchase data
            const csvData = [];
            let grandTotal = 0;
            
            for (const supplier of allSuppliers) {
                // Build query with date filter
                let query = `
                    SELECT d.*
                    FROM deliveries d
                    WHERE d.supplierId = ?
                `;
                const params = [supplier.id];
                
                // Convert date strings to timestamps for comparison
                if (startDate) {
                    query += ` AND d.deliveryDate >= ?`;
                    params.push(new Date(startDate).getTime());
                }
                if (endDate) {
                    const endDateTime = new Date(endDate);
                    endDateTime.setHours(23, 59, 59, 999);
                    query += ` AND d.deliveryDate <= ?`;
                    params.push(endDateTime.getTime());
                }
                
                query += ` ORDER BY d.deliveryDate DESC`;
                
                const deliveries = runQuery(query, params);
                
                if (deliveries && deliveries.length > 0) {
                    let supplierTotal = 0;
                    
                    // Add supplier header
                    csvData.push({
                        date: '',
                        supplier: `--- ${supplier.name.toUpperCase()} ---`,
                        reference: '',
                        items: '',
                        amount: ''
                    });
                    
                    // Add each delivery as a detailed row
                    deliveries.forEach(delivery => {
                        const deliveryDate = new Date(delivery.deliveryDate).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                        });
                        
                        // Get items for this delivery
                        const items = runQuery(`
                            SELECT di.*, p.name as productName
                            FROM delivery_items di
                            LEFT JOIN products p ON di.productId = p.id
                            WHERE di.deliveryId = ?
                        `, [delivery.id]);
                        
                        const itemsCount = items.length;
                        const itemsList = items.map(item => 
                            `${item.productName || 'Unknown'} (x${item.quantity})`
                        ).join(', ');
                        
                        csvData.push({
                            date: deliveryDate,
                            supplier: delivery.deliveryRef || delivery.invoiceNumber || 'No Ref',
                            reference: itemsList,
                            items: `${itemsCount} item${itemsCount !== 1 ? 's' : ''}`,
                            amount: delivery.totalAmount.toFixed(2)
                        });
                        
                        supplierTotal += delivery.totalAmount || 0;
                    });
                    
                    // Add supplier subtotal
                    csvData.push({
                        date: '',
                        supplier: `Subtotal: ${supplier.name}`,
                        reference: '',
                        items: `${deliveries.length} deliveries`,
                        amount: supplierTotal.toFixed(2)
                    });
                    
                    // Add spacing row
                    csvData.push({
                        date: '',
                        supplier: '',
                        reference: '',
                        items: '',
                        amount: ''
                    });
                    
                    grandTotal += supplierTotal;
                }
            }
            
            if (csvData.length === 0) {
                showNotification('❌ No purchases found for the selected period', 'warning');
                return;
            }
            
            // Build CSV content
            const dateRangeStr = startDate || endDate 
                ? `${startDate || 'Start'} to ${endDate || 'Today'}`
                : 'All Time';
            let csv = `Purchase Report - Detailed\nPeriod: ${dateRangeStr}\n\n`;
            csv += 'Date,Ref/Supplier,Items,Count,Amount\n';
            
            csvData.forEach(row => {
                const supplier = (row.supplier || '').replace(/,/g, ';').replace(/"/g, '""');
                const reference = (row.reference || '').replace(/,/g, ';').replace(/"/g, '""');
                const items = (row.items || '').replace(/,/g, ';');
                csv += `"${row.date}","${supplier}","${reference}","${items}",${row.amount}\n`;
            });
            
            // Add grand total
            csv += `"","--- GRAND TOTAL ---","","",${grandTotal.toFixed(2)}\n`;
            
            // Download CSV
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            const date = new Date().toISOString().split('T')[0];
            
            link.setAttribute('href', url);
            link.setAttribute('download', `purchase-report-${date}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            showNotification('✅ CSV exported successfully', 'success');
            return;
        }
        
        // Export single supplier statement with date filter
        const statement = await loadSupplierStatement(parseInt(supplierId), startDate, endDate);
        
        if (!statement) {
            showNotification('❌ Failed to load statement', 'error');
            return;
        }
        
        // Build CSV content with detailed items
        const dateRangeStr = startDate || endDate 
            ? `Period: ${startDate || 'Start'} to ${endDate || 'Today'}`
            : 'All Time';
        let csv = 'Supplier Account Statement - Detailed\n';
        csv += `Supplier,${statement.supplier.name}\n`;
        csv += `${dateRangeStr}\n`;
        csv += `Contact,${statement.supplier.contactPerson || 'N/A'}\n`;
        csv += `Phone,${statement.supplier.phone || 'N/A'}\n`;
        csv += `Current Balance,$${Math.abs(statement.currentBalance).toFixed(2)} ${statement.currentBalance < 0 ? '(We Owe)' : '(Overpaid)'}\n`;
        csv += '\nDate,Type,Reference/Item,Details,Debit,Credit\n';
        
        statement.transactions.forEach(txn => {
            const date = new Date(txn.date).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
            });
            const isDelivery = txn.type === 'delivery';
            
            if (isDelivery) {
                // Add delivery header
                const debitAmt = txn.amount.toFixed(2);
                csv += `"${date}","DELIVERY","${(txn.reference || 'No Ref').replace(/"/g, '""')}","",${debitAmt},\n`;
                
                // Get items for this delivery
                const items = runQuery(`
                    SELECT di.*, p.name as productName
                    FROM delivery_items di
                    LEFT JOIN products p ON di.productId = p.id
                    WHERE di.deliveryId = ?
                `, [txn.id]);
                
                // Add each item as a sub-row
                items.forEach(item => {
                    const itemName = (item.productName || 'Unknown').replace(/"/g, '""');
                    csv += `"","","  > ${itemName}","x${item.quantity || 0} @ $${(item.unitCost || 0).toFixed(2)}",${(item.lineTotal || 0).toFixed(2)},\n`;
                });
            } else {
                // Payment row
                const creditAmt = txn.amount.toFixed(2);
                const notes = (txn.notes || '-').replace(/"/g, '""');
                csv += `"${date}","PAYMENT","${(txn.reference || '-').replace(/"/g, '""')}","${notes}",,${creditAmt}\n`;
            }
        });
        
        // Add totals
        const totalDebit = statement.transactions
            .filter(t => t.type === 'delivery')
            .reduce((sum, t) => sum + (t.amount || 0), 0);
        const totalCredit = statement.transactions
            .filter(t => t.type === 'payment')
            .reduce((sum, t) => sum + (t.amount || 0), 0);
        
        csv += `"","--- TOTAL ---","","",${totalDebit.toFixed(2)},${totalCredit.toFixed(2)}\n`;
        csv += `"","NET BALANCE","","",,"$${Math.abs(statement.currentBalance).toFixed(2)} ${statement.currentBalance < 0 ? '(We Owe)' : '(Overpaid)'}"\n`;
        
        // Download CSV file
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `supplier_statement_${statement.supplier.name}_${new Date().toISOString().slice(0,10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showNotification('✅ CSV exported successfully', 'success');
        
    } catch (error) {
        console.error('Error exporting CSV:', error);
        showNotification('Error exporting CSV: ' + error.message, 'error');
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPurchases);
} else {
    initPurchases();
}

console.log('✅ Purchases UI module loaded');
