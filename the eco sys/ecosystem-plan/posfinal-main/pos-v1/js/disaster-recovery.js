// ===================================
// AYN BEIRUT POS - DISASTER RECOVERY
// VPS restore and backup system
// ===================================

// ===================================
// BACKUP OPERATIONS
// ===================================

async function cleanOldBackups() {
    try {
        console.log('🧹 Cleaning old backups...');
        
        const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        const backupKeys = [];
        
        // Find all backup keys in localStorage
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('AynBeirutPOS_backup_')) {
                backupKeys.push(key);
            }
        }
        
        if (backupKeys.length === 0) {
            console.log('No backups found');
            return;
        }
        
        // Parse timestamps and sort by date (newest first)
        const backupsWithDate = backupKeys.map(key => {
            // Extract timestamp from key like: AynBeirutPOS_backup_pre-migration_2025-12-10T16-12-24-692Z
            const match = key.match(/(\d{4}-\d{2}-\d{2}T[\d-]+Z?)/);
            let timestamp = 0;
            if (match) {
                const dateStr = match[1].replace(/-/g, ':').replace('T', 'T').slice(0, -1) + '.000Z';
                try {
                    timestamp = new Date(dateStr.replace(/-(\d{3})Z$/, '.$1Z')).getTime();
                } catch (e) {
                    console.warn('Could not parse date from:', key);
                }
            }
            return { key, timestamp };
        }).sort((a, b) => b.timestamp - a.timestamp); // Newest first
        
        let deletedCount = 0;
        
        // Keep minimum 3 newest backups, delete others older than 90 days
        for (let i = 0; i < backupsWithDate.length; i++) {
            const backup = backupsWithDate[i];
            const age = now - backup.timestamp;
            
            // Always keep the 3 newest backups
            if (i < 3) {
                console.log(`✅ Keeping backup (${i + 1}/3 newest): ${backup.key}`);
                continue;
            }
            
            // Delete backups older than 90 days
            if (age > NINETY_DAYS_MS) {
                try {
                    localStorage.removeItem(backup.key);
                    deletedCount++;
                    const ageInDays = Math.floor(age / (24 * 60 * 60 * 1000));
                    console.log(`🗑️ Deleted backup (${ageInDays} days old): ${backup.key}`);
                } catch (e) {
                    console.warn('Could not delete backup:', backup.key, e);
                }
            }
        }
        
        if (deletedCount > 0) {
            console.log(`✅ Cleaned ${deletedCount} old backups`);
        } else {
            console.log('✅ No old backups to clean');
        }
        
    } catch (error) {
        console.error('❌ Backup cleanup failed:', error);
    }
}

