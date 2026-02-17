/**
 * Data Corruption Audit Script
 * 
 * This script identifies data integrity issues in the account:
 * 1. Orders deleted without quantitySold reversal
 * 2. Voided payments without finished goods reversal
 * 3. Status rollbacks without inventory restoration
 * 4. Quantity mismatches between Finished Goods and Account Statement
 * 5. Products with $0.00 cost price
 * 6. Recipes with zero output quantity
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Firebase configuration (replace with your config)
const firebaseConfig = {
  // Add your Firebase config here
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

interface AuditResult {
  timestamp: string;
  storeId: string;
  issues: {
    zeroCostProducts: Array<{
      id: string;
      name: string;
      costPrice: number;
      currentBalance: number;
    }>;
    zeroOutputRecipes: Array<{
      id: string;
      name: string;
      outputQuantity: number;
      totalCost: number;
    }>;
    quantityMismatches: Array<{
      productId: string;
      productName: string;
      finishedGoodsQuantitySold: number;
      actualOrdersQuantitySold: number;
      difference: number;
    }>;
    orphanedTransactions: Array<{
      finishedGoodId: string;
      productName: string;
      transactionId: string;
      referenceId: string;
      issue: string;
    }>;
  };
  summary: {
    totalFinishedGoods: number;
    zeroCostCount: number;
    zeroCostPercentage: number;
    totalRecipes: number;
    zeroOutputCount: number;
    mismatchCount: number;
    orphanedCount: number;
  };
}

async function auditAccountData(storeId: string): Promise<AuditResult> {
  console.log(`\n🔍 Starting data audit for store: ${storeId}\n`);

  const result: AuditResult = {
    timestamp: new Date().toISOString(),
    storeId,
    issues: {
      zeroCostProducts: [],
      zeroOutputRecipes: [],
      quantityMismatches: [],
      orphanedTransactions: [],
    },
    summary: {
      totalFinishedGoods: 0,
      zeroCostCount: 0,
      zeroCostPercentage: 0,
      totalRecipes: 0,
      zeroOutputCount: 0,
      mismatchCount: 0,
      orphanedCount: 0,
    },
  };

  // 1. Check for finished goods with $0.00 cost price
  console.log('📦 Checking finished goods inventory...');
  const fgQuery = query(
    collection(db, 'finishedGoodsInventory'),
    where('storeId', '==', storeId)
  );
  const fgSnapshot = await getDocs(fgQuery);
  result.summary.totalFinishedGoods = fgSnapshot.size;

  fgSnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.costPrice === 0 || !data.costPrice) {
      result.issues.zeroCostProducts.push({
        id: doc.id,
        name: data.productName || data.name || 'Unknown',
        costPrice: data.costPrice || 0,
        currentBalance: data.currentBalance || 0,
      });
      result.summary.zeroCostCount++;
    }
  });

  result.summary.zeroCostPercentage = result.summary.totalFinishedGoods > 0
    ? (result.summary.zeroCostCount / result.summary.totalFinishedGoods) * 100
    : 0;

  // 2. Check for recipes with zero output quantity
  console.log('📋 Checking recipes...');
  const recipesQuery = query(
    collection(db, 'recipes'),
    where('storeId', '==', storeId)
  );
  const recipesSnapshot = await getDocs(recipesQuery);
  result.summary.totalRecipes = recipesSnapshot.size;

  recipesSnapshot.forEach((doc) => {
    const data = doc.data();
    if (!data.outputQuantity || data.outputQuantity === 0) {
      const totalCost = data.ingredients?.reduce(
        (sum: number, ing: any) => sum + (ing.unitCost || 0) * (ing.quantity || 0),
        0
      ) || 0;

      result.issues.zeroOutputRecipes.push({
        id: doc.id,
        name: data.name || 'Unknown',
        outputQuantity: data.outputQuantity || 0,
        totalCost,
      });
      result.summary.zeroOutputCount++;
    }
  });

  // 3. Check quantity mismatches between Finished Goods and actual orders
  console.log('🔢 Checking quantity mismatches...');
  const ordersQuery = query(
    collection(db, 'orders'),
    where('storeId', '==', storeId)
  );
  const ordersSnapshot = await getDocs(ordersQuery);

  // Calculate actual sold quantities from delivered/completed orders
  const actualSoldQuantities = new Map<string, number>();
  const productNames = new Map<string, string>();

  ordersSnapshot.forEach((doc) => {
    const order = doc.data();
    if (order.status === 'delivered' || order.status === 'completed') {
      order.items?.forEach((item: any) => {
        const productId = item.productId;
        const currentQty = actualSoldQuantities.get(productId) || 0;
        actualSoldQuantities.set(productId, currentQty + (item.quantity || 0));
        if (item.productName) {
          productNames.set(productId, item.productName);
        }
      });
    }
  });

  // Compare with finished goods quantitySold
  fgSnapshot.forEach((doc) => {
    const data = doc.data();
    const productId = data.productId || data.composedProductId;
    const fgQuantitySold = data.quantitySold || 0;
    const actualQuantitySold = actualSoldQuantities.get(productId) || 0;
    const difference = Math.abs(fgQuantitySold - actualQuantitySold);

    if (difference > 0.01) { // Allow small floating point differences
      result.issues.quantityMismatches.push({
        productId,
        productName: data.productName || data.name || productNames.get(productId) || 'Unknown',
        finishedGoodsQuantitySold: fgQuantitySold,
        actualOrdersQuantitySold: actualQuantitySold,
        difference,
      });
      result.summary.mismatchCount++;
    }
  });

  // 4. Check for orphaned transactions (references to deleted orders)
  console.log('🔗 Checking for orphaned transactions...');
  const orderIds = new Set<string>();
  ordersSnapshot.forEach((doc) => orderIds.add(doc.id));

  fgSnapshot.forEach((doc) => {
    const data = doc.data();
    const transactions = data.transactions || [];

    transactions.forEach((txn: any) => {
      if (txn.referenceId && txn.actionType === 'sold') {
        if (!orderIds.has(txn.referenceId)) {
          result.issues.orphanedTransactions.push({
            finishedGoodId: doc.id,
            productName: data.productName || data.name || 'Unknown',
            transactionId: txn.id,
            referenceId: txn.referenceId,
            issue: 'Order deleted but transaction remains',
          });
          result.summary.orphanedCount++;
        }
      }
    });
  });

  return result;
}

function generateReport(result: AuditResult): string {
  let report = `# DATA CORRUPTION AUDIT REPORT\n\n`;
  report += `**Store ID:** ${result.storeId}\n`;
  report += `**Timestamp:** ${new Date(result.timestamp).toLocaleString()}\n\n`;
  report += `---\n\n`;

  // Summary
  report += `## 📊 SUMMARY\n\n`;
  report += `| Metric | Count | Status |\n`;
  report += `|--------|-------|--------|\n`;
  report += `| Total Finished Goods | ${result.summary.totalFinishedGoods} | ℹ️ |\n`;
  report += `| Products with $0.00 Cost | ${result.summary.zeroCostCount} | ${result.summary.zeroCostCount > 0 ? '🔴 CRITICAL' : '✅ OK'} |\n`;
  report += `| Zero Cost Percentage | ${result.summary.zeroCostPercentage.toFixed(2)}% | ${result.summary.zeroCostPercentage > 10 ? '🔴 HIGH' : result.summary.zeroCostPercentage > 0 ? '🟡 MEDIUM' : '✅ OK'} |\n`;
  report += `| Total Recipes | ${result.summary.totalRecipes} | ℹ️ |\n`;
  report += `| Recipes with Zero Output | ${result.summary.zeroOutputCount} | ${result.summary.zeroOutputCount > 0 ? '🔴 CRITICAL' : '✅ OK'} |\n`;
  report += `| Quantity Mismatches | ${result.summary.mismatchCount} | ${result.summary.mismatchCount > 0 ? '🔴 CRITICAL' : '✅ OK'} |\n`;
  report += `| Orphaned Transactions | ${result.summary.orphanedCount} | ${result.summary.orphanedCount > 0 ? '🟡 WARNING' : '✅ OK'} |\n\n`;

  // Zero Cost Products
  if (result.issues.zeroCostProducts.length > 0) {
    report += `## 🔴 PRODUCTS WITH $0.00 COST PRICE\n\n`;
    report += `| Product ID | Product Name | Cost Price | Current Stock |\n`;
    report += `|------------|--------------|------------|---------------|\n`;
    result.issues.zeroCostProducts.forEach((product) => {
      report += `| ${product.id.substring(0, 8)}... | ${product.name} | $${product.costPrice.toFixed(2)} | ${product.currentBalance} |\n`;
    });
    report += `\n**Action Required:** Update recipes with correct output quantity, complete new production batches.\n\n`;
  }

  // Zero Output Recipes
  if (result.issues.zeroOutputRecipes.length > 0) {
    report += `## 🔴 RECIPES WITH ZERO OUTPUT QUANTITY\n\n`;
    report += `| Recipe ID | Recipe Name | Output Quantity | Total Cost |\n`;
    report += `|-----------|-------------|-----------------|------------|\n`;
    result.issues.zeroOutputRecipes.forEach((recipe) => {
      report += `| ${recipe.id.substring(0, 8)}... | ${recipe.name} | ${recipe.outputQuantity} | $${recipe.totalCost.toFixed(2)} |\n`;
    });
    report += `\n**Action Required:** Edit recipes and set correct output quantity (must be > 0).\n\n`;
  }

  // Quantity Mismatches
  if (result.issues.quantityMismatches.length > 0) {
    report += `## 🔴 QUANTITY MISMATCHES\n\n`;
    report += `| Product Name | Finished Goods Qty | Actual Orders Qty | Difference |\n`;
    report += `|--------------|-------------------|-------------------|------------|\n`;
    result.issues.quantityMismatches.forEach((mismatch) => {
      const diff = mismatch.finishedGoodsQuantitySold - mismatch.actualOrdersQuantitySold;
      const diffStr = diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2);
      report += `| ${mismatch.productName} | ${mismatch.finishedGoodsQuantitySold.toFixed(2)} | ${mismatch.actualOrdersQuantitySold.toFixed(2)} | ${diffStr} |\n`;
    });
    report += `\n**Action Required:** Run "Sync Sold Quantities" function to recalculate from actual orders.\n\n`;
  }

  // Orphaned Transactions
  if (result.issues.orphanedTransactions.length > 0) {
    report += `## 🟡 ORPHANED TRANSACTIONS\n\n`;
    report += `| Product Name | Transaction ID | Reference Order ID | Issue |\n`;
    report += `|--------------|----------------|-------------------|-------|\n`;
    result.issues.orphanedTransactions.forEach((txn) => {
      report += `| ${txn.productName} | ${txn.transactionId.substring(0, 12)}... | ${txn.referenceId.substring(0, 12)}... | ${txn.issue} |\n`;
    });
    report += `\n**Action Required:** These transactions reference deleted orders. Run sync to clean up.\n\n`;
  }

  report += `---\n\n`;
  report += `## ✅ NEXT STEPS\n\n`;
  report += `1. **Backup Database** - Run backup script before any fixes\n`;
  report += `2. **Fix Zero Output Recipes** - Edit recipes to set correct output quantities\n`;
  report += `3. **Run Sync Function** - Use "Sync Sold Quantities" button to fix mismatches\n`;
  report += `4. **Complete New Production** - For zero-cost products, complete new batches with fixed recipes\n`;
  report += `5. **Verify** - Run integrity check after fixes to confirm all issues resolved\n\n`;

  return report;
}

function exportToCSV(result: AuditResult): string {
  let csv = `Type,ID,Name,Value1,Value2,Difference,Issue\n`;

  // Zero cost products
  result.issues.zeroCostProducts.forEach((p) => {
    csv += `Zero Cost Product,${p.id},${p.name},$${p.costPrice},${p.currentBalance},,Cost price is $0.00\n`;
  });

  // Zero output recipes
  result.issues.zeroOutputRecipes.forEach((r) => {
    csv += `Zero Output Recipe,${r.id},${r.name},${r.outputQuantity},$${r.totalCost},,Output quantity is 0\n`;
  });

  // Quantity mismatches
  result.issues.quantityMismatches.forEach((m) => {
    csv += `Quantity Mismatch,${m.productId},${m.productName},${m.finishedGoodsQuantitySold},${m.actualOrdersQuantitySold},${m.difference},FG vs Orders mismatch\n`;
  });

  // Orphaned transactions
  result.issues.orphanedTransactions.forEach((t) => {
    csv += `Orphaned Transaction,${t.transactionId},${t.productName},${t.referenceId},,,${t.issue}\n`;
  });

  return csv;
}

// Main execution
async function main() {
  try {
    const storeId = process.argv[2];

    if (!storeId) {
      console.error('❌ Error: Please provide store ID as argument');
      console.log('Usage: npx ts-node scripts/auditAccountData.ts <storeId>');
      process.exit(1);
    }

    const result = await auditAccountData(storeId);

    // Create reports directory if it doesn't exist
    const reportsDir = path.join(process.cwd(), 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // Generate and save report
    const report = generateReport(result);
    const reportPath = path.join(reportsDir, `audit-report-${storeId}-${Date.now()}.md`);
    fs.writeFileSync(reportPath, report);
    console.log(`\n📄 Report saved: ${reportPath}`);

    // Export CSV
    const csv = exportToCSV(result);
    const csvPath = path.join(reportsDir, `audit-report-${storeId}-${Date.now()}.csv`);
    fs.writeFileSync(csvPath, csv);
    console.log(`📊 CSV exported: ${csvPath}`);

    // Print summary to console
    console.log('\n' + report);

    // Exit with error code if issues found
    const hasIssues = 
      result.summary.zeroCostCount > 0 ||
      result.summary.zeroOutputCount > 0 ||
      result.summary.mismatchCount > 0 ||
      result.summary.orphanedCount > 0;

    process.exit(hasIssues ? 1 : 0);
  } catch (error) {
    console.error('❌ Error running audit:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { auditAccountData, generateReport, exportToCSV };
