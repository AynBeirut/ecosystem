import { amountToWords } from "@/components/InvoiceTemplates";
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

function text(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
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
  const items = doc.items || [];
  const subtotal = items.length
    ? items.reduce((s: number, it: any) => s + (it.quantity ?? 0) * (it.unitPrice ?? 0), 0)
    : typeof doc.amount === "number"
      ? doc.amount
      : 0;
  const taxPct = typeof doc.tax === "number" ? doc.tax : 0;
  const discount = typeof doc.discount === "number" ? doc.discount : 0;
  const taxAmount = subtotal * (taxPct / 100);
  const total = subtotal + taxAmount - discount;
  return { subtotal, taxAmount, discount, total };
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
): number {
  lines.forEach((line, i) => pdf.text(line, x, y + i * lineHeight));
  return y + Math.max(lines.length, 1) * lineHeight;
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
    const contactParts = [
      company?.address,
      company?.phone,
      company?.email,
      company?.website,
    ]
      .map(text)
      .filter(Boolean);
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
    pdf.text(`# ${text(doc.id)} • ${docDate}`, pageWidth - margin, margin + 12, { align: "right" });

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

    const billFromLines = [
      text(company?.name || "Company"),
      text(company?.address),
      company?.taxId ? `Tax ID: ${text(company.taxId)}` : "",
      company?.commercialRegistry ? `Registry: ${text(company.commercialRegistry)}` : "",
    ].filter(Boolean);

    const clientLines = [
      text(doc.customer ?? doc.clientName ?? doc.supplierName ?? counterpart?.name ?? "-"),
      text(counterpart?.address),
      text(counterpart?.phone),
      text(counterpart?.email),
    ].filter(Boolean);

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
    writeLines(pdf, rightWrapped, margin + colWidth + 9, boxTop + 5);
    y = boxTop + boxHeight + 8;

    const items = doc.items || [];
    autoTable(pdf, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Description", "Qty", "Unit Price", "Subtotal"]],
      body: items.map((it: any) => [
        text(it.description ?? ""),
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

    if (doc.notes) {
      y += 2;
      const noteLines = pdf.splitTextToSize(`Notes: ${text(doc.notes)}`, contentWidth) as string[];
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

    const safeId = text(doc.id).replace(/[^\w.-]+/g, "_");
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
    const contactParts = [company?.address, company?.phone, company?.email, company?.website]
      .map(text).filter(Boolean);
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
    pdf.text(`# ${text(doc.id)} • ${docDate}`, pageWidth - margin, margin + 12, { align: "right" });

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

    const billFromLines = [
      text(company?.name || "Company"), text(company?.address),
      company?.taxId ? `Tax ID: ${text(company.taxId)}` : "",
      company?.commercialRegistry ? `Registry: ${text(company.commercialRegistry)}` : "",
    ].filter(Boolean);

    const clientLines = [
      text(doc.customer ?? doc.clientName ?? doc.supplierName ?? counterpart?.name ?? "-"),
      text(counterpart?.address), text(counterpart?.phone), text(counterpart?.email),
    ].filter(Boolean);

    const leftWrapped = billFromLines.flatMap((line) => pdf.splitTextToSize(line, colWidth) as string[]);
    const rightWrapped = clientLines.flatMap((line) => pdf.splitTextToSize(line, colWidth) as string[]);

    const boxHeight = Math.max(leftWrapped.length, rightWrapped.length) * 4.5 + 6;
    pdf.setDrawColor(229, 231, 235);
    pdf.setLineWidth(0.2);
    pdf.roundedRect(margin, boxTop, colWidth, boxHeight, 2, 2);
    pdf.roundedRect(margin + colWidth + 6, boxTop, colWidth, boxHeight, 2, 2);

    writeLines(pdf, leftWrapped, margin + 3, boxTop + 5);
    writeLines(pdf, rightWrapped, margin + colWidth + 9, boxTop + 5);
    y = boxTop + boxHeight + 8;

    const items = doc.items || [];
    autoTable(pdf, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Description", "Qty", "Unit Price", "Subtotal"]],
      body: items.map((it: any) => [
        text(it.description ?? ""), text(it.quantity ?? 0),
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

    if (doc.notes) {
      y += 2;
      const noteLines = pdf.splitTextToSize(`Notes: ${text(doc.notes)}`, contentWidth) as string[];
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

    const safeId = text(doc.id).replace(/[^\w.-]+/g, "_");
    const fileName = `${docTitle.replace(/\s+/g, "-")}-${safeId}.pdf`;
    const blob = pdf.output("blob");
    return new File([blob], fileName, { type: "application/pdf" });
  } catch (e) {
    console.error("buildDocumentPdfFile failed:", e);
    return null;
  }
}
