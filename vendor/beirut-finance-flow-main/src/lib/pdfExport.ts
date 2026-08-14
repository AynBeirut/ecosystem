import { amountToWords } from "@/components/InvoiceTemplates";
import {
  cleanLines,
  computeDocumentTotals,
  normalizeExportPayload,
  normalizeHumanText,
  resolveInvoiceNumber,
  resolveTaxId,
} from "@/lib/financeDocumentNormalization";
import { formatCurrency } from "@/lib/utils";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// Direct PDF download — no browser print dialog (avoids about:blank / headers on mobile)
export type ExportableType = "invoice" | "estimate" | "purchaseOrder" | "receipt" | "payment";

const TITLE_MAP: Record<ExportableType, string> = {
  invoice: "Invoice",
  estimate: "Estimate",
  purchaseOrder: "Purchase Order",
  receipt: "Receipt",
  payment: "Payment Order",
};

const ARABIC_FONT_NAME = "NotoArabic";
const ARABIC_FONT_FILE = "NotoSansArabic-Regular.ttf";
let arabicFontBase64: string | null = null;

function containsArabic(value: string): boolean {
  return /[\u0600-\u06FF]/.test(value);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function ensureArabicFont(pdf: jsPDF): Promise<void> {
  try {
    if (!arabicFontBase64) {
      const res = await fetch(`/fonts/${ARABIC_FONT_FILE}`);
      if (!res.ok) return;
      arabicFontBase64 = arrayBufferToBase64(await res.arrayBuffer());
    }
    pdf.addFileToVFS(ARABIC_FONT_FILE, arabicFontBase64);
    pdf.addFont(ARABIC_FONT_FILE, ARABIC_FONT_NAME, "normal");
  } catch {
    // Fall back to the built-in font if the optional Arabic font asset is unavailable.
  }
}

function stripCorruptedPdfText(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/[þÞ]/.test(line))
    .filter((line) => !/(?:Ã|Â|Ø|Ù|Ð|Ñ).{2,}/.test(line))
    .join("\n");
}

function text(v: unknown): string {
  if (v === null || v === undefined) return "";
  return stripCorruptedPdfText(String(v));
}

