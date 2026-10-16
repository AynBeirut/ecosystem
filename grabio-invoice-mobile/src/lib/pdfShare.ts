import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { FinanceEstimate, FinanceExpense, FinanceInvoice, FinancePurchaseOrder } from '../types';
import { buildFinanceDocumentHtml, financePdfFileName } from './documentPdfHtml';
import { loadDocumentCompany } from './documentBranding';
import { buildDocumentHtml } from './pdfDocumentHtml';

export async function shareInvoicePdf(
  invoice: FinanceInvoice,
  profile: Record<string, unknown> | null,
) {
  const html = buildFinanceDocumentHtml('invoice', invoice, profile);
  const fileName = financePdfFileName('invoice', invoice);
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: fileName,
    });
  }
  return uri;
}

export async function shareEstimatePdf(
  estimate: FinanceEstimate,
  profile: Record<string, unknown> | null,
) {
  const html = buildFinanceDocumentHtml('estimate', estimate, profile);
  const fileName = financePdfFileName('estimate', estimate);
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: fileName,
    });
  }
  return uri;
}

async function shareHtml(html: string, dialogTitle: string) {
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle });
  }
  return uri;
}

export async function shareExpensePdf(expense: FinanceExpense, storeId: string) {
  const company = await loadDocumentCompany(storeId);
  const html = buildDocumentHtml('expense', { ...expense }, company);
  return shareHtml(html, expense.name || 'Expense');
}

export async function sharePurchaseOrderPdf(order: FinancePurchaseOrder, storeId: string) {
  const company = await loadDocumentCompany(storeId);
  const html = buildDocumentHtml('purchaseOrder', { ...order }, company);
  return shareHtml(html, order.poNumber || order.supplierName || 'Purchase order');
}
