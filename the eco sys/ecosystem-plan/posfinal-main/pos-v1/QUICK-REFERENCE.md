# QUICK REFERENCE GUIDE
## AYN BEIRUT POS - Developer & Admin Guide

---

## 🧪 RUNNING TESTS

### Automatic Test Execution:
```
Open: index.html?test=true
```
Tests run automatically on page load

### Manual Test Execution:
```javascript
// Run all tests
runAllTests()

// Run specific test suites
phonebookTests.run()
billPaymentTests.run()

// Get test results
console.log(TestUtils.testResults)
```

### Test Results:
- ✅ Green = Pass
- ❌ Red = Fail
- Results shown in console with details

---

## 🛡️ ERROR HANDLING

### Wrap Functions with Error Boundary:
```javascript
// Async function
const safeFunction = withErrorBoundary(myAsyncFunction, {
    module: 'ModuleName',
    critical: false  // Set true to re-throw errors
});

// Sync function
const safeSync = withSyncErrorBoundary(mySyncFunction, {
    module: 'ModuleName'
});
```

### Form Validation:
```javascript
const validation = validateFormData('form-id', {
    name: { 
        required: true, 
        minLength: 2,
        maxLength: 100,
        label: 'Customer Name'
    },
    email: {
        required: false,
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        label: 'Email'
    }
});

if (!validation.valid) {
    alert(validation.errors.join('\n'));
    return;
}

// Use validated data
const data = validation.data;
```

### Network Retry:
```javascript
await withNetworkRetry(async () => {
    return await fetch('/api/endpoint');
}, {
    maxRetries: 3,
    retryDelay: 1000,
    exponentialBackoff: true
});
```

### Check System Health:
```javascript
const health = ErrorBoundary.checkSystemHealth();
console.log(health);
// { database: true, localStorage: true, network: true, errors: 5, criticalErrors: 0 }
```

### View Error Log:
```javascript
const errors = ErrorBoundary.getErrorLog(50);  // Last 50 errors
ErrorBoundary.exportErrorLog();  // Download as JSON
ErrorBoundary.clearErrorLog();   // Clear all errors
```

---

## 📊 LOGGING

### Log Messages:
```javascript
Logger.debug('Detailed debug info', { data }, 'ModuleName');
Logger.info('General information', { data }, 'ModuleName');
Logger.warn('Warning message', { data }, 'ModuleName');
Logger.error('Error occurred', { error }, 'ModuleName');
Logger.critical('Critical failure', { reason }, 'ModuleName');
```

### Set Log Level:
```javascript
Logger.setLevel(LogLevel.DEBUG);  // Show all logs
Logger.setLevel(LogLevel.INFO);   // Production (default)
Logger.setLevel(LogLevel.ERROR);  // Only errors
```

### Performance Tracking:
```javascript
// Manual timing
Logger.startTimer('operationName');
// ... do work ...
const duration = Logger.endTimer('operationName');

// Automatic timing
const trackedFn = withPerformanceTracking(expensiveFunction, 'OperationName');
await trackedFn();  // Automatically logs duration
```

### View Logs:
```javascript
// Get from memory (last 1000)
const logs = Logger.getLogs({
    level: LogLevel.ERROR,     // Filter by level
    module: 'Phonebook',       // Filter by module
    startTime: yesterday,      // Time range start
    endTime: today             // Time range end
});

// Get from IndexedDB (last 5000)
const dbLogs = await Logger.getLogsFromDB({
    level: LogLevel.WARN,
    module: 'BillPayments',
    limit: 100
});
```

### Export Logs:
```javascript
await Logger.exportLogs('json');  // Download JSON
await Logger.exportLogs('csv');   // Download CSV
await Logger.exportLogs('txt');   // Download text
```

### Clear Logs:
```javascript
await Logger.clearLogs();  // Clears memory and IndexedDB
```

---

## 💾 DATABASE MANAGEMENT

### Backup Database:
```javascript
await backupDatabase();
// Downloads: pos-backup-{timestamp}.db
// Also saves emergency backup to localStorage
```

### Restore Database:
```javascript
// Via UI: Admin Dashboard → Database → Select Backup File
// Via code:
await restoreDatabase(fileObject);
```

### Rollback Migration:
```javascript
// Via UI: Admin Dashboard → Database → Rollback to Version 1
// Via code:
await rollbackMigration(1);  // Target version
```

### Database Info:
```javascript
// Check schema version
const version = runQuery('SELECT version FROM schema_version')[0].version;

// Get database size
const dbData = localStorage.getItem('pos_database');
const sizeKB = (dbData.length / 1024).toFixed(2);

// Last backup
const lastBackup = localStorage.getItem('pos_backup_timestamp');
const backupDate = new Date(parseInt(lastBackup));
```

---

## 🔧 UTILITY FUNCTIONS

### HTML Escaping (XSS Protection):
```javascript
const safeText = escapeHtml(userInput);
// Converts: <script>alert('xss')</script>
// To: &lt;script&gt;alert('xss')&lt;/script&gt;
```

### Show Notification:
```javascript
showNotification('Operation successful', 'success');  // Green
showNotification('Something went wrong', 'error');    // Red
showNotification('Please note...', 'info');           // Blue
```

### Phone Validation (E.164):
```javascript
const result = validateAndFormatPhone('+1-212-555-1234');
console.log(result);
// {
//   valid: true,
//   formatted: '+1 (212) 555-1234',
//   normalized: '+12125551234'
// }
```

