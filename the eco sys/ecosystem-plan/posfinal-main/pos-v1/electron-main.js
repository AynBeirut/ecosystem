const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// ============================================================================
// DATABASE INTEGRITY VALIDATION (Pure JavaScript - No Native Dependencies)
// ============================================================================

/**
 * Validate SQLite database integrity using JavaScript-only checks
 * Returns: { valid: boolean, error: string }
 */
function validateDatabaseIntegrity(filePath) {
    try {
        // Check 1: File exists and has size > 0
        const stats = fs.statSync(filePath);
        if (stats.size === 0) {
            return { valid: false, error: 'Database file is empty (0 bytes)' };
        }
        
        // Check 2: SQLite magic number (first 16 bytes should be "SQLite format 3\0")
        const fd = fs.openSync(filePath, 'r');
        const headerBuffer = Buffer.alloc(100); // Read first 100 bytes for more checks
        fs.readSync(fd, headerBuffer, 0, 100, 0);
        fs.closeSync(fd);
        
        // Magic string check
        const magic = headerBuffer.toString('utf8', 0, 15);
        if (magic !== 'SQLite format 3') {
            return { valid: false, error: `Invalid SQLite header: "${magic}"` };
        }
        
        // Check 3: Page size (bytes 16-17) must be power of 2 between 512 and 65536
        const pageSize = headerBuffer.readUInt16BE(16);
        const validPageSizes = [512, 1024, 2048, 4096, 8192, 16384, 32768, 65536];
        if (!validPageSizes.includes(pageSize)) {
            return { valid: false, error: `Invalid page size: ${pageSize}` };
        }
        
        // Check 4: File format versions (bytes 18-19)
        const readVersion = headerBuffer[18];
        const writeVersion = headerBuffer[19];
        if (readVersion === 0 || writeVersion === 0 || readVersion > 2 || writeVersion > 2) {
            return { valid: false, error: `Invalid format version: read=${readVersion}, write=${writeVersion}` };
        }
        
        // Check 5: Database file size should be multiple of page size
        if (stats.size % pageSize !== 0) {
            console.warn(`⚠️ Warning: File size ${stats.size} not multiple of page size ${pageSize}`);
            // This is a warning, not fatal - database might still be usable
        }
        
        // All basic checks passed
        return { valid: true, error: null };
        
    } catch (error) {
        return { valid: false, error: error.message };
    }
}

/**
 * Find most recent valid backup
 * Returns: { path: string, created: Date } or null
 */
async function findLatestValidBackup() {
    try {
        const backupDir = path.join('C:', 'AynBeirutPOS-Backups');
        
        // Check if backup directory exists
        try {
            await fs.promises.access(backupDir, fs.constants.F_OK);
        } catch {
            console.log('📂 No backup directory found');
            return null;
        }
        
        // Get all .sqlite files
        const files = await fs.promises.readdir(backupDir);
        const backupFiles = files.filter(f => f.endsWith('.sqlite'));
        
        if (backupFiles.length === 0) {
            console.log('📂 No backup files found');
            return null;
        }
        
        // Sort by modification time (newest first)
        const backupsWithStats = await Promise.all(
            backupFiles.map(async (file) => {
                const filePath = path.join(backupDir, file);
                const stats = await fs.promises.stat(filePath);
                return { path: filePath, created: stats.mtime, name: file };
            })
        );
        
        backupsWithStats.sort((a, b) => b.created - a.created);
        
        // Find first valid backup
        for (const backup of backupsWithStats) {
            console.log(`🔍 Checking backup: ${backup.name}`);
            const validation = validateDatabaseIntegrity(backup.path);
            
            if (validation.valid) {
                console.log(`✅ Valid backup found: ${backup.name}`);
                return backup;
            } else {
                console.log(`❌ Invalid backup: ${backup.name} - ${validation.error}`);
            }
        }
        
        console.log('❌ No valid backups found');
        return null;
        
    } catch (error) {
        console.error('❌ Error finding backups:', error);
        return null;
    }
}

// Suppress Electron security warnings in development
// These warnings are expected when using SQL.js which requires 'unsafe-eval'
// Warnings disappear when app is packaged
process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

// Try to load electron-updater, but don't fail if it's not available
let autoUpdater = null;
try {
    autoUpdater = require('electron-updater').autoUpdater;
    console.log('✅ Auto-updater loaded successfully');
} catch (error) {
    console.warn('⚠️ Auto-updater not available:', error.message);
}

