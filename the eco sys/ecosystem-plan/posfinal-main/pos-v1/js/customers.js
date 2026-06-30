/**
 * Customer Management Module
 * Handle customer data and purchase history
 */

let customers = [];

/**
 * Initialize customer management
 */
function initCustomers() {
    console.log('✅ Customer Management initialized');
    
    // Load customers from database
    loadCustomers();
    
    // Setup customer modal if exists
    setupCustomerModal();
    
    // Setup customer search in payment modal
    setupCustomerSearch();
}

/**
 * Setup customer modal
 */
function setupCustomerModal() {
    const customerModal = document.getElementById('customer-modal');
    if (!customerModal) return;
    
    const closeBtn = customerModal.querySelector('.modal-close');
    const customerSearch = document.getElementById('customer-search-list');
    
    // Close modal
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            customerModal.classList.remove('active');
        });
    }
    
    // Click outside to close
    customerModal.addEventListener('click', (e) => {
        if (e.target === customerModal) {
            customerModal.classList.remove('active');
        }
    });
    
    // Search customers
    if (customerSearch) {
        customerSearch.addEventListener('input', (e) => {
            filterCustomers(e.target.value);
        });
    }
}

/**
 * Setup customer search in payment modal
 */
function setupCustomerSearch() {
    const customerSearchBtn = document.getElementById('customer-search-btn');
    const customerNameInput = document.getElementById('customer-name');
    const customerPhoneInput = document.getElementById('customer-phone');
    
    if (!customerSearchBtn) return;
    
    customerSearchBtn.addEventListener('click', async () => {
        const phone = customerPhoneInput.value.trim();
        if (!phone) {
            alert('Please enter a phone number to search');
            return;
        }
        
        try {
            const customer = await getCustomerByPhone(phone);
            if (customer) {
                customerNameInput.value = customer.name;
                customerPhoneInput.value = customer.phone;
                showNotification('Customer found!', 'success');
            } else {
                showNotification('Customer not found. You can create a new one.', 'info');
            }
        } catch (error) {
            console.error('Error searching customer:', error);
        }
    });
    
    // Auto-search when phone number is entered
    if (customerPhoneInput) {
        customerPhoneInput.addEventListener('blur', async () => {
            const phone = customerPhoneInput.value.trim();
            if (phone && phone.length >= 8) {
                try {
                    const customer = await getCustomerByPhone(phone);
                    if (customer && !customerNameInput.value) {
                        customerNameInput.value = customer.name;
                    }
                } catch (error) {
                    console.error('Error auto-searching customer:', error);
                }
            }
        });
    }
}

/**
 * Load customers from database
 */
async function loadCustomers() {
    try {
        customers = await getAllCustomers();
        console.log(`📋 Loaded ${customers.length} customers`);
        updateCustomerStats();
        renderCustomerList();
    } catch (error) {
        console.error('Error loading customers:', error);
        customers = [];
    }
}

/**
 * Save or update customer with sale
 */
async function saveCustomerWithSale(customerData, saleData) {
    if (!customerData || !customerData.phone) {
        return null; // No customer data provided
    }
    
    try {
        // Check if customer exists
        const existingCustomer = await getCustomerByPhone(customerData.phone);
        
        if (existingCustomer) {
            // Update existing customer
            const updatedCustomer = {
                ...existingCustomer,
                name: customerData.name || existingCustomer.name,
                lastPurchase: saleData.timestamp,
                totalPurchases: (existingCustomer.totalPurchases || 0) + 1,
                totalSpent: (existingCustomer.totalSpent || 0) + saleData.total,
                purchaseHistory: [
                    ...(existingCustomer.purchaseHistory || []),
                    {
                        saleId: saleData.id,
                        date: saleData.timestamp,
                        total: saleData.total,
                        items: saleData.items.length
                    }
                ]
            };
            
            await updateCustomer(existingCustomer.id, updatedCustomer);
            console.log('✅ Customer updated with sale');
            return updatedCustomer;
            
        } else {
            // Create new customer
            const newCustomer = {
                name: customerData.name,
                phone: customerData.phone,
                createdAt: new Date().toISOString(),
                lastPurchase: saleData.timestamp,
                totalPurchases: 1,
                totalSpent: saleData.total,
                purchaseHistory: [{
                    saleId: saleData.id,
                    date: saleData.timestamp,
                    total: saleData.total,
                    items: saleData.items.length
                }]
            };
            
            await saveCustomer(newCustomer);
            console.log('✅ New customer created');
            await loadCustomers(); // Reload list
            return newCustomer;
        }
        
    } catch (error) {
        console.error('Error saving customer with sale:', error);
        return null;
    }
}

