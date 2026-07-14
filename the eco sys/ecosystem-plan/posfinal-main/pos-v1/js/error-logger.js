// Emergency error logger - logs all errors to prevent reload
(function() {
    const errors = [];
    const originalError = console.error;
    
    console.error = function(...args) {
        errors.push({
            time: new Date().toISOString(),
            message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
        });
        
        // Log to console as well
        originalError.apply(console, args);
        
        // If we have 3+ errors, block any reload and show them
        if (errors.length >= 3) {
            // Override location.reload to prevent it
            location.reload = function() {
                alert(
                    'RELOAD BLOCKED - ERRORS DETECTED:\n\n' +
                    errors.map((e, i) => `${i + 1}. ${e.message}`).join('\n\n') +
                    '\n\nPlease take a screenshot of this message.'
                );
            };
        }
    };
    
    // Catch unhandled errors
    window.addEventListener('error', (event) => {
        errors.push({
            time: new Date().toISOString(),
            message: `Unhandled: ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`
        });
    });
    
    // Make errors accessible
    window.APP_ERRORS = errors;
})();