let mainWindow = null;
let printWindow = null;

// ============================================================================
// AUTO-UPDATE CONFIGURATION
// ============================================================================

if (autoUpdater) {
    // Configure auto-updater
    autoUpdater.autoDownload = false; // Ask user before downloading
    autoUpdater.autoInstallOnAppQuit = true; // Auto-install when app closes

    autoUpdater.on('checking-for-update', () => {
        console.log('🔍 Checking for updates...');
    });

    autoUpdater.on('update-available', (info) => {
        console.log('✅ Update available:', info.version);
        
        // Notify main window
        if (mainWindow) {
            mainWindow.webContents.send('update-available', info);
        }
    });

    autoUpdater.on('update-not-available', (info) => {
        console.log('✅ App is up to date:', info.version);
    });

    autoUpdater.on('error', (err) => {
        console.error('❌ Update error:', err);
    });

    autoUpdater.on('download-progress', (progressObj) => {
        const logMessage = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`;
        console.log(logMessage);
        
        if (mainWindow) {
            mainWindow.webContents.send('update-progress', progressObj);
        }
    });

    autoUpdater.on('update-downloaded', (info) => {
        console.log('✅ Update downloaded, will install on quit');
        
        if (mainWindow) {
            mainWindow.webContents.send('update-downloaded', info);
        }
    });
}

// ============================================================================
// WINDOW MANAGEMENT
// ============================================================================

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 768,
        title: 'Ayn Beirut POS',
        icon: path.join(__dirname, 'icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true,
            allowRunningInsecureContent: false,
            preload: path.join(__dirname, 'preload.js')
        },
        backgroundColor: '#ffffff',
        show: true, // Show immediately
        alwaysOnTop: true // Force to front
    });

    // Load the POS application
    mainWindow.loadFile('index.html');

    // Show window when ready (backup)
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.setAlwaysOnTop(false); // Remove always-on-top after showing
        // Open DevTools automatically in development
        if (!app.isPackaged) {
            mainWindow.webContents.openDevTools();
        }
    });

    // Open external links in browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // Handle window close
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Create application menu
    createMenu();

    // Development tools
    if (process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools();
    }
    
    // Setup IPC handlers for printing
    setupPrintHandlers();
}

// ============================================================================
// PRINT HANDLING
// ============================================================================

function setupPrintHandlers() {
    // Handle print requests from renderer
    ipcMain.on('print-receipt', (event, htmlContent) => {
        console.log('🖨️ Print request received, HTML length:', htmlContent?.length || 0);
        if (htmlContent) {
            printReceipt(htmlContent);
        } else {
            console.error('❌ No HTML content received for printing');
        }
    });
    console.log('✅ Print IPC handlers registered');
}

function printReceipt(htmlContent) {
    // Create invisible print window
    if (printWindow) {
        printWindow.close();
        printWindow = null;
    }
    
    printWindow = new BrowserWindow({
        width: 800,
        height: 600,
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });
    
    // Load the HTML content
    printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    
    // Wait for content to load then print
    printWindow.webContents.on('did-finish-load', () => {
        printWindow.webContents.print({
            silent: false,
            printBackground: true,
            margins: {
                marginType: 'none'
            }
        }, (success, errorType) => {
            if (!success) {
                console.error('Print failed:', errorType);
            }
            // Close print window after printing
            setTimeout(() => {
                if (printWindow) {
                    printWindow.close();
                    printWindow = null;
                }
            }, 500);
        });
    });
}

// ============================================================================
// APPLICATION MENU
// ============================================================================

function createMenu() {
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Reload',
                    accelerator: 'CmdOrCtrl+R',
                    click: () => mainWindow.reload()
                },
                { type: 'separator' },
                {
                    label: 'Exit',
                    accelerator: 'CmdOrCtrl+Q',
                    click: () => app.quit()
                }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
                { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
                { type: 'separator' },
                { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
                { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
                { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' },
                { label: 'Select All', accelerator: 'CmdOrCtrl+A', role: 'selectAll' }
            ]
        },
        {
            label: 'View',
            submenu: [
                {
                    label: 'Toggle Full Screen',
                    accelerator: 'F11',
                    click: () => {
                        mainWindow.setFullScreen(!mainWindow.isFullScreen());
                    }
                },
                { type: 'separator' },
                {
                    label: 'Actual Size',
                    accelerator: 'CmdOrCtrl+0',
                    click: () => mainWindow.webContents.setZoomLevel(0)
                },
                {
                    label: 'Zoom In',
                    accelerator: 'CmdOrCtrl+Plus',
                    click: () => {
                        const currentZoom = mainWindow.webContents.getZoomLevel();
                        mainWindow.webContents.setZoomLevel(currentZoom + 1);
                    }
                },
                {
                    label: 'Zoom Out',
                    accelerator: 'CmdOrCtrl+-',
                    click: () => {
                        const currentZoom = mainWindow.webContents.getZoomLevel();
                        mainWindow.webContents.setZoomLevel(currentZoom - 1);
                    }
                },
                { type: 'separator' },
                {
                    label: 'Developer Tools',
                    accelerator: 'F12',
                    click: () => mainWindow.webContents.toggleDevTools()
                }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'About Ayn Beirut POS',
                    click: () => {
                        const aboutMessage = `Ayn Beirut POS v${app.getVersion()}
                        
A complete Point of Sale system with:
• Product & Category Management
• Sales & Refunds Processing
• Customer Management (Phonebook)
• Supplier & Delivery Tracking
• Reports & Analytics
• Cash Drawer Management
• Bill Payments & Services

Built with SQL.js (Offline Database)
© 2025 AynBeirut - All Rights Reserved`;

                        const { dialog } = require('electron');
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'About Ayn Beirut POS',
                            message: aboutMessage,
                            buttons: ['OK']
                        });
                    }
                },
                { type: 'separator' },
                {
                    label: 'Documentation',
                    click: () => {
                        // Open documentation if available
                        const docsPath = path.join(__dirname, 'docs', 'index.html');
                        const fs = require('fs');
                        if (fs.existsSync(docsPath)) {
                            shell.openPath(docsPath);
                        }
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// ============================================================================
// APP LIFECYCLE
// ============================================================================

// ============================================================================
// CUSTOMER DISPLAY WINDOW MANAGEMENT
// ============================================================================

let customerDisplayWindow = null;

console.log('✅ Registering customer display IPC handlers...');

ipcMain.handle('open-customer-display', async (event, config) => {
    console.log('🖥️ Customer display requested with config:', config);
    try {
        const { screen } = require('electron');
        const displays = screen.getAllDisplays();
        
        console.log(`🖥️ Detected ${displays.length} display(s)`);
        
        let targetDisplay = displays[0]; // Default to primary
        
        // Determine which display to use
        if (config.location === 'auto' && displays.length > 1) {
            // Use external display if available (not at position 0,0)
            targetDisplay = displays.find(d => d.bounds.x !== 0 || d.bounds.y !== 0) || displays[0];
            console.log('🖥️ Auto-detected external display');
        } else if (config.location === 'secondary' && displays.length > 1) {
            targetDisplay = displays[1];
            console.log('🖥️ Using secondary display');
        } else {
            console.log('🖥️ Using primary display');
        }
        
        // Close existing window if open
        if (customerDisplayWindow && !customerDisplayWindow.isDestroyed()) {
            console.log('🖥️ Closing existing customer display');
            customerDisplayWindow.close();
        }
        
        // Create new window
        customerDisplayWindow = new BrowserWindow({
            x: targetDisplay.bounds.x + 50,
            y: targetDisplay.bounds.y + 50,
            width: config.fullscreen ? targetDisplay.bounds.width : 800,
            height: config.fullscreen ? targetDisplay.bounds.height : 600,
            frame: !config.fullscreen,
            kiosk: config.fullscreen,
            fullscreen: config.fullscreen,
            backgroundColor: '#0A0F1C',
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, 'preload.js')
            }
        });
        
        // Load display page with config
        const displayUrl = `file://${__dirname}/customer-display.html?mode=${config.mode}&fontSize=${config.fontSize}`;
        await customerDisplayWindow.loadURL(displayUrl);
        
        console.log('✅ Customer display opened successfully');
        
        // Handle window close
        customerDisplayWindow.on('closed', () => {
            console.log('🖥️ Customer display closed');
            customerDisplayWindow = null;
        });
        
        return { success: true, displayCount: displays.length };
    } catch (error) {
        console.error('❌ Failed to open customer display:', error);
        return { success: false, error: error.message };
    }
});

