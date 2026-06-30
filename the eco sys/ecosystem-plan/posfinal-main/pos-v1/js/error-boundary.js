/**
 * ===================================
 * AYN BEIRUT POS - ERROR BOUNDARY
 * Global Error Handling System
 * ===================================
 */

// Error log storage
const errorLog = [];
const MAX_ERROR_LOG_SIZE = 100;

/**
 * Error severity levels
 */
const ErrorSeverity = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
};

/**
 * Log error to console and storage
 */
function logError(error, context = {}, severity = ErrorSeverity.MEDIUM) {
    const errorEntry = {
        timestamp: Date.now(),
        message: error.message || String(error),
        stack: error.stack || '',
        context,
        severity,
        userAgent: navigator.userAgent,
        url: window.location.href
    };

    // Add to error log
    errorLog.unshift(errorEntry);
    
    // Keep log size manageable
    if (errorLog.length > MAX_ERROR_LOG_SIZE) {
        errorLog.pop();
    }

    // Store in localStorage for persistence
    try {
        const storedErrors = JSON.parse(localStorage.getItem('pos_error_log') || '[]');
        storedErrors.unshift(errorEntry);
        localStorage.setItem('pos_error_log', JSON.stringify(storedErrors.slice(0, 50)));
    } catch (e) {
        console.warn('Failed to store error in localStorage:', e);
    }

    // Console output
    const emoji = {
        [ErrorSeverity.LOW]: '⚠️',
        [ErrorSeverity.MEDIUM]: '⚠️',
        [ErrorSeverity.HIGH]: '🔴',
        [ErrorSeverity.CRITICAL]: '💥'
    }[severity];

    console.error(`${emoji} [${severity.toUpperCase()}] Error:`, error);
    console.error('Context:', context);

    return errorEntry;
}

/**
 * Wrap async function with error boundary
 */
function withErrorBoundary(fn, context = {}) {
    return async function(...args) {
        try {
            return await fn.apply(this, args);
        } catch (error) {
            logError(error, {
                ...context,
                function: fn.name,
                arguments: args
            }, ErrorSeverity.HIGH);

            // Show user-friendly error
            if (typeof showNotification === 'function') {
                showNotification(
                    `An error occurred: ${error.message || 'Unknown error'}`,
                    'error'
                );
            } else {
                alert(`Error: ${error.message || 'Something went wrong'}`);
            }

            // Re-throw if critical
            if (context.critical) {
                throw error;
            }

            return null;
        }
    };
}

/**
 * Wrap sync function with error boundary
 */
function withSyncErrorBoundary(fn, context = {}) {
    return function(...args) {
        try {
            return fn.apply(this, args);
        } catch (error) {
            logError(error, {
                ...context,
                function: fn.name,
                arguments: args
            }, ErrorSeverity.MEDIUM);

            if (typeof showNotification === 'function') {
                showNotification(
                    `An error occurred: ${error.message || 'Unknown error'}`,
                    'error'
                );
            }

            return null;
        }
    };
}

/**
 * Validate form data
 */