function formatDocDate(value: unknown): string {
  if (!value) {
    return new Date().toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
  const parsed = new Date(String(value));
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
  const isoDay = String(value).split("T")[0];
  return isoDay || String(value);
}

function resolveDocumentNumber(doc: any): string {
  return resolveInvoiceNumber(doc);
}

function repairMojibake(value: string): string {
  try {
    const repaired = decodeURIComponent(escape(value));
    return repaired || value;
  } catch {
    return value;
  }
}

function looksLikeMojibake(value: string): boolean {
  if (!value) return false;
  return /(?:þ|Þ|Ã|Â|Ø|Ù|Ð|Ñ)/.test(value);
}

function sanitizeHumanText(value: unknown): string {
  const raw = text(value).trim();
  if (!raw) return "";
  const repaired = looksLikeMojibake(raw) ? repairMojibake(raw) : raw;
  return normalizeHumanText(repaired);
}

function toCleanLines(...values: unknown[]): string[] {
  return cleanLines(...values);
}

function resolveSellerTaxId(company: any): string {
  return resolveTaxId(
    company?.taxId,
    company?.tax_id,
    company?.documentTaxId,
    company?.taxNumber,
    company?.vatNumber,
    company?.vat_number,
  );
}

function resolveClientTaxId(doc: any, counterpart: any): string {
  return resolveTaxId(
    doc?.customerTaxId,
    doc?.clientTaxId,
    doc?.taxId,
    doc?.tax_id,
    doc?.taxNumber,
    doc?.customerTaxNumber,
    doc?.vatNumber,
    counterpart?.taxId,
    counterpart?.tax_id,
    counterpart?.taxNumber,
    counterpart?.vatNumber,
    counterpart?.vat_number,
  );
}

function hexToRgb(hex: string): [number, number, number] {
  const raw = hex.replace("#", "").trim();
  if (!raw) return [79, 70, 229];
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw.padEnd(6, "0").slice(0, 6);
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return [79, 70, 229];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function computeTotals(doc: any) {
  const totals = computeDocumentTotals(doc || {});
  return {
    subtotal: totals.subtotal,
    taxAmount: totals.taxAmount,
    discount: totals.discount,
    total: totals.total,
  };
}

async function loadImageDataUrl(url: string): Promise<string | null> {
  const trimmed = url.trim();
  if (!trimmed || !/^(https?:|data:image\/)/i.test(trimmed)) return null;
  if (trimmed.startsWith("data:image/")) return trimmed;
  try {
    const res = await fetch(trimmed, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function writeLines(
  pdf: jsPDF,
  lines: string[],
  x: number,
  y: number,
  lineHeight = 4.5,
  options: { rightAlignArabicX?: number } = {},
): number {
  const currentFont = pdf.getFont();
  lines.forEach((line, i) => {
    const isArabic = containsArabic(line);
    if (isArabic) {
      pdf.setFont(ARABIC_FONT_NAME, "normal");
    }
    const textOptions = isArabic && options.rightAlignArabicX ? { align: "right" as const } : undefined;
    pdf.text(line, isArabic && options.rightAlignArabicX ? options.rightAlignArabicX : x, y + i * lineHeight, textOptions);
    if (isArabic) {
      pdf.setFont(currentFont.fontName, currentFont.fontStyle);
    }
  });
  return y + Math.max(lines.length, 1) * lineHeight;
}

function isNipcoLegacyCompany(company: any): boolean {
  const name = normalizeHumanText(company?.name).toLowerCase();
  const taxId = resolveSellerTaxId(company);
  return name.includes("nipco") || taxId.startsWith("4055989");
}

function formatLegacyDate(value: unknown): string {
  const parsed = value ? new Date(String(value)) : new Date();
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

function formatLegacyMoney(value: unknown, digits = 2): string {
  const amount = Number(value) || 0;
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatLegacyUnitPrice(value: unknown): string {
  const amount = Number(value) || 0;
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function cleanNipcoItemSubtitle(item: any): string {
  const candidates = [item.productSubtitle, item.subtitle, item.productName, item.name, item.description];
  for (const candidate of candidates) {
    const clean = sanitizeHumanText(candidate).replace(/^[\s\u00C0-\u00FF=<>|/\\\\]+(?=[A-Za-z0-9])/u, "").trim();
    if (clean && !/(?:þ|Þ|Ã|Â|Ø|Ù|Ð|Ñ)/.test(clean)) {
      if (clean.toLowerCase() !== sanitizeHumanText(item.description).toLowerCase()) return clean;
    }
  }
  const description = sanitizeHumanText(item.description).toLowerCase();
  if (description.includes("interfold")) return "Interfold 200G";
  return "";
}

function drawGlobeIcon(pdf: jsPDF, x: number, y: number): void {
  pdf.setDrawColor(20, 160, 215);
  pdf.setFillColor(20, 160, 215);
  pdf.circle(x, y, 1.8, "F");
  pdf.setDrawColor(255, 255, 255);
  pdf.setLineWidth(0.15);
  pdf.line(x - 1.3, y, x + 1.3, y);
  pdf.line(x, y - 1.3, x, y + 1.3);
}

function drawPhoneIcon(pdf: jsPDF, x: number, y: number): void {
  pdf.setDrawColor(220, 38, 38);
  pdf.setLineWidth(0.8);
  pdf.line(x - 1.1, y - 1, x + 1.1, y + 1);
  pdf.circle(x - 1.3, y - 1.2, 0.45, "S");
  pdf.circle(x + 1.3, y + 1.2, 0.45, "S");
}

function drawMailIcon(pdf: jsPDF, x: number, y: number): void {
  pdf.setDrawColor(148, 163, 184);
  pdf.setLineWidth(0.25);
  pdf.rect(x - 2, y - 1.2, 4, 2.6);
  pdf.line(x - 2, y - 1.2, x, y + 0.2);
  pdf.line(x + 2, y - 1.2, x, y + 0.2);
}

function drawPinIcon(pdf: jsPDF, x: number, y: number): void {
  pdf.setDrawColor(220, 38, 38);
  pdf.setFillColor(220, 38, 38);
  pdf.circle(x, y - 0.7, 1.1, "F");
  pdf.triangle(x - 0.65, y, x + 0.65, y, x, y + 2, "F");
  pdf.setFillColor(255, 255, 255);
  pdf.circle(x, y - 0.7, 0.35, "F");
}

async function buildNipcoLegacyPdf(
  type: ExportableType,
  doc: any,
  company: any,
): Promise<jsPDF> {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  await ensureArabicFont(pdf);

  const margin = 7;
  const pageWidth = 210;
  const contentWidth = pageWidth - margin * 2;
  const sellerTaxId = resolveSellerTaxId(company);
  const clientTaxId = resolveClientTaxId(doc, doc.client || doc.supplier || null);
  const documentNumber = resolveDocumentNumber(doc);
  const items = Array.isArray(doc.items) ? doc.items : [];
  const totals = computeTotals(doc);
  const totalQty = items.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0);
  const totalInWords = amountToWords(Math.max(0, totals.total ?? doc.total ?? 0), doc.currency || "USD").toUpperCase();
  const vatLbp = Math.round((Number(totals.taxAmount) || 0) * Number(company?.customExchangeRate || 89500));
  const counterpart = doc.client || doc.supplier || {};
  const clientName = firstNonEmpty(
    doc.customer,
    doc.clientName,
    doc.supplierName,
    counterpart?.name,
    "M/s",
  );
  const clientAddress = firstNonEmpty(
    doc.customerAddress,
    doc.clientAddress,
    counterpart?.address,
  );
  const accountNo = firstNonEmpty(
    doc.accountNo,
    doc.accountNumber,
    counterpart?.accountNo,
    counterpart?.accountNumber,
    counterpart?.customerCode,
  );
  const salesman = firstNonEmpty(doc.salesmanName, doc.assignedSalesPersonName, "ADMIN");
  const sellerAddress = normalizeHumanText(company?.address || "MAZRAAT YACHOUH, INDUSTRIAL ZONE").toUpperCase();
  const sellerPhone = normalizeHumanText(company?.phone || "+961 81 16 85 05");
  const vatNumber = sellerTaxId ? (sellerTaxId.includes("-") ? sellerTaxId : `${sellerTaxId}-601`) : "";

  const setEnglish = (bold = false, size = 9) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(0, 0, 0);
  };
  const text = (value: unknown, x: number, y: number, options?: Parameters<jsPDF["text"]>[3]) => {
    const line = sanitizeHumanText(value);
    if (!line) return;
    if (containsArabic(line)) {
      pdf.setFont(ARABIC_FONT_NAME, "normal");
    }
    pdf.text(line, x, y, options);
    setEnglish(false, 9);
  };

  setEnglish(false, 9);
  text(sellerAddress, margin + 1, 28);
  text(sellerPhone, margin + 1, 32);
  setEnglish(true, 9);
  text(vatNumber ? `VAT # ${vatNumber}` : "VAT #", margin + 1, 36);

  const headerY = 40;
  const headerH = 24;
  const invoiceBoxX = margin + contentWidth - 59;
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.2);
  pdf.rect(margin, headerY, contentWidth, headerH);
  pdf.line(invoiceBoxX, headerY, invoiceBoxX, headerY + headerH);

  setEnglish(false, 9);
  text("M/s", margin + 1, headerY + 5);
  text(clientName, margin + 10, headerY + 10);
  if (clientAddress) text(clientAddress, margin + 10, headerY + 15);
  text(clientTaxId ? `PHONE #    Tax ID: ${clientTaxId}` : "PHONE #", margin + 1, headerY + 21);
  setEnglish(true, 9);
  text(accountNo ? `A/c No. ${accountNo}` : "A/c No.", invoiceBoxX - 34, headerY + 5);
  text(`${TITLE_MAP[type]} # ${documentNumber}`, invoiceBoxX + 15, headerY + 6);
  setEnglish(false, 9);
  text(`Date  ${formatLegacyDate(doc.date)}`, invoiceBoxX + 15, headerY + 14);
  text("Page  01/01", invoiceBoxX + 15, headerY + 22);

  const tableTop = headerY + headerH + 4;
  const tableBottom = 188;
  const cols = [
    { label: "Item #", x: margin, w: 32 },
    { label: "Description", x: margin + 32, w: 85 },
    { label: "Qty", x: margin + 117, w: 12 },
    { label: "Unit Price", x: margin + 129, w: 24 },
    { label: "(-%)", x: margin + 153, w: 10 },
    { label: "Total US", x: margin + 163, w: contentWidth - 163 },
  ];
  pdf.rect(margin, tableTop, contentWidth, tableBottom - tableTop);
  pdf.setFillColor(224, 224, 224);
  pdf.rect(margin, tableTop, contentWidth, 8, "F");
  cols.forEach((col, index) => {
    if (index > 0) pdf.line(col.x, tableTop, col.x, tableBottom);
    setEnglish(true, 8);
    text(col.label, col.x + col.w / 2, tableTop + 5.2, { align: "center" });
  });
  pdf.line(margin, tableTop + 8, margin + contentWidth, tableTop + 8);

  setEnglish(false, 9);
  items.forEach((item: any, index: number) => {
    const rowY = tableTop + 13 + index * 5;
    const itemNo = firstNonEmpty(item.itemNumber, item.sku, item.productCode, item.productId, index + 1);
    const description = sanitizeHumanText(item.description || "Item").toUpperCase();
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    const subtotal = Number(item.subtotal ?? quantity * unitPrice) || 0;
    text(itemNo, cols[0].x + 1, rowY);
    text(description, cols[1].x + 2, rowY);
    text(quantity, cols[2].x + cols[2].w - 1, rowY, { align: "right" });
    text(formatLegacyUnitPrice(unitPrice), cols[3].x + cols[3].w - 1, rowY, { align: "right" });
    text(item.discountPercent || item.discountRate || "", cols[4].x + cols[4].w - 1, rowY, { align: "right" });
    text(formatLegacyMoney(subtotal), margin + contentWidth - 2, rowY, { align: "right" });
  });

  const summaryTop = tableBottom + 2;
  const summaryH = 30;
  pdf.rect(margin, summaryTop, contentWidth, summaryH);
  pdf.line(margin + contentWidth - 27, summaryTop, margin + contentWidth - 27, summaryTop + summaryH);
  pdf.setFillColor(224, 224, 224);
  pdf.rect(margin + contentWidth - 27, summaryTop, 27, summaryH, "F");
  setEnglish(false, 9);
  text(`Salesman: ${salesman}`, margin + 1, summaryTop + 5);
  text(`Total Qty =      ${totalQty}`, margin + 98, summaryTop + 5);
  const labelX = margin + contentWidth - 30;
  const valueX = margin + contentWidth - 2;
  text("Gross", labelX, summaryTop + 5, { align: "right" });
  text(formatLegacyMoney(totals.subtotal), valueX, summaryTop + 5, { align: "right" });
  text("Discount", labelX, summaryTop + 10, { align: "right" });
  text(formatLegacyMoney(totals.discount), valueX, summaryTop + 10, { align: "right" });
  text("Net", labelX, summaryTop + 15, { align: "right" });
  text(formatLegacyMoney(totals.subtotal - totals.discount), valueX, summaryTop + 15, { align: "right" });
  text(`VAT LL      ${vatLbp.toLocaleString("en-US")}`, margin + 104, summaryTop + 20);
  text(`VAT ${formatLegacyMoney(doc.taxRate || doc.tax || 11)}%`, labelX, summaryTop + 20, { align: "right" });
  text(formatLegacyMoney(totals.taxAmount), valueX, summaryTop + 20, { align: "right" });
  setEnglish(true, 9);
  text("Net total", labelX, summaryTop + 25, { align: "right" });
  text(formatLegacyMoney(totals.total), valueX, summaryTop + 25, { align: "right" });
  setEnglish(false, 8);
  pdf.setFont("helvetica", "italic");
  text(`ONLY ${totalInWords} .`, margin + 1, summaryTop + 24);

  const remarkTop = summaryTop + summaryH;
  pdf.rect(margin, remarkTop, contentWidth, 20);
  setEnglish(true, 7);
  text("Remark.", margin + 1, remarkTop + 5);

  setEnglish(false, 8);
  text("Sales Dept.: ADMIN", margin + 11, remarkTop + 28);
  text("Customer", margin + contentWidth - 6, remarkTop + 28, { align: "right" });
  text("ان رسم الطابع المالي سيسدد نقدا بموجب تصريح غ/20", margin + contentWidth / 2, remarkTop + 28, {
    align: "center",
  });

  return pdf;
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const clean = sanitizeHumanText(value);
    if (clean) return clean;
  }
  return "";
}

async function buildNipcoModernPdf(
  type: ExportableType,
  doc: any,
  company: any,
): Promise<jsPDF> {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  await ensureArabicFont(pdf);

  const blue: [number, number, number] = [20, 160, 215];
  const dark: [number, number, number] = [31, 41, 55];
  const muted: [number, number, number] = [107, 123, 143];
  const margin = 12;
  const pageWidth = 210;
  const contentWidth = pageWidth - margin * 2;
  const documentNumber = resolveDocumentNumber(doc);
  const sellerTaxId = resolveSellerTaxId(company);
  const counterpart = doc.client || doc.supplier || {};
  const clientName = firstNonEmpty(doc.customer, doc.clientName, counterpart?.name, "Client");
  const clientAddress = firstNonEmpty(doc.customerAddress, doc.clientAddress, counterpart?.address);
  const clientTaxId = resolveClientTaxId(doc, counterpart);
  const items = Array.isArray(doc.items) ? doc.items : [];
  const totals = computeTotals(doc);
  const currency = doc.currency || "USD";
  const salesman = firstNonEmpty(doc.salesmanName, doc.assignedSalesPersonName, "Hadi Abou Kalfouni");
  const taxRate = Number(doc.taxRate || doc.tax) || 0;
  const displaySubtotal = totals.subtotal;
  const displayTax = totals.taxAmount;
  const displayDiscount = totals.discount;

  const setFont = (style: "normal" | "bold" | "italic" = "normal", size = 10, color: [number, number, number] = dark) => {
    pdf.setFont("helvetica", style);
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
  };
  const drawText = (value: unknown, x: number, y: number, options?: Parameters<jsPDF["text"]>[3]) => {
    const clean = sanitizeHumanText(value);
    if (!clean) return;
    if (containsArabic(clean)) {
      pdf.setFont(ARABIC_FONT_NAME, "normal");
    }
    pdf.text(clean, x, y, options);
    pdf.setFont("helvetica", "normal");
  };

  const logoData = company?.logo ? await loadImageDataUrl(company.logo) : null;
  if (logoData) {
    try {
      pdf.addImage(logoData, "PNG", margin + 2, 18, 42, 24);
    } catch {
      try {
        pdf.addImage(logoData, "JPEG", margin + 2, 18, 42, 24);
      } catch {
        setFont("bold", 22, [0, 45, 100]);
        drawText("NIPCO", margin + 2, 32);
      }
    }
  } else {
    setFont("bold", 22, [0, 45, 100]);
    drawText("NIPCO", margin + 2, 32);
  }

  setFont("normal", 19, blue);
  drawText(company?.name || "Nipco", 64, 22);
  setFont("italic", 9.5, blue);
  drawText('"Your Caring Partner"', 64, 29);
  setFont("normal", 9, muted);
  drawGlobeIcon(pdf, 66, 36);
  drawPhoneIcon(pdf, 66, 43);
  drawMailIcon(pdf, 66, 50);
  drawText(company?.website || "http://www.nip-lb.com", 70, 37);
  drawText(company?.phone || "+96181 16 85 05", 70, 44);
  drawText(company?.email || "info@nip-lb.com", 70, 51);
  drawText(`Tax #: ${sellerTaxId || "4055989"}`, 70, 58);

  setFont("normal", 22, blue);
  drawText(TITLE_MAP[type].toUpperCase(), pageWidth - margin, 24, { align: "right" });
  setFont("bold", 14, dark);
  drawText(documentNumber, pageWidth - margin, 36, { align: "right" });
  setFont("normal", 10.5, muted);
  drawText(formatDocDate(doc.date), pageWidth - margin, 47, { align: "right" });

  pdf.setDrawColor(...blue);
  pdf.setLineWidth(0.8);
  pdf.line(margin, 72, pageWidth - margin, 72);

  setFont("bold", 10, muted);
  drawText("BILL TO", margin, 88);
  setFont("bold", 12, blue);
  drawText(clientName, margin, 100);
  setFont("normal", 9.5, dark);
  if (clientTaxId) drawText(`Tax ID: ${clientTaxId}`, margin, 108);
  if (clientAddress) {
    drawPinIcon(pdf, margin + 2, 115);
    setFont("normal", 10, dark);
    drawText(clientAddress, margin + 52, 116, { align: "right" });
  }

  const tableTop = 126;
  const columns = [
    { label: "ITEM DESCRIPTION", x: margin, w: 58 },
    { label: "QTY", x: margin + 58, w: 30 },
    { label: "UNIT PRICE", x: margin + 88, w: 48 },
    { label: "AMOUNT", x: margin + 136, w: contentWidth - 136 },
  ];
  pdf.setFillColor(...blue);
  pdf.rect(margin, tableTop, contentWidth, 15, "F");
  pdf.setDrawColor(255, 255, 255);
  columns.slice(1).forEach((col) => pdf.line(col.x, tableTop, col.x, tableTop + 15));
  columns.forEach((col) => {
    setFont("bold", 10, [255, 255, 255]);
    drawText(col.label, col.x + (col.label === "ITEM DESCRIPTION" ? 3 : col.w - 4), tableTop + 10, {
      align: col.label === "ITEM DESCRIPTION" ? "left" : "right",
    });
  });

  let y = tableTop + 28;
  const discount = Number(totals.discount) || 0;
  const discountRowIndex = discount > 0 ? items.length - 1 : -1;
  items.forEach((item: any, index: number) => {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    const rawSubtotal = Number(item.subtotal ?? quantity * unitPrice) || 0;
    const displayUnitPrice = unitPrice;
    const displayRawSubtotal = rawSubtotal;
    const isDiscountRow = index === discountRowIndex && Math.abs(discount - rawSubtotal) < 0.05;
    const rowAmount = isDiscountRow ? 0 : displayRawSubtotal;
    const subLabel = cleanNipcoItemSubtitle(item);

    setFont("bold", 9.5, dark);
    drawText(sanitizeHumanText(item.description || "Item"), margin + 2, y);
    setFont("normal", 8, muted);
    if (subLabel) {
      pdf.setFillColor(245, 158, 11);
      pdf.rect(margin + 2, y + 3.5, 2.4, 2.4, "F");
      drawText(subLabel, margin + 6, y + 6);
    }
    if (isDiscountRow) {
      setFont("normal", 8, [239, 68, 68]);
      drawText("Discount: 100%", margin + 2, y + 12);
    }
    setFont("normal", 10, dark);
    drawText(quantity, columns[1].x + columns[1].w - 12, y + 3, { align: "right" });
    drawText(formatCurrency(displayUnitPrice, currency), columns[2].x + columns[2].w - 4, y + 3, { align: "right" });
    if (isDiscountRow) {
      setFont("normal", 8, muted);
      drawText(`Before: ${formatCurrency(displayRawSubtotal, currency)}`, columns[3].x + columns[3].w - 4, y - 2, { align: "right" });
      setFont("bold", 10, [22, 163, 74]);
      drawText(`After: ${formatCurrency(0, currency)}`, columns[3].x + columns[3].w - 4, y + 8, { align: "right" });
    } else {
      setFont("bold", 10, dark);
      drawText(formatCurrency(rowAmount, currency), columns[3].x + columns[3].w - 4, y + 3, { align: "right" });
    }
    pdf.setDrawColor(229, 231, 235);
    pdf.setLineWidth(0.2);
    pdf.line(margin, y + 12, pageWidth - margin, y + 12);
    y += 20;
  });

  const totalsX = pageWidth - margin - 106;
  y = Math.max(y + 10, 192);
  setFont("normal", 10, muted);
  drawText("Subtotal:", totalsX + 50, y, { align: "right" });
  setFont("bold", 10, dark);
  drawText(formatCurrency(displaySubtotal, currency), pageWidth - margin - 4, y, { align: "right" });
  y += 12;
  if (displayDiscount) {
    setFont("normal", 10, muted);
    drawText("Discount:", totalsX + 50, y, { align: "right" });
    setFont("bold", 10, [239, 68, 68]);
    drawText(`-${formatCurrency(displayDiscount, currency)}`, pageWidth - margin - 4, y, { align: "right" });
    y += 12;
  }
  if (displayTax) {
    setFont("normal", 10, muted);
    drawText(taxRate ? `VAT ${formatLegacyMoney(taxRate, 2)}%:` : "VAT:", totalsX + 50, y, { align: "right" });
    setFont("bold", 10, dark);
    drawText(formatCurrency(displayTax, currency), pageWidth - margin - 4, y, { align: "right" });
    y += 12;
  }
  pdf.setFillColor(...blue);
  pdf.rect(totalsX, y - 7, pageWidth - margin - totalsX, 16, "F");
  setFont("bold", 10, [255, 255, 255]);
  drawText("TOTAL:", totalsX + 48, y + 3, { align: "right" });
  drawText(formatCurrency(totals.total, currency), pageWidth - margin - 4, y + 3, { align: "right" });

  const repY = 248;
  pdf.setFillColor(248, 250, 252);
  pdf.roundedRect(margin, repY, contentWidth, 20, 2, 2, "F");
  pdf.setFillColor(...blue);
  pdf.roundedRect(margin, repY, 1.2, 20, 1, 1, "F");
  setFont("normal", 7, [148, 163, 184]);
  drawText("SALES REPRESENTATIVE", margin + 6, repY + 8);
  setFont("bold", 8.5, dark);
  drawText(salesman, margin + 6, repY + 15);

  pdf.setDrawColor(229, 231, 235);
  pdf.line(margin, 286, pageWidth - margin, 286);
  return pdf;
}

export async function exportDocumentAsPdf(
  type: ExportableType,
  doc: any,
  company?: any,
): Promise<boolean> {
  if (!doc) {
    console.error("Export failed: Document not found");
    return false;
  }

  if (!doc.id || doc.id === "DRAFT") {
    console.error("Export failed: Document must be saved first");
    return false;
  }

  try {
    const normalized = normalizeExportPayload(type, doc, company);
    doc = normalized.doc;
    company = normalized.company;

    if (type === "invoice" && isNipcoLegacyCompany(company)) {
      const pdf = await buildNipcoModernPdf(type, doc, company);
      const safeId = resolveDocumentNumber(doc).replace(/[^\w.-]+/g, "_");
      pdf.save(`Invoice-${safeId}.pdf`);
      return true;
    }

    const currency = doc.currency || "USD";
    const totals = computeTotals(doc);
    const totalInWords = amountToWords(Math.max(0, totals.total ?? doc.total ?? 0), currency);
    const primary = company?.primaryColor || "#4F46E5";
    const [pr, pg, pb] = hexToRgb(primary);
    const counterpartTitle =
      type === "purchaseOrder" || type === "payment" ? "Supplier" : "Client";
    const counterpart = doc.client || doc.supplier || null;
    const docTitle = TITLE_MAP[type];
    const docDate = formatDocDate(doc.date);
    const margin = 14;
    const pageWidth = 210;
    const contentWidth = pageWidth - margin * 2;

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    await ensureArabicFont(pdf);
    let y = margin;

    const logoData = company?.logo ? await loadImageDataUrl(company.logo) : null;
    if (logoData) {
      try {
        pdf.addImage(logoData, "PNG", margin, y, 18, 18);
      } catch {
        try {
          pdf.addImage(logoData, "JPEG", margin, y, 18, 18);
        } catch {
          // skip logo if format unsupported
        }
      }
    }

    const headerX = logoData ? margin + 22 : margin;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.setTextColor(17, 24, 39);
    pdf.text(text(company?.name || "Company"), headerX, y + 6);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(107, 114, 128);
    const contactParts = toCleanLines(
      company?.address,
      company?.phone,
      company?.email,
      company?.website,
    );
    if (contactParts.length) {
      const contactLines = pdf.splitTextToSize(contactParts.join(" • "), contentWidth - 70) as string[];
      y = writeLines(pdf, contactLines, headerX, y + 11, 3.8);
    } else {
      y += 11;
    }

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.setTextColor(pr, pg, pb);
    pdf.text(docTitle, pageWidth - margin, margin + 6, { align: "right" });

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(107, 114, 128);
    const documentNumber = resolveDocumentNumber(doc);
    pdf.text(`# ${documentNumber} • ${docDate}`, pageWidth - margin, margin + 12, { align: "right" });

    y = Math.max(y, margin + 18);
    pdf.setDrawColor(pr, pg, pb);
    pdf.setLineWidth(0.8);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 8;

    const colWidth = (contentWidth - 6) / 2;
    const boxTop = y;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(55, 65, 81);
    pdf.text("BILL FROM", margin, y);
    pdf.text(counterpartTitle.toUpperCase(), margin + colWidth + 6, y);
    y += 5;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9.5);
    pdf.setTextColor(17, 24, 39);

    const sellerTaxId = resolveSellerTaxId(company);
    const clientTaxId = resolveClientTaxId(doc, counterpart);

    const billFromLines = toCleanLines(
      company?.name || "Company",
      company?.address,
      sellerTaxId ? `Seller Tax ID: ${sellerTaxId}` : "",
      company?.commercialRegistry ? `Registry: ${text(company.commercialRegistry)}` : "",
    );

    const clientLines = toCleanLines(
      doc.customer ?? doc.clientName ?? doc.supplierName ?? counterpart?.name ?? "-",
      doc.customerAddress ?? doc.clientAddress ?? counterpart?.address,
      counterpart?.phone,
      counterpart?.email,
      clientTaxId ? `Client Tax ID: ${clientTaxId}` : "",
    );

    const leftWrapped = billFromLines.flatMap((line) =>
      pdf.splitTextToSize(line, colWidth) as string[],
    );
    const rightWrapped = clientLines.flatMap((line) =>
      pdf.splitTextToSize(line, colWidth) as string[],
    );

    const boxHeight = Math.max(leftWrapped.length, rightWrapped.length) * 4.5 + 6;
    pdf.setDrawColor(229, 231, 235);
    pdf.setLineWidth(0.2);
    pdf.roundedRect(margin, boxTop, colWidth, boxHeight, 2, 2);
    pdf.roundedRect(margin + colWidth + 6, boxTop, colWidth, boxHeight, 2, 2);

    writeLines(pdf, leftWrapped, margin + 3, boxTop + 5);
    writeLines(pdf, rightWrapped, margin + colWidth + 9, boxTop + 5, 4.5, {
      rightAlignArabicX: margin + colWidth * 2 + 3,
    });
    y = boxTop + boxHeight + 8;

    const items = doc.items || [];
    autoTable(pdf, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Description", "Qty", "Unit Price", "Subtotal"]],
      body: items.map((it: any) => [
        sanitizeHumanText(it.description ?? ""),
        text(it.quantity ?? 0),
        formatCurrency(it.unitPrice ?? 0, currency),
        formatCurrency((it.quantity ?? 0) * (it.unitPrice ?? 0), currency),
      ]),
      styles: { fontSize: 9, cellPadding: 2.5, textColor: [17, 24, 39] },
      headStyles: {
        fillColor: [249, 250, 251],
        textColor: [55, 65, 81],
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: "auto" },
        1: { halign: "right", cellWidth: 18 },
        2: { halign: "right", cellWidth: 32 },
        3: { halign: "right", cellWidth: 32 },
      },
      theme: "grid",
    });

    y = ((pdf as any).lastAutoTable?.finalY as number | undefined) ?? y + 20;
    y += 6;

    const totalsX = pageWidth - margin - 62;
    const totalsWidth = 62;
    pdf.setDrawColor(229, 231, 235);
    pdf.roundedRect(totalsX, y, totalsWidth, totals.taxAmount || totals.discount ? 34 : 22, 2, 2);

    pdf.setFontSize(9);
    pdf.setTextColor(17, 24, 39);
    let ty = y + 6;
    const totalRow = (label: string, value: string, bold = false) => {
      pdf.setFont("helvetica", bold ? "bold" : "normal");
      pdf.text(label, totalsX + 3, ty);
      pdf.text(value, totalsX + totalsWidth - 3, ty, { align: "right" });
      ty += 5;
    };

    totalRow("Subtotal", formatCurrency(totals.subtotal, currency));
    if (totals.taxAmount) totalRow("Tax", formatCurrency(totals.taxAmount, currency));
    if (totals.discount) totalRow("Discount", `- ${formatCurrency(totals.discount, currency)}`);
    pdf.setTextColor(pr, pg, pb);
    totalRow("Total", formatCurrency(totals.total, currency), true);

    y = ty + 8;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(107, 114, 128);
    const wordsLines = pdf.splitTextToSize(`Total in words: ${totalInWords}`, contentWidth) as string[];
    y = writeLines(pdf, wordsLines, margin, y, 4);

    const sanitizedNotes = sanitizeHumanText(doc.notes);
    if (sanitizedNotes) {
      y += 2;
      const noteLines = pdf.splitTextToSize(`Notes: ${sanitizedNotes}`, contentWidth) as string[];
      y = writeLines(pdf, noteLines, margin, y, 4);
    }

    if (company?.signature) {
      const signatureData = await loadImageDataUrl(company.signature);
      if (signatureData) {
        const sigY = Math.min(y + 6, 270);
        try {
          pdf.addImage(signatureData, "PNG", pageWidth - margin - 40, sigY, 40, 16);
        } catch {
          try {
            pdf.addImage(signatureData, "JPEG", pageWidth - margin - 40, sigY, 40, 16);
          } catch {
            // skip signature if format unsupported
          }
        }
      }
    }

    const safeId = documentNumber.replace(/[^\w.-]+/g, "_");
    pdf.save(`${docTitle.replace(/\s+/g, "-")}-${safeId}.pdf`);
    return true;
  } catch (e) {
    console.error("Export PDF failed:", e);
    return false;
  }
}

/**
 * Build the PDF in memory and return it as a File object for Web Share API.
 * Returns null on failure.
 */
export async function buildDocumentPdfFile(
  type: ExportableType,
  doc: any,
  company?: any,
): Promise<File | null> {
  if (!doc || !doc.id || doc.id === "DRAFT") return null;

  try {
    const normalized = normalizeExportPayload(type, doc, company);
    doc = normalized.doc;
    company = normalized.company;

    if (type === "invoice" && isNipcoLegacyCompany(company)) {
      const pdf = await buildNipcoModernPdf(type, doc, company);
      const safeId = resolveDocumentNumber(doc).replace(/[^\w.-]+/g, "_");
      const fileName = `Invoice-${safeId}.pdf`;
      const blob = pdf.output("blob");
      return new File([blob], fileName, { type: "application/pdf" });
    }

    const currency = doc.currency || "USD";
    const totals = computeTotals(doc);
    const totalInWords = amountToWords(Math.max(0, totals.total ?? doc.total ?? 0), currency);
    const primary = company?.primaryColor || "#4F46E5";
    const [pr, pg, pb] = hexToRgb(primary);
    const counterpartTitle =
      type === "purchaseOrder" || type === "payment" ? "Supplier" : "Client";
    const counterpart = doc.client || doc.supplier || null;
    const docTitle = TITLE_MAP[type];
    const docDate = formatDocDate(doc.date);
    const margin = 14;
    const pageWidth = 210;
    const contentWidth = pageWidth - margin * 2;

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    await ensureArabicFont(pdf);
    let y = margin;

    const logoData = company?.logo ? await loadImageDataUrl(company.logo) : null;
    if (logoData) {
      try { pdf.addImage(logoData, "PNG", margin, y, 18, 18); }
      catch { try { pdf.addImage(logoData, "JPEG", margin, y, 18, 18); } catch { /* skip */ } }
    }

    const headerX = logoData ? margin + 22 : margin;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.setTextColor(17, 24, 39);
    pdf.text(text(company?.name || "Company"), headerX, y + 6);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(107, 114, 128);
    const contactParts = toCleanLines(company?.address, company?.phone, company?.email, company?.website);
    if (contactParts.length) {
      const contactLines = pdf.splitTextToSize(contactParts.join(" • "), contentWidth - 70) as string[];
      y = writeLines(pdf, contactLines, headerX, y + 11, 3.8);
    } else { y += 11; }

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.setTextColor(pr, pg, pb);
    pdf.text(docTitle, pageWidth - margin, margin + 6, { align: "right" });

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(107, 114, 128);
    const documentNumber = resolveDocumentNumber(doc);
    pdf.text(`# ${documentNumber} • ${docDate}`, pageWidth - margin, margin + 12, { align: "right" });

    y = Math.max(y, margin + 18);
    pdf.setDrawColor(pr, pg, pb);
    pdf.setLineWidth(0.8);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 8;

    const colWidth = (contentWidth - 6) / 2;
    const boxTop = y;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(55, 65, 81);
    pdf.text("BILL FROM", margin, y);
    pdf.text(counterpartTitle.toUpperCase(), margin + colWidth + 6, y);
    y += 5;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9.5);
    pdf.setTextColor(17, 24, 39);

    const sellerTaxId = resolveSellerTaxId(company);
    const clientTaxId = resolveClientTaxId(doc, counterpart);

    const billFromLines = toCleanLines(
      company?.name || "Company",
      company?.address,
      sellerTaxId ? `Seller Tax ID: ${sellerTaxId}` : "",
      company?.commercialRegistry ? `Registry: ${text(company.commercialRegistry)}` : "",
    );

    const clientLines = toCleanLines(
      doc.customer ?? doc.clientName ?? doc.supplierName ?? counterpart?.name ?? "-",
      doc.customerAddress ?? doc.clientAddress ?? counterpart?.address,
      counterpart?.phone,
      counterpart?.email,
      clientTaxId ? `Client Tax ID: ${clientTaxId}` : "",
    );

    const leftWrapped = billFromLines.flatMap((line) => pdf.splitTextToSize(line, colWidth) as string[]);
    const rightWrapped = clientLines.flatMap((line) => pdf.splitTextToSize(line, colWidth) as string[]);

    const boxHeight = Math.max(leftWrapped.length, rightWrapped.length) * 4.5 + 6;
    pdf.setDrawColor(229, 231, 235);
    pdf.setLineWidth(0.2);
    pdf.roundedRect(margin, boxTop, colWidth, boxHeight, 2, 2);
    pdf.roundedRect(margin + colWidth + 6, boxTop, colWidth, boxHeight, 2, 2);

    writeLines(pdf, leftWrapped, margin + 3, boxTop + 5);
    writeLines(pdf, rightWrapped, margin + colWidth + 9, boxTop + 5, 4.5, {
      rightAlignArabicX: margin + colWidth * 2 + 3,
    });
    y = boxTop + boxHeight + 8;

    const items = doc.items || [];
    autoTable(pdf, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Description", "Qty", "Unit Price", "Subtotal"]],
      body: items.map((it: any) => [
        sanitizeHumanText(it.description ?? ""), text(it.quantity ?? 0),
        formatCurrency(it.unitPrice ?? 0, currency),
        formatCurrency((it.quantity ?? 0) * (it.unitPrice ?? 0), currency),
      ]),
      styles: { fontSize: 9, cellPadding: 2.5, textColor: [17, 24, 39] },
      headStyles: { fillColor: [249, 250, 251], textColor: [55, 65, 81], fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: "auto" }, 1: { halign: "right", cellWidth: 18 }, 2: { halign: "right", cellWidth: 32 }, 3: { halign: "right", cellWidth: 32 } },
      theme: "grid",
    });

    y = ((pdf as any).lastAutoTable?.finalY as number | undefined) ?? y + 20;
    y += 6;

    const totalsX = pageWidth - margin - 62;
    const totalsWidth = 62;
    pdf.setDrawColor(229, 231, 235);
    pdf.roundedRect(totalsX, y, totalsWidth, totals.taxAmount || totals.discount ? 34 : 22, 2, 2);

    pdf.setFontSize(9);
    pdf.setTextColor(17, 24, 39);
    let ty = y + 6;
    const totalRow = (label: string, value: string, bold = false) => {
      pdf.setFont("helvetica", bold ? "bold" : "normal");
      pdf.text(label, totalsX + 3, ty);
      pdf.text(value, totalsX + totalsWidth - 3, ty, { align: "right" });
      ty += 5;
    };

    totalRow("Subtotal", formatCurrency(totals.subtotal, currency));
    if (totals.taxAmount) totalRow("Tax", formatCurrency(totals.taxAmount, currency));
    if (totals.discount) totalRow("Discount", `- ${formatCurrency(totals.discount, currency)}`);
    pdf.setTextColor(pr, pg, pb);
    totalRow("Total", formatCurrency(totals.total, currency), true);

    y = ty + 8;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(107, 114, 128);
    const wordsLines = pdf.splitTextToSize(`Total in words: ${totalInWords}`, contentWidth) as string[];
    y = writeLines(pdf, wordsLines, margin, y, 4);

    const sanitizedNotes = sanitizeHumanText(doc.notes);
    if (sanitizedNotes) {
      y += 2;
      const noteLines = pdf.splitTextToSize(`Notes: ${sanitizedNotes}`, contentWidth) as string[];
      y = writeLines(pdf, noteLines, margin, y, 4);
    }

    if (company?.signature) {
      const signatureData = await loadImageDataUrl(company.signature);
      if (signatureData) {
        const sigY = Math.min(y + 6, 270);
        try { pdf.addImage(signatureData, "PNG", pageWidth - margin - 40, sigY, 40, 16); }
        catch { try { pdf.addImage(signatureData, "JPEG", pageWidth - margin - 40, sigY, 40, 16); } catch { /* skip */ } }
      }
    }

    const safeId = documentNumber.replace(/[^\w.-]+/g, "_");
    const fileName = `${docTitle.replace(/\s+/g, "-")}-${safeId}.pdf`;
    const blob = pdf.output("blob");
    return new File([blob], fileName, { type: "application/pdf" });
  } catch (e) {
    console.error("buildDocumentPdfFile failed:", e);
    return null;
  }
}
