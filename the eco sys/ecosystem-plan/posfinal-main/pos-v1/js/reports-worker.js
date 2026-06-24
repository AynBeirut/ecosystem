/**
 * Web Worker for Sales Report Calculations
 * Offloads heavy computation to background thread to prevent UI freezing
 */

// Parse sales data helper
function parseSale(sale) {
    return {
        ...sale,
        items: typeof sale.items === 'string' ? JSON.parse(sale.items) : sale.items,
        totals: typeof sale.totals === 'string' ? JSON.parse(sale.totals) : sale.totals,
        customerInfo: sale.customerInfo && typeof sale.customerInfo === 'string' 
            ? JSON.parse(sale.customerInfo) 
            : sale.customerInfo
    };
}

/**
 * Calculate statistics from sales data
 */
function calculateStats(sales) {
    let totalRevenue = 0;
    let totalCost = 0;
    let totalProfit = 0;
    
    const totalSales = sales.length;
    
    const totalItems = sales.reduce((sum, sale) => {
        const parsed = parseSale(sale);
        
        // Calculate revenue and cost for this sale
        parsed.items.forEach(item => {
            const itemRevenue = item.price * item.quantity;
            const itemCost = (item.cost || 0) * item.quantity;
            
            totalRevenue += itemRevenue;
            totalCost += itemCost;
            totalProfit += (itemRevenue - itemCost);
        });
        
        return sum + parsed.items.reduce((s, item) => s + item.quantity, 0);
    }, 0);
    
    const averageSale = totalSales > 0 ? totalRevenue / totalSales : 0;
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    
    return {
        totalRevenue,
        totalSales,
        totalItems,
        averageSale,
        totalCost,
        totalProfit,
        profitMargin
    };
}

/**
 * Generate top products data for chart
 */
function generateTopProductsData(sales) {
    const productMap = {};
    
    sales.forEach(sale => {
        const parsed = parseSale(sale);
        parsed.items.forEach(item => {
            if (!productMap[item.name]) {
                productMap[item.name] = {
                    name: item.name,
                    quantity: 0,
                    revenue: 0
                };
            }
            productMap[item.name].quantity += item.quantity;
            productMap[item.name].revenue += item.price * item.quantity;
        });
    });
    
    // Convert to array and sort by quantity
    return Object.values(productMap)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5); // Top 5
}

/**
 * Generate category data for chart
 */
function generateCategoryData(sales) {
    const categoryMap = {};
    
    sales.forEach(sale => {
        const parsed = parseSale(sale);
        parsed.items.forEach(item => {
            const category = item.category || 'Uncategorized';
            if (!categoryMap[category]) {
                categoryMap[category] = {
                    category,
                    quantity: 0,
                    revenue: 0
                };
            }
            categoryMap[category].quantity += item.quantity;
            categoryMap[category].revenue += item.price * item.quantity;
        });
    });
    
    return Object.values(categoryMap);
}

// Listen for messages from main thread
self.addEventListener('message', function(e) {
    const { type, data } = e.data;
    
    try {
        switch (type) {
            case 'calculateStats':
                const stats = calculateStats(data.sales);
                self.postMessage({ type: 'statsComplete', data: stats });
                break;
                
            case 'generateChartData':
                const topProducts = generateTopProductsData(data.sales);
                const categories = generateCategoryData(data.sales);
                self.postMessage({ 
                    type: 'chartDataComplete', 
                    data: { topProducts, categories } 
                });
                break;
                
            case 'fullCalculation':
                // Do all calculations at once
                const allStats = calculateStats(data.sales);
                const allTopProducts = generateTopProductsData(data.sales);
                const allCategories = generateCategoryData(data.sales);
                self.postMessage({ 
                    type: 'fullCalculationComplete', 
                    data: { 
                        stats: allStats, 
                        topProducts: allTopProducts, 
                        categories: allCategories 
                    } 
                });
                break;
                
            default:
                self.postMessage({ 
                    type: 'error', 
                    error: 'Unknown message type: ' + type 
                });
        }
    } catch (error) {
        self.postMessage({ 
            type: 'error', 
            error: error.message 
        });
    }
});
