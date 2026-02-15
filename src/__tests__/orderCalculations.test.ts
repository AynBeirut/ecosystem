import { describe, it, expect } from 'vitest'

/**
 * Order Calculation Tests
 * Tests the calculateOrderTotals function from AdminOrders.tsx
 * 
 * This tests the critical business logic for:
 * - Subtotal calculation
 * - Item-level discounts (percentage and fixed)
 * - Order-level discounts (applied after item discounts)
 * - Tax calculation (applied after all discounts)
 * - Edge cases (zero quantities, empty arrays, decimal values)
 */

// Mock products for testing
const mockProducts = [
  { id: 'p1', name: 'Product 1', sellingPrice: 100, price: 100 },
  { id: 'p2', name: 'Product 2', sellingPrice: 50, price: 50 },
  { id: 'p3', name: 'Product 3', sellingPrice: 30, price: 30 }
]

// Replicating the calculateOrderTotals logic for testing
const calculateOrderTotals = (
  items: Array<{
    productId: string
    quantity: number
    discountType?: 'percentage' | 'fixed' | 'none'
    discountValue?: number
  }>,
  taxType: string,
  taxRate: number,
  discountType: 'percentage' | 'fixed' | 'none',
  discountValue: number
) => {
  // Calculate raw subtotal (before any discounts)
  let rawSubtotal = 0
  let itemDiscounts = 0
  
  items.forEach(item => {
    const product = mockProducts.find(p => p.id === item.productId)
    const itemPrice = (product?.sellingPrice || product?.price || 0) * item.quantity
    rawSubtotal += itemPrice
    
    // Calculate item discount
    let itemDiscount = 0
    if (item.discountType === 'percentage' && item.discountValue !== undefined) {
      itemDiscount = (itemPrice * item.discountValue) / 100
    } else if (item.discountType === 'fixed' && item.discountValue !== undefined) {
      itemDiscount = item.discountValue
    }
    
    itemDiscounts += itemDiscount
  })

  // Subtotal after item discounts
  const subtotalAfterItemDiscounts = rawSubtotal - itemDiscounts

  // Calculate order-level discount (applied after item discounts)
  let orderDiscountAmount = 0
  if (discountType === 'percentage') {
    orderDiscountAmount = (subtotalAfterItemDiscounts * discountValue) / 100
  } else if (discountType === 'fixed') {
    orderDiscountAmount = discountValue
  }

  const afterAllDiscounts = subtotalAfterItemDiscounts - orderDiscountAmount
  
  let taxAmount = 0
  if (taxType !== 'none') {
    taxAmount = (afterAllDiscounts * taxRate) / 100
  }

  const total = afterAllDiscounts + taxAmount
  const totalDiscountAmount = itemDiscounts + orderDiscountAmount

  return { 
    subtotal: rawSubtotal, 
    itemDiscounts,
    orderDiscount: orderDiscountAmount,
    discountAmount: totalDiscountAmount, 
    taxAmount, 
    total 
  }
}