function validateFormData(formId, rules) {
    const form = document.getElementById(formId);
    if (!form) {
        throw new Error(`Form not found: ${formId}`);
    }

    const errors = [];
    const data = {};

    for (const [fieldName, rule] of Object.entries(rules)) {
        const field = form.elements[fieldName];
        if (!field) {
            errors.push(`Field not found: ${fieldName}`);
            continue;
        }

        const value = field.value.trim();
        data[fieldName] = value;

        // Required validation
        if (rule.required && !value) {
            errors.push(`${rule.label || fieldName} is required`);
            field.classList.add('error');
            continue;
        } else {
            field.classList.remove('error');
        }

        // Min length validation
        if (rule.minLength && value.length < rule.minLength) {
            errors.push(`${rule.label || fieldName} must be at least ${rule.minLength} characters`);
            field.classList.add('error');
        }

        // Max length validation
        if (rule.maxLength && value.length > rule.maxLength) {
            errors.push(`${rule.label || fieldName} must be at most ${rule.maxLength} characters`);
            field.classList.add('error');
        }

        // Pattern validation
        if (rule.pattern && value && !rule.pattern.test(value)) {
            errors.push(`${rule.label || fieldName} has invalid format`);
            field.classList.add('error');
        }

        // Custom validation
        if (rule.validate && value) {
            const customError = rule.validate(value);
            if (customError) {
                errors.push(customError);
                field.classList.add('error');
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        data
    };
}

/**
 * Network error handler with retry
 */
async function withNetworkRetry(fn, options = {}) {
    const {
        maxRetries = 3,
        retryDelay = 1000,
        exponentialBackoff = true
    } = options;

    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            
            // Don't retry if not a network error
            if (!error.message.includes('network') && 
                !error.message.includes('fetch') &&
                !error.message.includes('timeout')) {
                throw error;
            }

            if (attempt < maxRetries) {
                const delay = exponentialBackoff 
                    ? retryDelay * Math.pow(2, attempt)
                    : retryDelay;
                
                console.log(`🔄 Retrying after ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    // All retries failed
    logError(lastError, {
        operation: fn.name,
        maxRetries,
        message: 'All retry attempts failed'
    }, ErrorSeverity.HIGH);

    throw lastError;
}

/**
 * Database operation wrapper with error handling
 */
async function safeDbOperation(operation, errorMessage = 'Database operation failed') {
    try {
        return await operation();
    } catch (error) {
        logError(error, {
            operation: 'database',
            errorMessage
        }, ErrorSeverity.HIGH);

        if (typeof showNotification === 'function') {
            showNotification(errorMessage, 'error');
        }

        // Check if database is corrupted
        if (error.message.includes('corrupt') || error.message.includes('malformed')) {
            console.error('💥 Database corruption detected!');
            if (confirm('Database may be corrupted. Would you like to reset the database? (This will delete all data)')) {
                try {
                    localStorage.removeItem('pos_database');
                    location.reload();
                } catch (e) {
                    console.error('Failed to reset database:', e);
                }
            }
        }

        return null;
    }
}

/**
 * Global error handler
 */
window.addEventListener('error', (event) => {
    logError(event.error || new Error(event.message), {
        type: 'uncaught',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
    }, ErrorSeverity.CRITICAL);
});

/**
 * Global promise rejection handler
 */
window.addEventListener('unhandledrejection', (event) => {
    logError(event.reason || new Error('Unhandled promise rejection'), {
        type: 'unhandled-promise',
        promise: event.promise
    }, ErrorSeverity.CRITICAL);
});

/**
 * Get error log
 */
function getErrorLog(limit = 50) {
    return errorLog.slice(0, limit);
}

/**
 * Clear error log
 */
function clearErrorLog() {
    errorLog.length = 0;
    try {
        localStorage.removeItem('pos_error_log');
    } catch (e) {
        console.warn('Failed to clear error log from localStorage:', e);
    }
}

/**
 * Export error log
 */
function exportErrorLog() {
    const log = {
        exported: new Date().toISOString(),
        errors: errorLog,
        system: {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            online: navigator.onLine
        }
    };

    const blob = new Blob([JSON.stringify(log, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pos-error-log-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * Check system health
 */
function checkSystemHealth() {
    const health = {
        database: false,
        localStorage: false,
        network: navigator.onLine,
        errors: errorLog.length,
        criticalErrors: errorLog.filter(e => e.severity === ErrorSeverity.CRITICAL).length
    };

    try {
        localStorage.setItem('health_check', 'ok');
        localStorage.removeItem('health_check');
        health.localStorage = true;
    } catch (e) {
        health.localStorage = false;
    }

    try {
        if (typeof runQuery === 'function') {
            runQuery('SELECT 1');
            health.database = true;
        }
    } catch (e) {
        health.database = false;
    }

    return health;
}

// Add error style to document
const errorStyle = document.createElement('style');
errorStyle.textContent = `
    .error {
        border-color: #f44336 !important;
        background-color: rgba(244, 67, 54, 0.1) !important;
    }
    
    .error-message {
        color: #f44336;
        font-size: 0.85em;
        margin-top: 4px;
        display: block;
    }
`;
document.head.appendChild(errorStyle);

// Export error boundary utilities
window.ErrorBoundary = {
    logError,
    withErrorBoundary,
    withSyncErrorBoundary,
    validateFormData,
    withNetworkRetry,
    safeDbOperation,
    getErrorLog,
    clearErrorLog,
    exportErrorLog,
    checkSystemHealth,
    ErrorSeverity
};

console.log('✅ Error boundary system initialized');
