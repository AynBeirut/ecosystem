// ===================================
// AYN BEIRUT POS - STAFF MANAGEMENT
// Employee payroll and attendance tracking
// ===================================

let staffList = [];
let attendanceRecords = [];
let currentStaffMember = null;

// ===================================
// INITIALIZATION
// ===================================

async function initStaffManagement() {
    try {
        console.log('👥 Initializing staff management...');
        
        // Check access permissions
        const user = getCurrentUser ? getCurrentUser() : null;
        console.log('👥 Current user:', user);
        
        if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
            console.warn('⚠️ Access denied: Staff management requires admin or manager role');
            return;
        }
        
        // Load staff data
        staffList = await loadAllStaff();
        console.log('👥 Loaded staff list:', staffList.length, 'employees');
        
        // Setup UI event listeners with multiple retries to ensure DOM is ready
        let retries = 0;
        const maxRetries = 5;
        
        const trySetup = () => {
            const staffBtn = document.getElementById('staff-btn');
            console.log(`👥 Attempt ${retries + 1}: Staff button element:`, staffBtn);
            
            if (staffBtn) {
                setupStaffUI();
                console.log('✅ Staff button found and listener attached');
            } else if (retries < maxRetries) {
                retries++;
                console.warn(`⚠️ Staff button not found, retrying... (${retries}/${maxRetries})`);
                setTimeout(trySetup, 200);
            } else {
                console.error('❌ Staff button not found in DOM after all retries');
            }
        };
        
        setTimeout(trySetup, 100);
        
        // Recalculate salaries only if flag is set (one-time migration for performance)
        setTimeout(() => {
            const needsRecalculation = localStorage.getItem('salariesRecalculated') !== 'true';
            if (needsRecalculation) {
                console.log('🔧 First-time salary recalculation starting...');
                recalculateExistingSalaries().then(() => {
                    localStorage.setItem('salariesRecalculated', 'true');
                    console.log('✅ Salary recalculation complete - will not run on next startup');
                });
            } else {
                console.log('✅ Salary recalculation skipped (already completed)');
            }
        }, 2000);
        
        console.log(`✅ Staff management initialized with ${staffList.length} employees`);
    } catch (error) {
        console.error('❌ Failed to initialize staff management:', error);
    }
}

// ===================================
// DATABASE OPERATIONS
// ===================================

async function loadAllStaff() {
    try {
        const result = db.exec('SELECT * FROM staff ORDER BY firstName, lastName');
        if (!result || !result[0]) return [];
        
        const columns = result[0].columns;
        return result[0].values.map(row => {
            const staff = {};
            columns.forEach((col, index) => {
                staff[col] = row[index];
            });
            return staff;
        });
    } catch (error) {
        console.error('Failed to load staff:', error);
        return [];
    }
}

async function saveStaff(staffData) {
    try {
        console.log('💾 Saving staff member:', staffData);
        
        const timestamp = Date.now();
        
        if (staffData.id) {
            // Update existing
            await runExec(`
                UPDATE staff SET
                    firstName = ?,
                    lastName = ?,
                    phone = ?,
                    email = ?,
                    position = ?,
                    department = ?,
                    paymentType = ?,
                    monthlySalary = ?,
                    dailyRate = ?,
                    hourlyRate = ?,
                    overtimeRate = ?,
                    bankAccount = ?,
                    nationalId = ?,
                    address = ?,
                    emergencyContact = ?,
                    emergencyPhone = ?,
                    updatedAt = ?,
                    notes = ?
                WHERE id = ?
            `, [
                staffData.firstName,
                staffData.lastName,
                staffData.phone || null,
                staffData.email || null,
                staffData.position,
                staffData.department || null,
                staffData.paymentType,
                staffData.monthlySalary || 0,
                staffData.dailyRate || 0,
                staffData.hourlyRate || 0,
                staffData.overtimeRate || 0,
                staffData.bankAccount || null,
                staffData.nationalId || null,
                staffData.address || null,
                staffData.emergencyContact || null,
                staffData.emergencyPhone || null,
                timestamp,
                staffData.notes || null,
                staffData.id
            ]);
        } else {
            // Insert new
            const employeeCode = await generateEmployeeCode();
            await runExec(`
                INSERT INTO staff (
                    employeeCode, firstName, lastName, phone, email,
                    position, department, hireDate, paymentType,
                    monthlySalary, dailyRate, hourlyRate, overtimeRate,
                    bankAccount, nationalId, address, emergencyContact,
                    emergencyPhone, isActive, createdAt, updatedAt, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                employeeCode,
                staffData.firstName,
                staffData.lastName,
                staffData.phone || null,
                staffData.email || null,
                staffData.position,
                staffData.department || null,
                timestamp,
                staffData.paymentType,
                staffData.monthlySalary || 0,
                staffData.dailyRate || 0,
                staffData.hourlyRate || 0,
                staffData.overtimeRate || 0,
                staffData.bankAccount || null,
                staffData.nationalId || null,
                staffData.address || null,
                staffData.emergencyContact || null,
                staffData.emergencyPhone || null,
                1, // isActive
                timestamp,
                timestamp,
                staffData.notes || null
            ]);
        }
        
        await saveDatabase();
        staffList = await loadAllStaff();
        
        showNotification(staffData.id ? 'Staff member updated successfully' : 'Staff member added successfully', 'success');
        return true;
    } catch (error) {
        console.error('Failed to save staff:', error);
        showNotification('Failed to save staff member: ' + error.message, 'error');
        return false;
    }
}

async function generateEmployeeCode() {
    const result = db.exec('SELECT COUNT(*) as count FROM staff');
    const count = result[0]?.values[0]?.[0] || 0;
    return `EMP${String(count + 1).padStart(4, '0')}`;
}

async function saveAttendance(attendanceData) {
    try {
        console.log('📅 Saving attendance:', attendanceData);
        
        const timestamp = Date.now();
        
        // Check for existing attendance on this date (without shiftNumber for backward compatibility)
        const existing = db.exec(`
            SELECT id FROM staff_attendance 
            WHERE staffId = ${attendanceData.staffId} 
            AND attendanceDate = '${attendanceData.date}'
        `);
        
        let existingShiftId = null;
        
        if (existing && existing[0] && existing[0].values.length > 0) {
            // If we have a specific shift ID to update (from edit form)
            if (attendanceData.id) {
                existingShiftId = attendanceData.id;
            } else if (attendanceData.updateExisting) {
                // Update the first existing record
                existingShiftId = existing[0].values[0][0];
            }
        }
        
        if (existingShiftId || attendanceData.updateExisting) {
            // Update existing shift
            const updateId = existingShiftId || existing[0].values[0][0];
            
            // Check if transportFee column exists
            const tableInfo = db.exec(`PRAGMA table_info(staff_attendance)`);
            const columns = tableInfo[0]?.values.map(row => row[1]) || [];
            const hasTransportFee = columns.includes('transportFee');
            
            let updateQuery = `
                UPDATE staff_attendance SET
                    checkInTime = ?,
                    checkOutTime = ?,
                    totalHours = ?,
                    regularHours = ?,
                    overtimeHours = ?,
                    status = ?,
                    approvalStatus = ?,
                    approvedBy = ?,
                    approvedAt = ?,
                    notes = ?`;
            
            let updateValues = [
                attendanceData.checkInTime || null,
                attendanceData.checkOutTime || null,
                attendanceData.totalHours || 0,
                attendanceData.regularHours || 0,
                attendanceData.overtimeHours || 0,
                attendanceData.status,
                attendanceData.approvalStatus || 'approved',
                attendanceData.approvedBy || null,
                attendanceData.approvedAt || timestamp,
                attendanceData.notes || null
            ];
            
            if (hasTransportFee) {
                updateQuery += `, transportFee = ?`;
                updateValues.push(attendanceData.transportFee || 0);
            }
            
            updateQuery += `, updatedAt = ? WHERE id = ?`;
            updateValues.push(timestamp, updateId);
            
            await runExec(updateQuery, updateValues);
        } else {
            // Insert new shift - check if createdAt/updatedAt/transportFee columns exist (backward compatibility)
            let insertQuery = `
                INSERT INTO staff_attendance (
                    staffId, attendanceDate, checkInTime, checkOutTime,
                    totalHours, regularHours, overtimeHours, status,
                    approvalStatus, approvedBy, approvedAt, notes`;
            
            let insertValues = [
                attendanceData.staffId,
                attendanceData.date,
                attendanceData.checkInTime || null,
                attendanceData.checkOutTime || null,
                attendanceData.totalHours || 0,
                attendanceData.regularHours || 0,
                attendanceData.overtimeHours || 0,
                attendanceData.status,
                attendanceData.approvalStatus || 'approved',
                attendanceData.approvedBy || null,
                attendanceData.approvedAt || timestamp,
                attendanceData.notes || null
            ];
            
            // Check if transportFee/createdAt/updatedAt columns exist
            try {
                const tableInfo = db.exec(`PRAGMA table_info(staff_attendance)`);
                const columns = tableInfo[0]?.values.map(row => row[1]) || [];
                const hasTimestamps = columns.includes('createdAt') && columns.includes('updatedAt');
                const hasTransportFee = columns.includes('transportFee');
                
                if (hasTransportFee) {
                    insertQuery += `, transportFee`;
                    insertValues.push(attendanceData.transportFee || 0);
                }
                
                if (hasTimestamps) {
                    insertQuery += `, createdAt, updatedAt`;
                    insertValues.push(timestamp, timestamp);
                }
                
                insertQuery += `) VALUES (${insertValues.map(() => '?').join(', ')})`;
            } catch (e) {
                // If PRAGMA fails, assume no extra columns
                insertQuery += `) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            }
            
            await runExec(insertQuery, insertValues);
        }
        
        await saveDatabase();
        showNotification('Attendance recorded successfully', 'success');
        return true;
    } catch (error) {
        console.error('Failed to save attendance:', error);
        showNotification('Failed to save attendance: ' + error.message, 'error');
        return false;
    }
}

