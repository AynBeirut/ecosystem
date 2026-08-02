import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { getReadableError } from "@/lib/getReadableError";
import type { LedgerAccount, PcgClientAccount } from "@/types/generalLedger";
import type { LebanesePcgAccount } from "@/lib/ledger/lebanesePcgChart.generated";
import { mapGrabioCodeToPcg } from "@/lib/ledger/grabioToPcgMap";
import {
  deletePcgClientAccount,
  loadPcgClientAccounts,
  replacePcgClientAccounts,
  savePcgClientAccount,
} from "@/lib/firestore/pcgClientAccountsFirestore";
import { sortLedgerAccountsByCode } from "@/lib/ledger/accountCodeSort";
import {
  parsePcgClientAccountsCsv,
  pcgClientAccountsToCsv,
  pcgClientAccountsTemplateCsv,
  validateClientPcgCode,
} from "@/lib/ledger/pcgClientAccountsCsv";

type Props = {
  storeId: string;
  activeLedgerAccounts: LedgerAccount[];
  rows: PcgClientAccount[];
  onChange: (rows: PcgClientAccount[]) => void;
  prefillAccount?: LebanesePcgAccount | null;
  prefillKey?: number;
};

type FormState = {
  id?: string;
  clientCode: string;
  grabioOperationalCode: string;
  parentPcgCode: string;
  name: string;
  nameAr: string;
  currency: "LL" | "USD";
};

const emptyForm = (): FormState => ({
  clientCode: "",
  grabioOperationalCode: "",
  parentPcgCode: "",
  name: "",
  nameAr: "",
  currency: "LL",
});