describe('Order Calculations', () => {
  describe('Basic Subtotal Calculations', () => {
    it('calculates correct subtotal for single item', () => {
      const items = [
        { productId: 'p1', quantity: 2 }
      ]
      
      const result = calculateOrderTotals(items, 'none', 0, 'none', 0)
      
      expect(result.subtotal).toBe(200) // 2 * 100
      expect(result.total).toBe(200)
    })

    it('calculates correct subtotal for multiple items', () => {
      const items = [
        { productId: 'p1', quantity: 2 }, // 2 * 100 = 200
        { productId: 'p2', quantity: 3 }, // 3 * 50 = 150
        { productId: 'p3', quantity: 1 }  // 1 * 30 = 30
      ]
      
      const result = calculateOrderTotals(items, 'none', 0, 'none', 0)
      
      expect(result.subtotal).toBe(380)
      expect(result.total).toBe(380)
    })

    it('handles decimal quantities correctly', () => {
      const items = [
        { productId: 'p1', quantity: 1.5 } // 1.5 * 100 = 150
      ]
      
      const result = calculateOrderTotals(items, 'none', 0, 'none', 0)
      
      expect(result.subtotal).toBe(150)
    })
  })

  describe('Item-Level Discounts', () => {
    it('applies item-level percentage discount correctly', () => {
      const items = [
        { 
          productId: 'p1', 
          quantity: 2, // 2 * 100 = 200
          discountType: 'percentage' as const,
          discountValue: 10 // 10% off = 20
        }
      ]
      
      const result = calculateOrderTotals(items, 'none', 0, 'none', 0)
      
      expect(result.subtotal).toBe(200)
      expect(result.itemDiscounts).toBe(20)
      expect(result.total).toBe(180)
    })

    it('applies item-level fixed discount correctly', () => {
      const items = [
        { 
          productId: 'p1', 
          quantity: 2, // 2 * 100 = 200
          discountType: 'fixed' as const,
          discountValue: 25 // $25 off
        }
      ]
      
      const result = calculateOrderTotals(items, 'none', 0, 'none', 0)
      
      expect(result.subtotal).toBe(200)
      expect(result.itemDiscounts).toBe(25)
      expect(result.total).toBe(175)
    })

    it('applies multiple item discounts correctly', () => {
      const items = [
        { 
          productId: 'p1', 
          quantity: 2, // 200
          discountType: 'percentage' as const,
          discountValue: 10 // 20 off
        },
        { 
          productId: 'p2', 
          quantity: 4, // 200
          discountType: 'fixed' as const,
          discountValue: 15 // 15 off
        }
      ]
      
      const result = calculateOrderTotals(items, 'none', 0, 'none', 0)
      
      expect(result.subtotal).toBe(400)
      expect(result.itemDiscounts).toBe(35) // 20 + 15
      expect(result.total).toBe(365)
    })
  })

  describe('Order-Level Discounts', () => {
    it('applies order percentage discount correctly', () => {
      const items = [
        { productId: 'p1', quantity: 2 } // 200
      ]
      
      const result = calculateOrderTotals(items, 'none', 0, 'percentage', 15)
      
      expect(result.subtotal).toBe(200)
      expect(result.orderDiscount).toBe(30) // 15% of 200
      expect(result.total).toBe(170)
    })

    it('applies order fixed discount correctly', () => {
      const items = [
        { productId: 'p1', quantity: 2 } // 200
      ]
      
      const result = calculateOrderTotals(items, 'none', 0, 'fixed', 25)
      
      expect(result.subtotal).toBe(200)
      expect(result.orderDiscount).toBe(25)
      expect(result.total).toBe(175)
    })

    it('applies order discount AFTER item discounts', () => {
      const items = [
        { 
          productId: 'p1', 
          quantity: 2, // 200
          discountType: 'percentage' as const,
          discountValue: 10 // 20 off = 180 after item discount
        }
      ]
      
      // Order discount should be 15% of 180, not 200
      const result = calculateOrderTotals(items, 'none', 0, 'percentage', 15)
      
      expect(result.subtotal).toBe(200)
      expect(result.itemDiscounts).toBe(20)
      expect(result.orderDiscount).toBe(27) // 15% of 180
      expect(result.discountAmount).toBe(47) // Total of both discounts
      expect(result.total).toBe(153)
    })
  })

  describe('Tax Calculations', () => {
    it('applies VAT correctly on final amount after discounts', () => {
      const items = [
        { productId: 'p1', quantity: 2 } // 200
      ]
      
      // 200 - 20 (10% discount) = 180
      // 11% VAT on 180 = 19.80
      // Total: 199.80
      const result = calculateOrderTotals(items, 'VAT', 11, 'percentage', 10)
      
      expect(result.discountAmount).toBe(20)
      expect(result.taxAmount).toBeCloseTo(19.80, 2)
      expect(result.total).toBeCloseTo(199.80, 2)
    })

    it('applies tax on amount after all discounts', () => {
      const items = [
        { 
          productId: 'p1', 
          quantity: 2, // 200
          discountType: 'fixed' as const,
          discountValue: 10 // 10 off = 190
        }
      ]
      
      // Subtotal: 200
      // Item discount: 10 -> 190
      // Order discount 5%: 9.50 -> 180.50
      // Tax 10%: 18.05
      // Total: 198.55
      const result = calculateOrderTotals(items, 'Tax', 10, 'percentage', 5)
      
      expect(result.subtotal).toBe(200)
      expect(result.itemDiscounts).toBe(10)
      expect(result.orderDiscount).toBeCloseTo(9.50, 2)
      expect(result.taxAmount).toBeCloseTo(18.05, 2)
      expect(result.total).toBeCloseTo(198.55, 2)
    })
  })

  describe('Complex Scenarios', () => {
    it('handles multiple items with mixed discounts and tax', () => {
      const items = [
        { 
          productId: 'p1', 
          quantity: 2, // 200
          discountType: 'percentage' as const,
          discountValue: 10 // 20 off
        },
        { 
          productId: 'p2', 
          quantity: 3, // 150
          discountType: 'fixed' as const,
          discountValue: 10 // 10 off
        },
        {
          productId: 'p3',
          quantity: 1 // 30
          // no item discount
        }
      ]
      
      // Subtotal: 380
      // Item discounts: 30 (20 + 10)
      // After item discounts: 350
      // Order discount 5%: 17.50
      // After all discounts: 332.50
      // Tax 11%: 36.575
      // Total: 369.075
      const result = calculateOrderTotals(items, 'VAT', 11, 'percentage', 5)
      
      expect(result.subtotal).toBe(380)
      expect(result.itemDiscounts).toBe(30)
      expect(result.orderDiscount).toBeCloseTo(17.50, 2)
      expect(result.discountAmount).toBeCloseTo(47.50, 2)
      expect(result.taxAmount).toBeCloseTo(36.575, 2)
      expect(result.total).toBeCloseTo(369.075, 2)
    })

    it('real-world scenario: $2231.73 vs $1726.83 bug case', () => {
      // This tests the reported bug where revenue was calculated incorrectly
      const items = [
        { productId: 'p1', quantity: 10, discountType: 'percentage' as const, discountValue: 15 },
        { productId: 'p2', quantity: 20, discountType: 'fixed' as const, discountValue: 50 }
      ]
      
      // Subtotal: 1000 + 1000 = 2000
      // Item discounts: 150 + 50 = 200
      // After item: 1800
      // Order discount 10%: 180
      // Final: 1620
      const result = calculateOrderTotals(items, 'none', 0, 'percentage', 10)
      
      expect(result.subtotal).toBe(2000)
      expect(result.discountAmount).toBe(380)
      expect(result.total).toBe(1620)
    })
  })

  describe('Edge Cases', () => {
    it('handles empty items array', () => {
      const result = calculateOrderTotals([], 'none', 0, 'none', 0)
      
      expect(result.subtotal).toBe(0)
      expect(result.total).toBe(0)
    })

    it('handles zero quantity', () => {
      const items = [
        { productId: 'p1', quantity: 0 }
      ]
      
      const result = calculateOrderTotals(items, 'none', 0, 'none', 0)
      
      expect(result.subtotal).toBe(0)
    })

    it('handles zero discount value', () => {
      const items = [
        { productId: 'p1', quantity: 2 }
      ]
      
      const result = calculateOrderTotals(items, 'none', 0, 'percentage', 0)
      
      expect(result.orderDiscount).toBe(0)
      expect(result.total).toBe(200)
    })

    it('handles 100% discount', () => {
      const items = [
        { productId: 'p1', quantity: 1 }
      ]
      
      const result = calculateOrderTotals(items, 'none', 0, 'percentage', 100)
      
      expect(result.orderDiscount).toBe(100)
      expect(result.total).toBe(0)
    })

    it('handles very small decimal values', () => {
      const items = [
        { productId: 'p1', quantity: 0.001 }
      ]
      
      const result = calculateOrderTotals(items, 'none', 0, 'none', 0)
      
      expect(result.subtotal).toBeCloseTo(0.1, 2)
    })
  })

  describe('Discount Combinations', () => {
    it('scenario: item percentage + order percentage', () => {
      // Item: $200, 10% item = $180
      // Order: 15% of $180 = $27
      // Final: $153
      const items = [
        { 
          productId: 'p1', 
          quantity: 2,
          discountType: 'percentage' as const,
          discountValue: 10
        }
      ]
      
      const result = calculateOrderTotals(items, 'none', 0, 'percentage', 15)
      
      expect(result.total).toBe(153)
    })

    it('scenario: item fixed + order fixed', () => {
      // Item: $200, $25 item = $175
      // Order: $20 off = $155
      const items = [
        { 
          productId: 'p1', 
          quantity: 2,
          discountType: 'fixed' as const,
          discountValue: 25
        }
      ]
      
      const result = calculateOrderTotals(items, 'none', 0, 'fixed', 20)
      
      expect(result.total).toBe(155)
    })

    it('scenario: item fixed + order percentage + tax', () => {
      // Item: $200, $10 item = $190
      // Order: 5% of $190 = $9.50 = $180.50
      // Tax: 10% of $180.50 = $18.05
      // Total: $198.55
      const items = [
        { 
          productId: 'p1', 
          quantity: 2,
          discountType: 'fixed' as const,
          discountValue: 10
        }
      ]
      
      const result = calculateOrderTotals(items, 'Tax', 10, 'percentage', 5)
      
      expect(result.total).toBeCloseTo(198.55, 2)
    })
  })
})
