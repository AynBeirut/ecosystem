import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, Loader2, Filter } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import { exportToCSV } from '@/lib/exportUtils';
import {
  fetchActivities,
  fetchCrmClients,
  fetchCrmReps,
  type CrmClient,
} from '@/lib/crmService';
import {
  CRM_ACTIVITY_TYPES,
  CRM_ACTIVITY_RESULTS,
  type CrmActivityType,
  type CrmActivityResult,
} from '@/types/crm';
import {
  CRM_ACTIVITY_TYPE_LABELS,
  CRM_ACTIVITY_RESULT_LABELS,
} from '@/lib/crm';
import type { CrmActivity } from '@/types/crm';
import { useToast } from '@/hooks/use-toast';

const cleanTextForPDF = (text: string): string => text.replace(/[^\u0000-\u007F]/g, '?');

const CrmActivities: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const storeId = getActualStoreId(user);
  const [reps, setReps] = useState<Awaited<ReturnType<typeof fetchCrmReps>>>([]);
  const [clients, setClients] = useState<CrmClient[]>([]);
  const [rawActivities, setRawActivities] = useState<CrmActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [repFilter, setRepFilter] = useState<string>('all');
  const [clientSearch, setClientSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [resultFilter, setResultFilter] = useState<string>('all');

  const clientNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of clients) m.set(c.id, c.name || c.id);
    return m;
  }, [clients]);

  const activities = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return rawActivities;
    return rawActivities.filter((a) => {
      const name = (clientNameById.get(a.customerId) || '').toLowerCase();
      return name.includes(q) || a.customerId.toLowerCase().includes(q);
    });
  }, [rawActivities, clientSearch, clientNameById]);

  const load = useCallback(async () => {
    if (!storeId) {
      setRawActivities([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [repList, clientList, actList] = await Promise.all([
        fetchCrmReps(storeId),
        fetchCrmClients(storeId),
        fetchActivities(storeId, {
          repId: repFilter === 'all' ? undefined : repFilter,
          type: typeFilter === 'all' ? undefined : (typeFilter as CrmActivityType),
          result: resultFilter === 'all' ? undefined : (resultFilter as CrmActivityResult),
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
        }),
      ]);
      setReps(repList);
      setClients(clientList);
      setRawActivities(actList);
    } catch (e) {
      toast({
        title: 'Failed to load activities',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [storeId, repFilter, typeFilter, resultFilter, fromDate, toDate, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const rowsForExport = useMemo(
    () =>
      activities.map((a) => ({
        date: new Date(a.loggedAt).toLocaleString(),
        rep: a.repName,
        client: clientNameById.get(a.customerId) || a.customerId,
        type: CRM_ACTIVITY_TYPE_LABELS[a.type],
        result: CRM_ACTIVITY_RESULT_LABELS[a.result],
        notes: a.notes || '',
        gpsLink:
          a.location?.lat != null && a.location?.lng != null
            ? `https://maps.google.com/?q=${a.location.lat},${a.location.lng}`
            : '',
      })),
    [activities, clientNameById],
  );

  const handleCsv = () => {
    if (rowsForExport.length === 0) {
      toast({ title: 'Nothing to export', variant: 'destructive' });
      return;
    }
    exportToCSV(rowsForExport, 'crm_activities');
    toast({ title: 'CSV downloaded' });
  };

  const handlePdf = () => {
    if (rowsForExport.length === 0) {
      toast({ title: 'Nothing to export', variant: 'destructive' });
      return;
    }
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16);
    doc.text('CRM Activity feed', 148, 14, { align: 'center' });
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 148, 20, { align: 'center' });
    const tableData = rowsForExport.map((r) => [
      cleanTextForPDF(r.date),
      cleanTextForPDF(r.rep),
      cleanTextForPDF(r.client),
      cleanTextForPDF(r.type),
      cleanTextForPDF(r.result),
      cleanTextForPDF(r.notes),
      cleanTextForPDF(r.gpsLink),
    ]);
    autoTable(doc, {
      startY: 24,
      head: [['Date', 'Rep', 'Client', 'Type', 'Result', 'Notes', 'GPS']],
      body: tableData,
      theme: 'striped',
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [66, 66, 66], textColor: 255, fontStyle: 'bold' },
    });
    doc.save(`crm_activities_${new Date().toISOString().split('T')[0]}.pdf`);
    toast({ title: 'PDF downloaded' });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Activity feed</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Refine activities and export for reporting.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div>
            <Label>Rep</Label>
            <Select value={repFilter} onValueChange={setRepFilter}>
              <SelectTrigger><SelectValue placeholder="All reps" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All reps</SelectItem>
                {reps.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Client search</Label>
            <Input value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} placeholder="Name…" />
          </div>
          <div>
            <Label>From</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <Label>To</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {CRM_ACTIVITY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{CRM_ACTIVITY_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Result</Label>
            <Select value={resultFilter} onValueChange={setResultFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {CRM_ACTIVITY_RESULTS.map((r) => (
                  <SelectItem key={r} value={r}>{CRM_ACTIVITY_RESULT_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-3 xl:col-span-6">
            <Button variant="outline" onClick={handleCsv} disabled={loading}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={handlePdf} disabled={loading}>
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <Button variant="secondary" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Rep</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>GPS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activities.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No activities match your filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    activities.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {new Date(a.loggedAt).toLocaleString()}
                        </TableCell>
                        <TableCell>{a.repName}</TableCell>
                        <TableCell>{clientNameById.get(a.customerId) || a.customerId}</TableCell>
                        <TableCell>{CRM_ACTIVITY_TYPE_LABELS[a.type]}</TableCell>
                        <TableCell>{CRM_ACTIVITY_RESULT_LABELS[a.result]}</TableCell>
                        <TableCell className="max-w-[200px] truncate" title={a.notes}>
                          {a.notes || '—'}
                        </TableCell>
                        <TableCell>
                          {a.location?.lat != null && a.location?.lng != null ? (
                            <a
                              href={`https://maps.google.com/?q=${a.location.lat},${a.location.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary underline text-sm"
                            >
                              Map
                            </a>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CrmActivities;
