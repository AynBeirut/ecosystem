# PowerShell script to automatically apply partial payment feature changes
Write-Host "🔧 Applying Partial Payment Feature Changes..." -ForegroundColor Cyan

$ErrorActionPreference = "Stop"

# Backup files first
Write-Host "📦 Creating backups..." -ForegroundColor Yellow
Copy-Item "index.html" "index.html.backup" -Force
Copy-Item "js\payment.js" "js\payment.js.backup" -Force
Copy-Item "migrations\bundle-migrations.js" "migrations\bundle-migrations.js.backup" -Force
Write-Host "✅ Backups created" -ForegroundColor Green

# 1. Update payment.js - Add variables
Write-Host "📝 Updating payment.js - Adding variables..." -ForegroundColor Yellow
$paymentJs = Get-Content "js\payment.js" -Raw
$paymentJs = $paymentJs -replace "let pendingPaymentAction = null; // 'payment' or 'order'", @"
let pendingPaymentAction = null; // 'payment' or 'order'
let isPartialPayment = false;
let downPaymentAmount = 0;
"@
Set-Content "js\payment.js" $paymentJs -NoNewline

# 2. Add partial payment functions to payment.js
Write-Host "📝 Adding partial payment functions..." -ForegroundColor Yellow
$paymentJs = Get-Content "js\payment.js" -Raw

# Find the location after closePaymentModal and add functions
$insertPoint = $paymentJs.IndexOf("// Export payment modal function")
$beforeInsert = $paymentJs.Substring(0, $insertPoint)
$afterInsert = $paymentJs.Substring($insertPoint)

$newFunctions = @"
/**
 * Handle partial payment checkbox toggle
 */
function handlePartialPaymentToggle() {
    const checkbox = document.getElementById('partial-payment-checkbox');
    const partialInfo = document.getElementById('partial-payment-info');
    
    isPartialPayment = checkbox ? checkbox.checked : false;
    
    if (isPartialPayment && partialInfo) {
        partialInfo.style.display = 'block';
        updatePartialPaymentDisplay();
    } else if (partialInfo) {
        partialInfo.style.display = 'none';
        downPaymentAmount = 0;
    }
}

/**
 * Calculate partial payment amounts
 */
function calculatePartialPayment() {
    const downPaymentInput = document.getElementById('down-payment-amount');
    if (!downPaymentInput) return;
    
    downPaymentAmount = parseFloat(downPaymentInput.value) || 0;
    
    // Validate down payment
    if (downPaymentAmount > paymentTotal) {
        downPaymentAmount = paymentTotal;
        downPaymentInput.value = paymentTotal.toFixed(2);
    }
    
    if (downPaymentAmount < 0) {
        downPaymentAmount = 0;
        downPaymentInput.value = '0.00';
    }
    
    updatePartialPaymentDisplay();
}

/**
 * Update partial payment display
 */
function updatePartialPaymentDisplay() {
    const totalEl = document.getElementById('partial-total-amount');
    const downEl = document.getElementById('partial-down-payment');
    const remainingEl = document.getElementById('partial-remaining-balance');
    
    if (totalEl) totalEl.textContent = `$`$`{paymentTotal.toFixed(2)}`;
    if (downEl) downEl.textContent = `$`$`{downPaymentAmount.toFixed(2)}`;
    if (remainingEl) remainingEl.textContent = `$`$`{(paymentTotal - downPaymentAmount).toFixed(2)}`;
}

"@

$paymentJs = $beforeInsert + $newFunctions + $afterInsert
Set-Content "js\payment.js" $paymentJs -NoNewline

# 3. Update initPayment function
Write-Host "📝 Updating initPayment function..." -ForegroundColor Yellow
$paymentJs = Get-Content "js\payment.js" -Raw
$paymentJs = $paymentJs -replace "    console.log\('✅ Payment module initialized'\);", @"
    // Partial payment checkbox
    const partialCheckbox = document.getElementById('partial-payment-checkbox');
    const downPaymentInput = document.getElementById('down-payment-amount');
    
    if (partialCheckbox) {
        partialCheckbox.addEventListener('change', handlePartialPaymentToggle);
    }
    
    if (downPaymentInput) {
        downPaymentInput.addEventListener('input', calculatePartialPayment);
    }
    
    console.log('✅ Payment module initialized');
"@
Set-Content "js\payment.js" $paymentJs -NoNewline

