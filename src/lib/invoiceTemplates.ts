import { Order } from '@/types/order';
import { StoreProfile } from '@/types/storeProfile';

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatMultilineHtml = (value: string): string =>
  escapeHtml(value).replace(/\n/g, '<br/>');

const resolveCatalogDescription = (product?: { description?: string; productDescription?: string; shortDescription?: string; details?: string } | null): string => {
  if (!product) return '';
  const candidates = [product.description, product.productDescription, product.shortDescription, product.details];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

export const generateInvoiceHTML = (
  order: Order & { id: string },
  products: any[],
  storeProfile: StoreProfile | null,
  formatCurrency: (amount: number, showDual?: boolean) => string
): string => {
  const template = storeProfile?.invoiceTemplate || 'modern';
  const storeName = storeProfile?.name || 'Your Store';
  const storeLogo = storeProfile?.logo || '';
  const storeSlogan = storeProfile?.slogan || '';
  const storeWebsite = storeProfile?.website || '';
  const storePhone = storeProfile?.phone || '';
  const storeEmail = storeProfile?.email || '';
  const storeTaxNumber = storeProfile?.taxNumber || '';
  
  // Generate invoice number with store prefix
  let invoiceNum = order.invoiceNumber;
  if (!invoiceNum) {
    const prefix = storeProfile?.invoiceNumberPrefix || 'INV';
    const orderNumber = order.id.slice(0, 6).toUpperCase();
    invoiceNum = `${prefix}-${orderNumber}`;
  }
  
  const itemsHtml = order.items?.map(item => {
    const product = products.find(p => p.id === item.productId);
    const itemName = item.productName || product?.name || 'Product';
    const itemDescription = (item.description || resolveCatalogDescription(product)).trim();
    // Use item.price (the actual price at time of order) or fallback to product price
    const price = item.price || product?.price || product?.sellingPrice || 0;
    const lineTotal = price * item.quantity;
    
    // Calculate item discount properly
    const hasDiscount = item.discountValue && item.discountValue > 0;
    let itemDiscount = 0;
    if (hasDiscount) {
      if (item.discountType === 'percentage') {
        itemDiscount = (lineTotal * item.discountValue) / 100;
      } else {
        itemDiscount = item.discountValue;
      }
    }
    const finalTotal = lineTotal - itemDiscount;
    
    return `
      <tr>
        <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb;">
          <div style="font-weight: 600;">${escapeHtml(itemName)}</div>
          ${itemDescription ? `<div style="font-size: 11px; color: #64748b; margin-top: 4px; line-height: 1.45;">${formatMultilineHtml(itemDescription)}</div>` : ''}
          ${hasDiscount ? `<div style="font-size: 11px; color: #ef4444; margin-top: 4px;">Discount: ${item.discountType === 'percentage' ? `${item.discountValue}%` : formatCurrency(item.discountValue, true)}</div>` : ''}
        </td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(price, true)}</td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">
          ${hasDiscount ? `
            <div style="color: #9ca3af; font-size: 11px;">Before: ${formatCurrency(lineTotal, true)}</div>
            <div style="font-weight: 600; color: #16a34a;">After: ${formatCurrency(finalTotal, true)}</div>
          ` : `<div style="font-weight: 600;">${formatCurrency(finalTotal, true)}</div>`}
        </td>
      </tr>
    `;
  }).join('');

  const invoiceNotesSectionHtml = (() => {
    const invoiceNotes = (order.invoiceNotes || '').trim();
    const deliveryNotes = (order.deliveryNotes || '').trim();
    if (!invoiceNotes && !deliveryNotes) return '';

    const sections: string[] = [];
    if (invoiceNotes) {
      sections.push(`
        <div>
          <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 6px;">Invoice Notes</div>
          <div style="font-size: 13px; color: #334155; line-height: 1.5;">${formatMultilineHtml(invoiceNotes)}</div>
        </div>
      `);
    }
    if (deliveryNotes) {
      sections.push(`
        <div>
          <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 6px;">Delivery Notes</div>
          <div style="font-size: 13px; color: #334155; line-height: 1.5;">${formatMultilineHtml(deliveryNotes)}</div>
        </div>
      `);
    }

    return `
      <div style="margin-top: 30px; padding: 20px; background: #f8fafc; border-radius: 8px; border-left: 4px solid #0ea5e9;">
        ${sections.join('<div style="height: 12px;"></div>')}
      </div>
    `;
  })();

  // Modern Template (Blue/Teal)
  if (template === 'modern') {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice ${invoiceNum}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            padding: 40px; 
            background: #f0f9ff;
            color: #1e293b;
          }
          .invoice-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header { 
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding-bottom: 30px;
            border-bottom: 3px solid #0ea5e9;
            margin-bottom: 30px;
          }
          .logo-section {
            display: flex;
            align-items: center;
            gap: 20px;
          }
          .logo {
            width: 150px;
            height: 150px;
            object-fit: contain;
            border-radius: 8px;
          }
          .store-info h1 {
            color: #0ea5e9;
            font-size: 28px;
            margin-bottom: 5px;
          }
          .store-info p {
            color: #64748b;
            font-size: 14px;
            margin: 2px 0;
          }
          .invoice-info {
            text-align: right;
          }
          .invoice-info h2 {
            color: #0ea5e9;
            font-size: 32px;
            margin-bottom: 10px;
          }
          .invoice-info .invoice-number {
            font-size: 20px;
            font-weight: bold;
            color: #1e293b;
            margin-bottom: 5px;
          }
          .details-section {
            display: flex;
            justify-content: space-between;
            margin: 30px 0;
            gap: 40px;
          }
          .bill-to, .payment-info {
            flex: 1;
          }
          .section-title {
            font-size: 14px;
            font-weight: 600;
            color: #64748b;
            text-transform: uppercase;
            margin-bottom: 10px;
            letter-spacing: 0.5px;
          }
          .detail-text {
            font-size: 15px;
            line-height: 1.6;
            color: #334155;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 30px 0;
          }
          th { 
            background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
            color: white;
            padding: 14px 8px;
            text-align: left;
            font-weight: 600;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          td {
            font-size: 15px;
            color: #334155;
          }
          .totals { 
            margin-top: 30px;
            text-align: right;
          }
          .totals-table {
            margin-left: auto;
            width: 350px;
          }
          .totals-table tr {
            border-bottom: 1px solid #e5e7eb;
          }
          .totals-table td {
            padding: 10px 15px;
            font-size: 15px;
          }
          .totals-table td:first-child {
            color: #64748b;
          }
          .totals-table td:last-child {
            text-align: right;
            font-weight: 600;
          }
          .grand-total {
            background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
            color: white !important;
            font-size: 18px !important;
            font-weight: bold !important;
          }
          .grand-total td {
            color: white !important;
            padding: 15px !important;
          }
          .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 2px solid #e5e7eb;
            text-align: center;
            color: #64748b;
            font-size: 13px;
          }
          .footer strong {
            color: #0ea5e9;
          }
          @media print {
            body { padding: 20px; background: white; }
            .invoice-container { box-shadow: none; }
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <div class="header">
            <div class="logo-section">
              ${storeLogo ? `<img src="${storeLogo}" alt="${storeName}" class="logo">` : ''}
              <div class="store-info">
                <h1>${storeName}</h1>
                ${storeSlogan ? `<p style="font-style: italic; color: #0ea5e9;">"${storeSlogan}"</p>` : ''}
                ${storeWebsite ? `<p>🌐 ${storeWebsite}</p>` : ''}
                ${storePhone ? `<p>📞 ${storePhone}</p>` : ''}
                ${storeEmail ? `<p>📧 ${storeEmail}</p>` : ''}
                ${storeTaxNumber ? `<p>Tax #: ${storeTaxNumber}</p>` : ''}
              </div>
            </div>
            <div class="invoice-info">
              <h2>INVOICE</h2>
              <div class="invoice-number">${invoiceNum}</div>
              <p style="color: #64748b;">${new Date(order.createdAt || '').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
          </div>
          
          <div class="details-section">
            <div class="bill-to">
              <div class="section-title">Bill To</div>
              <div class="detail-text">
                <strong style="font-size: 17px; color: #0ea5e9;">${order.customerName || 'N/A'}</strong><br/>
                ${order.customerTaxId ? `Tax ID: ${order.customerTaxId}<br/>` : ''}
                ${order.customerPhone ? `📞 ${order.customerPhone}<br/>` : ''}
                ${order.customerEmail ? `📧 ${order.customerEmail}<br/>` : ''}
                ${order.deliveryAddress ? `📍 ${order.deliveryAddress}${order.deliveryCity ? ', ' + order.deliveryCity : ''}<br/>` : ''}
              </div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Item Description</th>
                <th style="text-align: center; width: 100px;">Qty</th>
                <th style="text-align: right; width: 150px;">Unit Price</th>
                <th style="text-align: right; width: 150px;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="totals">
            <table class="totals-table">
              <tr>
                <td>Subtotal:</td>
                <td>${formatCurrency(order.subtotal || 0, true)}</td>
              </tr>
              ${order.discountAmount ? `
              <tr>
                <td>Discount:</td>
                <td style="color: #ef4444;">-${formatCurrency(order.discountAmount, true)}</td>
              </tr>
              ` : ''}
              ${order.taxAmount ? `
              <tr>
                <td>Tax (${order.taxRate}%):</td>
                <td>${formatCurrency(order.taxAmount, true)}</td>
              </tr>
              ` : ''}
              <tr class="grand-total">
                <td>TOTAL:</td>
                <td>${formatCurrency(order.total || 0, true)}</td>
              </tr>
            </table>
          </div>

          ${(order.paymentStatus && order.paymentStatus !== 'unpaid') ? `
          <div style="margin-top: 30px; padding: 25px; background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); border-left: 4px solid #10b981; border-radius: 12px;">
            <h3 style="color: #10b981; font-size: 16px; margin-bottom: 15px;">💰 Payment Information</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
              <div>
                <p style="color: #666; font-size: 12px; margin-bottom: 5px;">Status</p>
                <p style="color: #1a1a1a; font-weight: 600; font-size: 15px;">${order.paymentStatus === 'paid' ? '✓ Fully Paid' : '◐ Partially Paid'}</p>
              </div>
              <div>
                <p style="color: #666; font-size: 12px; margin-bottom: 5px;">Amount Paid</p>
                <p style="color: #10b981; font-weight: bold; font-size: 15px;">${formatCurrency(order.amountPaid || 0, true)}</p>
              </div>
              ${order.paymentStatus !== 'paid' ? `
              <div>
                <p style="color: #666; font-size: 12px; margin-bottom: 5px;">Balance Due</p>
                <p style="color: #ef4444; font-weight: bold; font-size: 15px;">${formatCurrency((order.total || 0) - (order.amountPaid || 0), true)}</p>
              </div>
              ` : ''}
              ${order.paymentDate ? `
              <div>
                <p style="color: #666; font-size: 12px; margin-bottom: 5px;">Last Payment</p>
                <p style="color: #1a1a1a; font-weight: 600; font-size: 15px;">${new Date(order.paymentDate).toLocaleDateString()}</p>
              </div>
              ` : ''}
            </div>
          </div>
          ` : ''}

          ${order.assignedSalesPersonName ? `
          <div style="margin-top: 30px; padding: 15px; background: #f8fafc; border-radius: 8px; border-left: 4px solid #0ea5e9;">
            <div style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px;">Sales Representative</div>
            <div style="font-size: 13px; color: #1e293b; font-weight: 500;">${order.assignedSalesPersonName}</div>
          </div>
          ` : ''}

          ${invoiceNotesSectionHtml}

          <div class="footer">
            <p><strong>Thank you for your business!</strong></p>
            <p>For questions about this invoice, please contact us at ${storeEmail || storePhone || 'our support desk'}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
  
  // Classic Template (Black/Gold)
  if (template === 'classic') {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice ${invoiceNum}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Georgia', serif;
            padding: 40px; 
            background: #fafafa;
            color: #2c2c2c;
          }
          .invoice-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 50px;
            border: 2px solid #d4af37;
          }
          .header { 
            text-align: center;
            padding-bottom: 30px;
            border-bottom: 3px double #d4af37;
            margin-bottom: 40px;
          }
          .logo {
            width: 150px;
            height: 150px;
            object-fit: contain;
            margin: 0 auto 20px;
            display: block;
            border: 3px solid #d4af37;
            padding: 10px;
            background: white;
          }
          .header h1 {
            color: #2c2c2c;
            font-size: 32px;
            margin-bottom: 10px;
            font-weight: 400;
            letter-spacing: 2px;
          }
          .header .slogan {
            color: #d4af37;
            font-style: italic;
            font-size: 16px;
            margin-bottom: 15px;
          }
          .header .contact-info {
            font-size: 13px;
            color: #666;
            line-height: 1.6;
          }
          .invoice-title {
            text-align: center;
            margin: 30px 0;
          }
          .invoice-title h2 {
            font-size: 36px;
            color: #d4af37;
            font-weight: 400;
            letter-spacing: 3px;
            margin-bottom: 10px;
          }
          .invoice-title .invoice-number {
            font-size: 18px;
            color: #2c2c2c;
            font-weight: 600;
          }
          .details-section {
            display: flex;
            justify-content: space-between;
            margin: 40px 0;
            gap: 60px;
          }
          .section-title {
            font-size: 12px;
            font-weight: 600;
            color: #d4af37;
            text-transform: uppercase;
            margin-bottom: 15px;
            letter-spacing: 1.5px;
            border-bottom: 1px solid #d4af37;
            padding-bottom: 5px;
          }
          .detail-text {
            font-size: 15px;
            line-height: 1.8;
            color: #2c2c2c;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 40px 0;
          }
          th { 
            background: #2c2c2c;
            color: #d4af37;
            padding: 15px 10px;
            text-align: left;
            font-weight: 600;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 1px;
            border-bottom: 3px solid #d4af37;
          }
          td {
            padding: 15px 10px;
            border-bottom: 1px solid #e0e0e0;
            font-size: 15px;
          }
          .totals { 
            margin-top: 40px;
            text-align: right;
          }
          .totals-table {
            margin-left: auto;
            width: 400px;
            border-top: 2px solid #2c2c2c;
          }
          .totals-table tr td {
            padding: 12px 20px;
            font-size: 15px;
          }
          .totals-table td:first-child {
            color: #666;
            text-align: left;
          }
          .totals-table td:last-child {
            text-align: right;
            font-weight: 600;
            color: #2c2c2c;
          }
          .grand-total {
            background: linear-gradient(135deg, #2c2c2c 0%, #1a1a1a 100%);
            border-top: 3px double #d4af37;
            border-bottom: 3px double #d4af37;
          }
          .grand-total td {
            color: #d4af37 !important;
            font-size: 20px !important;
            font-weight: bold !important;
            padding: 18px 20px !important;
          }
          .footer {
            margin-top: 60px;
            padding-top: 30px;
            border-top: 3px double #d4af37;
            text-align: center;
            color: #666;
            font-size: 13px;
            font-style: italic;
          }
          @media print {
            body { padding: 20px; background: white; }
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <div class="header">
            ${storeLogo ? `<img src="${storeLogo}" alt="${storeName}" class="logo">` : ''}
            <h1>${storeName}</h1>
            ${storeSlogan ? `<div class="slogan">"${storeSlogan}"</div>` : ''}
            <div class="contact-info">
              ${storeWebsite ? `${storeWebsite}<br/>` : ''}
              ${storePhone ? `${storePhone} • ` : ''}${storeEmail ? `${storeEmail}` : ''}<br/>
              ${storeTaxNumber ? `Tax Registration: ${storeTaxNumber}` : ''}
            </div>
          </div>
          
          <div class="invoice-title">
            <h2>INVOICE</h2>
            <div class="invoice-number">${invoiceNum}</div>
            <p style="color: #999; font-size: 14px; margin-top: 10px;">${new Date(order.createdAt || '').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          
          <div class="details-section">
            <div style="flex: 1;">
              <div class="section-title">Billed To</div>
              <div class="detail-text">
                <strong style="font-size: 18px;">${order.customerName || 'N/A'}</strong><br/>
                ${order.customerTaxId ? `Tax ID: ${order.customerTaxId}<br/>` : ''}
                ${order.customerPhone ? `📞 ${order.customerPhone}<br/>` : ''}
                ${order.customerEmail ? `📧 ${order.customerEmail}<br/>` : ''}
                ${order.deliveryAddress ? `📍 ${order.deliveryAddress}${order.deliveryCity ? ', ' + order.deliveryCity : ''}<br/>` : ''}
              </div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th style="text-align: center; width: 100px;">Quantity</th>
                <th style="text-align: right; width: 150px;">Unit Price</th>
                <th style="text-align: right; width: 150px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="totals">
            <table class="totals-table">
              <tr>
                <td>Subtotal:</td>
                <td>${formatCurrency(order.subtotal || 0, true)}</td>
              </tr>
              ${order.discountAmount ? `
              <tr>
                <td>Discount:</td>
                <td style="color: #c41e3a;">-${formatCurrency(order.discountAmount, true)}</td>
              </tr>
              ` : ''}
              ${order.taxAmount ? `
              <tr>
                <td>Tax (${order.taxRate}%):</td>
                <td>${formatCurrency(order.taxAmount, true)}</td>
              </tr>
              ` : ''}
              <tr class="grand-total">
                <td>AMOUNT DUE:</td>
                <td>${formatCurrency(order.total || 0, true)}</td>
              </tr>
            </table>
          </div>

          ${(order.paymentStatus && order.paymentStatus !== 'unpaid') ? `
          <div style="margin-top: 30px; padding: 20px; border: 2px solid #10b981; border-radius: 5px; background: #f0fdf4;">
            <strong style="color: #10b981;">💰 Payment Information</strong><br/>
            <div style="margin-top: 15px; color: #2c2c2c; line-height: 2;">
              <p><strong>Status:</strong> ${order.paymentStatus === 'paid' ? '✓ Fully Paid' : '◐ Partially Paid'}</p>
              <p><strong>Amount Paid:</strong> <span style="color: #10b981; font-weight: bold;">${formatCurrency(order.amountPaid || 0, true)}</span></p>
              ${order.paymentStatus !== 'paid' ? `<p><strong>Balance Due:</strong> <span style="color: #c41e3a; font-weight: bold;">${formatCurrency((order.total || 0) - (order.amountPaid || 0), true)}</span></p>` : ''}
            </div>
          </div>
          ` : ''}

          ${order.assignedSalesPersonName ? `
          <div style="margin-top: 30px; padding: 15px; background: #f5f5f5; border-radius: 5px; border-left: 4px solid #d4af37;">
            <div style="font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px;">Sales Representative</div>
            <div style="font-size: 13px; color: #2c2c2c; font-weight: 500;">${order.assignedSalesPersonName}</div>
          </div>
          ` : ''}

          ${invoiceNotesSectionHtml}

          <div class="footer">
            <p>Thank you for choosing ${storeName}. We appreciate your business.</p>
            <p>Please remit payment at your earliest convenience.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
  
  // Vibrant Template (Orange/Purple) - default
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Invoice ${invoiceNum}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Helvetica Neue', Arial, sans-serif;
          padding: 40px; 
          background: linear-gradient(135deg, #fff5eb 0%, #fef3f2 100%);
          color: #1a1a1a;
        }
        .invoice-container {
          max-width: 800px;
          margin: 0 auto;
          background: white;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
        }
        .header-banner {
          background: linear-gradient(135deg, #f97316 0%, #ea580c 50%, #9333ea 100%);
          padding: 40px;
          color: white;
          position: relative;
          overflow: hidden;
        }
        .header-banner::before {
          content: '';
          position: absolute;
          top: -50%;
          right: -10%;
          width: 300px;
          height: 300px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 50%;
        }
        .header-content {
          position: relative;
          z-index: 1;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .logo-section {
          display: flex;
          align-items: center;
          gap: 20px;
        }
        .logo {
          width: 150px;
          height: 150px;
          object-fit: contain;
          background: white;
          padding: 10px;
          border-radius: 15px;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
        }
        .store-details h1 {
          font-size: 32px;
          margin-bottom: 8px;
          font-weight: 700;
        }
        .store-details p {
          font-size: 14px;
          opacity: 0.95;
          margin: 3px 0;
        }
        .invoice-badge {
          background: white;
          color: #f97316;
          padding: 20px 30px;
          border-radius: 15px;
          text-align: right;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
        }
        .invoice-badge h2 {
          font-size: 28px;
          margin-bottom: 8px;
          color: #f97316;
        }
        .invoice-badge .number {
          font-size: 20px;
          font-weight: bold;
          color: #1a1a1a;
        }
        .content-area {
          padding: 40px;
        }
        .details-row {
          display: flex;
          gap: 40px;
          margin-bottom: 40px;
        }
        .detail-box {
          flex: 1;
          background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);
          padding: 20px;
          border-radius: 12px;
          border-left: 4px solid #f97316;
        }
        .detail-box h3 {
          color: #f97316;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 12px;
          font-weight: 700;
        }
        .detail-box p {
          font-size: 15px;
          line-height: 1.6;
          color: #4a4a4a;
        }
        .detail-box strong {
          font-size: 17px;
          color: #1a1a1a;
          display: block;
          margin-bottom: 5px;
        }
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin: 30px 0;
          border-radius: 12px;
          overflow: hidden;
        }
        th { 
          background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
          color: white;
          padding: 16px 12px;
          text-align: left;
          font-weight: 700;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        td {
          padding: 14px 12px;
          border-bottom: 1px solid #fee2e2;
          font-size: 15px;
        }
        tbody tr:hover {
          background: #fff7ed;
        }
        .totals { 
          margin-top: 40px;
        }
        .totals-table {
          margin-left: auto;
          width: 400px;
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 10px rgba(249, 115, 22, 0.1);
        }
        .totals-table tr td {
          padding: 14px 20px;
          font-size: 16px;
          border-bottom: 1px solid #fee2e2;
        }
        .totals-table td:first-child {
          color: #666;
        }
        .totals-table td:last-child {
          text-align: right;
          font-weight: 600;
          color: #1a1a1a;
        }
        .grand-total {
          background: linear-gradient(135deg, #f97316 0%, #9333ea 100%);
          border: none;
        }
        .grand-total td {
          color: white !important;
          font-size: 20px !important;
          font-weight: bold !important;
          padding: 20px !important;
          border: none !important;
        }
        .footer {
          margin-top: 50px;
          padding: 30px;
          background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);
          border-radius: 12px;
          text-align: center;
        }
        .footer h3 {
          color: #f97316;
          font-size: 20px;
          margin-bottom: 10px;
        }
        .footer p {
          color: #666;
          font-size: 14px;
          line-height: 1.6;
        }
        @media print {
          body { padding: 0; background: white; }
          .invoice-container { box-shadow: none; }
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <div class="header-banner">
          <div class="header-content">
            <div class="logo-section">
              ${storeLogo ? `<img src="${storeLogo}" alt="${storeName}" class="logo">` : ''}
              <div class="store-details">
                <h1>${storeName}</h1>
                ${storeSlogan ? `<p style="font-style: italic; font-size: 16px;">"${storeSlogan}"</p>` : ''}
                ${storeWebsite ? `<p>🌐 ${storeWebsite}</p>` : ''}
                ${storePhone ? `<p>📞 ${storePhone}</p>` : ''}
                ${storeEmail ? `<p>📧 ${storeEmail}</p>` : ''}
                ${storeTaxNumber ? `<p>🔖 Tax: ${storeTaxNumber}</p>` : ''}
              </div>
            </div>
            <div class="invoice-badge">
              <h2>INVOICE</h2>
              <div class="number">${invoiceNum}</div>
              <p style="font-size: 13px; color: #666; margin-top: 8px;">${new Date(order.createdAt || '').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
          </div>
        </div>
        
        <div class="content-area">
          <div class="details-row">
            <div class="detail-box">
              <h3>Customer Details</h3>
              <strong>${order.customerName || 'N/A'}</strong>
              <p>
                ${order.customerTaxId ? `Tax ID: ${order.customerTaxId}<br/>` : ''}
                ${order.customerPhone ? `📞 ${order.customerPhone}<br/>` : ''}
                ${order.customerEmail ? `📧 ${order.customerEmail}<br/>` : ''}
                ${order.deliveryAddress ? `📍 ${order.deliveryAddress}${order.deliveryCity ? ', ' + order.deliveryCity : ''}<br/>` : ''}
              </p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Product Description</th>
                <th style="text-align: center; width: 100px;">Qty</th>
                <th style="text-align: right; width: 150px;">Price</th>
                <th style="text-align: right; width: 150px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="totals">
            <table class="totals-table">
              <tr>
                <td>Subtotal:</td>
                <td>${formatCurrency(order.subtotal || 0, true)}</td>
              </tr>
              ${order.discountAmount ? `
              <tr>
                <td>Discount:</td>
                <td style="color: #dc2626;">-${formatCurrency(order.discountAmount, true)}</td>
              </tr>
              ` : ''}
              ${order.taxAmount ? `
              <tr>
                <td>Tax (${order.taxRate}%):</td>
                <td>${formatCurrency(order.taxAmount, true)}</td>
              </tr>
              ` : ''}
              <tr class="grand-total">
                <td>TOTAL AMOUNT:</td>
                <td>${formatCurrency(order.total || 0, true)}</td>
              </tr>
            </table>
          </div>

          ${(order.paymentStatus && order.paymentStatus !== 'unpaid') ? `
          <div style="margin-top: 30px; padding: 25px; background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); border-left: 4px solid #10b981; border-radius: 12px;">
            <h3 style="color: #10b981; font-size: 16px; margin-bottom: 15px;">💰 Payment Information</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
              <div>
                <p style="color: #666; font-size: 12px; margin-bottom: 5px;">Status</p>
                <p style="color: #1a1a1a; font-weight: 600; font-size: 15px;">${order.paymentStatus === 'paid' ? '✓ Fully Paid' : '◐ Partially Paid'}</p>
              </div>
              <div>
                <p style="color: #666; font-size: 12px; margin-bottom: 5px;">Amount Paid</p>
                <p style="color: #10b981; font-weight: bold; font-size: 15px;">${formatCurrency(order.amountPaid || 0, true)}</p>
              </div>
              ${order.paymentStatus !== 'paid' ? `
              <div>
                <p style="color: #666; font-size: 12px; margin-bottom: 5px;">Balance Due</p>
                <p style="color: #dc2626; font-weight: bold; font-size: 15px;">${formatCurrency((order.total || 0) - (order.amountPaid || 0), true)}</p>
              </div>
              ` : ''}
              ${order.paymentDate ? `
              <div>
                <p style="color: #666; font-size: 12px; margin-bottom: 5px;">Last Payment</p>
                <p style="color: #1a1a1a; font-weight: 600; font-size: 15px;">${new Date(order.paymentDate).toLocaleDateString()}</p>
              </div>
              ` : ''}
            </div>
          </div>
          ` : ''}

          ${order.assignedSalesPersonName ? `
          <div style="margin-top: 30px; padding: 15px; background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%); border-radius: 12px; border-left: 4px solid #9333ea;">
            <div style="font-size: 11px; color: #9333ea; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; font-weight: 600;">Sales Representative</div>
            <div style="font-size: 13px; color: #1a1a1a; font-weight: 500;">${order.assignedSalesPersonName}</div>
          </div>
          ` : ''}

          ${invoiceNotesSectionHtml}

          <div class="footer">
            <h3>Thank You! 🎉</h3>
            <p>We appreciate your business and look forward to serving you again.</p>
            <p style="margin-top: 8px;">Questions? Contact us at ${storeEmail || storePhone || 'our support'}</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};
