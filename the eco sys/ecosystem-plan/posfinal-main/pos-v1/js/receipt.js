// ===================================
// AYN BEIRUT POS - RECEIPT PRINTING
// Generate and print branded receipts
// ===================================

async function showReceipt(saleData) {
    const modal = document.getElementById('receipt-modal');
    const receiptDisplay = document.getElementById('receipt-display');
    
    // Ensure modal is visible
    modal.style.display = 'flex';
    
    // Generate receipt HTML (now async)
    receiptDisplay.innerHTML = await generateReceiptHTML(saleData);
    
    // Show modal
    modal.classList.add('show');
    
    // Setup modal close handlers
    setupReceiptModal();
}

async function generateReceiptHTML(saleData) {
    const { items, totals, timestamp } = saleData;
    const date = new Date(timestamp);
    
    // Get company info from database
    let companyInfo = null;
    try {
        if (typeof getCompanyInfo === 'function') {
            companyInfo = await getCompanyInfo();
            console.log('📋 Company info loaded:', companyInfo);
        } else {
            console.warn('⚠️ getCompanyInfo function not available');
        }
    } catch (error) {
        console.error('❌ Failed to load company info:', error);
    }
    
    // Use company info if available, otherwise default
    const companyName = companyInfo?.companyName || 'Your Business Name';
    const companyPhone = companyInfo?.phone || '';
    const companyEmail = companyInfo?.email || '';
    const companyAddress = companyInfo?.address || '';
    const companyWebsite = companyInfo?.website || '';
    const taxId = companyInfo?.taxId || '';
    
    console.log('🏢 Using company name:', companyName);
    
    let itemsHTML = '';
    items.forEach(item => {
        const itemTotal = item.price * item.quantity;
        itemsHTML += `
            <tr>
                <td style="padding: 5px 0; border-bottom: 1px solid #000; font-size: 11px; font-weight: 600;">
                    ${item.name}<br>
                    <small style="font-size: 9px; font-weight: 600;">${item.quantity} × ${formatDualCurrencyPlain(item.price)}</small>
                </td>
                <td style="padding: 5px 0; border-bottom: 1px solid #000; text-align: right; font-size: 11px; font-weight: 700;">
                    ${formatDualCurrencyPlain(itemTotal)}
                </td>
            </tr>
        `;
    });
    
    return `
        <div style="width: 100%; max-width: 380px; margin: 0 auto; padding: 4mm; font-family: 'Arial', 'Courier New', monospace; font-size: 11px; font-weight: 600; line-height: 1.5; box-sizing: border-box;">
            <!-- Header -->
            <div style="text-align: center; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 2px solid #000;">
                <div style="font-size: 18px; font-weight: 900; margin-bottom: 4px;">
                    ${companyName}
                </div>
                ${companyAddress ? `<p style="font-size: 10px; margin: 0; font-weight: 600; word-wrap: break-word; overflow-wrap: break-word;">${companyAddress}</p>` : ''}
                ${companyPhone ? `<p style="font-size: 10px; margin: 0; font-weight: 600;">Tel: ${companyPhone}</p>` : ''}
                ${companyEmail ? `<p style="font-size: 10px; margin: 0; font-weight: 600; word-break: break-all; overflow-wrap: break-word;">${companyEmail}</p>` : ''}
                ${taxId ? `<p style="font-size: 10px; margin: 0; font-weight: 600;">Tax ID: ${taxId}</p>` : ''}
            </div>
            
            <!-- Receipt Info -->
            <div style="margin-bottom: 8px; font-size: 10px; font-weight: 600;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 1px;">
                    <span>Date:</span>
                    <span>${date.toLocaleDateString()}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 1px;">
                    <span>Time:</span>
                    <span>${date.toLocaleTimeString()}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-weight: 800;">
                    <span>Receipt #:</span>
                    <span>${saleData.receiptNumber || 'N/A'}</span>
                </div>
            </div>
            
            <!-- Items -->
            <table style="width: 100%; margin-bottom: 8px; border-top: 2px solid #000; padding-top: 4px; font-size: 10px; font-weight: 600;">
                ${itemsHTML}
            </table>
            
            <!-- Totals -->
            <div style="margin-bottom: 8px; padding-top: 4px; border-top: 2px solid #000; font-weight: 700;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 2px; font-size: 10px;">
                    <span>Subtotal:</span>
                    <span>${formatDualCurrencyPlain(totals.subtotal)}</span>
                </div>
                ${totals.discount > 0 ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 2px; font-size: 10px;">
                    <span>Discount (${totals.discountPercent ? totals.discountPercent.toFixed(0) : '0'}%):</span>
                    <span>${formatDualCurrencyPlain(-totals.discount)}</span>
                </div>
                ` : ''}
                ${totals.tax > 0 ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 10px;">
                    <span>Tax (11%):</span>
                    <span>${formatDualCurrencyPlain(totals.tax)}</span>
                </div>
                ` : ''}
                <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 900; padding-top: 4px; border-top: 2px solid #000;">
                    <span>TOTAL:</span>
                    <span>${formatDualCurrencyPlain(totals.total)}</span>
                </div>
            </div>
            
            <!-- Payment Info -->
            ${saleData.payment ? `
            <div style="margin-bottom: 8px; padding: 4px; border: 1px dashed #000; font-size: 9px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                    <span>Payment:</span>
                    <span style="font-weight: bold;">${saleData.payment.method}</span>
                </div>
                ${saleData.payment.method === 'Cash' ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 1px;">
                    <span>Received:</span>
                    <span>${formatDualCurrencyPlain(saleData.payment.amountReceived)}</span>
                </div>
                ${saleData.remainingBalance && saleData.remainingBalance > 0 ? `
                <div style="display: flex; justify-content: space-between; font-weight: bold; color: #d9534f;">
                    <span>REMAINING BALANCE:</span>
                    <span>${formatDualCurrencyPlain(saleData.remainingBalance)}</span>
                </div>
                <div style="margin-top: 4px; padding: 4px; background: #fff3cd; border: 1px solid #ffc107; text-align: center; font-size: 8px;">
                    ⚠️ PARTIAL PAYMENT - Balance Due: ${formatDualCurrencyPlain(saleData.remainingBalance)}
                </div>
                ` : `
                <div style="display: flex; justify-content: space-between; font-weight: bold;">
                    <span>Change:</span>
                    <span>${formatDualCurrencyPlain(saleData.payment.change)}</span>
                </div>
                `}
                ` : ''}
            </div>
            ` : ''}
            
            <!-- Customer Info -->
            ${saleData.customerName || saleData.customerPhone ? `
            <div style="margin-bottom: 6px; padding: 4px; border: 1px dashed #000; font-size: 9px;">
                <div style="margin-bottom: 1px; font-weight: bold;">Customer:</div>
                ${saleData.customerName ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 1px;">
                    <span>Name:</span>
                    <span>${saleData.customerName}</span>
                </div>
                ` : ''}
                ${saleData.customerPhone ? `
                <div style="display: flex; justify-content: space-between;">
                    <span>Phone:</span>
                    <span>${saleData.customerPhone}</span>
                </div>
                ` : ''}
            </div>
            ` : ''}
            
            <!-- Cashier Info -->
            ${saleData.user ? `
            <div style="margin-bottom: 6px; font-size: 8px;">
                <div style="display: flex; justify-content: space-between;">
                    <span>Cashier:</span>
                    <span style="font-weight: bold;">${saleData.user.name}</span>
                </div>
            </div>
            ` : ''}
            
            <!-- Footer -->
            <div style="text-align: center; padding-top: 8px; border-top: 1px dashed #000; font-size: 8px;">
                <p style="margin: 4px 0; font-size: 10px;">Thank you!</p>
                ${companyWebsite ? `<p style="margin: 2px 0; word-break: break-all; overflow-wrap: break-word;">${companyWebsite}</p>` : ''}
                <p style="margin: 4px 0; font-size: 7px; color: #666; word-break: break-all; overflow-wrap: break-word;">POS powered by www.aynbeirut.com</p>
            </div>
        </div>
    `;
}

