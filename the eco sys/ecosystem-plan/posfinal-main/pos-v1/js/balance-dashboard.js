// ===================================
// AYN BEIRUT POS - BALANCE DASHBOARD
// Master financial overview (Admin only)
// ===================================

let balanceData = null;
let lastRefreshTime = null;

// ===================================
// INITIALIZATION
// ===================================

async function initBalanceDashboard() {
    try {
        console.log('💰 Initializing balance dashboard...');
        
        // Check access permissions
        const user = getCurrentUser ? getCurrentUser() : null;
        if (!user || user.role !== 'admin') {
            console.warn('⚠️ Access denied: Balance dashboard requires admin role');
            return;
        }
        
        setupBalanceUI();
        
        console.log('✅ Balance dashboard initialized');
    } catch (error) {
        console.error('❌ Failed to initialize balance dashboard:', error);
    }
}

function setupBalanceUI() {
    const balanceBtn = document.getElementById('balance-btn');
    if (balanceBtn) {
        balanceBtn.addEventListener('click', openBalanceDashboard);
    }
    
    const refreshBtn = document.getElementById('balance-refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshBalanceDashboard);
    }
    
    const periodFilter = document.getElementById('balance-period-filter');
    if (periodFilter) {
        periodFilter.addEventListener('change', handlePeriodFilterChange);
    }
    
    console.log('✅ Balance UI event listeners attached');
}

// ===================================
// BALANCE CALCULATIONS
// ===================================

