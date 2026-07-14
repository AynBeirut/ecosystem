// PDF generation + email sending logic for documents.
// Uses the existing exportDocumentAsPdf renderer and supabase auth user email
// as the "from" address. Email sending uses a mailto: handoff (no email
// provider is configured at the data layer).

import { exportDocumentAsPdf, type ExportableType } from "@/lib/pdfExport";
import type {
  Invoice, Estimate, Receipt, PurchaseOrder, PaymentOrder,
  Client, Supplier, Organization,
} from "../AppContext";

const LOG = "Context][Document";

export type DocumentType = "invoice" | "estimate" | "receipt" | "purchaseOrder" | "paymentOrder";

const TYPE_TO_EXPORTABLE: Record<DocumentType, ExportableType> = {
  invoice: "invoice",
  estimate: "estimate",
  receipt: "receipt",
  purchaseOrder: "purchaseOrder",
  paymentOrder: "payment",
};

const TYPE_LABEL: Record<DocumentType, string> = {
  invoice: "Invoice",
  estimate: "Estimate",
  receipt: "Receipt",
  purchaseOrder: "Purchase Order",
  paymentOrder: "Payment Order",
};

interface GenerateContext {
  invoices: Invoice[];
  estimates: Estimate[];
  receipts: Receipt[];
  purchaseOrders: PurchaseOrder[];
  paymentOrders: PaymentOrder[];
  clients: Client[];
  suppliers: Supplier[];
  organization: Organization | null;
  companyFallback?: any;
}

/**
 * Look up a document and return the merged payload + counterpart used by
 * the PDF renderer.
 */
const resolveDocument = (
  documentType: DocumentType,
  documentId: string,
  ctx: GenerateContext,
): { doc: any; company: any } | null => {
  const company = ctx.organization
    ? {
        name: ctx.organization.name,
        address: ctx.organization.address || "",
        phone: ctx.organization.phone || "",
        email: ctx.organization.email || "",
        logo: ctx.organization.logoUrl || ctx.companyFallback?.logo || "",
        taxId: ctx.organization.taxId || "",
        primaryColor: ctx.companyFallback?.primaryColor,
        secondaryColor: ctx.companyFallback?.secondaryColor,
        signature: ctx.companyFallback?.signature,
        commercialRegistry: ctx.companyFallback?.commercialRegistry,
      }
    : ctx.companyFallback || {};

  switch (documentType) {
    case "invoice": {
      const inv = ctx.invoices.find((i) => i.id === documentId);
      if (!inv) return null;
      return { doc: { ...inv, client: ctx.clients.find((c) => c.id === inv.clientId) }, company };
    }
    case "estimate": {
      const est = ctx.estimates.find((e) => e.id === documentId);
      if (!est) return null;
      return { doc: { ...est, client: ctx.clients.find((c) => c.id === est.clientId) }, company };
    }
    case "receipt": {
      const rec = ctx.receipts.find((r) => r.id === documentId);
      if (!rec) return null;
      return { doc: { ...rec, client: ctx.clients.find((c) => c.id === rec.clientId) }, company };
    }
    case "purchaseOrder": {
      const po = ctx.purchaseOrders.find((p) => p.id === documentId);
      if (!po) return null;
      return { doc: { ...po, supplier: ctx.suppliers.find((s) => s.id === po.supplierId) }, company };
    }
    case "paymentOrder": {
      const po = ctx.paymentOrders.find((p) => p.id === documentId);
      if (!po) return null;
      return { doc: { ...po, supplier: ctx.suppliers.find((s) => s.id === po.supplierId) }, company };
    }
    default:
      return null;
  }
};

/**
 * generatePDF — opens a printable PDF for the given document.
 * Includes items, totals, client/supplier info, and organization info.
 * Returns true on success.
 */
export const generatePDF = (
  documentType: DocumentType,
  documentId: string,
  ctx: GenerateContext,
): boolean => {
  try {
    const resolved = resolveDocument(documentType, documentId, ctx);
    if (!resolved) {
      console.error(`[${LOG}][generatePDF] ${documentType} not found: ${documentId}`);
      return false;
    }
    const exportableType = TYPE_TO_EXPORTABLE[documentType];
    const ok = exportDocumentAsPdf(exportableType, resolved.doc, resolved.company);
    if (!ok) console.error(`[${LOG}][generatePDF] Renderer failed for ${documentType} ${documentId}`);
    return ok;
  } catch (e) {
    console.error(`[${LOG}][generatePDF]`, e);
    return false;
  }
};

/**
 * sendDocumentEmail — generate the PDF and open the user's mail client
 * with the recipient prefilled. Returns true on success.
 *
 * Note: actual server-side mailing requires an edge function with an
 * email provider; this client-side handoff is the contract used by the
 * existing UI. Adjust here if a transactional sender is added.
 */
export const sendDocumentEmail = (
  documentType: DocumentType,
  documentId: string,
  recipientEmail: string,
  ctx: GenerateContext,
): boolean => {
  try {
    if (!recipientEmail) {
      console.error(`[${LOG}][sendDocumentEmail] Missing recipient email`);
      return false;
    }
    const resolved = resolveDocument(documentType, documentId, ctx);
    if (!resolved) {
      console.error(`[${LOG}][sendDocumentEmail] ${documentType} not found: ${documentId}`);
      return false;
    }

    const pdfOk = generatePDF(documentType, documentId, ctx);
    if (!pdfOk) {
      console.error(`[${LOG}][sendDocumentEmail] PDF generation failed`);
      return false;
    }

    const label = TYPE_LABEL[documentType];
    const orgName = resolved.company?.name || "";
    const amount = resolved.doc.amount ?? resolved.doc.total ?? 0;
    const currency = resolved.doc.currency || "USD";

    const subject = `${label} ${documentId}${orgName ? ` from ${orgName}` : ""}`;
    const body =
      `Hello,\n\nPlease find attached ${label.toLowerCase()} ${documentId} ` +
      `for ${amount} ${currency}.\n\n` +
      `If you have any questions, just reply to this email.\n\n` +
      `${orgName ? `— ${orgName}` : ""}`;

    window.location.href = `mailto:${encodeURIComponent(recipientEmail)}` +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;

    return true;
  } catch (e) {
    console.error(`[${LOG}][sendDocumentEmail]`, e);
    return false;
  }
};
