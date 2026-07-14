/**
 * Authentication & User Management Module
 * Handles user login, roles, permissions, and activity tracking
 */

// Default users (in production, these would be in a secure database)
const DEFAULT_USERS = [
    {
        id: 1,
        username: 'admin',
        password: 'admin123', // In production, use hashed passwords
        role: 'admin',
        name: 'Admin User',
        email: 'admin@aynbeirut.com'
    },
    {
        id: 2,
        username: 'manager',
        password: 'manager123',
        role: 'manager',
        name: 'Manager User',
        email: 'manager@aynbeirut.com'
    },
    {
        id: 3,
        username: 'cashier',
        password: 'cashier123',
        role: 'cashier',
        name: 'Cashier User',
        email: 'cashier@aynbeirut.com'
    }
];

// Current logged-in user
let currentUser = null;

/**
 * Initialize authentication
 */
async function initAuth() {
    // Initialize users database
    await initializeUsersDB();
    
    // Try to load existing session
    currentUser = loadCurrentUser();
    
    if (currentUser) {
        console.log('Session restored:', currentUser.username);
        updateUserDisplay();
        applyPermissions();
        return true;
    } else {
        console.log('No session found, showing login screen');
        showLoginModal();
        // Hide loading screen so user can see login modal
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
        return false;
    }
}

/**
 * Show login modal
 */
function showLoginModal() {
    const modal = document.getElementById('login-modal');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('login-username').focus();
    }
}

/**
 * Hide login modal
 */
