/**
 * ===================================
 * AYN BEIRUT POS - SETTINGS PAGE
 * Developer Level Access (Password: 6969)
 * ===================================
 */

// Settings authentication
const SETTINGS_PASSWORD = '6969';
const SETTINGS_AUTH_KEY = 'ayn_settings_auth';
const SETTINGS_SESSION_TIMEOUT = 10 * 60 * 1000; // 10 minutes

let settingsAuthTime = 0;
let settingsFailedAttempts = 0;
const MAX_FAILED_ATTEMPTS = 3;
const LOCKOUT_TIME = 5 * 60 * 1000; // 5 minutes

/**
 * Check if settings password authentication is valid
 */
function isSettingsAuthenticated() {
    const authTime = localStorage.getItem(SETTINGS_AUTH_KEY);
    if (!authTime) return false;
    
    const elapsed = Date.now() - parseInt(authTime);
    if (elapsed > SETTINGS_SESSION_TIMEOUT) {
        localStorage.removeItem(SETTINGS_AUTH_KEY);
        return false;
    }
    
    return true;
}

/**
 * Authenticate settings access
 */
function authenticateSettings() {
    // Check lockout
    if (settingsFailedAttempts >= MAX_FAILED_ATTEMPTS) {
        alert('Too many failed attempts. Please wait 5 minutes.');
        return false;
    }
    
    const password = prompt('Enter Developer Password:');
    if (!password) return false;
    
    if (password === SETTINGS_PASSWORD) {
        localStorage.setItem(SETTINGS_AUTH_KEY, Date.now().toString());
        settingsFailedAttempts = 0;
        return true;
    } else {
        settingsFailedAttempts++;
        const remaining = MAX_FAILED_ATTEMPTS - settingsFailedAttempts;
        if (remaining > 0) {
            alert(`Incorrect password. ${remaining} attempts remaining.`);
        } else {
            alert('Too many failed attempts. Locked for 5 minutes.');
            setTimeout(() => {
                settingsFailedAttempts = 0;
            }, LOCKOUT_TIME);
        }
        return false;
    }
}

/**
 * Open Settings Page
 */
function openSettingsPage() {
    if (!isSettingsAuthenticated()) {
        if (!authenticateSettings()) {
            return;
        }
    }
    
    loadSettingsData();
    document.getElementById('settings-modal').classList.add('active');
}

/**
 * Close Settings Page
 */
function closeSettingsPage() {
    document.getElementById('settings-modal').classList.remove('active');
}

/**
 * Load settings data from database
 */
