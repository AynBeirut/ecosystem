import type { LineItem } from '../types';
import type { DocumentCompany } from './documentBranding';
import { isNipcoCompany } from './documentBranding';
import type { FinanceInvoiceTemplate } from './invoiceTemplateMap';
import type { DocumentLayoutStyle, DocumentLineWeight } from './templateStyles';
import { numberToWords } from './numberToWords';
import { invoicePaymentLabel, normalizeInvoiceStatus } from './invoiceStatus';
import { resolveDocDiscount } from './invoiceDiscount';

export type PdfDocType = 'invoice' | 'estimate' | 'receipt' | 'purchaseOrder' | 'expense';

const TITLES: Record<PdfDocType, string> = {
  invoice: 'Invoice',
  estimate: 'Estimate',
  receipt: 'Receipt',
  purchaseOrder: 'Purchase Order',
  expense: 'Expense',
};

type AnyDoc = Record<string, unknown>;

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(n: number, currency: string) {
  return `${currency} ${n.toFixed(2)}`;
}

function formatDate(value: unknown): string {
  if (!value) return new Date().toLocaleDateString();
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
}

function docNumber(type: PdfDocType, doc: AnyDoc): string {
  if (type === 'invoice') return String(doc.invoiceNumber || doc.id || '');
  if (type === 'purchaseOrder') return String(doc.poNumber || doc.orderNumber || doc.id || '');
  return String(doc.id || '');
}

function partyLabel(type: PdfDocType): string {
  if (type === 'purchaseOrder' || type === 'expense') return 'Supplier / Vendor';
  return 'Bill to';
}

function partyName(type: PdfDocType, doc: AnyDoc): string {
  if (type === 'purchaseOrder') return String(doc.supplierName || '');
  if (type === 'expense') return String(doc.vendorName || doc.name || '');
  return String(doc.clientName || '');
}

function ensureItems(type: PdfDocType, doc: AnyDoc): LineItem[] {
  const raw = doc.items || doc.lineItems;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((item, idx) => {
      const row = item as Record<string, unknown>;
      const qty = Number(row.quantity) || 0;
      const unitPrice = Number(row.unitPrice) || 0;
      return {
        id: String(row.id || `line-${idx}`),
        description: String(row.description || ''),
        quantity: qty,
        unitPrice,
        subtotal: Number(row.subtotal) || qty * unitPrice,
      };
    });
  }
  const amount = Number(doc.amount ?? doc.total ?? 0) || 0;
  let description = String(doc.notes || '');
  if (!description) {
    if (type === 'receipt') description = `Payment (${doc.paymentMethod || 'cash'})`;
    else if (type === 'expense') description = String(doc.name || 'Expense');
    else description = TITLES[type];
  }
  return [
    {
      id: 'line-0',
      description,
      quantity: 1,
      unitPrice: amount,
      subtotal: amount,
    },
  ];
}

function totals(doc: AnyDoc, items: LineItem[]) {
  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const taxRate = Number(doc.tax ?? doc.taxRate ?? 0) || 0;
  const { amount: discount, label: discountLabel } = resolveDocDiscount(subtotal, {
    discount: doc.discount != null ? Number(doc.discount) : undefined,
    discountType: doc.discountType ? String(doc.discountType) : undefined,
    discountValue: doc.discountValue != null ? Number(doc.discountValue) : undefined,
  });
  const taxAmount = subtotal * (taxRate / 100);
  const total = Number(doc.total ?? doc.amount ?? subtotal + taxAmount - discount) || 0;
  return { subtotal, taxRate, discount, discountLabel, taxAmount, total };
}

function templateAccent(template: FinanceInvoiceTemplate, primary: string, secondary: string) {
  if (template === 'basic') return { header: '#1A202C', accent: '#B7791F', bg: '#FFFAF0' };
  if (template === 'professional') return { header: '#6B46C1', accent: '#DD6B20', bg: '#FAF5FF' };
  return { header: primary, accent: secondary, bg: '#F0FDFA' };
}

function lineWeightCss(weight: DocumentLineWeight) {
  if (weight === 'fine') {
    return { border: '0.5px', thWeight: '500', titleWeight: '700', tablePad: '6px', bodySize: '12px' };
  }
  if (weight === 'bold') {
    return { border: '2px', thWeight: '800', titleWeight: '900', tablePad: '10px', bodySize: '14px' };
  }
  return { border: '1px', thWeight: '600', titleWeight: '800', tablePad: '8px', bodySize: '13px' };
}

