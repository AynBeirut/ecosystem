// ===================================
// AYN BEIRUT POS - ATTENDANCE MANAGEMENT
// Track employee attendance, hours, and approvals
// ===================================

// ===================================
// ATTENDANCE RECORDING
// ===================================

function openAttendanceForm(staffId) {
    const staff = staffList.find(s => s.id === staffId);
    if (!staff) {
        showNotification('Staff member not found', 'error');
        return;
    }
    
    // Pre-fill form with staff info
    document.getElementById('attendance-staff-id').value = staff.id;
    document.getElementById('attendance-staff-name').textContent = `${staff.firstName} ${staff.lastName}`;
    document.getElementById('attendance-date').valueAsDate = new Date();
    document.getElementById('attendance-check-in').value = '09:00';
    document.getElementById('attendance-check-out').value = '17:00';
    document.getElementById('attendance-status').value = 'present';
    
    // Calculate hours when times change
    const checkIn = document.getElementById('attendance-check-in');
    const checkOut = document.getElementById('attendance-check-out');
    
    checkIn.addEventListener('change', calculateAttendanceHours);
    checkOut.addEventListener('change', calculateAttendanceHours);
    
    calculateAttendanceHours();
    
    const modal = document.getElementById('attendance-form-modal');
    if (modal) modal.classList.add('show');
}

function calculateAttendanceHours() {
    const checkInTime = document.getElementById('attendance-check-in').value;
    const checkOutTime = document.getElementById('attendance-check-out').value;
    const status = document.getElementById('attendance-status').value;
    
    if (!checkInTime || !checkOutTime || status === 'absent' || status === 'holiday') {
        document.getElementById('attendance-total-hours').value = '0';
        document.getElementById('attendance-regular-hours').value = '0';
        document.getElementById('attendance-overtime-hours').value = '0';
        return;
    }
    
    const [inHour, inMin] = checkInTime.split(':').map(Number);
    const [outHour, outMin] = checkOutTime.split(':').map(Number);
    
    const totalMinutes = (outHour * 60 + outMin) - (inHour * 60 + inMin);
    const totalHours = Math.max(0, totalMinutes / 60);
    
    // Standard is 8 hours, anything beyond is overtime
    const regularHours = Math.min(8, totalHours);
    const overtimeHours = Math.max(0, totalHours - 8);
    
    document.getElementById('attendance-total-hours').value = totalHours.toFixed(2);
    document.getElementById('attendance-regular-hours').value = regularHours.toFixed(2);
    document.getElementById('attendance-overtime-hours').value = overtimeHours.toFixed(2);
}

async function handleAttendanceSubmit(e) {
    e.preventDefault();
    
    const user = getCurrentUser ? getCurrentUser() : null;
    const status = document.getElementById('attendance-status').value;
    
    const attendanceData = {
        staffId: parseInt(document.getElementById('attendance-staff-id').value),
        date: document.getElementById('attendance-date').value,
        checkInTime: status !== 'absent' && status !== 'holiday' ? document.getElementById('attendance-check-in').value : null,
        checkOutTime: status !== 'absent' && status !== 'holiday' ? document.getElementById('attendance-check-out').value : null,
        totalHours: parseFloat(document.getElementById('attendance-total-hours').value) || 0,
        regularHours: parseFloat(document.getElementById('attendance-regular-hours').value) || 0,
        overtimeHours: parseFloat(document.getElementById('attendance-overtime-hours').value) || 0,
        status: status,
        approvalStatus: user && user.role === 'manager' ? 'approved' : 'pending',
        approvedBy: user && user.role === 'manager' ? user.id : null,
        approvedAt: user && user.role === 'manager' ? Date.now() : null,
        notes: document.getElementById('attendance-notes').value.trim()
    };
    
    if (!attendanceData.date) {
        showNotification('Date is required', 'error');
        return;
    }
    
    const success = await saveAttendance(attendanceData);
    if (success) {
        closeAttendanceForm();
        renderStaffList();
    }
}

function closeAttendanceForm() {
    const modal = document.getElementById('attendance-form-modal');
    if (modal) modal.classList.remove('show');
}

// ===================================
// ATTENDANCE APPROVALS (MANAGER)
// ===================================

async function loadPendingAttendance() {
    try {
        const result = db.exec(`
            SELECT a.*, s.firstName, s.lastName, s.employeeCode
            FROM staff_attendance a
            JOIN staff s ON a.staffId = s.id
            WHERE a.approvalStatus = 'pending'
            ORDER BY a.attendanceDate DESC
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
        console.error('Failed to load pending attendance:', error);
        return [];
    }
}

async function approveAttendance(attendanceId) {
    try {
        const user = getCurrentUser ? getCurrentUser() : null;
        if (!user || user.role !== 'manager') {
            showNotification('Only managers can approve attendance', 'error');
            return;
        }
        
        await runExec(`
            UPDATE staff_attendance SET
                approvalStatus = 'approved',
                approvedBy = ?,
                approvedAt = ?
            WHERE id = ?
        `, [user.id, Date.now(), attendanceId]);
        
        await saveDatabase();
        showNotification('Attendance approved', 'success');
        renderPendingApprovals();
    } catch (error) {
        console.error('Failed to approve attendance:', error);
        showNotification('Failed to approve attendance', 'error');
    }
}

async function rejectAttendance(attendanceId, reason) {
    try {
        const user = getCurrentUser ? getCurrentUser() : null;
        if (!user || user.role !== 'manager') {
            showNotification('Only managers can reject attendance', 'error');
            return;
        }
        
        await runExec(`
            UPDATE staff_attendance SET
                approvalStatus = 'rejected',
                approvedBy = ?,
                approvedAt = ?,
                notes = ?
            WHERE id = ?
        `, [user.id, Date.now(), reason || 'Rejected by manager', attendanceId]);
        
        await saveDatabase();
        showNotification('Attendance rejected', 'success');
        renderPendingApprovals();
    } catch (error) {
        console.error('Failed to reject attendance:', error);
        showNotification('Failed to reject attendance', 'error');
    }
}

// ===================================
// ATTENDANCE REPORTS
// ===================================

async function generateAttendanceReport(staffId, startDate, endDate) {
    try {
        const result = db.exec(`
            SELECT a.*, s.firstName, s.lastName
            FROM staff_attendance a
            JOIN staff s ON a.staffId = s.id
            WHERE a.staffId = ${staffId}
            AND a.attendanceDate >= '${startDate}'
            AND a.attendanceDate <= '${endDate}'
            AND a.approvalStatus = 'approved'
            ORDER BY a.attendanceDate
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
        console.error('Failed to generate attendance report:', error);
        return [];
    }
}

// Export functions
window.openAttendanceForm = openAttendanceForm;
window.closeAttendanceForm = closeAttendanceForm;
window.handleAttendanceSubmit = handleAttendanceSubmit;
window.calculateAttendanceHours = calculateAttendanceHours;
window.approveAttendance = approveAttendance;
window.rejectAttendance = rejectAttendance;
