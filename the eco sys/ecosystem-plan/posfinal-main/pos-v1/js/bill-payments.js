/**
 * Bill Payments Management Module
 * Handles utility bill payments (electricity, water, phone, etc.)
 * with receipt generation using company info
 */

// ========================================
// Load Bill Payment Interface
// ========================================
async function loadBillPayments() {
    try {
        console.log('💡 Loading bill payments...');
        
        // Load bill types for filter dropdown
        await loadBillTypeFilterOptions();
        
        // Get date filters - default to 1st of current month to today if not set
        let startDate = document.getElementById('bill-date-from')?.value;
        let endDate = document.getElementById('bill-date-to')?.value;
        
        if (!startDate || !endDate) {
            // Default to 1st of current month to today
            const today = new Date();
            const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            startDate = firstDayOfMonth.toISOString().split('T')[0];
            endDate = today.toISOString().split('T')[0];
            
            // Set the date inputs
            if (document.getElementById('bill-date-from')) {
                document.getElementById('bill-date-from').value = startDate;
            }
            if (document.getElementById('bill-date-to')) {
                document.getElementById('bill-date-to').value = endDate;
            }
        }
        
        const billTypeFilter = document.getElementById('bill-type-filter')?.value || 'all';

        let query = `
            SELECT bp.*
            FROM bill_payments bp
            WHERE DATE(bp.timestamp/1000, 'unixepoch') BETWEEN ? AND ?
        `;
        const params = [startDate, endDate];

        if (billTypeFilter !== 'all') {
            query += ` AND bp.billType = ?`;
            params.push(billTypeFilter);
        }

        query += ` ORDER BY bp.timestamp DESC LIMIT 100`;

        const payments = await runQuery(query, params);
        console.log(`💡 Found ${payments?.length || 0} bill payments`);
        console.log(`💡 Filter applied: ${billTypeFilter}`);
        renderBillPaymentsList(payments);
        await loadBillPaymentsStats(startDate, endDate);
    } catch (error) {
        console.error('❌ Error loading bill payments:', error);
        showNotification('Failed to load bill payments', 'error');
    }
}

