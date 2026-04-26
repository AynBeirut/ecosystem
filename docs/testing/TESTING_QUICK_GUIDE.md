# Quick Testing Guide

## Running Tests

### Run all tests once
```bash
npm run test:unit
```

### Run tests in watch mode (auto-rerun on changes)
```bash
npm run test:watch
```

### Run tests with UI
```bash
npm run test:ui
```

## Test Files

- **Order Calculations** - [src/__tests__/orderCalculations.test.ts](src/__tests__/orderCalculations.test.ts)
  - 21 tests covering subtotals, discounts, tax calculations

- **Payment Calculations** - [src/__tests__/paymentCalculations.test.ts](src/__tests__/paymentCalculations.test.ts)
  - 37 tests covering balance tracking, payment status, refunds

- **Stock Movements** - [src/__tests__/stockMovements.test.ts](src/__tests__/stockMovements.test.ts)
  - 38 tests covering inventory operations, FIFO logic

- **Double-Click Prevention** - [src/__tests__/doubleClickPrevention.test.ts](src/__tests__/doubleClickPrevention.test.ts)
  - 19 tests covering all 12 protected operations

## Expected Results

```
✓ 4 test files passed
✓ 115 tests passed
⏱ Duration: ~3.5 seconds
```

## Adding New Tests

1. Create a new file in `src/__tests__/`
2. Import test utilities:
   ```typescript
   import { describe, it, expect } from 'vitest'
   ```
3. Write your tests using the AAA pattern:
   ```typescript
   it('should do something', () => {
     // Arrange: Set up test data
     const input = 100
     
     // Act: Execute the code
     const result = myFunction(input)
     
     // Assert: Verify the result
     expect(result).toBe(200)
   })
   ```

## Common Assertions

- `expect(value).toBe(expected)` - Strict equality
- `expect(value).toBeCloseTo(expected, 2)` - Decimal comparison (2 decimal places)
- `expect(value).toBeGreaterThan(10)` - Numeric comparison
- `expect(array).toHaveLength(5)` - Array length
- `expect(fn).toHaveBeenCalledTimes(3)` - Mock function calls

## Debugging Failed Tests

1. Look at the test name to understand what failed
2. Check the error message for the expected vs actual values
3. Review the code being tested
4. Run the specific test file: `npx vitest run src/__tests__/orderCalculations.test.ts`
5. Add `console.log()` in the test to debug

## Best Practices

✅ Write tests before fixing bugs  
✅ Keep tests simple and focused  
✅ Use descriptive test names  
✅ Test edge cases  
✅ Run tests before committing  

## Need Help?

See [TESTING_IMPLEMENTATION_SUMMARY.md](TESTING_IMPLEMENTATION_SUMMARY.md) for full details.
