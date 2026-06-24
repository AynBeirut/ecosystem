// ===================================
// AYN BEIRUT POS - STORAGE MANAGER
// Platform-aware persistent storage
// NEVER LOSE DATA - Production Grade
// ===================================

// FIXED STORAGE KEY - Works across ALL URL paths
const GLOBAL_DB_KEY = 'AynBeirutPOS_GLOBAL';

// Installation password (technical staff only)
const INSTALLATION_PASSWORD = '6969';
const MAX_PASSWORD_ATTEMPTS = 7;
const LOCKOUT_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours
const BYPASS_PASSWORD_PROMPT = false; // Set to true to bypass password for testing

// Storage types in order of preference
const STORAGE_TYPES = {
    ELECTRON_FS: 'electron-fs',
    FILE_SYSTEM_API: 'file-system-api',
    INDEXEDDB: 'indexeddb',
    LOCALSTORAGE: 'localstorage',
    VPS_ONLY: 'vps-only' // PWA mobile mode
};

let currentStorageType = null;
let fileHandle = null; // For File System Access API
let dataProtectionEnabled = true; // Treat all data as production
let isPWAMode = false; // Detected if running as PWA

// AUTO-LOAD existing data (only ask on first install or restore)
let alwaysAskInstallMode = false;

// ===================================
// PLATFORM DETECTION
// ===================================

function detectPlatform() {
    // Check if PWA (standalone mobile app)
    const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                  window.navigator.standalone ||
                  document.referrer.includes('android-app://');
    
    // Check if Electron (Windows desktop app)
    const isElectron = window.electronAPI || 
                       (typeof process !== 'undefined' && process.versions && process.versions.electron);
    
    isPWAMode = isPWA && !isElectron;
    
    console.log(`🔍 Platform Detection: ${isPWAMode ? 'PWA Mobile' : isElectron ? 'Electron Desktop' : 'Web Browser'}`);
    
    // Determine best storage type
    if (isElectron && window.electronAPI) {
        console.log('✅ Using Electron file system (unlimited size)');
        return STORAGE_TYPES.ELECTRON_FS;
    }
    
    if (isPWAMode) {
        console.log('📱 PWA Mode: Server sync only');
        return STORAGE_TYPES.VPS_ONLY;
    }
    
    // Web browser fallbacks
    if ('showSaveFilePicker' in window) {
        console.log('💾 Using File System Access API');
        return STORAGE_TYPES.FILE_SYSTEM_API;
    }
    
    if (window.indexedDB) {
        console.log('📦 Using IndexedDB');
        return STORAGE_TYPES.INDEXEDDB;
    }
    
    console.log('⚠️ Using localStorage (limited to 5MB)');
    return STORAGE_TYPES.LOCALSTORAGE;
}

function checkInstallationLock() {
    const lockData = localStorage.getItem('installation_lock');
    if (!lockData) return false;
    
    try {
        const { attempts, lockedUntil } = JSON.parse(lockData);
        const now = Date.now();
        
        // Check if still locked
        if (lockedUntil && now < lockedUntil) {
            const remainingMs = lockedUntil - now;
            const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
            return {
                locked: true,
                message: `🔒 Installation locked due to too many failed password attempts.\n\nAuto-unlock in ${remainingHours} hour(s).\n\nContact technical support if urgent.`
            };
        }
        
        // Lock expired, reset
        if (lockedUntil && now >= lockedUntil) {
            localStorage.removeItem('installation_lock');
            return false;
        }
        
        return false;
    } catch (e) {
        localStorage.removeItem('installation_lock');
        return false;
    }
}

function recordPasswordAttempt(success) {
    if (success) {
        // Reset attempts on successful password
        localStorage.removeItem('installation_lock');
        return;
    }
    
    // Failed attempt
    const lockData = localStorage.getItem('installation_lock');
    let attempts = 1;
    
    if (lockData) {
        try {
            const data = JSON.parse(lockData);
            attempts = (data.attempts || 0) + 1;
        } catch (e) {}
    }
    
    if (attempts >= MAX_PASSWORD_ATTEMPTS) {
        // Lock the installation
        const lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
        localStorage.setItem('installation_lock', JSON.stringify({
            attempts: attempts,
            lockedUntil: lockedUntil
        }));
        alert(`🚫 Too many failed attempts!\n\nInstallation locked for 4 hours.\n\nContact technical support.`);
    } else {
        // Record attempt
        localStorage.setItem('installation_lock', JSON.stringify({
            attempts: attempts,
            lockedUntil: null
        }));
        alert(`❌ Incorrect password.\n\nAttempt ${attempts}/${MAX_PASSWORD_ATTEMPTS}\n\n${MAX_PASSWORD_ATTEMPTS - attempts} attempts remaining before 4-hour lockout.`);
    }
}

// ===================================
// CROSS-PATH DATA FINDER
// Find data from ANY URL path or storage location
// ===================================