async function loadSettingsData() {
    try {
        // Load VPS settings
        const vpsEndpoint = getAppSetting('vps_endpoint') || '';
        const apiKey = getAppSetting('api_key') || '';
        const branchId = getAppSetting('branch_id') || '';
        const appMode = getAppSetting('app_mode') || 'sub';
        
        // Load sync settings
        const syncInterval = getAppSetting('sync_interval_minutes') || '5';
        const syncRetry = getAppSetting('sync_retry_count') || '5';
        
        // Load backup settings
        const retentionDays = getAppSetting('backup_retention_days') || '90';
        const minKeep = getAppSetting('backup_minimum_keep') || '3';
        
        // Populate form
        document.getElementById('vps-endpoint').value = vpsEndpoint;
        document.getElementById('api-key').value = apiKey;
        document.getElementById('branch-id').value = branchId;
        document.getElementById('app-mode').value = appMode;
        document.getElementById('sync-interval').value = syncInterval;
        document.getElementById('sync-retry').value = syncRetry;
        document.getElementById('retention-days').value = retentionDays;
        document.getElementById('min-backups').value = minKeep;
        
        // Update connection status
        updateConnectionStatus();
        
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

/**
 * Save settings to database
 */
async function saveSettings() {
    try {
        const vpsEndpoint = document.getElementById('vps-endpoint').value.trim();
        const apiKey = document.getElementById('api-key').value.trim();
        const branchId = document.getElementById('branch-id').value.trim();
        const appMode = document.getElementById('app-mode').value;
        const syncInterval = document.getElementById('sync-interval').value;
        const syncRetry = document.getElementById('sync-retry').value;
        const retentionDays = document.getElementById('retention-days').value;
        const minKeep = document.getElementById('min-backups').value;
        
        // Save to database
        setAppSetting('vps_endpoint', vpsEndpoint);
        setAppSetting('api_key', apiKey);
        setAppSetting('branch_id', branchId);
        setAppSetting('app_mode', appMode);
        setAppSetting('sync_interval_minutes', syncInterval);
        setAppSetting('sync_retry_count', syncRetry);
        setAppSetting('backup_retention_days', retentionDays);
        setAppSetting('backup_minimum_keep', minKeep);
        
        showNotification('Settings saved successfully', 'success');
        
        // Update sync manager if VPS enabled
        if (vpsEndpoint && apiKey && typeof updateSyncConfiguration === 'function') {
            updateSyncConfiguration();
        }
        
    } catch (error) {
        console.error('Error saving settings:', error);
        showNotification('Failed to save settings', 'error');
    }
}

/**
 * Test VPS connection
 */
async function testConnection() {
    const endpoint = document.getElementById('vps-endpoint').value.trim();
    const apiKey = document.getElementById('api-key').value.trim();
    
    if (!endpoint) {
        showNotification('Please enter VPS endpoint', 'error');
        return;
    }
    
    const statusEl = document.getElementById('connection-status');
    statusEl.textContent = 'Testing...';
    statusEl.className = 'connection-status testing';
    
    try {
        const startTime = Date.now();
        const response = await fetch(`${endpoint}/api/ping`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 5000
        });
        
        const latency = Date.now() - startTime;
        
        if (response.ok) {
            statusEl.textContent = `✅ Connected (${latency}ms)`;
            statusEl.className = 'connection-status success';
            setAppSetting('last_connection_test', Date.now().toString());
        } else {
            statusEl.textContent = `❌ Failed (${response.status})`;
            statusEl.className = 'connection-status error';
        }
    } catch (error) {
        statusEl.textContent = `❌ Connection Failed`;
        statusEl.className = 'connection-status error';
        console.error('Connection test failed:', error);
    }
}

/**
 * Update connection status display
 */
function updateConnectionStatus() {
    const lastTest = getAppSetting('last_connection_test');
    const statusEl = document.getElementById('connection-status');
    
    if (lastTest) {
        const date = new Date(parseInt(lastTest));
        statusEl.textContent = `Last test: ${date.toLocaleString()}`;
        statusEl.className = 'connection-status';
    } else {
        statusEl.textContent = 'Not tested';
        statusEl.className = 'connection-status';
    }
}

/**
 * Toggle API key visibility
 */
function toggleApiKeyVisibility() {
    const input = document.getElementById('api-key');
    const btn = document.getElementById('toggle-api-key');
    
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
    } else {
        input.type = 'password';
        btn.textContent = '👁️';
    }
}

/**
 * Get app setting from database
 */
function getAppSetting(key) {
    try {
        const results = runQuery('SELECT value FROM app_settings WHERE key = ?', [key]);
        return results.length > 0 ? results[0].value : null;
    } catch (error) {
        console.error('Error getting app setting:', key, error);
        return null;
    }
}

/**
 * Set app setting in database
 */
async function setAppSetting(key, value) {
    try {
        await runExec(
            `INSERT OR REPLACE INTO app_settings (key, value, category, updated_at) 
             VALUES (?, ?, 'sync', ?)`,
            [key, value, Date.now()]
        );
    } catch (error) {
        console.error('Error setting app setting:', key, error);
        throw error;
    }
}

/**
 * Initialize Settings Page
 */