// ========================================
// Render Bill Payments List
// ========================================
function renderBillPaymentsList(payments) {
    const container = document.getElementById('bill-payments-list');
    if (!container) return;

    if (!payments || payments.length === 0) {
        container.innerHTML = '<div class="empty-state">No bill payments found</div>';
        return;
    }

    let html = '<div class="bill-payments-grid">';
    
    payments.forEach(payment => {
        const timestamp = new Date(payment.timestamp);
        const formattedDate = timestamp.toLocaleDateString();
        const formattedTime = timestamp.toLocaleTimeString();

        html += `
            <div class="bill-payment-card">
                <div class="bill-header">
                    <span class="bill-icon">📄</span>
                    <span class="bill-type-name">${payment.billType || 'Other'}</span>
                    <span class="bill-amount">$${payment.amount.toFixed(2)}</span>
                </div>
                <div class="bill-details">
                    <div class="bill-row">
                        <span class="label">Bill Number:</span>
                        <span class="value">${payment.billNumber}</span>
                    </div>
                    <div class="bill-row">
                        <span class="label">Customer:</span>
                        <span class="value">${payment.customerName}</span>
                    </div>
                    ${payment.customerPhone ? `
                    <div class="bill-row">
                        <span class="label">Phone:</span>
                        <span class="value">${payment.customerPhone}</span>
                    </div>
                    ` : ''}
                    <div class="bill-row">
                        <span class="label">Payment Method:</span>
                        <span class="value">${payment.paymentMethod}</span>
                    </div>
                    <div class="bill-row">
                        <span class="label">Date:</span>
                        <span class="value">${formattedDate} ${formattedTime}</span>
                    </div>
                    <div class="bill-row">
                        <span class="label">Receipt #:</span>
                        <span class="value">${payment.receiptNumber}</span>
                    </div>
                    ${payment.notes ? `
                    <div class="bill-row">
                        <span class="label">Notes:</span>
                        <span class="value">${payment.notes}</span>
                    </div>
                    ` : ''}
                </div>
                <div class="bill-actions">
                    <button onclick="printBillReceipt(${payment.id})" class="btn-icon" title="Print Receipt">
                        🖨️
                    </button>
                    <button onclick="viewBillDetails(${payment.id})" class="btn-icon" title="View Details">
                        👁️
                    </button>
                </div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}

// ========================================
// Load Bill Payments Statistics
// ========================================
async function loadBillPaymentsStats(startDate, endDate) {
    try {
        const query = `
            SELECT 
                bp.billType,
                COUNT(*) as count,
                SUM(bp.amount) as sum
            FROM bill_payments bp
            WHERE DATE(bp.timestamp/1000, 'unixepoch') BETWEEN ? AND ?
            GROUP BY bp.billType
            ORDER BY sum DESC
        `;
        
        const stats = await runQuery(query, [startDate, endDate]);
        
        const totalPaymentsEl = document.getElementById('total-bill-payments');
        const totalAmountEl = document.getElementById('total-bill-amount');
        
        if (totalPaymentsEl && stats.length > 0) {
            const totalPayments = stats.reduce((sum, s) => sum + s.count, 0);
            const totalAmount = stats.reduce((sum, s) => sum + s.sum, 0);
            totalPaymentsEl.textContent = totalPayments;
            totalAmountEl.textContent = `$${totalAmount.toFixed(2)}`;
        }

        // Render breakdown by type
        renderBillTypesBreakdown(stats);
    } catch (error) {
        console.error('Error loading bill stats:', error);
    }
}

// ========================================
// Render Bill Types Breakdown
// ========================================
function renderBillTypesBreakdown(stats) {
    const container = document.getElementById('bill-types-breakdown');
    if (!container) return;

    if (!stats || stats.length === 0) {
        container.innerHTML = '<div class="empty-state">No data</div>';
        return;
    }

    let html = '<div class="breakdown-list">';
    
    stats.forEach(stat => {
        if (stat.billType) {
            html += `
                <div class="breakdown-item">
                    <span class="breakdown-icon">📄</span>
                    <span class="breakdown-name">${stat.billType}</span>
                    <span class="breakdown-count">${stat.count} payments</span>
                    <span class="breakdown-amount">$${stat.sum.toFixed(2)}</span>
                </div>
            `;
        }
    });

    html += '</div>';
    container.innerHTML = html;
}

// ========================================
// Open New Bill Payment Form
// ========================================
function openNewBillPayment() {
    document.getElementById('bill-payment-form-title').textContent = 'New Bill Payment';
    document.getElementById('bill-payment-id').value = '';
    document.getElementById('bill-payment-form').reset();
    
    // Load bill types dropdown
    loadBillTypesDropdown();
    
    // Set current date/time
    const now = new Date();
    document.getElementById('bill-payment-date').value = now.toISOString().split('T')[0];
    document.getElementById('bill-payment-time').value = now.toTimeString().slice(0, 5);
    
    const modal = document.getElementById('bill-payment-modal');
    modal.style.display = 'block';
    modal.style.zIndex = '10000'; // Ensure it appears on top
}

// ========================================
// Load Bill Types Dropdown
// ========================================
// ========================================
// Load Bill Types Dropdown (DEPRECATED - now uses free text input)
// ========================================
async function loadBillTypesDropdown() {
    // Bill types are now entered as free text by the user
    // This function is kept for compatibility but does nothing
    console.log('Bill types dropdown deprecated - users enter custom expense types');
}

// ========================================
// Load Bill Types for Filter Dropdown
// ========================================
async function loadBillTypeFilterOptions() {
    try {
        // Get distinct bill types from existing payments (billType is stored as text)
        const query = `
            SELECT DISTINCT billType 
            FROM bill_payments 
            WHERE billType IS NOT NULL AND billType != ''
            ORDER BY billType ASC
        `;
        
        const types = await runQuery(query);
        const dropdown = document.getElementById('bill-type-filter');
        
        if (!dropdown) return;
        
        // Save current selection before rebuilding
        const currentValue = dropdown.value;
        
        // Keep "All Types" option and add existing types
        dropdown.innerHTML = '<option value="all">All Types</option>';
        
        if (types && types.length > 0) {
            types.forEach(typeRow => {
                const type = typeRow.billType;
                dropdown.innerHTML += `<option value="${type}">${type}</option>`;
            });
        }
        
        // Restore previous selection if it still exists
        if (currentValue && currentValue !== '') {
            dropdown.value = currentValue;
        }
        
        console.log(`✅ Loaded ${types.length} bill types for filter`);
    } catch (error) {
        console.error('Error loading bill type filter:', error);
    }
}

// ========================================
// Search Phonebook for Customer
// ========================================
async function searchPhonebookForBill() {
    const searchTerm = document.getElementById('bill-customer-search')?.value || '';
    
    if (searchTerm.length < 2) {
        document.getElementById('customer-results').style.display = 'none';
        return;
    }

    try {
        const results = await runQuery(`
            SELECT * FROM phonebook 
            WHERE name LIKE ? OR phone LIKE ?
            LIMIT 10
        `, [`%${searchTerm}%`, `%${searchTerm}%`]);

        renderCustomerResults(results);
    } catch (error) {
        console.error('Error searching phonebook:', error);
    }
}

// ========================================
// Render Customer Search Results
// ========================================
function renderCustomerResults(results) {
    const container = document.getElementById('customer-results');
    if (!container) return;

    if (!results || results.length === 0) {
        container.style.display = 'none';
        return;
    }

    let html = '<div class="results-list">';
    
    results.forEach(customer => {
        const safeName = (customer.name || '').replace(/'/g, "\\'");
        const safePhone = (customer.phone || '').replace(/'/g, "\\'");
        html += `
            <div class="result-item" onclick="selectBillCustomer(${customer.id}, '${safeName}', '${safePhone}')">
                <div class="result-name">${customer.name}</div>
                <div class="result-phone">${customer.phone || 'No phone'}</div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
    container.style.display = 'block';
}

// ========================================
// Select Customer from Phonebook
// ========================================
function selectBillCustomer(id, name, phone) {
    document.getElementById('bill-customer-id').value = id;
    document.getElementById('bill-customer-name').value = name;
    document.getElementById('bill-customer-phone').value = phone;
    document.getElementById('bill-customer-search').value = name;
    document.getElementById('customer-results').style.display = 'none';
}

// ========================================
// Save Bill Payment
// ========================================
async function saveBillPayment(event) {
    // Prevent default form submission
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    try {
        const billType = document.getElementById('bill-type-select').value.trim(); // Now a text input
        const billNumber = document.getElementById('bill-number').value.trim();
        const customerName = document.getElementById('bill-customer-search').value.trim() || document.getElementById('bill-customer-name').value.trim();
        const customerPhone = document.getElementById('bill-customer-phone').value.trim();
        const amount = parseFloat(document.getElementById('bill-amount').value);
        const paymentMethod = document.querySelector('input[name="bill-payment-method"]:checked')?.value;
        const notes = document.getElementById('bill-notes').value.trim();
        const paymentDate = document.getElementById('bill-payment-date').value;
        const paymentTime = document.getElementById('bill-payment-time').value;

        // Validation
        if (!billType) {
            showNotification('Please enter expense category / bill type', 'error');
            return;
        }
        if (!billNumber) {
            showNotification('Please enter bill number', 'error');
            return;
        }
        if (!customerName) {
            showNotification('Please enter service provider name (e.g., EDL, Ogero)', 'error');
            return;
        }
        if (!amount || amount <= 0) {
            showNotification('Please enter a valid amount', 'error');
            return;
        }
        if (!paymentMethod) {
            showNotification('Please select payment method', 'error');
            return;
        }

        const timestamp = new Date(`${paymentDate} ${paymentTime}`).getTime();
        const receiptNumber = `BILL-${Date.now()}`;
        const currentUser = getCurrentUser();
        const cashierId = typeof getCashierId === 'function' ? getCashierId() : 'unknown';

        console.log('💰 Saving bill payment...', {billType, billNumber, amount, paymentMethod});

        await runExec(`
            INSERT INTO bill_payments (
                billType, billNumber, customerName, customerPhone,
                amount, paymentMethod, timestamp, receiptNumber,
                cashierId, notes, synced
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `, [
            billType, billNumber, customerName, customerPhone,
            amount, paymentMethod, timestamp, receiptNumber,
            cashierId, notes
        ]);

        console.log('✅ Bill payment saved to database');

        // Add to sync queue
        await addToSyncQueue('INSERT', 'bill_payments', {
            receiptNumber,
            billType,
            billNumber,
            customerName,
            customerPhone,
            amount,
            paymentMethod,
            timestamp,
            cashierId,
            notes
        });

        console.log('✅ Added to sync queue');

        showNotification('Expense/Bill payment recorded successfully', 'success');
        document.getElementById('bill-payment-modal').style.display = 'none';
        
        // Ask if user wants to print receipt - use setTimeout to avoid blocking
        setTimeout(() => {
            if (confirm('Payment recorded. Print receipt?')) {
                printBillReceiptByNumber(receiptNumber).catch(err => {
                    console.error('Print error:', err);
                });
            }
        }, 100);

        await loadBillPayments();
        
        return false; // Prevent any form submission
    } catch (error) {
        console.error('Error saving bill payment:', error);
        showNotification('Failed to save bill payment', 'error');
        return false; // Prevent form submission even on error
    }
}

// ========================================
// Print Bill Receipt
// ========================================
async function printBillReceipt(paymentId) {
    try {
        const payment = await runQuery(`
            SELECT bp.*
            FROM bill_payments bp
            WHERE bp.id = ?
        `, [paymentId]);

        if (!payment || payment.length === 0) {
            showNotification('Payment not found', 'error');
            return;
        }

        await generateBillReceipt(payment[0]);
    } catch (error) {
        console.error('Error printing receipt:', error);
        showNotification('Failed to print receipt', 'error');
    }
}

// ========================================
// Print Receipt by Receipt Number
// ========================================
async function printBillReceiptByNumber(receiptNumber) {
    try {
        const payment = await runQuery(`
            SELECT bp.*
            FROM bill_payments bp
            WHERE bp.receiptNumber = ?
        `, [receiptNumber]);

        if (!payment || payment.length === 0) {
            showNotification('Payment not found', 'error');
            return;
        }

        await generateBillReceipt(payment[0]);
    } catch (error) {
        console.error('Error printing receipt:', error);
        showNotification('Failed to print receipt', 'error');
    }
}

// ========================================
// Generate Bill Receipt HTML
// ========================================
async function generateBillReceipt(payment) {
    try {
        // Get company info
        const companyInfo = await runQuery('SELECT * FROM company_info WHERE id = 1');
        const company = companyInfo && companyInfo.length > 0 ? companyInfo[0] : {};

        const timestamp = new Date(payment.timestamp);
        
        let receiptHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Bill Payment Receipt - ${payment.receiptNumber}</title>
                <style>
                    @media print {
                        body { margin: 0; }
                        @page { size: 80mm auto; margin: 0; }
                    }
                    body {
                        font-family: 'Courier New', monospace;
                        width: 80mm;
                        margin: 0 auto;
                        padding: 10px;
                        font-size: 12px;
                    }
                    .header {
                        text-align: center;
                        border-bottom: 2px dashed #000;
                        padding-bottom: 10px;
                        margin-bottom: 15px;
                    }
                    .company-name {
                        font-size: 18px;
                        font-weight: bold;
                        margin-bottom: 5px;
                    }
                    .company-details {
                        font-size: 10px;
                        line-height: 1.4;
                    }
                    .receipt-title {
                        font-size: 16px;
                        font-weight: bold;
                        text-align: center;
                        margin: 15px 0;
                    }
                    .bill-icon {
                        font-size: 24px;
                        text-align: center;
                        margin: 10px 0;
                    }
                    .row {
                        display: flex;
                        justify-content: space-between;
                        margin: 5px 0;
                    }
                    .label {
                        font-weight: bold;
                    }
                    .amount-section {
                        border-top: 2px solid #000;
                        border-bottom: 2px solid #000;
                        padding: 10px 0;
                        margin: 15px 0;
                    }
                    .total {
                        font-size: 16px;
                        font-weight: bold;
                    }
                    .footer {
                        text-align: center;
                        border-top: 2px dashed #000;
                        padding-top: 10px;
                        margin-top: 15px;
                        font-size: 10px;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="company-name">${company.companyName || 'Ayn Beirut POS'}</div>
                    <div class="company-details">
                        ${company.phone ? `Tel: ${company.phone}<br>` : ''}
                        ${company.email ? `Email: ${company.email}<br>` : ''}
                        ${company.website ? `Web: ${company.website}<br>` : ''}
                        ${company.address ? `${company.address}<br>` : ''}
                        ${company.taxId ? `Tax ID: ${company.taxId}` : ''}
                    </div>
                </div>

                <div class="receipt-title">BILL PAYMENT RECEIPT</div>
                
                <div class="bill-icon">📄</div>

                <div class="row">
                    <span class="label">Receipt #:</span>
                    <span>${payment.receiptNumber}</span>
                </div>
                <div class="row">
                    <span class="label">Date:</span>
                    <span>${timestamp.toLocaleDateString()} ${timestamp.toLocaleTimeString()}</span>
                </div>
                <div class="row">
                    <span class="label">Bill Type:</span>
                    <span>${payment.billType || 'Other'}</span>
                </div>
                <div class="row">
                    <span class="label">Bill Number:</span>
                    <span>${payment.billNumber}</span>
                </div>

                <div style="margin: 15px 0; border-top: 1px dashed #000; padding-top: 10px;">
                    <div class="row">
                        <span class="label">Customer:</span>
                        <span>${payment.customerName}</span>
                    </div>
                    ${payment.customerPhone ? `
                    <div class="row">
                        <span class="label">Phone:</span>
                        <span>${payment.customerPhone}</span>
                    </div>
                    ` : ''}
                </div>

                <div class="amount-section">
                    <div class="row total">
                        <span>AMOUNT PAID:</span>
                        <span>$${payment.amount.toFixed(2)}</span>
                    </div>
                    <div class="row">
                        <span class="label">Payment Method:</span>
                        <span>${payment.paymentMethod}</span>
                    </div>
                </div>

                ${payment.notes ? `
                <div style="margin: 10px 0;">
                    <div class="label">Notes:</div>
                    <div>${payment.notes}</div>
                </div>
                ` : ''}

                <div class="footer">
                    <div>Thank you for your payment!</div>
                    <div style="margin-top: 5px;">Powered by Ayn Beirut POS</div>
                </div>
            </body>
            </html>
        `;

        // Check if running in Electron
        if (window.electronAPI && window.electronAPI.print) {
            // Use Electron's native print
            console.log('Using Electron native print for bill payment receipt');
            window.electronAPI.print(receiptHTML);
        } else {
            // Fallback to browser print for non-Electron environments
            console.log('Using browser fallback print for bill payment receipt');
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(receiptHTML);
                printWindow.document.close();
                printWindow.onload = function() {
                    printWindow.print();
                };
            } else {
                console.error('Pop-up blocked by browser');
                alert('❌ Print Failed\n\nPlease enable pop-ups in your browser settings to print receipts.\n\nOR: Use the Electron desktop app for better printing.');
            }
        }
    } catch (error) {
        console.error('Error generating receipt:', error);
        showNotification('Failed to generate receipt', 'error');
    }
}

// ========================================
// View Bill Payment Details
// ========================================
async function viewBillDetails(paymentId) {
    try {
        const payment = await runQuery(`
            SELECT bp.*
            FROM bill_payments bp
            WHERE bp.id = ?
        `, [paymentId]);

        if (!payment || payment.length === 0) {
            showNotification('Payment not found', 'error');
            return;
        }

        const p = payment[0];
        const timestamp = new Date(p.timestamp);

        alert(`Bill Payment Details
        
Receipt #: ${p.receiptNumber}
Bill Type: ${p.billType || 'Other'}
Bill Number: ${p.billNumber}

Customer: ${p.customerName}
Phone: ${p.customerPhone || 'N/A'}

Amount: $${p.amount.toFixed(2)}
Payment Method: ${p.paymentMethod}

Date: ${timestamp.toLocaleDateString()}
Time: ${timestamp.toLocaleTimeString()}

${p.notes ? `Notes: ${p.notes}` : ''}
        `);
    } catch (error) {
        console.error('Error viewing bill details:', error);
        showNotification('Failed to load bill details', 'error');
    }
}

// ========================================
// Export Bill Payments to CSV (using shared export utilities)
// ========================================
// Helper function to get bill payments data for export
// ========================================
async function getBillPaymentsExportData() {
    // Limit to one year maximum
    let startDate = document.getElementById('bill-date-from')?.value;
    let endDate = document.getElementById('bill-date-to')?.value || new Date().toISOString().split('T')[0];
    
    // If no start date, default to one year ago
    if (!startDate) {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        startDate = oneYearAgo.toISOString().split('T')[0];
    }
    
    // Enforce one year maximum range
    const start = new Date(startDate);
    const end = new Date(endDate);
    const oneYearInMs = 365 * 24 * 60 * 60 * 1000;
    
    if (end - start > oneYearInMs) {
        const newStart = new Date(end);
        newStart.setFullYear(newStart.getFullYear() - 1);
        startDate = newStart.toISOString().split('T')[0];
        showNotification('Date range limited to one year', 'warning');
    }

    // Get bill type filter
    const billTypeFilter = document.getElementById('bill-type-filter')?.value || 'all';

    let query = `
        SELECT bp.*
        FROM bill_payments bp
        WHERE DATE(bp.timestamp/1000, 'unixepoch') BETWEEN ? AND ?
    `;
    const params = [startDate, endDate];

    // Apply bill type filter if selected
    if (billTypeFilter !== 'all') {
        query += ` AND bp.billType = ?`;
        params.push(billTypeFilter);
    }

    query += ` ORDER BY bp.timestamp DESC`;

    const payments = await runQuery(query, params);

    if (!payments || payments.length === 0) {
        return null;
    }

    // Helper function to remove emojis and special characters
    const removeEmojis = (text) => {
        if (!text) return text;
        // Remove emojis and other special Unicode characters
        return text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();
    };

    // Prepare data for export
    const exportData = payments.map(p => {
        const timestamp = new Date(p.timestamp);
        
        return {
            receiptNumber: p.receiptNumber,
            date: timestamp.toLocaleDateString(),
            time: timestamp.toLocaleTimeString(),
            billType: removeEmojis(p.billType) || 'Other',
            billNumber: p.billNumber,
            customerName: p.customerName,
            customerPhone: p.customerPhone || '',
            amount: p.amount,
            paymentMethod: p.paymentMethod,
            notes: p.notes || ''
        };
    });

    // Calculate totals
    const totalAmount = exportData.reduce((sum, p) => sum + p.amount, 0);
    const totalPayments = exportData.length;

    // Add totals row
    const totalsRow = {
        receiptNumber: 'TOTAL',
        date: '',
        time: '',
        billType: `${totalPayments} payments`,
        billNumber: '',
        customerName: '',
        customerPhone: '',
        amount: totalAmount,
        paymentMethod: '',
        notes: ''
    };

    exportData.push(totalsRow);

    // Define columns for export
    const columns = [
        { header: 'Receipt Number', key: 'receiptNumber' },
        { header: 'Date', key: 'date' },
        { header: 'Time', key: 'time' },
        { header: 'Bill Type', key: 'billType' },
        { header: 'Bill Number', key: 'billNumber' },
        { header: 'Service Provider', key: 'customerName' },
        { header: 'Contact Phone', key: 'customerPhone' },
        { header: 'Amount', key: 'amount', type: 'currency' },
        { header: 'Payment Method', key: 'paymentMethod' },
        { header: 'Notes', key: 'notes' }
    ];

    const filename = `bill-payments-${startDate}-${endDate}`;
    
    // Include filter info
    const filterInfo = billTypeFilter !== 'all' ? removeEmojis(billTypeFilter) : null;
    
    return { exportData, columns, filename, startDate, endDate, filterInfo };
}

// ========================================
// Export to PDF
// ========================================
async function exportBillPaymentsPDF() {
    try {
        const data = await getBillPaymentsExportData();
        
        if (!data) {
            showNotification('No data to export', 'warning');
            return;
        }
        
        // Format currency values for PDF with dual currency
        const pdfData = data.exportData.map(row => ({
            ...row,
            amount: typeof row.amount === 'number' ? formatDualCurrencyPlain(row.amount) : row.amount
        }));
        
        // Build subtitle with filter info
        let subtitle = `From ${data.startDate} to ${data.endDate}`;
        if (data.filterInfo) {
            subtitle += ` | Category: ${data.filterInfo}`;
        }
        
        await exportToPDF(pdfData, data.columns, 'Bill Payments Report', data.filename, {
            subtitle: subtitle,
            orientation: 'landscape'
        });
        
        showNotification('Bill payments exported to PDF successfully', 'success');
        
    } catch (error) {
        console.error('Error exporting bill payments to PDF:', error);
        showNotification('Failed to export to PDF: ' + error.message, 'error');
    }
}

// ========================================
// Export to Excel
// ========================================
async function exportBillPaymentsExcel() {
    try {
        const data = await getBillPaymentsExportData();
        
        if (!data) {
            showNotification('No data to export', 'warning');
            return;
        }
        
        await exportToExcel(data.exportData, data.columns, data.filename, 'Bill Payments');
        
        showNotification('Bill payments exported to Excel successfully', 'success');
        
    } catch (error) {
        console.error('Error exporting bill payments to Excel:', error);
        showNotification('Failed to export to Excel: ' + error.message, 'error');
    }
}

// ========================================
// Export to CSV
// ========================================
async function exportBillPaymentsCSV() {
    try {
        const data = await getBillPaymentsExportData();
        
        if (!data) {
            showNotification('No data to export', 'warning');
            return;
        }
        
        await exportToCSV(data.exportData, data.columns, data.filename);
        
        showNotification('Bill payments exported to CSV successfully', 'success');
        
    } catch (error) {
        console.error('Error exporting bill payments to CSV:', error);
        showNotification('Failed to export to CSV: ' + error.message, 'error');
    }
}

// ========================================
// Add to Sync Queue
// ========================================
async function addToSyncQueue(operation, tableName, data) {
    try {
        await runExec(`
            INSERT INTO sync_queue (operation, table_name, data, timestamp, synced)
            VALUES (?, ?, ?, ?, 0)
        `, [operation, tableName, JSON.stringify(data), Date.now()]);
    } catch (error) {
        console.error('Error adding to sync queue:', error);
    }
}

// ========================================
// Initialize Bill Payments Module
// ========================================
function initBillPayments() {
    console.log('Bill Payments module initialized');

    // Set up form submit handler with defensive approach
    const form = document.getElementById('bill-payment-form');
    if (form) {
        // Remove any existing listeners first
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        
        // Add submit handler to the new form
        newForm.addEventListener('submit', (e) => {
            e.preventDefault();
            e.stopPropagation();
            saveBillPayment(e);
        }, true); // Use capture phase
        
        // Prevent Enter key from submitting form, allow field navigation
        newForm.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const target = e.target;
                
                // Allow Enter on textarea for new lines
                if (target.tagName === 'TEXTAREA') {
                    return;
                }
                
                // Allow Enter on select elements and datalist inputs
                if (target.tagName === 'SELECT' || target.getAttribute('list')) {
                    return;
                }
                
                e.preventDefault();
            }
        });
    }

    // Set up customer search with debounce
    const customerSearch = document.getElementById('bill-customer-search');
    if (customerSearch) {
        let searchTimeout;
        customerSearch.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(searchPhonebookForBill, 300);
        });
    }

    // Close results when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.customer-search-container')) {
            const results = document.getElementById('customer-results');
            if (results) results.style.display = 'none';
        }
    });
}

// Export functions to window scope
window.loadBillPayments = loadBillPayments;
window.openNewBillPayment = openNewBillPayment;
window.saveBillPayment = saveBillPayment;
window.printBillReceipt = printBillReceipt;
window.viewBillDetails = viewBillDetails;
window.exportBillPaymentsCSV = exportBillPaymentsCSV;
window.selectBillCustomer = selectBillCustomer;
window.initBillPayments = initBillPayments;
window.loadBillTypeFilterOptions = loadBillTypeFilterOptions;