export default function PcgClientAccountsPanel({
  storeId,
  activeLedgerAccounts,
  rows,
  onChange,
  prefillAccount,
  prefillKey,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const grabioOptions = useMemo(
    () => sortLedgerAccountsByCode(activeLedgerAccounts.filter((a) => a.isActive)),
    [activeLedgerAccounts],
  );

  const refresh = async () => {
    const next = await loadPcgClientAccounts(storeId);
    onChange(next);
    return next;
  };

  const openNew = () => {
    setForm(emptyForm());
    setSaveError("");
    setOpen(true);
  };

  useEffect(() => {
    if (!prefillAccount || prefillKey === undefined) return;
    setSaveError("");
    setForm({
      ...emptyForm(),
      parentPcgCode: prefillAccount.code,
      name: prefillAccount.name,
      nameAr: prefillAccount.nameAr || "",
      currency: prefillAccount.currency === "USD" ? "USD" : "LL",
    });
    setOpen(true);
  }, [prefillAccount, prefillKey]);

  const openEdit = (row: PcgClientAccount) => {
    setSaveError("");
    setForm({
      id: row.id,
      clientCode: row.clientCode,
      grabioOperationalCode: row.grabioOperationalCode,
      parentPcgCode: row.parentPcgCode || "",
      name: row.name || "",
      nameAr: row.nameAr || "",
      currency: row.currency,
    });
    setOpen(true);
  };

  const onGrabioPick = (code: string) => {
    const parent = mapGrabioCodeToPcg(code) || "";
    setForm((prev) => ({
      ...prev,
      grabioOperationalCode: code,
      parentPcgCode: prev.parentPcgCode || parent,
    }));
  };

  const handleSave = async () => {
    setSaveError("");
    const err = validateClientPcgCode(form.clientCode);
    if (err) {
      setSaveError(err);
      toast.error(err);
      return;
    }
    if (!form.grabioOperationalCode.trim()) {
      const msg = "Select a Grabio posting account";
      setSaveError(msg);
      toast.error(msg);
      return;
    }
    if (!storeId?.trim()) {
      const msg = "Store not loaded. Refresh the page and try again.";
      setSaveError(msg);
      toast.error(msg);
      return;
    }
    setSaving(true);
    try {
      await savePcgClientAccount(storeId, {
        id: form.id,
        clientCode: form.clientCode.trim(),
        grabioOperationalCode: form.grabioOperationalCode.trim(),
        parentPcgCode: form.parentPcgCode.trim() || mapGrabioCodeToPcg(form.grabioOperationalCode),
        name: form.name.trim() || undefined,
        nameAr: form.nameAr.trim() || undefined,
        currency: form.currency,
      });
      await refresh();
      toast.success(form.id ? "Client account updated" : "Client account added");
      setForm(emptyForm());
      setOpen(false);
    } catch (e) {
      const message = getReadableError(e);
      console.error("[PcgClientAccountsPanel] save failed", e);
      setSaveError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: PcgClientAccount) => {
    if (!window.confirm(`Delete client code ${row.clientCode}?`)) return;
    try {
      await deletePcgClientAccount(storeId, row.id);
      await refresh();
      toast.success("Deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const handleExportTemplate = () => {
    const csv = pcgClientAccountsTemplateCsv(
      grabioOptions.map((a) => ({ code: a.code, name: a.name, nameAr: a.nameAr })),
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pcg-client-accounts-template-${storeId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = () => {
    const csv = pcgClientAccountsToCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pcg-client-accounts-${storeId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parsePcgClientAccountsCsv(text);
      if (!parsed.length) {
        toast.error("No valid rows in CSV");
        return;
      }
      for (const row of parsed) {
        const err = validateClientPcgCode(row.clientCode);
        if (err) {
          toast.error(`${row.clientCode}: ${err}`);
          return;
        }
      }
      const saved = await replacePcgClientAccounts(storeId, parsed);
      onChange(saved);
      toast.success(`Imported ${saved.length} client account(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Add client code
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={handleExportTemplate}>
          <Download className="h-4 w-4 mr-1" /> CSV template
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4 mr-1" /> Import CSV
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImportFile(file);
            e.target.value = "";
          }}
        />
        <span className="text-xs text-muted-foreground ml-auto">
          {rows.length} working account{rows.length === 1 ? "" : "s"} · shown on Trial Balance
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-md border border-dashed p-4">
          No working account numbers yet. Add the accounts the accountant uses, or import a CSV from the old system.
        </p>
      ) : (
        <div className="rounded-md border overflow-auto max-h-64">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account number</TableHead>
                <TableHead className="w-[72px]">Grabio</TableHead>
                <TableHead>Parent PCG</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Cur</TableHead>
                <TableHead className="w-[88px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs tabular-nums">{row.clientCode}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{row.grabioOperationalCode}</TableCell>
                  <TableCell className="font-mono text-xs">{row.parentPcgCode || "—"}</TableCell>
                  <TableCell>
                    <div>{row.name || "—"}</div>
                    {row.nameAr ? (
                      <div dir="rtl" className="text-xs text-muted-foreground text-right">
                        {row.nameAr}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-xs">{row.currency}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(row)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => void handleDelete(row)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit working account" : "Add working account"}</DialogTitle>
            <DialogDescription>
              Add the account number the accountant wants to use under the selected Lebanese PCG parent.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="client-code">Account number</Label>
              <Input
                id="client-code"
                className="font-mono"
                value={form.clientCode}
                onChange={(e) => setForm((p) => ({ ...p, clientCode: e.target.value }))}
                placeholder="53001000002"
              />
            </div>
            <div>
              <Label htmlFor="parent-pcg">Parent PCG</Label>
              <Input
                id="parent-pcg"
                className="font-mono"
                value={form.parentPcgCode}
                onChange={(e) => setForm((p) => ({ ...p, parentPcgCode: e.target.value }))}
                placeholder="5300"
              />
            </div>
            <div>
              <Label htmlFor="client-name">Name (optional override)</Label>
              <Input
                id="client-name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="client-name-ar">Arabic name (optional)</Label>
              <Input
                id="client-name-ar"
                dir="rtl"
                value={form.nameAr}
                onChange={(e) => setForm((p) => ({ ...p, nameAr: e.target.value }))}
              />
            </div>
            <div>
              <Label>Currency</Label>
              <Select
                value={form.currency}
                onValueChange={(v) => setForm((p) => ({ ...p, currency: v === "USD" ? "USD" : "LL" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LL">LL</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <details className="rounded-md border p-3">
              <summary className="cursor-pointer text-sm font-medium">Advanced posting link</summary>
              <p className="mt-1 text-xs text-muted-foreground">
                Used by automation to connect this account number to the operational GL. Accountants normally do not
                need to change this.
              </p>
              <div className="mt-3">
                <Label>Posting account</Label>
                <Select value={form.grabioOperationalCode} onValueChange={onGrabioPick}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {grabioOptions.map((a) => (
                      <SelectItem key={a.id} value={a.code}>
                        {a.code} — {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </details>
          </div>
          {saveError ? (
            <p className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
              {saveError}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