console.log('✅ Customer display IPC handler registered');

ipcMain.handle('close-customer-display', async () => {
    console.log('🖥️ Close customer display requested');
    if (customerDisplayWindow && !customerDisplayWindow.isDestroyed()) {
        customerDisplayWindow.close();
        customerDisplayWindow = null;
        console.log('✅ Customer display closed');
        return { success: true };
    }
    return { success: false, error: 'No display window open' };
});

console.log('✅ Close customer display IPC handler registered');

ipcMain.handle('update-customer-display', async (event, cartData) => {
    console.log('🖥️ Update customer display requested with cart data');
    if (customerDisplayWindow && !customerDisplayWindow.isDestroyed()) {
        customerDisplayWindow.webContents.send('cart-update', cartData);
        return { success: true };
    }
    return { success: false };
});

console.log('✅ Update customer display IPC handler registered');
console.log('✅ All customer display handlers initialized');

// ============================================================================
// FILE-BASED DATABASE HANDLERS
// ============================================================================

/**
 * Get the appropriate database path
 * Main database: Always on C:\ drive for consistency
 * Backups: Prefer D:\ drive, fallback to C:\AynBeirutPOS-Backups
 */
ipcMain.handle('get-database-path', async () => {
    const databaseFileName = 'pos-database.sqlite';
    
    // Cross-platform path handling
    const isLinux = process.platform === 'linux';
    const isMac = process.platform === 'darwin';
    
    let dbPath, dbDir;
    
    if (isLinux || isMac) {
        // Linux/Mac: Use user data directory
        dbPath = path.join(app.getPath('userData'), databaseFileName);
        dbDir = app.getPath('userData');
        console.log(`✅ Using ${process.platform} path for database:`, dbPath);
    } else {
        // Windows: Use C:\ drive for main database
        dbPath = path.join('C:', 'AynBeirutPOS-Data', databaseFileName);
        dbDir = path.join('C:', 'AynBeirutPOS-Data');
        console.log('✅ Using C:\\ drive for main database:', dbPath);
    }
    
    // Create directory if doesn't exist
    await fs.promises.mkdir(dbDir, { recursive: true });
    
    return dbPath;
});

