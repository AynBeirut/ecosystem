/**
 * ===================================
 * AYN BEIRUT POS - LOGGING SYSTEM
 * Centralized Logging with IndexedDB Persistence
 * ===================================
 */

// Log levels
const LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    CRITICAL: 4
};

const LogLevelNames = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'];
const LogLevelEmojis = ['🔍', 'ℹ️', '⚠️', '❌', '💥'];
const LogLevelColors = ['#888', '#2196f3', '#ff9800', '#f44336', '#9c27b0'];

// Configuration
let currentLogLevel = LogLevel.INFO; // Default log level
let enableConsoleLogging = true;
let enableIndexedDBLogging = true;
let maxLogsInMemory = 1000;

// In-memory log storage
const logsInMemory = [];

// Performance tracking
const performanceMetrics = new Map();

/**
 * Initialize IndexedDB for log storage
 */
let logDB = null;

async function initLogDB() {
    if (logDB) return logDB;

    return new Promise((resolve, reject) => {
        const request = indexedDB.open('POS_Logs', 1);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            logDB = request.result;
            resolve(logDB);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // Create logs object store
            if (!db.objectStoreNames.contains('logs')) {
                const logsStore = db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
                logsStore.createIndex('timestamp', 'timestamp', { unique: false });
                logsStore.createIndex('level', 'level', { unique: false });
                logsStore.createIndex('module', 'module', { unique: false });
            }

            // Create performance metrics store
            if (!db.objectStoreNames.contains('performance')) {
                const perfStore = db.createObjectStore('performance', { keyPath: 'id', autoIncrement: true });
                perfStore.createIndex('operation', 'operation', { unique: false });
                perfStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
    });
}

/**
 * Save log to IndexedDB
 */
async function saveLogToIndexedDB(logEntry) {
    if (!enableIndexedDBLogging) return;

    try {
        const db = await initLogDB();
        const transaction = db.transaction(['logs'], 'readwrite');
        const store = transaction.objectStore('logs');
        
        await store.add(logEntry);

        // Auto-cleanup old logs (keep last 5000)
        const count = await store.count();
        if (count > 5000) {
            const oldLogsRequest = store.index('timestamp').openCursor();
            let deleted = 0;
            oldLogsRequest.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && deleted < 1000) {
                    cursor.delete();
                    deleted++;
                    cursor.continue();
                }
            };
        }
    } catch (error) {
        console.warn('Failed to save log to IndexedDB:', error);
    }
}

/**
 * Core logging function
 */
function log(level, message, data = {}, module = 'POS') {
    if (level < currentLogLevel) return; // Skip if below current log level

    const logEntry = {
        timestamp: Date.now(),
        level,
        levelName: LogLevelNames[level],
        message,
        data,
        module,
        url: window.location.href,
        userAgent: navigator.userAgent
    };

    // Add to in-memory storage
    logsInMemory.unshift(logEntry);
    if (logsInMemory.length > maxLogsInMemory) {
        logsInMemory.pop();
    }

    // Console output
    if (enableConsoleLogging) {
        const emoji = LogLevelEmojis[level];
        const color = LogLevelColors[level];
        const style = `color: ${color}; font-weight: bold;`;

        console.log(
            `%c${emoji} [${logEntry.levelName}] [${module}]`,
            style,
            message,
            data
        );
    }

    // Persist to IndexedDB (async, don't wait)
    if (enableIndexedDBLogging) {
        saveLogToIndexedDB(logEntry).catch(err => {
            console.warn('Log persistence failed:', err);
        });
    }

    return logEntry;
}

/**
 * Convenience logging methods
 */
