import React from "react";
import { Button } from "@/components/ui/button";
import { resolveInvoiceNumber } from "@/lib/financeDocumentNormalization";
import { useAppContext } from "@/context/AppContext";
import { formatCurrency } from "@/lib/utils";
import { useInvoiceManagerDateFilterOptional } from "@/context/InvoiceManagerDateFilterContext";

interface EstimateListProps {
  onPreview: (estimate: any) => void;
  onSend: (estimateId: string) => void;
  onExport?: (estimateId: string) => void;
  onEdit?: (estimate: any) => void;
  onDelete?: (estimate: any) => void;
}

const EstimateList: React.FC<EstimateListProps> = ({ onPreview, onSend, onExport, onEdit, onDelete }) => {
  const { estimates } = useAppContext();
  const dateFilter = useInvoiceManagerDateFilterOptional();
  const visibleEstimates = (estimates || []).filter(
    (estimate) => !dateFilter || dateFilter.matchesDate(estimate.date ?? estimate.createdAt),
  );

  if (!visibleEstimates.length) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No estimates found. Click "New Estimate" to create one.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {visibleEstimates.map((estimate) => (
        <div
          key={estimate.id}
          className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h3 className="font-medium">{estimate.clientName || "Quotation"}</h3>
            <p className="text-sm text-muted-foreground">
              {estimate.date} · {formatCurrency(estimate.amount, estimate.currency)} · {estimate.status}
              {resolveInvoiceNumber(estimate as Record<string, unknown>)
                ? ` · ${resolveInvoiceNumber(estimate as Record<string, unknown>)}`
                : ""}
            </p>
            {onEdit && (
              <button
                type="button"
                style={{ marginTop: 8, background: "#0f766e", color: "#ffffff", border: 0, borderRadius: 6, padding: "6px 12px", fontWeight: 700 }}
                onClick={() => onEdit(estimate)}
              >
                Edit quotation
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => onPreview(estimate)}>Preview</Button>
            <Button variant="outline" size="sm" onClick={() => onSend(estimate.id)}>Share</Button>
            {onExport && (
              <Button variant="outline" size="sm" onClick={() => onExport(estimate.id)}>Export</Button>
            )}
            {onDelete && (
              <Button variant="outline" size="sm" onClick={() => onDelete(estimate)}>Delete</Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default EstimateList;