/**
 * Check if a specific drive exists
 */
ipcMain.handle('check-drive-exists', async (event, driveLetter) => {
    try {
        await fs.promises.access(`${driveLetter}:`, fs.constants.F_OK);
        return true;
    } catch {
        return false;
    }
});

/**
 * Save database file to disk with ATOMIC WRITE and CORRUPTION PREVENTION
 */
ipcMain.handle('save-database', async (event, data, customPath = null) => {
    let tempPath = null;
    
    try {
        // Get database path if not provided
        let dbPath = customPath;
        if (!dbPath) {
            const databaseFileName = 'pos-database.sqlite';
            const isLinux = process.platform === 'linux';
            const isMac = process.platform === 'darwin';
            
            if (isLinux || isMac) {
                dbPath = path.join(app.getPath('userData'), databaseFileName);
                const dbDir = app.getPath('userData');
                await fs.promises.mkdir(dbDir, { recursive: true });
            } else {
                const cDrivePath = path.join('C:', 'AynBeirutPOS-Data', databaseFileName);
                const cDriveDir = path.join('C:', 'AynBeirutPOS-Data');
                await fs.promises.mkdir(cDriveDir, { recursive: true });
                dbPath = cDrivePath;
            }
        }
        
        // ATOMIC WRITE STEP 1: Write to temporary file first
        tempPath = dbPath + '.tmp';
        const buffer = Buffer.from(data);
        
        console.log(`💾 Writing to temp file: ${tempPath} (${buffer.length} bytes)`);
        await fs.promises.writeFile(tempPath, buffer);
        
        // ATOMIC WRITE STEP 2: Validate the temporary file
        console.log('🔍 Validating temp file integrity...');
        const validation = validateDatabaseIntegrity(tempPath);
        
        if (!validation.valid) {
            // CRITICAL: Temp file is corrupted - DO NOT overwrite good database!
            throw new Error(`Temp file validation failed: ${validation.error}`);
        }
        
        console.log('✅ Temp file validated successfully');
        
        // ATOMIC WRITE STEP 3: Backup existing file if it exists and is valid
        if (fs.existsSync(dbPath)) {
            const existingValidation = validateDatabaseIntegrity(dbPath);
            if (existingValidation.valid) {
                const backupPath = dbPath + '.backup';
                console.log(`📋 Creating safety backup: ${backupPath}`);
                await fs.promises.copyFile(dbPath, backupPath);
            }
        }
        
        // ATOMIC WRITE STEP 4: Rename temp to actual (atomic filesystem operation)
        console.log(`🔄 Atomically replacing database file...`);
        await fs.promises.rename(tempPath, dbPath);
        tempPath = null; // Successfully renamed, no need to clean up
        
        console.log(`✅ Database saved ATOMICALLY: ${dbPath} (${buffer.length} bytes)`);
        return { success: true, path: dbPath, size: buffer.length };
        
    } catch (error) {
        console.error('❌ ATOMIC SAVE FAILED:', error);
        
        // Clean up temp file if it exists
        if (tempPath && fs.existsSync(tempPath)) {
            try {
                await fs.promises.unlink(tempPath);
                console.log('🧹 Cleaned up temp file');
            } catch (cleanupError) {
                console.error('⚠️ Failed to clean up temp file:', cleanupError);
            }
        }
        
        return { success: false, error: error.message };
    }
});

