import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import SystemGuideInfo from '@/components/SystemGuideInfo';
import {
  deleteCostCenter,
  loadCostCenters,
  saveCostCenter,
} from '@/lib/firestore/costCentersFirestore';
import type { LedgerCostCenter } from '@/types/generalLedger';

type Props = {
  storeId: string;
  systemGuideEnabled?: boolean;
};

export default function CostCentersPanel({ storeId, systemGuideEnabled = false }: Props) {
  const [rows, setRows] = useState<LedgerCostCenter[]>([]);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      setRows(await loadCostCenters(storeId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load cost centers');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const addCenter = async () => {
    if (!storeId || !code.trim() || !name.trim()) {
      toast.error('Code and name are required.');
      return;
    }
    setSaving(true);
    try {
      await saveCostCenter(storeId, {
        code: code.trim(),
        name: name.trim(),
        isActive: true,
      });
      setCode('');
      setName('');
      toast.success('Cost center saved');
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!storeId) return;
    try {
      await deleteCostCenter(storeId, id);
      toast.success('Deleted');
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Cost centers
          <SystemGuideInfo
            enabled={systemGuideEnabled}
            label="What cost centers are"
            title="Analytical dimensions"
            content={[
              'Optional department/project codes (Libra centres de coûts). Master list for future voucher-line tagging.',
              'Add codes your accountant uses — e.g. ADMIN, SALES, BEIRUT.',
            ]}
          />
        </CardTitle>
        <CardDescription>Analytical accounting dimensions · P1 master list</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3 max-w-xl">
          <div>
            <Label>Code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="ADMIN" className="w-[120px]" />
          </div>
          <div className="flex-1 min-w-[160px]">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Administration" />
          </div>
          <Button type="button" onClick={() => void addCenter()} disabled={saving || !storeId}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-mono">{row.code}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell>
                  <Badge variant={row.isActive ? 'default' : 'secondary'}>{row.isActive ? 'Active' : 'Inactive'}</Badge>
                </TableCell>
                <TableCell>
                  <Button type="button" variant="ghost" size="sm" onClick={() => void remove(row.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!loading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground text-center">No cost centers yet.</TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
