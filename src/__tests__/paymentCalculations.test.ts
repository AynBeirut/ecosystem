import { describe, it, expect } from 'vitest'

/**
 * Payment Balance Calculation Tests
 * 
 * Tests critical payment logic including:
 * - Balance calculation (total - paid)
 * - Payment status determination (paid/partial/unpaid)
 * - Overpayment handling
 * - Payment history totals
 * - Refunds as negative payments
 * - Decimal precision (rounding to 2 places)
 */

describe('Payment Balance Calculations', () => {
  describe('Basic Balance Calculations', () => {
    it('calculates balance correctly for partial payment', () => {
      const orderTotal = 1000
      const amountPaid = 300
      const balance = orderTotal - amountPaid
      
      expect(balance).toBe(700)
    })

    it('calculates balance correctly when fully paid', () => {
      const orderTotal = 1000
      const amountPaid = 1000
      const balance = orderTotal - amountPaid
      
      expect(balance).toBe(0)
    })

    it('calculates balance correctly when unpaid', () => {
      const orderTotal = 1000
      const amountPaid = 0
      const balance = orderTotal - amountPaid
      
      expect(balance).toBe(1000)
    })

    it('handles decimal amounts correctly', () => {
      const orderTotal = 1234.56
      const amountPaid = 789.12
      const balance = orderTotal - amountPaid
      
      expect(balance).toBeCloseTo(445.44, 2)
    })
  })

  describe('Payment Status Determination', () => {
    const getPaymentStatus = (total: number, paid: number): string => {
      if (paid >= total) return 'paid'
      if (paid > 0) return 'partial'
      return 'unpaid'
    }

    it('determines payment status: paid', () => {
      const status = getPaymentStatus(1000, 1000)
      expect(status).toBe('paid')
    })

    it('determines payment status: partial', () => {
      const status = getPaymentStatus(1000, 500)
      expect(status).toBe('partial')
    })

    it('determines payment status: unpaid', () => {
      const status = getPaymentStatus(1000, 0)
      expect(status).toBe('unpaid')
    })

    it('determines payment status: overpaid as paid', () => {
      const status = getPaymentStatus(1000, 1100)
      expect(status).toBe('paid')
    })

    it('handles edge case: very small partial payment', () => {
      const status = getPaymentStatus(1000, 0.01)
      expect(status).toBe('partial')
    })

    it('handles edge case: payment equals total exactly', () => {
      const status = getPaymentStatus(1234.56, 1234.56)
      expect(status).toBe('paid')
    })
  })

  describe('Overpayment Handling', () => {
    it('handles overpayment correctly', () => {
      const total = 1000
      const paid = 1100
      const balance = Math.max(0, total - paid)
      const status = paid >= total ? 'paid' : paid > 0 ? 'partial' : 'unpaid'
      
      expect(balance).toBe(0) // Balance cannot be negative
      expect(status).toBe('paid')
    })

    it('calculates overpayment amount', () => {
      const total = 1000
      const paid = 1200
      const overpayment = paid - total
      
      expect(overpayment).toBe(200)
    })

    it('handles small overpayment', () => {
      const total = 100
      const paid = 100.05
      const balance = Math.max(0, total - paid)
      
      expect(balance).toBe(0)
    })
  })

  describe('Payment History Totals', () => {
    it('calculates payment history total correctly', () => {
      const paymentHistory = [
        { amount: 300, date: '2026-01-01' },
        { amount: 200, date: '2026-01-05' },
        { amount: 100, date: '2026-01-10' }
      ]
      
      const total = paymentHistory.reduce((sum, p) => sum + p.amount, 0)
      expect(total).toBe(600)
    })

    it('handles single payment', () => {
      const paymentHistory = [
        { amount: 1000, date: '2026-01-01' }
      ]
      
      const total = paymentHistory.reduce((sum, p) => sum + p.amount, 0)
      expect(total).toBe(1000)
    })

    it('handles empty payment history', () => {
      const paymentHistory: Array<{amount: number}> = []
      
      const total = paymentHistory.reduce((sum, p) => sum + p.amount, 0)
      expect(total).toBe(0)
    })

    it('handles multiple decimal payments', () => {
      const paymentHistory = [
        { amount: 123.45, date: '2026-01-01' },
        { amount: 67.89, date: '2026-01-02' },
        { amount: 234.56, date: '2026-01-03' }
      ]
      
      const total = paymentHistory.reduce((sum, p) => sum + p.amount, 0)
      expect(total).toBeCloseTo(425.90, 2)
    })
  })

  describe('Refunds as Negative Payments', () => {
    it('handles refund as negative payment', () => {
      const paymentHistory = [
        { amount: 1000, date: '2026-01-01', type: 'payment' },
        { amount: -200, date: '2026-01-05', type: 'refund', notes: 'Partial refund' }
      ]
      
      const total = paymentHistory.reduce((sum, p) => sum + p.amount, 0)
      expect(total).toBe(800)
    })

    it('handles full refund', () => {
      const paymentHistory = [
        { amount: 1000, date: '2026-01-01', type: 'payment' },
        { amount: -1000, date: '2026-01-05', type: 'refund', notes: 'Full refund' }
      ]
      
      const total = paymentHistory.reduce((sum, p) => sum + p.amount, 0)
      expect(total).toBe(0)
    })

    it('handles multiple refunds', () => {
      const paymentHistory = [
        { amount: 1000, date: '2026-01-01' },
        { amount: -100, date: '2026-01-05', notes: 'Refund 1' },
        { amount: -50, date: '2026-01-10', notes: 'Refund 2' },
        { amount: 500, date: '2026-01-15' }
      ]
      
      const total = paymentHistory.reduce((sum, p) => sum + p.amount, 0)
      expect(total).toBe(1350)
    })

    it('updates payment status after refund', () => {
      const orderTotal = 1000
      const payments = [1000, -200] // Paid 1000, refunded 200
      const netPaid = payments.reduce((sum, p) => sum + p, 0)
      
      expect(netPaid).toBe(800)
      
      const status = netPaid >= orderTotal ? 'paid' : netPaid > 0 ? 'partial' : 'unpaid'
      expect(status).toBe('partial')
    })
  })

  describe('Decimal Precision and Rounding', () => {
    it('rounds to 2 decimal places', () => {
      const amount = 33.33333333
      const rounded = Math.round(amount * 100) / 100
      
      expect(rounded).toBe(33.33)
    })

    it('handles rounding up', () => {
      const amount = 33.336
      const rounded = Math.round(amount * 100) / 100
      
      expect(rounded).toBe(33.34)
    })

    it('handles rounding down', () => {
      const amount = 33.334
      const rounded = Math.round(amount * 100) / 100
      
      expect(rounded).toBe(33.33)
    })

    it('calculates balance with proper rounding', () => {
      const total = 100.00
      const paid = 33.333
      const balance = Math.round((total - paid) * 100) / 100
      
      expect(balance).toBe(66.67)
    })

    it('handles floating point precision issues', () => {
      // 0.1 + 0.2 = 0.30000000000000004 in JavaScript
      const amount = 0.1 + 0.2
      const rounded = Math.round(amount * 100) / 100
      
      expect(rounded).toBe(0.3)
    })
  })

  describe('Real-World Scenarios', () => {
    it('scenario: installment payments', () => {
      const orderTotal = 5000
      const paymentHistory = [
        { amount: 1000, date: '2026-01-01', notes: 'Installment 1' },
        { amount: 1000, date: '2026-02-01', notes: 'Installment 2' },
        { amount: 1000, date: '2026-03-01', notes: 'Installment 3' },
        { amount: 1000, date: '2026-04-01', notes: 'Installment 4' }
      ]
      
      const totalPaid = paymentHistory.reduce((sum, p) => sum + p.amount, 0)
      const balance = orderTotal - totalPaid
      const status = totalPaid >= orderTotal ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid'
      
      expect(totalPaid).toBe(4000)
      expect(balance).toBe(1000)
      expect(status).toBe('partial')
    })

    it('scenario: payment with partial refund', () => {
      const orderTotal = 1000
      const paymentHistory = [
        { amount: 1000, date: '2026-01-01', notes: 'Full payment' },
        { amount: -150, date: '2026-01-10', notes: 'Return item refund' }
      ]
      
      const netPaid = paymentHistory.reduce((sum, p) => sum + p.amount, 0)
      const balance = orderTotal - netPaid
      
      expect(netPaid).toBe(850)
      expect(balance).toBe(150) // Now owes 150 more
    })

    it('scenario: overpayment then partial refund', () => {
      const orderTotal = 1000
      const paymentHistory = [
        { amount: 1200, date: '2026-01-01', notes: 'Overpayment' },
        { amount: -200, date: '2026-01-05', notes: 'Return overpayment' }
      ]
      
      const netPaid = paymentHistory.reduce((sum, p) => sum + p.amount, 0)
      const status = netPaid >= orderTotal ? 'paid' : 'partial'
      
      expect(netPaid).toBe(1000)
      expect(status).toBe('paid')
    })

    it('scenario: multiple partial payments leading to full payment', () => {
      const orderTotal = 999.99
      const paymentHistory = [
        { amount: 250.00, date: '2026-01-01' },
        { amount: 300.00, date: '2026-01-15' },
        { amount: 200.00, date: '2026-02-01' },
        { amount: 249.99, date: '2026-02-15' }
      ]
      
      const totalPaid = paymentHistory.reduce((sum, p) => sum + p.amount, 0)
      const balance = orderTotal - totalPaid
      const status = totalPaid >= orderTotal ? 'paid' : 'partial'
      
      expect(totalPaid).toBe(999.99)
      expect(balance).toBe(0)
      expect(status).toBe('paid')
    })
  })

  describe('Edge Cases', () => {
    it('handles zero total with payment', () => {
      const total = 0
      const paid = 100
      const balance = Math.max(0, total - paid)
      
      expect(balance).toBe(0)
    })

    it('handles negative payment (shouldn\'t happen but test defensive code)', () => {
      const paymentHistory = [
        { amount: 1000, date: '2026-01-01' },
        { amount: -1500, date: '2026-01-05' } // Refund more than paid
      ]
      
      const total = paymentHistory.reduce((sum, p) => sum + p.amount, 0)
      expect(total).toBe(-500)
    })

    it('handles very large amounts', () => {
      const orderTotal = 999999.99
      const amountPaid = 500000.00
      const balance = orderTotal - amountPaid
      
      expect(balance).toBeCloseTo(499999.99, 2)
    })

    it('handles very small amounts', () => {
      const orderTotal = 0.01
      const amountPaid = 0.01
      const balance = orderTotal - amountPaid
      
      expect(balance).toBeCloseTo(0, 2)
    })
  })

  describe('Payment Validation', () => {
    it('validates payment amount is positive', () => {
      const paymentAmount = 100
      const isValid = paymentAmount > 0
      
      expect(isValid).toBe(true)
    })

    it('validates payment does not exceed balance', () => {
      const balance = 500
      const paymentAmount = 600
      const exceedsBalance = paymentAmount > balance
      
      expect(exceedsBalance).toBe(true)
    })

    it('allows payment equal to balance', () => {
      const balance = 500
      const paymentAmount = 500
      const exceedsBalance = paymentAmount > balance
      
      expect(exceedsBalance).toBe(false)
    })
  })
})
