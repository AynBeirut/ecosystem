// ===================================
// AYN BEIRUT POS - PAYROLL MANAGEMENT
// Salary calculations and payment tracking
// ===================================

// ===================================
// PAYROLL GENERATION
// ===================================

function openPayrollForm(staffId) {
    const staff = staffList.find(s => s.id === staffId);
    if (!staff) {
        showNotification('Staff member not found', 'error');
        return;
    }
    
    // Set current month as default period
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    document.getElementById('payroll-staff-id').value = staff.id;
    document.getElementById('payroll-staff-name').textContent = `${staff.firstName} ${staff.lastName}`;
    document.getElementById('payroll-period-start').valueAsDate = firstDay;
    document.getElementById('payroll-period-end').valueAsDate = lastDay;
    document.getElementById('payroll-bonus').value = '0';
    document.getElementById('payroll-deductions').value = '0';
    
    // Calculate initial values
    calculatePayrollPreview();
    
    const modal = document.getElementById('payroll-form-modal');
    if (modal) modal.style.display = 'block';
}

async function calculatePayrollPreview() {
    const staffId = parseInt(document.getElementById('payroll-staff-id').value);
    const periodStart = document.getElementById('payroll-period-start').value;
    const periodEnd = document.getElementById('payroll-period-end').value;
    const bonus = parseFloat(document.getElementById('payroll-bonus').value) || 0;
    const deductions = parseFloat(document.getElementById('payroll-deductions').value) || 0;
    
    if (!staffId || !periodStart || !periodEnd) return;
    
    const salary = await calculateSalaryForPeriod(staffId, periodStart, periodEnd);
    
    document.getElementById('payroll-base-amount').textContent = salary.baseAmount.toFixed(2);
    document.getElementById('payroll-overtime-amount').textContent = salary.overtimeAmount.toFixed(2);
    document.getElementById('payroll-total-hours').textContent = salary.hours.total.toFixed(2);
    document.getElementById('payroll-regular-hours').textContent = salary.hours.regular.toFixed(2);
    document.getElementById('payroll-overtime-hours').textContent = salary.hours.overtime.toFixed(2);
    
    const netAmount = salary.baseAmount + salary.overtimeAmount + bonus - deductions;
    document.getElementById('payroll-net-amount').textContent = netAmount.toFixed(2);
}

async function handlePayrollSubmit(e) {
    e.preventDefault();
    
    const staffId = parseInt(document.getElementById('payroll-staff-id').value);
    const periodStart = document.getElementById('payroll-period-start').value;
    const periodEnd = document.getElementById('payroll-period-end').value;
    const bonus = parseFloat(document.getElementById('payroll-bonus').value) || 0;
    const deductions = parseFloat(document.getElementById('payroll-deductions').value) || 0;
    
    if (!staffId || !periodStart || !periodEnd) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }
    
    const success = await generatePayroll(staffId, periodStart, periodEnd, bonus, deductions);
    if (success) {
        closePayrollForm();
        openPaymentsManagement();
    }
}

function closePayrollForm() {
    const modal = document.getElementById('payroll-form-modal');
    if (modal) modal.style.display = 'none';
}

// ===================================
// PAYMENT MANAGEMENT
// ===================================

function openPaymentsManagement() {
    loadPendingPayments();
    const modal = document.getElementById('payments-modal');
    if (modal) modal.style.display = 'block';
}

function closePaymentsManagement() {
    const modal = document.getElementById('payments-modal');
    if (modal) modal.style.display = 'none';
}