/**
 * Load database file from disk with INTEGRITY CHECK and AUTO-RECOVERY
 */
ipcMain.handle('load-database', async (event, customPath = null) => {
    try {
        let dbPath;
        if (customPath) {
            dbPath = customPath;
        } else {
            // Call the get-database-path handler properly
            const result = await ipcMain.emit('get-database-path');
            if (result && result.returnValue) {
                dbPath = result.returnValue;
            } else {
                // Fallback to platform-specific path
                const isLinux = process.platform === 'linux';
                const isMac = process.platform === 'darwin';
                
                if (isLinux || isMac) {
                    dbPath = path.join(app.getPath('userData'), 'pos-database.sqlite');
                } else {
                    dbPath = path.join('C:', 'AynBeirutPOS-Data', 'pos-database.sqlite');
                }
            }
        }
        
        // Check if file exists
        let fileExists = false;
        try {
            await fs.promises.access(dbPath, fs.constants.F_OK);
            fileExists = true;
        } catch {
            console.log('ℹ️ Database file not found, will create new');
            return { success: false, error: 'File not found', data: null };
        }
        
        // INTEGRITY CHECK: Validate database file before loading
        console.log('🔍 Validating database integrity...');
        const validation = validateDatabaseIntegrity(dbPath);
        
        if (!validation.valid) {
            console.error(`❌ DATABASE CORRUPTION DETECTED: ${validation.error}`);
            console.log('🔄 Attempting auto-recovery from backup...');
            
            // Try immediate .backup file first
            const immediateBackup = dbPath + '.backup';
            if (fs.existsSync(immediateBackup)) {
                console.log('🔍 Checking immediate backup...');
                const backupValidation = validateDatabaseIntegrity(immediateBackup);
                
                if (backupValidation.valid) {
                    console.log('✅ Immediate backup is valid, restoring...');
                    await fs.promises.copyFile(immediateBackup, dbPath);
                    const buffer = await fs.promises.readFile(dbPath);
                    console.log('✅ Database restored from immediate backup');
                    return { 
                        success: true, 
                        data: Array.from(buffer), 
                        size: buffer.length,
                        recovered: true,
                        recoverySource: 'immediate-backup'
                    };
                }
            }
            
            // Try to find latest valid backup from backup directory
            const latestBackup = await findLatestValidBackup();
            
            if (latestBackup) {
                console.log(`✅ Found valid backup: ${latestBackup.name}`);
                console.log('🔄 Restoring database from backup...');
                
                // Copy backup to main database location
                await fs.promises.copyFile(latestBackup.path, dbPath);
                
                const buffer = await fs.promises.readFile(dbPath);
                console.log(`✅ Database RECOVERED from backup: ${latestBackup.name}`);
                
                return { 
                    success: true, 
                    data: Array.from(buffer), 
                    size: buffer.length,
                    recovered: true,
                    recoverySource: latestBackup.name
                };
            } else {
                // No valid backup found - CRITICAL FAILURE
                console.error('💥 CRITICAL: No valid backups found for recovery');
                return { 
                    success: false, 
                    error: 'Database corrupted and no valid backup available',
                    corruption: validation.error,
                    data: null 
                };
            }
        }
        
        // Database is valid, load it
        console.log('✅ Database integrity check passed');
        const buffer = await fs.promises.readFile(dbPath);
        
        console.log(`✅ Database loaded successfully: ${dbPath} (${buffer.length} bytes)`);
        return { success: true, data: Array.from(buffer), size: buffer.length };
        
    } catch (error) {
        console.error('❌ Failed to load database:', error);
        return { success: false, error: error.message, data: null };
    }
});

