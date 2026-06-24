// ===================================
// AYN BEIRUT POS - SYNC MANAGER
// Multi-branch VPS synchronization
// ===================================

let syncInterval = null;
let isSyncing = false;
let syncOnlineStatus = navigator.onLine;
let syncStatusElement = null;
let cashierId = null;

// VPS Configuration (loaded from app_settings)
let vpsConfig = {
    endpoint: null,
    apiKey: null,
    branchId: null,
    appMode: 'sub', // 'main' or 'sub'
    syncInterval: 5, // minutes
    retryCount: 5
};

const MAX_RETRY_ATTEMPTS = 5;
const RETRY_DELAYS = [5000, 15000, 30000, 60000, 120000]; // 5s, 15s, 30s, 1min, 2min

// ===================================
// INITIALIZATION
// ===================================

async function initSyncManager(config = {}) {
    cashierId = getCashierId();
    
    // Load VPS configuration from app_settings
    await loadVPSConfig();
    
    console.log('🔄 Sync Manager initialized');
    console.log('📍 Cashier ID:', cashierId);
    console.log('🌐 VPS Endpoint:', vpsConfig.endpoint || 'Not configured');
    console.log('🏢 Branch ID:', vpsConfig.branchId || 'Not configured');
    console.log('⚙️ App Mode:', vpsConfig.appMode);
    
    // Setup online/offline listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Start sync interval if online and configured
    if (syncOnlineStatus && vpsConfig.endpoint) {
        startSyncInterval();
    }
    
    // Setup UI status indicator
    setupStatusIndicator();
    
    // Initial sync if configured
    if (syncOnlineStatus && vpsConfig.endpoint) {
        syncWithServer();
    }
}

async function loadVPSConfig() {
    try {
        vpsConfig.endpoint = getAppSetting('vps_endpoint');
        vpsConfig.apiKey = getAppSetting('api_key');
        vpsConfig.branchId = getAppSetting('branch_id');
        vpsConfig.appMode = getAppSetting('app_mode') || 'sub';
        vpsConfig.syncInterval = parseInt(getAppSetting('sync_interval_minutes') || '5');
        vpsConfig.retryCount = parseInt(getAppSetting('sync_retry_count') || '5');
        
        console.log('✅ VPS configuration loaded');
    } catch (error) {
        console.error('Failed to load VPS config:', error);
    }
}

// Call this when settings are updated
async function updateVPSConfig() {
    await loadVPSConfig();
    
    // Restart sync with new settings
    stopSyncInterval();
    if (syncOnlineStatus && vpsConfig.endpoint) {
        startSyncInterval();
    }
    
    console.log('🔄 VPS config updated and sync restarted');
}

function setupStatusIndicator() {
    syncStatusElement = document.getElementById('sync-status');
    
    if (!syncStatusElement) {
        // Create status indicator if it doesn't exist
        syncStatusElement = document.createElement('div');
        syncStatusElement.id = 'sync-status';
        syncStatusElement.className = 'sync-status';
        document.body.appendChild(syncStatusElement);
    }
    
    updateStatusIndicator(syncOnlineStatus ? 'connected' : 'offline');
}

function updateStatusIndicator(status) {
    if (!syncStatusElement) return;
    
    syncStatusElement.className = `sync-status sync-${status}`;
    
    const messages = {
        connected: '🟢 Synced',
        syncing: '🟡 Syncing...',
        pending: '🟡 Pending',
        offline: '🔴 Offline',
        error: '🔴 Sync Error'
    };
    
    syncStatusElement.textContent = messages[status] || status;
    syncStatusElement.title = `Last sync: ${new Date().toLocaleTimeString()}`;
}

// ===================================
// SYNC INTERVAL
// ===================================

function startSyncInterval() {
    if (syncInterval) return;
    
    if (!vpsConfig.endpoint) {
        console.log('⚠️ VPS not configured, sync disabled');
        return;
    }
    
    const intervalMs = vpsConfig.syncInterval * 60 * 1000; // Convert minutes to milliseconds
    console.log(`🔄 Starting auto-sync (every ${vpsConfig.syncInterval} minutes)`);
    
    syncInterval = setInterval(() => {
        if (syncOnlineStatus && !isSyncing) {
            syncWithServer();
        }
    }, intervalMs);
}

function stopSyncInterval() {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
        console.log('⏸️ Auto-sync stopped');
    }
}

// ===================================
// ONLINE/OFFLINE HANDLERS
// ===================================

function handleOnline() {
    console.log('🌐 Connection restored');
    syncOnlineStatus = true;
    updateStatusIndicator('connected');
    
    // Start syncing
    startSyncInterval();
    syncWithServer();
}

