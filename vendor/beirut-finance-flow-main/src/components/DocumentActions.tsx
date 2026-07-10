
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";
import ShareSheet from "@/components/ShareSheet";

type DocumentType = "invoice" | "estimate" | "receipt" | "paymentOrder" | "purchaseOrder";

interface BaseDocument {
  id: string;
  type?: DocumentType;
}

interface DocumentActionsProps {
  document: BaseDocument;
  documentType?: DocumentType;
  recipientEmail?: string;
  recipientPhone?: string;
  clientName?: string;
  onSuccess?: () => void;
  className?: string;
}

const DocumentActions: React.FC<DocumentActionsProps> = ({
  document,
  documentType,
  recipientEmail,
  recipientPhone,
  clientName,
  onSuccess,
  className = "",
}) => {
  const [isShareSheetOpen, setIsShareSheetOpen] = useState(false);
  const type = documentType || document.type || "invoice";

  return (
    <div className={`flex space-x-2 ${className}`}>
      <Button variant="outline" size="sm" onClick={() => setIsShareSheetOpen(true)}>
        <Share2 className="h-4 w-4 mr-2" />
        Share
      </Button>
      <ShareSheet
        open={isShareSheetOpen}
        onOpenChange={(open) => {
          setIsShareSheetOpen(open);
          if (!open && onSuccess) onSuccess();
        }}
        documentId={document.id}
        documentType={type}
        recipientEmail={recipientEmail}
        recipientPhone={recipientPhone}
        clientName={clientName}
      />
    </div>
  );
};

export default DocumentActions;
