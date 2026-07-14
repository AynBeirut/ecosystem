/**
 * User Management Module
 * Admin-only user creation, editing, and management
 * with role-based access control
 */

// ========================================
// CONTEXT MANAGEMENT
// ========================================

// Track which container we're rendering to (modal or admin dashboard)
let currentUsersContainer = null;

/**
 * Set the context for user management rendering
 */
window.setUsersContext = function(container) {
    currentUsersContainer = container;
    console.log('👥 Set currentUsersContainer to:', container ? container.id : 'null');
};

/**
 * Helper to find elements in the current context
 */
function getUsersElement(id) {
    if (currentUsersContainer) {
        return currentUsersContainer.querySelector(`#${id}`);
    }
    return document.getElementById(id);
}

// ========================================
// Load Users List
// ========================================
async function loadUsersList() {
    try {
        const currentUser = getCurrentUser();
        
        // Only admin can access user management
        if (currentUser.role !== 'admin') {
            showNotification('Access denied: Admin only', 'error');
            return;
        }

        // Check if isActive column exists
        let hasIsActive = false;
        try {
            const columns = await runQuery("PRAGMA table_info(users)");
            hasIsActive = columns.some(col => col.name === 'isActive');
        } catch (e) {
            console.warn('Could not check table structure:', e);
        }
        
        // FIX: Update any NULL or 0 isActive values to 1 for default users
        if (hasIsActive) {
            try {
                await runExec("UPDATE users SET isActive = 1 WHERE (isActive IS NULL OR isActive = 0) AND username IN ('admin', 'manager', 'cashier')");
                console.log('✅ Fixed isActive values for default users');
                await saveDatabase();
            } catch (e) {
                console.warn('Could not fix isActive values:', e);
            }
        }

        // Build query - treat NULL isActive as 1 (active) for backward compatibility
        const query = hasIsActive 
            ? `SELECT id, username, name, email, role, COALESCE(isActive, 1) as isActive, createdAt
               FROM users
               ORDER BY 
                   CASE role 
                       WHEN 'admin' THEN 1 
                       WHEN 'manager' THEN 2 
                       WHEN 'cashier' THEN 3 
                       ELSE 4 
                   END,
                   name ASC`
            : `SELECT id, username, name, email, role, 1 as isActive, createdAt
               FROM users
               ORDER BY 
                   CASE role 
                       WHEN 'admin' THEN 1 
                       WHEN 'manager' THEN 2 
                       WHEN 'cashier' THEN 3 
                       ELSE 4 
                   END,
                   name ASC`;

        const users = await runQuery(query);
        console.log('👥 Loaded users from database:', users.length, users);

        renderUsersList(users);
    } catch (error) {
        console.error('Error loading users:', error);
        showNotification('Failed to load users', 'error');
    }
}