function handleOffline() {
    console.log('📡 Connection lost');
    syncOnlineStatus = false;
    updateStatusIndicator('offline');
    
    // Stop syncing
    stopSyncInterval();
}

// ===================================
// SYNC WITH SERVER
// ===================================

async function syncWithServer() {
    if (isSyncing || !syncOnlineStatus) return;
    
    if (!vpsConfig.endpoint || !vpsConfig.branchId) {
        console.log('⚠️ VPS not configured, skipping sync');
        return;
    }
    
    isSyncing = true;
    updateStatusIndicator('syncing');
    
    try {
        // Phase 1: Upload pending operations to VPS
        await uploadPendingChanges();
        
        // Phase 2: Download changes from VPS (for sub branches)
        if (vpsConfig.appMode === 'sub') {
            await downloadChangesFromMain();
        }
        
        // Update last sync time
        setAppSetting('last_sync_time', Date.now(), 'sync');
        
        console.log('✅ Sync completed successfully');
        updateStatusIndicator('connected');
        
    } catch (error) {
        console.error('❌ Sync failed:', error);
        updateStatusIndicator('error');
        
        // Schedule retry with exponential backoff
        scheduleRetry();
    } finally {
        isSyncing = false;
    }
}

// Upload pending changes to VPS
async function uploadPendingChanges() {
    try {
        // Get pending sync operations
        const pendingOps = await getPendingSyncOperations();
        
        if (pendingOps.length === 0) {
            console.log('📤 No pending changes to upload');
            return;
        }
        
        console.log(`📤 Uploading ${pendingOps.length} operations to VPS...`);
        
        // Prepare upload data
        const uploadData = {
            branchId: vpsConfig.branchId,
            branchMode: vpsConfig.appMode,
            cashierId: cashierId,
            timestamp: Date.now(),
            operations: pendingOps
        };
        
        // Upload to VPS
        const response = await fetch(`${vpsConfig.endpoint}/api/branch/sync/upload`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': vpsConfig.apiKey,
                'X-Branch-ID': vpsConfig.branchId
            },
            body: JSON.stringify(uploadData)
        });
        
        if (!response.ok) {
            throw new Error(`Upload failed: HTTP ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            // Mark operations as synced
            for (const op of pendingOps) {
                await markSyncOperationComplete(op.id);
            }
            
            console.log(`✅ ${pendingOps.length} operations uploaded successfully`);
        } else {
            throw new Error(result.error || 'Upload failed');
        }
        
    } catch (error) {
        console.error('Failed to upload changes:', error);
        throw error;
    }
}

// Download changes from main branch (for sub branches only)
async function downloadChangesFromMain() {
    try {
        console.log('📥 Downloading changes from main branch...');
        
        const lastSyncTime = parseInt(getAppSetting('last_sync_time') || '0');
        
        const response = await fetch(`${vpsConfig.endpoint}/api/branch/sync/download`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': vpsConfig.apiKey,
                'X-Branch-ID': vpsConfig.branchId,
                'X-Last-Sync': lastSyncTime.toString()
            }
        });
        
        if (!response.ok) {
            throw new Error(`Download failed: HTTP ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success && result.operations && result.operations.length > 0) {
            console.log(`📥 Applying ${result.operations.length} changes from main...`);
            
            // Apply changes with conflict resolution
            await applyRemoteChanges(result.operations);
            
            console.log(`✅ ${result.operations.length} changes applied`);
        } else {
            console.log('📥 No new changes from main');
        }
        
    } catch (error) {
        console.error('Failed to download changes:', error);
        // Don't throw - upload success is more important than download
    }
}

// Apply remote changes with conflict resolution
async function applyRemoteChanges(operations) {
    for (const op of operations) {
        try {
            // Parse operation data
            const data = typeof op.data === 'string' ? JSON.parse(op.data) : op.data;
            
            // Conflict resolution: Main branch always wins
            switch (op.operation) {
                case 'INSERT':
                    await applyRemoteInsert(op.table_name, data);
                    break;
                    
                case 'UPDATE':
                    await applyRemoteUpdate(op.table_name, data);
                    break;
                    
                case 'DELETE':
                    await applyRemoteDelete(op.table_name, data);
                    break;
                    
                default:
                    console.warn('Unknown operation type:', op.operation);
            }
            
        } catch (error) {
            console.error(`Failed to apply operation:`, op, error);
            // Continue with next operation
        }
    }
}

async function applyRemoteInsert(tableName, data) {
    // Build INSERT OR REPLACE query
    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data);
    
    await runExec(
        `INSERT OR REPLACE INTO ${tableName} (${columns}) VALUES (${placeholders})`,
        values
    );
}