async function calculateBalance(startDate = null, endDate = null) {
    try {
        console.log('📊 Calculating balance...');
        
        // Store these for purchases query which uses different column name
        window.balanceStartDate = startDate;
        window.balanceEndDate = endDate;
        
        // If no dates provided, use all-time
        const dateFilter = startDate && endDate 
            ? `AND timestamp >= ${new Date(startDate).getTime()} AND timestamp <= ${new Date(endDate).getTime()}`
            : '';
        
        // Initialize all values to 0
        let salesTotal = 0, salesCount = 0, salesUnpaid = 0;
        let refundsTotal = 0, refundsCount = 0;
        let purchasesTotal = 0, purchasesCount = 0, purchasesUnpaid = 0;
        let billsTotal = 0, billsPaid = 0, billsUnpaid = 0, billsCount = 0;
        let salariesTotal = 0, salariesPaid = 0, salariesUnpaid = 0, salariesCount = 0;
        let expensesTotal = 0, expensesCount = 0, expensesUnpaid = 0;
        
        // 1. Sales (Income) - Track both paid and credit sales
        try {
            const salesDateFilter = startDate && endDate 
                ? `AND timestamp >= ${new Date(startDate).getTime()} AND timestamp <= ${new Date(endDate).getTime()}`
                : '';
            
            const salesResult = runQuery(`
                SELECT 
                    COALESCE(ABS(SUM(json_extract(totals, '$.total'))), 0) as total,
                    COALESCE(ABS(SUM(CASE 
                        WHEN paymentMethod IN ('credit', 'on-account', 'pending') 
                        THEN json_extract(totals, '$.total') 
                        ELSE 0 
                    END)), 0) as unpaid,
                    COUNT(*) as count
                FROM sales 
                WHERE 1=1 ${salesDateFilter}
            `);
            salesTotal = salesResult[0]?.total || 0;
            salesUnpaid = salesResult[0]?.unpaid || 0;
            salesCount = salesResult[0]?.count || 0;
            console.log('✅ Sales calculated:', salesTotal, 'from', salesCount, 'sales (unpaid:', salesUnpaid, ')');
        } catch (error) {
            console.warn('⚠️ Sales query failed:', error.message);
        }
        
        // 2. Refunds (Deduction from income)
        try {
            const refundsDateFilter = startDate && endDate 
                ? `AND timestamp >= ${new Date(startDate).getTime()} AND timestamp <= ${new Date(endDate).getTime()}`
                : '';
            
            const refundsResult = runQuery(`
                SELECT 
                    COALESCE(SUM(refundAmount), 0) as total,
                    COUNT(*) as count
                FROM refunds 
                WHERE 1=1 ${refundsDateFilter}
            `);
            refundsTotal = refundsResult[0]?.total || 0;
            refundsCount = refundsResult[0]?.count || 0;
            console.log('✅ Refunds calculated:', refundsTotal, 'from', refundsCount, 'refunds');
        } catch (error) {
            console.warn('⚠️ Refunds query failed:', error.message);
        }
        
        // 3. Purchases (Expense) - Using deliveries table
        let purchasesPaid = 0;
        let purchasesReturns = 0;
        try {
            // Use deliveries table deliveryDate for date filtering
            const deliveriesDateFilter = startDate && endDate 
                ? `AND deliveryDate >= ${new Date(startDate).getTime()} AND deliveryDate <= ${new Date(endDate).getTime()}`
                : '';
            
            // Get total deliveries in period
            const deliveriesResult = runQuery(`
                SELECT 
                    COALESCE(SUM(totalAmount), 0) as total,
                    COUNT(*) as count
                FROM deliveries 
                WHERE 1=1 ${deliveriesDateFilter}
            `);
            purchasesTotal = deliveriesResult[0]?.total || 0;
            purchasesCount = deliveriesResult[0]?.count || 0;
            
            // Get total payments in period using paidAt column
            const paymentsDateFilter = startDate && endDate 
                ? `AND paidAt >= ${new Date(startDate).getTime()} AND paidAt <= ${new Date(endDate).getTime()}`
                : '';
            
            const paymentsResult = runQuery(`
                SELECT COALESCE(SUM(amount), 0) as total
                FROM supplier_payments
                WHERE 1=1 ${paymentsDateFilter}
            `);
            purchasesPaid = paymentsResult[0]?.total || 0;
            
            // Get total returns in period
            const returnsResult = runQuery(`
                SELECT COALESCE(SUM(pr.returnAmount), 0) as total
                FROM purchase_returns pr
                JOIN deliveries d ON pr.deliveryId = d.id
                WHERE 1=1 ${deliveriesDateFilter.replace('deliveryDate', 'd.deliveryDate')}
            `);
            purchasesReturns = returnsResult[0]?.total || 0;
            
            // Calculate ALL-TIME outstanding balance (for Accounts Payable)
            const allTimeDeliveries = runQuery(`
                SELECT COALESCE(SUM(totalAmount), 0) as total FROM deliveries
            `);
            const allTimePayments = runQuery(`
                SELECT COALESCE(SUM(amount), 0) as total FROM supplier_payments
            `);
            const allTimeReturns = runQuery(`
                SELECT COALESCE(SUM(pr.returnAmount), 0) as total
                FROM purchase_returns pr
            `);
            
            const totalAllDeliveries = allTimeDeliveries[0]?.total || 0;
            const totalAllPayments = allTimePayments[0]?.total || 0;
            const totalAllReturns = allTimeReturns[0]?.total || 0;
            
            purchasesUnpaid = totalAllDeliveries - totalAllPayments - totalAllReturns;
            
            console.log('✅ Purchases (deliveries) calculated:');
            console.log('   Period: Deliveries:', purchasesTotal, 'Paid:', purchasesPaid, 'Returns:', purchasesReturns);
            console.log('   All-Time Outstanding:', purchasesUnpaid);
        } catch (error) {
            console.warn('⚠️ Deliveries query failed:', error.message);
            purchasesTotal = 0;
        }
        
        // 4. Bills (Expense) - Using bill_payments table
        try {
            const billsDateFilter = startDate && endDate 
                ? `AND timestamp >= ${new Date(startDate).getTime()} AND timestamp <= ${new Date(endDate).getTime()}`
                : '';
            
            const billsResult = runQuery(`
                SELECT 
                    COALESCE(SUM(amount), 0) as total,
                    COALESCE(SUM(amount), 0) as paid,
                    0 as unpaid,
                    COUNT(*) as count
                FROM bill_payments 
                WHERE 1=1 ${billsDateFilter}
            `);
            billsTotal = billsResult[0]?.total || 0;
            billsPaid = billsResult[0]?.paid || 0;
            billsUnpaid = billsResult[0]?.unpaid || 0;
            billsCount = billsResult[0]?.count || 0;
            console.log('✅ Bills calculated:', billsTotal, '(paid:', billsPaid, 'count:', billsCount, ')');
        } catch (error) {
            console.warn('⚠️ Bills query failed:', error.message);
        }
        
        // 5. General Expenses (Exclude staff wages - tracked separately in Salaries section)
        try {
            // Check if expenses table exists first
            const tableCheck = runQuery("SELECT name FROM sqlite_master WHERE type='table' AND name='expenses'");
            if (!tableCheck || tableCheck.length === 0) {
                console.warn('⚠️ Expenses table does not exist yet');
                expensesTotal = 0;
                expensesUnpaid = 0;
                expensesCount = 0;
            } else {
                const expensesDateFilter = startDate && endDate 
                    ? `AND expenseDate >= ${new Date(startDate).getTime()} AND expenseDate <= ${new Date(endDate).getTime()}`
                    : '';
                
                const expensesResult = runQuery(`
                    SELECT 
                        COALESCE(SUM(amount), 0) as total,
                        COALESCE(SUM(CASE WHEN status IN ('paid', 'approved') THEN amount ELSE 0 END), 0) as paid,
                        COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as unpaid,
                        COUNT(*) as count
                    FROM expenses 
                    WHERE category != 'staff_wages' ${expensesDateFilter}
                `);
                expensesTotal = expensesResult[0]?.total || 0;
                const expensesPaid = expensesResult[0]?.paid || 0;
                expensesUnpaid = expensesResult[0]?.unpaid || 0;
                expensesCount = expensesResult[0]?.count || 0;
                console.log('✅ General Expenses calculated (excluding staff wages):', expensesTotal, '(paid:', expensesPaid, 'unpaid:', expensesUnpaid, 'count:', expensesCount, ')');
            }
        } catch (error) {
            console.warn('⚠️ Expenses table not found or query failed:', error.message);
        }
        
        // 6. Staff Salaries (Expense) - Get from formal payroll payments (staff_payments table)
        try {
            console.log(`📊 Calculating salaries from payroll records: ${startDate} to ${endDate}`);
            
            const salariesDateFilter = startDate && endDate 
                ? `AND periodStart >= ${new Date(startDate).getTime()} AND periodEnd <= ${new Date(endDate).getTime()}`
                : '';
            
            const salariesResult = runQuery(`
                SELECT 
                    COALESCE(SUM(netAmount), 0) as total,
                    COALESCE(SUM(CASE WHEN status = 'paid' THEN netAmount ELSE 0 END), 0) as paid,
                    COALESCE(SUM(CASE WHEN status IN ('pending', 'approved') THEN netAmount ELSE 0 END), 0) as unpaid,
                    COUNT(*) as count
                FROM staff_payments
                WHERE paymentType = 'salary'
                ${salariesDateFilter}
            `);
            
            salariesTotal = salariesResult[0]?.total || 0;
            salariesPaid = salariesResult[0]?.paid || 0;
            salariesUnpaid = salariesResult[0]?.unpaid || 0;
            salariesCount = salariesResult[0]?.count || 0;
            
            console.log(`✅ Salaries calculated: Total $${salariesTotal.toFixed(2)} (Paid: $${salariesPaid.toFixed(2)}, Unpaid: $${salariesUnpaid.toFixed(2)}, Count: ${salariesCount})`);
        } catch (error) {
            console.warn('⚠️ Salaries calculation failed:', error.message);
        }
        
        // 7. Calculate Net Balance
        const totalIncome = salesTotal - refundsTotal;
        const totalExpenses = purchasesTotal + billsTotal + salariesTotal + expensesTotal;
        const totalExpensesPaid = purchasesPaid + billsPaid + salariesPaid + (expensesTotal - expensesUnpaid);
        const netBalance = totalIncome - totalExpensesPaid;
        
        // 8. Accounts Receivable (customers owe us)
        const accountsReceivable = salesUnpaid;
        
        // 9. Accounts Payable (we owe others)
        const accountsPayable = purchasesUnpaid + billsUnpaid + salariesUnpaid + expensesUnpaid;
        
        // 10. Projected Balance (if all receivables collected and all payables paid)
        const projectedBalance = netBalance + accountsReceivable - accountsPayable;
        
        return {
            period: {
                startDate: startDate || 'All Time',
                endDate: endDate || 'Present'
            },
            income: {
                sales: { amount: salesTotal, unpaid: salesUnpaid, count: salesCount },
                refunds: { amount: refundsTotal, count: refundsCount },
                net: totalIncome
            },
            expenses: {
                purchases: { 
                    total: purchasesTotal, 
                    paid: purchasesPaid,
                    returns: purchasesReturns,
                    unpaid: purchasesUnpaid, 
                    count: purchasesCount 
                },
                bills: { 
                    total: billsTotal, 
                    paid: billsPaid, 
                    unpaid: billsUnpaid, 
                    count: billsCount 
                },
                salaries: { 
                    total: salariesTotal, 
                    paid: salariesPaid, 
                    unpaid: salariesUnpaid, 
                    count: salariesCount 
                },
                general: {
                    total: expensesTotal,
                    paid: expensesTotal - expensesUnpaid,
                    unpaid: expensesUnpaid,
                    count: expensesCount
                },
                total: totalExpenses,
                paid: totalExpensesPaid
            },
            balance: {
                net: netBalance,
                accountsReceivable: accountsReceivable,
                accountsPayable: accountsPayable,
                projected: projectedBalance
            }
        };
    } catch (error) {
        console.error('Failed to calculate balance:', error);
        return null;
    }
}