async function findAllExistingData() {
    console.log('🔍 Searching for existing data across ALL locations...');
    const foundData = [];
    
    // CRITICAL: Log all localStorage keys for debugging
    console.log('📋 All localStorage keys:', Object.keys(localStorage));
    
    // Search localStorage for ANY AynBeirutPOS data
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('AynBeirutPOS')) {
            try {
                const item = localStorage.getItem(key);
                if (item && item.length > 1000) {
                    let data = null;
                    let size = item.length;
                    let timestamp = Date.now();
                    
                    // Try to parse as JSON array (database)
                    if (item.startsWith('[')) {
                        data = new Uint8Array(JSON.parse(item));
                        size = data.length;
                    }
                    // Try to parse as backup object
                    else if (item.startsWith('{')) {
                        try {
                            const backup = JSON.parse(item);
                            if (backup.data) {
                                data = new Uint8Array(backup.data);
                                size = data.length;
                                timestamp = backup.timestamp || Date.now();
                            }
                        } catch (e) {}
                    }
                    
                    if (data && size > 1000) {
                        foundData.push({
                            key: key,
                            size: size,
                            data: data,
                            source: 'localStorage',
                            timestamp: timestamp
                        });
                        console.log(`✅ Found data: ${key} (${(size/1024).toFixed(2)} KB)`);
                    }
                }
            } catch (e) {
                // Skip invalid entries
            }
        }
    }
    
    // Search IndexedDB
    try {
        if (indexedDB.databases) {
            const dbs = await indexedDB.databases();
            for (const dbInfo of dbs) {
                if (dbInfo.name && dbInfo.name.includes('AynBeirutPOS')) {
                    console.log(`📦 Found IndexedDB: ${dbInfo.name}`);
                    try {
                        const data = await loadFromIndexedDBDirect(dbInfo.name);
                        if (data && data.length > 1000) {
                            foundData.push({
                                key: dbInfo.name,
                                size: data.length,
                                data: data,
                                source: 'IndexedDB',
                                timestamp: Date.now()
                            });
                            console.log(`✅ Found IndexedDB data: ${dbInfo.name} (${(data.length/1024).toFixed(2)} KB)`);
                        }
                    } catch (e) {
                        console.log(`⚠️ Could not load from ${dbInfo.name}`);
                    }
                }
            }
        }
    } catch (e) {
        console.log('⚠️ IndexedDB.databases() not supported');
    }
    
    // Sort by size (largest first - most complete data)
    foundData.sort((a, b) => b.size - a.size);
    
    console.log(`📊 Found ${foundData.length} data sources`);
    return foundData;
}

// Load from specific IndexedDB directly
async function loadFromIndexedDBDirect(dbName) {
    return new Promise((resolve) => {
        try {
            const actualName = dbName.includes('_BlobStorage') ? dbName : `${dbName}_BlobStorage`;
            const request = indexedDB.open(actualName);
            request.onerror = () => resolve(null);
            request.onsuccess = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('database')) {
                    db.close();
                    resolve(null);
                    return;
                }
                const transaction = db.transaction(['database'], 'readonly');
                const store = transaction.objectStore('database');
                const getRequest = store.get('sqliteDb');
                getRequest.onsuccess = async () => {
                    const blob = getRequest.result;
                    if (blob) {
                        const arrayBuffer = await blob.arrayBuffer();
                        db.close();
                        resolve(new Uint8Array(arrayBuffer));
                    } else {
                        db.close();
                        resolve(null);
                    }
                };
                getRequest.onerror = () => {
                    db.close();
                    resolve(null);
                };
            };
        } catch (e) {
            resolve(null);
        }
    });
}

// ===================================
// INSTALLATION MODE DETECTION
// ALWAYS ASK USER - Never skip the prompt
// ===================================

let installationMode = null; // 'new' or 'update'
let installationPromptShown = false;

async function checkInstallationMode() {
    // ALWAYS search for existing data first
    const existingData = await findAllExistingData();
    
    // Check if we already have data with GLOBAL key
    const globalData = localStorage.getItem(`${GLOBAL_DB_KEY}_sqljs`);
    const hasGlobalData = globalData && globalData.length > 1000;
    
    if (hasGlobalData) {
        console.log('✅ Found existing GLOBAL data');
    }
    
    // CRITICAL: ALWAYS SHOW THE PROMPT
    // This is the user's requirement - never skip the installation choice
    if (alwaysAskInstallMode) {
        console.log('🔔 ALWAYS ASK MODE: Showing installation prompt...');
        
        // Combine found data for prompt
        if (existingData.length > 0 || hasGlobalData) {
            return { mode: 'found_data', hasData: true, data: existingData };
        } else {
            // Even with no data, show prompt to allow user to restore from backup file
            return { mode: 'ask_anyway', hasData: false, data: [] };
        }
    }
    
    // Legacy mode (if alwaysAskInstallMode is false)
    if (hasGlobalData) {
        installationMode = 'update';
        return { mode: 'update', hasData: true };
    }
    
    if (existingData.length > 0) {
        console.log('✅ Found existing data from other location - will prompt user');
        return { mode: 'found_data', hasData: true, data: existingData };
    }
    
    // No data found anywhere
    console.log('ℹ️ No existing data found - NEW installation');
    return { mode: 'new', hasData: false };
}