async function loadPendingPayments() {
    try {
        console.log('💰 Loading pending payments...');
        
        // Load formal payment records
        const paymentsResult = db.exec(`
            SELECT 
                p.id, p.staffId, p.paymentType, p.paymentPeriod,
                p.periodStart, p.periodEnd, p.baseAmount, p.overtimeAmount,
                p.bonusAmount, p.deductions, p.netAmount, p.status,
                p.approvedBy, p.approvedAt, p.paidBy, p.paidAt, p.notes,
                s.firstName, s.lastName, s.employeeCode
            FROM staff_payments p
            JOIN staff s ON p.staffId = s.id
            WHERE p.status IN ('pending', 'approved')
            ORDER BY p.periodEnd DESC
        `);
        
        let formalPayments = [];
        if (paymentsResult && paymentsResult[0]) {
            const columns = paymentsResult[0].columns;
            formalPayments = paymentsResult[0].values.map(row => {
                const payment = {};
                columns.forEach((col, index) => {
                    payment[col] = row[index];
                });
                return payment;
            });
        }
        console.log('💰 Formal payments found:', formalPayments.length);
        
        // First, check if isPaid column exists, if not add it
        try {
            const tableInfo = db.exec("PRAGMA table_info(staff_attendance)");
            const columns = tableInfo[0] ? tableInfo[0].values.map(row => row[1]) : [];
            
            if (!columns.includes('isPaid')) {
                console.log('⚠️ isPaid column missing, adding it...');
                db.exec("ALTER TABLE staff_attendance ADD COLUMN isPaid INTEGER DEFAULT 0");
                db.exec("ALTER TABLE staff_attendance ADD COLUMN paidAt INTEGER");
                db.exec("ALTER TABLE staff_attendance ADD COLUMN paidBy INTEGER");
                await saveDatabase();
                console.log('✅ Added isPaid column to staff_attendance table');
            }
        } catch (alterError) {
            console.log('ℹ️ Column check/add:', alterError.message);
        }
        
        // Load unpaid attendance earnings
        console.log('💰 Querying unpaid attendance...');
        const attendanceResult = db.exec(`
            SELECT 
                s.id as staffId,
                s.firstName,
                s.lastName,
                s.employeeCode,
                s.paymentType,
                s.hourlyRate,
                s.dailyRate,
                s.monthlySalary,
                SUM(a.totalHours) as totalHours,
                SUM(a.regularHours) as regularHours,
                SUM(a.overtimeHours) as overtimeHours,
                MIN(a.checkInTime) as firstCheckIn,
                MAX(a.checkOutTime) as lastCheckOut
            FROM staff s
            LEFT JOIN staff_attendance a ON s.id = a.staffId 
                AND a.status = 'present'
                AND a.checkOutTime IS NOT NULL
                AND (a.isPaid IS NULL OR a.isPaid = 0)
            WHERE s.isActive = 1
            GROUP BY s.id, s.firstName, s.lastName, s.employeeCode, 
                     s.paymentType, s.hourlyRate, s.dailyRate, s.monthlySalary
            HAVING totalHours > 0
        `);
        
        console.log('💰 Attendance query result:', attendanceResult);
        
        let unpaidAttendance = [];
        if (attendanceResult && attendanceResult[0]) {
            const columns = attendanceResult[0].columns;
            console.log('💰 Attendance columns:', columns);
            console.log('💰 Attendance rows:', attendanceResult[0].values.length);
            
            unpaidAttendance = attendanceResult[0].values.map(row => {
                const record = {};
                columns.forEach((col, index) => {
                    record[col] = row[index];
                });
                
                console.log('💰 Processing staff:', record.firstName, record.lastName, 'Hours:', record.totalHours);
                
                // Calculate earnings based on payment type
                let baseAmount = 0;
                let overtimeAmount = 0;
                const totalHours = parseFloat(record.totalHours) || 0;
                const regularHours = parseFloat(record.regularHours) || 0;
                const overtimeHours = parseFloat(record.overtimeHours) || 0;
                
                if (record.paymentType === 'hourly') {
                    const hourlyRate = parseFloat(record.hourlyRate) || 0;
                    baseAmount = regularHours * hourlyRate;
                    overtimeAmount = overtimeHours * hourlyRate * 1.5;
                } else if (record.paymentType === 'daily') {
                    const dailyRate = parseFloat(record.dailyRate) || 0;
                    const daysWorked = Math.ceil(totalHours / 8);
                    baseAmount = daysWorked * dailyRate;
                } else if (record.paymentType === 'monthly') {
                    const monthlySalary = parseFloat(record.monthlySalary) || 0;
                    const daysWorked = Math.ceil(totalHours / 8);
                    baseAmount = (monthlySalary / 22) * daysWorked;
                }
                
                const netAmount = baseAmount + overtimeAmount;
                
                console.log('💰 Calculated:', record.firstName, 'Base:', baseAmount, 'OT:', overtimeAmount, 'Net:', netAmount);
                
                // Get date range
                const firstDate = record.firstCheckIn ? new Date(record.firstCheckIn).toLocaleDateString() : 'N/A';
                const lastDate = record.lastCheckOut ? new Date(record.lastCheckOut).toLocaleDateString() : 'N/A';
                
                return {
                    id: `unpaid_${record.staffId}`,
                    staffId: record.staffId,
                    firstName: record.firstName,
                    lastName: record.lastName,
                    employeeCode: record.employeeCode,
                    paymentPeriod: `${firstDate} to ${lastDate}`,
                    baseAmount: baseAmount,
                    overtimeAmount: overtimeAmount,
                    bonusAmount: 0,
                    deductions: 0,
                    netAmount: netAmount,
                    status: 'unpaid',
                    totalHours: totalHours,
                    isAttendancePayment: true
                };
            });
        }
        
        console.log('💰 Unpaid attendance found:', unpaidAttendance.length);
        
        // Combine both lists
        const allPayments = [...unpaidAttendance, ...formalPayments];
        console.log('💰 Total payments to display:', allPayments.length);
        renderPaymentsList(allPayments);
    } catch (error) {
        console.error('Failed to load pending payments:', error);
        renderPaymentsList([]);
    }
}

function renderPaymentsList(payments) {
    const container = document.getElementById('payments-list');
    if (!container) return;
    
    if (payments.length === 0) {
        container.innerHTML = '<div class="empty-state">No pending payments</div>';
        return;
    }
    
    container.innerHTML = payments.map(payment => `
        <div class="payment-card" data-id="${payment.id}">
            <div class="payment-info">
                <div class="payment-staff">
                    <strong>${payment.firstName} ${payment.lastName}</strong>
                    <span class="employee-code">${payment.employeeCode}</span>
                </div>
                <div class="payment-period">${payment.paymentPeriod}</div>
                <div class="payment-amounts">
                    <div>Base: $${payment.baseAmount.toFixed(2)}</div>
                    ${payment.overtimeAmount > 0 ? `<div>Overtime: $${payment.overtimeAmount.toFixed(2)}</div>` : ''}
                    ${payment.bonusAmount > 0 ? `<div>Bonus: $${payment.bonusAmount.toFixed(2)}</div>` : ''}
                    ${payment.deductions > 0 ? `<div>Deductions: -$${payment.deductions.toFixed(2)}</div>` : ''}
                    ${payment.totalHours ? `<div>Hours: ${parseFloat(payment.totalHours).toFixed(2)}h</div>` : ''}
                    <div class="net-amount"><strong>Net: $${payment.netAmount.toFixed(2)}</strong></div>
                </div>
                <div class="payment-status status-${payment.status}">${payment.status.toUpperCase()}</div>
            </div>
            <div class="payment-actions">
                ${payment.status === 'unpaid' && payment.isAttendancePayment ? `
                    <button onclick="markAttendancePaid(${payment.staffId})" class="btn-primary">Mark as Paid</button>
                ` : ''}
                ${payment.status === 'pending' ? `
                    <button onclick="approvePayment(${payment.id})" class="btn-success">Approve</button>
                ` : ''}
                ${payment.status === 'approved' ? `
                    <button onclick="markPaymentPaid(${payment.id})" class="btn-primary">Mark as Paid</button>
                ` : ''}
                <button onclick="viewPaymentDetails('${payment.id}')" class="btn-secondary">Details</button>
                <button onclick="viewStaffPaymentHistory(${payment.staffId})" class="btn-info" title="View full payment history">
                    📊 Statement
                </button>
            </div>
        </div>
    `).join('');
}

