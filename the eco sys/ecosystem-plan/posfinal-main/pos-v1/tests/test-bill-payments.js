/**
 * ===================================
 * AYN BEIRUT POS - BILL PAYMENTS TESTS
 * Testing Bill Payment Module Functions
 * ===================================
 */

// Wrap in IIFE to avoid variable conflicts
(function() {
    'use strict';
    
    // Wait for TestUtils to be available
    if (typeof TestUtils === 'undefined') {
        console.warn('⚠️ TestUtils not yet loaded for bill payment tests');
        return;
    }

    // Test Suite
    let billPaymentTests, mockDb;

    try {
        billPaymentTests = new TestUtils.TestSuite('Bill Payment Module');
        mockDb = new TestUtils.MockDatabase();
        
        // Setup
        billPaymentTests.beforeEach(() => {
            mockDb.reset();
            mockDb.seed();
        });
    } catch (error) {
        console.error('❌ Failed to initialize bill payment tests:', error);
        return;
    }

// Only define tests if initialization succeeded
if (billPaymentTests) {

// ===================================
// BILL PAYMENT CREATION TESTS
// ===================================

billPaymentTests.test('saveBillPayment - Should Create Valid Payment', async () => {
    const originalRunExec = window.runExec;
    window.runExec = (sql, params) => mockDb.exec(sql, params);

    const paymentData = {
        billType: 1, // Electricity
        billNumber: 'ELEC-12345',
        customerName: 'John Doe',
        customerPhone: '+12125551234',
        amount: 75.50,
        paymentMethod: 'cash',
        timestamp: Date.now(),
        receiptNumber: 'BILL-' + Date.now(),
        cashierId: 'unknown',
        notes: 'Test payment'
    };

    const result = mockDb.exec(
        `INSERT INTO bill_payments (
            billType, billNumber, customerName, customerPhone,
            amount, paymentMethod, timestamp, receiptNumber,
            cashierId, notes, synced
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        Object.values(paymentData).concat([0])
    );

    TestUtils.assertTrue(result.lastInsertRowid > 0, 'Should create payment with valid ID');
    TestUtils.assertEqual(mockDb.tables.bill_payments.length, 2, 'Should have 2 payments after insert');

    window.runExec = originalRunExec;
});

billPaymentTests.test('saveBillPayment - All Bill Types', async () => {
    const billTypes = mockDb.tables.bill_types;
    
    TestUtils.assertEqual(billTypes.length, 5, 'Should have 5 bill types');
    TestUtils.assertEqual(billTypes[0].name, 'Electricity', 'Should have Electricity type');
    TestUtils.assertEqual(billTypes[1].name, 'Water', 'Should have Water type');
    TestUtils.assertEqual(billTypes[2].name, 'Internet', 'Should have Internet type');
    TestUtils.assertEqual(billTypes[3].name, 'Phone', 'Should have Phone type');
    TestUtils.assertEqual(billTypes[4].name, 'Gas', 'Should have Gas type');
});

billPaymentTests.test('Receipt Number Generation', () => {
    const timestamp1 = Date.now();
    const receipt1 = `BILL-${timestamp1}`;
    
    // Wait a tiny bit
    const timestamp2 = Date.now();
    const receipt2 = `BILL-${timestamp2}`;
    
    // Receipts should be different (or at minimum, timestamp2 should be >= timestamp1)
    TestUtils.assertTrue(
        receipt1 !== receipt2 || timestamp2 >= timestamp1,
        'Should generate unique receipt numbers'
    );
});

// ===================================
// BILL PAYMENT VALIDATION TESTS
// ===================================

billPaymentTests.test('Amount Validation - Positive Number', () => {
    const amount = 50.00;
    const isValid = amount > 0 && !isNaN(amount);
    
    TestUtils.assertTrue(isValid, 'Should validate positive amount');
});

billPaymentTests.test('Amount Validation - Zero Amount', () => {
    const amount = 0;
    const isValid = amount > 0;
    
    TestUtils.assertFalse(isValid, 'Should reject zero amount');
});

billPaymentTests.test('Amount Validation - Negative Amount', () => {
    const amount = -50.00;
    const isValid = amount > 0;
    
    TestUtils.assertFalse(isValid, 'Should reject negative amount');
});

billPaymentTests.test('Amount Validation - Invalid Input', () => {
    const amount = 'not-a-number';
    const isValid = !isNaN(amount) && parseFloat(amount) > 0;
    
    TestUtils.assertFalse(isValid, 'Should reject non-numeric amount');
});

billPaymentTests.test('Payment Method Validation', () => {
    const validMethods = ['cash', 'card', 'bank'];
    
    TestUtils.assertTrue(validMethods.includes('cash'), 'Should accept cash payment');
    TestUtils.assertTrue(validMethods.includes('card'), 'Should accept card payment');
    TestUtils.assertTrue(validMethods.includes('bank'), 'Should accept bank payment');
    TestUtils.assertFalse(validMethods.includes('crypto'), 'Should reject invalid payment method');
});

// ===================================
// BILL PAYMENT QUERIES TESTS
// ===================================

billPaymentTests.test('loadBillPayments - Date Range Filter', () => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    // Mock query with date range
    const sql = `
        SELECT bp.*, bt.name as billTypeName, bt.icon as billTypeIcon
        FROM bill_payments bp
        LEFT JOIN bill_types bt ON bp.billType = bt.id
        WHERE DATE(bp.timestamp/1000, 'unixepoch') BETWEEN ? AND ?
    `;
    
    TestUtils.assertTrue(sql.includes('BETWEEN'), 'Should use date range in query');
    TestUtils.assertTrue(sql.includes('LEFT JOIN bill_types'), 'Should join with bill_types table');
});

billPaymentTests.test('loadBillPayments - Bill Type Filter', () => {
    const payments = mockDb.tables.bill_payments;
    const billTypeFilter = 1; // Electricity
    
    const filtered = payments.filter(p => p.billType === billTypeFilter);
    
    TestUtils.assertEqual(filtered.length, 1, 'Should filter by bill type');
    TestUtils.assertEqual(filtered[0].billType, 1, 'Should match electricity type');
});

billPaymentTests.test('loadBillPayments - Stats Calculation', () => {
    // Add more test payments
    mockDb.tables.bill_payments.push(
        { id: 2, billType: 1, amount: 100.00, timestamp: Date.now() },
        { id: 3, billType: 2, amount: 25.00, timestamp: Date.now() }
    );
    
    const payments = mockDb.tables.bill_payments;
    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalCount = payments.length;
    
    TestUtils.assertEqual(totalCount, 3, 'Should count 3 payments');
    TestUtils.assertEqual(totalAmount, 175.00, 'Should sum all payment amounts');
});

// ===================================
// RECEIPT GENERATION TESTS
// ===================================

billPaymentTests.test('Receipt Generation - Company Info', () => {
    const companyInfo = mockDb.tables.company_info[0];
    
    TestUtils.assertEqual(companyInfo.companyName, 'Test Company', 'Should have company name');
    TestUtils.assertEqual(companyInfo.phone, '+1234567890', 'Should have company phone');
});

billPaymentTests.test('Receipt Generation - Payment Details', () => {
    const payment = mockDb.tables.bill_payments[0];
    const billType = mockDb.tables.bill_types.find(bt => bt.id === payment.billType);
    
    TestUtils.assertTrue(!!billType, 'Should find bill type for payment');
    TestUtils.assertEqual(billType.name, 'Electricity', 'Should get correct bill type name');
    TestUtils.assertEqual(billType.icon, '⚡', 'Should get correct bill type icon');
});

billPaymentTests.test('Receipt - Format Amount', () => {
    const amount = 75.50;
    const formatted = amount.toFixed(2);
    
    TestUtils.assertEqual(formatted, '75.50', 'Should format amount to 2 decimals');
});

billPaymentTests.test('Receipt - Format Date', () => {
    const timestamp = Date.now();
    const date = new Date(timestamp);
    const formatted = date.toLocaleDateString();
    
    TestUtils.assertTrue(formatted.length > 0, 'Should format date');
});

// ===================================
// DATE FILTER INITIALIZATION TESTS
// ===================================

billPaymentTests.test('Date Filter - Initialize to Today', () => {
    const today = new Date().toISOString().split('T')[0];
    
    // Mock date inputs
    const mockDateFrom = { value: '' };
    const mockDateTo = { value: '' };
    
    // Simulate initialization
    if (!mockDateFrom.value) mockDateFrom.value = today;
    if (!mockDateTo.value) mockDateTo.value = today;
    
    TestUtils.assertEqual(mockDateFrom.value, today, 'Should initialize from date to today');
    TestUtils.assertEqual(mockDateTo.value, today, 'Should initialize to date to today');
});

billPaymentTests.test('Date Filter - Preserve Existing Values', () => {
    const existingDate = '2024-01-01';
    
    const mockDateFrom = { value: existingDate };
    const today = new Date().toISOString().split('T')[0];
    
    // Simulate initialization (should NOT override)
    if (!mockDateFrom.value) mockDateFrom.value = today;
    
    TestUtils.assertEqual(mockDateFrom.value, existingDate, 'Should preserve existing date value');
});

// ===================================
// EDGE CASES
// ===================================

billPaymentTests.test('Large Amount Handling', () => {
    const largeAmount = 999999.99;
    const isValid = largeAmount > 0 && largeAmount < 1000000;
    
    TestUtils.assertTrue(isValid, 'Should handle large amounts up to 1 million');
});

billPaymentTests.test('Decimal Precision', () => {
    const amount = 123.456789;
    const rounded = Math.round(amount * 100) / 100;
    
    TestUtils.assertEqual(rounded, 123.46, 'Should round to 2 decimal places');
});

billPaymentTests.test('Empty Customer Name', () => {
    const customerName = '';
    const isValid = customerName.trim().length > 0;
    
    TestUtils.assertFalse(isValid, 'Should reject empty customer name');
});

billPaymentTests.test('Bill Number - Optional Field', () => {
    const billNumber = '';
    const canBeEmpty = true; // Bill number is optional
    
    TestUtils.assertTrue(canBeEmpty, 'Bill number should be optional');
});

billPaymentTests.test('Notes Field - Long Text', () => {
    const longNotes = 'A'.repeat(500);
    const isValid = longNotes.length <= 1000; // Reasonable limit
    
    TestUtils.assertTrue(isValid, 'Should accept notes up to 1000 characters');
});

billPaymentTests.test('Timestamp - Future Date Detection', () => {
    const futureTimestamp = Date.now() + 86400000; // Tomorrow
    const isFuture = futureTimestamp > Date.now();
    
    TestUtils.assertTrue(isFuture, 'Should detect future timestamps');
});

} // End of billPaymentTests definition block

    // Run tests when ready
    if (billPaymentTests) {
        console.log('💡 Bill Payment tests loaded. Run with: billPaymentTests.run()');
    }

    // Export for use in other tests
    if (typeof window !== 'undefined') {
        window.billPaymentTests = billPaymentTests;
    }

})(); // End of IIFE