// ========================================
// Render Users List Table
// ========================================
function renderUsersList(users) {
    const container = getUsersElement('users-list-container');
    if (!container) {
        console.warn('⚠️ users-list-container not found in current context');
        return;
    }

    if (!users || users.length === 0) {
        container.innerHTML = '<div class="empty-state">No users found</div>';
        return;
    }

    const currentUser = getCurrentUser();

    let html = `
        <table class="users-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;

    users.forEach(user => {
        const createdDate = new Date(user.createdAt).toLocaleDateString();
        const isCurrentUser = user.id === currentUser.id;
        const isActive = user.isActive === 1 || user.isActive === true || user.isActive === 'true';
        const statusBadge = isActive ? 
            '<span class="badge badge-success">ACTIVE</span>' : 
            '<span class="badge badge-danger">INACTIVE</span>';
        
        const roleIcon = {
            'admin': '👑',
            'manager': '📊',
            'cashier': '💰'
        }[user.role] || '👤';

        html += `
            <tr class="${!isActive ? 'inactive-user' : ''}">
                <td>${user.name || 'N/A'}</td>
                <td>${user.username}</td>
                <td>${user.email || 'N/A'}</td>
                <td>${roleIcon} ${user.role.charAt(0).toUpperCase() + user.role.slice(1)}</td>
                <td>${statusBadge}</td>
                <td>${createdDate}</td>
                <td class="actions-cell">
                    <button onclick="editUser(${user.id})" class="btn-icon" title="Edit User">
                        ✏️
                    </button>
                    ${!isCurrentUser ? `
                    <button onclick="resetUserPassword(${user.id})" class="btn-icon" title="Reset Password">
                        🔑
                    </button>
                    <button onclick="toggleUserStatus(${user.id}, ${isActive ? 1 : 0})" class="btn-icon" title="${isActive ? 'Deactivate' : 'Activate'}">
                        ${isActive ? '🔒' : '🔓'}
                    </button>
                    <button onclick="deleteUser(${user.id})" class="btn-icon btn-danger" title="Delete User">
                        🗑️
                    </button>
                    ` : '<span class="badge badge-info">YOU</span>'}
                </td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    `;

    container.innerHTML = html;
}

// ========================================
// Open Add User Form
// ========================================
function openAddUserForm() {
    const currentUser = getCurrentUser();
    
    if (currentUser.role !== 'admin') {
        showNotification('Only admin can create users', 'error');
        return;
    }

    document.getElementById('user-form-title').textContent = 'Create New User';
    document.getElementById('user-id').value = '';
    document.getElementById('user-form').reset();
    document.getElementById('user-password-group').style.display = 'block';
    document.getElementById('user-password').required = true;
    
    document.getElementById('user-modal').style.display = 'block';
}

// ========================================
// Edit User
// ========================================
async function editUser(userId) {
    try {
        const currentUser = getCurrentUser();
        
        if (currentUser.role !== 'admin') {
            showNotification('Only admin can edit users', 'error');
            return;
        }

        const users = await runQuery('SELECT * FROM users WHERE id = ?', [userId]);
        
        if (!users || users.length === 0) {
            showNotification('User not found', 'error');
            return;
        }

        const user = users[0];

        document.getElementById('user-form-title').textContent = 'Edit User';
        document.getElementById('user-id').value = user.id;
        document.getElementById('user-username').value = user.username;
        document.getElementById('user-name').value = user.name || '';
        document.getElementById('user-email').value = user.email || '';
        document.getElementById('user-role').value = user.role;
        document.getElementById('user-active').checked = user.isActive === 1;
        
        // Hide password field for editing
        document.getElementById('user-password-group').style.display = 'none';
        document.getElementById('user-password').required = false;
        
        document.getElementById('user-modal').style.display = 'block';
    } catch (error) {
        console.error('Error loading user:', error);
        showNotification('Failed to load user', 'error');
    }
}

// ========================================
// Save User (Create or Update)
// ========================================
async function saveUser(event) {
    event.preventDefault();

    try {
        const currentUser = getCurrentUser();
        
        if (currentUser.role !== 'admin') {
            showNotification('Only admin can save users', 'error');
            return;
        }

        const userId = document.getElementById('user-id').value;
        const username = document.getElementById('user-username').value.trim();
        const password = document.getElementById('user-password').value;
        const name = document.getElementById('user-name').value.trim();
        const email = document.getElementById('user-email').value.trim();
        const role = document.getElementById('user-role').value;
        const isActive = document.getElementById('user-active').checked ? 1 : 0;

        // Validation
        if (!username) {
            showNotification('Username is required', 'error');
            return;
        }

        if (!userId && !password) {
            showNotification('Password is required for new users', 'error');
            return;
        }

        if (password && password.length < 4) {
            showNotification('Password must be at least 4 characters', 'error');
            return;
        }

        if (email && !isValidEmail(email)) {
            showNotification('Please enter a valid email address', 'error');
            return;
        }

        // Check for duplicate username
        if (!userId) {
            const existing = await runQuery('SELECT id FROM users WHERE username = ?', [username]);
            if (existing && existing.length > 0) {
                showNotification('Username already exists', 'error');
                return;
            }
        } else {
            const existing = await runQuery('SELECT id FROM users WHERE username = ? AND id != ?', [username, userId]);
            if (existing && existing.length > 0) {
                showNotification('Username already exists', 'error');
                return;
            }
        }

        if (userId) {
            // Update existing user
            let query = `
                UPDATE users 
                SET username = ?, name = ?, email = ?, role = ?, isActive = ?
            `;
            const params = [username, name, email, role, isActive];

            // Update password if provided
            if (password) {
                const hashedPassword = await hashPassword(password);
                query += `, password = ?`;
                params.push(hashedPassword);
            }

            query += ` WHERE id = ?`;
            params.push(userId);

            await runExec(query, params);
            showNotification('User updated successfully', 'success');
        } else {
            // Create new user
            const hashedPassword = await hashPassword(password);
            
            await runExec(`
                INSERT INTO users (username, password, name, email, role, isActive, createdAt)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [username, hashedPassword, name, email, role, isActive, Date.now()]);

            showNotification('User created successfully', 'success');
        }

        document.getElementById('user-modal').style.display = 'none';
        await loadUsersList();

        // Reload admin tab if it's open
        if (typeof loadAdminTab === 'function') {
            loadAdminTab('users');
        }
    } catch (error) {
        console.error('Error saving user:', error);
        showNotification('Failed to save user', 'error');
    }
}

