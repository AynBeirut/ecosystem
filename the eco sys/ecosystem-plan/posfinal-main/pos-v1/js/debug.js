// Quick debug - load this first
console.log('=== DEBUG: Checking dependencies ===');
console.log('initSqlJs available:', typeof initSqlJs !== 'undefined');
console.log('updateLoadingText function:', typeof updateLoadingText !== 'undefined');
console.log('SQL variable:', typeof SQL);

// Add timeout warning
setTimeout(() => {
    console.warn('⚠️ 3 seconds elapsed - check if page is stuck');
}, 3000);

setTimeout(() => {
    console.error('❌ 10 seconds elapsed - something is hanging!');
    console.error('Check Network tab (F12) for stuck requests');
}, 10000);