# 4. Update openPaymentModal function
Write-Host "📝 Updating openPaymentModal function..." -ForegroundColor Yellow
$paymentJs = Get-Content "js\payment.js" -Raw
$paymentJs = $paymentJs -replace "    // Focus cash input\s+setTimeout\(\(\) => \{\s+document.getElementById\('cash-received'\).focus\(\);", @"
    // Reset partial payment
    isPartialPayment = false;
    downPaymentAmount = 0;
    const partialCheckbox = document.getElementById('partial-payment-checkbox');
    const partialInfo = document.getElementById('partial-payment-info');
    if (partialCheckbox) partialCheckbox.checked = false;
    if (partialInfo) partialInfo.style.display = 'none';
    
    // Focus cash input
    setTimeout(() => {
        document.getElementById('cash-received').focus();
"@
Set-Content "js\payment.js" $paymentJs -NoNewline

# 5. Update processPayment function
Write-Host "📝 Updating processPayment function..." -ForegroundColor Yellow
$paymentJs = Get-Content "js\payment.js" -Raw
$paymentJs = $paymentJs -replace "        if \(currentPaymentMethod === 'cash'\) \{\s+let cashReceived = parseFloat\(document.getElementById\('cash-received'\).value\);\s+\s+// If no cash amount entered, use exact total\s+if \(!cashReceived \|\| isNaN\(cashReceived\)\) \{\s+cashReceived = paymentTotal;\s+document.getElementById\('cash-received'\).value = paymentTotal.toFixed\(2\);\s+\}\s+\s+if \(cashReceived < paymentTotal\) \{\s+showPaymentNotification\('Insufficient cash amount', 'error'\);\s+return;\s+\}\s+\s+const change = cashReceived - paymentTotal;\s+\s+// Complete the sale with payment info\s+await completeSaleWithPayment\(\{\s+method: 'Cash',\s+amountReceived: cashReceived,\s+change: change\s+\}\);", @"
        if (currentPaymentMethod === 'cash') {
            let cashReceived = parseFloat(document.getElementById('cash-received').value);
            
            // Handle partial payment
            if (isPartialPayment) {
                const downPayment = parseFloat(document.getElementById('down-payment-amount').value) || 0;
                
                if (downPayment <= 0) {
                    showPaymentNotification('Please enter a down payment amount', 'error');
                    return;
                }
                
                if (downPayment >= paymentTotal) {
                    showPaymentNotification('Down payment must be less than total amount', 'error');
                    return;
                }
                
                cashReceived = downPayment;
            } else {
                // Normal full payment
                if (!cashReceived || isNaN(cashReceived)) {
                    cashReceived = paymentTotal;
                    document.getElementById('cash-received').value = paymentTotal.toFixed(2);
                }
                
                if (cashReceived < paymentTotal) {
                    showPaymentNotification('Insufficient cash amount', 'error');
                    return;
                }
            }
            
            const change = isPartialPayment ? 0 : (cashReceived - paymentTotal);
            
            // Complete the sale with payment info
            await completeSaleWithPayment({
                method: 'Cash',
                amountReceived: cashReceived,
                change: change,
                isPartialPayment: isPartialPayment,
                downPayment: isPartialPayment ? cashReceived : 0,
                remainingBalance: isPartialPayment ? (paymentTotal - cashReceived) : 0,
                paymentStatus: isPartialPayment ? 'partial' : 'paid'
            });
"@
Set-Content "js\payment.js" $paymentJs -NoNewline

# 6. Update completeSaleWithPayment function
Write-Host "📝 Updating completeSaleWithPayment function..." -ForegroundColor Yellow
$paymentJs = Get-Content "js\payment.js" -Raw
$paymentJs = $paymentJs -replace "            paymentMethod: paymentInfo.method,\s+payment: \{", @"
            paymentMethod: paymentInfo.method,
            paymentStatus: paymentInfo.paymentStatus || 'paid',
            remainingBalance: paymentInfo.remainingBalance || 0,
            downPayment: paymentInfo.downPayment || 0,
            payment: {
"@
Set-Content "js\payment.js" $paymentJs -NoNewline

Write-Host "✅ payment.js updated successfully" -ForegroundColor Green

# 7. Update bundle-migrations.js
Write-Host "📝 Updating bundle-migrations.js..." -ForegroundColor Yellow
$bundleJs = Get-Content "migrations\bundle-migrations.js" -Raw
$bundleJs = $bundleJs -replace "    \{ num: 18, file: '018-add-product-recipes.sql', desc: 'Add recipe system for composed products with ingredient tracking and cost snapshots' \}\s+\];", @"
    { num: 18, file: '018-add-product-recipes.sql', desc: 'Add recipe system for composed products with ingredient tracking and cost snapshots' },
    { num: 19, file: '019-partial-payments.sql', desc: 'Add partial payment support with down payments and balance tracking' }
];
"@
Set-Content "migrations\bundle-migrations.js" $bundleJs -NoNewline
Write-Host "✅ bundle-migrations.js updated" -ForegroundColor Green

Write-Host "`n🎉 All changes applied successfully!" -ForegroundColor Green
Write-Host "`n⚠️  Note: You still need to manually update index.html with the UI elements." -ForegroundColor Yellow
Write-Host "    Run the following command to see the required changes:" -ForegroundColor Yellow
Write-Host "    Get-Content PARTIAL-PAYMENT-IMPLEMENTATION.md" -ForegroundColor Cyan