// ========================================
// Reset User Password
// ========================================
async function resetUserPassword(userId) {
    try {
        const currentUser = getCurrentUser();
        
        if (currentUser.role !== 'admin') {
            showNotification('Only admin can reset passwords', 'error');
            return;
        }

        if (userId === currentUser.id) {
            showNotification('Cannot reset your own password this way', 'error');
            return;
        }

        const users = await runQuery('SELECT username, name FROM users WHERE id = ?', [userId]);
        if (!users || users.length === 0) {
            showNotification('User not found', 'error');
            return;
        }

        const user = users[0];
        const newPassword = prompt(`Reset password for ${user.name || user.username}?\nEnter new password (min 4 characters):`);
        
        if (!newPassword) return;

        if (newPassword.length < 4) {
            showNotification('Password must be at least 4 characters', 'error');
            return;
        }

        const hashedPassword = await hashPassword(newPassword);
        
        await runExec('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);
        
        showNotification('Password reset successfully', 'success');
        
        // Show new password to admin
        alert(`Password reset successfully!\n\nUsername: ${user.username}\nNew Password: ${newPassword}\n\nPlease share this with the user securely.`);
    } catch (error) {
        console.error('Error resetting password:', error);
        showNotification('Failed to reset password', 'error');
    }
}

// ========================================
// Toggle User Active Status
// ========================================
async function toggleUserStatus(userId, currentStatus) {
    try {
        const currentUser = getCurrentUser();
        
        if (currentUser.role !== 'admin') {
            showNotification('Only admin can change user status', 'error');
            return;
        }

        if (userId === currentUser.id) {
            showNotification('Cannot deactivate your own account', 'error');
            return;
        }

        const newStatus = currentStatus ? 0 : 1;
        const action = newStatus ? 'activate' : 'deactivate';
        
        if (!confirm(`Are you sure you want to ${action} this user?`)) {
            return;
        }

        await runExec('UPDATE users SET isActive = ? WHERE id = ?', [newStatus, userId]);
        
        showNotification(`User ${action}d successfully`, 'success');
        await loadUsersList();
    } catch (error) {
        console.error('Error toggling user status:', error);
        showNotification('Failed to update user status', 'error');
    }
}

// ========================================
// Delete User
// ========================================
async function deleteUser(userId) {
    try {
        const currentUser = getCurrentUser();
        
        if (currentUser.role !== 'admin') {
            showNotification('Only admin can delete users', 'error');
            return;
        }

        if (userId === currentUser.id) {
            showNotification('Cannot delete your own account', 'error');
            return;
        }

        const users = await runQuery('SELECT username, name FROM users WHERE id = ?', [userId]);
        if (!users || users.length === 0) {
            showNotification('User not found', 'error');
            return;
        }

        const user = users[0];
        
        if (!confirm(`Are you sure you want to DELETE user "${user.name || user.username}"?\n\nThis action CANNOT be undone!\n\nAll records associated with this user will remain but will show as "Unknown User".`)) {
            return;
        }

        // Double confirmation for safety
        const confirmText = prompt(`Type "DELETE" to confirm deletion of user: ${user.username}`);
        if (confirmText !== 'DELETE') {
            showNotification('Deletion cancelled', 'info');
            return;
        }

        await runExec('DELETE FROM users WHERE id = ?', [userId]);
        
        showNotification('User deleted successfully', 'success');
        await loadUsersList();
    } catch (error) {
        console.error('Error deleting user:', error);
        showNotification('Failed to delete user', 'error');
    }
}

// ========================================
// Validate Email Format
// ========================================
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// ========================================
// Hash Password (Simple SHA-256)
// ========================================
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

// ========================================
// Export Users to CSV
// ========================================
async function exportUsersCSV(format) {
    try {
        const currentUser = getCurrentUser();
        
        if (currentUser.role !== 'admin') {
            showNotification('Only admin can export users', 'error');
            return;
        }

        if (!format) {
            showNotification('Please select an export format', 'error');
            return;
        }

        const users = await runQuery(`
            SELECT username, name, email, role, 
                   CASE WHEN isActive = 1 THEN 'Active' ELSE 'Inactive' END as status,
                   createdAt
            FROM users
            ORDER BY role, name
        `);

        if (!users || users.length === 0) {
            showNotification('No users to export', 'warning');
            return;
        }

        // Prepare export data
        const exportData = users.map(user => ({
            'username': user.username,
            'name': user.name || '',
            'email': user.email || '',
            'role': user.role,
            'status': user.status,
            'created': new Date(user.createdAt).toLocaleDateString()
        }));

        const filename = `users-export-${new Date().toISOString().split('T')[0]}`;

        // Export based on format
        switch (format) {
            case 'csv':
                if (typeof exportToCSV === 'function') {
                    const columns = [
                        {header: 'Username', key: 'username'},
                        {header: 'Name', key: 'name'},
                        {header: 'Email', key: 'email'},
                        {header: 'Role', key: 'role'},
                        {header: 'Status', key: 'status'},
                        {header: 'Created Date', key: 'created'}
                    ];
                    await exportToCSV(exportData, columns, filename);
                    showNotification('✅ Users exported as CSV', 'success');
                } else {
                    throw new Error('Export utilities not loaded');
                }
                break;
            
            case 'excel':
                if (typeof exportToExcel === 'function') {
                    const columns = [
                        {header: 'Username', key: 'username', width: 20},
                        {header: 'Name', key: 'name', width: 25},
                        {header: 'Email', key: 'email', width: 30},
                        {header: 'Role', key: 'role', width: 15},
                        {header: 'Status', key: 'status', width: 12},
                        {header: 'Created Date', key: 'created', width: 15}
                    ];
                    await exportToExcel(exportData, columns, filename, 'Users List');
                    showNotification('✅ Users exported as Excel', 'success');
                } else {
                    throw new Error('Export utilities not loaded');
                }
                break;
            
            case 'pdf':
                if (typeof exportToPDF === 'function') {
                    const columns = [
                        {header: 'Username', dataKey: 'username'},
                        {header: 'Name', dataKey: 'name'},
                        {header: 'Email', dataKey: 'email'},
                        {header: 'Role', dataKey: 'role'},
                        {header: 'Status', dataKey: 'status'},
                        {header: 'Created', dataKey: 'created'}
                    ];
                    await exportToPDF(exportData, columns, 'Users List', filename);
                    showNotification('✅ Users exported as PDF', 'success');
                } else {
                    throw new Error('Export utilities not loaded');
                }
                break;
        }

    } catch (error) {
        console.error('Error exporting users:', error);
        showNotification('❌ Failed to export users: ' + error.message, 'error');
    }
}

// ========================================
// Get User Activity Stats
// ========================================
async function getUserActivityStats(userId) {
    try {
        const stats = {
            totalSales: 0,
            totalBills: 0,
            phonebookClients: 0,
            lastActivity: null
        };

        // Get sales count (from cashier activity)
        const sales = await runQuery(`
            SELECT COUNT(*) as count 
            FROM sales 
            WHERE cashierId = (SELECT cashierId FROM users WHERE id = ?)
        `, [userId]);
        if (sales && sales.length > 0) {
            stats.totalSales = sales[0].count;
        }

        // Get bill payments count
        const bills = await runQuery(`
            SELECT COUNT(*) as count 
            FROM bill_payments 
            WHERE cashierId = (SELECT cashierId FROM users WHERE id = ?)
        `, [userId]);
        if (bills && bills.length > 0) {
            stats.totalBills = bills[0].count;
        }

        // Get phonebook clients created
        const phonebook = await runQuery(`
            SELECT COUNT(*) as count 
            FROM phonebook 
            WHERE createdBy = ?
        `, [userId]);
        if (phonebook && phonebook.length > 0) {
            stats.phonebookClients = phonebook[0].count;
        }

        return stats;
    } catch (error) {
        console.error('Error getting user activity stats:', error);
        return null;
    }
}

// ========================================
// View User Activity
// ========================================
async function viewUserActivity(userId) {
    try {
        const users = await runQuery('SELECT * FROM users WHERE id = ?', [userId]);
        if (!users || users.length === 0) {
            showNotification('User not found', 'error');
            return;
        }

        const user = users[0];
        const stats = await getUserActivityStats(userId);

        if (!stats) {
            showNotification('Failed to load user activity', 'error');
            return;
        }

        alert(`Activity Report: ${user.name || user.username}

Role: ${user.role}
Status: ${user.isActive ? 'Active' : 'Inactive'}

Sales Processed: ${stats.totalSales}
Bill Payments: ${stats.totalBills}
Phonebook Clients: ${stats.phonebookClients}

Created: ${new Date(user.createdAt).toLocaleString()}
        `);
    } catch (error) {
        console.error('Error viewing user activity:', error);
        showNotification('Failed to load user activity', 'error');
    }
}

// ========================================
// Initialize User Management Module
// ========================================
function initUserManagement() {
    console.log('User Management module initialized');

    // Set up form submit handler
    const form = document.getElementById('user-form');
    if (form) {
        form.addEventListener('submit', saveUser);
    }

    // Check if current user is admin
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.role === 'admin') {
        // Admin has access
        console.log('User management available for admin');
    } else {
        // Hide user management features for non-admin
        console.log('User management restricted to admin only');
    }
}

// Export functions to window scope
window.loadUsersList = loadUsersList;
window.openAddUserForm = openAddUserForm;
window.editUser = editUser;
window.saveUser = saveUser;
window.resetUserPassword = resetUserPassword;
window.toggleUserStatus = toggleUserStatus;
window.deleteUser = deleteUser;
window.exportUsersCSV = exportUsersCSV;
window.viewUserActivity = viewUserActivity;
window.initUserManagement = initUserManagement;
