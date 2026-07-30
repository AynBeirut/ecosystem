
import React from "react";
import { useAppContext } from "@/context/AppContext";
import { Button } from "@/components/ui/button";
import { Send, FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Define the document types this component can handle
type DocumentType = "invoice" | "estimate" | "receipt" | "paymentOrder" | "purchaseOrder";

// Define the base document interface (properties shared by all document types)
interface BaseDocument {
  id: string;
  type?: DocumentType;
}

interface DocumentActionsProps {
  document: BaseDocument;
  documentType?: DocumentType; // Optional override if document.type is not available
  recipientEmail?: string;
  onSuccess?: () => void;
  className?: string;
}

const DocumentActions: React.FC<DocumentActionsProps> = ({
  document,
  documentType,
  recipientEmail,
  onSuccess,
  className = "",
}) => {
  const context = useAppContext();
  const { toast } = useToast();
  
  // Determine the document type (either from document.type or from documentType prop)
  const type = documentType || document.type || "invoice";
  
  const handleSend = async () => {
    try {
      let success = false;
      const email = recipientEmail || ""; // In a real implementation, you might want to prompt for email
      
      // Call the appropriate send function based on document type
      switch (type) {
        case "invoice":
          success = context.sendInvoice(document.id, email);
          break;
        case "estimate":
          success = context.sendEstimate(document.id, email);
          break;
        case "receipt":
          success = context.sendReceipt(document.id, email);
          break;
        case "paymentOrder":
          success = context.sendPaymentOrder(document.id, email);
          break;
        case "purchaseOrder":
          success = context.sendPurchaseOrder(document.id, email);
          break;
      }
      
      if (success) {
        toast({
          title: "Success",
          description: `Successfully sent ${type} ${document.id}`,
        });
        
        if (onSuccess) onSuccess();
      } else {
        throw new Error(`Failed to send ${type}`);
      }
    } catch (error) {
      console.error(`Error sending ${type}:`, error);
      toast({
        title: "Error",
        description: `Failed to send ${type}`,
        variant: "destructive",
      });
    }
  };
  
  const handleExport = async () => {
    try {
      let success = false;
      
      // Call the appropriate export function based on document type
      switch (type) {
        case "invoice":
          success = context.exportInvoiceAsPdf(document.id);
          break;
        case "estimate":
          success = context.exportEstimateAsPdf(document.id);
          break;
        case "receipt":
          success = context.exportReceiptAsPdf(document.id);
          break;
        case "paymentOrder":
          success = context.exportPaymentOrderAsPdf(document.id);
          break;
        case "purchaseOrder":
          success = context.exportPurchaseOrderAsPdf(document.id);
          break;
      }
      
      if (success) {
        toast({
          title: "Success",
          description: `${type} exported as PDF`,
        });
        
        if (onSuccess) onSuccess();
      } else {
        throw new Error(`Failed to export ${type}`);
      }
    } catch (error) {
      console.error(`Error exporting ${type}:`, error);
      toast({
        title: "Error",
        description: `Failed to export ${type}`,
        variant: "destructive",
      });
    }
  };

  return (
    <div className={`flex space-x-2 ${className}`}>
      <Button variant="outline" size="sm" onClick={handleSend}>
        <Send className="h-4 w-4 mr-2" />
        Send
      </Button>
      <Button variant="outline" size="sm" onClick={handleExport}>
        <FileDown className="h-4 w-4 mr-2" />
        Export as PDF
      </Button>
    </div>
  );
};

export default DocumentActions;
