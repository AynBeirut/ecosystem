// ===================================
// SUPPLIER PAYMENTS MODULE
// Handles payments to suppliers and payment tracking
// ===================================

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
        const paymentId = await runExec(
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
        
        if (!paymentId || paymentId === 0) {
            throw new Error(`Failed to get payment ID after insertion. Got: ${paymentId}`);
        }
        
        // Update supplier balance (payment reduces debt - adds to balance)
        await updateSupplierBalance(supplierId, amount, `Payment #${paymentId}`);
        
        await saveDatabase();
        
        // Log activity
        if (typeof logActivity === 'function') {
            const supplier = await getSupplierById(supplierId);
            const supplierName = supplier ? supplier.name : `ID ${supplierId}`;
            await logActivity('supplier_payment', 
                `Payment to ${supplierName}: $${amount.toFixed(2)} via ${paymentMethod || 'Cash'}`);
        }
        
        console.log(`✅ Payment recorded: $${amount.toFixed(2)} to supplier ID ${supplierId}`);
        return paymentId;
        
    } catch (error) {
        console.error('Error recording supplier payment:', error);
        throw error;
    }
}

// Get all payment history with optional filters
async function getPaymentHistory(filters = {}) {
    try {
        let query = `
            SELECT sp.*, s.name as supplierName
            FROM supplier_payments sp
            LEFT JOIN suppliers s ON sp.supplierId = s.id
        `;
        const params = [];
        const conditions = [];
        
        // Filter by supplier
        if (filters.supplierId) {
            conditions.push('sp.supplierId = ?');
            params.push(filters.supplierId);
        }
        
        // Filter by payment method
        if (filters.paymentMethod) {
            conditions.push('sp.paymentMethod = ?');
            params.push(filters.paymentMethod);
        }
        
        // Filter by date range
        if (filters.startDate) {
            conditions.push('sp.paidAt >= ?');
            params.push(filters.startDate);
        }
        if (filters.endDate) {
            conditions.push('sp.paidAt <= ?');
            params.push(filters.endDate);
        }
        
        // Add WHERE clause if there are conditions
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += ' ORDER BY sp.paidAt DESC';
        
        const results = await runQuery(query, params);
        return results || [];
        
    } catch (error) {
        console.error('Error getting payment history:', error);
        return [];
    }
}

// Get payments for a specific supplier
async function getPaymentsBySupplier(supplierId) {
    try {
        return await getPaymentHistory({ supplierId });
    } catch (error) {
        console.error('Error getting payments by supplier:', error);
        return [];
    }
}

// Get unpaid balance for a supplier (negative balance means we owe them)
async function getUnpaidBalance(supplierId) {
    try {
        const balance = await getSupplierBalance(supplierId);
        // Return absolute value if negative (we owe them), otherwise 0
        return balance < 0 ? Math.abs(balance) : 0;
    } catch (error) {
        console.error('Error getting unpaid balance:', error);
        return 0;
    }
}

// Get total payments for a date range
async function getPaymentTotals(startDate, endDate) {
    try {
        let query = 'SELECT SUM(amount) as total, COUNT(*) as count FROM supplier_payments';
        const params = [];
        const conditions = [];
        
        if (startDate) {
            conditions.push('paidAt >= ?');
            params.push(startDate);
        }
        if (endDate) {
            conditions.push('paidAt <= ?');
            params.push(endDate);
        }
        
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        const results = await runQuery(query, params);
        return {
            total: results && results[0].total ? results[0].total : 0,
            count: results && results[0].count ? results[0].count : 0
        };
        
    } catch (error) {
        console.error('Error getting payment totals:', error);
        return { total: 0, count: 0 };
    }
}

// Get payment by ID
async function getPaymentById(paymentId) {
    try {
        const results = await runQuery(
            `SELECT sp.*, s.name as supplierName, s.phone as supplierPhone
             FROM supplier_payments sp
             LEFT JOIN suppliers s ON sp.supplierId = s.id
             WHERE sp.id = ?`,
            [paymentId]
        );
        
        return results && results.length > 0 ? results[0] : null;
        
    } catch (error) {
        console.error('Error getting payment by ID:', error);
        return null;
    }
}

