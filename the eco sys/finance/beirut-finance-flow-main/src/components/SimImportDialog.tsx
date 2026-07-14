import { useRef, useState } from "react";
import { AlertCircle, Database, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAppContext } from "@/context/AppContext";
import { parseSimpleInvoiceManagerBackup, type SimImportRunSummary, type SimMigrationData } from "@/lib/simImport";

export default function SimImportDialog() {
  const { importSimMigration } = useAppContext();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<SimMigrationData | null>(null);
  const [summary, setSummary] = useState<SimImportRunSummary | null>(null);
  const [running, setRunning] = useState(false);

  const onFile = async (file: File) => {
    setSummary(null);
    setPreview(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      const parsed = parseSimpleInvoiceManagerBackup(text);
      setPreview(parsed);
      toast({ title: "SIM backup parsed", description: "Review the migration preview before importing." });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "The selected file is not a supported Simple Invoice Manager backup.";
      toast({
        title: "Cannot read SIM backup",
        description: message,
        variant: "destructive",
      });
      if (inputRef.current) inputRef.current.value = "";
      setFileName("");
    }
  };

  const runImport = async () => {
    if (!preview) return;
    setRunning(true);
    try {
      const result = await importSimMigration(preview);
      setSummary(result);
      toast({
        title: "SIM migration complete",
        description: `${result.clients} clients, ${result.products} products, ${result.invoices} invoices, ${result.receipts} receipts imported.`,
      });
    } finally {
      setRunning(false);
    }
  };

  const unsupportedTotal = preview
    ? Object.values(preview.unsupportedCounts).reduce((sum, count) => sum + count, 0)
    : 0;

  return (
    <div className="rounded-md border p-4 space-y-4">
      <div className="flex items-start gap-3">
        <Database className="h-5 w-5 text-indigo-600 mt-0.5" />
        <div>
          <div className="font-medium">Simple Invoice Manager backup</div>
          <p className="text-sm text-muted-foreground">
            Import a `.sim` JSON backup into the active organization. This migration imports historical records directly and does not run invoice or inventory calculations.
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".sim,application/json"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
        }}
        className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-accent"
      />

      {fileName && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Upload className="h-4 w-4" /> {fileName}
        </div>
      )}

      {preview && (
        <div className="rounded-md border bg-muted/30 p-3 space-y-3 text-sm">
          <div className="font-medium">Migration preview</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div>Clients: <span className="font-medium">{preview.clients.length}</span></div>
            <div>Products/services: <span className="font-medium">{preview.products.length}</span></div>
            <div>Invoices: <span className="font-medium">{preview.invoices.length}</span></div>
            <div>Receipts/payments: <span className="font-medium">{preview.receipts.length}</span></div>
          </div>
          {preview.source.appVersion && (
            <div className="text-xs text-muted-foreground">SIM app version: {preview.source.appVersion}</div>
          )}
          {unsupportedTotal > 0 && (
            <div className="flex gap-2 text-xs text-amber-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{unsupportedTotal} records are outside the first migration scope and will be skipped.</span>
            </div>
          )}
          {preview.warnings.length > 0 && (
            <ul className="text-xs text-amber-600 list-disc pl-5 max-h-24 overflow-y-auto">
              {preview.warnings.slice(0, 10).map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {summary && (
        <div className="rounded-md border p-3 text-sm space-y-1">
          <div className="font-medium">Migration result</div>
          <div>Clients imported: {summary.clients}</div>
          <div>Products/services imported: {summary.products}</div>
          <div>Invoices imported: {summary.invoices}</div>
          <div>Receipts/payments imported: {summary.receipts}</div>
          <div>Skipped duplicates: {summary.skipped}</div>
          <div>Failed: {summary.failed}</div>
          {summary.errors.length > 0 && (
            <details className="text-xs text-destructive">
              <summary className="cursor-pointer">{summary.errors.length} error(s)</summary>
              <ul className="list-disc pl-5 max-h-32 overflow-y-auto mt-1">
                {summary.errors.slice(0, 50).map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      <Button onClick={runImport} disabled={!preview || running}>
        {running && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Import SIM backup
      </Button>
    </div>
  );
}