async function showInstallationPrompt(existingData) {
    if (installationPromptShown) return null;
    
    // Detect platform first
    const platform = detectPlatform();
    
    // PWA MODE: No installation prompt needed - connects directly to VPS
    // User will login with their credentials, data stored on VPS, controlled by dev
    if (platform.isPWA) {
        console.log('📱 PWA Mode: Skipping installation prompt - VPS sync only');
        installationPromptShown = true;
        return { mode: 'vps_only', data: null, platform };
    }
    
    // BYPASS for testing - remove in production
    if (BYPASS_PASSWORD_PROMPT) {
        console.log('⚠️ PASSWORD BYPASS ENABLED - For testing only!');
        installationPromptShown = true;
        return new Promise((resolve) => {
            showInstallationOptions(existingData, platform, resolve);
        });
    }
    
    // Check if installation is locked (Electron/Desktop only)
    const lockStatus = checkInstallationLock();
    if (lockStatus && lockStatus.locked) {
        alert(lockStatus.message);
        return null;
    }
    
    installationPromptShown = true;
    
    return new Promise((resolve) => {
        // STEP 1: Password prompt
        const passwordModal = document.createElement('div');
        passwordModal.id = 'password-prompt-modal';
        passwordModal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.95); display: flex; align-items: center;
            justify-content: center; z-index: 99999; font-family: Arial, sans-serif;
        `;
        
        passwordModal.innerHTML = `
            <div style="background: #1a1a2e; padding: 40px; border-radius: 12px; max-width: 450px; text-align: center; color: white; box-shadow: 0 0 50px rgba(255,87,34,0.5);">
                <h1 style="color: #FF5722; margin-bottom: 20px; font-size: 28px;">🔐 INSTALLATION ACCESS</h1>
                <p style="color: #aaa; margin-bottom: 20px; font-size: 14px;">
                    <strong>Desktop App - Local Storage Installation</strong><br>
                    This action requires technical staff authorization.<br>
                    Please enter installation password:
                </p>
                <input type="password" id="installation-password" placeholder="Enter password" autocomplete="off"
                    style="width: 100%; padding: 15px; font-size: 18px; border-radius: 8px; 
                    border: 2px solid #FF5722; background: #2a2a3e; color: white; text-align: center; margin-bottom: 20px; box-sizing: border-box;" />
                <div style="display: flex; gap: 10px;">
                    <button id="btn-password-cancel" style="flex: 1; background: #666; color: white; border: none; 
                        padding: 15px; font-size: 16px; border-radius: 8px; cursor: pointer;">
                        ❌ Cancel
                    </button>
                    <button id="btn-password-submit" style="flex: 1; background: #FF5722; color: white; border: none; 
                        padding: 15px; font-size: 16px; border-radius: 8px; cursor: pointer;">
                        ✅ Continue
                    </button>
                </div>
                <p style="color: #999; font-size: 12px; margin-top: 15px;">
                    💻 Desktop Mode - Local Storage + VPS Backup
                </p>
                <p style="color: #666; font-size: 11px; margin-top: 10px;">
                    Password for technical staff only
                </p>
            </div>
        `;
        
        document.body.appendChild(passwordModal);
        
        // Wait a moment for DOM to be ready
        setTimeout(() => {
            const passwordInput = document.getElementById('installation-password');
            const btnSubmit = document.getElementById('btn-password-submit');
            const btnCancel = document.getElementById('btn-password-cancel');
            
            if (!passwordInput) {
                console.error('❌ Password input not found!');
                return;
            }
            
            // Force focus
            passwordInput.focus();
            passwordInput.select();
            
            const checkPassword = () => {
                const enteredPassword = passwordInput.value;
                console.log('🔐 Checking password...');
                if (enteredPassword === INSTALLATION_PASSWORD) {
                    console.log('✅ Password correct!');
                    recordPasswordAttempt(true);
                    passwordModal.remove();
                    showInstallationOptions(existingData, platform, resolve);
                } else if (enteredPassword) {
                    console.log('❌ Password incorrect');
                    recordPasswordAttempt(false);
                    passwordInput.value = '';
                    passwordInput.focus();
                    
                    // Check if now locked
                    const lockStatus = checkInstallationLock();
                    if (lockStatus && lockStatus.locked) {
                        passwordModal.remove();
                        resolve(null);
                    }
                }
            };
            
            btnSubmit.onclick = checkPassword;
            passwordInput.onkeypress = (e) => {
                if (e.key === 'Enter') checkPassword();
            };
            passwordInput.onkeyup = (e) => {
                if (e.key === 'Enter') checkPassword();
            };
            
            btnCancel.onclick = () => {
                console.log('❌ User cancelled password prompt');
                passwordModal.remove();
                resolve(null);
            };
        }, 100);
    });
}

function showInstallationOptions(existingData, platform, resolve) {
    // STEP 2: Show installation options (NEW/UPDATE/RESTORE)
    const modal = document.createElement('div');
    modal.id = 'installation-prompt-modal';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.95); display: flex; align-items: center;
        justify-content: center; z-index: 99999; font-family: Arial, sans-serif;
    `;
    
    const hasData = existingData && existingData.length > 0;
    const dataInfo = hasData 
        ? `Found ${existingData.length} existing database(s).<br>Largest: <strong>${(existingData[0].size/1024).toFixed(2)} KB</strong> from ${existingData[0].source}`
        : 'No existing data found in browser storage.';
    
    modal.innerHTML = `
        <div style="background: #1a1a2e; padding: 40px; border-radius: 12px; max-width: 550px; text-align: center; color: white; box-shadow: 0 0 50px rgba(76,175,80,0.3);">
            <h1 style="color: #4CAF50; margin-bottom: 20px; font-size: 28px;">🏪 AYN BEIRUT POS</h1>
            <h2 style="margin-bottom: 20px; font-size: 22px;">Installation Type</h2>
            <p style="color: #aaa; margin-bottom: 10px; font-size: 14px;">${dataInfo}</p>
            <p style="color: #ff9800; margin-bottom: 30px; font-size: 14px;">⚠️ Choose carefully - this affects your data!</p>
            
            <div style="display: flex; flex-direction: column; gap: 15px;">
                <button id="btn-update" style="
                    background: ${hasData ? '#4CAF50' : '#666'}; color: white; border: none; padding: 20px 40px;
                    font-size: 18px; border-radius: 8px; cursor: pointer;
                ">
                    📂 UPDATE / LOAD EXISTING DATA
                    <br><small style="font-size: 12px;">${hasData ? 'Restore previous sales, inventory, customers' : 'Auto-load if data found'}</small>
                </button>
                
                ${!platform.isPWA ? `
                <button id="btn-restore" style="
                    background: #2196F3; color: white; border: none; padding: 20px 40px;
                    font-size: 18px; border-radius: 8px; cursor: pointer;
                ">
                    📁 RESTORE FROM BACKUP FILE
                    <br><small style="font-size: 12px;">Load .sqlite backup from Downloads folder</small>
                </button>
                
                <input type="file" id="backup-file-input" accept=".sqlite,.db" style="display: none;">
                ` : ''}
                
                <button id="btn-new" style="
                    background: #f44336; color: white; border: none; padding: 20px 40px;
                    font-size: 18px; border-radius: 8px; cursor: pointer;
                ">
                    🆕 NEW INSTALLATION
                    <br><small style="font-size: 12px;">Start fresh with empty database</small>
                </button>
            </div>
            
            <p style="color: #999; font-size: 12px; margin-top: 20px;">
                ${platform.isPWA ? '📱 PWA Mode: Data syncs to VPS only (no local files)' : platform.isElectron ? '💻 Desktop Mode: Local file + VPS backup' : '🌐 Browser: Local storage + optional file backup'}
            </p>
        </div>
    `;
        
        document.body.appendChild(modal);
        
        document.getElementById('btn-update').onclick = () => {
            if (hasData) {
                console.log('👤 User selected: UPDATE - Loading existing data');
                modal.remove();
                resolve({ mode: 'update', data: existingData[0].data });
            } else {
                // No data but user wants to try update mode anyway
                console.log('👤 User selected: UPDATE - But no data found');
                modal.remove();
                resolve({ mode: 'update', data: null });
            }
        };
        
        document.getElementById('btn-restore').onclick = () => {
            document.getElementById('backup-file-input').click();
        };
        
        document.getElementById('backup-file-input').onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                console.log('📁 User selected backup file:', file.name);
                try {
                    const arrayBuffer = await file.arrayBuffer();
                    const data = new Uint8Array(arrayBuffer);
                    console.log('✅ Loaded backup file:', (data.length / 1024).toFixed(2), 'KB');
                    modal.remove();
                    resolve({ mode: 'restore', data: data });
                } catch (err) {
                    console.error('❌ Failed to load backup file:', err);
                    alert('Failed to load backup file. Please try again.');
                }
            }
        };
        
        document.getElementById('btn-new').onclick = () => {
            if (confirm('⚠️ Are you SURE you want to start fresh?\\n\\nThis will NOT load any existing data.\\nAll previous sales and inventory will be ignored.')) {
                console.log('👤 User selected: NEW - Starting fresh');
                modal.remove();
                resolve({ mode: 'new', data: null });
            }
        };
}

