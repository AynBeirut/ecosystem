import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { exportToCSV, exportToPDF, type ReportData } from "@/lib/reportExport";
import { formatCurrency } from "@/lib/utils";
import type { Client, Invoice, Receipt } from "@/context/AppContext";
import { format } from "date-fns";
import { ArrowLeft, Calendar as CalendarIcon, Download, FileText, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";

type ClientStatement = {
  client: Client;
  invoices: Invoice[];
  receipts: Receipt[];
  totalInvoiced: number;
  totalPaid: number;
  outstanding: number;
};

function buildClientStatement(params: {
  client: Client;
  invoices: Invoice[];
  receipts: Receipt[];
  startDate?: Date;
  endDate?: Date;
}): ClientStatement {
  const { client, invoices, receipts, startDate, endDate } = params;

  const inRange = (raw: string) => {
    const d = new Date(raw);
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    return true;
  };

  const clientInvoices = invoices.filter((inv) => {
    const match = inv.clientId === client.id || inv.clientName === client.name;
    if (!match) return false;
    return inRange(inv.date);
  });

  const clientReceipts = receipts.filter((r) => {
    const match = r.clientId === client.id || r.clientName === client.name;
    if (!match) return false;
    return inRange(r.paymentDate || r.date);
  });

  const totalInvoiced = clientInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
  const totalPaid = clientReceipts.reduce((sum, r) => sum + (r.amount || 0), 0);
  const outstanding = Math.max(0, totalInvoiced - totalPaid);

  return {
    client,
    invoices: clientInvoices,
    receipts: clientReceipts,
    totalInvoiced,
    totalPaid,
    outstanding,
  };
}

export default function ClientAccountStatement(props: {
  client: Client;
  invoices: Invoice[];
  receipts: Receipt[];
  onBack: () => void;
}) {
  const { toast } = useToast();
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  const periodLabel = useMemo(() => {
    if (!startDate && !endDate) return "All time";
    const start = startDate ? format(startDate, "PPP") : "—";
    const end = endDate ? format(endDate, "PPP") : "—";
    return `${start} → ${end}`;
  }, [startDate, endDate]);

  const statement = buildClientStatement({
    client: props.client,
    invoices: props.invoices,
    receipts: props.receipts,
    startDate,
    endDate,
  });

  const exportRows = useMemo(() => {
    const invoiceRows = statement.invoices.map((inv) => ({
      date: inv.date,
      type: "Invoice",
      reference: inv.id,
      statusOrMethod: inv.status,
      amount: inv.amount,
      currency: inv.currency,
    }));

    const receiptRows = statement.receipts.map((r) => ({
      date: r.paymentDate || r.date,
      type: "Receipt",
      reference: r.id,
      statusOrMethod: r.paymentMethod,
      amount: r.amount,
      currency: r.currency,
    }));

    return [...invoiceRows, ...receiptRows].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [statement.invoices, statement.receipts]);

  const buildReport = (): ReportData => {
    const range =
      startDate || endDate
        ? {
            start: startDate ? format(startDate, "yyyy-MM-dd") : "",
            end: endDate ? format(endDate, "yyyy-MM-dd") : "",
          }
        : undefined;

    return {
      title: `Client_Statement_${props.client.name}`,
      subtitle: `Client Account Statement • ${props.client.name}`,
      dateRange: range,
      columns: [
        { key: "date", label: "Date", type: "date" },
        { key: "type", label: "Type", type: "text" },
        { key: "reference", label: "Reference", type: "text" },
        { key: "statusOrMethod", label: "Status / Method", type: "text" },
        { key: "amount", label: "Amount", type: "currency" },
      ],
      data: exportRows.map((r) => ({
        date: r.date,
        type: r.type,
        reference: r.reference,
        statusOrMethod: r.statusOrMethod,
        amount: r.amount,
      })),
      summary: {
        "Total Invoiced": statement.totalInvoiced,
        "Payments Received": statement.totalPaid,
        "Outstanding Balance": statement.outstanding,
      },
      currency: "USD",
    };
  };

  const onExportCSV = () => {
    const ok = exportToCSV(buildReport());
    toast({
      title: ok ? "Export started" : "Export failed",
      description: ok ? "CSV is downloading." : "Please try again.",
      variant: ok ? "default" : "destructive",
    });
  };

  const onExportPDF = () => {
    const ok = exportToPDF(buildReport());
    toast({
      title: ok ? "Export opened" : "Export failed",
      description: ok
        ? "A print window opened—save as PDF."
        : "Please allow popups and try again.",
      variant: ok ? "default" : "destructive",
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>{statement.client.name}</CardTitle>
              <CardDescription>Client Account Statement</CardDescription>
            </div>
            <Button variant="outline" onClick={props.onBack}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to List
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    Start: {startDate ? format(startDate, "PPP") : "Any"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="z-50 w-auto bg-popover p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    End: {endDate ? format(endDate, "PPP") : "Any"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="z-50 w-auto bg-popover p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>

              <Button
                variant="secondary"
                onClick={() => {
                  setStartDate(undefined);
                  setEndDate(undefined);
                }}
              >
                Clear
              </Button>

              <div className="text-sm text-muted-foreground">{periodLabel}</div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={onExportCSV}>
                <Download className="mr-2 h-4 w-4" /> Export CSV
              </Button>
              <Button onClick={onExportPDF}>
                <Download className="mr-2 h-4 w-4" /> Export PDF
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Invoiced
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {formatCurrency(statement.totalInvoiced, "USD")}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Payments Received
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(statement.totalPaid, "USD")}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Outstanding Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-destructive">
                  {formatCurrency(statement.outstanding, "USD")}
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
          <CardDescription>Invoices in selected period</CardDescription>
        </CardHeader>
        <CardContent>
          {statement.invoices.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <FileText className="mx-auto mb-3 h-10 w-10 opacity-50" />
              <p>No invoices found for this client</p>
            </div>
          ) : (
            <div className="space-y-3">
              {statement.invoices
                .slice()
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between gap-4 rounded-lg border p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={
                          inv.status === "paid"
                            ? "rounded-full bg-secondary p-2"
                            : "rounded-full bg-muted p-2"
                        }
                      >
                        {inv.status === "paid" ? (
                          <TrendingDown className="h-5 w-5 text-primary" />
                        ) : (
                          <TrendingUp className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{inv.id}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(inv.date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <p className="font-bold">{formatCurrency(inv.amount, inv.currency)}</p>
                      <Badge
                        variant={
                          inv.status === "paid"
                            ? "success"
                            : inv.status === "sent"
                              ? "default"
                              : "secondary"
                        }
                      >
                        {inv.status}
                      </Badge>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payments Received (Receipts)</CardTitle>
          <CardDescription>Receipts in selected period</CardDescription>
        </CardHeader>
        <CardContent>
          {statement.receipts.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <FileText className="mx-auto mb-3 h-10 w-10 opacity-50" />
              <p>No receipts found for this client</p>
            </div>
          ) : (
            <div className="space-y-3">
              {statement.receipts
                .slice()
                .sort(
                  (a, b) =>
                    new Date(b.paymentDate || b.date).getTime() -
                    new Date(a.paymentDate || a.date).getTime()
                )
                .map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-4 rounded-lg border p-4"
                  >
                    <div>
                      <p className="font-medium">{r.id}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(r.paymentDate || r.date).toLocaleDateString()} • {r.paymentMethod}
                      </p>
                    </div>
                    <p className="font-bold text-primary">
                      +{formatCurrency(r.amount, r.currency)}
                    </p>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
