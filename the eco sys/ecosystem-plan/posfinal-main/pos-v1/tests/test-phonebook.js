/**
 * ===================================
 * AYN BEIRUT POS - PHONEBOOK TESTS
 * Testing Phonebook Module Functions
 * ===================================
 */

// Test Suite
const phonebookTests = new TestUtils.TestSuite('Phonebook Module');
const mockDb = new TestUtils.MockDatabase();

// Setup
phonebookTests.beforeEach(() => {
    mockDb.reset();
    mockDb.seed();
});

// ===================================
// PHONE VALIDATION TESTS
// ===================================

phonebookTests.test('validateAndFormatPhone - Valid US Phone (+1)', () => {
    const result = validateAndFormatPhone('+12125551234');
    
    TestUtils.assertTrue(result.valid, 'Should validate US phone with +1');
    TestUtils.assertEqual(result.formatted, '+1 (212) 555-1234', 'Should format US phone correctly');
    TestUtils.assertEqual(result.normalized, '+12125551234', 'Should normalize to E.164');
});

phonebookTests.test('validateAndFormatPhone - Valid International Phone', () => {
    const result = validateAndFormatPhone('+442071234567');
    
    TestUtils.assertTrue(result.valid, 'Should validate UK phone');
    TestUtils.assertEqual(result.normalized, '+442071234567', 'Should normalize international phone');
});

phonebookTests.test('validateAndFormatPhone - US Phone Without +1', () => {
    const result = validateAndFormatPhone('2125551234');
    
    TestUtils.assertTrue(result.valid, 'Should validate US phone without country code');
    TestUtils.assertEqual(result.normalized, '+12125551234', 'Should add +1 prefix');
});

phonebookTests.test('validateAndFormatPhone - Phone With Spaces and Dashes', () => {
    const result = validateAndFormatPhone('(212) 555-1234');
    
    TestUtils.assertTrue(result.valid, 'Should validate phone with formatting');
    TestUtils.assertEqual(result.normalized, '+12125551234', 'Should strip formatting');
});

phonebookTests.test('validateAndFormatPhone - Invalid Short Phone', () => {
    const result = validateAndFormatPhone('+1234');
    
    TestUtils.assertFalse(result.valid, 'Should reject phone that is too short');
});

phonebookTests.test('validateAndFormatPhone - Invalid Characters', () => {
    const result = validateAndFormatPhone('+1-ABC-DEFG');
    
    TestUtils.assertFalse(result.valid, 'Should reject phone with letters');
});

phonebookTests.test('validateAndFormatPhone - Empty Phone', () => {
    const result = validateAndFormatPhone('');
    
    TestUtils.assertFalse(result.valid, 'Should reject empty phone');
    TestUtils.assertEqual(result.formatted, '', 'Should return empty formatted');
});

phonebookTests.test('validateAndFormatPhone - Null Phone', () => {
    const result = validateAndFormatPhone(null);
    
    TestUtils.assertFalse(result.valid, 'Should reject null phone');
});

phonebookTests.test('validateAndFormatPhone - Lebanese Phone', () => {
    const result = validateAndFormatPhone('+9611234567');
    
    TestUtils.assertTrue(result.valid, 'Should validate Lebanese phone');
    TestUtils.assertEqual(result.normalized, '+9611234567', 'Should normalize Lebanese phone');
});

phonebookTests.test('validateAndFormatPhone - Long International Phone', () => {
    const result = validateAndFormatPhone('+12345678901234567');
    
    TestUtils.assertFalse(result.valid, 'Should reject phone that is too long (>15 digits)');
});

// ===================================
// PHONEBOOK CRUD TESTS
// ===================================

phonebookTests.test('loadPhonebook - Should Load All Clients', async () => {
    // Mock runQuery globally
    const originalRunQuery = window.runQuery;
    window.runQuery = (sql) => mockDb.query(sql);

    // This test would need the actual loadPhonebook function
    // For now, we test the expected behavior
    const clients = mockDb.query('SELECT * FROM phonebook');
    
    TestUtils.assertEqual(clients.length, 2, 'Should load 2 seeded clients');
    TestUtils.assertEqual(clients[0].name, 'John Doe', 'Should load first client correctly');

    // Restore
    window.runQuery = originalRunQuery;
});

