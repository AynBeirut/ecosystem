import { amountToWords } from "@/components/InvoiceTemplates";
import { formatCurrency } from "@/lib/utils";

// Lightweight printable HTML export (user saves as PDF via browser print)
export type ExportableType = "invoice" | "estimate" | "purchaseOrder" | "receipt" | "payment";

function esc(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escCss(v: unknown): string {
  if (v === null || v === undefined) return "";
  // Allow only safe CSS color/value chars
  return String(v).replace(/[^a-zA-Z0-9#().,%\-\s]/g, "");
}

function escUrl(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  if (/^(https?:|data:image\/)/i.test(s)) return esc(s);
  return "";
}

function buildItemsTable(items: any[] = [], currency: string) {
  if (!items || items.length === 0) return "";
  const rows = items
    .map(
      (it: any) => `
      <tr>
        <td>${esc(it.description ?? "")}</td>
        <td class="num">${esc(it.quantity ?? 0)}</td>
        <td class="num">${esc(formatCurrency(it.unitPrice ?? 0, currency))}</td>
        <td class="num">${esc(formatCurrency((it.quantity ?? 0) * (it.unitPrice ?? 0), currency))}</td>
      </tr>`
    )
    .join("");

  return `
    <table class="items">
      <thead>
        <tr>
          <th>Description</th>
          <th>Qty</th>
          <th>Unit Price</th>
          <th>Subtotal</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
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

export function exportDocumentAsPdf(type: ExportableType, doc: any, company?: any): boolean {
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
    const secondary = company?.secondaryColor || "#C7D2FE";
    const logo = company?.logo || "";
    const signature = company?.signature || "";

    const counterpartTitle =
      type === "purchaseOrder" ? "Supplier" : type === "payment" ? "Supplier" : "Client";
    const counterpart = doc.client || doc.supplier || null;

    const titleMap: Record<ExportableType, string> = {
      invoice: "Invoice",
      estimate: "Estimate",
      purchaseOrder: "Purchase Order",
      receipt: "Receipt",
      payment: "Payment Order",
    };

    const w = window.open("", "_blank");
    if (!w) return false;

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(titleMap[type])} ${esc(doc.id ?? "DRAFT")} - ${esc(company?.name ?? "Company")}</title>
  <style>
    :root{ --primary: ${escCss(primary)}; --secondary: ${escCss(secondary)}; }
    *{ box-sizing: border-box; }
    body{ font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji", "Segoe UI Emoji"; margin: 0; color: #111827; }
    .wrap{ padding: 32px; }
    header{ display:flex; align-items:center; justify-content:space-between; border-bottom: 4px solid var(--primary); padding-bottom: 16px; margin-bottom: 24px; }
    .brand{ display:flex; align-items:center; gap:16px; }
    .brand h1{ margin:0; font-size: 24px; }
    .logo{ height:56px; width:auto; object-fit:contain; }
    .doc-title{ text-align:right; }
    .doc-title h2{ margin:0; font-size:24px; color: var(--primary); }
    .doc-title .meta{ color:#6B7280; font-size:12px; }
    section{ margin-bottom: 24px; }
    h3{ margin:0 0 8px; font-size:14px; color:#374151; text-transform:uppercase; letter-spacing:0.05em; }
    .box{ border:1px solid #E5E7EB; border-radius:8px; padding:12px; background: #FFF; }
    .two-col{ display:grid; grid-template-columns: 1fr 1fr; gap:16px; }
    .items{ width:100%; border-collapse: collapse; margin-top:8px; }
    .items th, .items td{ border:1px solid #E5E7EB; padding:8px; text-align:left; }
    .items th{ background: #F9FAFB; }
    .num{ text-align:right; }
    .totals{ margin-left:auto; width: 320px; }
    .totals .row{ display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px dashed #E5E7EB; }
    .totals .row.total{ font-weight: 700; color: var(--primary); border-bottom: 0; }
    footer{ margin-top: 32px; display:flex; align-items:center; justify-content:space-between; }
    .signature{ height:60px; }
    .notes{ font-size:12px; color:#6B7280; }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <div class="brand">
        ${logo && escUrl(logo) ? `<img class="logo" src="${escUrl(logo)}" alt="${esc(company?.name ?? "Company")} logo" />` : ""}
        <div>
          <h1>${esc(company?.name ?? "Company")}</h1>
          <div class="notes">${esc(company?.address ?? "")}${company?.phone ? ` • ${esc(company.phone)}` : ""}${company?.email ? ` • ${esc(company.email)}` : ""}</div>
        </div>
      </div>
      <div class="doc-title">
        <h2>${esc(titleMap[type])}</h2>
        <div class="meta"># ${esc(doc.id ?? "DRAFT")} • ${esc(doc.date ?? new Date().toISOString().split("T")[0])}</div>
      </div>
    </header>

    <section class="two-col">
      <div class="box">
        <h3>Bill From</h3>
        <div>${esc(company?.name ?? "Company")}</div>
        <div class="notes">${esc(company?.address ?? "")}</div>
        ${company?.taxId ? `<div class="notes">Tax ID: ${esc(company.taxId)}</div>` : ""}
        ${company?.commercialRegistry ? `<div class="notes">Registry: ${esc(company.commercialRegistry)}</div>` : ""}
      </div>
      <div class="box">
        <h3>${esc(counterpartTitle)}</h3>
        <div>${esc(doc.customer ?? doc.clientName ?? doc.supplierName ?? counterpart?.name ?? "-")}</div>
        ${counterpart?.address ? `<div class="notes">${esc(counterpart.address)}</div>` : ""}
        ${counterpart?.phone ? `<div class="notes">${esc(counterpart.phone)}</div>` : ""}
        ${counterpart?.email ? `<div class="notes">${esc(counterpart.email)}</div>` : ""}
      </div>
    </section>

    <section>
      <h3>Items</h3>
      ${buildItemsTable(doc.items, currency)}
    </section>

    <section class="totals box">
      <div class="row"><div>Subtotal</div><div>${esc(formatCurrency(totals.subtotal, currency))}</div></div>
      ${totals.taxAmount ? `<div class="row"><div>Tax</div><div>${esc(formatCurrency(totals.taxAmount, currency))}</div></div>` : ""}
      ${totals.discount ? `<div class="row"><div>Discount</div><div>- ${esc(formatCurrency(totals.discount, currency))}</div></div>` : ""}
      <div class="row total"><div>Total</div><div>${esc(formatCurrency(totals.total, currency))}</div></div>
    </section>

    <section>
      <div class="notes">Total in words: ${esc(totalInWords)}</div>
      ${doc.notes ? `<div class="notes" style="margin-top:8px">Notes: ${esc(doc.notes)}</div>` : ""}
    </section>

    <footer>
      <div class="notes">Generated by the app</div>
      ${signature && escUrl(signature) ? `<img class="signature" src="${escUrl(signature)}" alt="Authorized signature" />` : ""}
    </footer>
  </div>
  <script>
    window.onload = () => {
      setTimeout(() => { window.print(); }, 300);
    };
  </script>
</body>
</html>`;

    w.document.open();
    w.document.write(html);
    w.document.close();
    return true;
  } catch (e) {
    console.error("Export PDF failed:", e);
    return false;
  }
}
