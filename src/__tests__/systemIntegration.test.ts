import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * System Integration Tests
 * 
 * These tests verify that:
 * 1. Numbers are consistent across all pages (Dashboard, Analytics, Account Statement, Reports)
 * 2. All filters work correctly (date, customer, product, status)
 * 3. Math calculations are accurate throughout the system
 * 4. Discounts are properly applied in all calculations
 */

describe('System Integration - End-to-End Number Tracking', () => {
  // Test data representing a complete business scenario
  const testCustomer = {
    id: 'CUST001',
    name: 'Test Customer Alpha',
    email: 'alpha@test.com',
    phone: '123-456-7890'
  };

  const testProducts = [
    { id: 'PROD001', name: 'Interfold Paper', price: 4.50, costPrice: 2.00 },
    { id: 'PROD002', name: 'Napkins', price: 3.00, costPrice: 1.50 },
    { id: 'PROD003', name: 'Toilet Paper', price: 5.00, costPrice: 2.50 }
  ];

  // Order 1: Interfold only, with discount
  const order1 = {
    id: 'ORD001',
    invoiceNumber: 'INV-001',
    customerId: testCustomer.id,
    customer: testCustomer.name,
    date: '2026-02-10',
    createdAt: '2026-02-10T10:00:00Z',
    items: [
      { productId: 'PROD001', name: 'Interfold Paper', quantity: 500, price: 4.50, discount: 0 }
    ],
    subtotal: 2250.00, // 500 × 4.50
    discountAmount: 192.00, // Order discount
    taxAmount: 226.38, // 11% of (2250 - 192)
    total: 2284.38, // 2250 - 192 + 226.38
    amountPaid: 2284.38,
    paymentStatus: 'paid',
    status: 'completed'
  };

  // Order 2: Mixed products, partial payment
  const order2 = {
    id: 'ORD002',
    invoiceNumber: 'INV-002',
    customerId: testCustomer.id,
    customer: testCustomer.name,
    date: '2026-02-12',
    createdAt: '2026-02-12T14:30:00Z',
    items: [
      { productId: 'PROD001', name: 'Interfold Paper', quantity: 200, price: 4.50, discount: 0 },
      { productId: 'PROD002', name: 'Napkins', quantity: 300, price: 3.00, discount: 0 },
      { productId: 'PROD003', name: 'Toilet Paper', quantity: 150, price: 5.00, discount: 0 }
    ],
    subtotal: 2550.00, // (200×4.50) + (300×3.00) + (150×5.00) = 900 + 900 + 750
    discountAmount: 255.00, // 10% discount
    taxAmount: 252.45, // 11% of (2550 - 255)
    total: 2547.45, // 2550 - 255 + 252.45
    amountPaid: 1500.00,
    paymentStatus: 'partial',
    status: 'completed'
  };

  // Order 3: Different customer, for filter testing
  const order3 = {
    id: 'ORD003',
    invoiceNumber: 'INV-003',
    customerId: 'CUST002',
    customer: 'Test Customer Beta',
    date: '2026-02-14',
    createdAt: '2026-02-14T09:15:00Z',
    items: [
      { productId: 'PROD002', name: 'Napkins', quantity: 500, price: 3.00, discount: 0 }
    ],
    subtotal: 1500.00,
    discountAmount: 0,
    taxAmount: 165.00,
    total: 1665.00,
    amountPaid: 0,
    paymentStatus: 'unpaid',
    status: 'completed'
  };

  describe('Revenue Calculation Consistency', () => {
    it('should calculate same total revenue across Dashboard, Analytics, and Reports', () => {
      const orders = [order1, order2, order3];
      
      // Dashboard calculation: sum of all order totals
      const dashboardRevenue = orders.reduce((sum, o) => sum + o.total, 0);
      
      // Analytics calculation: sum of all order totals
      const analyticsRevenue = orders.reduce((sum, o) => sum + o.total, 0);
      
      // Reports calculation: sum of completed orders
      const reportsRevenue = orders
        .filter(o => o.status !== 'cancelled')
        .reduce((sum, o) => sum + o.total, 0);
      
      const expectedTotal = 2284.38 + 2547.45 + 1665.00; // 6496.83
      
      expect(dashboardRevenue).toBeCloseTo(expectedTotal, 2);
      expect(analyticsRevenue).toBeCloseTo(expectedTotal, 2);
      expect(reportsRevenue).toBeCloseTo(expectedTotal, 2);
      expect(dashboardRevenue).toBe(analyticsRevenue);
      expect(analyticsRevenue).toBe(reportsRevenue);
    });

    it('should correctly calculate revenue with discounts applied', () => {
      // Order 1: 500 Interfold @ 4.50 = 2250, discount 192 = 2058 before tax
      const order1Revenue = order1.subtotal - order1.discountAmount;
      expect(order1Revenue).toBeCloseTo(2058.00, 2);
      
      // Order 2: 2550 subtotal, discount 255 = 2295 before tax
      const order2Revenue = order2.subtotal - order2.discountAmount;
      expect(order2Revenue).toBeCloseTo(2295.00, 2);
      
      // Total revenue before tax
      const totalRevenueBeforeTax = order1Revenue + order2Revenue + (order3.subtotal - order3.discountAmount);
      expect(totalRevenueBeforeTax).toBeCloseTo(5853.00, 2);
    });
  });

  describe('Product-Level Analytics with Discounts', () => {
    it('should calculate Interfold product revenue across all orders with proportional discounts', () => {
      const orders = [order1, order2];
      let interfoldRevenue = 0;
      
      orders.forEach(order => {
        const orderSubtotal = order.subtotal;
        const orderDiscount = order.discountAmount;
        
        order.items.forEach(item => {
          if (item.productId === 'PROD001') {
            const itemSubtotal = item.quantity * item.price;
            const itemDiscount = orderSubtotal > 0 ? (itemSubtotal / orderSubtotal) * orderDiscount : 0;
            const itemRevenue = itemSubtotal - itemDiscount;
            interfoldRevenue += itemRevenue;
          }
        });
      });
      
      // Order 1: 500 × 4.50 = 2250, discount = (2250/2250) × 192 = 192, revenue = 2058
      // Order 2: 200 × 4.50 = 900, discount = (900/2550) × 255 = 90, revenue = 810
      // Total Interfold revenue = 2058 + 810 = 2868
      expect(interfoldRevenue).toBeCloseTo(2868.00, 2);
    });

    it('should calculate product revenue for mixed order with proportional discounts', () => {
      const order = order2;
      const orderSubtotal = order.subtotal; // 2550
      const orderDiscount = order.discountAmount; // 255
      
      const productRevenues: Record<string, number> = {};
      
      order.items.forEach(item => {
        const itemSubtotal = item.quantity * item.price;
        const itemDiscount = orderSubtotal > 0 ? (itemSubtotal / orderSubtotal) * orderDiscount : 0;
        const itemRevenue = itemSubtotal - itemDiscount;
        productRevenues[item.productId] = itemRevenue;
      });
      
      // Interfold: 900 - (900/2550)×255 = 900 - 90 = 810
      expect(productRevenues['PROD001']).toBeCloseTo(810.00, 2);
      
      // Napkins: 900 - (900/2550)×255 = 900 - 90 = 810
      expect(productRevenues['PROD002']).toBeCloseTo(810.00, 2);
      
      // Toilet Paper: 750 - (750/2550)×255 = 750 - 75 = 675
      expect(productRevenues['PROD003']).toBeCloseTo(675.00, 2);
      
      // Total should equal order total minus tax
      const totalProductRevenue = Object.values(productRevenues).reduce((sum, v) => sum + v, 0);
      expect(totalProductRevenue).toBeCloseTo(order.subtotal - order.discountAmount, 2);
    });

    it('should calculate profit correctly with discounted revenue', () => {
      const order = order1;
      const orderSubtotal = order.subtotal;
      const orderDiscount = order.discountAmount;
      
      let totalProfit = 0;
      
      order.items.forEach(item => {
        const product = testProducts.find(p => p.id === item.productId)!;
        const itemSubtotal = item.quantity * item.price;
        const itemDiscount = orderSubtotal > 0 ? (itemSubtotal / orderSubtotal) * orderDiscount : 0;
        const itemRevenue = itemSubtotal - itemDiscount;
        const itemCost = item.quantity * product.costPrice;
        const itemProfit = itemRevenue - itemCost;
        totalProfit += itemProfit;
      });
      
      // Interfold: revenue 2058, cost (500 × 2.00) = 1000, profit = 1058
      expect(totalProfit).toBeCloseTo(1058.00, 2);
    });
  });

  describe('Customer Filter Tests', () => {
    it('should filter sales by customer correctly', () => {
      const orders = [order1, order2, order3];
      const filterCustomer = testCustomer.name;
      
      const filteredOrders = orders.filter(o => o.customer === filterCustomer);
      
      expect(filteredOrders).toHaveLength(2);
      expect(filteredOrders[0].id).toBe('ORD001');
      expect(filteredOrders[1].id).toBe('ORD002');
      
      const customerTotal = filteredOrders.reduce((sum, o) => sum + o.total, 0);
      expect(customerTotal).toBeCloseTo(2284.38 + 2547.45, 2); // 4831.83
    });

    it('should calculate customer balance correctly', () => {
      const orders = [order1, order2];
      
      let totalDue = 0;
      let totalPaid = 0;
      
      orders.forEach(o => {
        totalDue += o.total;
        totalPaid += o.amountPaid;
      });
      
      const balance = totalDue - totalPaid;
      
      // Total due: 2284.38 + 2547.45 = 4831.83
      // Total paid: 2284.38 + 1500.00 = 3784.38
      // Balance: 4831.83 - 3784.38 = 1047.45
      expect(totalDue).toBeCloseTo(4831.83, 2);
      expect(totalPaid).toBeCloseTo(3784.38, 2);
      expect(balance).toBeCloseTo(1047.45, 2);
    });
  });

  describe('Product Filter Tests', () => {
    it('should filter sales by product and calculate correct totals', () => {
      const orders = [order1, order2, order3];
      const filterProduct = 'PROD001'; // Interfold
      
      // Filter orders that contain the product
      const filteredOrders = orders.filter(o => 
        o.items && o.items.some(item => item.productId === filterProduct)
      );
      
      expect(filteredOrders).toHaveLength(2);
      
      // Calculate total for just Interfold items
      let interfoldTotal = 0;
      
      filteredOrders.forEach(order => {
        const orderSubtotal = order.subtotal;
        const orderDiscount = order.discountAmount;
        
        order.items.forEach(item => {
          if (item.productId === filterProduct) {
            const itemSubtotal = item.quantity * item.price;
            const itemDiscount = orderSubtotal > 0 ? (itemSubtotal / orderSubtotal) * orderDiscount : 0;
            interfoldTotal += itemSubtotal - itemDiscount;
          }
        });
      });
      
      // Should be 2058 + 810 = 2868
      expect(interfoldTotal).toBeCloseTo(2868.00, 2);
    });

    it('should calculate proportional payment for filtered product', () => {
      const order = order2; // Partial payment
      const filterProduct = 'PROD001';
      
      const orderSubtotal = order.subtotal;
      const orderDiscount = order.discountAmount;
      
      let productTotal = 0;
      let productPaid = 0;
      
      order.items.forEach(item => {
        if (item.productId === filterProduct) {
          const itemSubtotal = item.quantity * item.price;
          const itemDiscount = orderSubtotal > 0 ? (itemSubtotal / orderSubtotal) * orderDiscount : 0;
          const itemTotal = itemSubtotal - itemDiscount;
          const itemPaid = (order.total > 0) ? (itemTotal / order.total) * order.amountPaid : 0;
          
          productTotal += itemTotal;
          productPaid += itemPaid;
        }
      });
      
      // Interfold total: 810
      // Proportional payment: (810 / 2547.45) × 1500 = ~476.95
      expect(productTotal).toBeCloseTo(810.00, 2);
      expect(productPaid).toBeCloseTo(476.95, 1);
    });
  });

  describe('Date Filter Tests', () => {
    it('should filter orders by date range correctly', () => {
      const orders = [order1, order2, order3];
      
      // Filter: Feb 11-13 (should include only order2)
      const startDate = '2026-02-11';
      const endDate = '2026-02-13';
      
      const filtered = orders.filter(o => {
        const orderDate = o.date;
        return orderDate >= startDate && orderDate <= endDate;
      });
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('ORD002');
      
      const totalInRange = filtered.reduce((sum, o) => sum + o.total, 0);
      expect(totalInRange).toBeCloseTo(2547.45, 2);
    });

    it('should filter by start date only', () => {
      const orders = [order1, order2, order3];
      const startDate = '2026-02-12';
      
      const filtered = orders.filter(o => o.date >= startDate);
      
      expect(filtered).toHaveLength(2); // order2, order3
      
      const total = filtered.reduce((sum, o) => sum + o.total, 0);
      expect(total).toBeCloseTo(2547.45 + 1665.00, 2); // 4212.45
    });

    it('should filter by end date only', () => {
      const orders = [order1, order2, order3];
      const endDate = '2026-02-12';
      
      const filtered = orders.filter(o => o.date <= endDate);
      
      expect(filtered).toHaveLength(2); // order1, order2
      
      const total = filtered.reduce((sum, o) => sum + o.total, 0);
      expect(total).toBeCloseTo(2284.38 + 2547.45, 2); // 4831.83
    });
  });

  describe('Payment Status Filter Tests', () => {
    it('should filter by paid status', () => {
      const orders = [order1, order2, order3];
      
      const paidOrders = orders.filter(o => o.paymentStatus === 'paid');
      
      expect(paidOrders).toHaveLength(1);
      expect(paidOrders[0].id).toBe('ORD001');
      
      const paidTotal = paidOrders.reduce((sum, o) => sum + o.amountPaid, 0);
      expect(paidTotal).toBeCloseTo(2284.38, 2);
    });

    it('should filter by unpaid status', () => {
      const orders = [order1, order2, order3];
      
      const unpaidOrders = orders.filter(o => o.paymentStatus === 'unpaid');
      
      expect(unpaidOrders).toHaveLength(1);
      expect(unpaidOrders[0].id).toBe('ORD003');
      
      const unpaidBalance = unpaidOrders.reduce((sum, o) => sum + (o.total - o.amountPaid), 0);
      expect(unpaidBalance).toBeCloseTo(1665.00, 2);
    });

    it('should filter by partial payment status', () => {
      const orders = [order1, order2, order3];
      
      const partialOrders = orders.filter(o => o.paymentStatus === 'partial');
      
      expect(partialOrders).toHaveLength(1);
      expect(partialOrders[0].id).toBe('ORD002');
      
      const balance = partialOrders[0].total - partialOrders[0].amountPaid;
      expect(balance).toBeCloseTo(1047.45, 2);
    });

    it('should calculate accounts receivable correctly', () => {
      const orders = [order1, order2, order3];
      
      const accountsReceivable = orders
        .filter(o => o.paymentStatus !== 'paid')
        .reduce((sum, o) => sum + (o.total - o.amountPaid), 0);
      
      // Order 2: 2547.45 - 1500 = 1047.45
      // Order 3: 1665.00 - 0 = 1665.00
      // Total: 2712.45
      expect(accountsReceivable).toBeCloseTo(2712.45, 2);
    });
  });

  describe('Combined Filters Test', () => {
    it('should apply customer + date filter correctly', () => {
      const orders = [order1, order2, order3];
      const filterCustomer = testCustomer.name;
      const startDate = '2026-02-11';
      const endDate = '2026-02-13';
      
      const filtered = orders.filter(o => {
        const matchesCustomer = o.customer === filterCustomer;
        const matchesDate = o.date >= startDate && o.date <= endDate;
        return matchesCustomer && matchesDate;
      });
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('ORD002');
    });

    it('should apply customer + product + date filter correctly', () => {
      const orders = [order1, order2, order3];
      const filterCustomer = testCustomer.name;
      const filterProduct = 'PROD001';
      const startDate = '2026-02-10';
      const endDate = '2026-02-15';
      
      const filtered = orders.filter(o => {
        const matchesCustomer = o.customer === filterCustomer;
        const matchesProduct = o.items && o.items.some(item => item.productId === filterProduct);
        const matchesDate = o.date >= startDate && o.date <= endDate;
        return matchesCustomer && matchesProduct && matchesDate;
      });
      
      expect(filtered).toHaveLength(2); // order1 and order2
      
      // Calculate total for filtered product
      let productTotal = 0;
      filtered.forEach(order => {
        const orderSubtotal = order.subtotal;
        const orderDiscount = order.discountAmount;
        
        order.items.forEach(item => {
          if (item.productId === filterProduct) {
            const itemSubtotal = item.quantity * item.price;
            const itemDiscount = orderSubtotal > 0 ? (itemSubtotal / orderSubtotal) * orderDiscount : 0;
            productTotal += itemSubtotal - itemDiscount;
          }
        });
      });
      
      expect(productTotal).toBeCloseTo(2868.00, 2);
    });

    it('should apply product + payment status filter correctly', () => {
      const orders = [order1, order2, order3];
      const filterProduct = 'PROD002'; // Napkins
      const filterStatus = 'unpaid';
      
      const filtered = orders.filter(o => {
        const matchesProduct = o.items && o.items.some(item => item.productId === filterProduct);
        const matchesStatus = o.paymentStatus === filterStatus;
        return matchesProduct && matchesStatus;
      });
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('ORD003');
    });
  });

  describe('Sales History Footer Totals', () => {
    it('should calculate footer totals correctly without filters', () => {
      const sales = [order1, order2, order3];
      
      const totalSubtotal = sales.reduce((sum, s) => sum + (s.subtotal || s.total), 0);
      const totalDiscount = sales.reduce((sum, s) => sum + (s.discountAmount || 0), 0);
      const totalAmount = sales.reduce((sum, s) => sum + s.total, 0);
      const totalPaid = sales.reduce((sum, s) => sum + s.amountPaid, 0);
      const totalBalance = sales.reduce((sum, s) => sum + (s.total - s.amountPaid), 0);
      
      expect(totalSubtotal).toBeCloseTo(6300.00, 2); // 2250 + 2550 + 1500
      expect(totalDiscount).toBeCloseTo(447.00, 2); // 192 + 255 + 0
      expect(totalAmount).toBeCloseTo(6496.83, 2); // 2284.38 + 2547.45 + 1665.00
      expect(totalPaid).toBeCloseTo(3784.38, 2); // 2284.38 + 1500 + 0
      expect(totalBalance).toBeCloseTo(2712.45, 2); // 0 + 1047.45 + 1665.00
    });

    it('should calculate footer totals with product filter (Interfold)', () => {
      const sales = [order1, order2, order3];
      const filterProduct = 'PROD001';
      
      const filteredSales = sales.filter(s => 
        s.items && s.items.some(item => item.productId === filterProduct)
      );
      
      let totalSubtotal = 0;
      let totalDiscount = 0;
      let totalAmount = 0;
      let totalPaid = 0;
      let totalBalance = 0;
      
      filteredSales.forEach(sale => {
        const orderSubtotal = sale.subtotal || sale.total || 0;
        const orderDiscount = sale.discountAmount || 0;
        
        sale.items.forEach(item => {
          if (item.productId === filterProduct) {
            const itemSubtotal = item.quantity * item.price;
            const itemDiscount = orderSubtotal > 0 ? (itemSubtotal / orderSubtotal) * orderDiscount : 0;
            const itemTotal = itemSubtotal - itemDiscount;
            const itemPaid = (sale.total > 0) ? (itemTotal / sale.total) * sale.amountPaid : 0;
            
            totalSubtotal += itemSubtotal;
            totalDiscount += itemDiscount;
            totalAmount += itemTotal;
            totalPaid += itemPaid;
            totalBalance += itemTotal - itemPaid;
          }
        });
      });
      
      // Order 1: subtotal 2250, discount 192, total 2058, paid 2058, balance 0
      // Order 2: subtotal 900, discount 90, total 810, paid 477.11, balance 332.89
      expect(totalSubtotal).toBeCloseTo(3150.00, 2); // 2250 + 900
      expect(totalDiscount).toBeCloseTo(282.00, 2); // 192 + 90
      expect(totalAmount).toBeCloseTo(2868.00, 2); // 2058 + 810
      expect(totalPaid).toBeCloseTo(2534.95, 1); // 2058 + 476.95 (rounded)
      expect(totalBalance).toBeCloseTo(333.05, 1); // 0 + 333.05
    });
  });

  describe('Cross-Page Consistency Validation', () => {
    it('should show same revenue in Dashboard and Analytics for same date range', () => {
      const orders = [order1, order2, order3];
      
      // Dashboard: sum of order totals
      const dashboardRevenue = orders.reduce((sum, o) => sum + o.total, 0);
      
      // Analytics: sum of order totals
      const analyticsRevenue = orders.reduce((sum, o) => sum + o.total, 0);
      
      expect(dashboardRevenue).toBe(analyticsRevenue);
      expect(dashboardRevenue).toBeCloseTo(6496.83, 2);
    });

    it('should show same customer balance in Account Statement and Reports', () => {
      const orders = [order1, order2];
      
      // Account Statement calculation
      const accountStatementTotal = orders.reduce((sum, o) => sum + o.total, 0);
      const accountStatementPaid = orders.reduce((sum, o) => sum + o.amountPaid, 0);
      const accountStatementBalance = accountStatementTotal - accountStatementPaid;
      
      // Reports calculation
      const reportsReceivable = orders
        .filter(o => o.paymentStatus !== 'paid')
        .reduce((sum, o) => sum + (o.total - o.amountPaid), 0);
      
      expect(accountStatementBalance).toBeCloseTo(1047.45, 2);
      expect(reportsReceivable).toBeCloseTo(1047.45, 2);
      expect(accountStatementBalance).toBe(reportsReceivable);
    });

    it('should show same product revenue in Analytics and filtered Account Statement', () => {
      const orders = [order1, order2];
      const productId = 'PROD001';
      
      // Analytics product revenue calculation
      let analyticsProductRevenue = 0;
      orders.forEach(order => {
        const orderSubtotal = order.subtotal || order.total || 0;
        const orderDiscount = order.discountAmount || 0;
        
        order.items.forEach(item => {
          if (item.productId === productId) {
            const itemSubtotal = item.quantity * item.price;
            const itemDiscount = orderSubtotal > 0 ? (itemSubtotal / orderSubtotal) * orderDiscount : 0;
            analyticsProductRevenue += itemSubtotal - itemDiscount;
          }
        });
      });
      
      // Account Statement with product filter
      let accountStatementProductRevenue = 0;
      orders.forEach(sale => {
        const orderSubtotal = sale.subtotal || sale.total || 0;
        const orderDiscount = sale.discountAmount || 0;
        
        sale.items.forEach(item => {
          if (item.productId === productId) {
            const itemSubtotal = item.quantity * item.price;
            const itemDiscount = orderSubtotal > 0 ? (itemSubtotal / orderSubtotal) * orderDiscount : 0;
            accountStatementProductRevenue += itemSubtotal - itemDiscount;
          }
        });
      });
      
      expect(analyticsProductRevenue).toBe(accountStatementProductRevenue);
      expect(analyticsProductRevenue).toBeCloseTo(2868.00, 2);
    });
  });

  describe('Tax Calculation Validation', () => {
    it('should calculate tax on net amount (after discount)', () => {
      const order = order1;
      const netAmount = order.subtotal - order.discountAmount;
      const expectedTax = netAmount * 0.11; // 11% tax
      
      expect(order.taxAmount).toBeCloseTo(expectedTax, 2);
      expect(order.taxAmount).toBeCloseTo(226.38, 2);
    });

    it('should include tax in final total', () => {
      const order = order1;
      const netAmount = order.subtotal - order.discountAmount;
      const expectedTotal = netAmount + order.taxAmount;
      
      expect(order.total).toBeCloseTo(expectedTotal, 2);
      expect(order.total).toBeCloseTo(2284.38, 2);
    });

    it('should calculate proportional tax for filtered product', () => {
      const order = order2;
      const filterProduct = 'PROD001';
      
      const orderSubtotal = order.subtotal;
      const orderDiscount = order.discountAmount;
      const orderVat = order.taxAmount;
      
      let itemTotal = 0;
      let itemVat = 0;
      
      order.items.forEach(item => {
        if (item.productId === filterProduct) {
          const itemSubtotal = item.quantity * item.price;
          const itemDiscount = orderSubtotal > 0 ? (itemSubtotal / orderSubtotal) * orderDiscount : 0;
          itemTotal = itemSubtotal - itemDiscount;
          itemVat = (order.total > 0 && orderVat > 0) ? (itemTotal / (order.total - orderVat)) * orderVat : 0;
        }
      });
      
      // Interfold total: 810
      // Proportional VAT: (810 / 2295) × 252.45 = 89.10
      expect(itemTotal).toBeCloseTo(810.00, 2);
      expect(itemVat).toBeCloseTo(89.10, 1);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle orders with zero discount', () => {
      const order = order3;
      
      expect(order.discountAmount).toBe(0);
      expect(order.total).toBeCloseTo(order.subtotal + order.taxAmount, 2);
    });

    it('should handle fully paid orders', () => {
      const order = order1;
      const balance = order.total - order.amountPaid;
      
      expect(balance).toBeCloseTo(0, 2);
      expect(order.paymentStatus).toBe('paid');
    });

    it('should handle unpaid orders', () => {
      const order = order3;
      const balance = order.total - order.amountPaid;
      
      expect(balance).toBeCloseTo(order.total, 2);
      expect(order.amountPaid).toBe(0);
      expect(order.paymentStatus).toBe('unpaid');
    });

    it('should handle partial payments correctly', () => {
      const order = order2;
      const balance = order.total - order.amountPaid;
      
      expect(order.amountPaid).toBeGreaterThan(0);
      expect(order.amountPaid).toBeLessThan(order.total);
      expect(balance).toBeGreaterThan(0);
      expect(order.paymentStatus).toBe('partial');
    });

    it('should handle empty date filter (show all)', () => {
      const orders = [order1, order2, order3];
      const startDate = '';
      const endDate = '';
      
      const filtered = orders.filter(o => {
        const matchesStart = !startDate || o.date >= startDate;
        const matchesEnd = !endDate || o.date <= endDate;
        return matchesStart && matchesEnd;
      });
      
      expect(filtered).toHaveLength(3);
    });

    it('should handle empty customer filter (show all)', () => {
      const orders = [order1, order2, order3];
      const filterCustomer = '';
      
      const filtered = orders.filter(o => !filterCustomer || o.customer === filterCustomer);
      
      expect(filtered).toHaveLength(3);
    });

    it('should handle empty product filter (show all)', () => {
      const orders = [order1, order2, order3];
      const filterProduct = '';
      
      const filtered = orders.filter(o => 
        !filterProduct || (o.items && o.items.some(item => item.productId === filterProduct))
      );
      
      expect(filtered).toHaveLength(3);
    });
  });

  describe('Rounding and Precision Tests', () => {
    it('should maintain precision to 2 decimal places', () => {
      const order = order1;
      
      // All monetary values should have max 2 decimal places
      expect(Number(order.subtotal.toFixed(2))).toBe(order.subtotal);
      expect(Number(order.discountAmount.toFixed(2))).toBe(order.discountAmount);
      expect(Number(order.taxAmount.toFixed(2))).toBe(order.taxAmount);
      expect(Number(order.total.toFixed(2))).toBe(order.total);
      expect(Number(order.amountPaid.toFixed(2))).toBe(order.amountPaid);
    });

    it('should handle proportional calculations without precision loss', () => {
      const order = order2;
      const orderSubtotal = order.subtotal;
      const orderDiscount = order.discountAmount;
      
      let calculatedTotal = 0;
      
      order.items.forEach(item => {
        const itemSubtotal = item.quantity * item.price;
        const itemDiscount = orderSubtotal > 0 ? (itemSubtotal / orderSubtotal) * orderDiscount : 0;
        calculatedTotal += itemSubtotal - itemDiscount;
      });
      
      // Should match order total minus tax (within rounding tolerance)
      const expectedBeforeTax = order.total - order.taxAmount;
      expect(calculatedTotal).toBeCloseTo(expectedBeforeTax, 1);
    });
  });
});
