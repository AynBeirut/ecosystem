
import { useMemo, useState } from "react";
import { useAppContext } from "@/context/AppContext";
import { formatDualCurrency } from "@/lib/utils";
import { useReportExchangeRate } from "@/hooks/useReportExchangeRate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useInvoiceManagerDateFilterOptional } from "@/context/InvoiceManagerDateFilterContext";

interface InvoiceListProps {
  limit?: number;
  onPreview?: (invoice: any) => void;
  onSend?: (id: string) => void;
  onExport?: (id: string) => void;
  onEdit?: (invoice: any) => void;
}

const InvoiceList = ({ limit, onPreview, onSend, onExport, onEdit }: InvoiceListProps) => {
  const { invoices, updateInvoice, recordInvoicePayment } = useAppContext();
  const { usdToLbp } = useReportExchangeRate();
  const dateFilter = useInvoiceManagerDateFilterOptional();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const statusOptions = useMemo(() => {
    const statuses = Array.from(
      new Set(
        invoices
          .map((invoice) => String(invoice.status || "").trim().toLowerCase())
          .filter(Boolean),
      ),
    );
    return ["all", ...statuses];
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return invoices.filter((invoice) => {
      const status = String(invoice.status || "").toLowerCase();
      const statusMatches = statusFilter === "all" || status === statusFilter;

      if (!statusMatches) return false;
      if (dateFilter && !dateFilter.matchesDate(invoice.date ?? invoice.createdAt)) return false;
      if (!query) return true;

      const haystack = [
        invoice.id,
        invoice.invoiceNumber,
        invoice.clientName,
        invoice.clientId,
        invoice.notes,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");

      return haystack.includes(query);
    });
  }, [invoices, searchTerm, statusFilter, dateFilter]);

  const displayedInvoices = limit ? filteredInvoices.slice(0, limit) : filteredInvoices;

  const invoiceTotal = (invoice: { amount?: number; total?: number }) =>
    Number(invoice.total ?? invoice.amount ?? 0);

  const togglePaid = (invoice: any) => {
    if (invoice.status === "paid") {
      try {
        updateInvoice(invoice.id, { status: "sent", paidAmount: 0, paidAt: undefined });
        toast.success("Marked as unpaid");
      } catch (e: any) {
        toast.error(e?.message || "Failed to update invoice status");
      }
      return;
    }

    const total = invoiceTotal(invoice);
    const remaining = Math.max(0, total - (invoice.paidAmount || 0));
    if (remaining <= 0) {
      updateInvoice(invoice.id, { status: "paid" } as any);
      toast.success("Marked as paid");
      return;
    }

    try {
      recordInvoicePayment(invoice.id, remaining, invoice.paymentMethod || "cash");
      toast.success(remaining >= total ? "Marked as paid" : "Partial payment recorded");
    } catch (e: any) {
      toast.error(e?.message || "Failed to record payment");
    }
  };

  if (displayedInvoices.length === 0) {
    return (
      <div className="space-y-4">
        {!limit && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by invoice, client, or notes"
              className="md:col-span-2"
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status === "all" ? "All statuses" : status}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="text-center py-8 text-gray-500">
          {searchTerm.trim() || statusFilter !== "all"
            ? "No invoices match your search/filter."
            : "No invoices created yet."}
        </div>
      </div>
    );
  }

  return (
    <>
      {!limit && (
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by invoice, client, or notes"
            className="md:col-span-2"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status === "all" ? "All statuses" : status}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-3">
        {displayedInvoices.map((invoice) => (
          <div
            key={invoice.id}
            className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <h3 className="font-medium">{invoice.clientName || "Invoice"}</h3>
              <p className="text-sm text-muted-foreground">
                {invoice.date} · {formatDualCurrency(invoiceTotal(invoice), invoice.currency, usdToLbp)} · {invoice.status}
                {invoice.invoiceNumber ? ` · ${invoice.invoiceNumber}` : ""}
              </p>
              {onEdit && (
                <button
                  type="button"
                  style={{ marginTop: 8, background: "#0f766e", color: "#ffffff", border: 0, borderRadius: 6, padding: "6px 12px", fontWeight: 700 }}
                  onClick={() => onEdit(invoice)}
                >
                  Edit invoice
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {invoice.status === "paid" ? (
                <Button variant="outline" size="sm" onClick={() => togglePaid(invoice)}>Unpaid</Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => togglePaid(invoice)}>Paid</Button>
              )}
              {onPreview && (
                <Button variant="outline" size="sm" onClick={() => onPreview(invoice)}>Preview</Button>
              )}
              {onSend && (
                <Button variant="outline" size="sm" onClick={() => onSend(invoice.id)}>Share</Button>
              )}
              {onExport && (
                <Button variant="outline" size="sm" onClick={() => onExport(invoice.id)}>Export</Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default InvoiceList;