async function createManualBackup() {
    try {
        console.log('💾 Creating manual backup...');
        
        if (!db) {
            throw new Error('Database not initialized');
        }
        
        // Export database
        const data = db.export();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `AynBeirutPOS_backup_${timestamp}.sqlite`;
        
        // Create downloadable file
        const blob = new Blob([data], { type: 'application/x-sqlite3' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        
        console.log(`✅ Backup created: ${filename}`);
        alert('✅ Backup created successfully');
        
        return filename;
    } catch (error) {
        console.error('❌ Backup failed:', error);
        alert('❌ Backup failed: ' + error.message);
        throw error;
    }
}

async function uploadBackupToServer() {
    try {
        console.log('📤 Uploading backup to server...');
        
        if (!db) {
            throw new Error('Database not initialized');
        }
        
        const data = db.export();
        const cashierId = getCashierId();
        
        // Placeholder for future VPS integration
        console.log('ℹ️ VPS upload will be enabled when server is ready');
        
        return null;
    } catch (error) {
        console.error('❌ Upload failed:', error);
        return null;
    }
}

// ===================================
// RESTORE OPERATIONS
// ===================================

async function restoreFromFile() {
    try {
        console.log('📂 Restoring from file...');
        
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.sqlite,.db';
        
        return new Promise((resolve, reject) => {
            input.onchange = async (e) => {
                try {
                    const file = e.target.files[0];
                    if (!file) {
                        reject(new Error('No file selected'));
                        return;
                    }
                    
                    const confirmed = confirm(
                        `⚠️ RESTORE DATABASE FROM FILE\n\n` +
                        `File: ${file.name}\n` +
                        `Size: ${(file.size / 1024).toFixed(2)} KB\n\n` +
                        `This will replace your current database.\n` +
                        `All unsaved local changes will be LOST.\n\n` +
                        `Are you sure?`
                    );
                    
                    if (!confirmed) {
                        reject(new Error('Restore cancelled'));
                        return;
                    }
                    
                    // Create backup first
                    await createManualBackup();
                    
                    // Read file
                    const buffer = await file.arrayBuffer();
                    const data = new Uint8Array(buffer);
                    
                    // Verify SQLite file
                    const signature = String.fromCharCode(...data.slice(0, 15));
                    if (!signature.startsWith('SQLite format 3')) {
                        throw new Error('Invalid SQLite file');
                    }
                    
                    // Load database
                    db = new SQL.Database(data);
                    await saveDatabase();
                    
                    console.log('✅ Database restored');
                    alert('✅ Database restored. Reloading...');
                    
                    setTimeout(() => window.location.reload(), 1000);
                    resolve(true);
                } catch (error) {
                    console.error('Restore failed:', error);
                    alert('❌ Restore failed: ' + error.message);
                    reject(error);
                }
            };
            
            input.click();
        });
    } catch (error) {
        console.error('❌ Restore failed:', error);
        throw error;
    }
}

async function restoreFromServer() {
    console.log('ℹ️ Server restore will be enabled when VPS is ready');
    alert('Server restore feature will be available when online sync is configured.');
    return false;
}

function getLocalBackupsSnapshot() {
    const backups = [];

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith('AynBeirutPOS')) continue;

        try {
            const raw = localStorage.getItem(key);
            if (!raw || raw.length < 100) continue;

            let bytes = null;
            let timestamp = Date.now();

            if (raw.startsWith('[')) {
                bytes = new Uint8Array(JSON.parse(raw));
            } else if (raw.startsWith('{')) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed.data)) {
                    bytes = new Uint8Array(parsed.data);
                }
                if (parsed.timestamp) {
                    timestamp = parsed.timestamp;
                }
            }

            if (bytes && bytes.length > 1000) {
                backups.push({
                    key,
                    size: bytes.length,
                    timestamp,
                    data: bytes
                });
            }
        } catch (e) {
            // Ignore malformed entries
        }
    }

    backups.sort((a, b) => b.size - a.size);
    return backups;
}

function listLocalBackups() {
    const backups = getLocalBackupsSnapshot().map(item => ({
        key: item.key,
        sizeKB: (item.size / 1024).toFixed(2),
        date: new Date(item.timestamp).toISOString()
    }));

    console.table(backups);
    return backups;
}

async function restoreFromLocalBackup(backupKey = null) {
    const backups = getLocalBackupsSnapshot();
    if (backups.length === 0) {
        throw new Error('No local backups found in localStorage');
    }

    const target = backupKey
        ? backups.find(b => b.key === backupKey)
        : backups[0];

    if (!target) {
        throw new Error(`Backup key not found: ${backupKey}`);
    }

    const confirmed = confirm(
        `Restore backup?\n\n` +
        `Key: ${target.key}\n` +
        `Size: ${(target.size / 1024).toFixed(2)} KB\n` +
        `Date: ${new Date(target.timestamp).toISOString()}\n\n` +
        `This will replace current database.`
    );

    if (!confirmed) {
        return false;
    }

    db = new SQL.Database(target.data);
    await saveDatabase();
    alert('✅ Local backup restored. Reloading...');
    setTimeout(() => window.location.reload(), 800);
    return true;
}

// ===================================
// EXPORT TO WINDOW
// ===================================

if (typeof window !== 'undefined') {
    window.cleanOldBackups = cleanOldBackups;
    window.createManualBackup = createManualBackup;
    window.uploadBackupToServer = uploadBackupToServer;
    window.restoreFromFile = restoreFromFile;
    window.restoreFromServer = restoreFromServer;
    window.listLocalBackups = listLocalBackups;
    window.restoreFromLocalBackup = restoreFromLocalBackup;
}

console.log('📦 Disaster recovery module loaded');