function setupReceiptModal() {
    const modal = document.getElementById('receipt-modal');
    const printBtn = document.getElementById('print-receipt');
    const newOrderBtn = document.getElementById('new-order');
    
    console.log('🧾 Setting up receipt modal buttons');
    console.log('Print button found:', !!printBtn);
    console.log('New Order button found:', !!newOrderBtn);
    
    // Click outside to close (disabled for receipt modal)
    modal.onclick = (e) => {
        if (e.target === modal) {
            // Do nothing - prevent closing by clicking outside
            console.log('🧾 Click outside detected but ignored for receipt modal');
        }
    };
    
    // Print button
    if (printBtn) {
        printBtn.onclick = () => {
            console.log('🖨️ Print button clicked');
            printReceipt();
        };
    } else {
        console.error('❌ Print button not found');
    }
    
    // New order button
    if (newOrderBtn) {
        newOrderBtn.onclick = () => {
            console.log('🆕 New Order button clicked');
            modal.classList.remove('show');
            modal.classList.remove('active');
            // Ensure modal is fully hidden
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
            
            // Clear any print windows that might be blocking
            // Reset page state for new order
            if (typeof window.clearCart === 'function') {
                // Cart already cleared in completeSaleWithPayment
            }
        };
    } else {
        console.error('❌ New Order button not found');
    }
}