async function applyRemoteUpdate(tableName, data) {
    if (!data.id) {
        console.error('Cannot update without ID:', tableName, data);
        return;
    }
    
    const { id, ...updateData } = data;
    const setClause = Object.keys(updateData).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updateData), id];
    
    await runExec(
        `UPDATE ${tableName} SET ${setClause} WHERE id = ?`,
        values
    );
}

async function applyRemoteDelete(tableName, data) {
    if (!data.id) {
        console.error('Cannot delete without ID:', tableName, data);
        return;
    }
    
    await runExec(`DELETE FROM ${tableName} WHERE id = ?`, [data.id]);
}

async function downloadFromServer() {
    try {
        const url = `${apiEndpoint}/cashier/${cashierId}/sync/download`;
        const lastSync = getSystemSetting('last_download_sync') || 0;
        
        const headers = {
            'Content-Type': 'application/json'
            // 'Authorization': `Bearer ${getAuthToken()}`
        };
        
        const response = await fetch(`${url}?since=${lastSync}`, {
            method: 'GET',
            headers: headers
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Apply server updates (e.g., master product catalog updates)
        if (data.updates && data.updates.length > 0) {
            await applyServerUpdates(data.updates);
            setSystemSetting('last_download_sync', Date.now());
        }
        
        return { success: true, updates: data.updates };
        
    } catch (error) {
        console.error('Download failed:', error);
        return { success: false, error: error.message };
    }
}

async function applyServerUpdates(updates) {
    console.log(`📥 Applying ${updates.length} server updates...`);
    
    for (const update of updates) {
        try {
            // Apply updates based on type
            // This will be implemented based on VPS API specification
            console.log('Applying update:', update);
        } catch (error) {
            console.error('Failed to apply update:', error);
        }
    }
}

// ===================================
// RETRY LOGIC
// ===================================

function scheduleRetry() {
    const retryCount = parseInt(getSystemSetting('sync_retry_count') || '0');
    
    if (retryCount >= MAX_RETRY_ATTEMPTS) {
        console.warn('⚠️ Max retry attempts reached');
        updateStatusIndicator('error');
        setSystemSetting('sync_retry_count', '0');
        return;
    }
    
    const delay = RETRY_DELAYS[retryCount] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
    console.log(`🔄 Scheduling retry in ${delay / 1000}s (attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS})`);
    
    setSystemSetting('sync_retry_count', (retryCount + 1).toString());
    
    setTimeout(() => {
        syncWithServer();
    }, delay);
}

// ===================================
// MANUAL SYNC
// ===================================

async function manualSync() {
    console.log('🔄 Manual sync triggered');
    
    if (!syncOnlineStatus) {
        alert('Cannot sync while offline. Please check your internet connection.');
        return;
    }
    
    updateStatusIndicator('syncing');
    
    try {
        // Upload pending operations
        await syncWithServer();
        
        // Download server updates
        await downloadFromServer();
        
        alert('✅ Sync completed successfully');
        setSystemSetting('sync_retry_count', '0');
        
    } catch (error) {
        console.error('Manual sync failed:', error);
        alert(`❌ Sync failed: ${error.message}`);
    }
}

// ===================================
// ROLE-BASED PERMISSIONS
// ===================================

function checkPermission(action) {
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
    const role = currentUser.role || 'cashier';
    
    const permissions = {
        cashier: ['view_products', 'create_sale', 'view_customers'],
        manager: ['view_products', 'edit_products', 'manage_stock', 'create_sale', 'view_customers', 'manage_customers', 'view_reports'],
        admin: ['*'] // All permissions
    };
    
    const userPermissions = permissions[role] || permissions.cashier;
    
    // Admin has all permissions
    if (userPermissions.includes('*')) return true;
    
    // Check specific permission
    return userPermissions.includes(action);
}

function enforcePermission(action, errorMessage) {
    if (!checkPermission(action)) {
        alert(errorMessage || `You don't have permission to ${action}`);
        throw new Error(`Permission denied: ${action}`);
    }
}

// ===================================
// EXPORT TO WINDOW
// ===================================

if (typeof window !== 'undefined') {
    window.initSyncManager = initSyncManager;
    window.syncWithServer = syncWithServer;
    window.updateVPSConfig = updateVPSConfig;
    window.loadVPSConfig = loadVPSConfig;
    window.manualSync = syncWithServer; // Alias for manual sync button
    window.checkPermission = checkPermission;
    window.enforcePermission = enforcePermission;
    window.getSyncStatus = () => ({
        isOnline: syncOnlineStatus,
        isSyncing: isSyncing,
        config: vpsConfig
    });
}

console.log('📦 Sync manager module loaded');