// Delete a payment (use with caution - should reverse balance)
async function deleteSupplierPayment(paymentId) {
    try {
        // Get payment details first
        const payment = await getPaymentById(paymentId);
        
        if (!payment) {
            throw new Error('Payment not found');
        }
        
        // Delete the payment
        await runExec('DELETE FROM supplier_payments WHERE id = ?', [paymentId]);
        
        // Reverse the balance update (subtract the payment amount)
        await updateSupplierBalance(payment.supplierId, -payment.amount, `Deleted payment #${paymentId}`);
        
        await saveDatabase();
        
        // Log activity
        if (typeof logActivity === 'function') {
            await logActivity('payment_delete', 
                `Deleted payment #${paymentId}: $${payment.amount.toFixed(2)} to ${payment.supplierName}`);
        }
        
        console.log(`✅ Payment deleted: #${paymentId}`);
        return true;
        
    } catch (error) {
        console.error('Error deleting payment:', error);
        throw error;
    }
}

// Fetch and render payments filtered by status
async function renderPaymentsByStatus(status) {
    try {
        const payments = await runQuery(
            `SELECT sp.*, s.name AS supplierName FROM supplier_payments sp
             JOIN suppliers s ON sp.supplierId = s.id
             WHERE sp.status = ?
             ORDER BY sp.paidAt DESC`,
            [status]
        );

        const container = document.getElementById('payments-container');
        if (!container) {
            console.error('❌ Payments container not found');
            return;
        }

        container.innerHTML = payments.map(payment => `
            <div class="payment-item">
                <strong>${payment.supplierName}</strong> - $${payment.amount.toFixed(2)}
                <span>${new Date(payment.paidAt).toLocaleDateString()}</span>
                <span>${payment.paymentMethod}</span>
            </div>
        `).join('');
    } catch (error) {
        console.error('❌ Failed to render payments:', error);
    }
}

