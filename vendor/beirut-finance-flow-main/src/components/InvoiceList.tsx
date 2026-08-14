
import { useMemo, useState } from "react";
import { useAppContext } from "@/context/AppContext";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Eye, Share2, CheckCircle2, Undo2, Pencil } from "lucide-react";
import { toast } from "sonner";

interface InvoiceListProps {
  limit?: number;
  onPreview?: (invoice: any) => void;
  onSend?: (id: string) => void;
  onExport?: (id: string) => void;
  onEdit?: (invoice: any) => void;
}

const InvoiceList = ({ limit, onPreview, onSend, onExport, onEdit }: InvoiceListProps) => {
  const { invoices, updateInvoice, recordInvoicePayment } = useAppContext();
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
  }, [invoices, searchTerm, statusFilter]);

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

  const actionButtons = (invoice: any) => (
    <div className="flex flex-wrap gap-2">
      {invoice.status === "paid" ? (
        <Button variant="outline" size="sm" onClick={() => togglePaid(invoice)} title="Mark as unpaid">
          <Undo2 className="h-4 w-4 mr-1" />
          Unpaid
        </Button>
      ) : (
        <Button variant="default" size="sm" onClick={() => togglePaid(invoice)} title="Mark as paid">
          <CheckCircle2 className="h-4 w-4 mr-1" />
          Paid
        </Button>
      )}
      {onEdit && (
        <Button variant="outline" size="sm" onClick={() => onEdit(invoice)} title="Edit">
          <Pencil className="h-4 w-4" />
        </Button>
      )}
      {onPreview && (
        <Button variant="outline" size="sm" onClick={() => onPreview(invoice)} title="Preview">
          <Eye className="h-4 w-4" />
        </Button>
      )}
      {onSend && (
        <Button variant="outline" size="sm" onClick={() => onSend(invoice.id)} title="Share">
          <Share2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );

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

      {/* Mobile: card list */}
      <div className="space-y-3 md:hidden">
        {displayedInvoices.map((invoice) => (
          <Card key={invoice.id}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{invoice.invoiceNumber || invoice.id}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {invoice.clientName || invoice.clientId || "-"}
                  </p>
                </div>
                <Badge
                  variant={
                    invoice.status === "paid"
                      ? "success"
                      : invoice.status === "partial"
                        ? "secondary"
                        : invoice.status === "sent"
                          ? "secondary"
                          : "outline"
                  }
                >
                  {invoice.status === "partial"
                    ? `partial (${formatCurrency(invoice.paidAmount || 0, invoice.currency)} paid)`
                    : invoice.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{new Date(invoice.date).toLocaleDateString()}</span>
                <span className="font-semibold">{formatCurrency(invoice.amount, invoice.currency)}</span>
              </div>
              {actionButtons(invoice)}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3 px-4">Invoice #</th>
              <th className="text-left py-3 px-4">Client</th>
              <th className="text-left py-3 px-4">Date</th>
              <th className="text-right py-3 px-4">Amount</th>
              <th className="text-left py-3 px-4">Status</th>
              <th className="text-right py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {displayedInvoices.map((invoice) => (
              <tr key={invoice.id}>
                <td className="py-3 px-4">{invoice.invoiceNumber || invoice.id}</td>
                <td className="py-3 px-4">{invoice.clientName || invoice.clientId || "-"}</td>
                <td className="py-3 px-4">{new Date(invoice.date).toLocaleDateString()}</td>
                <td className="py-3 px-4 text-right">
                  {formatCurrency(invoice.amount, invoice.currency)}
                </td>
                <td className="py-3 px-4">
                  <Badge
                    variant={
                      invoice.status === "paid"
                        ? "success"
                        : invoice.status === "partial"
                          ? "secondary"
                          : invoice.status === "sent"
                            ? "secondary"
                            : "outline"
                    }
                  >
                    {invoice.status === "partial"
                      ? `partial (${formatCurrency(invoice.paidAmount || 0, invoice.currency)} paid)`
                      : invoice.status}
                  </Badge>
                </td>
                <td className="py-3 px-4 text-right">{actionButtons(invoice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default InvoiceList;
