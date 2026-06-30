/**
 * ===================================
 * AYN BEIRUT POS - TEST RUNNER
 * Main test execution file
 * ===================================
 */

console.log('🧪 Starting POS Test Suite...\n');

// Reset test results
TestUtils.resetTestResults();

/**
 * Run all tests sequentially
 */
async function runAllTests() {
    try {
        console.log('═'.repeat(70));
        console.log('🏁 AYN BEIRUT POS - COMPREHENSIVE TEST SUITE');
        console.log('═'.repeat(70));
        
        // Run phonebook tests
        if (typeof window.phonebookTests !== 'undefined') {
            await window.phonebookTests.run();
        } else {
            console.warn('⚠️  Phonebook tests not loaded');
        }
        
        // Run bill payment tests
        if (typeof window.billPaymentTests !== 'undefined') {
            await window.billPaymentTests.run();
        } else {
            console.warn('⚠️  Bill payment tests not loaded');
        }
        
        // Generate final report
        console.log('\n\n');
        console.log('═'.repeat(70));
        console.log('📊 FINAL TEST REPORT');
        console.log('═'.repeat(70));
        
        const report = TestUtils.generateTestReport();
        
        // Summary
        console.log('\n🎯 TEST SUMMARY:');
        console.log(`   Total Tests: ${report.summary.total}`);
        console.log(`   ✅ Passed: ${report.summary.passed}`);
        console.log(`   ❌ Failed: ${report.summary.failed}`);
        console.log(`   📈 Pass Rate: ${report.summary.passRate}`);
        
        // Failed tests detail
        if (report.summary.failed > 0) {
            console.log('\n❌ FAILED TESTS:');
            report.tests
                .filter(t => t.status === 'FAIL')
                .forEach((test, index) => {
                    console.log(`\n${index + 1}. ${test.name}`);
                    console.log(`   Expected: ${JSON.stringify(test.expected)}`);
                    console.log(`   Actual: ${JSON.stringify(test.actual)}`);
                });
        }
        
        console.log('\n' + '═'.repeat(70));
        
        // Return report for programmatic use
        return report;
        
    } catch (error) {
        console.error('💥 Test suite failed with error:', error);
        throw error;
    }
}

// Auto-run if in test mode
if (window.location.search.includes('test=true')) {
    window.addEventListener('load', () => {
        setTimeout(runAllTests, 1000);
    });
}

// Export for manual execution
window.runAllTests = runAllTests;

console.log('✅ Test runner loaded. Run with: runAllTests()');