const Logger = {
    debug: (message, data, module) => log(LogLevel.DEBUG, message, data, module),
    info: (message, data, module) => log(LogLevel.INFO, message, data, module),
    warn: (message, data, module) => log(LogLevel.WARN, message, data, module),
    error: (message, data, module) => log(LogLevel.ERROR, message, data, module),
    critical: (message, data, module) => log(LogLevel.CRITICAL, message, data, module),

    /**
     * Set log level
     */
    setLevel: (level) => {
        currentLogLevel = level;
        log(LogLevel.INFO, `Log level changed to ${LogLevelNames[level]}`);
    },

    /**
     * Get in-memory logs
     */
    getLogs: (filters = {}) => {
        let filtered = [...logsInMemory];

        if (filters.level !== undefined) {
            filtered = filtered.filter(l => l.level >= filters.level);
        }
        if (filters.module) {
            filtered = filtered.filter(l => l.module === filters.module);
        }
        if (filters.startTime) {
            filtered = filtered.filter(l => l.timestamp >= filters.startTime);
        }
        if (filters.endTime) {
            filtered = filtered.filter(l => l.timestamp <= filters.endTime);
        }

        return filtered;
    },

    /**
     * Get logs from IndexedDB
     */
    getLogsFromDB: async (filters = {}) => {
        try {
            const db = await initLogDB();
            const transaction = db.transaction(['logs'], 'readonly');
            const store = transaction.objectStore('logs');

            return new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => {
                    let logs = request.result;

                    // Apply filters
                    if (filters.level !== undefined) {
                        logs = logs.filter(l => l.level >= filters.level);
                    }
                    if (filters.module) {
                        logs = logs.filter(l => l.module === filters.module);
                    }
                    if (filters.limit) {
                        logs = logs.slice(0, filters.limit);
                    }

                    resolve(logs);
                };
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Failed to retrieve logs from DB:', error);
            return [];
        }
    },

    /**
     * Clear logs
     */
    clearLogs: async () => {
        logsInMemory.length = 0;

        try {
            const db = await initLogDB();
            const transaction = db.transaction(['logs'], 'readwrite');
            const store = transaction.objectStore('logs');
            await store.clear();
            log(LogLevel.INFO, 'All logs cleared');
        } catch (error) {
            console.error('Failed to clear logs from DB:', error);
        }
    },

    /**
     * Export logs
     */
    exportLogs: async (format = 'json') => {
        const logs = await Logger.getLogsFromDB({ limit: 5000 });

        let content, mimeType, extension;

        if (format === 'json') {
            content = JSON.stringify(logs, null, 2);
            mimeType = 'application/json';
            extension = 'json';
        } else if (format === 'csv') {
            const headers = ['Timestamp', 'Level', 'Module', 'Message', 'Data'];
            const rows = logs.map(l => [
                new Date(l.timestamp).toISOString(),
                l.levelName,
                l.module,
                l.message,
                JSON.stringify(l.data)
            ]);
            content = [headers, ...rows].map(row => row.join(',')).join('\n');
            mimeType = 'text/csv';
            extension = 'csv';
        } else if (format === 'txt') {
            content = logs.map(l => 
                `[${new Date(l.timestamp).toISOString()}] [${l.levelName}] [${l.module}] ${l.message} ${JSON.stringify(l.data)}`
            ).join('\n');
            mimeType = 'text/plain';
            extension = 'txt';
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pos-logs-${Date.now()}.${extension}`;
        a.click();
        URL.revokeObjectURL(url);

        log(LogLevel.INFO, `Logs exported as ${format.toUpperCase()}`);
    },

    /**
     * Performance tracking
     */
    startTimer: (operation) => {
        performanceMetrics.set(operation, performance.now());
    },

    endTimer: (operation) => {
        const startTime = performanceMetrics.get(operation);
        if (!startTime) {
            console.warn(`No start time found for operation: ${operation}`);
            return;
        }

        const duration = performance.now() - startTime;
        performanceMetrics.delete(operation);

        // Log performance
        log(LogLevel.DEBUG, `Performance: ${operation}`, { duration: `${duration.toFixed(2)}ms` }, 'Performance');

        // Save to IndexedDB
        savePerformanceMetric(operation, duration);

        return duration;
    },

    /**
     * Get performance metrics
     */
    getPerformanceMetrics: async () => {
        try {
            const db = await initLogDB();
            const transaction = db.transaction(['performance'], 'readonly');
            const store = transaction.objectStore('performance');

            return new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Failed to get performance metrics:', error);
            return [];
        }
    }
};

/**
 * Save performance metric
 */
async function savePerformanceMetric(operation, duration) {
    try {
        const db = await initLogDB();
        const transaction = db.transaction(['performance'], 'readwrite');
        const store = transaction.objectStore('performance');

        await store.add({
            operation,
            duration,
            timestamp: Date.now()
        });
    } catch (error) {
        console.warn('Failed to save performance metric:', error);
    }
}

/**
 * Wrap function with performance tracking
 */
function withPerformanceTracking(fn, operationName) {
    return async function(...args) {
        const name = operationName || fn.name || 'anonymous';
        Logger.startTimer(name);
        try {
            return await fn.apply(this, args);
        } finally {
            Logger.endTimer(name);
        }
    };
}

// Initialize on load
initLogDB().catch(err => {
    console.warn('Failed to initialize log database:', err);
});

// Export
window.Logger = Logger;
window.LogLevel = LogLevel;
window.withPerformanceTracking = withPerformanceTracking;

console.log('✅ Logging system initialized');
Logger.info('POS Logging System Ready', { version: '1.0.0' }, 'Logger');
