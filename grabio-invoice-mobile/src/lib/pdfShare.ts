import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { FinanceInvoice } from '../types';

function money(n: number, currency: string) {
  return `${currency} ${n.toFixed(2)}`;
}

function buildInvoiceHtml(invoice: FinanceInvoice, companyName: string) {
  const items = invoice.items || [];
  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const taxRate = invoice.tax ?? 0;
  const discount = invoice.discount ?? 0;
  const taxAmount = subtotal * (taxRate / 100);
  const total = invoice.total ?? invoice.amount ?? subtotal + taxAmount - discount;
  const rows = items
    .map(
      (i) =>
        `<tr><td>${i.description}</td><td style="text-align:right">${i.quantity}</td><td style="text-align:right">${i.unitPrice.toFixed(2)}</td><td style="text-align:right">${i.subtotal.toFixed(2)}</td></tr>`,
    )
    .join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:Helvetica,Arial,sans-serif;padding:24px;color:#1A202C}
    h1{color:#38B2AC;margin:0 0 4px}
    table{width:100%;border-collapse:collapse;margin-top:16px}
    th,td{border-bottom:1px solid #e2e8f0;padding:8px;text-align:left}
    .totals{margin-top:16px;text-align:right}
  </style></head><body>
    <h1>${companyName}</h1>
    <p>Invoice #${invoice.invoiceNumber || invoice.id}</p>
    <p><strong>Bill to:</strong> ${invoice.clientName}</p>
    <p>Date: ${new Date(invoice.date).toLocaleDateString()}</p>
    <table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="totals">
      <div>Subtotal: ${money(subtotal, invoice.currency)}</div>
      ${taxRate ? `<div>Tax (${taxRate}%): ${money(taxAmount, invoice.currency)}</div>` : ''}
      ${discount ? `<div>Discount: -${money(discount, invoice.currency)}</div>` : ''}
      <div><strong>Total: ${money(total, invoice.currency)}</strong></div>
      <div>Status: ${invoice.status}</div>
    </div>
    ${invoice.notes ? `<p><strong>Notes:</strong> ${invoice.notes}</p>` : ''}
  </body></html>`;
}

export async function shareInvoicePdf(invoice: FinanceInvoice, companyName = 'Grabio Store') {
  const html = buildInvoiceHtml(invoice, companyName);
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Invoice ${invoice.invoiceNumber || invoice.id}` });
  }
  return uri;
}