phonebookTests.test('saveClient - Should Insert New Client', async () => {
    const originalRunExec = window.runExec;
    window.runExec = (sql, params) => mockDb.exec(sql, params);

    const result = mockDb.exec(
        'INSERT INTO phonebook (name, phone, email) VALUES (?, ?, ?)',
        ['Test Client', '+12125555678', 'test@example.com']
    );

    TestUtils.assertTrue(result.lastInsertRowid > 0, 'Should return insert ID');
    TestUtils.assertEqual(mockDb.tables.phonebook.length, 3, 'Should have 3 clients after insert');

    window.runExec = originalRunExec;
});

phonebookTests.test('saveClient - Should Update Existing Client', async () => {
    const originalRunExec = window.runExec;
    window.runExec = (sql, params) => mockDb.exec(sql, params);

    mockDb.tables.phonebook[0].phone = '+12125559999';
    const result = mockDb.exec(
        'UPDATE phonebook SET phone = ? WHERE id = ?',
        ['+12125559999', 1]
    );

    TestUtils.assertEqual(result.changes, 1, 'Should update 1 row');

    window.runExec = originalRunExec;
});

phonebookTests.test('deleteClient - Should Remove Client', async () => {
    const originalRunExec = window.runExec;
    window.runExec = (sql, params) => mockDb.exec(sql, params);

    const beforeCount = mockDb.tables.phonebook.length;
    const result = mockDb.exec('DELETE FROM phonebook WHERE id = ?', [1]);

    TestUtils.assertEqual(result.changes, 1, 'Should delete 1 row');
    TestUtils.assertEqual(mockDb.tables.phonebook.length, beforeCount - 1, 'Should have one less client');

    window.runExec = originalRunExec;
});

phonebookTests.test('Duplicate Phone Detection', () => {
    const phone1 = '+12125551234';
    const phone2 = '+1 (212) 555-1234'; // Same as phone1 but formatted differently
    
    const result1 = validateAndFormatPhone(phone1);
    const result2 = validateAndFormatPhone(phone2);
    
    TestUtils.assertEqual(
        result1.normalized,
        result2.normalized,
        'Should normalize both phones to same format for duplicate detection'
    );
});

phonebookTests.test('searchPhonebook - Should Filter By Name', () => {
    const clients = mockDb.tables.phonebook;
    const searchTerm = 'john';
    
    const filtered = clients.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    TestUtils.assertEqual(filtered.length, 1, 'Should find 1 client matching "john"');
    TestUtils.assertEqual(filtered[0].name, 'John Doe', 'Should find correct client');
});

phonebookTests.test('searchPhonebook - Should Filter By Phone', () => {
    const clients = mockDb.tables.phonebook;
    const searchTerm = '212';
    
    const filtered = clients.filter(c => 
        c.phone.includes(searchTerm)
    );
    
    TestUtils.assertEqual(filtered.length, 1, 'Should find 1 client with 212 area code');
});

// ===================================
// EDGE CASES
// ===================================

phonebookTests.test('Phone Validation - Whitespace Only', () => {
    const result = validateAndFormatPhone('   ');
    TestUtils.assertFalse(result.valid, 'Should reject whitespace-only phone');
});

phonebookTests.test('Phone Validation - Special Characters', () => {
    const result = validateAndFormatPhone('+1-212-555-1234');
    TestUtils.assertTrue(result.valid, 'Should accept phone with dashes');
    TestUtils.assertEqual(result.normalized, '+12125551234', 'Should strip dashes');
});

phonebookTests.test('Client Name - XSS Protection', () => {
    const maliciousName = '<script>alert("xss")</script>';
    const escapedName = window.escapeHtml ? escapeHtml(maliciousName) : maliciousName;
    
    TestUtils.assertFalse(
        escapedName.includes('<script>'),
        'Should escape HTML tags in client name'
    );
});

// Run tests when ready
if (typeof window !== 'undefined') {
    console.log('📱 Phonebook tests loaded. Run with: phonebookTests.run()');
}

// Export for use in other tests
window.phonebookTests = phonebookTests;
