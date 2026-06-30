/**
 * ===================================
 * AYN BEIRUT POS - TEST UTILITIES
 * Testing Framework for POS System
 * ===================================
 */

// Test Results Storage
const testResults = {
    passed: 0,
    failed: 0,
    total: 0,
    tests: []
};

/**
 * Assert function for testing
 */
function assert(condition, testName, expected, actual) {
    testResults.total++;
    
    if (condition) {
        testResults.passed++;
        testResults.tests.push({
            name: testName,
            status: 'PASS',
            expected,
            actual
        });
        console.log(`✅ PASS: ${testName}`);
        return true;
    } else {
        testResults.failed++;
        testResults.tests.push({
            name: testName,
            status: 'FAIL',
            expected,
            actual
        });
        console.error(`❌ FAIL: ${testName}`);
        console.error(`   Expected: ${JSON.stringify(expected)}`);
        console.error(`   Actual: ${JSON.stringify(actual)}`);
        return false;
    }
}

/**
 * Assert equality
 */
function assertEqual(actual, expected, testName) {
    const condition = JSON.stringify(actual) === JSON.stringify(expected);
    return assert(condition, testName, expected, actual);
}

/**
 * Assert truthy
 */
function assertTrue(value, testName) {
    return assert(!!value, testName, 'truthy', value);
}

/**
 * Assert falsy
 */
function assertFalse(value, testName) {
    return assert(!value, testName, 'falsy', value);
}

/**
 * Assert throws error
 */
function assertThrows(fn, testName) {
    try {
        fn();
        return assert(false, testName, 'error thrown', 'no error');
    } catch (error) {
        return assert(true, testName, 'error thrown', error.message);
    }
}

/**
 * Mock database for testing
 */
class MockDatabase {
    constructor() {
        this.tables = {
            phonebook: [],
            bill_payments: [],
            bill_types: [
                { id: 1, name: 'Electricity', icon: '⚡' },
                { id: 2, name: 'Water', icon: '💧' },
                { id: 3, name: 'Internet', icon: '🌐' },
                { id: 4, name: 'Phone', icon: '📱' },
                { id: 5, name: 'Gas', icon: '🔥' }
            ],
            users: [
                { id: 1, username: 'admin', role: 'admin', status: 'active' }
            ],
            company_info: [
                { id: 1, companyName: 'Test Company', phone: '+1234567890' }
            ]
        };
        this.queryLog = [];
        this.execLog = [];
    }

    /**
     * Mock runQuery
     */
    query(sql, params = []) {
        this.queryLog.push({ sql, params });
        
        // Simple mock implementation for common queries
        if (sql.includes('SELECT * FROM phonebook')) {
            return this.tables.phonebook;
        }
        if (sql.includes('SELECT * FROM bill_payments')) {
            return this.tables.bill_payments;
        }
        if (sql.includes('SELECT * FROM bill_types')) {
            return this.tables.bill_types;
        }
        if (sql.includes('SELECT * FROM users')) {
            return this.tables.users;
        }
        if (sql.includes('SELECT * FROM company_info')) {
            return this.tables.company_info;
        }
        
        return [];
    }

    /**
     * Mock runExec
     */
    exec(sql, params = []) {
        this.execLog.push({ sql, params });
        
        // Simple mock implementation for common operations
        if (sql.includes('INSERT INTO phonebook')) {
            const id = this.tables.phonebook.length + 1;
            this.tables.phonebook.push({ id, ...params });
            return { lastInsertRowid: id };
        }
        if (sql.includes('INSERT INTO bill_payments')) {
            const id = this.tables.bill_payments.length + 1;
            this.tables.bill_payments.push({ id, ...params });
            return { lastInsertRowid: id };
        }
        if (sql.includes('UPDATE phonebook')) {
            // Mock update
            return { changes: 1 };
        }
        if (sql.includes('DELETE FROM phonebook')) {
            // Mock delete
            const beforeLength = this.tables.phonebook.length;
            this.tables.phonebook = this.tables.phonebook.filter(item => item.id !== params[0]);
            return { changes: beforeLength - this.tables.phonebook.length };
        }
        
        return { changes: 0 };
    }

    /**
     * Reset database
     */
    reset() {
        this.tables.phonebook = [];
        this.tables.bill_payments = [];
        this.queryLog = [];
        this.execLog = [];
    }

    /**
     * Seed test data
     */
    seed() {
        this.tables.phonebook = [
            { id: 1, name: 'John Doe', phone: '+12125551234', email: 'john@example.com' },
            { id: 2, name: 'Jane Smith', phone: '+14155555678', email: 'jane@example.com' }
        ];
        this.tables.bill_payments = [
            { id: 1, billType: 1, amount: 50.00, customerName: 'Test User', timestamp: Date.now() }
        ];
    }
}

/**
 * Test Suite Runner
 */
class TestSuite {
    constructor(name) {
        this.name = name;
        this.tests = [];
        this.beforeEachFn = null;
        this.afterEachFn = null;
    }

    /**
     * Add a test
     */
    test(name, fn) {
        this.tests.push({ name, fn });
    }

    /**
     * Before each test
     */
    beforeEach(fn) {
        this.beforeEachFn = fn;
    }

    /**
     * After each test
     */
    afterEach(fn) {
        this.afterEachFn = fn;
    }

    /**
     * Run all tests in suite
     */
    async run() {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`🧪 Running Test Suite: ${this.name}`);
        console.log('='.repeat(60));

        for (const test of this.tests) {
            console.log(`\n📝 Test: ${test.name}`);
            
            if (this.beforeEachFn) {
                await this.beforeEachFn();
            }

            try {
                await test.fn();
            } catch (error) {
                console.error(`💥 Test threw unexpected error: ${error.message}`);
                testResults.failed++;
                testResults.total++;
            }

            if (this.afterEachFn) {
                await this.afterEachFn();
            }
        }

        console.log(`\n${'='.repeat(60)}`);
        console.log(`✅ Passed: ${testResults.passed}`);
        console.log(`❌ Failed: ${testResults.failed}`);
        console.log(`📊 Total: ${testResults.total}`);
        console.log('='.repeat(60));
    }
}

/**
 * Generate test report
 */
function generateTestReport() {
    const report = {
        timestamp: new Date().toISOString(),
        summary: {
            total: testResults.total,
            passed: testResults.passed,
            failed: testResults.failed,
            passRate: ((testResults.passed / testResults.total) * 100).toFixed(2) + '%'
        },
        tests: testResults.tests
    };

    console.log('\n📄 TEST REPORT');
    console.log('='.repeat(60));
    console.log(JSON.stringify(report, null, 2));
    
    return report;
}

/**
 * Reset test results
 */
function resetTestResults() {
    testResults.passed = 0;
    testResults.failed = 0;
    testResults.total = 0;
    testResults.tests = [];
}

// Export test utilities
window.TestUtils = {
    assert,
    assertEqual,
    assertTrue,
    assertFalse,
    assertThrows,
    MockDatabase,
    TestSuite,
    generateTestReport,
    resetTestResults,
    testResults
};

console.log('✅ Test utilities loaded');