// Generate account statement filtered by time and supplier
async function generateAccountStatement(startDate, endDate, supplierId) {
    try {
        const payments = await runQuery(
            `SELECT sp.*, s.name AS supplierName FROM supplier_payments sp
             JOIN suppliers s ON sp.supplierId = s.id
             WHERE sp.paidAt BETWEEN ? AND ?
             AND (? IS NULL OR sp.supplierId = ?)
             ORDER BY sp.paidAt DESC`,
            [startDate, endDate, supplierId, supplierId]
        );

        const csvContent = payments.map(payment => (
            `${payment.supplierName},${payment.amount},${payment.paymentMethod},${new Date(payment.paidAt).toLocaleDateString()}`
        )).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `account-statement-${startDate}-${endDate}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('❌ Failed to generate account statement:', error);
    }
}

// Populate supplier dropdown in statements tab
async function populateStatementSuppliers() {
    try {
        const suppliers = await runQuery('SELECT id, name FROM suppliers ORDER BY name');
        const dropdown = document.getElementById('statement-supplier');
        
        if (!dropdown) return;
        
        // Clear existing options except the first one
        dropdown.innerHTML = '<option value="">Select Supplier...</option>';
        
        // Add supplier options
        suppliers.forEach(supplier => {
            const option = document.createElement('option');
            option.value = supplier.id;
            option.textContent = supplier.name;
            dropdown.appendChild(option);
        });
        
        console.log(`✅ Loaded ${suppliers.length} suppliers into statement dropdown`);
    } catch (error) {
        console.error('❌ Failed to populate statement suppliers:', error);
    }
}

// Load supplier statement with filters
async function loadSupplierStatement() {
    try {
        const supplierId = document.getElementById('statement-supplier').value;
        const startDate = document.getElementById('statement-start-date').value;
        const endDate = document.getElementById('statement-end-date').value;
        
        if (!supplierId) {
            showNotification('Please select a supplier', 'warning');
            return;
        }
        
        // Get supplier info
        const supplier = await getSupplierById(parseInt(supplierId));
        if (!supplier) {
            showNotification('Supplier not found', 'error');
            return;
        }
        
        // Build date filter
        let dateFilter = '';
        let dateParams = [];
        
        if (startDate && endDate) {
            dateFilter = 'AND (d.deliveryDate BETWEEN ? AND ? OR datetime(sp.paidAt/1000, "unixepoch") BETWEEN ? AND ?)';
            dateParams = [startDate, endDate, startDate, endDate];
        } else if (startDate) {
            dateFilter = 'AND (d.deliveryDate >= ? OR datetime(sp.paidAt/1000, "unixepoch") >= ?)';
            dateParams = [startDate, startDate];
        } else if (endDate) {
            dateFilter = 'AND (d.deliveryDate <= ? OR datetime(sp.paidAt/1000, "unixepoch") <= ?)';
            dateParams = [endDate, endDate];
        }
        
        // Get deliveries (purchases)
        const deliveries = await runQuery(`
            SELECT 
                deliveryDate as date,
                'PURCHASE' as type,
                id as reference,
                totalAmount as amount,
                deliveryDate
            FROM deliveries 
            WHERE supplierId = ? ${dateFilter.replace(/datetime\(sp\.paidAt\/1000, "unixepoch"\)/g, 'deliveryDate')}
            ORDER BY deliveryDate
        `, [supplierId, ...dateParams.slice(0, dateParams.length / 2 || 0)]);
        
        // Get payments (using paidAt from old schema)
        const payments = await runQuery(`
            SELECT 
                datetime(paidAt/1000, 'unixepoch') as date,
                'PAYMENT' as type,
                COALESCE(reference, CAST(id AS TEXT)) as reference,
                amount,
                datetime(paidAt/1000, 'unixepoch') as payment_date,
                paymentMethod,
                notes
            FROM supplier_payments 
            WHERE supplierId = ? ${dateFilter.replace(/d\.deliveryDate/g, 'datetime(paidAt/1000, "unixepoch")')}
            ORDER BY paidAt
        `, [supplierId, ...dateParams.slice(dateParams.length / 2 || 0)]);
        
        // Combine and sort all transactions
        const transactions = [...deliveries, ...payments].sort((a, b) => {
            const dateA = new Date(a.date || a.deliveryDate || a.payment_date);
            const dateB = new Date(b.date || b.deliveryDate || b.payment_date);
            return dateA - dateB;
        });
        
        // Calculate opening balance (all transactions before start date)
        let openingBalance = 0;
        if (startDate) {
            const priorDeliveries = await runQuery(
                'SELECT COALESCE(SUM(totalAmount), 0) as total FROM deliveries WHERE supplierId = ? AND deliveryDate < ?',
                [supplierId, startDate]
            );
            const priorPayments = await runQuery(
                'SELECT COALESCE(SUM(amount), 0) as total FROM supplier_payments WHERE supplierId = ? AND datetime(paidAt/1000, "unixepoch") < ?',
                [supplierId, startDate]
            );
            openingBalance = (priorDeliveries[0]?.total || 0) - (priorPayments[0]?.total || 0);
        }
        
        // Calculate totals
        let totalPurchases = 0;
        let totalPayments = 0;
        let runningBalance = openingBalance;
        
        // Build statement rows
        const statementRows = transactions.map(trans => {
            const debit = trans.type === 'PURCHASE' ? trans.amount : 0;
            const credit = trans.type === 'PAYMENT' ? trans.amount : 0;
            
            totalPurchases += debit;
            totalPayments += credit;
            runningBalance += debit - credit;
            
            const description = trans.type === 'PURCHASE' 
                ? `Delivery #${trans.reference}` 
                : `${trans.paymentMethod || 'Payment'} ${trans.notes ? '- ' + trans.notes : ''}`;
            
            return {
                date: trans.date || trans.deliveryDate || trans.payment_date,
                type: trans.type,
                reference: trans.reference,
                description: description,
                debit: debit,
                credit: credit,
                balance: runningBalance
            };
        });
        
        // Update UI
        document.getElementById('statement-supplier-name').textContent = `${supplier.name} - Account Statement`;
        document.getElementById('statement-opening-balance').textContent = formatCurrency(openingBalance);
        document.getElementById('statement-total-purchases').textContent = formatCurrency(totalPurchases);
        document.getElementById('statement-total-payments').textContent = formatCurrency(totalPayments);
        document.getElementById('statement-closing-balance').textContent = formatCurrency(runningBalance);
        
        // Show summary and table
        document.getElementById('statement-summary').style.display = 'block';
        document.getElementById('statement-table').style.display = 'table';
        document.getElementById('statement-empty').style.display = 'none';
        
        // Render statement rows
        const tbody = document.getElementById('statement-list');
        tbody.innerHTML = statementRows.map(row => `
            <tr>
                <td>${new Date(row.date).toLocaleDateString()}</td>
                <td><span class="badge badge-${row.type === 'PURCHASE' ? 'danger' : 'success'}">${row.type}</span></td>
                <td>#${row.reference}</td>
                <td>${escapeHtml(row.description)}</td>
                <td class="amount">${row.debit > 0 ? formatCurrency(row.debit) : '-'}</td>
                <td class="amount">${row.credit > 0 ? formatCurrency(row.credit) : '-'}</td>
                <td class="amount" style="font-weight: bold; color: ${row.balance < 0 ? '#f44336' : '#4caf50'};">
                    ${formatCurrency(Math.abs(row.balance))} ${row.balance < 0 ? 'DR' : 'CR'}
                </td>
            </tr>
        `).join('');
        
        console.log(`✅ Loaded statement for ${supplier.name}: ${statementRows.length} transactions`);
        
    } catch (error) {
        console.error('❌ Failed to load supplier statement:', error);
        showNotification('Failed to load statement: ' + error.message, 'error');
    }
}

