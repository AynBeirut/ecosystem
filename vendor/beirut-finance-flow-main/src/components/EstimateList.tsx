import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, Share2, Pencil } from "lucide-react";
import { useAppContext } from "@/context/AppContext";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

interface EstimateListProps {
  onPreview: (estimate: any) => void;
  onSend: (estimateId: string) => void;
  onExport?: (estimateId: string) => void;
  onEdit?: (estimate: any) => void;
}

const EstimateList: React.FC<EstimateListProps> = ({ onPreview, onSend, onEdit }) => {
  const { estimates } = useAppContext();

  if (!estimates || estimates.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No estimates found. Click "New Estimate" to create one.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {estimates.map((estimate) => (
        <Card key={estimate.id}>
          <CardHeader className="pb-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-start">
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-semibold truncate">{estimate.id}</h3>
                <p className="text-sm text-muted-foreground truncate">{estimate.clientName || "-"}</p>
              </div>
              <Badge
                className="self-start shrink-0"
                variant={
                  estimate.status === "approved"
                    ? "success"
                    : estimate.status === "rejected"
                      ? "destructive"
                      : "outline"
                }
              >
                {estimate.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <p className="text-lg font-semibold">{formatCurrency(estimate.amount, estimate.currency)}</p>
              <p className="text-muted-foreground">Date: {new Date(estimate.date).toLocaleDateString()}</p>
              {estimate.expiryDate && (
                <p className="text-muted-foreground">Expires: {estimate.expiryDate}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:flex sm:flex-wrap sm:justify-end">
              {onEdit && (
                <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => onEdit(estimate)}>
                  <Pencil className="mr-1 h-4 w-4 sm:mr-2" />
                  <span className="text-xs sm:text-sm">Edit</span>
                </Button>
              )}
              <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => onPreview(estimate)}>
                <Eye className="mr-1 h-4 w-4 sm:mr-2" />
                <span className="text-xs sm:text-sm">Preview</span>
              </Button>
              <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => onSend(estimate.id)}>
                <Share2 className="mr-1 h-4 w-4 sm:mr-2" />
                <span className="text-xs sm:text-sm">Share</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default EstimateList;