### Get Current User:
```javascript
const user = getCurrentUser();
console.log(user);
// { id, username, role, status }
```

### Get Cashier ID:
```javascript
const cashierId = typeof getCashierId === 'function' ? getCashierId() : 'unknown';
```

---

## 🎨 CSS CLASSES

### Phonebook Cards:
```html
<div class="phonebook-grid">
    <div class="phonebook-card">
        <div class="phonebook-card-header">
            <h4>Client Name</h4>
            <div class="phonebook-card-actions">
                <button class="btn-edit">Edit</button>
                <button class="btn-delete">Delete</button>
            </div>
        </div>
        <div class="phonebook-info">
            <div class="phonebook-info-row">
                <span class="phonebook-info-label">Phone:</span>
                <span>+1 (212) 555-1234</span>
            </div>
        </div>
    </div>
</div>
```

### Error Styling:
```html
<input type="text" class="error">  <!-- Red border -->
<span class="error-message">Field is required</span>  <!-- Red text -->
```

---

## 🚀 PRODUCTION DEPLOYMENT

### Pre-Deployment Checklist:
```javascript
// 1. Run all tests
await runAllTests();

// 2. Check for errors
const errors = Logger.getLogs({ level: LogLevel.ERROR });
console.log(`Found ${errors.length} errors`);

// 3. Create backup
await backupDatabase();

// 4. Check system health
const health = ErrorBoundary.checkSystemHealth();
if (!health.database || !health.localStorage) {
    alert('System health check failed!');
}

// 5. Set production log level
Logger.setLevel(LogLevel.INFO);
```

### Post-Deployment Monitoring:
```javascript
// Check error rate
const criticalErrors = Logger.getLogs({ 
    level: LogLevel.CRITICAL,
    startTime: Date.now() - 86400000  // Last 24 hours
});

// Check performance
const metrics = await Logger.getPerformanceMetrics();

// Export logs for analysis
await Logger.exportLogs('json');
```

---

## 📱 ADMIN DASHBOARD ACCESS

### Navigation:
1. Login as admin user
2. Click gear icon (⚙️) in top right
3. Select tab:
   - 📊 Overview - System statistics
   - 🏢 Company Info - Business details
   - 👥 Users - User management
   - 📞 Phonebook - Client registry
   - 💡 Bill Types - Payment types
   - 💾 Database - Backup/restore/rollback

### Database Tab Features:
- **Backup:** One-click database download
- **Restore:** Upload .db file to restore
- **Rollback:** Revert to previous schema version
- **Info:** View version, size, last backup date

---

## 🔑 KEYBOARD SHORTCUTS

### Test Execution:
- **Open with tests:** Add `?test=true` to URL
- **Console tests:** Press F12, type `runAllTests()`

### Developer Tools:
- **F12** - Open browser console
- **Ctrl+Shift+I** - Open DevTools
- **Ctrl+R** - Reload page
- **Ctrl+Shift+R** - Hard reload (clear cache)

---

## 🆘 TROUBLESHOOTING

### Database Corrupted:
```javascript
// 1. Check health
const health = ErrorBoundary.checkSystemHealth();

// 2. Try to backup first
try {
    await backupDatabase();
} catch (e) {
    console.error('Backup failed:', e);
}

// 3. Restore from backup
// Admin Dashboard → Database → Select Backup File

// 4. Last resort: Clear database
if (confirm('Reset database? All data will be lost!')) {
    localStorage.removeItem('pos_database');
    location.reload();
}
```

### Tests Failing:
```javascript
// 1. Check error details
await runAllTests();
const failed = TestUtils.testResults.tests.filter(t => t.status === 'FAIL');
console.table(failed);

// 2. Run individual test
phonebookTests.run();

// 3. Reset test results
TestUtils.resetTestResults();
```

### Performance Issues:
```javascript
// 1. Check performance metrics
const metrics = await Logger.getPerformanceMetrics();
console.table(metrics);

// 2. Find slow operations
const slow = metrics.filter(m => m.duration > 1000);  // >1 second
console.log('Slow operations:', slow);

// 3. Enable debug logging
Logger.setLevel(LogLevel.DEBUG);
```

### High Error Rate:
```javascript
// 1. Export error log
ErrorBoundary.exportErrorLog();

// 2. Check critical errors
const critical = ErrorBoundary.getErrorLog().filter(
    e => e.severity === ErrorSeverity.CRITICAL
);

// 3. Review recent errors
Logger.getLogs({ 
    level: LogLevel.ERROR,
    startTime: Date.now() - 3600000  // Last hour
});
```

---

## 📞 SUPPORT

### Log Collection for Bug Reports:
```javascript
// Collect all diagnostic info
const diagnostics = {
    timestamp: new Date().toISOString(),
    systemHealth: ErrorBoundary.checkSystemHealth(),
    errorLog: ErrorBoundary.getErrorLog(20),
    recentLogs: Logger.getLogs({ limit: 50 }),
    performanceMetrics: await Logger.getPerformanceMetrics(),
    databaseInfo: {
        version: runQuery('SELECT version FROM schema_version')[0].version,
        size: (localStorage.getItem('pos_database').length / 1024).toFixed(2) + ' KB'
    }
};

// Export for support
console.log(JSON.stringify(diagnostics, null, 2));
// Copy and paste to support ticket
```

---

**Last Updated:** December 11, 2025
**Version:** 1.0.0
**Support:** See IMPLEMENTATION-COMPLETE.md for full documentation
