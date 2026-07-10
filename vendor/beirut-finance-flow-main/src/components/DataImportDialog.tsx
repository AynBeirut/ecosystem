import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useAppContext } from "@/context/AppContext";
import {
  parseCsv, mapImportRows, getFieldDefinitions, getDestinationLabel, suggestColumnMapping,
  SAMPLE_CSV, downloadText, type ColumnMapping, type ImportEntity,
  type MappedClient, type MappedProduct, type MappedSupplier,
} from "@/lib/csvImport";
import { AlertCircle, ArrowRight, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";

type DupStrategy = "skip" | "update";

interface RunSummary {
  total: number; created: number; updated: number; skipped: number; failed: number;
  errors: Array<{ row: number; reason: string }>;
}

const IGNORE_FIELD = "__ignore__";

export default function DataImportDialog() {
  const {
    clients, suppliers, products,
    addClient, addSupplier, addProduct,
    updateClient, updateSupplier, updateProduct,
  } = useAppContext();

  const [open, setOpen] = useState(false);
  const [entity, setEntity] = useState<ImportEntity>("clients");
  const [duplicates, setDuplicates] = useState<DupStrategy>("skip");
  const [csvText, setCsvText] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setCsvText(""); setFileName(""); setMapping({}); setSummary(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const existingRecords = useMemo(() => {
    if (entity === "clients") return clients.map(c => ({ name: c.name, email: c.email }));
    if (entity === "suppliers") return suppliers.map(s => ({ name: s.name, email: s.email }));
    return products.map(p => ({ name: p.name, sku: p.sku }));
  }, [clients, entity, products, suppliers]);

  const updateEntity = (nextEntity: ImportEntity) => {
    setEntity(nextEntity);
    setSummary(null);
    if (csvText) {
      const parsed = parseCsv(csvText);
      setMapping(suggestColumnMapping(parsed.headers, nextEntity));
    }
  };

  const onFile = async (file: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "CSV must be under 5 MB.", variant: "destructive" });
      return;
    }
    const text = await file.text();
    const parsed = parseCsv(text);
    setCsvText(text);
    setFileName(file.name);
    setMapping(suggestColumnMapping(parsed.headers, entity));
    setSummary(null);
  };

  const preview = useMemo(() => {
    if (!csvText) return null;
    const parsed = parseCsv(csvText);
    const effectiveMapping = parsed.headers.reduce<ColumnMapping>((acc, header) => {
      acc[header] = mapping[header] ?? suggestColumnMapping(parsed.headers, entity)[header] ?? "";
      return acc;
    }, {});
    return {
      parsed,
      mapped: mapImportRows(entity, parsed, effectiveMapping, existingRecords),
    };
  }, [csvText, entity, existingRecords, mapping]);

  const updateMapping = (sourceColumn: string, destinationField: string) => {
    setSummary(null);
    setMapping(prev => ({
      ...prev,
      [sourceColumn]: destinationField === IGNORE_FIELD ? "" : destinationField,
    }));
  };

  const runImport = async () => {
    if (!preview) return;
    setRunning(true);
    const result: RunSummary = {
      total: preview.mapped.valid.length + preview.mapped.invalid.length,
      created: 0, updated: 0, skipped: 0, failed: 0,
      errors: [...preview.mapped.invalid],
    };

    try {
      if (entity === "clients") {
        const byName = new Map(clients.map(c => [c.name.trim().toLowerCase(), c.id]));
        const byEmail = new Map(clients.filter(c => c.email).map(c => [c.email.trim().toLowerCase(), c.id]));
        for (const { row, data } of preview.mapped.valid as Array<{ row: number; data: MappedClient }>) {
          const existingId =
            (data.email && byEmail.get(data.email.toLowerCase())) ||
            byName.get(data.name.toLowerCase());
          if (existingId) {
            if (duplicates === "skip") { result.skipped++; continue; }
            updateClient(existingId, data);
            result.updated++;
          } else {
            const id = await addClient(data);
            if (id) result.created++;
            else { result.failed++; result.errors.push({ row, reason: "Insert failed (limit or backend)" }); }
          }
        }
      } else if (entity === "suppliers") {
        const byName = new Map(suppliers.map(s => [s.name.trim().toLowerCase(), s.id]));
        for (const { row, data } of preview.mapped.valid as Array<{ row: number; data: MappedSupplier }>) {
          const existingId = byName.get(data.name.toLowerCase());
          if (existingId) {
            if (duplicates === "skip") { result.skipped++; continue; }
            updateSupplier(existingId, data);
            result.updated++;
          } else {
            const id = await addSupplier(data);
            if (id) result.created++;
            else { result.failed++; result.errors.push({ row, reason: "Insert failed" }); }
          }
        }
      } else {
        const bySku = new Map(products.filter(p => p.sku).map(p => [p.sku!.trim().toLowerCase(), p.id]));
        const byName = new Map(products.map(p => [p.name.trim().toLowerCase(), p.id]));
        for (const { row, data } of preview.mapped.valid as Array<{ row: number; data: MappedProduct }>) {
          const existingId =
            (data.sku && bySku.get(data.sku.toLowerCase())) ||
            byName.get(data.name.toLowerCase());
          if (existingId) {
            if (duplicates === "skip") { result.skipped++; continue; }
            updateProduct(existingId, data);
            result.updated++;
          } else {
            const id = await addProduct(data);
            if (id) result.created++;
            else { result.failed++; result.errors.push({ row, reason: "Insert failed (limit or backend)" }); }
          }
        }
      }

      setSummary(result);
      toast({
        title: "Import complete",
        description: `${result.created} created, ${result.updated} updated, ${result.skipped} skipped, ${result.failed} failed.`,
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}
    >
      <DialogTrigger asChild>
        <Button>
          <Upload className="mr-2 h-4 w-4" />
          Import data
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import data from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file to add clients, suppliers, or products in bulk. Data is scoped to your organization.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>What to import</Label>
              <Select
                value={entity}
                onValueChange={(v) => updateEntity(v as ImportEntity)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="clients">Clients</SelectItem>
                  <SelectItem value="suppliers">Suppliers</SelectItem>
                  <SelectItem value="products">Products</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>If a row already exists</Label>
              <RadioGroup
                value={duplicates}
                onValueChange={(v) => setDuplicates(v as DupStrategy)}
                className="flex gap-4 pt-2"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="skip" id="dup-skip" />
                  <Label htmlFor="dup-skip" className="font-normal cursor-pointer">Skip</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="update" id="dup-update" />
                  <Label htmlFor="dup-update" className="font-normal cursor-pointer">Update</Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          <div className="rounded-md border p-3 flex items-center justify-between gap-3">
            <div className="text-sm">
              <div className="font-medium">Need the format?</div>
              <div className="text-muted-foreground">Download a sample CSV with the right column headers.</div>
            </div>
            <Button
              type="button" variant="outline" size="sm"
              onClick={() => downloadText(`${entity}-template.csv`, SAMPLE_CSV[entity])}
            >
              <Download className="mr-2 h-4 w-4" />
              Template
            </Button>
          </div>

          <div className="space-y-2">
            <Label>CSV file</Label>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-accent"
            />
            {fileName && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileSpreadsheet className="h-4 w-4" /> {fileName}
              </div>
            )}
          </div>

          {preview && (
            <div className="rounded-md border p-3 space-y-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium">Mapping preview</div>
                <div className="text-xs text-muted-foreground">
                  Delimiter: {preview.parsed.delimiter === ";" ? "Semicolon" : "Comma"} · Header row: {preview.parsed.headerRow || "none"}
                </div>
              </div>
              <div>
                Detected columns:{" "}
                <span className="text-muted-foreground">
                  {preview.parsed.headers.join(", ") || "(none)"}
                </span>
              </div>
              {preview.parsed.warnings.length > 0 && (
                <ul className="text-xs text-amber-600 list-disc pl-5">
                  {preview.parsed.warnings.map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
              )}

              {preview.parsed.headers.length > 0 && (
                <div className="rounded-md border divide-y">
                  {preview.parsed.headers.map(sourceColumn => (
                    <div key={sourceColumn} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2 items-center p-2">
                      <div className="font-medium truncate">{sourceColumn}</div>
                      <ArrowRight className="hidden sm:block h-4 w-4 text-muted-foreground" />
                      <Select
                        value={preview.mapped.mapping[sourceColumn] || IGNORE_FIELD}
                        onValueChange={(value) => updateMapping(sourceColumn, value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={IGNORE_FIELD}>Ignore</SelectItem>
                          {getFieldDefinitions(entity).map(field => (
                            <SelectItem key={field.field} value={field.field}>
                              {field.label}{field.required ? " (required)" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              )}

              {preview.mapped.missingRequiredFields.length > 0 && (
                <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <div>
                    Map required field(s):{" "}
                    {preview.mapped.missingRequiredFields.map(field => getDestinationLabel(entity, field)).join(", ")}
                  </div>
                </div>
              )}

              <div>
                Valid rows: <span className="font-medium">{preview.mapped.valid.length}</span>
                {" · "}
                Invalid rows: <span className="font-medium">{preview.mapped.invalid.length}</span>
                {" · "}
                Duplicate warnings: <span className="font-medium">{preview.mapped.warnings.length}</span>
              </div>
              {preview.mapped.invalid.length > 0 && (
                <ul className="text-xs text-destructive list-disc pl-5 max-h-24 overflow-y-auto">
                  {preview.mapped.invalid.slice(0, 10).map((e, i) => (
                    <li key={i}>Row {e.row}: {e.reason}</li>
                  ))}
                </ul>
              )}
              {preview.mapped.warnings.length > 0 && (
                <ul className="text-xs text-amber-600 list-disc pl-5 max-h-24 overflow-y-auto">
                  {preview.mapped.warnings.slice(0, 10).map((e, i) => (
                    <li key={i}>Row {e.row}: {e.reason}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {summary && (
            <div className="rounded-md border p-3 space-y-1 text-sm">
              <div className="font-medium">Result</div>
              <div>Created: {summary.created}</div>
              <div>Updated: {summary.updated}</div>
              <div>Skipped: {summary.skipped}</div>
              <div>Failed: {summary.failed}</div>
              {summary.errors.length > 0 && (
                <details className="text-xs text-destructive">
                  <summary className="cursor-pointer">{summary.errors.length} error(s)</summary>
                  <ul className="list-disc pl-5 max-h-32 overflow-y-auto mt-1">
                    {summary.errors.slice(0, 50).map((e, i) => (
                      <li key={i}>Row {e.row}: {e.reason}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={running}>
            Close
          </Button>
          <Button
            onClick={runImport}
            disabled={running || !preview || preview.mapped.valid.length === 0}
          >
            {running && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Import {preview ? `${preview.mapped.valid.length} row(s)` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