// ===================================
// STORAGE TYPE DETECTION
// ===================================

async function detectStorageType() {
    // Detect platform first
    const platform = detectPlatform();
    
    // Check for Electron
    if (platform.isElectron || window.electronAPI) {
        console.log('🖥️ Storage: Electron Desktop App');
        return STORAGE_TYPES.ELECTRON_FS;
    }
    
    // Check for PWA mode (mobile - VPS only)
    if (platform.isPWA) {
        console.log('📱 Storage: PWA Mobile (VPS Sync Only)');
        return STORAGE_TYPES.VPS_ONLY;
    }
    
    // Enable File System Access API for modern browsers (Windows desktop)
    if ('showSaveFilePicker' in window && !platform.isPWA) {
        console.log('🌐 Storage: Modern Browser (File System Access API)');
        return STORAGE_TYPES.FILE_SYSTEM_API;
    }
    
    // Check for IndexedDB
    if ('indexedDB' in window) {
        console.log('🌐 Storage: Browser (IndexedDB)');
        return STORAGE_TYPES.INDEXEDDB;
    }
    
    // Fallback to localStorage
    console.log('📦 Storage: Basic Browser (localStorage)');
    return STORAGE_TYPES.LOCALSTORAGE;
}

// ===================================
// ELECTRON FILE SYSTEM STORAGE
// ===================================