// ============================================================================
// AUTOMATIC BACKUP SYSTEM
// ============================================================================

/**
 * Create a backup of the database with VALIDATION and ROTATION
 * Keeps only the 5 most recent valid backups
 */
ipcMain.handle('create-backup', async (event, data) => {
    const MAX_BACKUPS = 5;
    
    try {
        // Validate data before backing up
        const buffer = Buffer.from(data);
        
        // Write to temp file for validation
        const tempBackupPath = path.join(app.getPath('temp'), 'pos-backup-validate.tmp');
        await fs.promises.writeFile(tempBackupPath, buffer);
        
        // Validate before proceeding
        console.log('🔍 Validating backup data...');
        const validation = validateDatabaseIntegrity(tempBackupPath);
        
        if (!validation.valid) {
            // CRITICAL: Data is corrupted - DO NOT create backup!
            await fs.promises.unlink(tempBackupPath);
            console.error(`❌ BACKUP ABORTED: Data validation failed - ${validation.error}`);
            return { 
                success: false, 
                error: `Cannot backup corrupted data: ${validation.error}` 
            };
        }
        
        console.log('✅ Backup data validated');
        
        // Get timestamp for backup filename
        const now = new Date();
        const timestamp = now.toISOString()
            .replace(/:/g, '')
            .replace(/\..+/, '')
            .replace('T', '-');
        const backupFileName = `pos-database_${timestamp}.sqlite`;
        
        // Determine backup location based on platform
        let backupDir;
        const isLinux = process.platform === 'linux';
        const isMac = process.platform === 'darwin';
        
        if (isLinux || isMac) {
            // Linux/Mac: Use home directory
            backupDir = path.join(app.getPath('home'), 'AynBeirutPOS-Backups');
        } else {
            // Windows: Always use C:\ for consistency
            backupDir = path.join('C:', 'AynBeirutPOS-Backups');
        }
        
        // Create backup directory
        await fs.promises.mkdir(backupDir, { recursive: true });
        
        const backupPath = path.join(backupDir, backupFileName);
        
        // Move validated temp file to backup location
        await fs.promises.rename(tempBackupPath, backupPath);
        
        console.log(`✅ Backup created: ${backupPath} (${buffer.length} bytes)`);
        
        // ROTATE BACKUPS: Keep only last 5 valid backups
        try {
            const files = await fs.promises.readdir(backupDir);
            const backupFiles = files.filter(f => f.startsWith('pos-database_') && f.endsWith('.sqlite'));
            
            if (backupFiles.length > MAX_BACKUPS) {
                // Get file stats and sort by modification time
                const filesWithStats = await Promise.all(
                    backupFiles.map(async (file) => {
                        const filePath = path.join(backupDir, file);
                        const stats = await fs.promises.stat(filePath);
                        return { name: file, path: filePath, mtime: stats.mtime };
                    })
                );
                
                // Sort by modification time (newest first)
                filesWithStats.sort((a, b) => b.mtime - a.mtime);
                
                // Delete old backups (keep only MAX_BACKUPS)
                const toDelete = filesWithStats.slice(MAX_BACKUPS);
                
                for (const file of toDelete) {
                    await fs.promises.unlink(file.path);
                    console.log(`🗑️ Deleted old backup: ${file.name}`);
                }
                
                console.log(`✅ Backup rotation complete (kept ${MAX_BACKUPS} most recent)`);
            }
        } catch (rotateError) {
            console.warn('⚠️ Backup rotation failed:', rotateError.message);
            // Don't fail the backup creation if rotation fails
        }
        
        return { success: true, path: backupPath, size: buffer.length };
        
    } catch (error) {
        console.error('❌ Failed to create backup:', error);
        return { success: false, error: error.message };
    }
});

/**
 * List all available backups
 */
