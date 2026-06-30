/**
 * Date Filter Debug Test
 * Load this script in the console to debug the date filter issue
 */

console.clear();
console.log('🔍 DATE FILTER DEBUG TEST');
console.log('========================\n');

// Test 1: Check if sales exist
async function testSalesExist() {
    console.log('Test 1: Checking if sales exist in database...');
    try {
        const result = await runQuery('SELECT COUNT(*) as count FROM sales');
        const count = result[0]?.values[0]?.[0] || 0;
        console.log('✅ Total sales found:', count);
        
        if (count > 0) {
            // Get date range
            const dates = await runQuery('SELECT MIN(date(timestamp)) as oldest, MAX(date(timestamp)) as newest FROM sales');
            const oldest = dates[0]?.values[0]?.[0];
            const newest = dates[0]?.values[0]?.[1];
            console.log('📅 Sales date range:', oldest, 'to', newest);
        } else {
            console.log('⚠️ No sales in database');
        }
    } catch (err) {
        console.error('❌ Error checking sales:', err);
    }
}

// Test 2: Check current filters
function testCurrentFilters() {
    console.log('\nTest 2: Current filter state...');
    console.log('activeFilters:', window.activeFilters);
    console.log('currentPeriod:', window.currentPeriod);
}

// Test 3: Check date inputs
function testDateInputs() {
    console.log('\nTest 3: Date input values...');
    const startInput = document.getElementById('filter-start-date');
    const endInput = document.getElementById('filter-end-date');
    console.log('Start date input:', startInput?.value);
    console.log('End date input:', endInput?.value);
}

// Test 4: Try loading today's data
async function testLoadToday() {
    console.log('\nTest 4: Loading today\'s sales...');
    try {
        const sales = await getSalesForPeriod('today');
        console.log('✅ Today\'s sales loaded:', sales.length);
        if (sales.length > 0) {
            console.log('Sample sale:', sales[0]);
        }
    } catch (err) {
        console.error('❌ Error loading today:', err);
    }
}

// Test 5: Try custom date range
async function testCustomRange() {
    console.log('\nTest 5: Testing custom date range...');
    try {
        // Set dates to cover last 30 days
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        
        console.log('Testing range:', startDate.toLocaleDateString(), 'to', endDate.toLocaleDateString());
        
        // Set activeFilters manually
        window.activeFilters = {
            startDate: startDate,
            endDate: endDate,
            customerId: null,
            productId: null,
            supplierId: null,
            reportType: 'custom'
        };
        
        const sales = await getSalesForPeriod('custom');
        console.log('✅ Custom range sales loaded:', sales.length);
        if (sales.length > 0) {
            console.log('Sample sale:', sales[0]);
        }
    } catch (err) {
        console.error('❌ Error loading custom range:', err);
    }
}

// Run all tests
async function runAllTests() {
    await testSalesExist();
    testCurrentFilters();
    testDateInputs();
    await testLoadToday();
    await testCustomRange();
    
    console.log('\n========================');
    console.log('🏁 Tests Complete!');
    console.log('If you see sales in database but not in reports, there\'s a filter bug.');
}

// Make functions available globally
window.testDateFilter = runAllTests;
window.testSalesExist = testSalesExist;
window.testLoadToday = testLoadToday;
window.testCustomRange = testCustomRange;

console.log('\n📋 Commands available:');
console.log('  testDateFilter()     - Run all tests');
console.log('  testSalesExist()     - Check if sales exist');
console.log('  testLoadToday()      - Test today\'s filter');
console.log('  testCustomRange()    - Test custom date range');
console.log('\n💡 Run: testDateFilter()\n');