function hideLoginModal() {
    const modal = document.getElementById('login-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * Handle login form submission
 */
async function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const role = document.getElementById('login-role').value;
    const errorDiv = document.getElementById('login-error');
    
    errorDiv.style.display = 'none';
    errorDiv.textContent = '';
    
    const result = await login(username, password, role);
    
    if (result.success) {
        hideLoginModal();
        document.getElementById('login-form').reset();
        
        // Show the POS app and hide loading screen
        const loadingScreen = document.getElementById('loading-screen');
        const posApp = document.getElementById('pos-app');
        
        if (loadingScreen) loadingScreen.style.display = 'none';
        if (posApp) posApp.style.display = 'flex';
        
        // Update UI AFTER showing the app (so elements exist)
        setTimeout(() => {
            updateUserDisplay();
            applyPermissions();
        }, 100);
        
        // Load role-specific scripts before continuing app init
        if (typeof window.loadScriptsForRole === 'function') {
            window.loadScriptsForRole(result.user.role).then(() => {
                console.log('✅ Role-specific scripts loaded');
                // Continue app initialization after scripts are loaded
                if (typeof window.continueAppInit === 'function') {
                    window.continueAppInit();
                }
            }).catch(err => {
                console.error('❌ Failed to load role scripts:', err);
                // Continue anyway - core features still work
                if (typeof window.continueAppInit === 'function') {
                    window.continueAppInit();
                }
            });
        } else {
            // Fallback if loadScriptsForRole not available
            if (typeof window.continueAppInit === 'function') {
                window.continueAppInit();
            }
        }
    } else {
        console.error('❌ Login failed:', result.message);
        errorDiv.textContent = result.message;
        errorDiv.style.display = 'block';
        
        // Clear password field for security
        document.getElementById('login-password').value = '';
        document.getElementById('login-password').focus();
    }
}

/**
 * Initialize users in IndexedDB
 */
async function initializeUsersDB() {
    if (!db) {
        console.warn('⚠️ Database not ready for user initialization, waiting...');
        
        // Wait for db-ready event instead of fixed timeout
        if (!window.DB_READY) {
            await new Promise((resolve) => {
                window.addEventListener('db-ready', resolve, { once: true });
            });
        }
        
        if (!db) {
            console.error('❌ Database still not ready after event');
            // Create users anyway using DEFAULT_USERS array as fallback
            console.log('📝 Will use in-memory user list as fallback');
            return;
        }
    }
    
    try {
        console.log('🔍 Checking for existing users...');
        
        // Check if users exist (SQL.js version)
        const result = runQuery('SELECT COUNT(*) as count FROM users');
        const userCount = result.length > 0 ? result[0].count : 0;
        
        console.log(`Found ${userCount} users in database`);
        
        // Check if isActive column exists first
        let hasIsActive = false;
        try {
            const columns = runQuery("PRAGMA table_info(users)");
            hasIsActive = columns.some(col => col.name === 'isActive');
            console.log('isActive column exists:', hasIsActive);
        } catch (e) {
            console.warn('Could not check table structure:', e);
        }
        
        // Always ensure all 3 default users exist (not just when count=0)
        console.log('👥 Ensuring all default users exist...');
        
        // FIX: Ensure isActive=1 for all default users at startup (not just when viewing user list)
        if (hasIsActive) {
            try {
                await runExec("UPDATE users SET isActive = 1 WHERE (isActive IS NULL OR isActive = 0) AND username IN ('admin', 'manager', 'cashier')");
                console.log('✅ Fixed isActive values for default users at startup');
                await saveDatabase();
            } catch (e) {
                console.warn('Could not fix isActive values:', e);
            }
        }
        
        for (const user of DEFAULT_USERS) {
            try {
                // Check if user exists by username OR by id
                const existingByUsername = runQuery(`SELECT id FROM users WHERE username = ?`, [user.username]);
                const existingById = runQuery(`SELECT id FROM users WHERE id = ?`, [user.id]);
                
                if (existingByUsername.length === 0 && existingById.length === 0) {
                    // User doesn't exist, create it
                    console.log(`Creating missing user: ${user.username}`);
                    if (hasIsActive) {
                        runExec(
                            `INSERT OR IGNORE INTO users (id, username, password, name, email, role, isActive, createdAt) 
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                            [user.id, user.username, user.password, user.name, user.email, user.role, 1, Date.now()]
                        );
                    } else {
                        runExec(
                            `INSERT OR IGNORE INTO users (id, username, password, name, email, role, createdAt) 
                             VALUES (?, ?, ?, ?, ?, ?, ?)`,
                            [user.id, user.username, user.password, user.name, user.email, user.role, Date.now()]
                        );
                    }
                    console.log(`✅ Created user: ${user.username} (${user.role})`);
                } else {
                    // User exists, ensure isActive = 1
                    if (hasIsActive) {
                        runExec(`UPDATE users SET isActive = 1 WHERE username = ?`, [user.username]);
                    }
                    console.log(`✅ User exists: ${user.username}`);
                }
            } catch (e) {
                console.error(`❌ Failed to ensure user ${user.username}:`, e);
            }
        }
        
        // Verify final count
        const finalResult = runQuery('SELECT COUNT(*) as count FROM users');
        const finalCount = finalResult.length > 0 ? finalResult[0].count : 0;
        console.log(`✅ User initialization complete. Total users: ${finalCount}`);
        
        // Log all users for debugging
        const allUsers = runQuery('SELECT id, username, role, isActive FROM users');
        console.log('📋 All users in database:', allUsers);
        
        // CRITICAL FIX: Force-create manager if missing
        const managerExists = allUsers.some(u => u.username === 'manager');
        if (!managerExists) {
            console.warn('⚠️ Manager user missing! Force-creating...');
            try {
                const managerData = DEFAULT_USERS.find(u => u.username === 'manager');
                // Use INSERT OR REPLACE to avoid UNIQUE constraint errors
                if (hasIsActive) {
                    runExec(
                        `INSERT OR REPLACE INTO users (id, username, password, name, email, role, isActive, createdAt) 
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [managerData.id, managerData.username, managerData.password, managerData.name, managerData.email, managerData.role, 1, Date.now()]
                    );
                } else {
                    runExec(
                        `INSERT OR REPLACE INTO users (id, username, password, name, email, role, createdAt) 
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [managerData.id, managerData.username, managerData.password, managerData.name, managerData.email, managerData.role, Date.now()]
                    );
                }
                await saveDatabase();
                console.log('✅ Manager user force-created successfully');
            } catch (err) {
                console.error('❌ Failed to force-create manager:', err);
            }
        }
        
        if (userCount === 0) {
            console.log(`✅ Using ${userCount} existing users`);
        }
    } catch (error) {
        console.error('❌ Failed to initialize users:', error);
        console.log('📝 Will fall back to DEFAULT_USERS array for authentication');
    }
}

/**
 * Login user
 */
async function login(username, password, role) {
    try {
        // Ensure users are initialized first
        await initializeUsersDB();
        
        // Find user in database
        const user = await findUser(username);
        
        if (!user) {
            console.log('User not found:', username);
            return {
                success: false,
                message: 'Invalid username or password'
            };
        }
        
        console.log('User found:', user.username, 'Expected password:', user.password, 'Provided:', password);
        
        // Verify password (in production, use proper password hashing)
        if (user.password !== password) {
            console.log('Password mismatch');
            return {
                success: false,
                message: 'Invalid username or password'
            };
        }
        
        // Verify role
        if (user.role !== role) {
            console.log('Role mismatch. User role:', user.role, 'Selected:', role);
            return {
                success: false,
                message: 'Invalid role selected'
            };
        }
        
        // Create session
        const session = {
            id: user.id,
            username: user.username,
            role: user.role,
            name: user.name,
            email: user.email,
            loginTime: new Date().toISOString(),
            sessionId: generateSessionId()
        };
        
        // Save session
        saveCurrentUser(session);
        currentUser = session;
        
        // Log activity
        await logActivity('login', `User ${username} logged in as ${role}`);
        
        console.log('Login successful:', session);
        
        return {
            success: true,
            user: session
        };
        
    } catch (error) {
        console.error('Login error:', error);
        return {
            success: false,
            message: 'An error occurred during login'
        };
    }
}

/**
 * Logout user
 */
async function logout() {
    if (currentUser) {
        await logActivity('logout', `User ${currentUser.username} logged out`);
    }
    
    // Clear session
    localStorage.removeItem('ayn-pos-session');
    currentUser = null;
    
    // Reload page to show login screen
    window.location.reload();
}

/**
 * Find user in database
 */
async function findUser(username) {
    // First try database
    if (db) {
        try {
            const result = runQuery('SELECT * FROM users WHERE username = ?', [username]);
            if (result.length > 0) {
                console.log('✅ User found in database:', username);
                return result[0];
            }
        } catch (error) {
            console.error('❌ Database query failed:', error);
        }
    }
    
    // Fallback to DEFAULT_USERS array
    console.log('🔍 Checking DEFAULT_USERS array for:', username);
    const user = DEFAULT_USERS.find(u => u.username === username);
    if (user) {
        console.log('✅ User found in DEFAULT_USERS:', username);
    } else {
        console.log('❌ User not found anywhere:', username);
    }
    return user || null;
}

/**
 * Get current user
 */
function getCurrentUser() {
    if (currentUser) return currentUser;
    return loadCurrentUser();
}

/**
 * Save current user to session storage
 */
function saveCurrentUser(user) {
    try {
        localStorage.setItem('ayn-pos-session', JSON.stringify(user));
    } catch (e) {
        console.error('Failed to save session:', e);
    }
}

/**
 * Load current user from session storage
 */
function loadCurrentUser() {
    try {
        const session = localStorage.getItem('ayn-pos-session');
        return session ? JSON.parse(session) : null;
    } catch (e) {
        console.error('Failed to load session:', e);
        return null;
    }
}

/**
 * Generate unique session ID
 */
function generateSessionId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Initialize status dropdown handlers (call once after DOM loaded)
 */
let statusDropdownInitialized = false;
function initStatusDropdownHandlers() {
    // Singleton pattern - prevent duplicate initialization
    if (statusDropdownInitialized) {
        console.log('✅ Status dropdown handlers already initialized');
        return;
    }
    
    const logoutBtnDropdown = document.getElementById('logout-btn-dropdown');
    const themeBtns = document.querySelectorAll('.theme-btn');
    
    if (!logoutBtnDropdown) {
        console.warn('⚠️ Logout button not found');
        return;
    }
    
    // Attach logout handler
    logoutBtnDropdown.addEventListener('click', function(e) {
        e.stopPropagation();
        console.log('🚪 Logout button clicked');
        
        // Close dropdown
        const dropdown = document.getElementById('status-dropdown');
        if (dropdown) dropdown.style.display = 'none';
        
        logout();
    });
    
    // Attach theme button handlers
    themeBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const theme = this.getAttribute('data-theme');
            console.log('🎨 Theme button clicked:', theme);
            
            // Set theme on html element
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('ayn-pos-theme', theme);
            
            // Close dropdown
            const dropdown = document.getElementById('status-dropdown');
            if (dropdown) dropdown.style.display = 'none';
        });
    });
    
    // Mark as initialized
    statusDropdownInitialized = true;
    console.log('✅ Status dropdown handlers initialized');
}

/**
 * Update UI with user information
 */
function updateUserDisplay() {
    console.log('🔄 updateUserDisplay called, currentUser:', currentUser);
    
    // Update dropdown user info
    const userInfoDropdown = document.getElementById('user-info-dropdown');
    const userNameDropdown = document.getElementById('user-name-dropdown');
    const userRoleDropdown = document.getElementById('user-role-dropdown');
    const logoutBtnDropdown = document.getElementById('logout-btn-dropdown');
    
    if (!userInfoDropdown || !userNameDropdown || !userRoleDropdown || !logoutBtnDropdown) {
        console.warn('⚠️ Dropdown elements not found in DOM');
        return;
    }
    
    if (currentUser) {
        // Update text content
        userNameDropdown.textContent = currentUser.name || 'User';
        userRoleDropdown.textContent = currentUser.role || 'Role';
        
        console.log('✅ User display updated:', currentUser.name);
    } else {
        // Update to show logged out state
        userNameDropdown.textContent = 'Guest';
        userRoleDropdown.textContent = 'Not logged in';
    }
}

/**
 * Apply role-based permissions
 */
function applyPermissions() {
    if (!currentUser) return;
    
    console.log('🔐 Applying permissions for user:', currentUser.username, 'role:', currentUser.role);
    
    // Get all menu buttons
    const adminBtn = document.getElementById('admin-btn');
    const staffBtn = document.getElementById('staff-btn');
    const refundBtn = document.getElementById('refund-btn');
    const customerDisplayBtn = document.getElementById('customer-display-menu-btn');
    const cashDrawerBtn = document.getElementById('cash-drawer-btn');
    const unpaidOrdersBtn = document.getElementById('unpaid-orders-btn');
    const billsBtn = document.getElementById('bills-btn');
    const purchasesBtn = document.getElementById('purchases-btn');
    
    console.log('🔐 Staff button element found:', !!staffBtn);
    
    // Reset all role-specific buttons to hidden first
    [adminBtn, staffBtn, refundBtn, customerDisplayBtn].forEach(btn => {
        if (btn) btn.style.display = 'none';
    });
    
    // Common buttons always visible (for all roles)
    // Cash Drawer, Unpaid Orders, Bills, Purchases
    
    if (currentUser.role === 'admin') {
        // Admin sees everything
        if (adminBtn) adminBtn.style.display = '';
        if (staffBtn) {
            staffBtn.style.display = '';
            console.log('🔐 Staff button SHOWN for admin');
        }
        if (refundBtn) refundBtn.style.display = '';
        if (customerDisplayBtn) customerDisplayBtn.style.display = '';
        
        console.log('✅ Admin permissions applied - full access');
        
        // Initialize admin modules
        if (typeof initBalanceDashboard === 'function') {
            initBalanceDashboard();
        }
    } else if (currentUser.role === 'manager') {
        // Manager: Staff, Refund, operational tools (NO admin dashboard, NO customer display)
        if (staffBtn) {
            staffBtn.style.display = '';
            console.log('🔐 Staff button SHOWN for manager');
        }
        if (refundBtn) refundBtn.style.display = '';
        
        console.log('✅ Manager permissions applied - operational access + staff');
    } else if (currentUser.role === 'cashier') {
        // Cashier: Basic POS tools only + Customer Display (NO staff, NO admin, NO refund)
        if (customerDisplayBtn) customerDisplayBtn.style.display = '';
        
        console.log('✅ Cashier permissions applied - basic POS access');
    }
    
    // Initialize staff management for admin and manager
    if (currentUser.role === 'admin' || currentUser.role === 'manager') {
        console.log('🔐 Checking initStaffManagement() for role:', currentUser.role);
        if (typeof initStaffManagement === 'function') {
            console.log('🔐 initStaffManagement function exists, calling it...');
            initStaffManagement();
        } else {
            // Staff management script not loaded yet (lazy loading) - will auto-init when loaded
            console.log('⏳ Staff management will initialize when script loads');
        }
    }
}

/**
 * Check if user has permission
 */
function hasPermission(permission) {
    if (!currentUser) return false;
    
    if (currentUser.role === 'admin') return true;
    
    // Cashier permissions
    const cashierPermissions = [
        'view_products',
        'add_to_cart',
        'checkout',
        'scan_barcode',
        'view_customer_display',
        'view_reports' // Cashiers can view sales reports
    ];
    
    return cashierPermissions.includes(permission);
}

/**
 * Log user activity
 */
async function logActivity(action, description) {
    if (!db || !currentUser) return;
    
    try {
        await runExec(
            `INSERT INTO activity (userId, action, timestamp, details, cashierId)
             VALUES (?, ?, ?, ?, ?)`,
            [
                currentUser.id,
                action,
                Date.now(),
                JSON.stringify({
                    username: currentUser.username,
                    role: currentUser.role,
                    description: description
                }),
                currentUser.sessionId || ''
            ]
        );
    } catch (error) {
        console.error('Failed to log activity:', error);
    }
}

/**
 * Get activity logs
 */
async function getActivityLogs(filters = {}) {
    if (!db) return [];
    
    try {
        let query = 'SELECT * FROM activity WHERE 1=1';
        const params = [];
        
        // Apply filters
        if (filters.userId) {
            query += ' AND user_id = ?';
            params.push(filters.userId);
        }
        
        if (filters.action) {
            query += ' AND action = ?';
            params.push(filters.action);
        }
        
        if (filters.startDate) {
            query += ' AND timestamp >= ?';
            params.push(new Date(filters.startDate).toISOString());
        }
        
        if (filters.endDate) {
            query += ' AND timestamp <= ?';
            params.push(new Date(filters.endDate).toISOString());
        }
        
        // Sort by timestamp (newest first)
        query += ' ORDER BY timestamp DESC';
        
        return runQuery(query, params);
    } catch (error) {
        console.error('Failed to get activity logs:', error);
        return [];
    }
}

// Export functions to global scope
if (typeof window !== 'undefined') {
    window.initAuth = initAuth;
    window.handleLogin = handleLogin;
    window.showLoginModal = showLoginModal;
    window.hideLoginModal = hideLoginModal;
    window.logout = logout;
    window.getCurrentUser = getCurrentUser;
    console.log('✅ Auth functions exported to global scope');
}
