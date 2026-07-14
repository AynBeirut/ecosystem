
import { useAppContext } from "@/context/AppContext";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Mail, FileDown, CheckCircle2, Undo2 } from "lucide-react";
import { toast } from "sonner";

interface InvoiceListProps {
  limit?: number;
  onPreview?: (invoice: any) => void;
  onSend?: (id: string) => void;
  onExport?: (id: string) => void;
}

const InvoiceList = ({ limit, onPreview, onSend, onExport }: InvoiceListProps) => {
  const { invoices, updateInvoice } = useAppContext();

  const displayedInvoices = limit ? invoices.slice(0, limit) : invoices;

  const togglePaid = (invoice: any) => {
    const next = invoice.status === "paid" ? "sent" : "paid";
    try {
      updateInvoice(invoice.id, { status: next } as any);
      toast.success(next === "paid" ? "Marked as paid" : "Marked as unpaid");
    } catch (e: any) {
      toast.error(e?.message || "Failed to update invoice status");
    }
  };

  return (
    <div className="overflow-x-auto">
      {displayedInvoices.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No invoices created yet.
        </div>
      ) : (
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
                <td className="py-3 px-4">{invoice.id}</td>
                <td className="py-3 px-4">{invoice.clientName || invoice.clientId || "-"}</td>
                <td className="py-3 px-4">{new Date(invoice.date).toLocaleDateString()}</td>
                <td className="py-3 px-4 text-right">
                  {formatCurrency(invoice.amount, invoice.currency)}
                </td>
                <td className="py-3 px-4">
                  <Badge variant={invoice.status === "paid" ? "success" : invoice.status === "sent" ? "secondary" : "outline"}>
                    {invoice.status}
                  </Badge>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex justify-end gap-2 flex-wrap">
                    {invoice.status === "paid" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => togglePaid(invoice)}
                        title="Mark as unpaid"
                      >
                        <Undo2 className="h-4 w-4 mr-1" />
                        Unpaid
                      </Button>
                    ) : (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => togglePaid(invoice)}
                        title="Mark as paid"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Mark Paid
                      </Button>
                    )}
                    {onPreview && (
                      <Button variant="outline" size="sm" onClick={() => onPreview(invoice)} title="Preview">
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    {onSend && (
                      <Button variant="outline" size="sm" onClick={() => onSend(invoice.id)} title="Send">
                        <Mail className="h-4 w-4" />
                      </Button>
                    )}
                    {onExport && (
                      <Button variant="outline" size="sm" onClick={() => onExport(invoice.id)} title="Export PDF">
                        <FileDown className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default InvoiceList;