async function electronSave(dbName, data) {
    try {
        const fs = require('fs');
        const path = require('path');
        const { app } = require('electron').remote || require('@electron/remote');
        
        // Get app data directory
        const userDataPath = app.getPath('userData');
        const dbPath = path.join(userDataPath, 'AynBeirutPOS', `${dbName}.sqlite`);
        
        // Ensure directory exists
        const dbDir = path.dirname(dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
        
        // Write database file
        fs.writeFileSync(dbPath, Buffer.from(data));
        
        console.log(`💾 Database saved to: ${dbPath}`);
        return true;
    } catch (error) {
        console.error('Electron save failed:', error);
        throw error;
    }
}

async function electronLoad(dbName) {
    try {
        const fs = require('fs');
        const path = require('path');
        const { app } = require('electron').remote || require('@electron/remote');
        
        const userDataPath = app.getPath('userData');
        const dbPath = path.join(userDataPath, 'AynBeirutPOS', `${dbName}.sqlite`);
        
        if (fs.existsSync(dbPath)) {
            const buffer = fs.readFileSync(dbPath);
            console.log(`📂 Database loaded from: ${dbPath}`);
            return new Uint8Array(buffer);
        }
        
        return null;
    } catch (error) {
        console.error('Electron load failed:', error);
        return null;
    }
}

// ===================================
// FILE SYSTEM ACCESS API STORAGE
// ===================================

async function fileSystemApiSave(dbName, data) {
    try {
        // Get or create file handle
        if (!fileHandle) {
            fileHandle = await window.showSaveFilePicker({
                suggestedName: `${dbName}.sqlite`,
                types: [{
                    description: 'SQLite Database',
                    accept: { 'application/x-sqlite3': ['.sqlite', '.db'] }
                }]
            });
        }
        
        // Write to file
        const writable = await fileHandle.createWritable();
        await writable.write(data);
        await writable.close();
        
        console.log('💾 Database saved via File System Access API');
        
        // Store file handle reference for future use
        localStorage.setItem(`${dbName}_fileHandle`, 'granted');
        
        return true;
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('User cancelled file picker');
            // Fall back to IndexedDB
            currentStorageType = STORAGE_TYPES.INDEXEDDB;
            return indexedDbSave(dbName, data);
        }
        console.error('File System API save failed:', error);
        throw error;
    }
}

async function fileSystemApiLoad(dbName) {
    try {
        // Check if we have permission
        const hasHandle = localStorage.getItem(`${dbName}_fileHandle`);
        
        if (!hasHandle) {
            return null; // First time, no file yet
        }
        
        // Ask user to select the database file
        const [handle] = await window.showOpenFilePicker({
            types: [{
                description: 'SQLite Database',
                accept: { 'application/x-sqlite3': ['.sqlite', '.db'] }
            }]
        });
        
        fileHandle = handle;
        
        const file = await handle.getFile();
        const buffer = await file.arrayBuffer();
        
        console.log('📂 Database loaded via File System Access API');
        return new Uint8Array(buffer);
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('User cancelled file picker');
        }
        console.error('File System API load failed:', error);
        return null;
    }
}

// ===================================
// INDEXEDDB BLOB STORAGE
// ===================================

async function indexedDbSave(dbName, data) {
    return new Promise((resolve, reject) => {
        try {
            const request = indexedDB.open(`${dbName}_BlobStorage`);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                console.log('🔧 IndexedDB upgrade needed, creating object store...');
                if (!db.objectStoreNames.contains('database')) {
                    db.createObjectStore('database');
                    console.log('✅ Created "database" object store');
                }
            };
            
            request.onsuccess = (event) => {
                const db = event.target.result;
                
                // Double-check object store exists
                if (!db.objectStoreNames.contains('database')) {
                    console.error('❌ IndexedDB object store "database" not found after upgrade');
                    console.error('📊 Available stores:', Array.from(db.objectStoreNames));
                    
                    // CRITICAL FIX: DO NOT DELETE DATABASE - PRESERVE USER DATA!
                    // Instead, close current connection and force a version upgrade
                    const currentVersion = db.version;
                    db.close();
                    
                    console.log('🔄 Creating missing object store without deleting data...');
                    
                    // Force version upgrade to create missing object store
                    const upgradeRequest = indexedDB.open(`${dbName}_BlobStorage`, currentVersion + 1);
                    
                    upgradeRequest.onupgradeneeded = (e) => {
                        const upgradeDb = e.target.result;
                        console.log('📦 Upgrade: Creating database object store');
                        
                        if (!upgradeDb.objectStoreNames.contains('database')) {
                            upgradeDb.createObjectStore('database');
                            console.log('✅ Object store "database" created');
                        }
                    };
                    
                    upgradeRequest.onsuccess = () => {
                        console.log('✅ IndexedDB upgraded successfully');
                        upgradeRequest.result.close();
                        // Retry save with new object store
                        indexedDbSave(dbName, data).then(resolve).catch(reject);
                    };
                    
                    upgradeRequest.onerror = () => {
                        console.error('❌ Failed to upgrade IndexedDB');
                        reject(new Error('Failed to create IndexedDB object store'));
                    };
                    return;
                }
                
                try {
                    const transaction = db.transaction(['database'], 'readwrite');
                    const store = transaction.objectStore('database');
                    
                    const blob = new Blob([data], { type: 'application/x-sqlite3' });
                    store.put(blob, 'sqliteDb');
                    
                    transaction.oncomplete = () => {
                        console.log('💾 Database saved to IndexedDB');
                        db.close();
                        resolve(true);
                    };
                    
                    transaction.onerror = () => {
                        console.error('❌ IndexedDB transaction error:', transaction.error);
                        db.close();
                        reject(transaction.error);
                    };
                } catch (txError) {
                    console.error('❌ IndexedDB transaction creation failed:', txError);
                    db.close();
                    reject(txError);
                }
            };
            
            request.onerror = () => {
                console.error('❌ IndexedDB open failed:', request.error);
                reject(request.error);
            };
        } catch (error) {
            console.error('❌ IndexedDB save exception:', error);
            reject(error);
        }
    });
}