// ===================================
// SALARY CALCULATIONS
// ===================================

function calculateHourlyRate(staff) {
    // Convert any salary type to hourly rate for calculations
    switch (staff.paymentType) {
        case 'monthly':
            return staff.monthlySalary / 160; // Assume 160 hours/month
        case 'daily':
            return staff.dailyRate / 8; // Assume 8 hours/day
        case 'hourly':
            return staff.hourlyRate;
        default:
            return 0;
    }
}

async function calculateSalaryForPeriod(staffId, periodStart, periodEnd) {
    try {
        console.log('💰 Calculating salary for staff', staffId, 'from', periodStart, 'to', periodEnd);
        
        const staff = staffList.find(s => s.id === staffId);
        if (!staff) throw new Error('Staff member not found');
        
        console.log('💰 Staff member:', staff.firstName, staff.lastName, '- Payment type:', staff.paymentType);
        
        // Get attendance for period - removed approvalStatus requirement
        const attendanceResult = runQuery(`
            SELECT 
                COALESCE(SUM(totalHours), 0) as totalHours, 
                COALESCE(SUM(overtimeHours), 0) as overtimeHours
            FROM staff_attendance
            WHERE staffId = ${staffId}
            AND attendanceDate >= '${periodStart}'
            AND attendanceDate <= '${periodEnd}'
            AND status != 'absent'
        `);
        
        console.log('💰 Attendance result:', attendanceResult);
        const totalHours = attendanceResult.length > 0 ? (parseFloat(attendanceResult[0].totalHours) || 0) : 0;
        const overtimeHours = attendanceResult.length > 0 ? (parseFloat(attendanceResult[0].overtimeHours) || 0) : 0;
        const regularHours = totalHours - overtimeHours;
        
        console.log('💰 Hours found - Total:', totalHours, 'Regular:', regularHours, 'Overtime:', overtimeHours);
        
        let baseAmount = 0;
        let overtimeAmount = 0;
        
        switch (staff.paymentType) {
            case 'monthly':
                // Fixed monthly salary regardless of hours
                baseAmount = parseFloat(staff.monthlySalary) || 0;
                overtimeAmount = overtimeHours * (parseFloat(staff.overtimeRate) || 0);
                console.log('💰 Monthly: Base=', baseAmount, 'OT=', overtimeAmount);
                break;
            case 'daily':
                // Count working days - removed approvalStatus requirement
                const daysResult = runQuery(`
                    SELECT COUNT(*) as days
                    FROM staff_attendance
                    WHERE staffId = ${staffId}
                    AND attendanceDate >= '${periodStart}'
                    AND attendanceDate <= '${periodEnd}'
                    AND status NOT IN ('absent', 'holiday')
                `);
                const workingDays = daysResult.length > 0 ? (parseFloat(daysResult[0].days) || 0) : 0;
                baseAmount = workingDays * (parseFloat(staff.dailyRate) || 0);
                overtimeAmount = overtimeHours * (parseFloat(staff.overtimeRate) || 0);
                console.log('💰 Daily: Days=', workingDays, 'Rate=', staff.dailyRate, 'Base=', baseAmount, 'OT=', overtimeAmount);
                break;
            case 'hourly':
                const hourlyRate = parseFloat(staff.hourlyRate) || 0;
                const otRate = parseFloat(staff.overtimeRate) || (hourlyRate * 1.5);
                baseAmount = regularHours * hourlyRate;
                overtimeAmount = overtimeHours * otRate;
                console.log('💰 Hourly: Rate=', hourlyRate, 'OT Rate=', otRate, 'Base=', baseAmount, 'OT=', overtimeAmount);
                break;
        }
        
        const totalAmount = baseAmount + overtimeAmount;
        console.log('💰 Final calculation - Base:', baseAmount, 'OT:', overtimeAmount, 'Total:', totalAmount);
        
        return {
            baseAmount,
            overtimeAmount,
            totalAmount,
            hours: { total: totalHours, regular: regularHours, overtime: overtimeHours }
        };
    } catch (error) {
        console.error('Failed to calculate salary:', error);
        return { baseAmount: 0, overtimeAmount: 0, totalAmount: 0, hours: { total: 0, regular: 0, overtime: 0 } };
    }
}

