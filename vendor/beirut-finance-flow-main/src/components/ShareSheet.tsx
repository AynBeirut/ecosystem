import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAppContext } from "@/context/AppContext";
import { useToast } from "@/hooks/use-toast";
import { FileDown, Mail, Share2, Loader2 } from "lucide-react";

type DocumentType = "invoice" | "estimate" | "receipt" | "purchaseOrder" | "paymentOrder";

interface ShareSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  documentType: DocumentType;
  recipientEmail?: string;
  recipientPhone?: string;
  clientName?: string;
}

const TYPE_LABEL: Record<DocumentType, string> = {
  invoice: "Invoice",
  estimate: "Estimate",
  receipt: "Receipt",
  purchaseOrder: "Purchase Order",
  paymentOrder: "Payment Order",
};

const isMobileDevice = () =>
  typeof navigator !== "undefined" &&
  /Android|iPhone|iPad|iPod|webOS|BlackBerry|Opera Mini|IEMobile/i.test(navigator.userAgent);

const canNativeShare = () =>
  typeof navigator !== "undefined" && typeof navigator.share === "function";

const canShareFiles = () => {
  if (!canNativeShare()) return false;
  try {
    return typeof navigator.canShare === "function";
  } catch {
    return false;
  }
};

const ShareSheet = ({
  open,
  onOpenChange,
  documentId,
  documentType,
  recipientEmail: initialEmail = "",
  clientName,
}: ShareSheetProps) => {
  const context = useAppContext() as any;
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const docLabel = TYPE_LABEL[documentType] || documentType;

  const handleOpenChange = (next: boolean) => {
    if (busy) return;
    onOpenChange(next);
  };

  const getPdfFile = useCallback(async (): Promise<File | null> => {
    try {
      return await context.getDocumentPdfFile(documentType, documentId);
    } catch (e) {
      console.error("Failed to generate PDF file:", e);
      return null;
    }
  }, [context, documentType, documentId]);

  /**
   * Native share — triggers the OS share sheet on mobile.
   * Shares the actual PDF file, not a text link.
   */
  const handleNativeShare = async () => {
    setBusy(true);
    try {
      const file = await getPdfFile();
      if (!file) {
        toast({ title: "Export Failed", description: "Could not generate PDF", variant: "destructive" });
        return;
      }

      if (canShareFiles() && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `${docLabel} ${documentId}`,
          files: [file],
        });
        toast({ title: "Shared", description: `${docLabel} shared successfully` });
      } else if (canNativeShare()) {
        const url = URL.createObjectURL(file);
        await navigator.share({
          title: `${docLabel} ${documentId}`,
          text: `${docLabel} #${documentId}${clientName ? ` for ${clientName}` : ""}`,
          url,
        });
        URL.revokeObjectURL(url);
        toast({ title: "Shared", description: `${docLabel} shared successfully` });
      } else {
        handleDownloadPdf();
        return;
      }
      onOpenChange(false);
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        console.error("Native share failed:", e);
        toast({ title: "Share Failed", description: "Could not share. Try downloading instead.", variant: "destructive" });
      }
    } finally {
      setBusy(false);
    }
  };

  /**
   * Download PDF — direct save to device.
   */
  const handleDownloadPdf = async () => {
    setBusy(true);
    try {
      let success = false;
      switch (documentType) {
        case "invoice": success = await context.exportInvoiceAsPdf(documentId); break;
        case "estimate": success = await context.exportEstimateAsPdf(documentId); break;
        case "receipt": success = await context.exportReceiptAsPdf(documentId); break;
        case "purchaseOrder": success = await context.exportPurchaseOrderAsPdf(documentId); break;
        case "paymentOrder": success = await context.exportPaymentOrderAsPdf(documentId); break;
      }
      if (success) {
        toast({ title: "PDF Downloaded", description: `Your ${docLabel.toLowerCase()} has been saved` });
        onOpenChange(false);
      } else {
        toast({ title: "Export Failed", description: `Could not export ${docLabel.toLowerCase()}`, variant: "destructive" });
      }
    } finally {
      setBusy(false);
    }
  };

  /**
   * WhatsApp share — generates PDF, then shares via WhatsApp.
   * Mobile: uses native share targeting WhatsApp with the PDF file.
   * Desktop: downloads PDF first, then opens WhatsApp Web with a message.
   */
  const handleWhatsApp = async () => {
    setBusy(true);
    try {
      const file = await getPdfFile();
      if (!file) {
        toast({ title: "Export Failed", description: "Could not generate PDF", variant: "destructive" });
        return;
      }

      if (isMobileDevice() && canShareFiles() && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `${docLabel} ${documentId}`,
          files: [file],
        });
        toast({ title: "Shared", description: `${docLabel} sent via share` });
      } else {
        const url = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);

        const msg = `${docLabel} #${documentId}${clientName ? ` for ${clientName}` : ""} — PDF attached separately`;
        const waUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;
        window.open(waUrl, "_blank");
        toast({ title: "WhatsApp Opened", description: "PDF downloaded — attach it in WhatsApp" });
      }
      onOpenChange(false);
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        toast({ title: "Share Failed", description: "Could not share via WhatsApp", variant: "destructive" });
      }
    } finally {
      setBusy(false);
    }
  };

  /**
   * Email share — generates PDF, downloads it, then opens email compose.
   */
  const handleEmail = async () => {
    setBusy(true);
    try {
      const file = await getPdfFile();
      if (!file) {
        toast({ title: "Export Failed", description: "Could not generate PDF", variant: "destructive" });
        return;
      }

      if (isMobileDevice() && canShareFiles() && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `${docLabel} ${documentId}`,
          files: [file],
        });
      } else {
        const url = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);

        const orgName = context.user?.company?.name || "";
        const subject = `${docLabel} ${documentId}${orgName ? ` from ${orgName}` : ""}`;
        const body = `Hello,\n\nPlease find the attached ${docLabel.toLowerCase()} #${documentId}.\nThe PDF has been downloaded — please attach it to this email.\n\n${orgName ? `— ${orgName}` : ""}`;
        const mailto = `mailto:${encodeURIComponent(initialEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.location.href = mailto;
        toast({ title: "Email Opened", description: "PDF downloaded — attach it to the email" });
      }
      onOpenChange(false);
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        toast({ title: "Send Failed", description: "Could not open email", variant: "destructive" });
      }
    } finally {
      setBusy(false);
    }
  };

  const mobile = isMobileDevice();

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 rounded-t-2xl sm:rounded-2xl overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-center text-lg">
            Share {docLabel}
            {clientName && (
              <span className="block text-sm font-normal text-muted-foreground mt-0.5">
                to {clientName}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="px-4 pb-6 pt-2 space-y-1">
          {/* Native Share — primary on mobile */}
          {mobile && canNativeShare() && (
            <button
              onClick={handleNativeShare}
              disabled={busy}
              className="w-full flex items-center gap-4 px-4 py-4 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-left group"
            >
              <div className="flex-shrink-0 w-11 h-11 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                {busy ? <Loader2 className="h-5 w-5 text-blue-600 animate-spin" /> : <Share2 className="h-5 w-5 text-blue-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">Share PDF</p>
                <p className="text-xs text-muted-foreground">Send via WhatsApp, Email, Bluetooth, or any app</p>
              </div>
            </button>
          )}

          {/* Download PDF */}
          <button
            onClick={handleDownloadPdf}
            disabled={busy}
            className="w-full flex items-center gap-4 px-4 py-4 rounded-xl hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors text-left group"
          >
            <div className="flex-shrink-0 w-11 h-11 rounded-full bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center">
              {busy ? <Loader2 className="h-5 w-5 text-teal-600 animate-spin" /> : <FileDown className="h-5 w-5 text-teal-600" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">Download PDF</p>
              <p className="text-xs text-muted-foreground">Save to your device</p>
            </div>
          </button>

          {/* WhatsApp — desktop only (mobile uses native share) */}
          {!mobile && (
            <button
              onClick={handleWhatsApp}
              disabled={busy}
              className="w-full flex items-center gap-4 px-4 py-4 rounded-xl hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-left group"
            >
              <div className="flex-shrink-0 w-11 h-11 rounded-full bg-green-50 dark:bg-green-900/30 flex items-center justify-center">
                <svg className="h-5 w-5 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.613.613l4.458-1.495A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.386 0-4.594-.826-6.34-2.207l-.166-.132-3.46 1.16 1.16-3.46-.132-.166A9.956 9.956 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">Share via WhatsApp</p>
                <p className="text-xs text-muted-foreground">Download PDF and open WhatsApp Web</p>
              </div>
            </button>
          )}

          {/* Email — desktop only (mobile uses native share) */}
          {!mobile && (
            <button
              onClick={handleEmail}
              disabled={busy}
              className="w-full flex items-center gap-4 px-4 py-4 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors text-left group"
            >
              <div className="flex-shrink-0 w-11 h-11 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                <Mail className="h-5 w-5 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">Send via Email</p>
                <p className="text-xs text-muted-foreground">Download PDF and open your email client</p>
              </div>
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareSheet;