async function indexedDbLoad(dbName) {
    return new Promise((resolve, reject) => {
        try {
            const request = indexedDB.open(`${dbName}_BlobStorage`);
            
            request.onsuccess = (event) => {
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains('database')) {
                    db.close();
                    resolve(null);
                    return;
                }
                
                const transaction = db.transaction(['database'], 'readonly');
                const store = transaction.objectStore('database');
                const getRequest = store.get('sqliteDb');
                
                getRequest.onsuccess = async () => {
                    if (getRequest.result) {
                        const buffer = await getRequest.result.arrayBuffer();
                        console.log('📂 Database loaded from IndexedDB');
                        db.close();
                        resolve(new Uint8Array(buffer));
                    } else {
                        db.close();
                        resolve(null);
                    }
                };
                
                getRequest.onerror = () => {
                    db.close();
                    reject(getRequest.error);
                };
            };
            
            request.onerror = () => {
                reject(request.error);
            };
        } catch (error) {
            reject(error);
        }
    });
}

// ===================================
// ELECTRON FILE SYSTEM (UNLIMITED SIZE!)
// Production-grade with automatic backups
// ===================================

async function electronSave(dbName, data) {
    try {
        if (!window.electronAPI) {
            throw new Error('Electron API not available');
        }
        
        const sizeInMB = data.length / (1024 * 1024);
        console.log(`💾 Saving database to file (${sizeInMB.toFixed(2)}MB)...`);
        
        // PRE-SAVE VALIDATION: Check SQLite magic number
        const dataArray = Array.isArray(data) ? new Uint8Array(data) : data;
        
        // Check 1: Data has content
        if (!dataArray || dataArray.length === 0) {
            throw new Error('Cannot save empty database');
        }
        
        // Check 2: SQLite magic bytes ("SQLite format 3")
        const header = String.fromCharCode.apply(null, dataArray.slice(0, 15));
        if (!header.startsWith('SQLite format 3')) {
            console.error('❌ PRE-SAVE VALIDATION FAILED: Invalid SQLite header');
            console.error('Header bytes:', dataArray.slice(0, 16));
            throw new Error(`Cannot save corrupted database - invalid header: "${header}"`);
        }
        
        console.log('✅ Pre-save validation passed');
        
        // Save to file system (with atomic write in electron-main.js)
        const saveResult = await window.electronAPI.saveDatabase(data);
        
        if (!saveResult.success) {
            throw new Error(saveResult.error);
        }
        
        console.log(`✅ Database saved to: ${saveResult.path} (${sizeInMB.toFixed(2)}MB)`);
        
        // Auto-backup on every save
        await createAutoBackup(data);
        
        return true;
    } catch (error) {
        console.error('❌ Electron file save failed:', error);
        throw error;
    }
}

async function electronLoad(dbName) {
    try {
        if (!window.electronAPI) {
            throw new Error('Electron API not available');
        }
        
        console.log('📂 Loading database from file...');
        
        const loadResult = await window.electronAPI.loadDatabase();
        
        if (!loadResult.success || !loadResult.data) {
            // Normal on first run - database will be created
            return null;
        }
        
        const buffer = new Uint8Array(loadResult.data);
        const sizeInMB = buffer.length / (1024 * 1024);
        
        console.log(`✅ Database loaded from file (${sizeInMB.toFixed(2)}MB)`);
        
        return buffer;
    } catch (error) {
        console.error('❌ Electron file load failed:', error);
        return null;
    }
}

/**
 * Create automatic backup
 */
async function createAutoBackup(data) {
    try {
        if (!window.electronAPI || !window.electronAPI.createBackup) {
            return;
        }
        
        const backupResult = await window.electronAPI.createBackup(data);
        
        if (backupResult.success) {
            const sizeInMB = backupResult.size / (1024 * 1024);
            console.log(`💾 Auto-backup created (${sizeInMB.toFixed(2)}MB)`);
            
            // Clean old backups (keep 30 days, min 3)
            await window.electronAPI.cleanOldBackups();
        }
    } catch (error) {
        console.warn('⚠️ Auto-backup failed (non-critical):', error);
    }
}

/**
 * Migrate existing LocalStorage data to file system
 */
async function migrateLocalStorageToFile() {
    try {
        if (!window.electronAPI) {
            return false;
        }
        
        console.log('🔄 Checking for LocalStorage data to migrate...');
        
        // Check if we already migrated
        const migrated = localStorage.getItem('migrated_to_file');
        if (migrated === 'true') {
            console.log('✅ Already migrated to file storage');
            return true;
        }
        
        // Try to load from localStorage
        const localStorageData = localStorage.getItem(`${GLOBAL_DB_KEY}_sqljs`);
        
        if (localStorageData) {
            console.log('📦 Found LocalStorage data, migrating to file...');
            
            const buffer = new Uint8Array(JSON.parse(localStorageData));
            const saveResult = await window.electronAPI.saveDatabase(buffer);
            
            if (saveResult.success) {
                // Mark as migrated
                localStorage.setItem('migrated_to_file', 'true');
                
                // Create initial backup
                await createAutoBackup(buffer);
                
                console.log('✅ Migration complete! Data now in file system.');
                console.log(`📁 Database location: ${saveResult.path}`);
                
                // Optionally clear localStorage (keep for safety for now)
                // localStorage.removeItem(`${GLOBAL_DB_KEY}_sqljs`);
                
                return true;
            }
        } else {
            console.log('ℹ️ No LocalStorage data to migrate');
            localStorage.setItem('migrated_to_file', 'true');
        }
        
        return false;
    } catch (error) {
        console.error('❌ Migration failed:', error);
        return false;
    }
}