// ===================================
// UI FUNCTIONS
// ===================================

async function openBalanceDashboard() {
    const user = getCurrentUser ? getCurrentUser() : null;
    if (!user || user.role !== 'admin') {
        showNotification('Access denied: Admin only', 'error');
        return;
    }
    
    const modal = document.getElementById('balance-modal');
    if (modal) {
        modal.classList.add('show');
        
        // Set default to current month
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        document.getElementById('balance-start-date').valueAsDate = firstDay;
        document.getElementById('balance-end-date').valueAsDate = lastDay;
        
        await refreshBalanceDashboard();
    }
}

function closeBalanceDashboard() {
    const modal = document.getElementById('balance-modal');
    if (modal) {
        modal.classList.remove('show');
    }
}

async function refreshBalanceDashboard() {
    const startDate = document.getElementById('balance-start-date').value || null;
    const endDate = document.getElementById('balance-end-date').value || null;
    
    showLoadingState();
    
    balanceData = await calculateBalance(startDate, endDate);
    lastRefreshTime = new Date();
    
    if (balanceData) {
        renderBalanceDashboard();
    } else {
        showErrorState();
    }
}

function showLoadingState() {
    const container = document.getElementById('balance-content');
    if (container) {
        container.innerHTML = '<div class="loading-state">Calculating balance...</div>';
    }
}

