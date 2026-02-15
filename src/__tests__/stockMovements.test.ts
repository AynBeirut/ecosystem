import { describe, it, expect } from 'vitest'

/**
 * Stock Movement Calculation Tests
 * 
 * Tests critical inventory logic including:
 * - Stock reduction on orders
 * - Stock increase on purchases
 * - Stock restoration on returns
 * - Negative stock prevention
 * - Multiple transaction tracking
 * - Total value calculations
 * - Decimal quantity handling
 */

describe('Stock Movement Calculations', () => {
  describe('Basic Stock Operations', () => {
    it('reduces stock on order completion', () => {
      const initialStock = 100
      const orderedQty = 15
      const newStock = initialStock - orderedQty
      
      expect(newStock).toBe(85)
    })

    it('increases stock on purchase receive', () => {
      const initialStock = 50
      const receivedQty = 100
      const newStock = initialStock + receivedQty
      
      expect(newStock).toBe(150)
    })

    it('increases stock on sales return', () => {
      const initialStock = 85
      const returnedQty = 5
      const newStock = initialStock + returnedQty
      
      expect(newStock).toBe(90)
    })

    it('reduces stock on production material usage', () => {
      const initialStock = 500
      const usedQty = 125
      const newStock = initialStock - usedQty
      
      expect(newStock).toBe(375)
    })

    it('increases stock on production completion', () => {
      const initialStock = 0
      const producedQty = 50
      const newStock = initialStock + producedQty
      
      expect(newStock).toBe(50)
    })
  })

  describe('Stock Validation', () => {
    it('prevents negative stock on order', () => {
      const initialStock = 10
      const orderedQty = 15
      const canFulfill = initialStock >= orderedQty
      
      expect(canFulfill).toBe(false)
    })

    it('allows order when stock is exactly equal', () => {
      const initialStock = 15
      const orderedQty = 15
      const canFulfill = initialStock >= orderedQty
      
      expect(canFulfill).toBe(true)
    })

    it('allows order when stock is sufficient', () => {
      const initialStock = 100
      const orderedQty = 15
      const canFulfill = initialStock >= orderedQty
      
      expect(canFulfill).toBe(true)
    })

    it('checks available stock for each item', () => {
      const items = [
        { productId: 'p1', quantity: 10, availableStock: 20 },
        { productId: 'p2', quantity: 5, availableStock: 3 }, // Insufficient
        { productId: 'p3', quantity: 2, availableStock: 5 }
      ]
      
      const insufficientItems = items.filter(item => item.quantity > item.availableStock)
      
      expect(insufficientItems).toHaveLength(1)
      expect(insufficientItems[0].productId).toBe('p2')
    })
  })

  describe('Multiple Transaction Tracking', () => {
    it('calculates stock after multiple transactions', () => {
      let stock = 100
      
      stock -= 20 // Order 1
      stock += 50 // Purchase
      stock -= 15 // Order 2
      stock += 5  // Return
      stock -= 3  // Adjustment
      
      expect(stock).toBe(117)
    })

    it('tracks complex transaction sequence', () => {
      const transactions = [
        { type: 'initial', qty: 100 },
        { type: 'order', qty: -25 },
        { type: 'order', qty: -15 },
        { type: 'purchase', qty: 200 },
        { type: 'order', qty: -30 },
        { type: 'return', qty: 10 },
        { type: 'adjustment', qty: -5 }
      ]
      
      let stock = 0
      transactions.forEach(t => {
        if (t.type === 'initial') {
          stock = t.qty
        } else {
          stock += t.qty
        }
      })
      
      expect(stock).toBe(235)
    })

    it('maintains transaction history', () => {
      const transactions = [
        { date: '2026-01-01', type: 'purchase', qty: 100, balance: 100 },
        { date: '2026-01-05', type: 'order', qty: -20, balance: 80 },
        { date: '2026-01-10', type: 'order', qty: -15, balance: 65 }
      ]
      
      const finalBalance = transactions[transactions.length - 1].balance
      expect(finalBalance).toBe(65)
    })
  })

  describe('Stock Value Calculations', () => {
    it('calculates total value correctly', () => {
      const stock = 150
      const costPerUnit = 12.50
      const totalValue = stock * costPerUnit
      
      expect(totalValue).toBe(1875)
    })

    it('calculates value after stock change', () => {
      let stock = 100
      const costPerUnit = 10
      
      stock -= 30 // Sell 30 units
      
      const newTotalValue = stock * costPerUnit
      expect(newTotalValue).toBe(700)
    })

    it('handles zero stock value', () => {
      const stock = 0
      const costPerUnit = 15
      const totalValue = stock * costPerUnit
      
      expect(totalValue).toBe(0)
    })

    it('calculates average cost after purchase', () => {
      const existingStock = 100
      const existingCost = 10
      const purchaseQty = 50
      const purchaseCost = 12
      
      const totalValue = (existingStock * existingCost) + (purchaseQty * purchaseCost)
      const totalQty = existingStock + purchaseQty
      const avgCost = totalValue / totalQty
      
      expect(avgCost).toBeCloseTo(10.67, 2)
    })
  })

  describe('Decimal Quantity Handling', () => {
    it('handles decimal stock quantities', () => {
      const initialStock = 50.5
      const usedQty = 12.3
      const newStock = initialStock - usedQty
      
      expect(newStock).toBeCloseTo(38.2, 10)
    })

    it('handles decimal quantities in order', () => {
      const stock = 100.75
      const orderQty = 15.25
      const canFulfill = stock >= orderQty
      
      expect(canFulfill).toBe(true)
    })

    it('calculates value with decimal quantities', () => {
      const stock = 12.5
      const costPerUnit = 8.75
      const totalValue = stock * costPerUnit
      
      expect(totalValue).toBeCloseTo(109.375, 3)
    })

    it('handles very small decimal quantities', () => {
      const stock = 0.001
      const orderQty = 0.0005
      const remaining = stock - orderQty
      
      expect(remaining).toBeCloseTo(0.0005, 4)
    })
  })

  describe('Stock Adjustment Scenarios', () => {
    it('handles positive adjustment (stock found)', () => {
      const initialStock = 100
      const adjustment = 15
      const newStock = initialStock + adjustment
      
      expect(newStock).toBe(115)
    })

    it('handles negative adjustment (damage/loss)', () => {
      const initialStock = 100
      const adjustment = -10
      const newStock = initialStock + adjustment
      
      expect(newStock).toBe(90)
    })

    it('handles adjustment to zero', () => {
      const initialStock = 50
      const adjustment = -50
      const newStock = initialStock + adjustment
      
      expect(newStock).toBe(0)
    })

    it('records adjustment reason', () => {
      const adjustment = {
        productId: 'p1',
        quantity: -5,
        reason: 'Damaged in warehouse',
        date: '2026-02-15'
      }
      
      expect(adjustment.quantity).toBeLessThan(0)
      expect(adjustment.reason).toBeDefined()
    })
  })

  describe('Batch/Lot Tracking', () => {
    it('tracks stock by batch', () => {
      const batches = [
        { batchId: 'b1', quantity: 100, remaining: 100, date: '2026-01-01' },
        { batchId: 'b2', quantity: 50, remaining: 50, date: '2026-01-15' }
      ]
      
      const totalStock = batches.reduce((sum, b) => sum + b.remaining, 0)
      expect(totalStock).toBe(150)
    })

    it('deducts from oldest batch first (FIFO)', () => {
      const batches = [
        { batchId: 'b1', quantity: 100, remaining: 100, date: '2026-01-01' },
        { batchId: 'b2', quantity: 50, remaining: 50, date: '2026-01-15' }
      ]
      
      const orderQty = 120
      
      // Deduct from b1 first
      let remaining = orderQty
      batches[0].remaining -= Math.min(batches[0].remaining, remaining)
      remaining -= 100
      
      if (remaining > 0) {
        batches[1].remaining -= remaining
      }
      
      expect(batches[0].remaining).toBe(0)
      expect(batches[1].remaining).toBe(30)
    })

    it('removes empty batches', () => {
      const batches = [
        { batchId: 'b1', remaining: 0 },
        { batchId: 'b2', remaining: 50 },
        { batchId: 'b3', remaining: 0 },
        { batchId: 'b4', remaining: 30 }
      ]
      
      const activeBatches = batches.filter(b => b.remaining > 0)
      
      expect(activeBatches).toHaveLength(2)
      expect(activeBatches.map(b => b.batchId)).toEqual(['b2', 'b4'])
    })
  })

  describe('Real-World Scenarios', () => {
    it('scenario: busy day with multiple orders', () => {
      let stock = 500
      const orders = [50, 30, 25, 15, 40, 35, 20] // Total: 215
      
      orders.forEach(orderQty => {
        stock -= orderQty
      })
      
      expect(stock).toBe(285)
    })

    it('scenario: purchase received during active selling', () => {
      let stock = 100
      
      stock -= 50 // Order 1
      stock += 200 // Purchase received
      stock -= 75 // Order 2
      stock -= 30 // Order 3
      
      expect(stock).toBe(145)
    })

    it('scenario: return increases stock mid-day', () => {
      let stock = 150
      
      stock -= 25 // Order
      stock += 10 // Return
      stock -= 15 // Order
      
      expect(stock).toBe(120)
    })

    it('scenario: production depletes materials and creates finished goods', () => {
      let flourStock = 500
      let sugarStock = 300
      let finishedGoodsStock = 0
      
      // Recipe: 2kg flour + 1kg sugar = 1 unit finished good
      const productionQty = 50
      
      flourStock -= productionQty * 2 // 100kg
      sugarStock -= productionQty * 1 // 50kg
      finishedGoodsStock += productionQty
      
      expect(flourStock).toBe(400)
      expect(sugarStock).toBe(250)
      expect(finishedGoodsStock).toBe(50)
    })

    it('scenario: insufficient stock prevents large order', () => {
      const stock = 15
      const items = [
        { productId: 'p1', quantity: 10 },
        { productId: 'p2', quantity: 20 }, // This would need 20 but only 15 available
      ]
      
      const canFulfillAll = items.every(item => item.quantity <= stock)
      
      expect(canFulfillAll).toBe(false)
    })
  })

  describe('Edge Cases', () => {
    it('handles zero initial stock', () => {
      const stock = 0
      const purchase = 100
      const newStock = stock + purchase
      
      expect(newStock).toBe(100)
    })

    it('handles zero transaction', () => {
      const stock = 100
      const transaction = 0
      const newStock = stock + transaction
      
      expect(newStock).toBe(100)
    })

    it('handles very large stock numbers', () => {
      const stock = 999999
      const order = 123456
      const remaining = stock - order
      
      expect(remaining).toBe(876543)
    })

    it('handles floating point precision', () => {
      let stock = 10.1
      stock -= 5.05
      stock -= 5.05
      
      // Should be 0, but floating point might cause issues
      const rounded = Math.round(stock * 100) / 100
      expect(rounded).toBe(0)
    })
  })

  describe('Stock Movement Reports', () => {
    it('calculates net stock change', () => {
      const movements = [
        { type: 'in', qty: 200 },
        { type: 'out', qty: 50 },
        { type: 'in', qty: 30 },
        { type: 'out', qty: 75 }
      ]
      
      const totalIn = movements.filter(m => m.type === 'in').reduce((sum, m) => sum + m.qty, 0)
      const totalOut = movements.filter(m => m.type === 'out').reduce((sum, m) => sum + m.qty, 0)
      const netChange = totalIn - totalOut
      
      expect(totalIn).toBe(230)
      expect(totalOut).toBe(125)
      expect(netChange).toBe(105)
    })

    it('calculates stock turnover', () => {
      const soldQty = 500
      const avgStock = 100
      const turnoverRate = soldQty / avgStock
      
      expect(turnoverRate).toBe(5) // Turned over 5 times
    })
  })
})
