import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, Send, FileDown } from "lucide-react";
import { useAppContext } from "@/context/AppContext";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

interface EstimateListProps {
  onPreview: (estimate: any) => void;
  onSend: (estimateId: string) => void;
  onExport: (estimateId: string) => void;
}

const EstimateList: React.FC<EstimateListProps> = ({ onPreview, onSend, onExport }) => {
  const { estimates } = useAppContext();

  if (!estimates || estimates.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No estimates found. Click "New Estimate" to create one.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {estimates.map((estimate) => (
        <Card key={estimate.id}>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold">{estimate.id}</h3>
                <p className="text-sm text-muted-foreground">{estimate.clientName || "-"}</p>
              </div>
              <Badge variant={estimate.status === "approved" ? "success" : estimate.status === "rejected" ? "destructive" : "outline"}>
                {estimate.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex justify-between items-center pt-2">
            <div className="space-y-1">
              <p className="text-lg font-medium">{formatCurrency(estimate.amount, estimate.currency)}</p>
              <p className="text-sm text-muted-foreground">Date: {new Date(estimate.date).toLocaleDateString()}</p>
              {estimate.expiryDate && (
                <p className="text-sm text-muted-foreground">Expires: {estimate.expiryDate}</p>
              )}
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" onClick={() => onPreview(estimate)}>
                <Eye className="mr-2 h-4 w-4" />
                Preview
              </Button>
              <Button variant="outline" size="sm" onClick={() => onSend(estimate.id)}>
                <Send className="mr-2 h-4 w-4" />
                Send
              </Button>
              <Button variant="outline" size="sm" onClick={() => onExport(estimate.id)}>
                <FileDown className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default EstimateList;