function showErrorState() {
    const container = document.getElementById('balance-content');
    if (container) {
        container.innerHTML = '<div class="error-state">Failed to calculate balance. Please try again.</div>';
    }
}

function renderBalanceDashboard() {
    if (!balanceData) return;
    
    const container = document.getElementById('balance-content');
    if (!container) return;
    
    const formatMoney = (amount) => formatDualCurrency ? formatDualCurrency(Math.abs(amount)) : `$${Math.abs(amount).toFixed(2)}`;
    const formatDate = (dateStr) => {
        if (dateStr === 'All Time' || dateStr === 'Present') return dateStr;
        return new Date(dateStr).toLocaleDateString();
    };
    
    container.innerHTML = `
        <div class="balance-dashboard">
            <!-- Period Info -->
            <div class="balance-period">
                <h3>Period: ${formatDate(balanceData.period.startDate)} - ${formatDate(balanceData.period.endDate)}</h3>
                <small>Last updated: ${lastRefreshTime.toLocaleString()}</small>
            </div>
            
            <!-- Summary Cards -->
            <div class="balance-summary-cards">
                <div class="balance-card income-card">
                    <div class="card-icon">💰</div>
                    <div class="card-content">
                        <div class="card-label">Total Income</div>
                        <div class="card-value">${formatMoney(balanceData.income.net)}</div>
                        <div class="card-detail">
                            Sales: ${formatMoney(balanceData.income.sales.amount)} (${balanceData.income.sales.count})
                            ${balanceData.income.refunds.amount > 0 ? `<br>Refunds: -${formatMoney(balanceData.income.refunds.amount)} (${balanceData.income.refunds.count})` : ''}
                        </div>
                    </div>
                </div>
                
                <div class="balance-card expense-card">
                    <div class="card-icon">📤</div>
                    <div class="card-content">
                        <div class="card-label">Total Expenses</div>
                        <div class="card-value">${formatMoney(balanceData.expenses.total)}</div>
                        <div class="card-detail">
                            Purchases: ${formatMoney(balanceData.expenses.purchases.amount)} (${balanceData.expenses.purchases.count})<br>
                            Bills: ${formatMoney(balanceData.expenses.bills.paid)} (${balanceData.expenses.bills.count})<br>
                            Salaries: ${formatMoney(balanceData.expenses.salaries.paid)} (${balanceData.expenses.salaries.count})
                        </div>
                    </div>
                </div>
                
                <div class="balance-card ${balanceData.balance.net >= 0 ? 'profit-card' : 'loss-card'}">
                    <div class="card-icon">${balanceData.balance.net >= 0 ? '📈' : '📉'}</div>
                    <div class="card-content">
                        <div class="card-label">Net Balance</div>
                        <div class="card-value ${balanceData.balance.net >= 0 ? 'positive' : 'negative'}">
                            ${balanceData.balance.net >= 0 ? '+' : '-'}${formatMoney(balanceData.balance.net)}
                        </div>
                        <div class="card-detail">
                            ${balanceData.balance.net >= 0 ? 'Profit' : 'Loss'}
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Pending Obligations -->
            ${balanceData.balance.pending > 0 ? `
                <div class="balance-pending">
                    <h3>⚠️ Pending Obligations</h3>
                    <div class="pending-breakdown">
                        ${balanceData.expenses.bills.unpaid > 0 ? `
                            <div class="pending-item">
                                <span>Unpaid Bills:</span>
                                <span>${formatMoney(balanceData.expenses.bills.unpaid)}</span>
                            </div>
                        ` : ''}
                        ${balanceData.expenses.salaries.unpaid > 0 ? `
                            <div class="pending-item">
                                <span>Unpaid Salaries:</span>
                                <span>${formatMoney(balanceData.expenses.salaries.unpaid)}</span>
                            </div>
                        ` : ''}
                        <div class="pending-item total">
                            <span><strong>Total Pending:</strong></span>
                            <span><strong>${formatMoney(balanceData.balance.pending)}</strong></span>
                        </div>
                        <div class="pending-item projected ${balanceData.balance.projected >= 0 ? 'positive' : 'negative'}">
                            <span><strong>Projected Balance:</strong></span>
                            <span><strong>${balanceData.balance.projected >= 0 ? '+' : '-'}${formatMoney(balanceData.balance.projected)}</strong></span>
                        </div>
                    </div>
                </div>
            ` : ''}
            
            <!-- Export Options -->
            <div class="balance-actions">
                <button onclick="exportBalanceReport()" class="btn-secondary">
                    📄 Export Report
                </button>
                <button onclick="printBalanceReport()" class="btn-secondary">
                    🖨️ Print
                </button>
            </div>
        </div>
    `;
}