function printReceipt() {
    const receiptContent = document.getElementById('receipt-display').innerHTML;
    
    console.log('Print requested. Electron API available:', !!window.electronAPI, 'Print function:', !!window.electronAPI?.print);
    
    // Check if running in Electron
    if (window.electronAPI && window.electronAPI.print) {
        // Use Electron's native print
        const fullHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Receipt - Ayn Beirut POS</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    body {
                        font-family: 'Courier New', monospace;
                        padding: 0;
                        margin: 0;
                        background: white;
                        color: #000;
                    }
                    @media print {
                        @page {
                            size: 80mm auto;
                            margin: 0;
                        }
                        body {
                            padding: 0;
                            margin: 0;
                            width: 80mm;
                        }
                    }
                </style>
            </head>
            <body>
                ${receiptContent}
            </body>
            </html>
        `;
        window.electronAPI.print(fullHTML);
        return;
    }
    
    // Fallback to browser print for non-Electron environments
    console.log('Using browser fallback print method');
    const printWindow = window.open('', '_blank', 'width=300,height=600');
    
    if (!printWindow) {
        console.error('Pop-up blocked by browser');
        alert('❌ Print Failed\n\nPlease enable pop-ups in your browser settings to print receipts.\n\nOR: Use the Electron desktop app for better printing.');
        return;
    }
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Receipt - Ayn Beirut POS</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                body {
                    font-family: 'Courier New', monospace;
                    padding: 0;
                    margin: 0;
                    background: white;
                    color: #000;
                }
                @media print {
                    @page {
                        size: 80mm auto;
                        margin: 0;
                    }
                    body {
                        padding: 0;
                        margin: 0;
                        width: 80mm;
                    }
                }
            </style>
        </head>
        <body>
            ${receiptContent}
            <script>
                // Auto print with timeout to ensure content loads
                setTimeout(() => {
                    window.print();
                    // Close after brief delay regardless of print status
                    setTimeout(() => window.close(), 500);
                }, 100);
            </script>
        </body>
        </html>
    `);
    
    printWindow.document.close();
}

// Export functions
window.showReceipt = showReceipt;
window.printReceipt = printReceipt;