// ===================================
// LOCALSTORAGE FALLBACK (< 5MB)
// ===================================

async function localStorageSave(dbName, data) {
    try {
        // Check size (localStorage limit is typically 5-10MB)
        const sizeInMB = data.length / (1024 * 1024);
        
        if (sizeInMB > 5) {
            console.warn(`⚠️ Database size (${sizeInMB.toFixed(2)}MB) exceeds localStorage recommended limit`);
            throw new Error('Database too large for localStorage');
        }
        
        const buffer = Array.from(data);
        localStorage.setItem(`${dbName}_sqljs`, JSON.stringify(buffer));
        
        console.log(`💾 Database saved to localStorage (${sizeInMB.toFixed(2)}MB)`);
        return true;
    } catch (error) {
        console.error('localStorage save failed:', error);
        throw error;
    }
}

async function localStorageLoad(dbName) {
    try {
        const saved = localStorage.getItem(`${dbName}_sqljs`);
        
        if (saved) {
            const buffer = new Uint8Array(JSON.parse(saved));
            console.log('📂 Database loaded from localStorage');
            return buffer;
        }
        
        return null;
    } catch (error) {
        console.error('localStorage load failed:', error);
        return null;
    }
}

// ===================================
// UNIFIED STORAGE INTERFACE
// ===================================

async function saveToStorage(dbName, data) {
    // Initialize storage type on first use
    if (!currentStorageType) {
        currentStorageType = detectPlatform();
    }
    
    try {
        switch (currentStorageType) {
            case STORAGE_TYPES.ELECTRON_FS:
                return await electronSave(dbName, data);
            
            case STORAGE_TYPES.FILE_SYSTEM_API:
                return await fileSystemApiSave(dbName, data);
            
            case STORAGE_TYPES.INDEXEDDB:
                return await indexedDbSave(dbName, data);
            
            case STORAGE_TYPES.LOCALSTORAGE:
                return await localStorageSave(dbName, data);
            
            default:
                throw new Error('No storage method available');
        }
    } catch (error) {
        // Try fallback storage
        console.warn(`Primary storage failed, attempting fallback...`);
        
        if (currentStorageType !== STORAGE_TYPES.LOCALSTORAGE) {
            try {
                return await localStorageSave(dbName, data);
            } catch (fallbackError) {
                console.error('All storage methods failed');
                throw fallbackError;
            }
        }
        
        throw error;
    }
}