function initSettingsPage() {
    // Keyboard shortcut: Ctrl+Shift+S
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'S') {
            e.preventDefault();
            openSettingsPage();
        }
    });
    
    // Show Electron-only settings if in Electron
    if (window.electronAPI) {
        const electronSettings = document.getElementById('electron-backup-settings');
        if (electronSettings) electronSettings.style.display = 'block';
        loadBackupPath();
    }
    
    // Event listeners
    document.getElementById('save-settings-btn')?.addEventListener('click', saveSettings);
    document.getElementById('test-connection-btn')?.addEventListener('click', testConnection);
    document.getElementById('toggle-api-key')?.addEventListener('click', toggleApiKeyVisibility);
    document.getElementById('close-settings-modal')?.addEventListener('click', closeSettingsPage);
    
    // Export/Import listeners
    document.getElementById('export-database-btn')?.addEventListener('click', exportDatabaseManual);
    document.getElementById('import-database-btn')?.addEventListener('click', () => {
        document.getElementById('database-import-file').click();
    });
    document.getElementById('database-import-file')?.addEventListener('change', handleDatabaseImport);
    
    // Backup path listeners (Electron only)
    document.getElementById('test-backup-path-btn')?.addEventListener('click', testBackupPath);
    
    console.log('✅ Settings page initialized (Ctrl+Shift+S to open)');
}

/**
 * Export database manually
 */
async function exportDatabaseManual() {
    try {
        if (!db) {
            alert('❌ Database not initialized');
            return;
        }
        
        // Get database binary data
        const data = db.export();
        const blob = new Blob([data], { type: 'application/x-sqlite3' });
        
        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        a.download = `AynBeirutPOS_Manual_${timestamp}.sqlite`;
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showNotification('✅ Database exported successfully', 'success');
        console.log('✅ Database exported:', a.download);
        
    } catch (error) {
        console.error('Export error:', error);
        alert('❌ Export failed: ' + error.message);
    }
}

/**
 * Handle database import file selection
 */
async function handleDatabaseImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const confirmed = confirm(
        '⚠️ WARNING: This will replace your entire database with the imported file.\n\n' +
        'Current data will be lost unless you have a backup.\n\n' +
        'Continue with import?'
    );
    
    if (!confirmed) {
        event.target.value = ''; // Clear file input
        return;
    }
    
    try {
        // Read file as ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Initialize database with imported data
        await initDatabase(uint8Array);
        
        alert('✅ Database imported successfully!\n\nThe app will now reload.');
        
        // Reload the page
        window.location.reload();
        
    } catch (error) {
        console.error('Import error:', error);
        alert('❌ Import failed: ' + error.message);
        event.target.value = ''; // Clear file input
    }
}

/**
 * Load backup path from settings (Electron only)
 */
async function loadBackupPath() {
    if (window.electronAPI) {
        const backupPath = getAppSetting('backup_path') || 'D:\\AynBeirutPOS-Backups';
        document.getElementById('backup-path').value = backupPath;
    }
}

/**
 * Test backup path validity (Electron only)
 */
async function testBackupPath() {
    if (!window.electronAPI) {
        document.getElementById('backup-path-status').textContent = '❌ Electron only feature';
        return;
    }
    
    const backupPath = document.getElementById('backup-path').value.trim();
    if (!backupPath) {
        document.getElementById('backup-path-status').textContent = '❌ Please enter a backup path';
        return;
    }
    
    try {
        const result = await window.electronAPI.testBackupPath(backupPath);
        if (result.success) {
            document.getElementById('backup-path-status').textContent = '✅ Path is valid and writable';
            document.getElementById('backup-path-status').style.color = '#4caf50';
            
            // Save the path
            setAppSetting('backup_path', backupPath);
        } else {
            document.getElementById('backup-path-status').textContent = `❌ ${result.error}`;
            document.getElementById('backup-path-status').style.color = '#f44336';
        }
    } catch (error) {
        document.getElementById('backup-path-status').textContent = '❌ Test failed: ' + error.message;
        document.getElementById('backup-path-status').style.color = '#f44336';
    }
}

// Initialize on load
if (typeof window !== 'undefined') {
    window.openSettingsPage = openSettingsPage;
    window.closeSettingsPage = closeSettingsPage;
    window.initSettingsPage = initSettingsPage;
}
