// ===================================
// AYN BEIRUT POS - DATABASE WEB WORKER
// Async query execution to prevent UI blocking
// ===================================

// This worker handles heavy database operations
// Messages: { type, sql, params, id }
// Responses: { success, result, error, id }

let db = null;
let SQL = null;

// Initialize SQL.js in worker context
self.addEventListener('message', async function(e) {
    const { type, sql, params, id } = e.data;
    
    try {
        switch (type) {
            case 'init':
                await initializeDatabase(e.data.dbBuffer);
                self.postMessage({ success: true, id });
                break;
            
            case 'query':
                const result = executeQuery(sql, params);
                self.postMessage({ success: true, result, id });
                break;
            
            case 'exec':
                executeExec(sql, params);
                self.postMessage({ success: true, id });
                break;
            
            case 'export':
                const buffer = db.export();
                self.postMessage({ success: true, result: buffer, id }, [buffer.buffer]);
                break;
            
            default:
                throw new Error(`Unknown operation: ${type}`);
        }
    } catch (error) {
        self.postMessage({ 
            success: false, 
            error: error.message, 
            id 
        });
    }
});

async function initializeDatabase(dbBuffer) {
    // Import SQL.js
    importScripts('https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js');
    
    SQL = await initSqlJs({
        locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
    });
    
    if (dbBuffer) {
        db = new SQL.Database(new Uint8Array(dbBuffer));
    } else {
        db = new SQL.Database();
    }
    
    console.log('[Worker] Database initialized');
}

function executeQuery(sql, params = []) {
    if (!db) throw new Error('Database not initialized');
    
    const stmt = db.prepare(sql);
    stmt.bind(params);
    
    const results = [];
    while (stmt.step()) {
        results.push(stmt.getAsObject());
    }
    stmt.free();
    
    return results;
}

function executeExec(sql, params = []) {
    if (!db) throw new Error('Database not initialized');
    db.run(sql, params);
}

console.log('[Worker] Database worker ready');