// Export supplier statement as PDF
async function exportSupplierStatementPDF() {
    try {
        const supplierId = document.getElementById('statement-supplier').value;
        
        if (!supplierId) {
            showNotification('Please load a statement first', 'warning');
            return;
        }
        
        const supplier = await getSupplierById(parseInt(supplierId));
        const startDate = document.getElementById('statement-start-date').value || 'All';
        const endDate = document.getElementById('statement-end-date').value || 'All';
        
        // Get statement data from the table
        const rows = document.querySelectorAll('#statement-list tr');
        if (rows.length === 0) {
            showNotification('No transactions to export', 'warning');
            return;
        }
        
        // Prepare data for PDF export
        const transactions = [];
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 7) {
                // Remove badge HTML, keep only text
                const typeCell = cells[1].querySelector('.badge');
                const typeText = typeCell ? typeCell.textContent.trim() : cells[1].textContent.trim();
                
                transactions.push({
                    date: cells[0].textContent.trim(),
                    type: typeText,
                    reference: cells[2].textContent.trim(),
                    description: cells[3].textContent.trim(),
                    debit: cells[4].textContent.trim(),
                    credit: cells[5].textContent.trim(),
                    balance: cells[6].textContent.trim()
                });
            }
        });
        
        const exportData = {
            supplier: supplier.name,
            period: `${startDate} to ${endDate}`,
            openingBalance: document.getElementById('statement-opening-balance').textContent,
            totalPurchases: document.getElementById('statement-total-purchases').textContent,
            totalPayments: document.getElementById('statement-total-payments').textContent,
            closingBalance: document.getElementById('statement-closing-balance').textContent,
            transactions: transactions
        };
        
        // Use the global PDF export if available
        if (typeof exportToPDF === 'function') {
            const columns = [
                { key: 'date', header: 'Date' },
                { key: 'type', header: 'Type' },
                { key: 'reference', header: 'Reference' },
                { key: 'description', header: 'Description' },
                { key: 'debit', header: 'Debit' },
                { key: 'credit', header: 'Credit' },
                { key: 'balance', header: 'Balance' }
            ];
            
            await exportToPDF(
                transactions,
                columns,
                `statement-${supplier.name.replace(/[^a-z0-9]/gi, '_')}-${Date.now()}.pdf`,
                `Supplier Account Statement - ${supplier.name}`,
                [
                    `Period: ${startDate} to ${endDate}`,
                    `Opening Balance: ${exportData.openingBalance}`,
                    `Total Purchases: ${exportData.totalPurchases}`,
                    `Total Payments: ${exportData.totalPayments}`,
                    `Closing Balance: ${exportData.closingBalance}`
                ]
            );
            showNotification('Statement exported to PDF', 'success');
        } else {
            showNotification('PDF export not available', 'error');
        }
    } catch (error) {
        console.error('❌ Failed to export PDF:', error);
        showNotification('Failed to export PDF: ' + error.message, 'error');
    }
}

