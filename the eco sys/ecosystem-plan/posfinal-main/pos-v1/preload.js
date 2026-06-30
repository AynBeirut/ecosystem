/**
 * Preload Script for Ayn Beirut POS Electron App
 * This script safely exposes Electron APIs to the renderer process
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Printing functionality
    print: (htmlContent) => {
        ipcRenderer.send('print-receipt', htmlContent);
    },
    
    // File-based database operations
    saveDatabase: (data, path) => ipcRenderer.invoke('save-database', data, path),
    loadDatabase: (path) => ipcRenderer.invoke('load-database', path),
    getDatabasePath: () => ipcRenderer.invoke('get-database-path'),
    checkDriveExists: (driveLetter) => ipcRenderer.invoke('check-drive-exists', driveLetter),
    
    // Backup management
    createBackup: (data) => ipcRenderer.invoke('create-backup', data),
    listBackups: () => ipcRenderer.invoke('list-backups'),
    restoreBackup: (backupPath) => ipcRenderer.invoke('restore-backup', backupPath),
    cleanOldBackups: () => ipcRenderer.invoke('clean-old-backups'),
    
    // Customer display management
    openCustomerDisplay: (config) => ipcRenderer.invoke('open-customer-display', config),
    closeCustomerDisplay: () => ipcRenderer.invoke('close-customer-display'),
    updateCustomerDisplay: (cartData) => ipcRenderer.invoke('update-customer-display', cartData),
    
    // Listen for cart updates (for customer display window)
    onCartUpdate: (callback) => ipcRenderer.on('cart-update', (event, data) => callback(data))
});