async function generatePayroll(staffId, periodStart, periodEnd, bonus = 0, deductions = 0) {
    try {
        const user = getCurrentUser ? getCurrentUser() : null;
        const salary = await calculateSalaryForPeriod(staffId, periodStart, periodEnd);
        
        const totalAmount = salary.totalAmount + bonus - deductions;
        
        await runExec(`
            INSERT INTO staff_payments (
                staffId, paymentType, paymentPeriod, periodStart, periodEnd,
                baseAmount, overtimeAmount, bonusAmount, deductions, netAmount,
                status, approvalRequired, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            staffId,
            'salary',
            `${periodStart} to ${periodEnd}`,
            new Date(periodStart).getTime(),
            new Date(periodEnd).getTime(),
            salary.baseAmount,
            salary.overtimeAmount,
            bonus,
            deductions,
            totalAmount,
            'pending',
            1,
            `Calculated: ${salary.hours.total} total hours (${salary.hours.regular} regular + ${salary.hours.overtime} OT)`
        ]);
        
        await saveDatabase();
        showNotification('Payroll generated successfully', 'success');
        return true;
    } catch (error) {
        console.error('Failed to generate payroll:', error);
        showNotification('Failed to generate payroll: ' + error.message, 'error');
        return false;
    }
}

// ===================================
// RECALCULATE EXISTING SALARIES
// ===================================

async function recalculateExistingSalaries() {
    try {
        console.log('🔄 Recalculating ALL existing salary records (BATCH MODE)...');
        
        // Get all salary payments (not just $0 ones - recalculate everything)
        const salaries = runQuery(`
            SELECT id, staffId, periodStart, periodEnd, bonusAmount, deductions, netAmount
            FROM staff_payments
            WHERE paymentType = 'salary'
        `);
        
        console.log(`📊 Found ${salaries.length} salary records to recalculate`);
        
        for (const salary of salaries) {
            // Convert timestamps back to date strings for calculation
            const periodStart = new Date(salary.periodStart).toISOString().split('T')[0];
            const periodEnd = new Date(salary.periodEnd).toISOString().split('T')[0];
            
            console.log(`💰 Recalculating salary ID ${salary.id} for staff ${salary.staffId}`);
            
            // Recalculate using the fixed function
            const calculated = await calculateSalaryForPeriod(salary.staffId, periodStart, periodEnd);
            const newNetAmount = calculated.totalAmount + (salary.bonusAmount || 0) - (salary.deductions || 0);
            
            console.log(`   Old: $${(salary.netAmount || 0).toFixed(2)}, New: $${newNetAmount.toFixed(2)}`);
            
            // Use db.run() directly instead of runExec() to avoid auto-save on each update
            // This batches all updates and saves once at the end (11x performance improvement)
            db.run(`
                UPDATE staff_payments
                SET baseAmount = ?, overtimeAmount = ?, netAmount = ?,
                    notes = ?
                WHERE id = ?
            `, [
                calculated.baseAmount,
                calculated.overtimeAmount,
                newNetAmount,
                `Recalculated: ${calculated.hours.total} total hours (${calculated.hours.regular} regular + ${calculated.hours.overtime} OT)`,
                salary.id
            ]);
            console.log(`   ✅ Updated salary ID ${salary.id} from $${(salary.netAmount || 0).toFixed(2)} to $${newNetAmount.toFixed(2)}`);
        }
        
        // Save database ONCE after all updates (instead of 11+ times)
        await saveDatabase();
        console.log('✅ All salary records recalculated (BATCH MODE - saved once)');
        return true;
    } catch (error) {
        console.error('Failed to recalculate salaries:', error);
        return false;
    }
}

// ===================================
// UI FUNCTIONS
// ===================================

function setupStaffUI() {
    console.log('👥 setupStaffUI() called');
    
    const staffBtn = document.getElementById('staff-btn');
    if (!staffBtn) {
        console.error('❌ Staff button element not found in setupStaffUI');
        return;
    }
    
    console.log('👥 Staff button found:', staffBtn);
    console.log('👥 Staff button visible:', staffBtn.offsetParent !== null);
    console.log('👥 Staff button display:', window.getComputedStyle(staffBtn).display);
    
    // Use simple onclick handler
    staffBtn.onclick = function(e) {
        console.log('%c STAFF BUTTON CLICKED! ', 'background: green; color: white; font-size: 20px; padding: 10px;');
        console.log('👥👥👥 Opening Staff Management 👥👥👥');
        e.preventDefault();
        e.stopPropagation();
        openStaffManagement();
        return false;
    };
    
    // Test the handler immediately
    console.log('👥 Testing if onclick is set:', typeof staffBtn.onclick);
    console.log('✅ Staff button click handler attached');
    
    // Setup other UI elements
    const addStaffBtn = document.getElementById('add-staff-btn');
    if (addStaffBtn) {
        addStaffBtn.onclick = () => openStaffForm();
        console.log('✅ Add staff button listener attached');
    }
    
    const staffForm = document.getElementById('staff-form');
    if (staffForm) {
        staffForm.onsubmit = handleStaffSubmit;
        console.log('✅ Staff form submit handler attached');
    }
    
    console.log('%c ALL STAFF UI SETUP COMPLETE ', 'background: green; color: white; font-size: 16px; padding: 10px;');
}

function openStaffManagement() {
    console.log('👥 Opening staff management modal...');
    const modal = document.getElementById('staff-modal');
    if (modal) {
        modal.style.display = 'block';
        renderStaffList();
        renderPendingApprovals();
        loadAttendanceSummary();
        
        // Restore last view state (list or attendance)
        const lastView = localStorage.getItem('staff-last-view');
        console.log('📋 Restoring last view:', lastView);
        
        if (lastView === 'attendance') {
            // Restore attendance view with last date
            setTimeout(() => {
                openDailyAttendance();
            }, 100); // Small delay to ensure DOM is ready
        }
        
        console.log('✅ Staff management modal opened');
    } else {
        console.error('❌ staff-modal element not found');
    }
}

function closeStaffManagement() {
    console.log('👥 Closing staff management modal...');
    const modal = document.getElementById('staff-modal');
    if (modal) {
        modal.style.display = 'none';
        console.log('✅ Staff management modal closed');
    }
}

function openStaffForm(staff = null) {
    currentStaffMember = staff;
    const form = document.getElementById('staff-form');
    const modal = document.getElementById('staff-form-modal');
    
    if (staff) {
        // Edit mode
        document.getElementById('staff-id').value = staff.id;
        document.getElementById('staff-first-name').value = staff.firstName;
        document.getElementById('staff-last-name').value = staff.lastName;
        document.getElementById('staff-phone').value = staff.phone || '';
        document.getElementById('staff-email').value = staff.email || '';
        document.getElementById('staff-position').value = staff.position;
        document.getElementById('staff-payment-type').value = staff.paymentType;
        document.getElementById('staff-monthly-salary').value = staff.monthlySalary || '';
        document.getElementById('staff-daily-rate').value = staff.dailyRate || '';
        document.getElementById('staff-hourly-rate').value = staff.hourlyRate || '';
        document.getElementById('staff-overtime-rate').value = staff.overtimeRate || '';
        document.getElementById('staff-notes').value = staff.notes || '';
        
        document.getElementById('staff-form-title').textContent = 'Edit Staff Member';
        document.getElementById('staff-submit-btn').textContent = 'Update Staff';
    } else {
        // Add mode
        form.reset();
        document.getElementById('staff-form-title').textContent = 'Add New Staff Member';
        document.getElementById('staff-submit-btn').textContent = 'Add Staff';
    }
    
    updateSalaryFields();
    if (modal) modal.style.display = 'block';
}

function updateSalaryFields() {
    const paymentType = document.getElementById('staff-payment-type').value;
    document.getElementById('monthly-salary-group').style.display = paymentType === 'monthly' ? 'block' : 'none';
    document.getElementById('daily-rate-group').style.display = paymentType === 'daily' ? 'block' : 'none';
    document.getElementById('hourly-rate-group').style.display = paymentType === 'hourly' ? 'block' : 'none';
}

async function handleStaffSubmit(e) {
    e.preventDefault();
    
    const staffData = {
        id: document.getElementById('staff-id').value || null,
        firstName: document.getElementById('staff-first-name').value.trim(),
        lastName: document.getElementById('staff-last-name').value.trim(),
        phone: document.getElementById('staff-phone').value.trim(),
        email: document.getElementById('staff-email').value.trim(),
        position: document.getElementById('staff-position').value,
        paymentType: document.getElementById('staff-payment-type').value,
        monthlySalary: parseFloat(document.getElementById('staff-monthly-salary').value) || 0,
        dailyRate: parseFloat(document.getElementById('staff-daily-rate').value) || 0,
        hourlyRate: parseFloat(document.getElementById('staff-hourly-rate').value) || 0,
        overtimeRate: parseFloat(document.getElementById('staff-overtime-rate').value) || 0,
        notes: document.getElementById('staff-notes').value.trim()
    };
    
    if (!staffData.firstName || !staffData.lastName) {
        showNotification('First name and last name are required', 'error');
        return;
    }
    
    const success = await saveStaff(staffData);
    if (success) {
        closeStaffForm();
        renderStaffList();
    }
}

function closeStaffForm() {
    const modal = document.getElementById('staff-form-modal');
    if (modal) modal.style.display = 'none';
    currentStaffMember = null;
}

async function cleanupDuplicateStaff() {
    if (!confirm('This will remove duplicate staff entries (keeping the one with attendance data or the first one). Continue?')) {
        return;
    }
    
    try {
        const activeStaff = staffList.filter(s => s.isActive);
        
        // Group staff by name (case-insensitive)
        const nameGroups = {};
        activeStaff.forEach(staff => {
            const nameKey = `${staff.firstName}_${staff.lastName}`.toLowerCase().trim();
            if (!nameGroups[nameKey]) {
                nameGroups[nameKey] = [];
            }
            nameGroups[nameKey].push(staff);
        });
        
        // Find duplicates and select which to keep
        let deletedCount = 0;
        for (const [nameKey, group] of Object.entries(nameGroups)) {
            if (group.length > 1) {
                console.log(`Found ${group.length} duplicates for: ${nameKey}`);
                
                // Check which ones have attendance records
                const attendanceQuery = `SELECT DISTINCT staffId FROM staff_attendance`;
                const result = db.exec(attendanceQuery);
                const staffIdsWithAttendance = new Set();
                if (result && result[0]) {
                    result[0].values.forEach(row => staffIdsWithAttendance.add(row[0]));
                }
                
                // Sort: prioritize those with attendance, then by ID (older first)
                group.sort((a, b) => {
                    const aHasAttendance = staffIdsWithAttendance.has(a.id);
                    const bHasAttendance = staffIdsWithAttendance.has(b.id);
                    if (aHasAttendance && !bHasAttendance) return -1;
                    if (!aHasAttendance && bHasAttendance) return 1;
                    return a.id - b.id; // Keep the older one
                });
                
                // Keep the first, delete the rest
                const toKeep = group[0];
                const toDelete = group.slice(1);
                
                console.log(`Keeping: ${toKeep.firstName} ${toKeep.lastName} (ID: ${toKeep.id}, Code: ${toKeep.employeeCode})`);
                
                for (const staff of toDelete) {
                    console.log(`Deleting: ${staff.firstName} ${staff.lastName} (ID: ${staff.id}, Code: ${staff.employeeCode})`);
                    const stmt = db.prepare('DELETE FROM staff WHERE id = ?');
                    stmt.run([staff.id]);
                    stmt.free();
                    deletedCount++;
                }
            }
        }
        
        await saveDatabase();
        await loadAllStaff();
        renderStaffList();
        
        showNotification(`Removed ${deletedCount} duplicate staff entries`, 'success');
    } catch (error) {
        console.error('Error cleaning up duplicates:', error);
        showNotification('Failed to clean up duplicates', 'error');
    }
}

async function deleteStaff(staffId) {
    const staff = staffList.find(s => s.id === staffId);
    if (!staff) return;
    
    const confirmed = confirm(`Are you sure you want to delete ${staff.firstName} ${staff.lastName}?\n\nThis action cannot be undone.`);
    if (!confirmed) return;
    
    try {
        // Instead of deleting, mark as inactive (soft delete)
        const stmt = db.prepare('UPDATE staff SET isActive = 0 WHERE id = ?');
        stmt.run([staffId]);
        stmt.free();
        
        // Save database
        saveDatabase();
        
        showNotification('Staff member removed successfully', 'success');
        await loadAllStaff();
        renderStaffList();
    } catch (error) {
        console.error('Error deleting staff:', error);
        showNotification('Failed to remove staff member', 'error');
    }
}

function renderStaffList() {
    const container = document.getElementById('staff-list');
    if (!container) return;
    
    if (staffList.length === 0) {
        container.innerHTML = '<div class="empty-state">No staff members found. Click "Add New Staff" to get started.</div>';
        return;
    }
    
    const activeStaff = staffList.filter(s => s.isActive);
    
    // Detect duplicates by name
    const nameCount = {};
    activeStaff.forEach(staff => {
        const nameKey = `${staff.firstName}_${staff.lastName}`.toLowerCase().trim();
        nameCount[nameKey] = (nameCount[nameKey] || 0) + 1;
    });
    const hasDuplicates = Object.values(nameCount).some(count => count > 1);
    
    // Use table layout matching user management
    let html = `
        <div class="table-responsive">
            ${hasDuplicates ? `<div style="background: #fff3cd; padding: 15px; margin-bottom: 15px; border-radius: 6px; border-left: 4px solid #ffc107; color: #000;">
                <span style="font-size: 18px;">⚠️</span> <strong style="color: #000;">Duplicate staff detected!</strong> You have staff members with the same name. 
                <button onclick="cleanupDuplicateStaff()" onmouseover="this.style.background='#c82333'" onmouseout="this.style.background='#dc3545'" style="background: #dc3545; color: #fff; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin-left: 10px; font-weight: bold; font-size: 14px;">🧹 Clean Up Duplicates</button>
            </div>` : ''}
            <table class="users-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Employee Code</th>
                        <th>Position</th>
                        <th>Payment Type</th>
                        <th>Rate/Salary</th>
                        <th>Total Owed</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    activeStaff.forEach(staff => {
        const nameKey = `${staff.firstName}_${staff.lastName}`.toLowerCase().trim();
        const isDuplicate = nameCount[nameKey] > 1;
        const salaryDisplay = staff.paymentType === 'monthly' ? `$${staff.monthlySalary}/month` : 
                             staff.paymentType === 'daily' ? `$${staff.dailyRate}/day` : 
                             `$${staff.hourlyRate}/hour`;
        
        const statusBadge = staff.isActive ? 
            '<span class="badge badge-success">ACTIVE</span>' : 
            '<span class="badge badge-danger">INACTIVE</span>';
        
        // Calculate total owed (will be populated by async function)
        const owedCellId = `staff-owed-${staff.id}`;
        
        const rowStyle = isDuplicate ? 'background-color: #fff3cd;' : '';
        
        html += `
            <tr style="${rowStyle}">
                <td>${isDuplicate ? '⚠️ ' : ''}${staff.firstName} ${staff.lastName}</td>
                <td>${staff.employeeCode}</td>
                <td>${staff.position}</td>
                <td>${staff.paymentType.charAt(0).toUpperCase() + staff.paymentType.slice(1)}</td>
                <td>${salaryDisplay}</td>
                <td id="${owedCellId}" style="font-weight: bold; color: var(--danger-color);">
                    <span style="opacity: 0.5;">Loading...</span>
                </td>
                <td>${statusBadge}</td>
                <td class="actions-cell">
                    <button onclick="viewStaffPaymentHistory(${staff.id})" class="btn-icon" title="Payment History">
                        📊
                    </button>
                    <button onclick="openAttendanceForm(${staff.id})" class="btn-icon" title="Register Attendance (Check-in/Check-out)" style="background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);">
                        ⏰
                    </button>
                    <button onclick="viewStaffAttendanceHistory(${staff.id})" class="btn-icon" title="View Attendance History & Edit Last Record">
                        📅
                    </button>
                    <button onclick="openPayrollForm(${staff.id})" class="btn-icon" title="Generate Payroll">
                        💰
                    </button>
                    <button onclick="openStaffForm(staffList.find(s => s.id === ${staff.id}))" class="btn-icon" title="Edit Staff">
                        ✏️
                    </button>
                    <button onclick="deleteStaff(${staff.id})" class="btn-icon btn-danger" title="Delete Staff">
                        🗑️
                    </button>
                </td>
            </tr>
        `;
        
        // Calculate total owed asynchronously
        calculateStaffTotalOwed(staff.id).then(totalOwed => {
            const cell = document.getElementById(owedCellId);
            if (cell) {
                if (totalOwed > 0) {
                    cell.innerHTML = `<span style="color: var(--danger-color);">$${totalOwed.toFixed(2)}</span>`;
                } else {
                    cell.innerHTML = `<span style="color: var(--success-color);">$0.00</span>`;
                }
            }
        });
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = html;
}

function renderPendingApprovals() {
    // TODO: Implement pending attendance approvals list
    console.log('📋 Rendering pending approvals...');
}

function loadAttendanceSummary() {
    // TODO: Implement attendance summary for current period
    console.log('📊 Loading attendance summary...');
}

// ===================================
// DAILY ATTENDANCE OVERVIEW
// ===================================

function openDailyAttendance() {
    console.log('📅 Opening daily attendance overview...');
    const section = document.getElementById('daily-attendance-section');
    const staffListSection = document.getElementById('staff-list');
    
    if (section && staffListSection) {
        // Show attendance view
        section.style.display = 'block';
        staffListSection.style.display = 'none';
        
        // Save view state
        localStorage.setItem('staff-last-view', 'attendance');
        
        // Restore last selected date or use today's date
        const savedDate = localStorage.getItem('staff-attendance-date');
        const today = new Date().toISOString().split('T')[0];
        const dateToUse = savedDate || today;
        document.getElementById('attendance-overview-date').value = dateToUse;
        
        loadDailyAttendance();
    }
}

function closeDailyAttendance() {
    const section = document.getElementById('daily-attendance-section');
    const staffListSection = document.getElementById('staff-list');
    
    if (section && staffListSection) {
        section.style.display = 'none';
        staffListSection.style.display = 'block';
        
        // Save view state
        localStorage.setItem('staff-last-view', 'list');
    }
}

async function loadDailyAttendance() {
    const dateInput = document.getElementById('attendance-overview-date');
    const selectedDate = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
    
    // Save selected date to localStorage for persistence
    localStorage.setItem('staff-attendance-date', selectedDate);
    
    console.log('📅 Loading attendance for date:', selectedDate);
    
    try {
        // Load staff directly from database to ensure we have current data
        const activeStaff = await loadAllStaff();
        const activeStaffFiltered = activeStaff.filter(s => s.isActive);
        
        console.log('📅 Found', activeStaffFiltered.length, 'active staff members');
        
        if (activeStaffFiltered.length === 0) {
            const container = document.getElementById('daily-attendance-list');
            if (container) {
                container.innerHTML = '<div class="empty-state">No staff members found. Please add staff first by clicking "← Back to Staff List" then "➕ Add New Staff".</div>';
            }
            return;
        }
        
        // Get attendance records for the selected date
        const attendanceQuery = `
            SELECT * FROM staff_attendance 
            WHERE attendanceDate = '${selectedDate}'
        `;
        
        const result = db.exec(attendanceQuery);
        const attendanceRecords = [];
        
        if (result && result[0]) {
            const columns = result[0].columns;
            result[0].values.forEach(row => {
                const record = {};
                columns.forEach((col, index) => {
                    record[col] = row[index];
                });
                attendanceRecords.push(record);
            });
        }
        
        console.log('📅 Found', attendanceRecords.length, 'attendance records');
        
        const renderedList = renderDailyAttendanceList(activeStaffFiltered, attendanceRecords, selectedDate);
        
        // Filter attendance records to only include unique staff members
        const uniqueStaffIds = new Set(renderedList.uniqueStaff.map(s => s.id));
        const filteredAttendanceRecords = attendanceRecords.filter(r => uniqueStaffIds.has(r.staffId));
        
        renderAttendanceSummary(renderedList.uniqueStaff, filteredAttendanceRecords);
        
    } catch (error) {
        console.error('Failed to load daily attendance:', error);
        showNotification('Failed to load attendance data', 'error');
    }
}

function renderDailyAttendanceList(staff, attendanceRecords, selectedDate) {
    const container = document.getElementById('daily-attendance-list');
    if (!container) return;
    
    if (staff.length === 0) {
        container.innerHTML = '<div class="empty-state">No staff members found. Please add staff first.</div>';
        return;
    }
    
    // Remove duplicates by name (case-insensitive), keeping the one with attendance records
    const uniqueStaff = [];
    const seenNames = new Map(); // Map name -> staff object
    
    staff.forEach(member => {
        const nameKey = `${member.firstName}_${member.lastName}`.toLowerCase().trim();
        
        if (!seenNames.has(nameKey)) {
            seenNames.set(nameKey, member);
        } else {
            // If duplicate, prefer the one with attendance records
            const existing = seenNames.get(nameKey);
            const existingHasAttendance = attendanceRecords.some(r => r.staffId === existing.id);
            const currentHasAttendance = attendanceRecords.some(r => r.staffId === member.id);
            
            if (currentHasAttendance && !existingHasAttendance) {
                // Replace with the one that has attendance
                seenNames.set(nameKey, member);
            }
        }
    });
    
    uniqueStaff.push(...seenNames.values());
    
    console.log('📅 Total staff:', staff.length, 'Unique staff:', uniqueStaff.length);
    
    container.innerHTML = uniqueStaff.map(member => {
        // Get ALL shifts for this staff member on this date
        const memberShifts = attendanceRecords.filter(r => r.staffId === member.id);
        
        // Check if there's an open shift
        const openShift = memberShifts.find(s => s.checkInTime && !s.checkOutTime);
        
        // Calculate total hours across all shifts
        const totalHours = memberShifts.reduce((sum, shift) => sum + (parseFloat(shift.totalHours) || 0), 0);
        
        // Calculate earnings based on total hours
        let earnings = 0;
        if (totalHours > 0) {
            if (member.paymentType === 'hourly') {
                earnings = totalHours * (parseFloat(member.hourlyRate) || 0);
            } else if (member.paymentType === 'daily') {
                earnings = parseFloat(member.dailyRate) || 0;
            } else if (member.paymentType === 'monthly') {
                earnings = (parseFloat(member.monthlySalary) || 0) / 22;
            }
        }
        
        // Determine UI state
        const hasShifts = memberShifts.length > 0;
        const hasCompletedShifts = memberShifts.some(s => s.checkOutTime);
        const shiftCount = memberShifts.length;
        
        // Build shift details HTML
        let shiftsHtml = '';
        if (hasShifts && hasCompletedShifts) {
            shiftsHtml = memberShifts
                .filter(s => s.checkOutTime)  // Only show completed shifts
                .map(shift => {
                    const checkIn = shift.checkInTime ? shift.checkInTime.substring(0, 5) : '';
                    const checkOut = shift.checkOutTime ? shift.checkOutTime.substring(0, 5) : '';
                    const hours = (parseFloat(shift.totalHours) || 0).toFixed(2);
                    return `<div style="font-size: 0.85em; color: var(--text-secondary);">Shift ${shift.shiftNumber || 1}: ${checkIn}-${checkOut} (${hours}h)</div>`;
                }).join('');
        }
        
        return `
            <div class="simple-attendance-row" data-staff-id="${member.id}">
                <div class="staff-info-simple">
                    <div class="staff-name-simple">${member.firstName} ${member.lastName}</div>
                    <div class="staff-position-simple">${member.position} • ${member.paymentType === 'hourly' ? '$'+member.hourlyRate+'/hr' : member.paymentType === 'daily' ? '$'+member.dailyRate+'/day' : '$'+member.monthlySalary+'/mo'}</div>
                    ${shiftsHtml}
                </div>
                <div class="attendance-status-simple">
                    ${!hasShifts || (!openShift && hasCompletedShifts) ? `
                        <button onclick="quickCheckInSimple(${member.id}, '${selectedDate}')" class="btn-check-in" title="${hasCompletedShifts ? 'Start New Shift' : 'Check In'}">
                            ${hasCompletedShifts ? '➕ New Shift' : '✓ Check In'}
                        </button>
                        ${hasCompletedShifts ? `
                            <div class="status-badge completed">✓ ${shiftCount} Shift${shiftCount > 1 ? 's' : ''}</div>
                            <div class="time-info">Total: ${totalHours.toFixed(2)}h</div>
                            <div class="earnings-info">$${earnings.toFixed(2)}</div>
                        ` : ''}
                    ` : openShift ? `
                        <div class="status-badge checked-in">⏱️ Working (Shift ${openShift.shiftNumber || shiftCount})</div>
                        <div class="time-info">In: ${openShift.checkInTime.substring(0, 5)}</div>
                        <button onclick="quickCheckOut(${member.id}, '${selectedDate}')" class="btn-check-out" title="Check Out">
                            ⏱️ Check Out
                        </button>
                        ${hasCompletedShifts ? `<div style="font-size: 0.85em; margin-top: 5px;">Previous: ${(totalHours - (parseFloat(openShift.totalHours) || 0)).toFixed(2)}h</div>` : ''}
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    // Return the unique staff list for summary calculations
    return { uniqueStaff };
}

function renderAttendanceSummary(staff, attendanceRecords) {
    const container = document.getElementById('attendance-summary');
    if (!container) return;
    
    console.log('📊 Rendering summary for:', staff.length, 'staff members');
    console.log('📊 Attendance records:', attendanceRecords.length);
    console.log('📊 Record statuses:', attendanceRecords.map(r => r.status));
    
    const total = staff.length;
    // Handle both uppercase and lowercase status values
    const present = attendanceRecords.filter(r => r.status && r.status.toLowerCase() === 'present').length;
    const late = attendanceRecords.filter(r => r.status && r.status.toLowerCase() === 'late').length;
    const absent = attendanceRecords.filter(r => r.status && r.status.toLowerCase() === 'absent').length;
    const onLeave = attendanceRecords.filter(r => r.status && (r.status.toLowerCase() === 'on-leave' || r.status.toLowerCase() === 'leave')).length;
    const notRecorded = total - attendanceRecords.length;
    
    const totalHours = attendanceRecords.reduce((sum, r) => sum + (parseFloat(r.totalHours) || 0), 0);
    const avgHours = attendanceRecords.length > 0 ? (totalHours / attendanceRecords.length).toFixed(2) : '0.00';
    
    // Calculate total earnings for the day
    let totalEarnings = 0;
    attendanceRecords.forEach(record => {
        const member = staff.find(s => s.id === record.staffId);
        if (member && parseFloat(record.totalHours) > 0) {
            if (member.paymentType === 'hourly') {
                const regularRate = parseFloat(member.hourlyRate) || 0;
                const overtimeRate = parseFloat(member.overtimeRate) || regularRate * 1.5;
                const regularHours = Math.min(parseFloat(record.totalHours), 8);
                const overtimeHours = Math.max(0, parseFloat(record.totalHours) - 8);
                totalEarnings += (regularHours * regularRate) + (overtimeHours * overtimeRate);
            } else if (member.paymentType === 'daily') {
                totalEarnings += parseFloat(member.dailyRate) || 0;
            } else if (member.paymentType === 'monthly') {
                totalEarnings += (parseFloat(member.monthlySalary) || 0) / 22;
            }
        }
    });
    
    console.log('📊 Summary counts - Total:', total, 'Present:', present, 'Late:', late, 'Absent:', absent, 'Leave:', onLeave, 'Not Recorded:', notRecorded);
    console.log('💰 Total Earnings:', totalEarnings.toFixed(2));
    
    container.innerHTML = `
        <div class="summary-grid">
            <div class="summary-card">
                <div class="summary-label">Total Staff</div>
                <div class="summary-value">${total}</div>
            </div>
            <div class="summary-card summary-present">
                <div class="summary-label">Present</div>
                <div class="summary-value">${present}</div>
            </div>
            <div class="summary-card summary-late">
                <div class="summary-label">Late</div>
                <div class="summary-value">${late}</div>
            </div>
            <div class="summary-card summary-absent">
                <div class="summary-label">Absent</div>
                <div class="summary-value">${absent}</div>
            </div>
            <div class="summary-card summary-leave">
                <div class="summary-label">On Leave</div>
                <div class="summary-value">${onLeave}</div>
            </div>
            <div class="summary-card summary-pending">
                <div class="summary-label">Not Recorded</div>
                <div class="summary-value">${notRecorded}</div>
            </div>
            <div class="summary-card">
                <div class="summary-label">Total Hours</div>
                <div class="summary-value">${totalHours.toFixed(2)}h</div>
            </div>
            <div class="summary-card">
                <div class="summary-label">Avg Hours</div>
                <div class="summary-value">${avgHours}h</div>
            </div>
            <div class="summary-card summary-earnings">
                <div class="summary-label">💰 Total Earnings</div>
                <div class="summary-value">$${totalEarnings.toFixed(2)}</div>
            </div>
        </div>
    `;
}

async function quickCheckIn(staffId, date) {
    const staff = staffList.find(s => s.id === staffId);
    if (!staff) {
        showNotification('Staff member not found', 'error');
        return;
    }
    
    const now = new Date();
    const currentTime = now.toTimeString().substring(0, 5); // HH:MM format
    
    const attendanceData = {
        staffId: staffId,
        date: date,
        status: 'present',
        checkInTime: currentTime,
        checkOutTime: null,
        totalHours: 0,
        regularHours: 0,
        overtimeHours: 0,
        notes: 'Quick check-in'
    };
    
    const success = await saveAttendance(attendanceData);
    if (success) {
        showNotification(`${staff.firstName} ${staff.lastName} checked in at ${currentTime}`, 'success');
        loadDailyAttendance(); // Refresh the list
    }
}

async function quickCheckInSimple(staffId, date) {
    const staff = staffList.find(s => s.id === staffId);
    if (!staff) {
        showNotification('Staff member not found', 'error');
        return;
    }
    
    // Check for existing shifts that are NOT checked out
    try {
        const openShiftQuery = `
            SELECT id, shiftNumber FROM staff_attendance 
            WHERE staffId = ${staffId} 
            AND attendanceDate = '${date}'
            AND checkOutTime IS NULL
            ORDER BY shiftNumber DESC
            LIMIT 1
        `;
        
        const openShift = db.exec(openShiftQuery);
        
        if (openShift && openShift[0] && openShift[0].values.length > 0) {
            showNotification(`${staff.firstName} already has an open shift. Please check out first.`, 'warning');
            return;
        }
    } catch (e) {
        // Column doesn't exist yet, add it
        if (e.message.includes('no such column')) {
            console.log('⚠️ shiftNumber column missing, adding it now...');
            try {
                db.exec('ALTER TABLE staff_attendance ADD COLUMN shiftNumber INTEGER DEFAULT 1');
                db.exec('ALTER TABLE staff_attendance ADD COLUMN createdAt INTEGER');
                db.exec('ALTER TABLE staff_attendance ADD COLUMN updatedAt INTEGER');
                db.exec('UPDATE staff_attendance SET shiftNumber = 1 WHERE shiftNumber IS NULL');
                await saveDatabase();
                console.log('✅ Multi-shift columns added successfully');
                showNotification('Database updated for multi-shift support', 'success');
            } catch (addError) {
                console.error('Failed to add columns:', addError);
            }
        }
    }
    
    const now = new Date();
    const currentTime = now.toTimeString().substring(0, 8); // HH:MM:SS format
    
    const attendanceData = {
        staffId: staffId,
        date: date,
        status: 'present',
        checkInTime: currentTime,
        checkOutTime: null,
        totalHours: 0,
        regularHours: 0,
        overtimeHours: 0,
        notes: 'Check in'
    };
    
    const success = await saveAttendance(attendanceData);
    if (success) {
        showNotification(`✓ ${staff.firstName} checked in`, 'success');
        loadDailyAttendance();
    }
}

async function quickCheckOut(staffId, date) {
    const staff = staffList.find(s => s.id === staffId);
    if (!staff) {
        showNotification('Staff member not found', 'error');
        return;
    }
    
    // Get the OPEN shift (not checked out yet)
    try {
        const query = `
            SELECT * FROM staff_attendance 
            WHERE staffId = ${staffId} 
            AND attendanceDate = '${date}'
            AND checkOutTime IS NULL
            ORDER BY shiftNumber DESC
            LIMIT 1
        `;
        
        const result = db.exec(query);
        
        if (!result || !result[0] || result[0].values.length === 0) {
            showNotification('No open shift found', 'error');
            return;
        }
        
        const columns = result[0].columns;
        const row = result[0].values[0];
        const attendance = {};
        columns.forEach((col, index) => {
            attendance[col] = row[index];
        });
        
        if (attendance.checkOutTime) {
            showNotification('Already checked out', 'warning');
            return;
        }
        
        // Calculate hours worked
        const now = new Date();
        const currentTime = now.toTimeString().substring(0, 8); // HH:MM:SS format
        
        const checkInParts = attendance.checkInTime.split(':');
        const checkOutParts = currentTime.split(':');
        
        const checkInMinutes = parseInt(checkInParts[0]) * 60 + parseInt(checkInParts[1]);
        const checkOutMinutes = parseInt(checkOutParts[0]) * 60 + parseInt(checkOutParts[1]);
        
        let totalMinutes = checkOutMinutes - checkInMinutes;
        if (totalMinutes < 0) totalMinutes += 24 * 60;
        
        const totalHours = totalMinutes / 60;
        const regularHours = Math.min(totalHours, 8);
        const overtimeHours = Math.max(0, totalHours - 8);
        
        // Update attendance with shift ID
        const attendanceData = {
            id: attendance.id,  // Important: Update this specific shift
            staffId: staffId,
            date: date,
            status: 'present',
            checkInTime: attendance.checkInTime,
            checkOutTime: currentTime,
            totalHours: totalHours,
            regularHours: regularHours,
            overtimeHours: overtimeHours,
            notes: attendance.notes || 'Check out',
            updateExisting: true
        };
        
        const success = await saveAttendance(attendanceData);
        if (success) {
            showNotification(`✓ ${staff.firstName} checked out - ${totalHours.toFixed(2)} hours worked`, 'success');
            loadDailyAttendance();
        }
        
    } catch (error) {
        console.error('Check out error:', error);
        showNotification('Failed to check out', 'error');
    }
}

function openAttendanceForm(staffId, date = null) {
    const staff = staffList.find(s => s.id === staffId);
    if (!staff) {
        showNotification('Staff member not found', 'error');
        return;
    }
    
    const modal = document.getElementById('attendance-form-modal');
    const form = document.getElementById('attendance-form');
    
    if (!modal || !form) {
        console.error('Attendance form modal not found');
        return;
    }
    
    // Set staff info
    document.getElementById('attendance-staff-id').value = staffId;
    document.getElementById('attendance-staff-name').textContent = `${staff.firstName} ${staff.lastName} - ${staff.position}`;
    
    // Set date (today by default or provided date)
    const attendanceDate = date || new Date().toISOString().split('T')[0];
    document.getElementById('attendance-date').value = attendanceDate;
    
    // Try to load existing attendance for this date
    loadExistingAttendance(staffId, attendanceDate);
    
    modal.style.display = 'block';
}

async function loadExistingAttendance(staffId, date) {
    try {
        const query = `
            SELECT * FROM staff_attendance 
            WHERE staffId = ${staffId} AND attendanceDate = '${date}'
        `;
        
        const result = db.exec(query);
        
        if (result && result[0] && result[0].values.length > 0) {
            const columns = result[0].columns;
            const row = result[0].values[0];
            const attendance = {};
            columns.forEach((col, index) => {
                attendance[col] = row[index];
            });
            
            // Fill form with existing data
            document.getElementById('attendance-status').value = attendance.status || 'present';
            document.getElementById('attendance-check-in').value = attendance.checkInTime || '';
            document.getElementById('attendance-check-out').value = attendance.checkOutTime || '';
            document.getElementById('attendance-total-hours').value = attendance.totalHours || 0;
            document.getElementById('attendance-regular-hours').value = attendance.regularHours || 0;
            document.getElementById('attendance-overtime-hours').value = attendance.overtimeHours || 0;
            document.getElementById('attendance-notes').value = attendance.notes || '';
        } else {
            // Clear form for new entry
            document.getElementById('attendance-form').reset();
            document.getElementById('attendance-staff-id').value = staffId;
            document.getElementById('attendance-date').value = date;
        }
    } catch (error) {
        console.error('Failed to load existing attendance:', error);
    }
}

function closeAttendanceForm() {
    const modal = document.getElementById('attendance-form-modal');
    if (modal) modal.style.display = 'none';
}

async function handleAttendanceSubmit(event) {
    event.preventDefault();
    
    const attendanceData = {
        staffId: parseInt(document.getElementById('attendance-staff-id').value),
        date: document.getElementById('attendance-date').value,
        status: document.getElementById('attendance-status').value,
        checkInTime: document.getElementById('attendance-check-in').value || null,
        checkOutTime: document.getElementById('attendance-check-out').value || null,
        totalHours: parseFloat(document.getElementById('attendance-total-hours').value) || 0,
        regularHours: parseFloat(document.getElementById('attendance-regular-hours').value) || 0,
        overtimeHours: parseFloat(document.getElementById('attendance-overtime-hours').value) || 0,
        transportFee: parseFloat(document.getElementById('attendance-transport-fee')?.value) || 0,
        notes: document.getElementById('attendance-notes').value.trim()
    };
    
    const success = await saveAttendance(attendanceData);
    if (success) {
        closeAttendanceForm();
        // Refresh daily attendance if that view is open
        const dailySection = document.getElementById('daily-attendance-section');
        if (dailySection && dailySection.style.display !== 'none') {
            loadDailyAttendance();
        }
    }
}

function calculateAttendanceHours() {
    const status = document.getElementById('attendance-status').value;
    const checkIn = document.getElementById('attendance-check-in').value;
    const checkOut = document.getElementById('attendance-check-out').value;
    
    if (status !== 'present' && status !== 'late') {
        document.getElementById('attendance-total-hours').value = 0;
        document.getElementById('attendance-regular-hours').value = 0;
        document.getElementById('attendance-overtime-hours').value = 0;
        return;
    }
    
    if (!checkIn || !checkOut) return;
    
    // Parse times
    const [inHour, inMin] = checkIn.split(':').map(Number);
    const [outHour, outMin] = checkOut.split(':').map(Number);
    
    const inMinutes = inHour * 60 + inMin;
    const outMinutes = outHour * 60 + outMin;
    
    let totalMinutes = outMinutes - inMinutes;
    if (totalMinutes < 0) totalMinutes += 24 * 60; // Handle overnight shifts
    
    const totalHours = totalMinutes / 60;
    const regularHours = Math.min(totalHours, 8); // 8 hours is regular
    const overtimeHours = Math.max(0, totalHours - 8);
    
    document.getElementById('attendance-total-hours').value = totalHours.toFixed(2);
    document.getElementById('attendance-regular-hours').value = regularHours.toFixed(2);
    document.getElementById('attendance-overtime-hours').value = overtimeHours.toFixed(2);
}

// Calculate total owed to a staff member (pending/approved payments + unpaid attendance)
async function calculateStaffTotalOwed(staffId) {
    try {
        let totalOwed = 0;
        
        // 1. Get pending and approved payments from staff_payments table
        const paymentsResult = db.exec(`
            SELECT COALESCE(SUM(netAmount), 0) as owed
            FROM staff_payments
            WHERE staffId = ${staffId} AND status IN ('pending', 'approved')
        `);
        
        if (paymentsResult && paymentsResult[0]) {
            totalOwed += paymentsResult[0].values[0][0] || 0;
        }
        
        // 2. Calculate unpaid attendance earnings
        const staff = staffList.find(s => s.id === staffId);
        if (staff) {
            const attendanceResult = db.exec(`
                SELECT 
                    SUM(totalHours) as totalHours,
                    SUM(regularHours) as regularHours,
                    SUM(overtimeHours) as overtimeHours
                FROM staff_attendance
                WHERE staffId = ${staffId}
                AND status = 'present'
                AND checkOutTime IS NOT NULL
                AND (isPaid IS NULL OR isPaid = 0)
            `);
            
            if (attendanceResult && attendanceResult[0] && attendanceResult[0].values.length > 0) {
                const totalHours = attendanceResult[0].values[0][0] || 0;
                const regularHours = attendanceResult[0].values[0][1] || 0;
                const overtimeHours = attendanceResult[0].values[0][2] || 0;
                
                if (totalHours > 0) {
                    let unpaidAmount = 0;
                    
                    if (staff.paymentType === 'monthly') {
                        const hourlyRate = (parseFloat(staff.monthlySalary) || 0) / 160;
                        unpaidAmount = regularHours * hourlyRate + overtimeHours * (parseFloat(staff.overtimeRate) || hourlyRate * 1.5);
                    } else if (staff.paymentType === 'daily') {
                        const hourlyRate = (parseFloat(staff.dailyRate) || 0) / 8;
                        unpaidAmount = regularHours * hourlyRate + overtimeHours * (parseFloat(staff.overtimeRate) || hourlyRate * 1.5);
                    } else if (staff.paymentType === 'hourly') {
                        const hourlyRate = parseFloat(staff.hourlyRate) || 0;
                        unpaidAmount = regularHours * hourlyRate + overtimeHours * (parseFloat(staff.overtimeRate) || hourlyRate * 1.5);
                    }
                    
                    totalOwed += unpaidAmount;
                }
            }
        }
        
        return totalOwed;
    } catch (error) {
        console.error('Failed to calculate total owed:', error);
        return 0;
    }
}

// Export functions for global access
window.initStaffManagement = initStaffManagement;
window.openStaffManagement = openStaffManagement;
window.closeStaffManagement = closeStaffManagement;
window.openStaffForm = openStaffForm;
window.closeStaffForm = closeStaffForm;
window.updateSalaryFields = updateSalaryFields;
window.openDailyAttendance = openDailyAttendance;
window.closeDailyAttendance = closeDailyAttendance;
window.loadDailyAttendance = loadDailyAttendance;
window.quickCheckIn = quickCheckIn;
window.quickCheckInSimple = quickCheckInSimple;
window.quickCheckOut = quickCheckOut;
window.openAttendanceForm = openAttendanceForm;
window.closeAttendanceForm = closeAttendanceForm;
window.handleAttendanceSubmit = handleAttendanceSubmit;
window.calculateAttendanceHours = calculateAttendanceHours;
window.calculateStaffTotalOwed = calculateStaffTotalOwed;

// Add manual test function
window.testStaffButton = function() {
    console.log('=== TESTING STAFF BUTTON ===');
    const btn = document.getElementById('staff-btn');
    console.log('Button exists:', !!btn);
    console.log('Button element:', btn);
    console.log('Button onclick:', btn ? btn.onclick : 'no button');
    console.log('Button visible:', btn ? btn.offsetParent !== null : 'no button');
    console.log('Button display:', btn ? window.getComputedStyle(btn).display : 'no button');
    if (btn) {
        console.log('Manually triggering click...');
        btn.click();
    }
};

console.log('%c testStaffButton() function is available! Call it from console. ', 'background: blue; color: white; padding: 10px;');

// ===================================
// ATTENDANCE HISTORY & CORRECTION
// ===================================

/**
 * View staff attendance history with edit/delete options for last record
 */
async function viewStaffAttendanceHistory(staffId) {
    try {
        const staff = staffList.find(s => s.id === staffId);
        if (!staff) {
            showNotification('❌ Staff member not found', 'error');
            return;
        }
        
        console.log('📅 Loading attendance history for:', staff.firstName, staff.lastName);
        
        // Get all attendance records for this staff member (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysAgoDate = thirtyDaysAgo.toISOString().split('T')[0]; // Format: YYYY-MM-DD
        
        const attendanceRecords = runQuery(`
            SELECT * FROM staff_attendance 
            WHERE staffId = ? AND attendanceDate >= ?
            ORDER BY id DESC
        `, [staffId, thirtyDaysAgoDate]);
        
        console.log('📅 Found', attendanceRecords.length, 'attendance records');
        
        // Create modal HTML
        const modalHTML = `
            <div class="modal" id="attendance-history-modal" style="display: block;">
                <div class="modal-content" style="max-width: 900px;">
                    <div class="modal-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                        <h2 style="margin: 0; font-size: 20px;">📅 Attendance History</h2>
                        <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">${staff.firstName} ${staff.lastName} (${staff.employeeCode})</p>
                        <button class="close-btn" onclick="closeAttendanceHistoryModal()" style="position: absolute; top: 20px; right: 20px; background: rgba(255,255,255,0.2); color: white; border: none; font-size: 24px; cursor: pointer; width: 32px; height: 32px; border-radius: 50%; line-height: 1;">&times;</button>
                    </div>
                    <div class="modal-body" style="max-height: 500px; overflow-y: auto; padding: 20px;">
                        ${attendanceRecords.length === 0 ? `
                            <div style="text-align: center; padding: 60px 20px; color: #666;">
                                <p style="font-size: 64px; margin-bottom: 16px; opacity: 0.3;">📅</p>
                                <p style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">No Attendance Records</p>
                                <p style="font-size: 14px; color: #999;">No records found in the last 30 days</p>
                            </div>
                        ` : `
                            <div style="margin-bottom: 16px; padding: 12px; background: #f0f9ff; border-left: 4px solid #3b82f6; border-radius: 4px;">
                                <p style="margin: 0; font-size: 13px; color: #1e40af;">
                                    <strong>Note:</strong> You can only edit or delete the most recent attendance record to prevent fraud.
                                </p>
                            </div>
                            <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                                <thead>
                                    <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
                                        <th style="padding: 14px 12px; text-align: left; font-weight: 600; font-size: 12px; color: #6b7280; text-transform: uppercase;">Date</th>
                                        <th style="padding: 14px 12px; text-align: left; font-weight: 600; font-size: 12px; color: #6b7280; text-transform: uppercase;">Check In</th>
                                        <th style="padding: 14px 12px; text-align: left; font-weight: 600; font-size: 12px; color: #6b7280; text-transform: uppercase;">Check Out</th>
                                        <th style="padding: 14px 12px; text-align: left; font-weight: 600; font-size: 12px; color: #6b7280; text-transform: uppercase;">Hours</th>
                                        <th style="padding: 14px 12px; text-align: left; font-weight: 600; font-size: 12px; color: #6b7280; text-transform: uppercase;">Status</th>
                                        <th style="padding: 14px 12px; text-align: center; font-weight: 600; font-size: 12px; color: #6b7280; text-transform: uppercase;">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${attendanceRecords.map((record, index) => {
                                        // Use attendanceDate directly (YYYY-MM-DD format)
                                        const date = new Date(record.attendanceDate + 'T00:00:00');
                                        const dateStr = date.toLocaleDateString('en-US', { 
                                            month: 'short', 
                                            day: 'numeric', 
                                            year: 'numeric' 
                                        });
                                        
                                        const checkInTime = new Date(record.checkInTime);
                                        const checkInStr = checkInTime.toLocaleTimeString('en-US', { 
                                            hour: '2-digit', 
                                            minute: '2-digit' 
                                        });
                                        
                                        let checkOutStr = '-';
                                        let hoursWorked = '-';
                                        let statusBadge = '<span style="background: #fef3c7; color: #92400e; padding: 5px 12px; border-radius: 12px; font-size: 11px; font-weight: 600;">⏰ ACTIVE</span>';
                                        
                                        if (record.checkOutTime) {
                                            const checkOutTime = new Date(record.checkOutTime);
                                            checkOutStr = checkOutTime.toLocaleTimeString('en-US', { 
                                                hour: '2-digit', 
                                                minute: '2-digit' 
                                            });
                                            
                                            const hours = ((record.checkOutTime - record.checkInTime) / (1000 * 60 * 60)).toFixed(2);
                                            hoursWorked = `${hours}h`;
                                            statusBadge = '<span style="background: #d1fae5; color: #065f46; padding: 5px 12px; border-radius: 12px; font-size: 11px; font-weight: 600;">✅ COMPLETE</span>';
                                        }
                                        
                                        // Only show edit/delete for the most recent record
                                        const isLatest = index === 0;
                                        const rowBg = isLatest ? '#fefce8' : 'white';
                                        
                                        return `
                                            <tr style="border-bottom: 1px solid #f3f4f6; background: ${rowBg};">
                                                <td style="padding: 14px 12px; font-size: 13px; color: #374151;">${dateStr}</td>
                                                <td style="padding: 14px 12px; font-size: 13px; color: #374151; font-weight: 500;">${checkInStr}</td>
                                                <td style="padding: 14px 12px; font-size: 13px; color: #374151; font-weight: 500;">${checkOutStr}</td>
                                                <td style="padding: 14px 12px; font-weight: 600; font-size: 13px; color: #1f2937;">${hoursWorked}</td>
                                                <td style="padding: 14px 12px;">${statusBadge}</td>
                                                <td style="padding: 12px; text-align: center;">
                                                    ${isLatest ? `
                                                        <button 
                                                            data-record-id="${record.id}"
                                                            data-checkin="${record.checkInTime}"
                                                            data-checkout="${record.checkOutTime || ''}"
                                                            onclick="editAttendanceFromButton(this)" 
                                                            class="btn-icon" 
                                                            title="Edit Last Attendance"
                                                            style="background: #3b82f6; color: white; padding: 6px 10px; border: none; border-radius: 4px; cursor: pointer; margin-right: 4px; font-size: 11px;">
                                                            ✏️ 
                                                        </button>
                                                        <button 
                                                            data-record-id="${record.id}"
                                                            data-staff-id="${staffId}"
                                                            onclick="deleteAttendanceFromButton(this)" 
                                                            class="btn-icon" 
                                                            title="Delete Last Attendance"
                                                            style="background: #ef4444; color: white; padding: 6px 10px; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">
                                                            🗑️
                                                        </button>
                                                    ` : `
                                                        <span style="color: #9ca3af; font-size: 11px;">-</span>
                                                    `}
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        `}
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal if any
        const existingModal = document.getElementById('attendance-history-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
    } catch (error) {
        console.error('❌ Error loading attendance history:', error);
        showNotification('❌ Failed to load attendance history', 'error');
    }
}

/**
 * Close attendance history modal
 */
function closeAttendanceHistoryModal() {
    const modal = document.getElementById('attendance-history-modal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Edit attendance record (only for last record)
 */
async function editAttendanceFromButton(button) {
    const recordId = parseInt(button.getAttribute('data-record-id'));
    const checkInTime = parseInt(button.getAttribute('data-checkin'));
    const checkOutTimeStr = button.getAttribute('data-checkout');
    const checkOutTime = checkOutTimeStr ? parseInt(checkOutTimeStr) : null;
    
    await editAttendanceRecord(recordId, checkInTime, checkOutTime);
}

/**
 * Delete attendance record (only for last record)
 */
async function deleteAttendanceFromButton(button) {
    const recordId = parseInt(button.getAttribute('data-record-id'));
    const staffId = parseInt(button.getAttribute('data-staff-id'));
    
    await deleteAttendanceRecord(recordId, staffId);
}

/**
 * Edit attendance record (only for last record)
 */
async function editAttendanceRecord(recordId, checkInTime, checkOutTime) {
    try {
        const checkInDate = new Date(checkInTime);
        const checkInStr = checkInDate.toISOString().slice(0, 16); // Format: YYYY-MM-DDTHH:MM
        
        let checkOutStr = '';
        if (checkOutTime) {
            const checkOutDate = new Date(checkOutTime);
            checkOutStr = checkOutDate.toISOString().slice(0, 16);
        }
        
        // Create edit modal
        const modalHTML = `
            <div class="modal" id="edit-attendance-modal" style="display: block;">
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header" style="background: #3b82f6; color: white;">
                        <h2 style="margin: 0;">✏️ Edit Attendance Record</h2>
                        <button class="close-btn" onclick="closeEditAttendanceModal()" style="background: rgba(255,255,255,0.2); color: white; border: none; font-size: 24px; cursor: pointer; float: right;">&times;</button>
                    </div>
                    <div class="modal-body" style="padding: 24px;">
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">
                                Check-In Time
                            </label>
                            <input 
                                type="datetime-local" 
                                id="edit-checkin-time" 
                                value="${checkInStr}"
                                style="width: 100%; padding: 10px; border: 2px solid #e5e7eb; border-radius: 6px; font-size: 14px;"
                            />
                            <p style="margin: 4px 0 0 0; font-size: 12px; color: #6b7280;">
                                Current: ${checkInDate.toLocaleString()}
                            </p>
                        </div>
                        
                        ${checkOutTime ? `
                            <div style="margin-bottom: 20px;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">
                                    Check-Out Time
                                </label>
                                <input 
                                    type="datetime-local" 
                                    id="edit-checkout-time" 
                                    value="${checkOutStr}"
                                    style="width: 100%; padding: 10px; border: 2px solid #e5e7eb; border-radius: 6px; font-size: 14px;"
                                />
                                <p style="margin: 4px 0 0 0; font-size: 12px; color: #6b7280;">
                                    Current: ${new Date(checkOutTime).toLocaleString()}
                                </p>
                            </div>
                        ` : ''}
                        
                        <div style="display: flex; gap: 12px; margin-top: 24px;">
                            <button 
                                onclick="saveAttendanceEdit(${recordId}, ${checkOutTime ? 'true' : 'false'})"
                                style="flex: 1; padding: 12px; background: #10b981; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 14px;">
                                ✅ Save Changes
                            </button>
                            <button 
                                onclick="closeEditAttendanceModal()"
                                style="flex: 1; padding: 12px; background: #6b7280; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 14px;">
                                ❌ Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal if any
        const existingModal = document.getElementById('edit-attendance-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
    } catch (error) {
        console.error('❌ Error opening edit modal:', error);
        showNotification('❌ Failed to open edit form', 'error');
    }
}

/**
 * Close edit attendance modal
 */
function closeEditAttendanceModal() {
    const modal = document.getElementById('edit-attendance-modal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Save attendance edit
 */
async function saveAttendanceEdit(recordId, hasCheckOut) {
    try {
        const checkInInput = document.getElementById('edit-checkin-time');
        const newCheckInTime = new Date(checkInInput.value).getTime();
        
        if (isNaN(newCheckInTime)) {
            showNotification('❌ Invalid check-in time', 'error');
            return;
        }
        
        let newCheckOutTime = null;
        if (hasCheckOut) {
            const checkOutInput = document.getElementById('edit-checkout-time');
            newCheckOutTime = new Date(checkOutInput.value).getTime();
            
            if (isNaN(newCheckOutTime)) {
                showNotification('❌ Invalid check-out time', 'error');
                return;
            }
            
            if (newCheckOutTime <= newCheckInTime) {
                showNotification('❌ Check-out time must be after check-in time', 'error');
                return;
            }
        }
        
        // Update the record
        await runExec(`
            UPDATE staff_attendance 
            SET checkInTime = ?, checkOutTime = ?
            WHERE id = ?
        `, [newCheckInTime, newCheckOutTime, recordId]);
        
        showNotification('✅ Attendance record updated successfully', 'success');
        
        // Close edit modal
        closeEditAttendanceModal();
        
        // Reload the attendance history modal
        const record = runQuery('SELECT staffId FROM staff_attendance WHERE id = ?', [recordId])[0];
        if (record) {
            closeAttendanceHistoryModal();
            viewStaffAttendanceHistory(record.staffId);
        }
        
    } catch (error) {
        console.error('❌ Error saving attendance edit:', error);
        showNotification('❌ Failed to save changes', 'error');
    }
}

/**
 * Delete attendance record (only for last record)
 */
async function deleteAttendanceRecord(recordId, staffId) {
    try {
        const confirmed = confirm('⚠️ Delete Last Attendance Record?\n\nThis action cannot be undone.\n\nClick OK to confirm deletion.');
        
        if (!confirmed) return;
        
        // Delete the record
        await runExec('DELETE FROM staff_attendance WHERE id = ?', [recordId]);
        
        showNotification('✅ Attendance record deleted successfully', 'success');
        
        // Reload the modal
        closeAttendanceHistoryModal();
        viewStaffAttendanceHistory(staffId);
        
    } catch (error) {
        console.error('❌ Error deleting attendance record:', error);
        showNotification('❌ Failed to delete attendance record', 'error');
    }
}

// Initialize when DOM is ready (but only after login for role-based access)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Staff management will be initialized by auth.js after login
        console.log('✅ Staff management module loaded');
    });
} else {
    console.log('✅ Staff management module loaded');
}