// Export supplier statement as Excel
async function exportSupplierStatementExcel() {
    try {
        const supplierId = document.getElementById('statement-supplier').value;
        
        if (!supplierId) {
            showNotification('Please load a statement first', 'warning');
            return;
        }
        
        const supplier = await getSupplierById(parseInt(supplierId));
        const startDate = document.getElementById('statement-start-date').value || 'All';
        const endDate = document.getElementById('statement-end-date').value || 'All';
        
        // Get statement data from the table
        const rows = document.querySelectorAll('#statement-list tr');
        if (rows.length === 0) {
            showNotification('No transactions to export', 'warning');
            return;
        }
        
        // Create CSV content with Excel-friendly formatting
        let csvContent = '\ufeff'; // BOM for Excel UTF-8 support
        csvContent += `"Supplier Account Statement"\n`;
        csvContent += `"Supplier:","${supplier.name}"\n`;
        csvContent += `"Period:","${startDate} to ${endDate}"\n`;
        csvContent += `\n`;
        
        // Summary
        csvContent += `"Opening Balance:","${document.getElementById('statement-opening-balance').textContent}"\n`;
        csvContent += `"Total Purchases:","${document.getElementById('statement-total-purchases').textContent}"\n`;
        csvContent += `"Total Payments:","${document.getElementById('statement-total-payments').textContent}"\n`;
        csvContent += `"Closing Balance:","${document.getElementById('statement-closing-balance').textContent}"\n`;
        csvContent += `\n`;
        
        // Headers
        csvContent += '"Date","Type","Reference","Description","Debit","Credit","Balance"\n';
        
        // Data rows
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 7) {
                const rowData = Array.from(cells).map(cell => {
                    let text = cell.textContent.trim();
                    // Remove badge HTML, keep only text
                    const badge = cell.querySelector('.badge');
                    if (badge) {
                        text = badge.textContent.trim();
                    }
                    return `"${text.replace(/"/g, '""')}"`;
                });
                csvContent += rowData.join(',') + '\n';
            }
        });
        
        // Create and download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `statement-${supplier.name.replace(/[^a-z0-9]/gi, '_')}-${Date.now()}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        
        showNotification('Statement exported to Excel format', 'success');
    } catch (error) {
        console.error('❌ Failed to export Excel:', error);
        showNotification('Failed to export Excel: ' + error.message, 'error');
    }
}

// Export supplier statement as CSV (plain text, no Excel BOM)
async function exportSupplierStatementCSV() {
    try {
        const supplierId = document.getElementById('statement-supplier').value;
        
        if (!supplierId) {
            showNotification('Please load a statement first', 'warning');
            return;
        }
        
        const supplier = await getSupplierById(parseInt(supplierId));
        const startDate = document.getElementById('statement-start-date').value || 'All';
        const endDate = document.getElementById('statement-end-date').value || 'All';
        
        // Get statement data from the table
        const rows = document.querySelectorAll('#statement-list tr');
        if (rows.length === 0) {
            showNotification('No transactions to export', 'warning');
            return;
        }
        
        // Create plain text CSV content (no BOM)
        let csvContent = `Supplier Account Statement\n`;
        csvContent += `Supplier,${supplier.name}\n`;
        csvContent += `Period,${startDate} to ${endDate}\n`;
        csvContent += `\n`;
        
        // Summary
        csvContent += `Opening Balance,${document.getElementById('statement-opening-balance').textContent}\n`;
        csvContent += `Total Purchases,${document.getElementById('statement-total-purchases').textContent}\n`;
        csvContent += `Total Payments,${document.getElementById('statement-total-payments').textContent}\n`;
        csvContent += `Closing Balance,${document.getElementById('statement-closing-balance').textContent}\n`;
        csvContent += `\n`;
        
        // Headers
        csvContent += 'Date,Type,Reference,Description,Debit,Credit,Balance\n';
        
        // Data rows
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 7) {
                const rowData = Array.from(cells).map(cell => {
                    let text = cell.textContent.trim();
                    // Remove badge HTML, keep only text
                    const badge = cell.querySelector('.badge');
                    if (badge) {
                        text = badge.textContent.trim();
                    }
                    // Escape commas and quotes
                    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
                        text = '"' + text.replace(/"/g, '""') + '"';
                    }
                    return text;
                });
                csvContent += rowData.join(',') + '\n';
            }
        });
        
        // Create and download file WITHOUT BOM (plain CSV)
        const blob = new Blob([csvContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `statement-${supplier.name.replace(/[^a-z0-9]/gi, '_')}-${Date.now()}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        
        showNotification('Statement exported to CSV', 'success');
    } catch (error) {
        console.error('❌ Failed to export CSV:', error);
        showNotification('Failed to export CSV: ' + error.message, 'error');
    }
}

// Export supplier statement (legacy - redirect to PDF)
async function exportSupplierStatement() {
    await exportSupplierStatementPDF();
}

console.log('✅ Supplier Payments module loaded');
