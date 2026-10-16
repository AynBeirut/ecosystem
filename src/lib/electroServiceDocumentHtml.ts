import type { Order } from '../types/order';
import type { StoreProfile } from '../types/storeProfile';
import { resolveA4DocumentBranding } from './financeDocumentSettingsCore';
import { amountInWordsUsd } from './documentNumberWords';

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatMultilineHtml = (value: string): string =>
  escapeHtml(value).replace(/\n/g, '<br/>');

/** Country is its own field. Skip it when the address already contains that word. */
export function joinAddressAndCountry(address?: string, country?: string): string {
  const addr = (address || '').trim();
  const ctry = (country || '').trim();
  if (!ctry) return addr;
  if (!addr) return ctry;
  if (addr.toLowerCase().includes(ctry.toLowerCase())) return addr;
  return `${addr} · ${ctry}`;
}

function formatDocDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

function resolveCatalogDescription(product?: {
  description?: string;
  productDescription?: string;
  shortDescription?: string;
  details?: string;
} | null): string {
  if (!product) return '';
  const candidates = [product.description, product.productDescription, product.shortDescription, product.details];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

export type ProfessionalDocumentKind = 'invoice' | 'estimate';

/** Shared A4 invoice/estimate structure. Colors, logo, and signature come from document settings. */
export function generateProfessionalDocumentHTML(params: {
  kind: ProfessionalDocumentKind;
  order: Order & { id: string };
  products: Array<{ id?: string; name?: string; description?: string }>;
  storeProfile: StoreProfile | null;
  formatCurrency: (amount: number, showDual?: boolean) => string;
  documentRef: string;
}): string {
  const { kind, order, products, storeProfile, formatCurrency, documentRef } = params;
  const branding = resolveA4DocumentBranding(storeProfile);
  const templateNumber = branding.templateNumber;
  const colored = branding.colorMode !== 'bw';
  const accent = colored ? branding.primaryColor || '#E8752B' : '#111827';
  const slot = colored ? accent : 'transparent';
  const slotText = colored ? '#ffffff' : '#111827';
  const borderColor = branding.borderColor || (colored ? accent : '#111827');
  const fontPx =
    { xs: 11, s: 12, m: 13, l: 15, xl: 17, xxl: 19 }[branding.fontScale as string] || 13;
  const headerSpace = branding.headerSpace;
  const title = kind === 'estimate' ? 'ESTIMATE' : 'INVOICE';
  const storeLogo = branding.logo;
  const companyName = branding.companyName;
  const showHeadingName = branding.showCompanyName;
  const invoiceDate = new Date(order.createdAt || Date.now());
  const footerNote = (branding.footer || '').trim();
  const bankDetails = (branding.bankDetails || '').trim();
  const signature = branding.signature || '';
  const signatoryName = branding.signatoryName || '';
  const logoHtml = storeLogo
    ? `<img src="${escapeHtml(storeLogo)}" alt="" />`
    : '';
  const signatureHtml =
    signature || signatoryName
      ? `<div class="signature-block">
          ${signature ? `<img src="${escapeHtml(signature)}" alt="Signature" />` : ''}
          ${signatoryName ? `<div class="sig-name">${escapeHtml(signatoryName)}</div>` : ''}
          <div class="sig-label">Signature</div>
        </div>`
      : '';

  const labeledRow = (label: string, value: string) =>
    value
      ? `<div class="company-line"><span class="company-label">${escapeHtml(label)}</span> ${escapeHtml(value)}</div>`
      : '';

  const contactInHero = branding.contactPlacement !== 'footer';
  const locationLine = joinAddressAndCountry(branding.address, branding.country);
  const domainLine = branding.website || '';
  const companyBlock = [
    showHeadingName ? labeledRow('Company Name:', companyName) : '',
    contactInHero ? labeledRow('Address:', locationLine) : '',
    labeledRow('Phone:', branding.phone),
    labeledRow('Email:', branding.email),
    contactInHero ? labeledRow('Website:', domainLine) : '',
    labeledRow('Tax Id:', branding.taxNumber),
  ]
    .filter(Boolean)
    .join('');
  const footerContact =
    !contactInHero && (locationLine || domainLine)
      ? `<div class="doc-footer-contact">${[locationLine, domainLine].filter(Boolean).map((part) => escapeHtml(part)).join(' · ')}</div>`
      : '';

  let qtySum = 0;
  let amountSum = 0;
  const rows =
    order.items?.map((item, index) => {
      const product = products.find((p) => p.id === item.productId);
      const itemName = item.productName || product?.name || 'Product';
      const rawDescription = (item.description || resolveCatalogDescription(product)).trim();
      const itemDescription = rawDescription.toLowerCase() === itemName.trim().toLowerCase() ? '' : rawDescription;
      const price = item.price || 0;
      const qty = item.quantity || 0;
      let lineTotal = price * qty;
      if (item.discountValue && item.discountValue > 0) {
        const discount =
          item.discountType === 'percentage'
            ? (lineTotal * item.discountValue) / 100
            : item.discountValue;
        lineTotal -= discount;
      }
      qtySum += qty;
      amountSum += lineTotal;
      const rowBg = index % 2 === 0 ? '#ffffff' : '#f8fafc';
      const unit = (item as { unit?: string }).unit || 'Pcs';
      return `
        <tr style="background:${rowBg}">
          <td class="sr">${index + 1}</td>
          <td class="product">
            <div class="product-name">${escapeHtml(itemName)}</div>
            ${itemDescription ? `<div class="product-desc">${escapeHtml(itemDescription)}</div>` : ''}
          </td>
          <td class="num qty">
            <div>${qty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div class="unit">${escapeHtml(unit)}</div>
          </td>
          <td class="num">${formatCurrency(price, true)}</td>
          <td class="num">${formatCurrency(lineTotal, true)}</td>
        </tr>`;
    }).join('') || '';

  const orderTotal = Number(order.total) || amountSum;
  const pleaseNoteHtml = footerNote
    ? `<div class="please-note">
        <div class="please-note-title">Please Note</div>
        <div class="please-note-body">${formatMultilineHtml(footerNote)}</div>
      </div>`
    : '';

  const brand = `<div class="brand"><div class="logo">${logoHtml}</div><div class="company">${companyBlock}</div></div>`;
  const refBlock = `<div class="doc-ref"><div class="number">${escapeHtml(documentRef)}</div><div class="date">${formatDocDate(invoiceDate)}</div></div>`;
  const titleEl = `<h1 class="doc-title">${title}</h1>`;
  const dueBox = `<div class="due-box"><div>Amount due</div><strong>${formatCurrency(orderTotal, true)}</strong></div>`;
  const badge = `<div class="badge">${titleEl}<div>${escapeHtml(documentRef)}</div><div>${formatDocDate(invoiceDate)}</div></div>`;
  const pills = `<div class="pills"><span class="pill">${title}</span><span class="pill">${escapeHtml(documentRef)}</span></div>`;
  const header =
    templateNumber === 1
      ? `<div class="slot-header">${brand}</div><div class="title-row">${titleEl}${refBlock}</div>`
      : templateNumber === 2
        ? `<div class="h-split">${brand}${refBlock}</div><div class="title-rules"><div class="rule"></div>${titleEl}<div class="rule"></div></div>`
        : templateNumber === 4
          ? `<div class="h-split">${brand}${pills}</div>`
          : templateNumber === 5 || templateNumber === 8
            ? `<div class="h-split flip"><div><div class="huge">${title}</div>${refBlock}</div><div class="brand-side">${brand}</div></div>`
            : templateNumber === 9
              ? `<div class="h-split">${brand}<div class="title-stack">${titleEl}${dueBox}</div></div>`
              : templateNumber === 10
                ? `<div class="h-split">${brand}${badge}</div>`
                : templateNumber === 7
                  ? `<div class="h-split"><div class="stack">${logoHtml ? `<div class="logo">${logoHtml}</div>` : ''}<div class="company">${companyBlock}</div></div>${titleEl}${refBlock}</div>`
                  : `<div class="h-split">${brand}${refBlock}</div><div class="title-plain">${titleEl}</div>`;

  const showBank = templateNumber !== 5 && Boolean(bankDetails);
  const bankBlock = showBank
    ? `<div class="bank-box"><div class="bank-title">Banking details</div><div>${formatMultilineHtml(bankDetails)}</div></div>`
    : '';
  const totalsBox = `<div class="totals-box">
        <div class="row"><span>Total</span><span>${formatCurrency(amountSum, true)}</span></div>
        <div class="row grand"><span>Grand Total</span><span>${formatCurrency(orderTotal, true)}</span></div>
        ${templateNumber === 6 ? '' : signatureHtml}
      </div>`;
  const bottom =
    templateNumber === 6
      ? `<div class="mid-row"><div>${pleaseNoteHtml}<div class="amount-words">Amount In Words : ${escapeHtml(amountInWordsUsd(orderTotal))}</div></div><div>${bankBlock}${signatureHtml}</div>${totalsBox}</div>`
      : `<div class="bottom"><div class="bottom-left">${pleaseNoteHtml}<div class="amount-words">Amount In Words : ${escapeHtml(amountInWordsUsd(orderTotal))}</div>${bankBlock}</div>${totalsBox}</div>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title} ${escapeHtml(documentRef)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Helvetica, Arial, sans-serif; color: #111827; background: #fff; padding: ${headerSpace + 20}px 32px 28px; font-size: ${fontPx}px; }
    .page { max-width: 820px; margin: 0 auto; }
    .brand { display: flex; gap: 14px; align-items: flex-start; justify-content: ${branding.logoAlign === 'right' ? 'flex-end' : branding.logoAlign === 'center' ? 'center' : 'flex-start'}; }
    .logo img { max-width: 150px; max-height: 68px; object-fit: contain; }
    .company { text-align: ${branding.orgAlign}; line-height: 1.45; font-size: 0.92em; }
    .company-label { font-weight: 700; }
    .h-split, .title-row { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; }
    .title-row { align-items: center; margin: 14px 0; }
    .doc-title { font-size: 1.6em; letter-spacing: 0.14em; font-weight: 700; }
    .title-plain { text-align: center; margin: 12px 0 16px; }
    .title-rules { text-align: center; margin: 10px 0 16px; }
    .rule { height: 2px; background: ${slot === 'transparent' ? '#111' : accent}; margin: 6px 0; }
    .doc-ref { text-align: right; }
    .doc-ref .number { font-size: 1.8em; font-weight: 800; }
    .huge { font-size: 2.6em; font-weight: 800; letter-spacing: 0.04em; }
    .slot-header { background: ${slot}; color: ${slotText}; padding: 14px 16px; margin-bottom: 8px; }
    .slot-header .company, .slot-header .company-label { color: ${slotText}; }
    .pills { display: flex; flex-direction: column; gap: 6px; align-items: flex-end; }
    .pill { background: ${slot === 'transparent' ? '#fff' : accent}; color: ${slotText}; border: 1px solid ${borderColor}; padding: 6px 12px; font-weight: 700; letter-spacing: 0.08em; }
    .badge, .due-box { background: ${slot === 'transparent' ? '#fff' : accent}; color: ${slotText}; border: 1px solid ${borderColor}; padding: 10px 14px; text-align: right; min-width: 140px; }
    .stack { display: flex; flex-direction: column; gap: 6px; }
    .meta-row { display: flex; justify-content: space-between; margin: 14px 0; }
    .bill-to .label { font-weight: 700; }
    table.items { width: 100%; border-collapse: collapse; border: 1px solid ${borderColor}; }
    table.items th { background: ${templateNumber === 4 || templateNumber === 9 ? 'transparent' : slot === 'transparent' ? '#f3f4f6' : accent}; color: ${templateNumber === 4 || templateNumber === 9 || slot === 'transparent' ? '#111' : '#fff'}; padding: 8px; border: 1px solid ${borderColor}; text-align: left; }
    table.items td { padding: 8px; border: 1px solid ${borderColor}; vertical-align: top; }
    .tpl-5 table.items th, .tpl-5 table.items td { background: ${colored ? accent : '#fff'}; color: ${colored ? '#fff' : '#111'}; }
    .tpl-5 .product-desc, .tpl-5 .unit { color: ${colored ? 'rgba(255,255,255,.85)' : '#6b7280'}; }
    table.items .num { text-align: right; }
    .product-name { font-weight: 700; }
    .product-desc, .unit { color: #6b7280; font-size: 0.85em; }
    .bottom, .mid-row { display: flex; justify-content: space-between; gap: 16px; margin-top: 16px; align-items: flex-start; }
    .bottom-left { flex: 1; }
    .please-note-title { font-weight: 700; border-bottom: 2px solid ${borderColor}; display: inline-block; margin-bottom: 6px; }
    .amount-words { margin-top: 10px; font-weight: 600; }
    .totals-box { width: 240px; }
    .totals-box .row { display: flex; justify-content: space-between; padding: 6px 8px; border: 1px solid ${borderColor}; border-bottom: none; }
    .totals-box .row.grand { background: ${templateNumber === 4 || templateNumber === 9 || templateNumber === 10 ? (colored ? accent : '#f3f4f6') : slot === 'transparent' && templateNumber !== 6 ? '#f3f4f6' : colored || templateNumber === 6 ? (colored ? accent : '#e5e7eb') : accent}; color: ${colored && templateNumber !== 4 && templateNumber !== 9 ? '#fff' : '#111'}; font-weight: 800; border-color: ${borderColor}; }
    .tpl-4 .grand, .tpl-9 .grand, .tpl-10 .grand { background: ${colored ? accent : '#f3f4f6'} !important; color: ${colored ? '#fff' : '#111'} !important; }
    .tpl-2 .doc-title, .tpl-3 .doc-title { color: ${colored ? accent : '#111'}; }
    .tpl-6 .grand { background: ${colored ? accent : '#e5e7eb'} !important; color: ${colored ? '#fff' : '#111'} !important; }
    .signature-block { margin-top: 16px; text-align: right; }
    .signature-block img { max-height: 52px; }
    .bank-box { margin-top: 12px; border: 1px solid ${borderColor}; padding: 8px 10px; font-size: 0.92em; }
    .doc-footer-contact { margin-top: 22px; text-align: center; color: #4b5563; border-top: 1px solid ${borderColor}; padding-top: 8px; }
  </style>
</head>
<body class="tpl-${templateNumber} mode-${colored ? 'color' : 'bw'}">
  <div class="page">
    ${header}
    <div class="meta-row">
      <div class="bill-to"><div class="label">Bill To</div><div>${escapeHtml(order.customerName || 'N/A')}</div></div>
    </div>
    <table class="items">
      <thead><tr><th>Sr no.</th><th>Product</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead>
      <tbody>
        ${rows}
        <tr class="total-row"><td colspan="2">Total</td><td class="num">${qtySum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td></td><td class="num">${formatCurrency(amountSum, true)}</td></tr>
      </tbody>
    </table>
    ${bottom}
    ${footerContact}
  </div>
</body>
</html>`;
}