ipcMain.handle('list-backups', async () => {
    try {
        const backups = [];
        const isLinux = process.platform === 'linux';
        const isMac = process.platform === 'darwin';
        
        // Check appropriate directories based on platform
        let possibleDirs;
        if (isLinux || isMac) {
            possibleDirs = [
                path.join(app.getPath('home'), 'AynBeirutPOS-Backups')
            ];
        } else {
            possibleDirs = [
                path.join('D:', 'AynBeirutPOS-Backups'),
                path.join('C:', 'AynBeirutPOS-Backups')
            ];
        }
        
        for (const dir of possibleDirs) {
            try {
                const files = await fs.promises.readdir(dir);
                
                for (const file of files) {
                    if (file.endsWith('.sqlite')) {
                        const filePath = path.join(dir, file);
                        const stats = await fs.promises.stat(filePath);
                        
                        backups.push({
                            name: file,
                            path: filePath,
                            size: stats.size,
                            created: stats.birthtime,
                            modified: stats.mtime
                        });
                    }
                }
            } catch {
                // Directory doesn't exist or not accessible
                continue;
            }
        }
        
        // Sort by creation date (newest first)
        backups.sort((a, b) => b.created - a.created);
        
        console.log(`📋 Found ${backups.length} backup(s)`);
        return { success: true, backups };
    } catch (error) {
        console.error('❌ Failed to list backups:', error);
        return { success: false, error: error.message, backups: [] };
    }
});

/**
 * Restore database from a backup
 */
ipcMain.handle('restore-backup', async (event, backupPath) => {
    try {
        const buffer = await fs.promises.readFile(backupPath);
        
        console.log(`✅ Backup restored: ${backupPath} (${buffer.length} bytes)`);
        return { success: true, data: Array.from(buffer), size: buffer.length };
    } catch (error) {
        console.error('❌ Failed to restore backup:', error);
        return { success: false, error: error.message, data: null };
    }
});

/**
 * Clean old backups (keep last 30 days, minimum 3 backups)
 */
ipcMain.handle('clean-old-backups', async () => {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        let deletedCount = 0;
        const isLinux = process.platform === 'linux';
        const isMac = process.platform === 'darwin';
        
        let possibleDirs;
        if (isLinux || isMac) {
            possibleDirs = [
                path.join(app.getPath('home'), 'AynBeirutPOS-Backups')
            ];
        } else {
            possibleDirs = [
                path.join('D:', 'AynBeirutPOS-Backups'),
                path.join('C:', 'AynBeirutPOS-Backups')
            ];
        }
        
        for (const dir of possibleDirs) {
            try {
                const files = await fs.promises.readdir(dir);
                const backupFiles = [];
                
                // Get all backup files with stats
                for (const file of files) {
                    if (file.endsWith('.sqlite')) {
                        const filePath = path.join(dir, file);
                        const stats = await fs.promises.stat(filePath);
                        backupFiles.push({ path: filePath, created: stats.birthtime });
                    }
                }
                
                // Sort by date (newest first)
                backupFiles.sort((a, b) => b.created - a.created);
                
                // Keep minimum 3 backups regardless of age
                const filesToCheck = backupFiles.slice(3);
                
                for (const backup of filesToCheck) {
                    if (backup.created < thirtyDaysAgo) {
                        await fs.promises.unlink(backup.path);
                        deletedCount++;
                        console.log(`🗑️ Deleted old backup: ${backup.path}`);
                    }
                }
            } catch {
                continue;
            }
        }
        
        console.log(`✅ Cleanup complete: ${deletedCount} old backup(s) deleted`);
        return { success: true, deletedCount };
    } catch (error) {
        console.error('❌ Failed to clean backups:', error);
        return { success: false, error: error.message, deletedCount: 0 };
    }
});

// ============================================================================
// APPLICATION LIFECYCLE
// ============================================================================

app.whenReady().then(() => {
    createWindow();
    
    // Check for updates after app starts (give it 3 seconds to settle)
    if (autoUpdater) {
        setTimeout(() => {
            autoUpdater.checkForUpdates();
        }, 3000);
    }

    app.on('activate', () => {
        // On macOS re-create window when dock icon is clicked
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    // On macOS, apps stay active until Cmd+Q
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Handle app errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    const { dialog } = require('electron');
    dialog.showErrorBox('Application Error', error.message);
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        // Someone tried to run a second instance, focus our window
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}

console.log(`
╔════════════════════════════════════════════════════════════╗
║                   AYN BEIRUT POS                           ║
║                  Electron Desktop App                      ║
╠════════════════════════════════════════════════════════════╣
║  Version: ${app.getVersion().padEnd(48)} ║
║  Platform: ${process.platform.padEnd(47)} ║
║  Architecture: ${process.arch.padEnd(43)} ║
╚════════════════════════════════════════════════════════════╝
`);