async function loadFromStorage(dbName) {
    console.log('🔍 CRITICAL: Starting data recovery load process...');
    
    // STEP -1: Auto-migrate from localStorage to Electron file system (if applicable)
    if (window.electronAPI) {
        console.log('🖥️ Electron detected, checking for migration...');
        await migrateLocalStorageToFile();
    }
    
    // Initialize storage type if needed
    if (!currentStorageType) {
        currentStorageType = detectPlatform();
    }
    
    // STEP 0: Load from primary storage (Electron file or browser storage)
    console.log('📦 Step 0: Loading from primary storage...');
    try {
        let primaryData = null;
        
        switch (currentStorageType) {
            case STORAGE_TYPES.ELECTRON_FS:
                primaryData = await electronLoad(dbName);
                break;
            
            case STORAGE_TYPES.FILE_SYSTEM_API:
                primaryData = await fileSystemApiLoad(dbName);
                break;
            
            case STORAGE_TYPES.INDEXEDDB:
                primaryData = await indexedDbLoad(dbName);
                break;
            
            case STORAGE_TYPES.LOCALSTORAGE:
                primaryData = await localStorageLoad(dbName);
                break;
        }
        
        if (primaryData && primaryData.length > 1000) {
            const sizeKB = (primaryData.length / 1024).toFixed(2);
            console.log(`✅ FOUND DATA in primary storage! Size: ${sizeKB} KB`);
            return primaryData;
        }
    } catch (error) {
        console.error('⚠️ Primary storage load failed:', error);
    }
    
    // STEP 1: Check GLOBAL key first (cross-path compatible)
    console.log('📦 Step 1: Checking GLOBAL storage key...');
    const globalData = localStorage.getItem(`${GLOBAL_DB_KEY}_sqljs`);
    if (globalData && globalData.length > 1000) {
        try {
            const data = new Uint8Array(JSON.parse(globalData));
            console.log('✅ FOUND GLOBAL DATA! Size:', (data.length / 1024).toFixed(2), 'KB');
            return data;
        } catch (e) {
            console.log('⚠️ Could not parse GLOBAL data');
        }
    }
    
    // STEP 2: Check localStorage with original key (most reliable for web browsers)
    console.log('📦 Step 2: Checking localStorage primary storage...');
    const localStorageData = await localStorageLoad(dbName);
    if (localStorageData && localStorageData.length > 1000) {
        console.log('✅ FOUND DATA in localStorage! Size:', (localStorageData.length / 1024).toFixed(2), 'KB');
        // Also save to GLOBAL key for future cross-path access
        try {
            localStorage.setItem(`${GLOBAL_DB_KEY}_sqljs`, JSON.stringify(Array.from(localStorageData)));
            console.log('📋 Copied to GLOBAL key for cross-path access');
        } catch (e) {}
        return localStorageData;
    } else if (localStorageData) {
        console.log('⚠️ localStorage has small/empty DB, checking backups...');
    } else {
        console.log('❌ No data in localStorage primary storage');
    }
    
    // STEP 3: Check localStorage BACKUP
    console.log('📦 Step 3: Checking localStorage backup...');
    try {
        const backupStr = localStorage.getItem(`${dbName}_latest_backup`);
        if (backupStr) {
            const backup = JSON.parse(backupStr);
            if (backup.data && backup.data.length > 1000) {
                console.log('✅ FOUND DATA in localStorage backup! Size:', (backup.data.length / 1024).toFixed(2), 'KB');
                console.log('📅 Backup timestamp:', new Date(backup.timestamp));
                return new Uint8Array(backup.data);
            }
        } else {
            console.log('❌ No backup found in localStorage');
        }
    } catch (e) {
        console.log('❌ Backup check failed:', e);
    }
    
    // STEP 4: Check GLOBAL backup
    console.log('📦 Step 4: Checking GLOBAL backup...');
    try {
        const globalBackupStr = localStorage.getItem(`${GLOBAL_DB_KEY}_latest_backup`);
        if (globalBackupStr) {
            const backup = JSON.parse(globalBackupStr);
            if (backup.data && backup.data.length > 1000) {
                console.log('✅ FOUND DATA in GLOBAL backup! Size:', (backup.data.length / 1024).toFixed(2), 'KB');
                return new Uint8Array(backup.data);
            }
        }
    } catch (e) {}
    
    // STEP 5: Initialize storage type if needed
    if (!currentStorageType) {
        currentStorageType = detectPlatform();
        console.log('🔧 Detected platform:', currentStorageType);
    }
    
    // STEP 4: Check platform-specific storage (IndexedDB, Electron, etc)
    console.log('📦 Step 3: Checking platform storage:', currentStorageType);
    try {
        let primaryData = null;
        
        switch (currentStorageType) {
            case STORAGE_TYPES.ELECTRON_FS:
                primaryData = await electronLoad(dbName);
                break;
            
            case STORAGE_TYPES.FILE_SYSTEM_API:
                primaryData = await fileSystemApiLoad(dbName);
                break;
            
            case STORAGE_TYPES.INDEXEDDB:
                primaryData = await indexedDbLoad(dbName);
                break;
            
            case STORAGE_TYPES.LOCALSTORAGE:
                primaryData = localStorageData;
                break;
            
            default:
                primaryData = null;
        }
        
        if (primaryData && primaryData.length > 1000) {
            console.log('✅ FOUND DATA in', currentStorageType, '! Size:', (primaryData.length / 1024).toFixed(2), 'KB');
            return primaryData;
        } else if (primaryData) {
            console.log('⚠️', currentStorageType, 'has small/empty DB');
        } else {
            console.log('❌ No data in', currentStorageType);
        }
        
    } catch (error) {
        console.error('❌ Platform storage load failed:', error);
    }
    
    // STEP 5: Search ALL locations for any data (cross-path recovery)
    console.log('📦 Step 4: Cross-path data search...');
    const allData = await findAllExistingData();
    if (allData.length > 0) {
        console.log('✅ FOUND DATA from cross-path search! Size:', (allData[0].size / 1024).toFixed(2), 'KB');
        return allData[0].data;
    }
    
    // STEP 6: No data found anywhere
    console.log('⚠️ No existing database found in any storage location');
    console.log('ℹ️ A new database will be created');
    return null;
}

function getStorageInfo() {
    return {
        type: currentStorageType,
        description: getStorageDescription(currentStorageType),
        isElectron: currentStorageType === STORAGE_TYPES.ELECTRON_FS,
        hasUnlimitedStorage: currentStorageType === STORAGE_TYPES.ELECTRON_FS || 
                             currentStorageType === STORAGE_TYPES.FILE_SYSTEM_API
    };
}

function getStorageDescription(type) {
    const descriptions = {
        [STORAGE_TYPES.ELECTRON_FS]: 'Electron Native File System (Unlimited)',
        [STORAGE_TYPES.FILE_SYSTEM_API]: 'Browser File System API (Unlimited)',
        [STORAGE_TYPES.INDEXEDDB]: 'IndexedDB Blob Storage (~1GB)',
        [STORAGE_TYPES.LOCALSTORAGE]: 'localStorage (5-10MB limit)'
    };
    
    return descriptions[type] || 'Unknown';
}

// ===================================
// EXPORT TO WINDOW
// ===================================

if (typeof window !== 'undefined') {
    window.saveToStorage = saveToStorage;
    window.loadFromStorage = loadFromStorage;
    window.getStorageInfo = getStorageInfo;
    window.findAllExistingData = findAllExistingData;
    window.STORAGE_TYPES = STORAGE_TYPES;
}

console.log('📦 Storage manager loaded');
console.log('🔧 Detected platform:', detectPlatform());