/**
 * Update customer statistics
 */
function updateCustomerStats() {
    const totalCustomersEl = document.getElementById('total-customers');
    const totalPurchasesEl = document.getElementById('total-customer-purchases');
    
    if (totalCustomersEl) {
        totalCustomersEl.textContent = customers.length;
    }
    
    if (totalPurchasesEl) {
        const totalPurchases = customers.reduce((sum, c) => sum + (c.totalPurchases || 0), 0);
        totalPurchasesEl.textContent = totalPurchases;
    }
}

/**
 * Render customer list
 */
function renderCustomerList() {
    const customerList = document.getElementById('customer-list');
    if (!customerList) return;
    
    if (customers.length === 0) {
        customerList.innerHTML = '<p style="text-align: center; color: #888; padding: 20px;">No customers yet.</p>';
        return;
    }
    
    // Sort by last purchase date
    const sortedCustomers = [...customers].sort((a, b) => 
        new Date(b.lastPurchase || 0) - new Date(a.lastPurchase || 0)
    );
    
    customerList.innerHTML = sortedCustomers.map(customer => {
        const lastPurchase = customer.lastPurchase 
            ? new Date(customer.lastPurchase).toLocaleDateString() 
            : 'Never';
        
        return `
            <div class="customer-item">
                <div class="customer-info">
                    <div class="customer-name">
                        <strong>${customer.name || 'Unknown'}</strong>
                        <span class="customer-phone">${customer.phone}</span>
                    </div>
                    <div class="customer-stats-row">
                        <span>📦 ${customer.totalPurchases || 0} purchases</span>
                        <span>💰 $${(customer.totalSpent || 0).toFixed(2)}</span>
                        <span>📅 Last: ${lastPurchase}</span>
                    </div>
                </div>
                <button class="btn-text" onclick="viewCustomerDetails(${customer.id})">View Details</button>
            </div>
        `;
    }).join('');
}

/**
 * Filter customers by search term
 */
function filterCustomers(searchTerm) {
    const customerList = document.getElementById('customer-list');
    if (!customerList) return;
    
    const term = searchTerm.toLowerCase().trim();
    
    if (!term) {
        renderCustomerList();
        return;
    }
    
    const filtered = customers.filter(c => 
        (c.name && c.name.toLowerCase().includes(term)) ||
        (c.phone && c.phone.includes(term))
    );
    
    if (filtered.length === 0) {
        customerList.innerHTML = '<p style="text-align: center; color: #888; padding: 20px;">No customers found.</p>';
        return;
    }
    
    customerList.innerHTML = filtered.map(customer => {
        const lastPurchase = customer.lastPurchase 
            ? new Date(customer.lastPurchase).toLocaleDateString() 
            : 'Never';
        
        return `
            <div class="customer-item">
                <div class="customer-info">
                    <div class="customer-name">
                        <strong>${customer.name || 'Unknown'}</strong>
                        <span class="customer-phone">${customer.phone}</span>
                    </div>
                    <div class="customer-stats-row">
                        <span>📦 ${customer.totalPurchases || 0} purchases</span>
                        <span>💰 $${(customer.totalSpent || 0).toFixed(2)}</span>
                        <span>📅 Last: ${lastPurchase}</span>
                    </div>
                </div>
                <button class="btn-text" onclick="viewCustomerDetails(${customer.id})">View Details</button>
            </div>
        `;
    }).join('');
}

/**
 * View customer details
 */
function viewCustomerDetails(customerId) {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;
    
    const details = `
Customer: ${customer.name}
Phone: ${customer.phone}
Total Purchases: ${customer.totalPurchases || 0}
Total Spent: $${(customer.totalSpent || 0).toFixed(2)}
Member Since: ${new Date(customer.createdAt).toLocaleDateString()}
Last Purchase: ${customer.lastPurchase ? new Date(customer.lastPurchase).toLocaleDateString() : 'Never'}
    `.trim();
    
    alert(details);
}

/**
 * Open customer management modal
 */
function openCustomerManagement() {
    const modal = document.getElementById('customer-modal');
    if (modal) {
        modal.classList.add('active');
        loadCustomers();
    }
}

// Notification helper
function showNotification(message, type = 'success') {
    const existing = document.querySelector('.notification-toast');
    if (existing) {
        existing.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification-toast ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196F3'};
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 10000;
        opacity: 0;
        transform: translateX(100px);
        transition: all 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 10);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100px)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Export functions
window.initCustomers = initCustomers;
window.saveCustomerWithSale = saveCustomerWithSale;
window.openCustomerManagement = openCustomerManagement;
window.viewCustomerDetails = viewCustomerDetails;
