import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Loader2, MapPin, Plus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCrmStore } from '@/hooks/useCrmStore';
import AddCrmClientDialog from '@/components/crm/AddCrmClientDialog';
import CrmLocationFilters, {
  crmEmptyLocationFilter,
  crmMatchesLocationFilter,
} from '@/components/crm/CrmLocationFilters';
import { CRM_CUSTOMER_TYPE_LABELS } from '@/lib/crm';
import type { CrmCustomerType } from '@/types/crm';

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
  } catch {
    return '—';
  }
}

const CrmCustomers: React.FC = () => {
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  const [locationFilter, setLocationFilter] = useState(crmEmptyLocationFilter());
  const [repFilter, setRepFilter] = useState('all');
  const [search, setSearch] = useState('');
  const { clients, reps, loading, storeId, reload } = useCrmStore({ crmOnly: false });

  const repName = useMemo(() => {
    const m = new Map(reps.map((r) => [r.id, r.name]));
    return (id: string | null | undefined) => (id ? m.get(id) ?? '—' : '—');
  }, [reps]);

  const extraGovernorates = useMemo(() => {
    const set = new Set<string>();
    for (const c of clients) if (c.district?.trim()) set.add(c.district.trim());
    return Array.from(set);
  }, [clients]);

  const extraAreas = useMemo(() => {
    const set = new Set<string>();
    for (const c of clients) if (c.area?.trim()) set.add(c.area.trim());
    return Array.from(set);
  }, [clients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (!crmMatchesLocationFilter(c, locationFilter)) return false;
      if (repFilter !== 'all' && c.assignedRepId !== repFilter) return false;
      if (!q) return true;
      const typeLabel =
        c.customerType && c.customerType in CRM_CUSTOMER_TYPE_LABELS
          ? CRM_CUSTOMER_TYPE_LABELS[c.customerType as CrmCustomerType]
          : '';
      return [c.name, c.customerCode, c.phone, c.country, c.district, c.area, typeLabel]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q));
    });
  }, [clients, locationFilter, repFilter, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-semibold">Customers</h2>
            <p className="text-sm text-muted-foreground">Location dropdowns appear when you click Add customer.</p>
          </div>
        </div>
        <Button onClick={() => setAddOpen(true)} disabled={!storeId}>
          <Plus className="h-4 w-4 mr-2" />
          Add customer
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Filter by location
          </CardTitle>
          <CardDescription>Country → Governorate → Area (e.g. Lebanon / Mount Lebanon / Hamana)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CrmLocationFilters
            value={locationFilter}
            onChange={setLocationFilter}
            extraGovernorates={extraGovernorates}
            extraAreas={extraAreas}
          />
          <div className="flex flex-wrap gap-4 items-end pt-1 border-t">
            <div className="min-w-[200px] flex-1">
              <Label>Search</Label>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, code, phone…" />
            </div>
            <div className="min-w-[160px]">
              <Label>Sales rep</Label>
              <Select value={repFilter} onValueChange={setRepFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All reps</SelectItem>
                  {reps.map((r) => (<SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Governorate</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead>GPS</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Rep</TableHead>
                  <TableHead>Last visit</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                      No customers match filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((c) => (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => navigate(`/admin/crm/clients/${c.id}`)}
                    >
                      <TableCell className="font-medium">{c.name || '—'}</TableCell>
                      <TableCell>{c.customerCode || '—'}</TableCell>
                      <TableCell>{c.phone || '—'}</TableCell>
                      <TableCell>{c.country || '—'}</TableCell>
                      <TableCell>{c.district || '—'}</TableCell>
                      <TableCell>{c.area || '—'}</TableCell>
                      <TableCell className="text-xs font-mono">
                        {c.location?.lat != null && c.location?.lng != null
                          ? `${c.location.lat.toFixed(4)}, ${c.location.lng.toFixed(4)}`
                          : '—'}
                      </TableCell>
                      <TableCell>
                        {c.customerType && c.customerType in CRM_CUSTOMER_TYPE_LABELS
                          ? CRM_CUSTOMER_TYPE_LABELS[c.customerType as CrmCustomerType]
                          : '—'}
                      </TableCell>
                      <TableCell>{repName(c.assignedRepId)}</TableCell>
                      <TableCell>{formatDate(c.lastVisitDate || c.lastActivityAt)}</TableCell>
                      <TableCell>
                        <Badge variant={c.status === 'inactive' ? 'secondary' : 'default'}>
                          {c.status === 'inactive' ? 'Inactive' : 'Active'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {storeId ? (
        <AddCrmClientDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          storeId={storeId}
          reps={reps}
          onCreated={() => void reload()}
        />
      ) : null}
    </div>
  );
};

export default CrmCustomers;