async function approvePayment(paymentId) {
    try {
        const user = getCurrentUser ? getCurrentUser() : null;
        if (!user || user.role !== 'admin') {
            showNotification('Only admins can approve payments', 'error');
            return;
        }
        
        await runExec(`
            UPDATE staff_payments SET
                status = 'approved',
                approvedBy = ?,
                approvedAt = ?
            WHERE id = ?
        `, [user.id, Date.now(), paymentId]);
        
        await saveDatabase();
        showNotification('Payment approved', 'success');
        loadPendingPayments();
    } catch (error) {
        console.error('Failed to approve payment:', error);
        showNotification('Failed to approve payment', 'error');
    }
}

async function markPaymentPaid(paymentId) {
    try {
        const user = getCurrentUser ? getCurrentUser() : null;
        if (!user || user.role !== 'admin') {
            showNotification('Only admins can mark payments as paid', 'error');
            return;
        }
        
        // Get payment details for recording the transaction
        const result = db.exec(`SELECT * FROM staff_payments WHERE id = ${paymentId}`);
        if (!result || !result[0] || !result[0].values.length) {
            showNotification('Payment not found', 'error');
            return;
        }
        
        const columns = result[0].columns;
        const payment = {};
        columns.forEach((col, index) => {
            payment[col] = result[0].values[0][index];
        });
        
        // Get staff name for expense description
        const staffResult = db.exec(`SELECT firstName, lastName FROM staff WHERE id = ${payment.staffId}`);
        const staffName = staffResult && staffResult[0] && staffResult[0].values.length
            ? `${staffResult[0].values[0][0]} ${staffResult[0].values[0][1]}`
            : `Staff ID ${payment.staffId}`;
        
        const paidTimestamp = Date.now();
        
        // Update payment status
        await runExec(`
            UPDATE staff_payments SET
                status = 'paid',
                paidAt = ?,
                paidBy = ?
            WHERE id = ?
        `, [paidTimestamp, user.id, paymentId]);
        
        // Record as expense for financial tracking
        await runExec(`
            INSERT INTO expenses (
                category, description, amount, expenseDate,
                referenceType, referenceId, status,
                recordedBy, recordedAt, paidBy, paidAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            'staff_wages',
            `Salary Payment: ${staffName} (${payment.paymentPeriod})`,
            payment.netAmount,
            paidTimestamp,
            'staff_payment',
            paymentId,
            'paid',
            user.id,
            paidTimestamp,
            user.id,
            paidTimestamp
        ]);
        
        await saveDatabase();
        showNotification('Payment marked as paid and recorded as expense', 'success');
        loadPendingPayments();
        
        // Refresh balance if it's open
        if (typeof refreshBalanceDashboard === 'function') {
            refreshBalanceDashboard();
        }
    } catch (error) {
        console.error('Failed to mark payment as paid:', error);
        showNotification('Failed to mark payment as paid', 'error');
    }
}

async function markAttendancePaid(staffId) {
    try {
        const user = getCurrentUser ? getCurrentUser() : null;
        if (!user || user.role !== 'admin') {
            showNotification('Only admins can mark payments as paid', 'error');
            return;
        }
        
        // Update all unpaid attendance records for this staff member
        await runExec(`
            UPDATE staff_attendance SET
                isPaid = 1,
                paidAt = ?,
                paidBy = ?
            WHERE staffId = ? 
                AND status = 'present' 
                AND checkOutTime IS NOT NULL
                AND (isPaid IS NULL OR isPaid = 0)
        `, [Date.now(), user.id, staffId]);
        
        await saveDatabase();
        showNotification('Attendance marked as paid', 'success');
        loadPendingPayments();
        
        // Refresh balance if it's open
        if (typeof refreshBalanceDashboard === 'function') {
            refreshBalanceDashboard();
        }
    } catch (error) {
        console.error('Failed to mark attendance as paid:', error);
        showNotification('Failed to mark attendance as paid', 'error');
    }
}

async function viewPaymentDetails(paymentId) {
    try {
        // Check if this is an unpaid attendance record (ID starts with "unpaid_")
        if (String(paymentId).startsWith('unpaid_')) {
            showNotification('This is an unpaid attendance record. Use "Mark Paid" to process payment.', 'info');
            return;
        }
        
        // Get payment details from database
        const result = db.exec(`
            SELECT 
                p.id,
                p.staffId,
                p.paymentType,
                p.paymentPeriod,
                p.periodStart,
                p.periodEnd,
                p.baseAmount,
                p.overtimeAmount,
                p.bonusAmount,
                p.deductions,
                p.netAmount,
                p.status,
                p.approvedBy,
                p.approvedAt,
                p.paidBy,
                p.paidAt,
                p.notes,
                s.firstName,
                s.lastName,
                s.employeeCode,
                s.position,
                u1.username as approvedByUsername,
                u2.username as paidByUsername
            FROM staff_payments p
            JOIN staff s ON p.staffId = s.id
            LEFT JOIN users u1 ON p.approvedBy = u1.id
            LEFT JOIN users u2 ON p.paidBy = u2.id
            WHERE p.id = ${paymentId}
        `);
        
        if (!result || !result[0] || !result[0].values.length) {
            showNotification('Payment not found', 'error');
            return;
        }
        
        const columns = result[0].columns;
        const payment = {};
        columns.forEach((col, index) => {
            payment[col] = result[0].values[0][index];
        });
        
        // Create modal content
        const modalHtml = `
            <div class="modal" id="payment-details-modal" style="display: block;">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h2>💰 Payment Details</h2>
                        <button class="close-btn" onclick="document.getElementById('payment-details-modal').remove()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div style="padding: 20px; background: var(--surface-color); border-radius: 8px; margin-bottom: 15px;">
                            <h3 style="margin: 0 0 10px 0;">Employee Information</h3>
                            <p><strong>Name:</strong> ${payment.firstName} ${payment.lastName}</p>
                            <p><strong>Code:</strong> ${payment.employeeCode}</p>
                            <p><strong>Position:</strong> ${payment.position}</p>
                        </div>
                        
                        <div style="padding: 20px; background: var(--surface-color); border-radius: 8px; margin-bottom: 15px;">
                            <h3 style="margin: 0 0 10px 0;">Payment Information</h3>
                            <p><strong>Type:</strong> ${payment.paymentType.charAt(0).toUpperCase() + payment.paymentType.slice(1)}</p>
                            <p><strong>Period:</strong> ${payment.paymentPeriod}</p>
                            <p><strong>Period Dates:</strong> ${new Date(payment.periodStart).toLocaleDateString()} - ${new Date(payment.periodEnd).toLocaleDateString()}</p>
                        </div>
                        
                        <div style="padding: 20px; background: var(--surface-color); border-radius: 8px; margin-bottom: 15px;">
                            <h3 style="margin: 0 0 10px 0;">Amount Breakdown</h3>
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 5px 0; border-bottom: 1px solid var(--border-color);">Base Amount:</td>
                                    <td style="padding: 5px 0; text-align: right; border-bottom: 1px solid var(--border-color);">$${payment.baseAmount.toFixed(2)}</td>
                                </tr>
                                ${payment.overtimeAmount > 0 ? `
                                <tr>
                                    <td style="padding: 5px 0; border-bottom: 1px solid var(--border-color);">Overtime Amount:</td>
                                    <td style="padding: 5px 0; text-align: right; border-bottom: 1px solid var(--border-color);">$${payment.overtimeAmount.toFixed(2)}</td>
                                </tr>
                                ` : ''}
                                ${payment.bonusAmount > 0 ? `
                                <tr>
                                    <td style="padding: 5px 0; border-bottom: 1px solid var(--border-color);">Bonus:</td>
                                    <td style="padding: 5px 0; text-align: right; border-bottom: 1px solid var(--border-color); color: var(--success-color);">+$${payment.bonusAmount.toFixed(2)}</td>
                                </tr>
                                ` : ''}
                                ${payment.deductions > 0 ? `
                                <tr>
                                    <td style="padding: 5px 0; border-bottom: 1px solid var(--border-color);">Deductions:</td>
                                    <td style="padding: 5px 0; text-align: right; border-bottom: 1px solid var(--border-color); color: var(--danger-color);">-$${payment.deductions.toFixed(2)}</td>
                                </tr>
                                ` : ''}
                                <tr>
                                    <td style="padding: 10px 0; font-weight: bold;">Net Amount:</td>
                                    <td style="padding: 10px 0; text-align: right; font-weight: bold; font-size: 1.2em; color: var(--primary-color);">$${payment.netAmount.toFixed(2)}</td>
                                </tr>
                            </table>
                        </div>
                        
                        <div style="padding: 20px; background: var(--surface-color); border-radius: 8px; margin-bottom: 15px;">
                            <h3 style="margin: 0 0 10px 0;">Status & Approval</h3>
                            <p><strong>Status:</strong> <span style="color: ${payment.status === 'paid' ? 'var(--success-color)' : payment.status === 'approved' ? 'var(--info-color)' : 'var(--warning-color)'};">${payment.status.toUpperCase()}</span></p>
                            ${payment.approvedBy ? `
                            <p><strong>Approved By:</strong> ${payment.approvedByUsername || 'Unknown'}</p>
                            <p><strong>Approved At:</strong> ${new Date(payment.approvedAt).toLocaleString()}</p>
                            ` : ''}
                            ${payment.paidBy ? `
                            <p><strong>Paid By:</strong> ${payment.paidByUsername || 'Unknown'}</p>
                            <p><strong>Paid At:</strong> ${new Date(payment.paidAt).toLocaleString()}</p>
                            ` : ''}
                        </div>
                        
                        ${payment.notes ? `
                        <div style="padding: 20px; background: var(--surface-color); border-radius: 8px;">
                            <h3 style="margin: 0 0 10px 0;">Notes</h3>
                            <p style="white-space: pre-wrap;">${payment.notes}</p>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
        
        // Append modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    } catch (error) {
        console.error('Failed to view payment details:', error);
        showNotification('Failed to load payment details', 'error');
    }
}

// ===================================
// STAFF PAYMENT HISTORY & STATEMENT
// ===================================

let currentStaffId = null;
let currentStatementData = null;

async function getStaffPaymentHistory(staffId, filters = {}) {
    try {
        console.log('📊 getStaffPaymentHistory called with staffId:', staffId);
        console.log('📊 staffList available:', !!staffList, 'length:', staffList?.length);
        
        const staff = staffList?.find(s => s.id === staffId);
        console.log('📊 Staff found:', staff);
        
        if (!staff) {
            console.error('Staff member not found, staffId:', staffId);
            return null;
        }
        
        const { startDate, endDate, status, type } = filters;
        console.log('📊 Filters:', filters);
        
        // Build date filter
        let dateFilter = '';
        if (startDate) {
            dateFilter += ` AND periodStart >= ${new Date(startDate).getTime()}`;
        }
        if (endDate) {
            dateFilter += ` AND periodEnd <= ${new Date(endDate).getTime()}`;
        }
        
        // Build status filter
        let statusFilter = '';
        if (status && status !== 'unpaid') {
            statusFilter = ` AND status = '${status}'`;
        }
        
        // Build type filter
        let typeFilter = '';
        if (type && type !== 'attendance') {
            typeFilter = ` AND paymentType = '${type}'`;
        }
        
        // 1. Get formal payments from staff_payments table
        let payments = [];
        if (!type || type !== 'attendance') {
            const query = `
                SELECT 
                    p.id, p.staffId, p.paymentType, p.paymentPeriod,
                    p.periodStart, p.periodEnd, p.baseAmount, p.overtimeAmount,
                    p.bonusAmount, p.deductions, p.netAmount, p.status,
                    p.approvedBy, p.approvedAt, p.paidBy, p.paidAt, p.notes,
                    u1.username as approvedByUsername,
                    u2.username as paidByUsername
                FROM staff_payments p
                LEFT JOIN users u1 ON p.approvedBy = u1.id
                LEFT JOIN users u2 ON p.paidBy = u2.id
                WHERE p.staffId = ${staffId}
                ${dateFilter}
                ${statusFilter}
                ${typeFilter}
                ORDER BY p.periodEnd DESC
            `;
            
            const result = db.exec(query);
            if (result && result[0]) {
                const columns = result[0].columns;
                payments = result[0].values.map(row => {
                    const payment = {};
                    columns.forEach((col, index) => {
                        payment[col] = row[index];
                    });
                    payment.source = 'payment';
                    payment.date = new Date(payment.periodEnd);
                    return payment;
                });
            }
        }
        
        // 2. Get unpaid attendance earnings (if not filtering by status or including unpaid)
        let unpaidAttendance = [];
        if (!status || status === 'unpaid' || !type || type === 'attendance') {
            const attendanceQuery = `
                SELECT 
                    attendanceDate,
                    totalHours,
                    regularHours,
                    overtimeHours,
                    checkInTime,
                    checkOutTime
                FROM staff_attendance
                WHERE staffId = ${staffId}
                AND status = 'present'
                AND checkOutTime IS NOT NULL
                AND (isPaid IS NULL OR isPaid = 0)
                ${startDate ? `AND attendanceDate >= '${startDate}'` : ''}
                ${endDate ? `AND attendanceDate <= '${endDate}'` : ''}
                ORDER BY attendanceDate DESC
            `;
            
            const attendanceResult = db.exec(attendanceQuery);
            if (attendanceResult && attendanceResult[0]) {
                const columns = attendanceResult[0].columns;
                unpaidAttendance = attendanceResult[0].values.map(row => {
                    const record = {};
                    columns.forEach((col, index) => {
                        record[col] = row[index];
                    });
                    
                    // Calculate amount based on payment type
                    let amount = 0;
                    const regularHours = record.regularHours || 0;
                    const overtimeHours = record.overtimeHours || 0;
                    
                    if (staff.paymentType === 'monthly') {
                        const hourlyRate = (parseFloat(staff.monthlySalary) || 0) / 160;
                        amount = regularHours * hourlyRate + overtimeHours * (parseFloat(staff.overtimeRate) || hourlyRate * 1.5);
                    } else if (staff.paymentType === 'daily') {
                        const hourlyRate = (parseFloat(staff.dailyRate) || 0) / 8;
                        amount = regularHours * hourlyRate + overtimeHours * (parseFloat(staff.overtimeRate) || hourlyRate * 1.5);
                    } else if (staff.paymentType === 'hourly') {
                        const hourlyRate = parseFloat(staff.hourlyRate) || 0;
                        amount = regularHours * hourlyRate + overtimeHours * (parseFloat(staff.overtimeRate) || hourlyRate * 1.5);
                    }
                    
                    return {
                        date: new Date(record.attendanceDate),
                        attendanceDate: record.attendanceDate,
                        totalHours: record.totalHours,
                        regularHours: record.regularHours,
                        overtimeHours: record.overtimeHours,
                        amount: amount,
                        status: 'unpaid',
                        paymentType: 'attendance',
                        source: 'attendance',
                        description: `Unpaid work: ${(record.totalHours || 0).toFixed(2)}h (${(record.regularHours || 0).toFixed(2)}h regular, ${(record.overtimeHours || 0).toFixed(2)}h OT)`
                    };
                });
            }
        }
        
        // 3. Merge and sort chronologically
        const allTransactions = [...payments, ...unpaidAttendance].sort((a, b) => b.date - a.date);
        
        // 4. Calculate running balance
        let runningBalance = 0;
        allTransactions.forEach(transaction => {
            if (transaction.source === 'payment') {
                if (transaction.status === 'paid') {
                    // Paid transactions don't add to balance
                    transaction.balanceChange = 0;
                } else {
                    // Pending/approved add to balance owed
                    transaction.balanceChange = transaction.netAmount;
                    runningBalance += transaction.netAmount;
                }
            } else {
                // Unpaid attendance adds to balance
                transaction.balanceChange = transaction.amount;
                runningBalance += transaction.amount;
            }
            transaction.runningBalance = runningBalance;
        });
        
        // Reverse to show oldest first with correct running balance
        allTransactions.reverse();
        let balance = 0;
        allTransactions.forEach(t => {
            balance += t.balanceChange;
            t.runningBalance = balance;
        });
        
        // 5. Calculate totals
        const totalEarned = allTransactions.reduce((sum, t) => {
            if (t.source === 'payment') {
                return sum + (t.netAmount || 0);
            } else {
                return sum + (t.amount || 0);
            }
        }, 0);
        
        const totalPaid = allTransactions.reduce((sum, t) => {
            if (t.source === 'payment' && t.status === 'paid') {
                return sum + (t.netAmount || 0);
            }
            return sum;
        }, 0);
        
        const balanceOwed = totalEarned - totalPaid;
        
        return {
            staff: staff,
            transactions: allTransactions,
            summary: {
                totalEarned: totalEarned,
                totalPaid: totalPaid,
                balanceOwed: balanceOwed,
                transactionCount: allTransactions.length
            }
        };
    } catch (error) {
        console.error('Failed to get staff payment history:', error);
        return null;
    }
}

async function viewStaffPaymentHistory(staffId) {
    currentStaffId = staffId;
    
    // Load and display statement
    await loadStaffPaymentHistory();
    
    // Open modal
    const modal = document.getElementById('staff-payment-history-modal');
    if (modal) modal.style.display = 'block';
}

function closeStaffPaymentHistory() {
    currentStaffId = null;
    currentStatementData = null;
    const modal = document.getElementById('staff-payment-history-modal');
    if (modal) modal.style.display = 'none';
}

async function loadStaffPaymentHistory() {
    if (!currentStaffId) return;
    
    // Get filter values
    const startDate = document.getElementById('staff-statement-start-date')?.value || '';
    const endDate = document.getElementById('staff-statement-end-date')?.value || '';
    const status = document.getElementById('staff-statement-status-filter')?.value || '';
    const type = document.getElementById('staff-statement-type-filter')?.value || '';
    
    const filters = { startDate, endDate, status, type };
    
    // Load data
    const data = await getStaffPaymentHistory(currentStaffId, filters);
    if (!data) {
        showNotification('Failed to load payment history', 'error');
        return;
    }
    
    currentStatementData = data;
    
    // Render statement header
    renderStatementHeader(data);
    
    // Render transactions
    renderStatementTransactions(data);
}

function renderStatementHeader(data) {
    const container = document.getElementById('statement-header');
    if (!container) return;
    
    const staff = data.staff;
    const summary = data.summary;
    
    const salaryInfo = staff.paymentType === 'monthly' ? `$${staff.monthlySalary}/month` : 
                      staff.paymentType === 'daily' ? `$${staff.dailyRate}/day` : 
                      `$${staff.hourlyRate}/hour`;
    
    container.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div>
                <h3 style="margin: 0 0 10px 0;">👤 ${staff.firstName} ${staff.lastName}</h3>
                <p style="margin: 5px 0;"><strong>Employee Code:</strong> ${staff.employeeCode}</p>
                <p style="margin: 5px 0;"><strong>Position:</strong> ${staff.position}</p>
                <p style="margin: 5px 0;"><strong>Payment Type:</strong> ${staff.paymentType.charAt(0).toUpperCase() + staff.paymentType.slice(1)}</p>
                <p style="margin: 5px 0;"><strong>Rate/Salary:</strong> ${salaryInfo}</p>
                ${staff.overtimeRate ? `<p style="margin: 5px 0;"><strong>Overtime Rate:</strong> $${staff.overtimeRate}/hour</p>` : ''}
            </div>
            <div style="background: ${summary.balanceOwed > 0 ? 'var(--danger-light)' : 'var(--success-light)'}; padding: 15px; border-radius: 8px;">
                <h3 style="margin: 0 0 10px 0;">💰 Payment Summary</h3>
                <p style="margin: 5px 0;"><strong>Total Earned:</strong> <span style="color: var(--primary-color);">$${summary.totalEarned.toFixed(2)}</span></p>
                <p style="margin: 5px 0;"><strong>Total Paid:</strong> <span style="color: var(--success-color);">$${summary.totalPaid.toFixed(2)}</span></p>
                <p style="margin: 10px 0 0 0; font-size: 1.2em;"><strong>Balance Owed:</strong> 
                    <span style="color: ${summary.balanceOwed > 0 ? 'var(--danger-color)' : 'var(--success-color)'}; font-weight: bold;">
                        $${summary.balanceOwed.toFixed(2)}
                    </span>
                </p>
                <p style="margin: 5px 0; font-size: 0.9em; color: var(--light-grey);">${summary.transactionCount} transaction(s)</p>
            </div>
        </div>
    `;
}

function renderStatementTransactions(data) {
    const tbody = document.getElementById('staff-statement-transactions');
    const emptyMessage = document.getElementById('staff-statement-empty');
    const tableContainer = document.getElementById('staff-statement-table-container');
    
    if (!tbody || !emptyMessage || !tableContainer) return;
    
    if (data.transactions.length === 0) {
        tableContainer.style.display = 'none';
        emptyMessage.style.display = 'block';
        return;
    }
    
    tableContainer.style.display = 'block';
    emptyMessage.style.display = 'none';
    
    const user = getCurrentUser ? getCurrentUser() : null;
    const isAdmin = user && user.role === 'admin';
    
    tbody.innerHTML = data.transactions.map(transaction => {
        let dateDisplay, typeDisplay, description, hoursDisplay, amountDisplay, statusDisplay, actionsDisplay;
        
        if (transaction.source === 'payment') {
            // Formal payment record
            dateDisplay = new Date(transaction.periodEnd).toLocaleDateString();
            typeDisplay = transaction.paymentType.charAt(0).toUpperCase() + transaction.paymentType.slice(1);
            description = transaction.paymentPeriod || 'Payment';
            if (transaction.notes) {
                description += `<br><small style="color: var(--light-grey);">${transaction.notes}</small>`;
            }
            hoursDisplay = '-';
            amountDisplay = `$${transaction.netAmount.toFixed(2)}`;
            
            const statusColors = {
                'pending': 'var(--warning-color)',
                'approved': 'var(--info-color)',
                'paid': 'var(--success-color)'
            };
            statusDisplay = `<span style="color: ${statusColors[transaction.status]}; font-weight: bold;">${transaction.status.toUpperCase()}</span>`;
            
            // Action buttons for unpaid transactions
            if (isAdmin && transaction.status === 'pending') {
                actionsDisplay = `<button onclick="approvePaymentInline(${transaction.id})" class="btn-success btn-sm">Approve</button>`;
            } else if (isAdmin && transaction.status === 'approved') {
                actionsDisplay = `<button onclick="markPaymentPaidInline(${transaction.id})" class="btn-primary btn-sm">Mark Paid</button>`;
            } else {
                actionsDisplay = '-';
            }
        } else {
            // Unpaid attendance
            dateDisplay = new Date(transaction.attendanceDate).toLocaleDateString();
            typeDisplay = 'Attendance';
            description = transaction.description;
            hoursDisplay = `${transaction.totalHours.toFixed(2)}h`;
            amountDisplay = `$${transaction.amount.toFixed(2)}`;
            statusDisplay = '<span style="color: var(--danger-color); font-weight: bold;">UNPAID</span>';
            
            if (isAdmin) {
                actionsDisplay = `<button onclick="markAttendancePaidInline(${currentStaffId}, '${transaction.attendanceDate}')" class="btn-primary btn-sm">Mark Paid</button>`;
            } else {
                actionsDisplay = '-';
            }
        }
        
        const balanceColor = transaction.runningBalance > 0 ? 'var(--danger-color)' : 'var(--success-color)';
        
        return `
            <tr>
                <td>${dateDisplay}</td>
                <td>${typeDisplay}</td>
                <td>${description}</td>
                <td>${hoursDisplay}</td>
                <td style="font-weight: bold;">${amountDisplay}</td>
                <td>${statusDisplay}</td>
                <td style="font-weight: bold; color: ${balanceColor};">$${transaction.runningBalance.toFixed(2)}</td>
                <td>${actionsDisplay}</td>
            </tr>
        `;
    }).join('');
}

function clearStaffStatementFilters() {
    document.getElementById('staff-statement-start-date').value = '';
    document.getElementById('staff-statement-end-date').value = '';
    document.getElementById('staff-statement-status-filter').value = '';
    document.getElementById('staff-statement-type-filter').value = '';
    loadStaffPaymentHistory();
}

// Inline payment actions with auto-refresh
async function approvePaymentInline(paymentId) {
    await approvePayment(paymentId);
    await loadStaffPaymentHistory(); // Refresh statement
}

async function markPaymentPaidInline(paymentId) {
    await markPaymentPaid(paymentId);
    await loadStaffPaymentHistory(); // Refresh statement
}

async function markAttendancePaidInline(staffId, date) {
    try {
        const user = getCurrentUser ? getCurrentUser() : null;
        if (!user || user.role !== 'admin') {
            showNotification('Only admins can mark attendance as paid', 'error');
            return;
        }
        
        await runExec(`
            UPDATE staff_attendance SET
                isPaid = 1
            WHERE staffId = ? AND attendanceDate = ?
        `, [staffId, date]);
        
        showNotification('Attendance marked as paid', 'success');
        await loadStaffPaymentHistory(); // Refresh statement
    } catch (error) {
        console.error('Failed to mark attendance as paid:', error);
        showNotification('Failed to mark attendance as paid', 'error');
    }
}

// ===================================
// SALARY REPORTS
// ===================================

async function generateSalaryReport(startDate, endDate) {
    try {
        const result = db.exec(`
            SELECT 
                s.employeeCode,
                s.firstName,
                s.lastName,
                s.position,
                p.paymentPeriod,
                p.baseAmount,
                p.overtimeAmount,
                p.bonusAmount,
                p.deductions,
                p.netAmount,
                p.status
            FROM staff_payments p
            JOIN staff s ON p.staffId = s.id
            WHERE p.periodStart >= ${new Date(startDate).getTime()}
            AND p.periodEnd <= ${new Date(endDate).getTime()}
            ORDER BY s.employeeCode, p.periodEnd
        `);
        
        if (!result || !result[0]) return [];
        
        const columns = result[0].columns;
        return result[0].values.map(row => {
            const record = {};
            columns.forEach((col, index) => {
                record[col] = row[index];
            });
            return record;
        });
    } catch (error) {
        console.error('Failed to generate salary report:', error);
        return [];
    }
}

// ===================================
// STAFF STATEMENT EXPORT FUNCTIONS
// ===================================

async function exportStaffStatementPDF() {
    if (!currentStatementData) {
        showNotification('No statement data to export', 'error');
        return;
    }
    
    try {
        const staff = currentStatementData.staff;
        const summary = currentStatementData.summary;
        const transactions = currentStatementData.transactions;
        
        // Prepare header info for subtitle
        const salaryInfo = staff.paymentType === 'monthly' ? `$${staff.monthlySalary}/month` : 
                          staff.paymentType === 'daily' ? `$${staff.dailyRate}/day` : 
                          `$${staff.hourlyRate}/hour`;
        
        const subtitle = `Employee: ${staff.firstName} ${staff.lastName} (${staff.employeeCode}) | Position: ${staff.position} | ${staff.paymentType.charAt(0).toUpperCase() + staff.paymentType.slice(1)}: ${salaryInfo}\n` +
                        `Total Earned: $${summary.totalEarned.toFixed(2)} | Total Paid: $${summary.totalPaid.toFixed(2)} | Balance Owed: $${summary.balanceOwed.toFixed(2)}`;
        
        // Prepare transaction data as array of objects
        const pdfData = transactions.map(t => {
            if (t.source === 'payment') {
                return {
                    date: new Date(t.periodEnd).toLocaleDateString(),
                    type: t.paymentType.charAt(0).toUpperCase() + t.paymentType.slice(1),
                    description: t.paymentPeriod || 'Payment',
                    hours: '-',
                    amount: `$${t.netAmount.toFixed(2)}`,
                    status: t.status.toUpperCase(),
                    balance: `$${t.runningBalance.toFixed(2)}`
                };
            } else {
                return {
                    date: new Date(t.attendanceDate).toLocaleDateString(),
                    type: 'Attendance',
                    description: `${t.totalHours.toFixed(2)}h work`,
                    hours: `${t.totalHours.toFixed(2)}h`,
                    amount: `$${t.amount.toFixed(2)}`,
                    status: 'UNPAID',
                    balance: `$${t.runningBalance.toFixed(2)}`
                };
            }
        });
        
        // Column definitions for PDF
        const pdfColumns = [
            {header: 'Date', dataKey: 'date'},
            {header: 'Type', dataKey: 'type'},
            {header: 'Description', dataKey: 'description'},
            {header: 'Hours', dataKey: 'hours'},
            {header: 'Amount', dataKey: 'amount'},
            {header: 'Status', dataKey: 'status'},
            {header: 'Balance', dataKey: 'balance'}
        ];
        
        const filename = `Staff_Statement_${staff.employeeCode}_${new Date().toISOString().split('T')[0]}`;
        const title = `Staff Payment Statement - ${staff.firstName} ${staff.lastName}`;
        
        await exportToPDF(pdfData, pdfColumns, title, filename, {
            subtitle: subtitle,
            orientation: 'landscape'
        });
        showNotification('Statement exported to PDF successfully', 'success');
    } catch (error) {
        console.error('Failed to export PDF:', error);
        showNotification('Failed to export PDF', 'error');
    }
}

async function exportStaffStatementExcel() {
    if (!currentStatementData) {
        showNotification('No statement data to export', 'error');
        return;
    }
    
    try {
        const staff = currentStatementData.staff;
        const summary = currentStatementData.summary;
        const transactions = currentStatementData.transactions;
        
        const salaryInfo = staff.paymentType === 'monthly' ? `$${staff.monthlySalary}/month` : 
                          staff.paymentType === 'daily' ? `$${staff.dailyRate}/day` : 
                          `$${staff.hourlyRate}/hour`;
        
        // Prepare data as objects for export-utils
        const exportData = transactions.map(t => {
            if (t.source === 'payment') {
                return {
                    date: new Date(t.periodEnd).toLocaleDateString(),
                    type: t.paymentType.charAt(0).toUpperCase() + t.paymentType.slice(1),
                    description: t.paymentPeriod || 'Payment',
                    hours: '-',
                    amount: t.netAmount.toFixed(2),
                    status: t.status.toUpperCase(),
                    balance: t.runningBalance.toFixed(2)
                };
            } else {
                return {
                    date: new Date(t.attendanceDate).toLocaleDateString(),
                    type: 'Attendance',
                    description: `${t.totalHours.toFixed(2)}h work`,
                    hours: t.totalHours.toFixed(2),
                    amount: t.amount.toFixed(2),
                    status: 'UNPAID',
                    balance: t.runningBalance.toFixed(2)
                };
            }
        });
        
        const columns = [
            { header: 'Date', key: 'date' },
            { header: 'Type', key: 'type' },
            { header: 'Description', key: 'description' },
            { header: 'Hours', key: 'hours' },
            { header: 'Amount', key: 'amount', type: 'currency' },
            { header: 'Status', key: 'status' },
            { header: 'Balance Owed', key: 'balance', type: 'currency' }
        ];
        
        await exportToExcel(exportData, columns, `Staff_${staff.employeeCode}`, `Staff ${staff.employeeCode}`);
        showNotification('Statement exported to Excel successfully', 'success');
    } catch (error) {
        console.error('Failed to export Excel:', error);
        showNotification('Failed to export Excel', 'error');
    }
}

async function exportStaffStatementCSV() {
    if (!currentStatementData) {
        showNotification('No statement data to export', 'error');
        return;
    }
    
    try {
        const staff = currentStatementData.staff;
        const summary = currentStatementData.summary;
        const transactions = currentStatementData.transactions;
        
        const salaryInfo = staff.paymentType === 'monthly' ? `$${staff.monthlySalary}/month` : 
                          staff.paymentType === 'daily' ? `$${staff.dailyRate}/day` : 
                          `$${staff.hourlyRate}/hour`;
        
        // Prepare data as objects for export-utils
        const exportData = transactions.map(t => {
            if (t.source === 'payment') {
                return {
                    date: new Date(t.periodEnd).toLocaleDateString(),
                    type: t.paymentType.charAt(0).toUpperCase() + t.paymentType.slice(1),
                    description: t.paymentPeriod || 'Payment',
                    hours: '-',
                    amount: t.netAmount.toFixed(2),
                    status: t.status.toUpperCase(),
                    balance: t.runningBalance.toFixed(2)
                };
            } else {
                return {
                    date: new Date(t.attendanceDate).toLocaleDateString(),
                    type: 'Attendance',
                    description: `${t.totalHours.toFixed(2)}h work`,
                    hours: t.totalHours.toFixed(2),
                    amount: t.amount.toFixed(2),
                    status: 'UNPAID',
                    balance: t.runningBalance.toFixed(2)
                };
            }
        });
        
        const columns = [
            { header: 'Date', key: 'date' },
            { header: 'Type', key: 'type' },
            { header: 'Description', key: 'description' },
            { header: 'Hours', key: 'hours' },
            { header: 'Amount', key: 'amount' },
            { header: 'Status', key: 'status' },
            { header: 'Balance Owed', key: 'balance' }
        ];
        
        await exportToCSV(exportData, columns, `Staff_Statement_${staff.employeeCode}_${new Date().toISOString().split('T')[0]}`);
        showNotification('Statement exported to CSV successfully', 'success');
    } catch (error) {
        console.error('Failed to export CSV:', error);
        showNotification('Failed to export CSV', 'error');
    }
}

// Export functions
window.openPayrollForm = openPayrollForm;
window.closePayrollForm = closePayrollForm;
window.calculatePayrollPreview = calculatePayrollPreview;
window.handlePayrollSubmit = handlePayrollSubmit;
window.openPaymentsManagement = openPaymentsManagement;
window.closePaymentsManagement = closePaymentsManagement;
window.approvePayment = approvePayment;
window.markPaymentPaid = markPaymentPaid;
window.markAttendancePaid = markAttendancePaid;
window.viewPaymentDetails = viewPaymentDetails;
window.viewStaffPaymentHistory = viewStaffPaymentHistory;
window.closeStaffPaymentHistory = closeStaffPaymentHistory;
window.loadStaffPaymentHistory = loadStaffPaymentHistory;
window.clearStaffStatementFilters = clearStaffStatementFilters;
window.approvePaymentInline = approvePaymentInline;
window.markPaymentPaidInline = markPaymentPaidInline;
window.markAttendancePaidInline = markAttendancePaidInline;
window.exportStaffStatementPDF = exportStaffStatementPDF;
window.exportStaffStatementExcel = exportStaffStatementExcel;
window.exportStaffStatementCSV = exportStaffStatementCSV;