function handlePeriodFilterChange() {
    const filter = document.getElementById('balance-period-filter').value;
    const now = new Date();
    let startDate, endDate;
    
    switch (filter) {
        case 'today':
            startDate = new Date(now.setHours(0, 0, 0, 0));
            endDate = new Date(now.setHours(23, 59, 59, 999));
            break;
        case 'week':
            startDate = new Date(now.setDate(now.getDate() - now.getDay()));
            endDate = new Date(now.setDate(now.getDate() - now.getDay() + 6));
            break;
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            break;
        case 'year':
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear(), 11, 31);
            break;
        case 'custom':
            // User will set custom dates
            return;
        default:
            startDate = null;
            endDate = null;
    }
    
    if (startDate && endDate) {
        document.getElementById('balance-start-date').valueAsDate = startDate;
        document.getElementById('balance-end-date').valueAsDate = endDate;
        refreshBalanceDashboard();
    }
}

async function exportBalanceReport() {
    if (!balanceData) {
        showNotification('No data to export', 'error');
        return;
    }
    
    // Get company info from database
    let companyName = 'AYN BEIRUT POS';
    try {
        const companyInfo = await runQuery('SELECT * FROM company_info WHERE id = 1');
        if (companyInfo && companyInfo.length > 0 && companyInfo[0].companyName) {
            companyName = companyInfo[0].companyName;
        }
    } catch (error) {
        console.warn('Could not load company info, using default:', error);
    }
    
    const report = `
${companyName} - BALANCE REPORT
Generated: ${new Date().toLocaleString()}
Period: ${balanceData.period.startDate} to ${balanceData.period.endDate}

=== INCOME ===
Sales: $${balanceData.income.sales.amount.toFixed(2)} (${balanceData.income.sales.count} transactions)
Refunds: -$${balanceData.income.refunds.amount.toFixed(2)} (${balanceData.income.refunds.count} refunds)
Net Income: $${balanceData.income.net.toFixed(2)}

=== EXPENSES ===
Purchases: $${balanceData.expenses.purchases.amount.toFixed(2)} (${balanceData.expenses.purchases.count} orders)
Bills (Paid): $${balanceData.expenses.bills.paid.toFixed(2)} (${balanceData.expenses.bills.count} bills)
Salaries (Paid): $${balanceData.expenses.salaries.paid.toFixed(2)} (${balanceData.expenses.salaries.count} payments)
Total Expenses: $${balanceData.expenses.total.toFixed(2)}

=== BALANCE ===
Net Balance: $${balanceData.balance.net.toFixed(2)}

=== PENDING OBLIGATIONS ===
Unpaid Bills: $${balanceData.expenses.bills.unpaid.toFixed(2)}
Unpaid Salaries: $${balanceData.expenses.salaries.unpaid.toFixed(2)}
Total Pending: $${balanceData.balance.pending.toFixed(2)}

=== PROJECTED ===
Projected Balance: $${balanceData.balance.projected.toFixed(2)}

---
Powered by Ayn Beirut POS
    `.trim();
    
    // Create download
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `balance-report-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('Report exported successfully', 'success');
}

function printBalanceReport() {
    window.print();
}

// Render balance inside admin dashboard tab
async function renderBalanceInAdminTab() {
    console.log('💰 renderBalanceInAdminTab() called');
    const container = document.getElementById('admin-balance-container');
    if (!container) {
        console.warn('❌ Admin balance container not found');
        return;
    }
    
    // Show loading
    container.innerHTML = '<div class="loading-state">Calculating balance...</div>';
    
    try {
        // Set default to current month
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        const startDate = firstDay.toISOString().split('T')[0];
        const endDate = lastDay.toISOString().split('T')[0];
        
        console.log('💰 Calculating balance for period:', startDate, 'to', endDate);
        
        // Calculate and render
        balanceData = await calculateBalance(startDate, endDate);
        lastRefreshTime = new Date();
        
        console.log('💰 Balance calculated:', balanceData ? '✅ Success' : '❌ Failed');
        
        if (balanceData) {
            renderBalanceInContainer(container);
            console.log('✅ Balance rendered successfully');
        } else {
            console.error('❌ Balance data is null/undefined');
            container.innerHTML = '<div class="error-state">Failed to calculate balance. Please try again.</div>';
        }
    } catch (error) {
        console.error('❌ Error in renderBalanceInAdminTab:', error);
        container.innerHTML = `<div class="error-state">Error: ${error.message}</div>`;
    }
}

function renderBalanceInContainer(container) {
    if (!balanceData) return;
    
    const formatMoney = (amount) => formatDualCurrency ? formatDualCurrency(Math.abs(amount)) : `$${Math.abs(amount).toFixed(2)}`;
    const formatDate = (dateStr) => {
        if (dateStr === 'All Time' || dateStr === 'Present') return dateStr;
        return new Date(dateStr).toLocaleDateString();
    };
    
    container.innerHTML = `
        <div class="balance-dashboard">
            <div class="balance-period">
                <h3>📅 Select Period</h3>
                <div style="display: flex; gap: 15px; align-items: center; margin: 15px 0;">
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Start Date:</label>
                        <input type="date" id="admin-balance-start-date" value="${balanceData.period.startDate}" 
                               style="padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">End Date:</label>
                        <input type="date" id="admin-balance-end-date" value="${balanceData.period.endDate}" 
                               style="padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                    </div>
                    <div style="margin-top: 20px;">
                        <button onclick="updateBalancePeriod()" class="btn-primary" style="padding: 8px 20px;">📊 Update</button>
                    </div>
                </div>
                <small style="color: var(--light-grey);">Last updated: ${lastRefreshTime.toLocaleString()}</small>
            </div>
            
            <div class="balance-summary-cards">
                <div class="balance-card income-card">
                    <div class="card-icon">💰</div>
                    <div class="card-content">
                        <div class="card-label">Total Income</div>
                        <div class="card-value">${formatMoney(balanceData.income.net)}</div>
                        <div class="card-detail">
                            Sales: ${formatMoney(balanceData.income.sales.amount)} (${balanceData.income.sales.count})
                            ${balanceData.income.refunds.amount > 0 ? `<br>Refunds: -${formatMoney(balanceData.income.refunds.amount)} (${balanceData.income.refunds.count})` : ''}
                        </div>
                    </div>
                </div>
                
                <div class="balance-card expense-card">
                    <div class="card-icon">📤</div>
                    <div class="card-content">
                        <div class="card-label">Total Expenses (Paid in Period)</div>
                        <div class="card-value">${formatMoney(balanceData.expenses.paid)}</div>
                        <div class="card-detail">
                            Purchases Paid: ${formatMoney(balanceData.expenses.purchases.paid)}<br>
                            ${balanceData.expenses.purchases.returns > 0 ? `Returns: -${formatMoney(balanceData.expenses.purchases.returns)}<br>` : ''}
                            Bills: ${formatMoney(balanceData.expenses.bills.paid)}<br>
                            Salaries: ${formatMoney(balanceData.expenses.salaries.paid)}<br>
                            General: ${formatMoney(balanceData.expenses.general.paid)}
                        </div>
                    </div>
                </div>
                
                <div class="balance-card ${balanceData.balance.net >= 0 ? 'profit-card' : 'loss-card'}">
                    <div class="card-icon">${balanceData.balance.net >= 0 ? '📈' : '📉'}</div>
                    <div class="card-content">
                        <div class="card-label">Net Balance</div>
                        <div class="card-value ${balanceData.balance.net >= 0 ? 'positive' : 'negative'}">
                            ${balanceData.balance.net >= 0 ? '+' : '-'}${formatMoney(balanceData.balance.net)}
                        </div>
                        <div class="card-detail">${balanceData.balance.net >= 0 ? 'Profit' : 'Loss'}</div>
                    </div>
                </div>
            </div>
            
            ${(balanceData.balance.accountsReceivable > 0 || balanceData.balance.accountsPayable > 0) ? `
                <div class="balance-pending">
                    <h3>💼 Accounts Receivable & Payable</h3>
                    <div class="pending-breakdown">
                        ${balanceData.balance.accountsReceivable > 0 ? `
                            <div class="pending-item positive">
                                <span>📥 Accounts Receivable (Customers Owe Us):</span>
                                <span><strong>+${formatMoney(balanceData.balance.accountsReceivable)}</strong></span>
                            </div>
                            <div style="padding-left: 20px; font-size: 0.9em; color: var(--light-grey);">
                                Unpaid Sales: ${formatMoney(balanceData.income.sales.unpaid)}
                            </div>
                        ` : ''}
                        
                        ${balanceData.balance.accountsPayable > 0 ? `
                            <div class="pending-item negative" style="margin-top: 10px;">
                                <span>📤 Accounts Payable (We Owe Suppliers - All Time):</span>
                                <span><strong>-${formatMoney(balanceData.balance.accountsPayable)}</strong></span>
                            </div>
                            <div style="padding-left: 20px; font-size: 0.9em; color: var(--light-grey);">
                                ${balanceData.expenses.purchases.unpaid > 0 ? `
                                    Supplier Outstanding: ${formatMoney(balanceData.expenses.purchases.unpaid)}<br>
                                    <small style="color: var(--light-grey);">
                                        (All-time deliveries - payments - returns)
                                    </small><br>
                                ` : ''}
                                ${balanceData.expenses.bills.unpaid > 0 ? `Unpaid Bills: ${formatMoney(balanceData.expenses.bills.unpaid)}<br>` : ''}
                                ${balanceData.expenses.salaries.unpaid > 0 ? `Unpaid Salaries: ${formatMoney(balanceData.expenses.salaries.unpaid)}<br>` : ''}
                                ${balanceData.expenses.general.unpaid > 0 ? `Unpaid Expenses: ${formatMoney(balanceData.expenses.general.unpaid)}` : ''}
                            </div>
                        ` : ''}
                        
                        <div class="pending-item projected ${balanceData.balance.projected >= 0 ? 'positive' : 'negative'}" style="margin-top: 15px; border-top: 2px solid var(--border-color); padding-top: 10px;">
                            <span><strong>📊 Projected Balance:</strong><br><small>(If all receivables collected & payables paid)</small></span>
                            <span><strong>${balanceData.balance.projected >= 0 ? '+' : '-'}${formatMoney(balanceData.balance.projected)}</strong></span>
                        </div>
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

// Update balance period from admin tab date inputs
async function updateBalancePeriod() {
    const startDate = document.getElementById('admin-balance-start-date')?.value;
    const endDate = document.getElementById('admin-balance-end-date')?.value;
    
    if (!startDate || !endDate) {
        alert('Please select both start and end dates');
        return;
    }
    
    if (new Date(startDate) > new Date(endDate)) {
        alert('Start date must be before end date');
        return;
    }
    
    console.log('💰 Updating balance period:', startDate, 'to', endDate);
    
    const container = document.getElementById('admin-balance-container');
    if (container) {
        container.innerHTML = '<div class="loading-state">Calculating balance...</div>';
        
        try {
            balanceData = await calculateBalance(startDate, endDate);
            lastRefreshTime = new Date();
            
            if (balanceData) {
                renderBalanceInContainer(container);
                console.log('✅ Balance updated successfully');
            } else {
                container.innerHTML = '<div class="error-state">Failed to calculate balance. Please try again.</div>';
            }
        } catch (error) {
            console.error('❌ Error updating balance:', error);
            container.innerHTML = `<div class="error-state">Error: ${error.message}</div>`;
        }
    }
}

// Export functions
window.initBalanceDashboard = initBalanceDashboard;
window.openBalanceDashboard = openBalanceDashboard;
window.closeBalanceDashboard = closeBalanceDashboard;
window.refreshBalanceDashboard = refreshBalanceDashboard;
window.handlePeriodFilterChange = handlePeriodFilterChange;
window.exportBalanceReport = exportBalanceReport;
window.printBalanceReport = printBalanceReport;
window.renderBalanceInAdminTab = renderBalanceInAdminTab;
window.updateBalancePeriod = updateBalancePeriod;