function formatWebsiteDisplay(website?: string): string | null {
  const value = (website || '').trim();
  if (!value) return null;
  return value.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

function documentFooterHtml(company: DocumentCompany): string {
  const domain = formatWebsiteDisplay(company.website);
  const country = (company.country || '').trim();
  if (!domain && !country) return '';
  return `<footer class="doc-footer">
    ${country ? `<div class="footer-country">${esc(country)}</div>` : ''}
    ${domain ? `<div class="footer-domain">${esc(domain)}</div>` : ''}
  </footer>`;
}

const PAGE_SHEET_CSS = `
  @page { size: A4; margin: 12mm; }
  html,body{margin:0;padding:0}
  body{font-family:Helvetica,Arial,sans-serif;color:#1A202C;background:#fff}
  .page{width:210mm;min-height:297mm;margin:0 auto;box-sizing:border-box;padding:10mm 12mm 12mm}
  .sheet{min-height:275mm;display:flex;flex-direction:column}
  .body-stack{flex:1;display:flex;flex-direction:column}
  .body-content{flex:1}
  .doc-footer{margin-top:auto;padding-top:14px;border-top:1px solid #e2e8f0;text-align:center}
  .footer-country{font-size:11px;color:#64748b;margin-bottom:4px}
  .footer-domain{font-size:12px;font-weight:700;color:#334155}
`;

function buildCompanyColumn(company: DocumentCompany, logoHtml: string): string {
  const nameBlock =
    company.showCompanyName && company.name.trim()
      ? `<h1 class="company-name">${esc(company.name)}</h1>`
      : '';
  const logoBlock = logoHtml ? `<div class="logo-wrap">${logoHtml}</div>` : '';
  const contactParts = [company.phone?.trim()].filter(Boolean);
  const contactBlock = contactParts.length
    ? `<p class="contact-line">${esc(contactParts.join(' · '))}</p>`
    : '';

  return `<div class="company-col">
    ${logoBlock}
    ${nameBlock}
    ${company.email?.trim() ? `<p class="company-line">${esc(company.email.trim())}</p>` : ''}
    ${contactBlock}
    ${company.taxId ? `<p class="company-line">Tax ID: ${esc(company.taxId)}</p>` : ''}
  </div>`;
}

function buildTitleColumn(title: string, docNum: string): string {
  return `<div class="title-col">
    <div class="doc-badge">${title}</div>
    <div class="doc-number">#${esc(docNum)}</div>
  </div>`;
}

function buildHeaderHtml(
  layout: DocumentLayoutStyle,
  colors: { header: string; accent: string; bg: string },
  title: string,
  logoHtml: string,
  company: DocumentCompany,
  docNum: string,
): string {
  const companyCol = buildCompanyColumn(company, logoHtml);
  const titleCol = buildTitleColumn(title, docNum);
  const inner = `<div class="header-row">${companyCol}${titleCol}</div>`;

  if (layout === 'accent-line') {
    return `<div class="header accent-line" style="border-top:4px solid ${colors.header}">${inner}</div>`;
  }
  if (layout === 'minimal') {
    return `<div class="header minimal">${inner}</div>`;
  }
  if (layout === 'sidebar') {
    return `<div class="header sidebar" style="border-left:8px solid ${colors.header}">${inner}</div>`;
  }
  return `<div class="header classic" style="background:${colors.header}">${inner}</div>`;
}

function docPaymentStatusLine(type: PdfDocType, doc: AnyDoc): string {
  if (type !== 'invoice' || !doc.status) return doc.status ? `<p class="meta">Status: ${esc(doc.status)}</p>` : '';
  const label = invoicePaymentLabel(
    normalizeInvoiceStatus(doc.status),
    doc.paidAmount != null ? Number(doc.paidAmount) : undefined,
    Number(doc.total ?? doc.amount) || 0,
  );
  return `<p class="meta">Payment: ${esc(label)}</p>`;
}

function amountInWordsBlock(total: number, currency: string): string {
  const words = numberToWords(Math.max(0, total), currency);
  return `<div class="amount-words"><span class="amount-words-label">Total in words:</span> ${esc(words)}</div>`;
}

function totalsSection(
  subtotal: number,
  taxRate: number,
  taxAmount: number,
  discount: number,
  discountLabel: string,
  total: number,
  currency: string,
): string {
  const discountLine = discount
    ? `<div>Discount${discountLabel ? ` (${esc(discountLabel)})` : ''}: -${money(discount, currency)}</div>`
    : '';
  return `<div class="totals">
        <div>Subtotal: ${money(subtotal, currency)}</div>
        ${taxRate ? `<div>Tax (${taxRate}%): ${money(taxAmount, currency)}</div>` : ''}
        ${discountLine}
        <div><strong>Total: ${money(total, currency)}</strong></div>
      </div>
      ${amountInWordsBlock(total, currency)}`;
}

function itemsTableHtml(items: LineItem[]): string {
  const rows = items
    .map(
      (i) =>
        `<tr>
          <td>${esc(i.description)}</td>
          <td class="num">${i.quantity}</td>
          <td class="num">${i.unitPrice.toFixed(2)}</td>
          <td class="num">${i.subtotal.toFixed(2)}</td>
        </tr>`,
    )
    .join('');
  return `<table>
    <thead><tr>
      <th>Item</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Total</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function buildTemplatedHtml(type: PdfDocType, doc: AnyDoc, company: DocumentCompany): string {
  const items = ensureItems(type, doc);
  const { subtotal, taxRate, discount, discountLabel, taxAmount, total } = totals(doc, items);
  const currency = String(doc.currency || 'USD');
  const colors = templateAccent(company.invoiceTemplate, company.primaryColor, company.secondaryColor);
  const layout = company.documentLayout || 'classic';
  const line = lineWeightCss(company.documentLineWeight || 'regular');
  const title = TITLES[type];
  const logoHtml = company.logo
    ? `<img src="${esc(company.logo)}" alt="logo" class="company-logo" />`
    : '';
  const header = buildHeaderHtml(layout, colors, title, logoHtml, company, docNumber(type, doc));
  const bodyBg = company.pageBackgroundColor || (layout === 'minimal' ? '#fff' : colors.bg);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    ${PAGE_SHEET_CSS}
    body{font-size:${line.bodySize}}
    .header{padding:20px 28px;border-radius:8px 8px 0 0}
    .header-row{display:flex;justify-content:space-between;align-items:flex-start;gap:24px}
    .company-col{flex:1;min-width:0}
    .title-col{flex-shrink:0;text-align:right;min-width:120px}
    .logo-wrap{margin-bottom:8px}
    .company-logo{display:block;max-height:56px;max-width:180px;object-fit:contain}
    .company-name{margin:0 0 6px;font-size:22px;font-weight:${line.titleWeight};line-height:1.2}
    .company-line,.contact-line{margin:4px 0 0;font-size:12px;line-height:1.45}
    .doc-badge{font-size:26px;font-weight:${line.titleWeight};line-height:1.1}
    .doc-number{margin-top:6px;font-size:13px;opacity:.9}
    .header.classic{color:#fff}
    .header.classic .company-name,.header.classic .company-line,.header.classic .contact-line,.header.classic .doc-badge,.header.classic .doc-number{color:#fff}
    .header.accent-line,.header.minimal,.header.sidebar{background:#fff;color:#1A202C}
    .header.accent-line .doc-badge,.header.minimal .doc-badge,.header.sidebar .doc-badge{color:${colors.accent}}
    .header.minimal{border-bottom:${line.border} solid #e2e8f0}
    .header.sidebar{padding-left:22px}
    .body{border:${line.border} solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;padding:20px 28px 16px;background:${bodyBg}}
    .doc-title{color:${colors.accent};font-size:20px;font-weight:${line.titleWeight};margin:0 0 12px}
    table{width:100%;border-collapse:collapse;margin-top:12px}
    th,td{border-bottom:${line.border} solid #e2e8f0;padding:${line.tablePad};text-align:left;font-size:${line.bodySize}}
    th{background:#f8fafc;font-weight:${line.thWeight}}
    .num{text-align:right}
    .totals{margin-top:14px;text-align:right;font-size:${line.bodySize};line-height:1.7}
    .amount-words{margin-top:14px;padding:12px 14px;background:#f8fafc;border:${line.border} solid #e2e8f0;border-radius:6px;font-size:${line.bodySize};line-height:1.55;color:#334155}
    .amount-words-label{font-weight:700;font-style:normal;color:#1A202C}
    .meta{color:#64748b;font-size:12px;margin:4px 0}
    .sig{margin-top:24px;font-size:12px;color:#64748b}
  </style></head><body><div class="page"><div class="sheet">
    ${header}
    <div class="body body-stack">
      <div class="body-content">
      <p class="doc-title">${title}</p>
      <p class="meta"><strong>${partyLabel(type)}:</strong> ${esc(partyName(type, doc))}</p>
      <p class="meta">Date: ${formatDate(doc.date || doc.paymentDate || doc.startDate)}</p>
      ${docPaymentStatusLine(type, doc)}
      ${doc.paymentMethod ? `<p class="meta">Payment: ${esc(doc.paymentMethod)}</p>` : ''}
      ${itemsTableHtml(items)}
      ${totalsSection(subtotal, taxRate, taxAmount, discount, discountLabel, total, currency)}
      ${doc.notes ? `<p class="meta" style="margin-top:16px"><strong>Notes:</strong> ${esc(doc.notes)}</p>` : ''}
      ${company.footerNote ? `<p class="meta" style="margin-top:12px">${esc(company.footerNote)}</p>` : ''}
      ${company.signature ? `<div class="sig"><img src="${esc(company.signature)}" style="max-height:48px" /><div>Authorized signature</div></div>` : ''}
      </div>
      ${documentFooterHtml(company)}
    </div>
  </div></div></body></html>`;
}

function buildNipcoHtml(type: PdfDocType, doc: AnyDoc, company: DocumentCompany): string {
  const items = ensureItems(type, doc);
  const { subtotal, taxRate, discount, discountLabel, taxAmount, total } = totals(doc, items);
  const currency = String(doc.currency || 'USD');
  const title = TITLES[type];
  const logoHtml = company.logo
    ? `<img src="${esc(company.logo)}" alt="logo" class="company-logo" />`
    : '';
  const nipcoBlue = '#1e3a5f';
  const nipcoHeaderLeft = `${logoHtml ? `<div class="logo-wrap">${logoHtml}</div>` : ''}${
    company.showCompanyName && company.name ? `<h1 class="company-name">${esc(company.name)}</h1>` : ''
  }${company.email?.trim() ? `<div class="company-line">${esc(company.email.trim())}</div>` : ''}${
    company.phone?.trim() ? `<div class="company-line">${esc(company.phone.trim())}</div>` : ''
  }${
    company.taxId ? `<div class="company-line">Tax ID: ${esc(company.taxId)}</div>` : ''
  }`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    ${PAGE_SHEET_CSS}
    .bar{background:${nipcoBlue};color:#fff;padding:18px 24px}
    .bar-row{display:flex;justify-content:space-between;align-items:flex-start;gap:24px}
    .company-col{flex:1;min-width:0}
    .title-col{flex-shrink:0;text-align:right;font-size:22px;font-weight:800;line-height:1.1}
    .logo-wrap{margin-bottom:8px}
    .company-logo{display:block;max-height:64px;max-width:200px;object-fit:contain}
    .company-name{margin:0 0 6px;font-size:20px;font-weight:800}
    .company-line{font-size:12px;opacity:.9;margin-top:4px;line-height:1.4}
    .content{padding:24px 24px 16px;flex:1;display:flex;flex-direction:column}
    .badge{display:inline-block;background:#2563eb;color:#fff;padding:6px 12px;border-radius:4px;font-weight:700;margin-bottom:12px}
    table{width:100%;border-collapse:collapse;margin-top:16px}
    th{background:#eff6ff;color:${nipcoBlue};padding:8px;text-align:left}
    td{padding:8px;border-bottom:1px solid #e5e7eb}
    .num{text-align:right}
    .totals{margin-top:14px;text-align:right;font-size:13px;line-height:1.7}
    .amount-words{margin-top:14px;padding:12px 14px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:6px;font-size:12px;line-height:1.55;color:#334155}
    .amount-words-label{font-weight:700;color:#1e3a5f}
    .footer{margin-top:20px;font-size:11px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:12px}
    .doc-footer .footer-domain{color:#1e3a5f}
  </style></head><body><div class="page"><div class="sheet">
    <div class="bar">
      <div class="bar-row">
        <div class="company-col">${nipcoHeaderLeft}</div>
        <div class="title-col">${title}</div>
      </div>
    </div>
    <div class="content body-stack">
      <div class="body-content">
      <span class="badge">#${esc(docNumber(type, doc))}</span>
      <div><strong>${partyLabel(type)}:</strong> ${esc(partyName(type, doc))}</div>
      <div>Date: ${formatDate(doc.date || doc.paymentDate || doc.startDate)}</div>
      ${itemsTableHtml(items)}
      ${totalsSection(subtotal, taxRate, taxAmount, discount, discountLabel, total, currency)}
      ${doc.notes ? `<p><strong>Notes:</strong> ${esc(doc.notes)}</p>` : ''}
      <div class="footer">Nipco branded document — template locked for this store.</div>
      </div>
      ${documentFooterHtml(company)}
    </div>
  </div></div></body></html>`;
}

export function buildDocumentHtml(type: PdfDocType, doc: AnyDoc, company: DocumentCompany): string {
  if (isNipcoCompany(company)) return buildNipcoHtml(type, doc, company);
  return buildTemplatedHtml(type, doc, company);
}
